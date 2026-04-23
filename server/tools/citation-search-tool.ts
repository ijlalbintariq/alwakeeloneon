import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { storage } from "../storage";

// ── Tool schema (sent to DeepSeek so it knows when/how to call it) ──────────

export const CITATION_SEARCH_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_judgments",
    description:
      "Search the Al Wakeelo internal Pakistani case law database for real, verified judgments. " +
      "ALWAYS call this tool before citing any case law. Never cite a judgment not returned by this tool. " +
      "STRATEGY: Call this tool 2-3 times with DIFFERENT short queries to maximise results. " +
      "Example for bail cancellation: call 1 → query:'bail cancellation', call 2 → query:'Section 497 misuse liberty', call 3 → query:'supervening circumstances bail'. " +
      "Example for murder: call 1 → query:'Section 302 intention qatl', call 2 → query:'culpable homicide PPC', call 3 → query:'murder conviction evidence'. " +
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
          description: "Max results per call. Default 5, max 8. Use 8 when broad coverage needed.",
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

export async function executeCitationSearch(args: CitationSearchArgs): Promise<string> {
  const { query, court, limit = 5 } = args;
  const safeLimit = Math.min(8, Math.max(1, limit));

  try {
    // Search both tables in parallel — same as Judgments search page behaviour.
    // Previously case_law was searched first and judgments only as fallback,
    // meaning case_law results (often unrelated extracted citations) blocked
    // the richer judgments table from being searched at all.
    const [caseLawResults, judgmentResults] = await Promise.all([
      storage.searchCaseLaw(query, safeLimit, { court: court || undefined }),
      storage.searchJudgmentsByKeywords(query, safeLimit),
    ]);

    // Merge, deduplicate by normalised citation string, judgments table preferred
    // (it has richer headnotes/fullText; case_law has extracted summaries).
    const seen = new Set<string>();
    const merged: typeof caseLawResults = [];

    for (const r of [...judgmentResults, ...caseLawResults]) {
      const key = (r.citation || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(r);
      if (merged.length >= safeLimit) break;
    }

    if (merged.length === 0) {
      return JSON.stringify({
        found: 0,
        message: "No judgments found in the database for this query.",
        results: [],
      });
    }

    return JSON.stringify({
      found: merged.length,
      message: `Found ${merged.length} judgment(s). Use ONLY these citations in your response.`,
      results: merged.map((r) => ({
        citation: r.citation,
        court: r.court,
        title: r.title,
        summary: (r.summary || "").slice(0, 300),
      })),
    });
  } catch (err) {
    console.error("[citation-search-tool] Error:", err);
    return JSON.stringify({
      found: 0,
      message: "Database search failed. Do not cite any judgment.",
      results: [],
    });
  }
}
