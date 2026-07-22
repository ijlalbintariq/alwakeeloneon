import OpenAI from "openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

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
  messages: Array<{ role: "system" | "user" | "assistant"; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>;
  maxTokens?: number;
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
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

export async function* streamWithOpenRouter(options: OpenRouterChatOptions): AsyncGenerator<string> {
  const client = getClient();
  const model = options.model || DEFAULT_MODEL;
  const temperature = Number.isFinite(options.temperature) ? Number(options.temperature) : 0.7;

  const controller = new AbortController();
  const INACTIVITY_TIMEOUT_MS = Number(process.env.AI_STREAM_INACTIVITY_TIMEOUT_MS || 45000);

  const parentSignal = options.signal;
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener("abort", onParentAbort);
  }

  let watchdog: NodeJS.Timeout | null = null;
  const resetWatchdog = () => {
    if (watchdog) clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      console.warn(`[OpenRouterStream] Inactivity timeout of ${INACTIVITY_TIMEOUT_MS}ms triggered for model ${model}. Aborting stream.`);
      controller.abort();
    }, INACTIVITY_TIMEOUT_MS);
  };

  try {
    resetWatchdog();
    const stream = await client.chat.completions.create(
      {
        model,
        messages: options.messages as any,
        max_tokens: options.maxTokens || 8192,
        temperature,
        stream: true,
      },
      { signal: controller.signal } as any,
    );

    for await (const chunk of stream) {
      resetWatchdog();
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        yield text;
      }
    }
  } finally {
    if (watchdog) clearTimeout(watchdog);
    if (parentSignal) {
      parentSignal.removeEventListener("abort", onParentAbort);
    }
  }
}

export function getOpenRouterModelName(): string {
  return DEFAULT_MODEL;
}

