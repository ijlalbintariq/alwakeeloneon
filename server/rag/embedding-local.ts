import crypto from "crypto";

const DEFAULT_DIM = Number(process.env.RAG_EMBEDDING_DIM || 384);

function hashToken(token: string): Buffer {
  return crypto.createHash("sha256").update(token).digest();
}

export function normalizeVector(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
  if (!Number.isFinite(norm) || norm === 0) return v;
  return v.map((x) => x / norm);
}

export function embedTextLocal(text: string, dim: number = DEFAULT_DIM): number[] {
  const tokens = (text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const vector = new Array<number>(dim).fill(0);
  if (tokens.length === 0) return vector;

  for (const token of tokens) {
    const h = hashToken(token);
    const idx = h.readUInt16BE(0) % dim;
    const sign = (h[2] & 1) === 0 ? 1 : -1;
    const weight = 1 + (h[3] / 255);
    vector[idx] += sign * weight;
  }

  return normalizeVector(vector);
}

export function embedTextsLocal(texts: string[], dim: number = DEFAULT_DIM): number[][] {
  return texts.map((t) => embedTextLocal(t, dim));
}
