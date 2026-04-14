import { embedTextLocal, embedTextsLocal } from "../rag/embedding-local";
import { createHash } from "crypto";

// ── Embedding cache ──────────────────────────────────────────────────────────
// Embedding the same (or near-identical) user prompt multiple times wastes 200–400ms.
// Cache keyed on SHA-256 of the normalized text, TTL 1 hour.
const EMBED_CACHE_TTL_MS = Math.max(60_000, Number(process.env.STYLE_EMBED_CACHE_TTL_MS || 3_600_000));
const embedCache = new Map<string, { value: number[]; expiresAt: number }>();

function normalizeForCacheKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 512);
}

function getEmbedCacheKey(text: string): string {
  return createHash("sha256").update(normalizeForCacheKey(text)).digest("hex");
}

function getCachedEmbedding(text: string): number[] | undefined {
  const key = getEmbedCacheKey(text);
  const entry = embedCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    embedCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCachedEmbedding(text: string, embedding: number[]): void {
  const key = getEmbedCacheKey(text);
  embedCache.set(key, { value: embedding, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
  // Evict oldest entries if cache grows beyond 1000 items.
  if (embedCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of embedCache.entries()) {
      if (v.expiresAt <= now) embedCache.delete(k);
      if (embedCache.size <= 1000) break;
    }
    if (embedCache.size > 1000) {
      const firstKey = embedCache.keys().next().value;
      if (firstKey) embedCache.delete(firstKey);
    }
  }
}
// ────────────────────────────────────────────────────────────────────────────

export async function embedStyleQuery(text: string): Promise<number[]> {
  const cached = getCachedEmbedding(text);
  if (cached) return cached;
  const embedding = await embedTextLocal(text);
  setCachedEmbedding(text, embedding);
  return embedding;
}

export async function embedStyleChunks(texts: string[]): Promise<number[][]> {
  return embedTextsLocal(texts);
}

