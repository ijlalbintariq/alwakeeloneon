import OpenAI from "openai";
import { toFile } from "openai/uploads";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const FALLBACK_MODEL = "openai/gpt-oss-120b";
type GroqReasoningEffort = "low" | "medium" | "high";

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

const ALLOWED_MODELS = [
  "openai/gpt-oss-120b",
] as const;

async function resolveModel(): Promise<string> {
  if (resolvedModel) return resolvedModel!;

  try {
    const client = getClient();
    const modelsResponse = await client.models.list();
    const available = modelsResponse.data.map((m: any) => m.id);
    console.log("[Groq] Available models:", available.join(", "));

    for (const preferred of ALLOWED_MODELS) {
      if (available.includes(preferred)) {
        resolvedModel = preferred;
        console.log(`[Groq] Selected model: ${resolvedModel}`);
        return resolvedModel!;
      }
    }
    console.warn("[Groq] None of the allowed models are available:", ALLOWED_MODELS.join(", "));
  } catch (err: any) {
    console.warn("[Groq] Could not fetch models list:", err?.message || err);
  }

  // Keep a deterministic fallback from the allowed list only.
  resolvedModel = FALLBACK_MODEL;
  console.log(`[Groq] Falling back to allowed default model: ${resolvedModel}`);
  return resolvedModel!;
}

export function getGroqModelName(): string {
  return resolvedModel || FALLBACK_MODEL;
}

interface GroqChatOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  model?: string;
  temperature?: number;
  reasoningEffort?: GroqReasoningEffort;
  signal?: AbortSignal;
}

interface GroqResponse {
  content: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

interface GroqTranscriptionOptions {
  audioBuffer: Buffer;
  filename?: string;
  mimeType?: string;
  model?: string;
  language?: string;
  prompt?: string;
}

interface GroqTranscriptionResult {
  text: string;
  model: string;
}

function resolveReasoningEffort(value: unknown): GroqReasoningEffort {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") return normalized;
  return "medium";
}

export async function chatWithGroq(options: GroqChatOptions): Promise<GroqResponse> {
  const client = getClient();
  const model = options.model || await resolveModel();
  const temperature = Number.isFinite(options.temperature) ? Number(options.temperature) : 0.7;
  const reasoningEffort = resolveReasoningEffort(options.reasoningEffort || process.env.GROQ_REASONING_EFFORT);

  const response = await client.chat.completions.create(
    {
      model,
      messages: options.messages,
      max_tokens: options.maxTokens || 8192,
      temperature,
      reasoning_effort: reasoningEffort,
    } as any,
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

export async function* streamWithGroq(options: GroqChatOptions): AsyncGenerator<string> {
  const client = getClient();
  const model = options.model || await resolveModel();
  const temperature = Number.isFinite(options.temperature) ? Number(options.temperature) : 0.7;
  const reasoningEffort = resolveReasoningEffort(options.reasoningEffort || process.env.GROQ_REASONING_EFFORT);

  const stream = await client.chat.completions.create(
    {
      model,
      messages: options.messages,
      max_tokens: options.maxTokens || 8192,
      temperature,
      reasoning_effort: reasoningEffort,
      stream: true,
    } as any,
    { signal: options.signal, maxRetries: 1 } as any,
  );

  for await (const chunk of stream as unknown as AsyncIterable<any>) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) {
      yield text;
    }
  }
}

export async function transcribeWithGroq(options: GroqTranscriptionOptions): Promise<GroqTranscriptionResult> {
  const client = getClient();
  const model = options.model || process.env.GROQ_TRANSCRIBE_MODEL || "whisper-large-v3-turbo";
  const audioFile = await toFile(options.audioBuffer, options.filename || "audio.webm", {
    type: options.mimeType || "audio/webm",
  });

  const response = await client.audio.transcriptions.create({
    model,
    file: audioFile,
    response_format: "json",
    temperature: 0,
    ...(options.language ? { language: options.language } : {}),
    ...(options.prompt ? { prompt: options.prompt } : {}),
  });

  return {
    text: (response as any)?.text || "",
    model,
  };
}
