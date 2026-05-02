/**
 * Retrieval Engine
 *
 * Responsibility: Fetch authoritative sources for a classified query.
 *
 * Input  : QueryIntent from intent-classifier
 * Output : RetrievalResult — structured, validated sources
 *
 * Design rules:
 *  - Single responsibility: ONLY fetch and validate. No formatting.
 *  - Strict: discard any result that does not meet relevance threshold.
 *  - Correct > Complete: return 0 results rather than wrong results.
 *  - All fetches run with timeouts. A slow source never blocks the pipeline.
 *  - NEVER falls back to "recent case law" — that bypasses topic validation.
 */

import { storage } from "../storage";
import { retrieveForQuery } from "../rag/rag-service";
import type { CaseLaw } from "../../shared/schema";
import type { QueryIntent, LegalTopic } from "./intent-classifier";
import { normalizeCitationKey } from "../tools/citation-search-tool";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetrievedCaseLaw {
  row: CaseLaw;
  /** 0-100 relevance score against query topics */
  relevanceScore: number;
}

export interface RetrievedStatute {
  shortTitle: string;
  section: string;
  description: string;
  punishment: string;
  relevanceScore: number;
  /** Full statute name when resolved from an abbreviation, e.g. "Pakistan Penal Code" */
  statuteDocumentTitle?: string;
}

export interface RetrievedDoc {
  title: string;
  content: string;
  source: "admin" | "github" | "org";
}

export interface RetrievalResult {
  caseLaw: RetrievedCaseLaw[];
  statutes: RetrievedStatute[];
  adminDocs: RetrievedDoc[];
  /** Diagnostic info for logging */
  diagnostics: {
    caseLawFetched: number;
    caseLawAfterFilter: number;
    statutesFetched: number;
    adminDocsFetched: number;
    strategyUsed: string;
    topicsMatched: string[];
    durationMs: number;
  };
}

// ---------------------------------------------------------------------------
// Timeouts
// ---------------------------------------------------------------------------

const CASELAW_TIMEOUT_MS = 20000;  // Increased from 15000 - headnotes removed from ILIKE but still giving buffer
const STATUTE_TIMEOUT_MS = 3000;  // Increased from 1500
const ADMIN_DOC_TIMEOUT_MS = 1500;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// ---------------------------------------------------------------------------
// Citation format validation with court + reporting type enrichment
// ---------------------------------------------------------------------------

// Citation formats: Two valid systems in Pakistani legal documents
// 1. JUDGMENT CITATION: "1970 SCMR 869" (reported in law journals)
//    - Metadata: Court (extracted from citation), Reporting Type (legal code meaning)
// 2. CASE NUMBER: "C.A. 8-Q of 2017" (case number before judgment is reported)
//    - Metadata: Case Type (Appeal, Petition, etc.), Year

// Legal code to reporting system mapping
const LEGAL_CODE_MAPPING: Record<string, { reportingType: string; court: string }> = {
  pld: { reportingType: "Pakistan Law Digest", court: "Supreme Court" },
  scmr: { reportingType: "Supreme Court Monthly Report", court: "Supreme Court" },
  ylr: { reportingType: "Year Law Reports", court: "High Court" },
  mld: { reportingType: "Mohammedan Law Digest", court: "Various" },
  clc: { reportingType: "Criminal Law Cases", court: "Various" },
  plj: { reportingType: "Pakistan Law Journal", court: "Various" },
  nlr: { reportingType: "National Law Reports", court: "High Court" },
  pcrlj: { reportingType: "Pakistan Criminal Law Journal", court: "Various" },
  ptcl: { reportingType: "Pakistan Trade & Commercial Law", court: "Various" },
  ptd: { reportingType: "Pakistan Tax Digest", court: "Various" },
  psc: { reportingType: "Pakistan Supreme Court", court: "Supreme Court" },
  ald: { reportingType: "All Pakistan Legal Digest", court: "Various" },
  klr: { reportingType: "Karachi Law Reports", court: "Sindh High Court" },
  plc: { reportingType: "Pakistan Law Cases", court: "Various" },
  cld: { reportingType: "Criminal Law Digest", court: "Various" },
  air: { reportingType: "All India Reports (Historical)", court: "Various" },
  lhc: { reportingType: "Lahore High Court Reports", court: "Lahore High Court" },
  ihc: { reportingType: "Islamabad High Court Reports", court: "Islamabad High Court" },
  shc: { reportingType: "Sindh High Court Reports", court: "Sindh High Court" },
  phc: { reportingType: "Peshawar High Court Reports", court: "Peshawar High Court" },
  bhc: { reportingType: "Balochistan High Court Reports", court: "Balochistan High Court" },
  ajkhc: { reportingType: "Azad Jammu & Kashmir High Court", court: "AJK High Court" },
};

