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
        "If the user's message is casual conversation, greeting, or does not require legal research, DO NOT call any tools — just respond 'DONE'. " +
        "Search the Al Wakeelo internal Pakistani case law database for real, verified judgments. " +
        "STRATEGY: For complex multi-issue queries, call this tool 5-8 times with DIFFERENT queries covering EACH legal sub-issue. " +
        "For simple queries, call 2-3 times. Use 2-4 word queries — shorter queries find MORE results. " +
        "\n\nPAKISTANI LEGAL TERMINOLOGY MAP (use BOTH English AND Urdu/Arabic terms):" +
        "\n--- FAMILY LAW ---" +
        "\nDower/Mahr: 'mehr recovery', 'haq mehr', 'mahr', 'deferred dower', 'prompt dower', 'dower suit', 'mehr nikahnama'" +
        "\nMarriage: 'nikahnama', 'nikah', 'marriage contract', 'valima', 'rukhsati'" +
        "\nDivorce: 'talaq', 'khula', 'dissolution marriage', 'talaq-e-tafweez', 'mubarat', 'faskh'" +
        "\nMaintenance: 'nafaqa', 'maintenance wife', 'maintenance children', 'iddat maintenance'" +
        "\nCustody: 'hizanat', 'custody minor', 'visitation rights', 'guardian ward'" +
        "\nGift in marriage: 'hiba', 'hiba mehr', 'gift deed wife', 'hiba bil iwaz', 'hiba ba shart'" +
        "\nFamily Courts: 'Family Courts Act', 'Section 5 Family Courts', 'family court jurisdiction'" +
        "\nMuslim Family Laws: 'MFLO', 'Muslim Family Laws Ordinance', 'Section 6 MFLO'" +
        "\n--- PROPERTY LAW ---" +
        "\nSale/Transfer: 'sale deed', 'bai', 'agreement to sell', 'Section 54 TPA', 'transfer property'" +
        "\nGift/Hiba: 'hiba', 'gift deed', 'Section 122 TPA', 'gift immovable', 'hiba musha'" +
        "\nPossession: 'qabza', 'possession property', 'trespass', 'Section 9 Specific Relief'" +
        "\nPreemption: 'shuf\'a', 'right preemption', 'co-sharer preemption'" +
        "\nBona fide purchaser: 'bona fide purchaser', 'Section 41 TPA', 'ostensible owner'" +
        "\nLis pendens: 'lis pendens', 'Section 52 TPA', 'pendente lite'" +
        "\nPart performance: 'Section 53A', 'part performance', 'oral agreement'" +
        "\nRegistration: 'registered deed', 'Registration Act', 'Section 17 Registration'" +
        "\nMutation: 'mutation', 'intiqal', 'revenue record', 'patwari'" +
        "\nInheritance: 'wirasat', 'inheritance', 'succession', 'shares inheritance Muslim'" +
        "\n--- CRIMINAL LAW ---" +
        "\nMurder: 'qatl-e-amd', 'Section 302 PPC', 'murder', 'qatl', 'fasad fil arz'" +
        "\nBail: 'bail', 'pre-arrest bail', 'Section 497', 'bail cancellation', 'ad interim bail'" +
        "\nDacoity/Robbery: 'dacoity', 'robbery', 'Section 392', 'Section 395'" +
        "\nFraud: 'dhoka', 'cheating', 'Section 420 PPC', 'criminal breach trust'" +
        "\nNarcotics: 'CNSA', 'narcotics', 'charas', 'heroin recovery'" +
        "\nBlasphemy: 'Section 295-C', 'blasphemy', 'Section 295-B'" +
        "\nDiyat/Blood money: 'diyat', 'blood money', 'Section 310 PPC', 'compromise qatl'" +
        "\nZina: 'zina', 'Section 10 Offence Zina', 'Hudood Ordinance'" +
        "\n--- CIVIL LAW ---" +
        "\nContract: 'aqd', 'contract', 'breach contract', 'specific performance contract'" +
        "\nInjunction: 'stay order', 'injunction', 'Order 39 CPC', 'temporary injunction'" +
        "\nDeclaration: 'declaration suit', 'Section 42 Specific Relief', 'declaratory decree'" +
        "\nLimitation: 'limitation', 'barred limitation', 'Article 120 Limitation'" +
        "\nCancellation: 'cancellation deed', 'Section 39 Specific Relief'" +
        "\nMesne profits: 'mesne profits', 'rental income', 'damages possession'" +
        "\n--- CONSTITUTIONAL LAW ---" +
        "\nFundamental rights: 'Article 9', 'Article 10A', 'Article 14', 'Article 25', 'fundamental rights'" +
        "\nWrit petition: 'writ', 'certiorari', 'mandamus', 'Article 199'" +
        "\n--- BANKING/FINANCE ---" +
        "\nCheque dishonour: 'cheque dishonour', 'Section 489-F PPC', 'dishonoured cheque'" +
        "\nBanking recovery: 'banking court', 'Financial Institutions Recovery Ordinance'" +
        "\n--- LABOR ---" +
        "\nTermination: 'wrongful termination', 'reinstatement', 'service tribunal'" +
        "\n--- LANDLORD/TENANT ---" +
        "\nEviction: 'ejectment', 'eviction tenant', 'rent restriction', 'bonafide need'" +
        "\n\nEXAMPLE SEARCH STRATEGIES:" +
        "\nFor Haq Mehr + gift deed + bona fide purchaser query:" +
        "\n  call 1 → 'mehr recovery suit'  call 2 → 'hiba wife property'  call 3 → 'bona fide purchaser Section 41'" +
        "\n  call 4 → 'lis pendens Section 52'  call 5 → 'nikahnama dower enforceable'  call 6 → 'mesne profits'" +
        "\n  call 7 → 'settlement waiver mehr'  call 8 → 'family court jurisdiction property'" +
        "\nFor murder/bail query:" +
        "\n  call 1 → 'qatl-e-amd Section 302'  call 2 → 'bail murder'  call 3 → 'ocular evidence'" +
        "\n\nRULES:" +
        "\n- Use BOTH English and Urdu/Arabic legal terms (mehr + dower, hiba + gift, talaq + divorce, qabza + possession)" +
        "\n- Stay STRICTLY within the same legal domain as the query" +
        "\n- NEVER mix domains (family query → ONLY family/civil queries, NEVER criminal)" +
        "\n- After issuing all tool calls, respond: DONE",
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
