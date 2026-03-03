import type { InsertCitationLink, InsertUnresolvedCitation } from "@shared/schema";
import { storage } from "../storage";

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

const JOURNAL_PATTERN = "PLD|SCMR|PLJ|MLD|CLC|PCrLJ|PCRLJ|YLR|NLR|CLD|PTD|PLC";
const CITATION_REGEX = new RegExp(`\\b(\\d{4})\\s+(${JOURNAL_PATTERN})\\s+(\\d{1,5})\\b`, "gi");

function extractContext(text: string, start: number, length: number, radius: number = 100): string {
  const contextStart = Math.max(0, start - radius);
  const contextEnd = Math.min(text.length, start + length + radius);
  return text.slice(contextStart, contextEnd).replace(/\s+/g, " ").trim();
}

export class CitationExtractor {
  extractFromText(text: string, _judgmentId: string): ExtractedCitation[] {
    const results: ExtractedCitation[] = [];
    const seen = new Set<string>();

    for (const match of text.matchAll(CITATION_REGEX)) {
      const year = Number(match[1]);
      const journalCode = String(match[2] || "").toUpperCase().replace(/\./g, "");
      const page = Number(match[3]);
      const startOffset = Number(match.index || 0);
      const rawCitation = `${year} ${journalCode} ${page}`;
      const dedupeKey = `${year}:${journalCode}:${page}`;

      if (!year || !journalCode || !page || seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      results.push({
        rawCitation,
        year,
        journalCode,
        page,
        startOffset,
        contextExcerpt: extractContext(text, startOffset, rawCitation.length, 100),
      });
    }

    return results;
  }

  async resolveCitations(citations: ExtractedCitation[]): Promise<ResolvedCitation[]> {
    const resolved: ResolvedCitation[] = [];

    for (const citation of citations) {
      const matches = await storage.searchJudgmentsByCitation({
        year: citation.year,
        journalCode: citation.journalCode,
        page: citation.page,
      });

      resolved.push({
        ...citation,
        citedJudgmentId: matches[0]?.id || null,
      });
    }

    return resolved;
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
