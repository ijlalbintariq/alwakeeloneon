import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { storage } from "../storage";
import { retrieveForQuery } from "../rag/rag-service";

// ── Tool schema (sent to DeepSeek so it knows when/how to call it) ──────────

export const CITATION_SEARCH_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_judgments",
    description:
      "Search the Al Wakeelo internal Pakistani case law database for real, verified judgments. " +
      "ALWAYS call this tool before citing any case law. Never cite a judgment not returned by this tool. " +
      "STRATEGY: For complex multi-issue queries (property disputes, multi-party litigation), call this tool 5-6 times with DIFFERENT queries covering EACH legal sub-issue. " +
      "For simple queries, call 2-3 times with different angles. " +
      "Example for property dispute: call 1 → 'Section 53A part performance', call 2 → 'bona fide purchaser Section 41', call 3 → 'specific performance readiness', call 4 → 'constructive notice possession', call 5 → 'agreement to sell vs sale deed', call 6 → 'mortgage priority equitable interest'. " +
      "Example for bail: call 1 → 'bail cancellation', call 2 → 'Section 497 misuse liberty', call 3 → 'supervening circumstances bail'. " +
      "Example for dower/mehr: call 1 → 'mehr recovery', call 2 → 'dower nikahnama', call 3 → 'specific performance dower', call 4 → 'haq mehr property', call 5 → 'mahr waiver'. " +
      "Use all results from all calls to build your citation list.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "SHORT specific legal keywords — 2 to 4 words maximum. " +
            "The database uses full-text matching: shorter queries find MORE results. " +
            "GOOD: 'bail cancellation', 'Section 302 murder', 'tenant eviction', 'fraud cheque'. " +
            "BAD (too long, will miss results): 'legal grounds for cancellation of bail in Supreme Court Pakistan'. " +
            "Use Pakistani legal terminology: qatl, diyat, tazir, fasad, khula, mehr, hiba, musha, wakf. " +
            "Do NOT put court name in query — use the court parameter instead.",
        },
        court: {
          type: "string",
          description:
            "Optional court filter. Use ONLY when question is court-specific. " +
            "Examples: 'Supreme Court', 'Lahore High Court', 'Sindh High Court', 'Peshawar High Court', 'Federal Shariat Court'",
        },
        limit: {
          type: "number",
          description: "Max results per call. Default 8, max 10. Use 10 when broad coverage needed.",
        },
      },
      required: ["query"],
    },
  },
};

// ── Tool execution ───────────────────────────────────────────────────────────

export interface CitationSearchArgs {
  query: string;
  court?: string;
  limit?: number;
}

export interface CitationResult {
  citation: string;
  court: string;
  title: string;
  summary: string;
  keywords: string[];
}

/**
 * Normalize a citation string for dedupe comparison.
 *
 * Pakistani citations come in many formats from different sources:
 *   - "PLD 2020 SC 456"
 *   - "P L D 2020 SC 456"          (spaces between letters — common in scraped data)
 *   - "PLD 2020 SC 456."           (trailing period)
 *   - "[PLD 2020 SC 456]"          (square brackets)
 *   - "PLD (2020) SC 456"          (parenthesised year)
 *   - "PLD\u00A02020\u00A0SC\u00A0456" (non-breaking spaces from HTML scraping)
 *   - "1970 S C M R 869"           (spaced acronyms)
 *   - "1970-SCMR-869"              (hyphen-separated)
 *
 * All of the above refer to the same judgment and must collapse to one key.
 *
 * Strategy:
 *   1. Lowercase
 *   2. Replace non-breaking spaces, em/en dashes, hyphens with regular space
 *   3. Strip brackets [] {} and parens around years
 *   4. Strip trailing punctuation (. , ; :)
 *   5. Collapse whitespace
 *   6. Remove spaces between consecutive single uppercase letters (P L D → pld)
 */
export function normalizeCitationKey(citation: string | undefined | null): string {
  if (!citation) return "";
  return citation
    .toLowerCase()
    .replace(/[\u00A0\u2007\u202F]/g, " ")     // non-breaking spaces
    .replace(/[\u2010-\u2015\-]/g, " ")          // hyphens, em-dash, en-dash
    .replace(/[\[\]{}()]/g, " ")                 // strip brackets and parens
    .replace(/[.,;:]+\s*$/g, "")                 // trailing punctuation
    .replace(/\b([a-z])\s+(?=[a-z]\b)/g, "$1")   // collapse "p l d" → "pld"
    .replace(/\s+/g, " ")                        // collapse whitespace
    .trim();
}