// Case type to descriptive label mapping
const CASE_TYPE_MAPPING: Record<string, string> = {
  "c.a":                      "Civil Appeal",
  "ca":                       "Civil Appeal",
  "civil appeal":             "Civil Appeal",
  "criminal appeal":          "Criminal Appeal",
  "appeal":                   "Appeal",
  "civil petition":           "Civil Petition",
  "criminal petition":        "Criminal Petition",
  "criminal revision":        "Criminal Revision",
  "petition":                 "Petition",
  "writ petition":            "Writ Petition",
  "writ":                     "Writ Petition",
  "r.p.a":                    "Review Petition Appeal",
  "rpa":                      "Review Petition Appeal",
  "review petition":          "Review Petition",
  "constitutional petition":  "Constitutional Petition",
  "constitution petition":    "Constitutional Petition",
  "human rights case":        "Human Rights Case",
  "contempt petition":        "Contempt Petition",
  "company appeal":           "Company Appeal",
  "company petition":         "Company Petition",
  "fca":                      "Federal Court Appeal",
};

const LEGAL_CODE_RE = /\b(pld|scmr|ylr|mld|clc|plj|nlr|pcrlj|ptcl|ptd|psc|ald|klr|plc|cld|air|lhc|ihc|shc|phc|bhc|ajkhc)\b/i;

// Comprehensive case number patterns — must contain a case-type prefix AND a year
// Covers: C.A., Civil/Criminal Appeal/Petition, Writ, Review, Constitution, HRC, etc.
const CASE_NUMBER_RE = /\b(?:C\.?A\.?|Civil\s+Appeal|Criminal\s+Appeal|Civil\s+Petition|Criminal\s+Petition|Criminal\s+Revision|Writ\s+Petition|Review\s+Petition|R\.?P\.?A\.?|Constitution(?:al)?\s+Petition|Human\s+Rights\s+Case|Contempt\s+Petition|Company\s+(?:Appeal|Petition)|FCA)\s+(?:No\.?\s*)?\d+[\w\-\/]*\s+(?:of\s+)?\d{4}\b/i;

const YEAR_RE = /\b(19|20)\d{2}\b/;

/**
 * Extract reporting type and court from legal code
 * Example: "SCMR" → { reportingType: "Supreme Court Monthly Report", court: "Supreme Court" }
 */
function extractReportingMetadata(code: string): { reportingType: string; court: string } {
  const normalized = code.toLowerCase();
  return LEGAL_CODE_MAPPING[normalized] || { reportingType: "Unknown Law Report", court: "Unknown" };
}

/**
 * Extract case type from case number
 * Example: "Civil Petition No. 32-Q of 2017" → "Civil Petition"
 */
function extractCaseType(caseNumber: string): string {
  const c = String(caseNumber || "");
  // Try longest match first (most specific)
  const ordered = Object.keys(CASE_TYPE_MAPPING).sort((a, b) => b.length - a.length);
  for (const key of ordered) {
    if (new RegExp(`\\b${key.replace(/\./g, "\\.?")}\\b`, "i").test(c)) {
      return CASE_TYPE_MAPPING[key];
    }
  }
  // Generic fallback
  const match = c.match(/\b(c\.?a\.?|civil\s+appeal|criminal\s+appeal|civil\s+petition|criminal\s+petition|writ\s+petition|review\s+petition|r\.?p\.?a\.?)/i);
  if (match) return match[0].trim();
  return "Case Number";
}

