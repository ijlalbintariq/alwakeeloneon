/**
 * OpenRouter integration — used ONLY for tool-call routing
 * (picking case-law search queries via gpt-4o-mini).
 *
 * Why a separate model:
 *   - DeepSeek V3 is great for the final answer but overkill for routing.
 *   - gpt-4o-mini is ~5× faster and cheaper, and supports parallel_tool_calls.
 *
 * Final response generation still uses DeepSeek (deepseek-ai.ts).
 */

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { CITATION_SEARCH_TOOL, executeCitationSearch, normalizeCitationKey } from "./tools/citation-search-tool";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const TOOL_MODEL = process.env.OPENROUTER_TOOL_MODEL || "openai/gpt-4o-mini";

let client: OpenAI | null = null;

function resolveOpenRouterApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY || process.env.OpenRouter_API_KEY;
}

function getClient(): OpenAI {
  if (client) return client;
  const apiKey = resolveOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("OpenRouter is not configured. Set OPENROUTER_API_KEY.");
  }
  client = new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": "https://alwakeelo.com",
      "X-Title": "Al Wakeelo",
    },
  });
  return client;
}

export function isOpenRouterAvailable(): boolean {
  return !!resolveOpenRouterApiKey();
}

export function getOpenRouterToolModelName(): string {
  return TOOL_MODEL;
}

export interface ToolJudgmentSearchResult {
  contextString: string;
  foundCount: number;
  queriesUsed: string[];
  /**
   * Exact citation strings of every judgment surfaced by the tool search.
   * These came directly from the DB and can be passed to the citation
   * integrity check as a trusted pool (bypasses the strict resolver, which
   * would false-negative on tiny formatting variants).
   */
  verifiedCitations: string[];
  /**
   * Title -> citation map for the same pool. Lets prose-rebuild recover the
   * formal citation when the model writes a case name like "Malik vs State"
   * instead of the formal "PLD 2024 SC 100".
   */
  verifiedTitles: Array<{ title: string; citation: string }>;
  /**
   * Full per-hit metadata for the Case Law Card UI surface. Same rows the
   * AI sees, but exposed verbatim to the frontend so it can render a raw,
   * authoritative case-law list independent of the AI's prose.
   */
  verifiedHits: Array<{ citation: string; title: string; court: string; summary: string }>;
}

/**
 * Single-round parallel tool-search via gpt-4o-mini.
 * The model emits 2-3 parallel `search_judgments` calls; we execute them concurrently.
 *
 * Latency target: ~1.5-2.5s p50, ~4s p95.
 */
