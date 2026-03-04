import OpenAI from "openai";

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

  const response = await client.chat.completions.create({
    model,
    messages: options.messages,
    max_tokens: options.maxTokens || 8192,
    temperature: 0.7,
  });

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

  const stream = await client.chat.completions.create({
    model,
    messages: options.messages,
    max_tokens: options.maxTokens || 8192,
    temperature: 0.7,
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) {
      yield text;
    }
  }
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
