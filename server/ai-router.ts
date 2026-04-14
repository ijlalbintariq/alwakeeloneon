/**
 * ai-router.ts
 * ----------------------------------------------------------------------
 * Responsive AI routing layer (AI_ROUTER_V2).
 *
 * Responsibilities
 *   1. Provide a shared "race-with-deadline" helper for pre-flight enrichment
 *      (knowledge context, style memory) so the chat path never waits
 *      indefinitely on optional context.
 *   2. Provide a streaming fallback chain: try provider A; on failure BEFORE
 *      the first token has been emitted, transparently retry with provider B,
 *      then C. Once any token reaches the wire we are committed.
 *   3. Provide a non-streaming fallback chain for the JSON-response branch.
 *
 * Gated behind the AI_ROUTER_V2 env flag. When the flag is disabled the
 * existing paths in routes.ts remain untouched.
 *
 * Timeouts respect the existing 30s SLA; see DEFAULT_PER_PROVIDER_TIMEOUT_MS.
 * ----------------------------------------------------------------------
 */

import {
  chatWithGroq,
  streamWithGroq,
  getGroqModelName,
  isGroqAvailable,
} from "./groq-ai";
import {
  chatWithDeepSeek,
  chatWithDeepSeekPro,
  streamWithDeepSeek,
  getDeepSeekModelName,
  getDeepSeekProModelName,
  isDeepSeekAvailable,
} from "./deepseek-ai";

export type ProviderId = "groq" | "deepseek" | "deepseek-pro";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ProviderCallOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

/** 30s SLA per provider — matches MODEL_TIMEOUT_MS in routes.ts. */
export const DEFAULT_PER_PROVIDER_TIMEOUT_MS = 30_000;

export function isAiRouterV2Enabled(): boolean {
  const raw = String(process.env.AI_ROUTER_V2 || "").toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

// ─── Generic race-with-deadline ──────────────────────────────────────────

/**
 * Races a promise against a timeout. On timeout, returns the provided fallback
 * value rather than throwing — used for *optional* enrichment where a missing
 * result is acceptable.
 */
export async function raceToDeadline<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  label: string,
): Promise<{ value: T; timedOut: boolean; error?: unknown }> {
  let timer: NodeJS.Timeout | null = null;
  const TIMEOUT_SENTINEL = Symbol("timeout");
  try {
    const raceResult = await Promise.race<T | typeof TIMEOUT_SENTINEL>([
      promise.catch((err) => {
        // Convert rejection into a tagged value so we can distinguish from timeout.
        (raceToDeadline as any)._lastError = err;
        return fallback;
      }),
      new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
        timer = setTimeout(() => resolve(TIMEOUT_SENTINEL), ms);
      }),
    ]);
    if (raceResult === TIMEOUT_SENTINEL) {
      console.warn(`[AI Router] ${label} exceeded ${ms}ms deadline — using fallback`);
      return { value: fallback, timedOut: true };
    }
    return { value: raceResult as T, timedOut: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ─── Abortable per-provider wrappers ─────────────────────────────────────

function makeAbortable(perCallTimeoutMs: number, parentSignal?: AbortSignal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), perCallTimeoutMs);
  const onParentAbort = () => ctrl.abort();
  if (parentSignal) {
    if (parentSignal.aborted) ctrl.abort();
    else parentSignal.addEventListener("abort", onParentAbort, { once: true });
  }
  const release = () => {
    clearTimeout(timer);
    if (parentSignal) {
      try { parentSignal.removeEventListener("abort", onParentAbort); } catch {}
    }
  };
  return { signal: ctrl.signal, release };
}

// ─── Streaming fallback chain ────────────────────────────────────────────

export interface StreamResult {
  provider: ProviderId;
  modelName: string;
  fullText: string;
}

export interface StreamFallbackOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  perProviderTimeoutMs?: number;
  onChunk: (chunk: string) => void;
  // Hook to mark a per-provider attempt as having produced any output (so we
  // know not to fall back mid-flight).
  onProviderStart?: (p: ProviderId) => void;
  onProviderError?: (p: ProviderId, err: unknown) => void;
}

async function* streamFromProvider(
  provider: ProviderId,
  opts: ProviderCallOptions,
): AsyncGenerator<string> {
  switch (provider) {
    case "groq":
      yield* streamWithGroq(opts);
      return;
    case "deepseek":
      yield* streamWithDeepSeek(opts);
      return;
    case "deepseek-pro":
      yield* streamWithDeepSeek({ ...opts, model: getDeepSeekProModelName() });
      return;
  }
}

function providerModelName(provider: ProviderId): string {
  switch (provider) {
    case "groq":
      return getGroqModelName();
    case "deepseek":
      return getDeepSeekModelName();
    case "deepseek-pro":
      return getDeepSeekProModelName();
  }
}

function providerAvailable(provider: ProviderId): boolean {
  switch (provider) {
    case "groq":
      return isGroqAvailable();
    case "deepseek":
    case "deepseek-pro":
      return isDeepSeekAvailable();
  }
}

