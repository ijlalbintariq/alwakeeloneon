import OpenAI from "openai";
import type { ChatCompletionTool, ChatCompletionMessageParam } from "openai/resources/chat/completions";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_CHAT_MODEL = "deepseek-chat";
const DEEPSEEK_REASONER_MODEL = "deepseek-reasoner";

let deepseekClient: OpenAI | null = null;

function resolveDeepSeekApiKey(): string | undefined {
  return process.env.DEEPSEEK_API_KEY || process.env.DeepSeek_API_KEY;
}

function getClient(): OpenAI {
  if (deepseekClient) return deepseekClient;
  const apiKey = resolveDeepSeekApiKey();
  if (!apiKey) {
    throw new Error("DeepSeek is not configured. Set DEEPSEEK_API_KEY.");
  }
  deepseekClient = new OpenAI({
    apiKey,
    baseURL: DEEPSEEK_BASE_URL,
  });
  return deepseekClient;
}

export function isDeepSeekAvailable(): boolean {
  return !!resolveDeepSeekApiKey();
}

export function getDeepSeekModelName(): string {
  return DEEPSEEK_CHAT_MODEL;
}

export function getDeepSeekProModelName(): string {
  return DEEPSEEK_REASONER_MODEL;
}

interface DeepSeekChatOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
}

interface DeepSeekResponse {
  content: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

interface DeepSeekTranscriptionOptions {
  audioBase64: string;
  audioFormat: "wav" | "mp3" | "m4a" | "webm" | "ogg";
  prompt?: string;
}

export async function chatWithDeepSeek(options: DeepSeekChatOptions): Promise<DeepSeekResponse> {
  const client = getClient();
  const model = options.model || DEEPSEEK_CHAT_MODEL;
  const temperature = Number.isFinite(options.temperature) ? Number(options.temperature) : 0.7;

  const response = await client.chat.completions.create(
    {
      model,
      messages: options.messages,
      max_tokens: options.maxTokens || 8192,
      temperature,
    },
    { signal: options.signal, maxRetries: 1 } as any,
  );

  const choice = response.choices[0];
  const content = choice?.message?.content || "No response generated.";

  return {
    content,
    model: response.model || model,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}

export async function chatWithDeepSeekPro(options: Omit<DeepSeekChatOptions, "model">): Promise<DeepSeekResponse> {
  return chatWithDeepSeek({ ...options, model: DEEPSEEK_REASONER_MODEL });
}

export async function* streamWithDeepSeek(options: DeepSeekChatOptions): AsyncGenerator<string> {
  const client = getClient();
  const model = options.model || DEEPSEEK_CHAT_MODEL;
  const temperature = Number.isFinite(options.temperature) ? Number(options.temperature) : 0.7;

  const stream = await client.chat.completions.create(
    {
      model,
      messages: options.messages,
      max_tokens: options.maxTokens || 8192,
      temperature,
      stream: true,
    },
    { signal: options.signal, maxRetries: 1 } as any,
  );

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) {
      yield text;
    }
  }
}

// ── Tool-calling support ─────────────────────────────────────────────────────

export interface ToolCallOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  tools: ChatCompletionTool[];
  toolExecutor: (name: string, args: Record<string, unknown>) => Promise<string>;
  maxTokens?: number;
  maxToolRounds?: number; // safety limit on tool call iterations
  signal?: AbortSignal;
}

/**
 * Chat with DeepSeek using function/tool calling.
 * Runs a tool-call loop: AI calls tool → executor runs it → results fed back → AI responds.
 * Returns the final text response after all tool calls are resolved.
 */
export async function chatWithDeepSeekTools(options: ToolCallOptions): Promise<DeepSeekResponse> {
  const client = getClient();
  const { tools, toolExecutor, maxToolRounds = 4, maxTokens = 8192 } = options;

  const messages: ChatCompletionMessageParam[] = options.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let inputTokensTotal = 0;
  let outputTokensTotal = 0;
  let rounds = 0;

  while (rounds < maxToolRounds) {
    rounds++;

    const response = await client.chat.completions.create(
      {
        model: DEEPSEEK_CHAT_MODEL,
        messages,
        tools,
        tool_choice: "auto",
        max_tokens: maxTokens,
        temperature: 0.3, // lower temp for more deterministic tool use
      },
      { signal: options.signal, maxRetries: 1 } as any,
    );

    inputTokensTotal += response.usage?.prompt_tokens ?? 0;
    outputTokensTotal += response.usage?.completion_tokens ?? 0;

    const choice = response.choices[0];
    const message = choice?.message;

    // Push assistant message to history
    messages.push(message as ChatCompletionMessageParam);

    // If no tool calls → we have the final response
    if (!message?.tool_calls || message.tool_calls.length === 0) {
      return {
        content: message?.content || "No response generated.",
        model: response.model || DEEPSEEK_CHAT_MODEL,
        inputTokens: inputTokensTotal,
        outputTokens: outputTokensTotal,
      };
    }

    // Execute each tool call and push results back
    for (const toolCall of message.tool_calls) {
      const tc = toolCall as any;
      const fnName = tc.function?.name ?? "";
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function?.arguments || "{}");
      } catch {
        args = {};
      }

      let result = "";
      try {
        result = await toolExecutor(fnName, args);
      } catch (err) {
        result = JSON.stringify({ error: "Tool execution failed", message: String(err) });
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      } as ChatCompletionMessageParam);
    }
  }

  // Fallback: ask for final response without tools after max rounds
  const fallbackResponse = await client.chat.completions.create(
    {
      model: DEEPSEEK_CHAT_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    },
    { signal: options.signal, maxRetries: 1 } as any,
  );

  return {
    content: fallbackResponse.choices[0]?.message?.content || "No response generated.",
    model: fallbackResponse.model || DEEPSEEK_CHAT_MODEL,
    inputTokens: inputTokensTotal + (fallbackResponse.usage?.prompt_tokens ?? 0),
    outputTokens: outputTokensTotal + (fallbackResponse.usage?.completion_tokens ?? 0),
  };
}

export async function transcribeWithDeepSeek(options: DeepSeekTranscriptionOptions): Promise<DeepSeekResponse> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: DEEPSEEK_CHAT_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: {
              data: options.audioBase64,
              format: options.audioFormat,
            },
          },
          {
            type: "text",
            text:
              options.prompt ||
              "Transcribe this audio accurately. Return ONLY the transcription text. If the audio is in Urdu or another language, transcribe it in that language.",
          },
        ] as any,
      },
    ],
    max_tokens: 2048,
    temperature: 0,
  } as any);

  const choice = response.choices[0];
  const messageContent: any = choice?.message?.content;
  const content =
    typeof messageContent === "string"
      ? messageContent
      : Array.isArray(messageContent)
        ? messageContent.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join(" ").trim()
        : "No response generated.";

  return {
    content,
    model: response.model || DEEPSEEK_CHAT_MODEL,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}
