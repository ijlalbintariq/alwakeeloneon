import type { InsertCitationLink, InsertUnresolvedCitation } from "@shared/schema";
import { storage } from "../storage";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { assessJudgmentIdentity, citationIdentifiesJudgment, citationCanLinkDirectly, citationCourtQualifier, citationSection } from "../citation-verify";

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
const COURT_SEATS = "S\\.?\\s*C\\.?|Supreme Court|Sindh|Karachi|Lahore|Islamabad|Peshawar|Balochistan|Quetta";
const PUBLISHER_QUALIFIERS = `(?:(?:${COURT_SEATS}|Civil(?: Cases)?|Criminal(?: Cases)?|Cr\\.?C\\.?|\\([^()\\d]{1,40}\\))\\s*){0,3}`;
const CITATION_REGEX = new RegExp(`\\b(\\d{4})\\s+(${JOURNAL_PATTERN})\\s+${PUBLISHER_QUALIFIERS}(\\d{1,6})\\b`, "gi");
const JOURNAL_FIRST_REGEX = new RegExp(`\\b(${JOURNAL_PATTERN})\\s+(\\d{4})\\s+${PUBLISHER_QUALIFIERS}(\\d{1,6})\\b`, "gi");
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

    const addMatch = (yearRaw: string, journalRaw: string, pageRaw: string, startOffset: number, raw: string) => {
      const year = Number(yearRaw);
      const journalCode = String(journalRaw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const page = Number(pageRaw);
      const rawCitation = raw.replace(/\s+/g, " ").trim();
      const dedupeKey = `${year}:${journalCode}:${page}:${citationCourtQualifier(rawCitation) || ""}:${citationSection(rawCitation) || ""}`;
      if (!year || !journalCode || !page || seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      results.push({
        rawCitation,
        year,
        journalCode,
        page,
        startOffset,
        contextExcerpt: extractContext(text, startOffset, raw.length, 100),
      });
    };

    for (const match of text.matchAll(CITATION_REGEX)) {
      addMatch(match[1], match[2], match[3], Number(match.index || 0), match[0]);
    }
    for (const match of text.matchAll(COMPACT_NEUTRAL_REGEX)) {
      addMatch(match[1], match[2], match[3], Number(match.index || 0), match[0]);
    }
    for (const match of text.matchAll(JOURNAL_FIRST_REGEX)) addMatch(match[2], match[1], match[3], Number(match.index || 0), match[0]);
    return results;
  }

  async resolveCitations(citations: ExtractedCitation[]): Promise<ResolvedCitation[]> {
    if (citations.length === 0) return [];

    // Preserve all court candidates; an overwritten numeric-map entry can link
    // a real reference to a completely different case in another court section.
    const wanted = citations.map(c => ({ year: c.year, page: c.page, journal: c.journalCode }));
    const rows = await db.execute(
      sql`SELECT j.id,j.year,j.page,upper(regexp_replace(lj.code,'[^A-Za-z0-9]','','g')) as journal_code,
          j.citation_string AS citation,j.title,coalesce(c.name,j.court_name_snapshot,'') AS court,
          j.text_status AS "textStatus",j.text_true_citation AS "textTrueCitation",left(j.full_text,16000) AS opening
          FROM judgments j
          INNER JOIN law_journals lj ON lj.id = j.journal_id
          LEFT JOIN courts_ref c ON c.id=j.court_id
          INNER JOIN jsonb_to_recordset(${JSON.stringify(wanted)}::jsonb) AS p(year int,page int,journal text)
            ON j.year=p.year AND j.page=p.page AND upper(regexp_replace(lj.code,'[^A-Za-z0-9]','','g'))=p.journal
          WHERE j.is_active = true AND j.canonical_judgment_id IS NULL`
    );
    const lookup = new Map<string, Map<string, any>>();
    for (const row of (rows as any).rows ?? rows) {
      const key = `${row.year}:${String(row.journal_code).toUpperCase()}:${row.page}`;
      const entries = lookup.get(key) || new Map(); entries.set(row.id,row); lookup.set(key,entries);
    }
    return citations.map(c => {
      const candidates = [...(lookup.get(`${c.year}:${c.journalCode}:${c.page}`)?.values() || [])]
        .filter(row => citationIdentifiesJudgment(c.rawCitation,row));
      const target = candidates.length === 1 && citationCanLinkDirectly(c.rawCitation)
        && assessJudgmentIdentity(candidates[0]).textIntegrity === "own" ? candidates[0] : null;
      return {...c,citedJudgmentId:target?.id || null};
    });
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
      if (item.citedJudgmentId === judgmentId) continue;
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
