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
import { rewriteFollowUpQuery, type ConversationTurn } from "./query-rewriter";

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

const OUTER_DEADLINE_MS = Number(process.env.KNOWLEDGE_OUTER_DEADLINE_MS || 30000);  // 30s — DB ILIKE + tool-search OR fallback can take 14-20s on broad queries; previous 20000ms cutoff dropped completed retrievals (totalMs=20013 race loss observed in prod)

function normKey(q: string): string {
  return q.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 280);
}

export interface CaseLawHit {
  citation: string;
  title: string;
  court: string;
  summary: string;
}

export interface PipelineRunResult {
  contextString: string;
  hasCaseLaw: boolean;
  hasStatutes: boolean;
  topics: string[];
  durationMs: number;
  caseLawHits: CaseLawHit[];
}

export async function runKnowledgePipeline(
  rawQuery: string,
  userId?: string,
  conversationHistory?: ConversationTurn[],
  context?: { module?: string },
): Promise<PipelineRunResult> {
  const t0 = Date.now();
  const key = `${userId || "anon"}::${normKey(rawQuery)}`;
  const cached = cacheGet(key);
  // Never use a cached empty string — it means a previous request timed out or found nothing.
  // Retry the DB every time until we get real results, then cache them.
  if (cached !== undefined && cached.length > 0) {
    return {
      contextString: cached,
      hasCaseLaw: cached.includes("VERIFIED JUDGMENTS"),
      hasStatutes: cached.includes("VERIFIED STATUTES"),
      topics: [],
      durationMs: 0,
      caseLawHits: [],
    };
  }

  const outerTimer = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), OUTER_DEADLINE_MS),
  );

  const inner = (async (): Promise<PipelineRunResult> => {
    // ---- Stage 0: Rewrite follow-up query ----
    // Resolves pronouns/vague references so retrieval gets a self-contained phrase.
    // e.g. "what about the punishment?" → "punishment for narcotics CNSA Section 9"
    // Skipped when no prior context or query is already self-contained.
    const history = conversationHistory || [];
    const queryForRetrieval = await rewriteFollowUpQuery(rawQuery, history);

    // ---- Stage 1: Classify intent ----
    const intent = classifyQueryIntent(queryForRetrieval, context);
    console.log(
      `[Pipeline:1:Classify] query="${queryForRetrieval.slice(0, 60)}"${queryForRetrieval !== rawQuery ? ` (rewritten from "${rawQuery.slice(0, 40)}")` : ""} ` +
      `type=${intent.type} ` +
      `topics=[${intent.topics.map((t) => t.id).join(",")}] ` +
      `expandedQuery="${intent.expandedQuery.slice(0, 80)}"`,
    );

    const retrieval = await runRetrieval(
      intent,
      userId || "",
      { caseLaw: 10, statutes: 8, adminDocs: 6 },
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

    // Only cache non-empty results. Empty means timeout or no data — don't poison the cache.
    if (ctx.contextString.length > 0) {
      cacheSet(key, ctx.contextString);
    }

    // R4: If context is empty (no results found), inject safety gate
    if (ctx.contextString.length === 0) {
      const safetyGateContext = "\n\n" +
        "[SYSTEM SAFETY GATE — NO MATCHING DATABASE RESULTS]\n" +
        "No relevant statutes or case law were found in the database for this query.\n" +
        "CRITICAL RULES:\n" +
        "1. Do NOT cite ANY specific section numbers, article numbers, or case citations from memory.\n" +
        "2. You may provide general legal guidance about the area of law.\n" +
        "3. Direct the user to search at /judgment-search for case law.\n" +
        "4. Direct the user to the statute library for specific provisions.";
      return {
        contextString: safetyGateContext,
        hasCaseLaw: false,
        hasStatutes: false,
        topics: intent.topics.map((t) => t.label),
        durationMs: Date.now() - t0,
        caseLawHits: [],
      };
    }

    return {
      contextString: ctx.contextString,
      hasCaseLaw: ctx.hasCaseLawCitations,
      hasStatutes: ctx.hasStatutes,
      topics: intent.topics.map((t) => t.label),
      durationMs,
      caseLawHits: retrieval.caseLaw.map(hit => ({ citation: hit.row.citation, title: hit.row.title, court: hit.row.court, summary: hit.row.summary })),
    };
  })();

  const result = await Promise.race([inner, outerTimer]);
  if (result === null) {
    const durationMs = Date.now() - t0;
    console.warn(`[Pipeline:Timeout] exceeded ${OUTER_DEADLINE_MS}ms — returning empty context`);
    const safetyGateContext = "\n\n" +
      "[SYSTEM SAFETY GATE — NO DATABASE RESULTS AVAILABLE]\n" +
      "The knowledge pipeline returned no results (timeout or no matching data).\n" +
      "CRITICAL RULES:\n" +
      "1. Do NOT cite ANY specific section numbers, article numbers, or case citations from memory.\n" +
      "2. Do NOT cite ANY judgment citations from memory — no PLD, SCMR, YLR, etc.\n" +
      "3. You may provide general legal guidance about the area of law.\n" +
      "4. For specific case law, direct the user to search at /judgment-search.\n" +
      "5. For specific statutes, direct the user to the statute library.\n" +
      "6. Say: 'I recommend searching our judgment database and statute library for the specific provisions applicable to your case.'";
    return { contextString: safetyGateContext, hasCaseLaw: false, hasStatutes: false, topics: [], durationMs, caseLawHits: [] };
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
  conversationHistory?: ConversationTurn[],
  context?: { module?: string },
): Promise<string> {
  try {
    const result = await runKnowledgePipeline(query, userId, conversationHistory, context);
    return result.contextString;
  } catch (err) {
    console.error("[Pipeline:Error]", err instanceof Error ? err.message : String(err));
    return "\n\n[SYSTEM SAFETY GATE — KNOWLEDGE PIPELINE ERROR]\n" +
      "CRITICAL: Do NOT cite ANY specific section numbers, article numbers, or case citations from memory. " +
      "Provide general legal guidance only. Direct users to /judgment-search for case law and the statute library for specific provisions.";
  }
}

/**
 * Same as gatherKnowledgeContextV2 but returns the full pipeline result
 * including caseLawHits for the Case Law Card.
 */
export async function gatherKnowledgeWithHits(
  query: string,
  userId?: string,
  conversationHistory?: ConversationTurn[],
  context?: { module?: string },
): Promise<PipelineRunResult> {
  try {
    return await runKnowledgePipeline(query, userId, conversationHistory, context);
  } catch (err) {
    console.error("[Pipeline:Error]", err instanceof Error ? err.message : String(err));
    return {
      contextString: "\n\n[SYSTEM SAFETY GATE — KNOWLEDGE PIPELINE ERROR]\n" +
        "CRITICAL: Do NOT cite ANY specific section numbers, article numbers, or case citations from memory. " +
        "Provide general legal guidance only. Direct users to /judgment-search for case law and the statute library for specific provisions.",
      hasCaseLaw: false,
      hasStatutes: false,
      topics: [],
      durationMs: 0,
      caseLawHits: [],
    };
  }
}

export type { ConversationTurn };
