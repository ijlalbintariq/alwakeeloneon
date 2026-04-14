import { cleanLegalDocumentText } from "../rag/text-cleaner";
import { embedStyleQuery } from "./embed";
import { toStyleRetrievalResult } from "./prompt";
import { ensureStyleMemorySchema, styleSimilaritySearch } from "./store";
import { getOrCreateStyleMemorySettings } from "./settings";
import type { StyleMemoryModule, StyleRetrievalResult } from "./types";

const STYLE_TOP_K = Math.max(1, Number(process.env.STYLE_MEMORY_TOP_K || 4));
const STYLE_MIN_SCORE = Math.max(0, Number(process.env.STYLE_MEMORY_MIN_SCORE || 0.56));
const STYLE_MAX_CONTEXT_TOKENS = Math.max(250, Number(process.env.STYLE_MEMORY_MAX_CONTEXT_TOKENS || 900));
const STYLE_EMBED_TIMEOUT_MS = Math.max(500, Number(process.env.STYLE_MEMORY_EMBED_TIMEOUT_MS || 1500));
const STYLE_SEARCH_TIMEOUT_MS = Math.max(500, Number(process.env.STYLE_MEMORY_SEARCH_TIMEOUT_MS || 1500));

async function raceWithDeadline<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error(`${label} timed out after ${ms}ms`);
          (err as any).code = "STYLE_MEMORY_TIMEOUT";
          reject(err);
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function computeConfidence(scores: number[]): number {
  if (scores.length === 0) return 0;
  const top = scores[0] || 0;
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return Math.max(0, Math.min(1, (top * 0.68) + (avg * 0.32)));
}

export async function retrieveStyleContextForGeneration(args: {
  userId: string;
  module: StyleMemoryModule;
  orgId?: number | null;
  userPrompt: string;
  draftText?: string;
}): Promise<{ settings: Awaited<ReturnType<typeof getOrCreateStyleMemorySettings>>; result: StyleRetrievalResult }> {
  await ensureStyleMemorySchema();
  const settings = await getOrCreateStyleMemorySettings(args.userId, args.module, args.orgId);

  if (!settings.enabled) {
    return {
      settings,
      result: {
        applied: false,
        confidence: 0,
        scopeUsed: settings.ownershipMode,
        chunks: [],
        contextText: "",
      },
    };
  }

  const queryText = cleanLegalDocumentText(`${args.userPrompt || ""}\n\n${(args.draftText || "").slice(0, 5000)}`);
  if (!queryText) {
    return {
      settings,
      result: {
        applied: false,
        confidence: 0,
        scopeUsed: settings.ownershipMode,
        chunks: [],
        contextText: "",
      },
    };
  }

  const queryEmbedding = await raceWithDeadline(
    embedStyleQuery(queryText),
    STYLE_EMBED_TIMEOUT_MS,
    "style-memory embed",
  );
  const includeOrg = settings.ownershipMode === "org" || settings.ownershipMode === "user-org";
  const retrieved = await raceWithDeadline(
    styleSimilaritySearch({
      userId: args.userId,
      module: args.module,
      orgId: args.orgId ?? null,
      includeOrg,
      queryText,
      queryEmbedding,
      topK: STYLE_TOP_K,
    }),
    STYLE_SEARCH_TIMEOUT_MS,
    "style-memory search",
  );

  const filtered = retrieved.filter((row) => row.score >= STYLE_MIN_SCORE);
  const confidence = computeConfidence(filtered.map((row) => row.score));
  const result = toStyleRetrievalResult({
    chunks: filtered.slice(0, STYLE_TOP_K),
    confidence,
    scopeUsed: settings.ownershipMode,
    strictness: settings.strictness,
    maxContextTokens: STYLE_MAX_CONTEXT_TOKENS,
  });
  return { settings, result };
}

