import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { storage } from "../storage";

// ── Tool schema (sent to DeepSeek so it knows when/how to call it) ──────────

export const CITATION_SEARCH_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_judgments",
    description:
      "Search the Al Wakeelo internal Pakistani case law database for real, verified judgments. " +
      "ALWAYS call this tool before citing any case law in your response. " +
      "Never cite a judgment that did not appear in the results of this tool.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Legal topic, statute, or keywords to search for. " +
            "Examples: 'tenant eviction holdover', 'Section 302 PPC murder intent', 'bail cancellation Supreme Court'",
        },
        court: {
          type: "string",
          description:
            "Optional court filter. Examples: 'Supreme Court', 'Lahore High Court', 'Sindh High Court'",
        },
        limit: {
          type: "number",
          description: "Max results to return. Default 5, max 8.",
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
    const results = await storage.searchCaseLaw(query, safeLimit, {
      court: court || undefined,
    });

    if (!results || results.length === 0) {
      // Also try the judgments table full-text search
      const fallback = await storage.searchJudgmentsByKeywords(query, safeLimit);
      if (!fallback || fallback.length === 0) {
        return JSON.stringify({
          found: 0,
          message: "No judgments found in the database for this query.",
          results: [],
        });
      }

      return JSON.stringify({
        found: fallback.length,
        message: `Found ${fallback.length} judgment(s). Use ONLY these citations in your response.`,
        results: fallback.map((r) => ({
          citation: r.citation,
          court: r.court,
          title: r.title,
          summary: (r.summary || "").slice(0, 300),
        })),
      });
    }

    return JSON.stringify({
      found: results.length,
      message: `Found ${results.length} judgment(s). Use ONLY these citations in your response.`,
      results: results.map((r) => ({
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
