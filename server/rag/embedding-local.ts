import crypto from "crypto";

const DEFAULT_DIM = Number(process.env.RAG_EMBEDDING_DIM || 384);
const EMBEDDING_PROVIDER = (
  process.env.RAG_EMBEDDING_PROVIDER ||
  (process.env.NODE_ENV === "production" ? "hashing" : "semantic")
).toLowerCase();
const SEMANTIC_MODEL_NAME = process.env.RAG_SEMANTIC_MODEL || "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

// OpenAI / OpenRouter settings (used when EMBEDDING_PROVIDER=openai)
const OPENAI_EMBED_MODEL    = process.env.RAG_OPENAI_EMBED_MODEL || "openai/text-embedding-3-small";
const OPENAI_EMBED_BASE_URL = process.env.RAG_OPENAI_BASE_URL    || "https://openrouter.ai/api/v1";
const OPENAI_EMBED_API_KEY  = process.env.OPENROUTER_API_KEY     || process.env.OPENAI_API_KEY || "";

type SemanticEmbedder = (text: string) => Promise<number[]>;
const importDynamically = new Function("modulePath", "return import(modulePath);") as (modulePath: string) => Promise<any>;

let semanticEmbedderPromise: Promise<SemanticEmbedder | null> | null = null;

function hashToken(token: string): Buffer {
  return crypto.createHash("sha256").update(token).digest();
}

function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function normalizeVector(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
  if (!Number.isFinite(norm) || norm === 0) return v;
  return v.map((x) => x / norm);
}

function fitToDimension(input: number[], dim: number): number[] {
  if (input.length === dim) return normalizeVector(input);
  if (input.length > dim) return normalizeVector(input.slice(0, dim));
  const resized = input.slice();
  while (resized.length < dim) resized.push(0);
  return normalizeVector(resized);
}

function embedTextHashing(text: string, dim: number = DEFAULT_DIM): number[] {
  const tokens = tokenize(text);
  const vector = new Array<number>(dim).fill(0);
  if (tokens.length === 0) return vector;

  // Mix unigram and bigram signals for stronger lexical-semantic locality.
  const features: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    features.push(tokens[i]);
    if (i + 1 < tokens.length) {
      features.push(`${tokens[i]}_${tokens[i + 1]}`);
    }
  }
  for (const feature of features) {
    const h = hashToken(feature);
    const idx = h.readUInt16BE(0) % dim;
    const sign = (h[2] & 1) === 0 ? 1 : -1;
    const weight = 1 + (h[3] / 255);
    vector[idx] += sign * weight;
  }
  return normalizeVector(vector);
}

// ─── OpenAI / OpenRouter Embedder ────────────────────────────────────────────
// Used when RAG_EMBEDDING_PROVIDER=openai.
// Query vectors use the SAME model as stored judgment vectors (text-embedding-3-small).
// Cost: ~$0.000002 per search query — essentially free.

