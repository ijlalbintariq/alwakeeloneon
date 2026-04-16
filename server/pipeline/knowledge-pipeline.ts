/**
 * Knowledge Pipeline
 *
 * Responsibility: Orchestrate the full retrieval flow.
 *                 This is the ONLY entry point called from routes.ts.
 *                 It replaces gatherKnowledgeContext completely.
 *
 * Pipeline stages:
 *   1. Normalize + classify intent      (intent-classifier)
 *   2. Retrieve relevant sources        (retrieval-engine)
 *   3. Build structured context string  (context-builder)
 *
 * Input  : raw query + optional userId
 * Output : formatted context string ready to append to system prompt
 *
 * Observability:
 *   Every stage logs its output. Trace a failure by reading:
 *     [Pipeline:1:Classify] ...
 *     [Pipeline:2:Retrieve] ...
 *     [Pipeline:3:Build]    ...
 */

import { classifyQueryIntent } from "./intent-classifier";
import { runRetrieval } from "./retrieval-engine";
import { buildContext } from "./context-builder";

// ---------------------------------------------------------------------------
// Cache (mirrors old knowledgeContextCache behaviour)
// ---------------------------------------------------------------------------

type TimedEntry<T> = { value: T; expiresAt: number };
const contextCache = new Map<string, TimedEntry<string>>();
const CACHE_TTL_MS = Number(process.env.KNOWLEDGE_CONTEXT_CACHE_TTL_MS || 120_000);
const MAX_CACHE_ENTRIES = 400;

function cacheGet(key: string): string | undefined {
  const entry = contextCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) { contextCache.delete(key); return undefined; }
  return entry.value;
}

function cacheSet(key: string, value: string): void {
  contextCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  if (contextCache.size <= MAX_CACHE_ENTRIES) return;
  const now = Date.now();
  for (const [k, v] of contextCache.entries()) {
    if (v.expiresAt <= now) contextCache.delete(k);
    if (contextCache.size <= MAX_CACHE_ENTRIES) return;
  }
  // Evict oldest
  const oldest = contextCache.keys().next().value;
  if (oldest) contextCache.delete(oldest as string);
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

const OUTER_DEADLINE_MS = Number(process.env.KNOWLEDGE_OUTER_DEADLINE_MS || 5000);

function normKey(q: string): string {
  return q.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 280);
}

export interface PipelineRunResult {
  contextString: string;
  hasCaseLaw: boolean;
  hasStatutes: boolean;
  topics: string[];
  durationMs: number;
}

export async function runKnowledgePipeline(
  rawQuery: string,
  userId?: string,
): Promise<PipelineRunResult> {
  const t0 = Date.now();
  const key = `${userId || "anon"}::${normKey(rawQuery)}`;
  const cached = cacheGet(key);
  if (cached !== undefined) {
    return {
      contextString: cached,
      hasCaseLaw: cached.includes("VERIFIED JUDGMENTS"),
      hasStatutes: cached.includes("VERIFIED STATUTES"),
      topics: [],
      durationMs: 0,
    };
  }

  const outerTimer = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), OUTER_DEADLINE_MS),
  );

  const inner = (async (): Promise<PipelineRunResult> => {
    // ---- Stage 1: Classify intent ----
    const intent = classifyQueryIntent(rawQuery);
    console.log(
      `[Pipeline:1:Classify] query="${rawQuery.slice(0, 60)}" ` +
      `type=${intent.type} ` +
      `topics=[${intent.topics.map((t) => t.id).join(",")}] ` +
      `expandedQuery="${intent.expandedQuery.slice(0, 80)}"`,
    );

    // ---- Stage 2: Retrieve ----
    const retrieval = await runRetrieval(
      intent,
      userId || "",
      { caseLaw: 6, statutes: 4, adminDocs: 3 },
    );
    console.log(
      `[Pipeline:2:Retrieve] ` +
      `caseLaw=${retrieval.diagnostics.caseLawFetched} ` +
      `caseLawFiltered=${retrieval.diagnostics.caseLawAfterFilter} ` +
      `statutes=${retrieval.diagnostics.statutesFetched} ` +
      `adminDocs=${retrieval.diagnostics.adminDocsFetched} ` +
      `retrievalMs=${retrieval.diagnostics.durationMs}`,
    );

    // ---- Stage 3: Build context ----
    const ctx = buildContext(intent, retrieval);
    console.log(
      `[Pipeline:3:Build] ` +
      `sections=[${ctx.sections.map((s) => s.id).join(",")}] ` +
      `hasCaseLaw=${ctx.hasCaseLawCitations} ` +
      `hasStatutes=${ctx.hasStatutes} ` +
      `contextLen=${ctx.contextString.length}`,
    );

    const durationMs = Date.now() - t0;
    console.log(`[Pipeline:Done] totalMs=${durationMs}`);

    cacheSet(key, ctx.contextString);

    return {
      contextString: ctx.contextString,
      hasCaseLaw: ctx.hasCaseLawCitations,
      hasStatutes: ctx.hasStatutes,
      topics: intent.topics.map((t) => t.label),
      durationMs,
    };
  })();

  const result = await Promise.race([inner, outerTimer]);
  if (result === null) {
    const durationMs = Date.now() - t0;
    console.warn(`[Pipeline:Timeout] exceeded ${OUTER_DEADLINE_MS}ms — returning empty context`);
    return { contextString: "", hasCaseLaw: false, hasStatutes: false, topics: [], durationMs };
  }
  return result;
}

/**
 * Drop-in replacement for gatherKnowledgeContext(query, userId).
 * Returns only the context string — same signature as the old function.
 */
export async function gatherKnowledgeContextV2(
  query: string,
  userId?: string,
): Promise<string> {
  try {
    const result = await runKnowledgePipeline(query, userId);
    return result.contextString;
  } catch (err) {
    console.error("[Pipeline:Error]", err instanceof Error ? err.message : String(err));
    return "";
  }
}
