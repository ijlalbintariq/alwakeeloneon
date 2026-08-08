const OPENROUTER_TRANSCRIPTION_URL = "https://openrouter.ai/api/v1/audio/transcriptions";
const DEFAULT_PRIMARY_MODEL = "openai/gpt-4o-transcribe";
const DEFAULT_FALLBACK_MODEL = "openai/whisper-large-v3";
const DEFAULT_TIMEOUT_MS = 45_000;

export type OpenRouterAudioFormat = "wav" | "mp3" | "m4a" | "webm" | "ogg" | "flac" | "aac";

type FetchImplementation = typeof fetch;

export interface OpenRouterTranscriptionOptions {
  audioBuffer: Buffer;
  audioFormat: OpenRouterAudioFormat;
  apiKey?: string;
  endpoint?: string;
  fetchImpl?: FetchImplementation;
  primaryModel?: string;
  fallbackModel?: string;
  timeoutMs?: number;
}

export interface OpenRouterTranscriptionResult {
  text: string;
  model: string;
  fallbackUsed: boolean;
  fallbackFrom: string | null;
  usage?: Record<string, unknown>;
}

export function resolveOpenRouterAudioFormat(mimeType: string, filename: string): OpenRouterAudioFormat | null {
  const normalizedMime = mimeType.toLowerCase().split(";", 1)[0].trim();
  const normalizedFilename = filename.toLowerCase();

  if (normalizedMime === "audio/wav" || normalizedMime === "audio/x-wav") return "wav";
  if (normalizedMime === "audio/mpeg" || normalizedMime === "audio/mp3") return "mp3";
  if (normalizedMime === "audio/mp4" || normalizedMime === "audio/x-m4a") return "m4a";
  if (normalizedMime === "audio/webm") return "webm";
  if (normalizedMime === "audio/ogg") return "ogg";
  if (normalizedMime === "audio/flac" || normalizedMime === "audio/x-flac") return "flac";
  if (normalizedMime === "audio/aac") return "aac";

  if (normalizedFilename.endsWith(".wav")) return "wav";
  if (normalizedFilename.endsWith(".mp3")) return "mp3";
  if (normalizedFilename.endsWith(".m4a") || normalizedFilename.endsWith(".mp4")) return "m4a";
  if (normalizedFilename.endsWith(".webm")) return "webm";
  if (normalizedFilename.endsWith(".ogg")) return "ogg";
  if (normalizedFilename.endsWith(".flac")) return "flac";
  if (normalizedFilename.endsWith(".aac")) return "aac";
  return null;
}

function resolveApiKey(explicitApiKey?: string): string | undefined {
  if (explicitApiKey !== undefined) return explicitApiKey.trim() || undefined;
  const configured = process.env.OPENROUTER_API_KEY || process.env.OpenRouter_API_KEY;
  return configured?.trim() || undefined;
}

function resolveTimeoutMs(explicitTimeout?: number): number {
  if (explicitTimeout !== undefined) {
    return Number.isFinite(explicitTimeout)
      ? Math.min(120_000, Math.max(1, Math.round(explicitTimeout)))
      : DEFAULT_TIMEOUT_MS;
  }
  const configured = Number(process.env.OPENROUTER_TRANSCRIBE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
  return Math.min(120_000, Math.max(5_000, Math.round(configured)));
}

function getResponseError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) return record.message.trim();
    if (record.error && typeof record.error === "object") {
      const message = (record.error as Record<string, unknown>).message;
      if (typeof message === "string" && message.trim()) return message.trim();
    }
  }
  return `OpenRouter transcription failed (${status})`;
}

async function transcribeWithModel(
  options: OpenRouterTranscriptionOptions,
  model: string,
): Promise<{ text: string; model: string; usage?: Record<string, unknown> }> {
  const apiKey = resolveApiKey(options.apiKey);
  if (!apiKey) {
    throw new Error("OpenRouter transcription is not configured. OPENROUTER_API_KEY is required.");
  }

  const controller = new AbortController();
  const timeoutMs = resolveTimeoutMs(options.timeoutMs);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await (options.fetchImpl || fetch)(options.endpoint || OPENROUTER_TRANSCRIPTION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://alwakeelo.com",
        "X-Title": "Al Wakeelo",
      },
      body: JSON.stringify({
        model,
        input_audio: {
          data: options.audioBuffer.toString("base64"),
          format: options.audioFormat,
        },
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      throw new Error(getResponseError(payload, response.status));
    }

    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    if (!text) {
      throw new Error(`OpenRouter model ${model} returned an empty transcription.`);
    }

    return {
      text,
      model,
      usage: payload?.usage && typeof payload.usage === "object"
        ? payload.usage as Record<string, unknown>
        : undefined,
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`OpenRouter transcription timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function isOpenRouterTranscriptionAvailable(): boolean {
  return !!resolveApiKey();
}

export function getOpenRouterTranscriptionModels(): { primary: string; fallback: string } {
  return {
    primary: process.env.OPENROUTER_TRANSCRIBE_MODEL || DEFAULT_PRIMARY_MODEL,
    fallback: process.env.OPENROUTER_TRANSCRIBE_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
  };
}

export async function transcribeWithOpenRouter(
  options: OpenRouterTranscriptionOptions,
): Promise<OpenRouterTranscriptionResult> {
  const configuredModels = getOpenRouterTranscriptionModels();
  const primaryModel = options.primaryModel || configuredModels.primary;
  const fallbackModel = options.fallbackModel || configuredModels.fallback;

  try {
    const primary = await transcribeWithModel(options, primaryModel);
    return { ...primary, fallbackUsed: false, fallbackFrom: null };
  } catch (primaryError) {
    if (!fallbackModel || fallbackModel === primaryModel) throw primaryError;
    console.warn(
      `[OpenRouterTranscription] Primary model ${primaryModel} failed; trying ${fallbackModel}:`,
      primaryError instanceof Error ? primaryError.message : String(primaryError),
    );
  }

  const fallback = await transcribeWithModel(options, fallbackModel);
  return {
    ...fallback,
    fallbackUsed: true,
    fallbackFrom: primaryModel,
  };
}
