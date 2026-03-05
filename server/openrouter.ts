import OpenAI from "openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "google/gemini-2.0-flash-001";

let openrouterClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (openrouterClient) return openrouterClient;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OpenRouter is not configured. OPENROUTER_API_KEY is required.");
  }
  openrouterClient = new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": "https://al-wakeelo.replit.app",
      "X-Title": "Al Wakeelo Legal Assistant",
    },
  });
  return openrouterClient;
}

export function isOpenRouterAvailable(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

interface OpenRouterChatOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  model?: string;
  temperature?: number;
}

interface OpenRouterResponse {
  content: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export async function chatWithOpenRouter(options: OpenRouterChatOptions): Promise<OpenRouterResponse> {
  const client = getClient();
  const model = options.model || DEFAULT_MODEL;
  const temperature = Number.isFinite(options.temperature) ? Number(options.temperature) : 0.7;

  const response = await client.chat.completions.create({
    model,
    messages: options.messages,
    max_tokens: options.maxTokens || 8192,
    temperature,
  });

  const choice = response.choices[0];
  const content = choice?.message?.content || "No response generated.";

  return {
    content,
    model,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}

export async function* streamWithOpenRouter(options: OpenRouterChatOptions): AsyncGenerator<string> {
  const client = getClient();
  const model = options.model || DEFAULT_MODEL;
  const temperature = Number.isFinite(options.temperature) ? Number(options.temperature) : 0.7;

  const stream = await client.chat.completions.create({
    model,
    messages: options.messages,
    max_tokens: options.maxTokens || 8192,
    temperature,
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) {
      yield text;
    }
  }
}

export function getOpenRouterModelName(): string {
  return DEFAULT_MODEL;
}
