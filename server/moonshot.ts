import OpenAI from "openai";

const MOONSHOT_BASE_URL = "https://api.moonshot.ai/v1";
const DEFAULT_MODEL = "kimi-k2.5";

let moonshotClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (moonshotClient) return moonshotClient;
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) {
    throw new Error("Moonshot/Kimi is not configured. MOONSHOT_API_KEY is required.");
  }
  moonshotClient = new OpenAI({
    apiKey,
    baseURL: MOONSHOT_BASE_URL,
    timeout: 300_000,
  });
  return moonshotClient;
}

export function isMoonshotAvailable(): boolean {
  return !!process.env.MOONSHOT_API_KEY;
}

interface MoonshotChatOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>;
  maxTokens?: number;
  model?: string;
  temperature?: number;
}

interface MoonshotResponse {
  content: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export async function chatWithMoonshot(options: MoonshotChatOptions): Promise<MoonshotResponse> {
  const client = getClient();
  const model = options.model || DEFAULT_MODEL;
  const temperature = Number.isFinite(options.temperature) ? Number(options.temperature) : 0.7;

  const response = await client.chat.completions.create({
    model,
    messages: options.messages as any,
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

export async function* streamWithMoonshot(options: MoonshotChatOptions): AsyncGenerator<string> {
  const client = getClient();
  const model = options.model || DEFAULT_MODEL;
  const temperature = Number.isFinite(options.temperature) ? Number(options.temperature) : 0.7;

  const stream = await client.chat.completions.create({
    model,
    messages: options.messages as any,
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

export function getMoonshotModelName(): string {
  return DEFAULT_MODEL;
}
