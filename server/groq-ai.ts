import OpenAI from "openai";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const FALLBACK_MODEL = "llama-3.3-70b-versatile";

let groqClient: OpenAI | null = null;
let resolvedModel: string | null = null;

function getClient(): OpenAI {
  if (groqClient) return groqClient;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Groq is not configured. GROQ_API_KEY is required.");
  }
  groqClient = new OpenAI({
    apiKey,
    baseURL: GROQ_BASE_URL,
  });
  return groqClient;
}

export function isGroqAvailable(): boolean {
  return !!process.env.GROQ_API_KEY;
}

const MODEL_PRIORITY = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
];

async function resolveModel(): Promise<string> {
  if (resolvedModel) return resolvedModel!;

  try {
    const client = getClient();
    const modelsResponse = await client.models.list();
    const available = modelsResponse.data.map((m: any) => m.id);
    console.log("[Groq] Available models:", available.join(", "));

    for (const preferred of MODEL_PRIORITY) {
      if (available.includes(preferred)) {
        resolvedModel = preferred;
        console.log(`[Groq] Selected model: ${resolvedModel}`);
        return resolvedModel!;
      }
    }

    if (available.length > 0) {
      resolvedModel = available[0];
      console.log(`[Groq] Using first available model: ${resolvedModel}`);
      return resolvedModel!;
    }
  } catch (err: any) {
    console.warn("[Groq] Could not fetch models list:", err?.message || err);
  }

  resolvedModel = FALLBACK_MODEL;
  console.log(`[Groq] Falling back to default model: ${resolvedModel}`);
  return resolvedModel!;
}

export function getGroqModelName(): string {
  return resolvedModel || FALLBACK_MODEL;
}

interface GroqChatOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  model?: string;
}

interface GroqResponse {
  content: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export async function chatWithGroq(options: GroqChatOptions): Promise<GroqResponse> {
  const client = getClient();
  const model = options.model || await resolveModel();

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

export async function* streamWithGroq(options: GroqChatOptions): AsyncGenerator<string> {
  const client = getClient();
  const model = options.model || await resolveModel();

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