// In-memory LRU cache keyed by normalized query + court.
// Many tool-search calls repeat (e.g. "bail cancellation" asked by hundreds
// of users daily). Each call hits the DB for ~10s; caching cuts that to ~1ms
// for hits. TTL 30 min — long enough to hit common queries, short enough
// that newly-ingested judgments appear within reasonable time.
interface CachedResult {
  payload: string;
  expiresAt: number;
}
const TOOL_SEARCH_CACHE = new Map<string, CachedResult>();
const TOOL_SEARCH_CACHE_TTL_MS = 30 * 60 * 1000;
const TOOL_SEARCH_CACHE_MAX = 500;

function cacheKey(query: string, court: string | undefined, limit: number): string {
  return `${String(query || "").trim().toLowerCase()}::${String(court || "").trim().toLowerCase()}::${limit}`;
}

function cacheGet(key: string): string | null {
  const entry = TOOL_SEARCH_CACHE.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    TOOL_SEARCH_CACHE.delete(key);
    return null;
  }
  // Touch LRU: re-insert to move to end of insertion order
  TOOL_SEARCH_CACHE.delete(key);
  TOOL_SEARCH_CACHE.set(key, entry);
  return entry.payload;
}

function cacheSet(key: string, payload: string): void {
  if (TOOL_SEARCH_CACHE.size >= TOOL_SEARCH_CACHE_MAX) {
    // Evict oldest (first insertion-order entry)
    const oldest = TOOL_SEARCH_CACHE.keys().next().value;
    if (oldest !== undefined) TOOL_SEARCH_CACHE.delete(oldest);
  }
  TOOL_SEARCH_CACHE.set(key, { payload, expiresAt: Date.now() + TOOL_SEARCH_CACHE_TTL_MS });
}