/**
 * Tries each provider in order. If the first provider fails BEFORE emitting
 * any tokens, falls back to the next. Once any byte is written via onChunk,
 * we are committed to that provider — a later failure surfaces to the caller.
 */
export async function streamWithFallback(
  chain: ProviderId[],
  opts: StreamFallbackOptions,
): Promise<StreamResult> {
  const perProviderTimeout = Math.max(5_000, opts.perProviderTimeoutMs ?? DEFAULT_PER_PROVIDER_TIMEOUT_MS);
  let lastErr: unknown = undefined;

  for (const provider of chain) {
    if (!providerAvailable(provider)) {
      console.warn(`[AI Router] Provider ${provider} unavailable — skipping`);
      continue;
    }

    const { signal, release } = makeAbortable(perProviderTimeout);
    let tokensEmitted = 0;
    let fullText = "";
    opts.onProviderStart?.(provider);

    try {
      const stream = streamFromProvider(provider, {
        messages: opts.messages,
        maxTokens: opts.maxTokens,
        temperature: opts.temperature,
        signal,
      });
      for await (const chunk of stream) {
        if (!chunk) continue;
        tokensEmitted += 1;
        fullText += chunk;
        opts.onChunk(chunk);
      }
      release();
      return { provider, modelName: providerModelName(provider), fullText };
    } catch (err) {
      release();
      lastErr = err;
      opts.onProviderError?.(provider, err);
      if (tokensEmitted > 0) {
        // Already committed to the wire — cannot switch providers cleanly.
        // Re-throw with the partial response info so caller can decide.
        const wrapped = new Error(
          `Provider ${provider} failed after ${tokensEmitted} chunk(s): ${err instanceof Error ? err.message : String(err)}`,
        );
        (wrapped as any).cause = err;
        (wrapped as any).provider = provider;
        (wrapped as any).tokensEmitted = tokensEmitted;
        (wrapped as any).partialText = fullText;
        throw wrapped;
      }
      console.warn(
        `[AI Router] Provider ${provider} failed pre-stream; falling back. ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr || "unknown error");
  const err = new Error(`All providers in chain [${chain.join(", ")}] failed: ${msg}`);
  (err as any).cause = lastErr;
  (err as any).code = "AI_ROUTER_ALL_FAILED";
  throw err;
}

// ─── Non-streaming fallback chain ────────────────────────────────────────

export interface NonStreamResult {
  provider: ProviderId;
  modelName: string;
  content: string;
  inputTokens?: number;
  outputTokens?: number;
}

async function callProvider(
  provider: ProviderId,
  opts: ProviderCallOptions,
): Promise<{ content: string; modelName: string; inputTokens?: number; outputTokens?: number }> {
  switch (provider) {
    case "groq": {
      const r = await chatWithGroq(opts);
      return { content: r.content, modelName: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens };
    }
    case "deepseek": {
      const r = await chatWithDeepSeek(opts);
      return { content: r.content, modelName: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens };
    }
    case "deepseek-pro": {
      const r = await chatWithDeepSeekPro(opts);
      return { content: r.content, modelName: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens };
    }
  }
}

export interface NonStreamFallbackOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  perProviderTimeoutMs?: number;
}

export async function callWithFallback(
  chain: ProviderId[],
  opts: NonStreamFallbackOptions,
): Promise<NonStreamResult> {
  const perProviderTimeout = Math.max(5_000, opts.perProviderTimeoutMs ?? DEFAULT_PER_PROVIDER_TIMEOUT_MS);
  let lastErr: unknown = undefined;

  for (const provider of chain) {
    if (!providerAvailable(provider)) {
      console.warn(`[AI Router] Provider ${provider} unavailable — skipping`);
      continue;
    }
    const { signal, release } = makeAbortable(perProviderTimeout);
    try {
      const res = await callProvider(provider, {
        messages: opts.messages,
        maxTokens: opts.maxTokens,
        temperature: opts.temperature,
        signal,
      });
      release();
      const text = String(res.content || "").trim();
      if (!text || /^no response generated\.?$/i.test(text)) {
        // Treat empty output as a retryable failure for the chain.
        throw new Error(`${provider} returned empty output`);
      }
      return { provider, modelName: res.modelName, content: res.content, inputTokens: res.inputTokens, outputTokens: res.outputTokens };
    } catch (err) {
      release();
      lastErr = err;
      console.warn(
        `[AI Router] Non-stream provider ${provider} failed; falling back. ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr || "unknown error");
  const err = new Error(`All providers in chain [${chain.join(", ")}] failed: ${msg}`);
  (err as any).cause = lastErr;
  (err as any).code = "AI_ROUTER_ALL_FAILED";
  throw err;
}

// ─── Default chains ──────────────────────────────────────────────────────

export const DEFAULT_STANDARD_CHAIN: ProviderId[] = ["groq", "deepseek"];
export const DEFAULT_TURBO_CHAIN: ProviderId[] = ["deepseek-pro", "groq"];
