import type { InsertCitationLink, InsertUnresolvedCitation } from "@shared/schema";
import { storage } from "../storage";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { judgments, lawJournals } from "@shared/schema";

export type CitationType = "relied_upon" | "referred_to" | "distinguished" | "overruled";

export type ExtractedCitation = {
  rawCitation: string;
  year: number;
  journalCode: string;
  page: number;
  startOffset: number;
  contextExcerpt: string;
};

export type ResolvedCitation = ExtractedCitation & {
  citedJudgmentId: string | null;
};

const JOURNAL_CODES = [
  "PLD", "SCMR", "PLJ", "MLD", "CLC", "PCRLJ", "YLR", "NLR", "CLD", "PTD", "PLC", "PSC", "SLR", "AIR",
  "LHC", "IHC", "SHC", "PHC", "BHC", "AJKHC",
] as const;
const NEUTRAL_CODES = ["LHC", "IHC", "SHC", "PHC", "BHC", "AJKHC"] as const;

function buildFlexibleReportPattern(code: string): string {
  const letters = String(code || "").replace(/[^A-Za-z]/g, "").split("");
  return letters.map((ch) => `${ch}\\.?`).join("\\s*");
}

const JOURNAL_PATTERN = JOURNAL_CODES.map((code) => buildFlexibleReportPattern(code)).join("|");
const NEUTRAL_PATTERN = NEUTRAL_CODES.map((code) => buildFlexibleReportPattern(code)).join("|");
const CITATION_REGEX = new RegExp(`\\b(\\d{4})\\s+(${JOURNAL_PATTERN})\\s+(\\d{1,6})\\b`, "gi");
const COMPACT_NEUTRAL_REGEX = new RegExp(`\\b(\\d{4})\\s*(${NEUTRAL_PATTERN})\\s*(\\d{1,6})\\b`, "gi");

function extractContext(text: string, start: number, length: number, radius: number = 100): string {
  const contextStart = Math.max(0, start - radius);
  const contextEnd = Math.min(text.length, start + length + radius);
  return text.slice(contextStart, contextEnd).replace(/\s+/g, " ").trim();
}

export class CitationExtractor {
  extractFromText(text: string, _judgmentId: string): ExtractedCitation[] {
    const results: ExtractedCitation[] = [];
    const seen = new Set<string>();

    const addMatch = (yearRaw: string, journalRaw: string, pageRaw: string, startOffset: number) => {
      const year = Number(yearRaw);
      const journalCode = String(journalRaw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const page = Number(pageRaw);
      const rawCitation = `${year} ${journalCode} ${page}`;
      const dedupeKey = `${year}:${journalCode}:${page}`;
      if (!year || !journalCode || !page || seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      results.push({
        rawCitation,
        year,
        journalCode,
        page,
        startOffset,
        contextExcerpt: extractContext(text, startOffset, rawCitation.length, 100),
      });
    };

    for (const match of text.matchAll(CITATION_REGEX)) {
      addMatch(match[1], match[2], match[3], Number(match.index || 0));
    }
    for (const match of text.matchAll(COMPACT_NEUTRAL_REGEX)) {
      addMatch(match[1], match[2], match[3], Number(match.index || 0));
    }
    return results;
  }

  async resolveCitations(citations: ExtractedCitation[]): Promise<ResolvedCitation[]> {
    if (citations.length === 0) return [];

    // Build one bulk query: SELECT WHERE (year, page) IN (...) with journal code filter
    // Groups all lookups into a single DB round-trip instead of N sequential awaits.
    const tuples = citations
      .map((c) => `(${c.year}, ${c.page})`)
      .join(", ");

    const rows = await db.execute(
      sql`SELECT j.id, j.year, j.page, lower(lj.code) as journal_code
          FROM judgments j
          INNER JOIN law_journals lj ON lj.id = j.journal_id
          WHERE (j.year, j.page) IN (${sql.raw(tuples)})
            AND j.is_active = true`
    );

    // Build a lookup map keyed by "year:journalCode:page"
    const lookup = new Map<string, string>();
    for (const row of (rows as any).rows ?? rows) {
      const key = `${row.year}:${String(row.journal_code).toUpperCase()}:${row.page}`;
      lookup.set(key, row.id);
    }

    return citations.map((c) => ({
      ...c,
      citedJudgmentId:
        lookup.get(`${c.year}:${c.journalCode}:${c.page}`) ?? null,
    }));
  }

  inferCitationType(contextText: string): CitationType {
    const ctx = (contextText || "").toLowerCase();
    if (ctx.includes("overruled")) return "overruled";
    if (ctx.includes("distinguished")) return "distinguished";
    if (ctx.includes("relied upon") || ctx.includes("relied-on") || ctx.includes("followed")) return "relied_upon";
    return "referred_to";
  }

  async processJudgment(judgmentId: string, text: string): Promise<{ totalFound: number; resolved: number; unresolved: number }> {
    const extracted = this.extractFromText(text, judgmentId);
    const resolved = await this.resolveCitations(extracted);

    const resolvedLinks: InsertCitationLink[] = [];
    const unresolvedRows: InsertUnresolvedCitation[] = [];

    for (const item of resolved) {
      if (item.citedJudgmentId && item.citedJudgmentId !== judgmentId) {
        resolvedLinks.push({
          sourceJudgmentId: judgmentId,
          targetJudgmentId: item.citedJudgmentId,
          citationType: this.inferCitationType(item.contextExcerpt),
          contextExcerpt: item.contextExcerpt,
          citationText: item.rawCitation,
          startOffset: item.startOffset,
        });
      } else {
        unresolvedRows.push({
          sourceJudgmentId: judgmentId,
          rawCitation: item.rawCitation,
          year: item.year,
          journalCode: item.journalCode,
          page: item.page,
          contextExcerpt: item.contextExcerpt,
          status: "pending",
        });
      }
    }

    const createdLinks = await storage.createCitationLinks(resolvedLinks);
    await storage.createUnresolvedCitations(unresolvedRows);

    return {
      totalFound: extracted.length,
      resolved: createdLinks,
      unresolved: unresolvedRows.length,
    };
  }
}

export const citationExtractor = new CitationExtractor();