export async function executeCitationSearch(args: CitationSearchArgs): Promise<string> {
  const { query, court, limit = 20 } = args;
  // Raised cap 10 -> 25 to widen the trusted pool for the answer model.
  // V4-flash 1M context can absorb the extra rows; bigger pool means the
  // model finds more on-point cases without falling back to training memory.
  const safeLimit = Math.min(25, Math.max(1, limit));

  // Cache hit fast-path — common queries served instantly.
  const ck = cacheKey(query, court, safeLimit);
  const cached = cacheGet(ck);
  if (cached) {
    return cached;
  }

  try {
    // Search both tables in parallel alongside a high-performance Vector Similarity Search (RAG).
    // Previously, pure keyword search only matched titles or metadata, missing rich context inside
    // full text and headnotes. Hybrid RAG vector search fetches semantically relevant judgments.
    const [caseLawResults, judgmentResults, vectorResultsRaw] = await Promise.all([
      storage.searchCaseLaw(query, safeLimit, { court: court || undefined }),
      storage.searchJudgmentsByKeywords(query, safeLimit),
      retrieveForQuery({
        userId: "global-admin-judgments",
        query,
        metadataFilters: court ? { court } : undefined,
        topK: safeLimit,
      }).catch((err) => {
        console.warn("[executeCitationSearch:Vector] Hybrid search failed, falling back to keywords:", err?.message || err);
        return { matches: [] };
      }),
    ]);

    // Map RAG vector matches to the unified CaseLaw structure.
    const vectorResults: typeof caseLawResults = (vectorResultsRaw?.matches || []).map((m) => {
      const parts = String(m.title || "").split(" — ");
      const citation = String(m.metadata?.citationString || parts[0] || "");
      const title = String(m.metadata?.title || parts.slice(1).join(" — ") || "Judgment");
      return {
        id: Number(m.metadata?.judgmentId || m.sourceDocumentId || 0),
        citation,
        citationYear: null,
        citationReport: null,
        citationPage: null,
        citationRole: "cited" as const,
        court: String(m.metadata?.court || ""),
        title,
        summary: String(m.chunkText || ""),
        keywords: [],
        sourceDocId: null,
        sourceType: "judgment",
        sourceFilename: null,
        documentClassification: "case_law" as const,
        fallbackExtraction: false,
        statuteReferences: [],
      };
    });

    // Filter out non-judgment rows from case_law table. The auto-extract
    // pipeline creates fallback entries with court="Statute Reference" and
    // titles like "Statute Reference: nab" when it can't classify a doc as a
    // real case. These pollute the Case Law Card and offer no value to the
    // legal user (they're statute references, not judgments).
    const caseLawClean = caseLawResults.filter((r) => {
      const courtStr = String(r.court || "").trim().toLowerCase();
      const titleStr = String(r.title || "").trim().toLowerCase();
      if (courtStr === "statute reference") return false;
      if (titleStr.startsWith("statute reference")) return false;
      return true;
    });

    // Merge + dedupe by normalised citation string. Judgments table preferred,
    // followed by Vector Similarity hits, and then keyword fallback matches.
    const seen = new Set<string>();
    const dedup: typeof caseLawResults = [];
    for (const r of [...judgmentResults, ...vectorResults, ...caseLawClean]) {
      const key = normalizeCitationKey(r.citation);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      dedup.push(r);
    }

    // Relevance ranking — court hierarchy × recency × text match.
    // Lawyers want the strongest authority first: a 2024 Supreme Court case
    // should outrank a 1971 single-bench High Court case for the same query.
    const courtWeight = (court: string): number => {
      const c = String(court || "").toLowerCase();
      if (c.includes("supreme court of pakistan") || c === "sc" || c.includes("supreme court")) return 10;
      if (c.includes("federal shariat")) return 6;
      if (c.includes("high court")) return 5;
      if (c.includes("district") || c.includes("session")) return 2;
      if (!c || c === "pakistani courts") return 3;
      return 3;
    };
    const recencyWeight = (citationStr: string): number => {
      const m = String(citationStr || "").match(/(?:^|[^0-9])((?:19|20)\d{2})/);
      const year = m ? Number(m[1]) : 0;
      if (!year) return 1.0;
      // 2025 → ~3.5, 2000 → ~1.0, 1971 → ~0.0
      return Math.max(0.1, (year - 1990) / 10);
    };
    const queryTokens = String(query || "")
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z0-9]/g, ""))
      .filter((t) => t.length >= 4);
    const textMatch = (r: typeof dedup[number]): number => {
      if (queryTokens.length === 0) return 1;
      const hay = `${r.title || ""} ${r.summary || ""}`.toLowerCase();
      let hits = 0;
      for (const t of queryTokens) if (hay.includes(t)) hits++;
      const base = 1 + hits / queryTokens.length;

      // Domain-mismatch penalty: ONLY for strong, clear mismatches.
      // Softened from v1 — family cases often contain civil terms (property, decree,
      // possession) and were being incorrectly penalized.
      //
      // Only penalize when there's a HARD signal: PCRLJ citation in a civil query,
      // or murder/bail keywords in a property dispute.
      const HARD_CRIMINAL_SIGNALS = ["murder", "qatl", "bail", "fir", "conviction", "acquittal", "prisoner", "penal", "prosecution", "accused"];
      const HARD_CIVIL_SIGNALS = ["mortgage", "tenant", "landlord", "eviction", "easement", "partition", "conveyance"];

      const queryLower = query.toLowerCase();
      const queryCivil = HARD_CIVIL_SIGNALS.some(d => queryLower.includes(d)) || queryLower.includes("property") || queryLower.includes("tpa");
      const queryCriminal = HARD_CRIMINAL_SIGNALS.some(d => queryLower.includes(d)) || queryLower.includes("ppc") || queryLower.includes("crpc");

      const citText = hay;
      const citIsCriminalJournal = String(r.citation || "").toUpperCase().includes("PCRLJ");
      const citHardCriminal = HARD_CRIMINAL_SIGNALS.some(d => citText.includes(d)) || citIsCriminalJournal;
      const citHardCivil = HARD_CIVIL_SIGNALS.some(d => citText.includes(d));

      // Only penalize CLEAR cross-domain: criminal case in civil query or vice versa
      // Penalty is 0.3x (downranks but doesn't bury — still appears if nothing better exists)
      if (queryCivil && !queryCriminal && citHardCriminal && !citHardCivil) return base * 0.3;
      if (queryCriminal && !queryCivil && citHardCivil && !citHardCriminal) return base * 0.3;

      // NO penalty for family-civil overlap — family cases naturally discuss property, maintenance, etc.
      // NO penalty for family-criminal overlap — family cases mention cruelty, harassment, etc.

      return base;
    };
    const scored = dedup.map((r) => ({
      r,
      score: courtWeight(String(r.court || "")) * recencyWeight(String(r.citation || "")) * textMatch(r),
    }));
    scored.sort((a, b) => b.score - a.score);
    const merged = scored.slice(0, safeLimit).map((s) => s.r);

    if (merged.length === 0) {
      const empty = JSON.stringify({
        found: 0,
        message: "No judgments found in the database for this query.",
        results: [],
      });
      // Do NOT cache found:0 results. A single DB timeout can poison the
      // cache for 30 min, causing all subsequent calls for the same query
      // to instantly return 0 without ever hitting the DB again.
      return empty;
    }

    const payload = JSON.stringify({
      found: merged.length,
      message: `Found ${merged.length} judgment(s). Use ONLY these citations in your response.`,
      results: merged.map((r) => ({
        citation: r.citation,
        court: r.court,
        title: r.title,
        summary: (r.summary || "").slice(0, 1500),
      })),
    });
    cacheSet(ck, payload);
    return payload;
  } catch (err) {
    console.error("[citation-search-tool] Error:", err);
    return JSON.stringify({
      found: 0,
      message: "Database search failed. Do not cite any judgment.",
      results: [],
    });
  }
}