function hasTrustedCitation(row: CaseLaw): boolean {
  const c = String(row.citation || "").trim();
  if (!c || c.length < 5) return false;

  // Criterion 1: Sourced directly from the judgments table or the case_law DB table — always trusted.
  if (row.sourceType === "judgment" || row.sourceType === "db-case-law") return true;

  // Criterion 2: Structured citation fields were successfully parsed.
  // citationYear being set means the enrichment function extracted a valid year,
  // which is proof the citation string follows a recognized format.
  if (Number.isInteger(row.citationYear) && row.citationYear! >= 1900) return true;

  // Criterion 3: Known law report code + year in the citation string.
  // Examples: "1970 SCMR 869", "2020 PLD SC 456", "2019 LHC 1260", "PLJ 2019 SC 33"
  if (LEGAL_CODE_RE.test(c) && YEAR_RE.test(c)) return true;

  // Criterion 4: Recognized case number format with year.
  // Examples: "C.A. 8-Q of 2017", "Civil Petition No. 32-Q of 2017"
  if (CASE_NUMBER_RE.test(c)) return true;

  // Criterion 5: Citation contains a 4-digit year AND a page/volume number
  // Catches non-standard formats like "2015 (2) ILR 45", "NLR 2020 Civ 33"
  if (YEAR_RE.test(c) && /\b\d{1,5}\b/.test(c) && c.length >= 8) return true;

  // Criterion 6: Citation has a known court name in it — still a real citation
  // even if the report code is missing or uses an uncommon abbreviation
  const COURT_NAME_RE = /\b(supreme\s+court|high\s+court|lahore|sindh|islamabad|peshawar|balochistan|federal\s+shariat|privy\s+council|ajk|azad\s+kashmir)\b/i;
  if (COURT_NAME_RE.test(c) && YEAR_RE.test(c)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Relevance scoring (case law)
// ---------------------------------------------------------------------------

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s\-]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreCaseLawRow(row: CaseLaw, intent: QueryIntent): number {
  const title    = norm(String(row.title || ""));
  const summary  = norm(String(row.summary || ""));
  const citation = norm(String(row.citation || ""));
  const court    = norm(String(row.court || ""));
  const kws      = (row.keywords || []).map((k) => norm(k)).join(" ");
  const combined = `${title} ${summary} ${kws} ${court}`;

  let score = 0;

  // Score against detected topics
  for (const topic of intent.topics) {
    for (const term of topic.primary) {
      if (combined.includes(term)) score += 20;
      if (title.includes(term))    score += 15;
      if (kws.includes(term))      score += 10;
    }
    for (const term of topic.synonyms) {
      if (combined.includes(term)) score += 6;
      if (title.includes(term))    score += 5;
    }
  }

  // Score against raw query words
  const queryWords = intent.normalized.split(/\s+/).filter((w) => w.length >= 3);
  for (const word of queryWords) {
    if (title.includes(word))    score += 10;
    if (summary.includes(word))  score += 6;
    if (kws.includes(word))      score += 7;
    if (citation.includes(word)) score += 8; // citation year/code match
    if (court.includes(word))    score += 4;
  }

  // Boost if citation year matches query year
  const queryYear = intent.normalized.match(/\b(19|20)\d{2}\b/)?.[0];
  if (queryYear && citation.includes(queryYear)) score += 12;

  // Court hierarchy bonus — higher courts produce more authoritative precedent.
  // City names (lahore, sindh, etc.) only count when paired with "high court"
  // so "Sessions Court Lahore" doesn't incorrectly earn a high court bonus.
  if (court.includes("supreme court"))            score += 15;
  else if (court.includes("federal shariat"))     score += 12;
  else if (court.includes("high court"))          score += 8;

  // Recency bonus — recent cases reflect current law
  const rowYear = row.citationYear || 0;
  const currentYear = new Date().getFullYear();
  if (rowYear >= currentYear - 5)       score += 10;
  else if (rowYear >= currentYear - 10) score += 5;
  else if (rowYear >= currentYear - 20) score += 2;

  return score;
}

function scoreCaseLawRowForCitationLookup(row: CaseLaw, intent: QueryIntent): number {
  const c = norm(String(row.citation || ""));
  const t = norm(String(row.title || ""));
  const q = intent.normalized.toLowerCase();

  // Full citation match
  if (c.includes(q) || q.includes(c)) return 100;

  // Title match (case number in title)
  if (t.includes(q) || q.includes(t.slice(0, 30))) return 80;

  // Partial token match on citation
  const words = q.split(/\s+/);
  let score = 0;
  for (const word of words) {
    if (c.includes(word)) score += 20;
    if (t.includes(word)) score += 8;
  }
  return score;
}

// ---------------------------------------------------------------------------
// Case law retrieval
// ---------------------------------------------------------------------------

async function fetchCaseLaw(intent: QueryIntent, userId: string, limit: number): Promise<RetrievedCaseLaw[]> {
  const expandedQuery = intent.expandedQuery || intent.normalized;

  // Path 1 (PRIMARY): Direct judgment table search — 204k verified, structured records.
  // This is now the main source. Gets the largest limit.
  const judgmentKeywordPromise = withTimeout(
    storage.searchJudgmentsByKeywords(expandedQuery, limit * 5).catch(() => [] as CaseLaw[]),
    CASELAW_TIMEOUT_MS,
    [] as CaseLaw[],
  );

  // Path 2 (SECONDARY): keyword search on case_law table — extracted citations from
  // uploaded documents. Use original query (not expanded) to avoid expanded terms
  // (e.g. "crpc 497 498 application") matching procedure docs instead of real judgments.
  const keywordPromise = storage.searchCaseLaw(intent.normalized, limit * 2, {
    sort: "relevance",
    includeSourceContentSearch: false,
  }).catch(() => [] as CaseLaw[]);

  // Path 3 (TERTIARY): RAG vector search — admin-uploaded case law documents
  const ragPromise = userId
    ? retrieveForQuery({ userId, query: expandedQuery, topK: limit * 4 })
        .then(async (retrieval) => {
          const adminDocIds: number[] = [];
          const seenAdmin = new Set<number>();

          for (const match of retrieval.matches) {
            const sType = String((match.metadata || {}).sourceType || "").toLowerCase();
            if (sType !== "admin-case-law") continue;
            const docId = Number(match.sourceDocumentId);
            if (!Number.isInteger(docId) || docId <= 0 || seenAdmin.has(docId)) continue;
            seenAdmin.add(docId);
            adminDocIds.push(docId);
            if (adminDocIds.length >= limit * 2) break;
          }

          const adminCaseLaw = adminDocIds.length > 0
            ? await storage.getCaseLawBySourceDocuments(adminDocIds, "admin").catch(() => [] as CaseLaw[])
            : [] as CaseLaw[];

          return adminCaseLaw;
        })
        .catch(() => [] as CaseLaw[])
    : Promise.resolve([] as CaseLaw[]);

  const [judgmentRaw, keywordRaw, ragRaw] = await Promise.all([
    judgmentKeywordPromise,
    withTimeout(keywordPromise, CASELAW_TIMEOUT_MS, [] as CaseLaw[]),
    withTimeout(ragPromise, CASELAW_TIMEOUT_MS, [] as CaseLaw[]),
  ]);

  console.log(`[Retrieval:Paths] judgment=${judgmentRaw.length} caseLaw=${keywordRaw.length} rag=${ragRaw.length}`);

  // Tag DB-sourced rows so hasTrustedCitation doesn't discard them.
  // These rows came from the structured case_law table and are real records,
  // but may lack a normalized citationYear/citationReport, failing the regex checks.
  const taggedKeywordRaw = keywordRaw.map((r) =>
    r.sourceType ? r : { ...r, sourceType: "db-case-law" as const },
  );

  // Merge: judgments first (primary source), then case_law, then RAG
  // Use normalizeCitationKey (same helper as tool-call path) so format variants
  // like "P L D 2020 SC 456" and "PLD 2020 SC 456" collapse to the same key.
  const seen = new Set<string>();
  const merged: CaseLaw[] = [];
  for (const row of [...judgmentRaw, ...taggedKeywordRaw, ...ragRaw]) {
    const citKey = normalizeCitationKey(String(row.citation || ""));
    if (!citKey || seen.has(citKey)) continue;
    seen.add(citKey);
    merged.push(row);
  }

  // Discard records with no valid citation
  const withCitation = merged.filter(hasTrustedCitation);
  // Diagnostic: log how many were dropped by hasTrustedCitation
  if (merged.length > 0 && withCitation.length < merged.length) {
    console.log(`[Retrieval:CitationFilter] merged=${merged.length} trusted=${withCitation.length} dropped=${merged.length - withCitation.length}`);
  }

  // Score and filter by topic relevance
  const isCitationLookup = intent.type === "citation-lookup";
  const scoreFn = isCitationLookup ? scoreCaseLawRowForCitationLookup : scoreCaseLawRow;

  // The DB already filtered results for relevance via ILIKE — the results came back
  // because they matched the query. Don't re-filter them heavily with a second scorer.
  // The client-side scorer adds a relevance RANKING signal but must not drop valid results.
  // Use a flat low threshold of 5 — just enough to exclude truly unrelated rows.
  const rawMinScore = isCitationLookup ? 0 : 2;

  // Apply a floor to not over-filter judgment-sourced rows which are already verified
  const scored = withCitation
    .map((row) => {
      const relevanceScore = scoreFn(row, intent);
      // Judgment DB rows get a 5-point bonus — they are pre-verified, full-text indexed
      const adjustedScore = row.sourceType === "judgment" ? relevanceScore + 5 : relevanceScore;
      return { row, relevanceScore: adjustedScore };
    })
    .filter((item) => item.relevanceScore >= rawMinScore)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  return scored.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Statute retrieval
// ---------------------------------------------------------------------------

async function fetchStatutes(intent: QueryIntent, limit: number): Promise<RetrievedStatute[]> {
  // Direct section lookup when user explicitly typed e.g. "PPC 392" or "Article 25 Constitution"
  if (intent.statuteRef) {
    const { fullName, sectionOrArticle } = intent.statuteRef;
    // Search by full statute name + section number for exact match
    const directRows = await withTimeout(
      storage.searchStatutes(`${fullName}`, limit * 3).catch(() => []),
      STATUTE_TIMEOUT_MS,
      [],
    ) as any[];
    // Filter to matching section
    const sectionPattern = sectionOrArticle.toLowerCase();
    const matched = directRows.filter((r: any) => {
      const sec = String(r.section || "").toLowerCase();
      return sec === sectionPattern || sec.startsWith(sectionPattern + " ") || sec.includes(`(${sectionPattern})`);
    });
    if (matched.length > 0) {
      return matched.slice(0, limit).map((s: any) => ({
        shortTitle: String(s.shortTitle || ""),
        section: String(s.section || ""),
        description: String(s.description || ""),
        punishment: String(s.punishment || ""),
        relevanceScore: 100,
        statuteDocumentTitle: fullName,
      } as RetrievedStatute));
    }
    // Fallback: return all rows for this statute (top sections by relevance)
    const fallback = directRows.slice(0, limit).map((s: any) => ({
      shortTitle: String(s.shortTitle || ""),
      section: String(s.section || ""),
      description: String(s.description || ""),
      punishment: String(s.punishment || ""),
      relevanceScore: 80,
      statuteDocumentTitle: fullName,
    } as RetrievedStatute));
    if (fallback.length > 0) return fallback;
  }

  const query = intent.expandedQuery || intent.normalized;
  const rawRows = await withTimeout(
    storage.searchStatutes(query, limit * 2).catch(() => []),
    STATUTE_TIMEOUT_MS,
    [],
  );

  // Score statutes against the expanded query
  const queryWords = intent.normalized.split(/\s+/).filter((w) => w.length >= 3);

  const scored = (rawRows as any[]).map((s: any) => {
    const combined = norm(`${s.shortTitle || ""} ${s.section || ""} ${s.description || ""}`);
    let score = 0;
    for (const word of queryWords) {
      if (combined.includes(word)) score += 10;
    }
    for (const topic of intent.topics) {
      for (const term of [...topic.primary, ...topic.synonyms.slice(0, 4)]) {
        if (combined.includes(term)) score += 8;
      }
    }
    return {
      shortTitle: String(s.shortTitle || ""),
      section: String(s.section || ""),
      description: String(s.description || ""),
      punishment: String(s.punishment || ""),
      relevanceScore: score,
    } as RetrievedStatute;
  });

  // Only return statutes with at least minimal relevance
  return scored
    .filter((s) => s.relevanceScore >= 8)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Admin / Github doc retrieval
// ---------------------------------------------------------------------------

async function fetchAdminDocs(intent: QueryIntent, limit: number, userId?: string): Promise<RetrievedDoc[]> {
  const query = intent.normalized;
  const docs: RetrievedDoc[] = [];

  const [githubRaw, adminRaw] = await Promise.all([
    withTimeout(storage.searchGithubKnowledge(query, limit).catch(() => []), ADMIN_DOC_TIMEOUT_MS, []),
    withTimeout(storage.searchAdminKnowledge(query, limit).catch(() => []), ADMIN_DOC_TIMEOUT_MS, []),
  ]);

  for (const doc of (githubRaw as any[])) {
    docs.push({ title: String(doc.title || ""), content: String(doc.content || ""), source: "github" });
    if (docs.length >= limit) break;
  }
  for (const doc of (adminRaw as any[])) {
    docs.push({ title: String(doc.title || ""), content: String(doc.content || ""), source: "admin" });
    if (docs.length >= limit) break;
  }

  // Org docs
  if (userId) {
    try {
      const userOrg = await withTimeout(storage.getUserOrganization(userId), 1000, null);
      if (userOrg) {
        const orgDocs = await withTimeout(
          storage.searchOrgKnowledge(userOrg.id, query, 2).catch(() => []),
          ADMIN_DOC_TIMEOUT_MS,
          [],
        );
        for (const doc of (orgDocs as any[])) {
          docs.push({ title: String(doc.title || ""), content: String(doc.content || ""), source: "org" });
        }
      }
    } catch { /* org lookup failure is non-fatal */ }
  }

  return docs;
}

// ---------------------------------------------------------------------------
// Main retrieval function
// ---------------------------------------------------------------------------

// Export metadata extraction helpers for use in context building
export { extractReportingMetadata, extractCaseType };

export async function runRetrieval(intent: QueryIntent, userId: string, limits: {
  caseLaw?: number;
  statutes?: number;
  adminDocs?: number;
} = {}): Promise<RetrievalResult> {
  const t0 = Date.now();
  const caseLawLimit = limits.caseLaw ?? 10;
  const statuteLimit = limits.statutes ?? 4;
  const adminDocLimit = limits.adminDocs ?? 3;

  const [caseLawResults, statuteResults, adminDocResults] = await Promise.all([
    intent.needsCaseLaw
      ? fetchCaseLaw(intent, userId, caseLawLimit)
      : Promise.resolve([] as RetrievedCaseLaw[]),
    intent.needsStatutes
      ? fetchStatutes(intent, statuteLimit)
      : Promise.resolve([] as RetrievedStatute[]),
    intent.needsAdminDocs
      ? fetchAdminDocs(intent, adminDocLimit, userId)
      : Promise.resolve([] as RetrievedDoc[]),
  ]);

  const durationMs = Date.now() - t0;

  return {
    caseLaw: caseLawResults,
    statutes: statuteResults,
    adminDocs: adminDocResults,
    diagnostics: {
      caseLawFetched: caseLawResults.length,
      // caseLawAfterFilter = results with score > 0 (genuinely scored, not just trusted-citation passthrough)
      caseLawAfterFilter: caseLawResults.filter((r) => r.relevanceScore > 0).length,
      statutesFetched: statuteResults.length,
      adminDocsFetched: adminDocResults.length,
      strategyUsed: intent.type,
      topicsMatched: intent.topics.map((t) => t.label),
      durationMs,
    },
  };
}