export async function runToolJudgmentSearchOR(
  userQuery: string,
  onStatus: (query: string, found: number) => void,
  signal?: AbortSignal,
  totalTimeoutMs = 8000,
): Promise<ToolJudgmentSearchResult> {
  const c = getClient();
  const safeQuery = userQuery.slice(0, 300);

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are a Pakistani case-law search assistant. " +
        "If the user's message is a casual conversation, greeting, or does not require legal research or case law lookup, DO NOT call any tools and just respond 'DONE'. " +
        "Search the Al Wakeelo internal Pakistani case law database for real, verified judgments. " +
        "ALWAYS call this tool before citing any case law. Never cite a judgment not returned by this tool. " +
        "STRATEGY: For complex multi-issue queries, call this tool 5-6 times with DIFFERENT queries covering EACH legal sub-issue. " +
        "For simple queries, call 2-3 times with different angles. " +
        "Example for property dispute: call 1 → 'Section 53A part performance', call 2 → 'bona fide purchaser Section 41', call 3 → 'specific performance readiness', call 4 → 'constructive notice possession', call 5 → 'agreement to sell vs sale'. " +
        "Example for bail cancellation: call 1 → 'bail cancellation', call 2 → 'Section 497 misuse liberty', call 3 → 'supervening circumstances bail'. " +
        "Example for dower/mehr/nikahnama: call 1 → 'mehr recovery', call 2 → 'dower nikahnama', call 3 → 'specific performance dower', call 4 → 'haq mehr property', call 5 → 'mahr waiver', call 6 → 'nikahnama enforceable'. " +
        "Example for inheritance/family: call 1 → 'khula dissolution', call 2 → 'maintenance wife', call 3 → 'custody minor', call 4 → 'Muslim Family Laws dower'. " +
        "Use all results from all calls to build your citation list. " +
        "CRITICAL DOMAIN RULE: Stay STRICTLY within the same legal domain as the query. " +
        "For PROPERTY queries: use terms like 'Section 53A part performance', 'agreement to sell TPA', 'mortgage priority', 'constructive notice possession'. " +
        "For CRIMINAL queries: use terms like 'Section 302 qatl', 'bail cancellation', 'acquittal benefit doubt'. " +
        "For FAMILY/DOWER queries: use terms like 'mehr recovery', 'dower nikahnama', 'haq mehr property', 'specific performance dower', 'mahr waiver', 'nikahnama enforceable', 'Muslim Family Laws dower', 'deferred dower suit'. " +
        "NEVER mix domains — a family/dower question must ONLY get family/dower/civil case law queries, NEVER criminal/bail/PPC queries. " +
        "Use specific Pakistani legal terms (PPC, CrPC, qatl, diyat, tazir, khula, mehr, haq mehr, nikahnama, TPA, CPC, MFLO, etc.). " +
        "After issuing the tool calls, respond: DONE",
    },
    { role: "user", content: safeQuery },
  ];

  // Per-call abort: total budget OR parent abort, whichever fires first
  const callAbort = new AbortController();
  const budgetTimer = setTimeout(() => callAbort.abort(), Math.max(1000, totalTimeoutMs));
  const onParentAbort = () => callAbort.abort();
  signal?.addEventListener("abort", onParentAbort);

  let response;
  try {
    response = await c.chat.completions.create(
      {
        model: TOOL_MODEL,
        messages,
        tools: [CITATION_SEARCH_TOOL],
        tool_choice: "auto",
        parallel_tool_calls: true,
        max_tokens: 600,
        temperature: 0.1,
      },
      { signal: callAbort.signal, maxRetries: 0 } as any,
    );
  } catch (err) {
    clearTimeout(budgetTimer);
    signal?.removeEventListener("abort", onParentAbort);
    console.warn("[OpenRouterToolSearch] Call failed:", err instanceof Error ? err.message : String(err));
    return { contextString: "", foundCount: 0, queriesUsed: [], verifiedCitations: [], verifiedTitles: [], verifiedHits: [] };
  }
  clearTimeout(budgetTimer);
  signal?.removeEventListener("abort", onParentAbort);

  const toolCalls = response.choices[0]?.message?.tool_calls ?? [];
  if (!toolCalls.length) {
    return { contextString: "", foundCount: 0, queriesUsed: [], verifiedCitations: [], verifiedTitles: [], verifiedHits: [] };
  }

  // Run all DB searches concurrently with a per-query timeout.
  // executeCitationSearch() does ILIKE queries that can take 8-12s on a cold
  // DB connection. Without a guard the Promise.all hangs and blows past the
  // outer ENRICHMENT_BUDGET_MS, causing the AI to receive zero case law context.
  const DB_SEARCH_TIMEOUT_MS = 18000;
  const allResults: Array<{ citation: string; court: string; title: string; summary: string }> = [];
  const queriesUsed: string[] = [];

  await Promise.all(
    toolCalls.map(async (toolCall: any) => {
      let args: { query: string; court?: string; limit?: number } = { query: "" };
      try {
        args = JSON.parse(toolCall.function?.arguments || "{}");
      } catch {
        /* ignore */
      }
      if (!args.query) return;

      queriesUsed.push(args.query);

      const searchWithTimeout = Promise.race([
        executeCitationSearch(args),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("DB search timeout")), DB_SEARCH_TIMEOUT_MS),
        ),
      ]);

      const resultStr = await searchWithTimeout.catch(() =>
        JSON.stringify({ found: 0, results: [] }),
      );
      let parsed: { found: number; results: typeof allResults } = { found: 0, results: [] };
      try {
        parsed = JSON.parse(resultStr);
      } catch {
        /* ignore */
      }

      onStatus(args.query, parsed.found || 0);
      if (parsed.results?.length) allResults.push(...parsed.results);
    }),
  );

  // Dedupe by normalised citation — handles "PLD 2020 SC 456" vs "PLD 2020 SC 456." vs "P L D 2020 SC 456" etc.
  const seen = new Set<string>();
  const unique = allResults.filter((r) => {
    const key = normalizeCitationKey(r.citation);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) {
    return { contextString: "", foundCount: 0, queriesUsed, verifiedCitations: [], verifiedTitles: [], verifiedHits: [] };
  }

  const lines = unique.map(
    (r) =>
      `- CITATION: ${r.citation} | COURT: ${r.court} | TITLE: ${r.title}` +
      // V4-flash supports 1M token context — give the answer model 3× more
      // legal substance per case (1200 chars) so it can write specific
      // analysis instead of guessing/hallucinating from short snippets.
      (r.summary ? ` — ${r.summary.slice(0, 1500)}` : ""),
  );

  const contextString = [
    "=== AI-SEARCHED JUDGMENTS (DIRECT DB — TOOL VERIFIED) ===",
    "Use ONLY these citations. Copy each CITATION string EXACTLY. Format: **[CITATION]** — explanation.",
    "FORBIDDEN: Do NOT invent citations. Every citation must appear in this list.",
    ...lines,
  ].join("\n");

  return { contextString, foundCount: unique.length, queriesUsed, verifiedCitations: unique.map(u => u.citation), verifiedTitles: unique.map(u => ({ title: u.title, citation: u.citation })), verifiedHits: unique.map(u => ({ citation: u.citation, title: u.title, court: u.court, summary: u.summary })) };
}