async function embedTextOpenAI(text: string, dim: number = DEFAULT_DIM): Promise<number[]> {
  if (!OPENAI_EMBED_API_KEY) {
    console.warn("[RAG] OPENROUTER_API_KEY not set — falling back to hashing");
    return embedTextHashing(text, dim);
  }
  try {
    const resp = await fetch(`${OPENAI_EMBED_BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_EMBED_API_KEY}`,
        "HTTP-Referer": "https://alwakeelo.com",
        "X-Title": "AlWakeelo Legal AI",
      },
      body: JSON.stringify({
        model: OPENAI_EMBED_MODEL,
        input: text.slice(0, 8000),
        dimensions: dim,
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.warn(`[RAG] OpenAI embed API error ${resp.status}: ${err.slice(0, 200)}`);
      return embedTextHashing(text, dim);
    }
    const json = await resp.json() as any;
    const embedding = json?.data?.[0]?.embedding as number[] | undefined;
    if (!embedding || embedding.length === 0) return embedTextHashing(text, dim);
    return fitToDimension(embedding, dim);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[RAG] OpenAI embed fetch failed (${message}) — falling back to hashing`);
    return embedTextHashing(text, dim);
  }
}

async function embedTextsOpenAI(texts: string[], dim: number = DEFAULT_DIM): Promise<number[][]> {
  if (!OPENAI_EMBED_API_KEY) return texts.map((t) => embedTextHashing(t, dim));
  try {
    const resp = await fetch(`${OPENAI_EMBED_BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_EMBED_API_KEY}`,
        "HTTP-Referer": "https://alwakeelo.com",
        "X-Title": "AlWakeelo Legal AI",
      },
      body: JSON.stringify({
        model: OPENAI_EMBED_MODEL,
        input: texts.map((t) => t.slice(0, 8000)),
        dimensions: dim,
      }),
    });
    if (!resp.ok) return texts.map((t) => embedTextHashing(t, dim));
    const json = await resp.json() as any;
    const items = json?.data as Array<{ index: number; embedding: number[] }> | undefined;
    if (!items) return texts.map((t) => embedTextHashing(t, dim));
    return items
      .sort((a, b) => a.index - b.index)
      .map((item) => fitToDimension(item.embedding, dim));
  } catch {
    return texts.map((t) => embedTextHashing(t, dim));
  }
}

// ─── MiniLM Local Embedder ───────────────────────────────────────────────────

async function resolveSemanticEmbedder(): Promise<SemanticEmbedder | null> {
  if (semanticEmbedderPromise) return semanticEmbedderPromise;

  semanticEmbedderPromise = (async () => {
    try {
      const transformers = await importDynamically("@xenova/transformers");
      const pipeline = transformers?.pipeline as
        | ((task: string, model?: string, options?: Record<string, unknown>) => Promise<any>)
        | undefined;
      if (!pipeline) return null;

      if (transformers?.env && typeof transformers.env === "object") {
        try {
          transformers.env.allowRemoteModels = true;
          transformers.env.allowLocalModels = true;
        } catch {
          // Ignore unsupported env assignments across package versions.
        }
      }

      const extractor = await pipeline("feature-extraction", SEMANTIC_MODEL_NAME, { quantized: true });

      return async (text: string) => {
        const input = text.trim().slice(0, 12000);
        if (!input) return new Array<number>(DEFAULT_DIM).fill(0);

        const output = await extractor(input, { pooling: "mean", normalize: true });
        const maybeData = output?.data as ArrayLike<number> | undefined;
        if (maybeData && typeof maybeData.length === "number" && maybeData.length > 0) {
          return fitToDimension(Array.from(maybeData).map((n) => Number(n) || 0), DEFAULT_DIM);
        }

        if (typeof output?.tolist === "function") {
          const listed = output.tolist();
          if (Array.isArray(listed)) {
            const first = Array.isArray(listed[0]) ? listed[0] : listed;
            if (Array.isArray(first)) {
              return fitToDimension(first.map((n) => Number(n) || 0), DEFAULT_DIM);
            }
          }
        }

        return new Array<number>(DEFAULT_DIM).fill(0);
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[RAG] Semantic embedding provider unavailable (${message}). Falling back to local hashing embeddings.`);
      return null;
    }
  })();

  return semanticEmbedderPromise;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function embedTextLocal(text: string, dim: number = DEFAULT_DIM): Promise<number[]> {
  // OpenAI/OpenRouter — same model as stored judgment vectors (text-embedding-3-small)
  if (EMBEDDING_PROVIDER === "openai") {
    return embedTextOpenAI(text, dim);
  }
  if (EMBEDDING_PROVIDER !== "hashing") {
    const semantic = await resolveSemanticEmbedder();
    if (semantic) {
      try {
        const vector = await semantic(text);
        return fitToDimension(vector, dim);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[RAG] Semantic embedding inference failed (${message}). Falling back to local hashing embeddings.`);
      }
    }
  }
  return embedTextHashing(text, dim);
}

export async function embedTextsLocal(texts: string[], dim: number = DEFAULT_DIM): Promise<number[][]> {
  // OpenAI/OpenRouter — same model as stored judgment vectors
  if (EMBEDDING_PROVIDER === "openai") {
    return embedTextsOpenAI(texts, dim);
  }
  if (EMBEDDING_PROVIDER === "hashing") {
    return texts.map((t) => embedTextHashing(t, dim));
  }
  const semantic = await resolveSemanticEmbedder();
  if (!semantic) {
    return texts.map((t) => embedTextHashing(t, dim));
  }
  const vectors: number[][] = [];
  for (const text of texts) {
    try {
      vectors.push(fitToDimension(await semantic(text), dim));
    } catch {
      vectors.push(embedTextHashing(text, dim));
    }
  }
  return vectors;
}
