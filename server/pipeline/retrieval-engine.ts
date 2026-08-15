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
import { similaritySearch } from "../rag/vector-store";
import { embedTextLocal } from "../rag/embedding-local";
import { retrieveForQuery, getCachedQueryEmbedding, GLOBAL_STATUTE_RAG_USER_ID, GLOBAL_ADMIN_KNOWLEDGE_RAG_USER_ID } from "../rag/rag-service";
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
  source: "admin" | "github" | "org" | "statute";
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

const CASELAW_TIMEOUT_MS = 5000;  // Optimized for fast retrieval with index support
const STATUTE_TIMEOUT_MS = 8000;  // Increased from 3000 to allow slow Voyage network calls
const ADMIN_DOC_TIMEOUT_MS = 15_000;  // 15s budget: covers HNSW cold-load (~5-12s first query) + GIN keyword + embedding (~800ms). Warm queries complete in <1s.

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

  // ── Statute-aware scoring ──────────────────────────────────────────
  // When user queries a specific statute + section (e.g. "CrPC 22-B"),
  // boost cases that actually mention that statute and penalize cases
  // that match only generic terms ("section", "22") from unrelated statutes.
  const STATUTE_ALIASES: Record<string, string[]> = {
    "crpc": ["cr.p.c", "crpc", "criminal procedure", "code of criminal procedure"],
    "cpc":  ["c.p.c", "cpc", "civil procedure", "code of civil procedure"],
    "ppc":  ["ppc", "p.p.c", "pakistan penal code", "penal code"],
    "cnsa": ["cnsa", "control of narcotic", "narcotics"],
    "ata":  ["ata", "anti-terrorism", "anti terrorism"],
    "nab":  ["nab", "national accountability"],
    "qso":  ["qso", "qanun-e-shahadat", "qanun e shahadat"],
  };

  // Detect which statute the user is asking about
  const queryLower = intent.normalized.toLowerCase();
  let queriedStatute: string | null = null;
  let statuteTerms: string[] = [];
  for (const [key, aliases] of Object.entries(STATUTE_ALIASES)) {
    for (const alias of aliases) {
      if (queryLower.includes(alias)) {
        queriedStatute = key;
        statuteTerms = aliases;
        break;
      }
    }
    if (queriedStatute) break;
  }

  if (queriedStatute) {
    // Check if this case actually mentions the queried statute
    const caseText = `${title} ${summary}`;
    const mentionsStatute = statuteTerms.some((t) => caseText.includes(t));
    if (mentionsStatute) {
      score += 30; // Strong boost: case is about the right statute
    } else {
      // Case matched on generic terms (e.g. "section 22" from a different act)
      // Penalize to push it below genuinely relevant results
      score = Math.max(0, score - 15);
    }
  }

  // Also check if intent has a parsed statute reference (e.g. intent.statuteRef)
  if (intent.statuteRef) {
    const refName = norm(intent.statuteRef.fullName || "");
    const refSection = norm(intent.statuteRef.sectionOrArticle || "");
    if (refName && combined.includes(refName))     score += 25;
    if (refSection && combined.includes(refSection)) score += 15;
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

async function fetchCaseLaw(intent: QueryIntent, userId: string, limit: number, focusedQueries?: string[]): Promise<RetrievedCaseLaw[]> {
  const expandedQuery = intent.expandedQuery || intent.normalized;

  // Path 1 (PRIMARY): Direct judgment table search — 223k verified, structured records.
  // When a statute reference is detected (e.g. "354 ppc" → PPC § 354), construct a
  // targeted search query. Without this, "ppc" matches every criminal case generically.
  // The statute-aware query searches for "section 354" + "PPC" as co-occurring terms,
  // which is far more precise than loose "354 & ppc" tokenization.
  //
  // IMPORTANT: Use expandedQuery (topic-classified legal terms) instead of raw normalized
  // text. Long narrative queries like "my husband marries another women..." contain noise
  // words that dilute the keyword search. The expandedQuery injects focused legal terms
  // (e.g. "marriage", "divorce", "dower", "custody") from the intent classifier, which
  // the signal-token prioritizer in searchJudgmentsByKeywords will pick up correctly.
  let judgmentSearchQuery = expandedQuery;
  if (intent.statuteRef) {
    const { abbr, sectionOrArticle } = intent.statuteRef;
    // Build targeted query: "section 354 PPC" or "354 PPC" — keeps section+abbr together
    judgmentSearchQuery = `section ${sectionOrArticle} ${abbr}`;
  }

  const judgmentKeywordPromise = withTimeout(
    storage.searchJudgmentsByKeywords(judgmentSearchQuery, limit * 5).catch(() => [] as CaseLaw[]),
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

  // Path 3 (HYBRID PARTNER): RAG vector search — semantic search across admin case-law
  // enough time (8s) to return meaningful results while still staying under the 20s budget.
  const RAG_TIMEOUT_MS = 8000;
  const ragPromise = userId
    ? retrieveForQuery({
        userId,
        query: intent.normalized,
        expandedQueryText: expandedQuery,
        topK: limit * 4,
      })
        .then(async (retrieval) => {
          // ── Separate RAG matches into admin-case-law vs judgment groups ──
          const adminDocIds: number[] = [];
          const seenAdmin = new Set<number>();
          const judgmentCaseLaw: CaseLaw[] = [];
          const seenJudgmentIds = new Set<string>();

          for (const match of retrieval.matches) {
            const sType = String((match.metadata || {}).sourceType || "").toLowerCase();

            if (sType === "admin-case-law") {
              const docId = Number(match.sourceDocumentId);
              if (!Number.isInteger(docId) || docId <= 0 || seenAdmin.has(docId)) continue;
              seenAdmin.add(docId);
              adminDocIds.push(docId);
              if (adminDocIds.length >= limit * 2) continue; // keep iterating for judgments
            } else if (sType === "judgment") {
              const judgmentId = String((match.metadata || {}).judgmentId || "");
              if (!judgmentId || seenJudgmentIds.has(judgmentId)) continue;
              seenJudgmentIds.add(judgmentId);

              // Derive a stable numeric id from UUID for dedup compatibility
              const numericId = Math.abs(parseInt(judgmentId.replace(/-/g, "").slice(0, 8), 16)) || 0;
              const citationStr = String((match.metadata || {}).citationString || "");
              const titleStr = String((match.metadata || {}).title || match.title || "");
              const courtStr = String((match.metadata || {}).court || "");

              // Extract year from citation string (e.g. "2005 PCRLJ 1008" → 2005)
              const yearMatch = citationStr.match(/\b(19|20)\d{2}\b/);
              const citYear = yearMatch ? parseInt(yearMatch[0], 10) : null;

              judgmentCaseLaw.push({
                id: numericId,
                judgmentId: judgmentId,
                citation: citationStr,
                citationYear: citYear,
                citationReport: null,
                citationPage: null,
                citationRole: "primary" as const,
                court: courtStr,
                title: titleStr,
                summary: match.chunkText?.slice(0, 600) || "",
                keywords: [] as string[],
                sourceDocId: null,
                sourceType: "judgment",
                sourceFilename: null,
                documentClassification: null,
                fallbackExtraction: false,
                statuteReferences: [] as string[],
              } as unknown as CaseLaw);
            }
          }

          // Fetch admin-case-law rows from DB (existing flow)
          const adminCaseLaw = adminDocIds.length > 0
            ? await storage.getCaseLawBySourceDocuments(adminDocIds, "admin").catch(() => [] as CaseLaw[])
            : [] as CaseLaw[];

          return { adminCaseLaw, judgmentCaseLaw };
        })
        .catch((err) => {
          console.warn("[RAG] retrieveForQuery failed:", err?.message || err);
          return { adminCaseLaw: [], judgmentCaseLaw: [] };
        })
    : Promise.resolve({ adminCaseLaw: [] as CaseLaw[], judgmentCaseLaw: [] as CaseLaw[] });

  // Path 3b (FOCUSED MULTI-QUERY): When focused queries are available, run separate
  // RAG vector searches for each sub-query in parallel. This produces higher-precision
  // results for long narratives. Results are merged + deduped with Path 3 results.
  // Each sub-query is retrieved independently, preserving its query provenance.
  const focusedRagPromise: Promise<{ adminCaseLaw: CaseLaw[]; judgmentCaseLaw: CaseLaw[] }> =
    (userId && focusedQueries && focusedQueries.length > 0)
      ? (async () => {
          const perQueryTopK = Math.ceil((limit * 3) / focusedQueries.length);
          const subResults = await Promise.all(
            focusedQueries.map(fq =>
              retrieveForQuery({
                userId,
                query: fq,
                expandedQueryText: fq, // focused query IS the expanded query
                topK: perQueryTopK,
              }).catch(() => ({ matches: [] as any[] }))
            ),
          );

          // Merge all sub-query matches, preserving provenance for logging
          const allMatches: any[] = [];
          for (let i = 0; i < subResults.length; i++) {
            for (const match of subResults[i].matches) {
              allMatches.push(match);
            }
            console.log(`[Retrieval:FocusedRAG] q${i + 1}="${focusedQueries[i].slice(0, 50)}" matches=${subResults[i].matches.length}`);
          }

          // Process merged matches (same logic as Path 3)
          const adminDocIds: number[] = [];
          const seenAdmin = new Set<number>();
          const judgmentCaseLaw: CaseLaw[] = [];
          const seenJudgmentIds = new Set<string>();

          for (const match of allMatches) {
            const sType = String((match.metadata || {}).sourceType || "").toLowerCase();
            if (sType === "admin-case-law") {
              const docId = Number(match.sourceDocumentId);
              if (!Number.isInteger(docId) || docId <= 0 || seenAdmin.has(docId)) continue;
              seenAdmin.add(docId);
              adminDocIds.push(docId);
            } else if (sType === "judgment") {
              const judgmentId = String((match.metadata || {}).judgmentId || "");
              if (!judgmentId || seenJudgmentIds.has(judgmentId)) continue;
              seenJudgmentIds.add(judgmentId);
              const numericId = Math.abs(parseInt(judgmentId.replace(/-/g, "").slice(0, 8), 16)) || 0;
              judgmentCaseLaw.push({
                id: numericId,
                judgmentId,
                citation: String((match.metadata || {}).citationString || ""),
                citationYear: (() => { const m = String((match.metadata || {}).citationString || "").match(/\b(19|20)\d{2}\b/); return m ? parseInt(m[0], 10) : null; })(),
                citationReport: null,
                citationPage: null,
                citationRole: "primary" as const,
                court: String((match.metadata || {}).court || ""),
                title: String((match.metadata || {}).title || match.title || ""),
                summary: match.chunkText?.slice(0, 600) || "",
                keywords: [] as string[],
                sourceDocId: null,
                sourceType: "judgment",
                sourceFilename: null,
                documentClassification: null,
                fallbackExtraction: false,
                statuteReferences: [] as string[],
              } as unknown as CaseLaw);
            }
          }

          const adminCaseLaw = adminDocIds.length > 0
            ? await storage.getCaseLawBySourceDocuments(adminDocIds, "admin").catch(() => [] as CaseLaw[])
            : [] as CaseLaw[];

          return { adminCaseLaw, judgmentCaseLaw };
        })()
      : Promise.resolve({ adminCaseLaw: [] as CaseLaw[], judgmentCaseLaw: [] as CaseLaw[] });

  const [judgmentRaw, keywordRaw, ragResult, focusedRagResult] = await Promise.all([
    judgmentKeywordPromise,
    withTimeout(keywordPromise, CASELAW_TIMEOUT_MS, [] as CaseLaw[]),
    withTimeout(ragPromise, RAG_TIMEOUT_MS, { adminCaseLaw: [] as CaseLaw[], judgmentCaseLaw: [] as CaseLaw[] }),
    withTimeout(focusedRagPromise, RAG_TIMEOUT_MS, { adminCaseLaw: [] as CaseLaw[], judgmentCaseLaw: [] as CaseLaw[] }),
  ]);
  const ragAdminRaw = ragResult.adminCaseLaw;
  const ragJudgmentRaw = ragResult.judgmentCaseLaw;
  // Merge standard RAG + focused multi-query RAG results
  const focusedAdminRaw = focusedRagResult.adminCaseLaw;
  const focusedJudgmentRaw = focusedRagResult.judgmentCaseLaw;
  const ragRaw = [...ragAdminRaw, ...ragJudgmentRaw, ...focusedAdminRaw, ...focusedJudgmentRaw];

  const focusedLabel = focusedQueries && focusedQueries.length > 0 ? ` focusedRagAdmin=${focusedAdminRaw.length} focusedRagJudgment=${focusedJudgmentRaw.length}` : "";
  console.log(`[Retrieval:Paths] judgment=${judgmentRaw.length} caseLaw=${keywordRaw.length} ragAdmin=${ragAdminRaw.length} ragJudgment=${ragJudgmentRaw.length}${focusedLabel}`);

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

  // Discard records with no valid citation, and filter out "Statute Reference" junk fallback entries
  const withCitation = merged.filter((row) => {
    if (!hasTrustedCitation(row)) return false;
    const court = String(row.court || "").toLowerCase().trim();
    const title = String(row.title || "").toLowerCase().trim();
    if (court === "statute reference") return false;
    if (title.startsWith("statute reference")) return false;
    return true;
  });
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

function cleanSection(secStr: string): string {
  return secStr
    .toLowerCase()
    .replace(/\b(?:section|article|sec\.?|art\.?|s\.?)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

async function fetchStatutes(intent: QueryIntent, limit: number): Promise<RetrievedStatute[]> {
  // Direct section lookup when user explicitly typed e.g. "PPC 392" or "Article 25 Constitution"
  if (intent.statuteRef) {
    const { fullName, sectionOrArticle } = intent.statuteRef;
    
    // Try exact target lookup first
    try {
      const directMatch = await withTimeout(
        storage.getStatuteByTitleAndSection(fullName, sectionOrArticle),
        STATUTE_TIMEOUT_MS,
        undefined,
      );
      if (directMatch) {
        return [{
          shortTitle: String(directMatch.shortTitle || ""),
          section: String(directMatch.section || ""),
          description: String(directMatch.description || ""),
          punishment: String(directMatch.punishment || ""),
          relevanceScore: 100,
          statuteDocumentTitle: fullName,
        }];
      }
    } catch (err) {
      console.warn(`[RAG:Statutes] Direct lookup failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const directRows = await withTimeout(
      storage.searchStatutes(`${fullName} ${sectionOrArticle}`, limit * 3).catch(() => []),
      STATUTE_TIMEOUT_MS,
      [],
    ) as any[];

    const cleanUserSection = cleanSection(sectionOrArticle);
    const matched = directRows.filter((r: any) => {
      const dbSecClean = cleanSection(String(r.section || ""));
      return dbSecClean === cleanUserSection || dbSecClean.startsWith(cleanUserSection) || dbSecClean.includes(cleanUserSection);
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

  // ── PRIMARY: Semantic Vector Search (88K embeddings) ─────────────────────
  // Always run vector search first — this is the main search path that uses
  // all 88K statute embeddings for semantic understanding of the query.
  const query = intent.normalized;
  const queryWords = query.split(/\s+/).filter((w) => w.length >= 3);

  // Start embedding the query immediately (async)
  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await withTimeout(getCachedQueryEmbedding(query), STATUTE_TIMEOUT_MS, null);
  } catch (err) {
    console.warn(`[RAG:Statutes] Failed to embed query:`, err);
  }

  // ── SUPPLEMENTARY: Topic-to-Statute-Title Mapping ──────────────────────
  // Use detected topics to boost results from known relevant statutes.
  // This supplements vector search, not replaces it.
  const TOPIC_STATUTE_MAP: Record<string, string[]> = {
    "contract": ["Contract Act 1872", "Specific Relief Act 1877", "Specific Relief Act, 1877"],
    "property": ["Transfer of Property Act 1882", "Transfer of Property Act, 1882", "Registration Act 1908", "West Pakistan Land Revenue Act 1967", "Specific Relief Act 1877", "Specific Relief Act, 1877"],
    "partition-suit": ["The Punjab Partition of Immovable Property Act 2012", "West Pakistan Land Revenue Act 1967", "West Pakistan Land Revenue Rules 1968", "Specific Relief Act 1877", "Specific Relief Act, 1877", "Transfer of Property Act 1882"],
    "murder": ["Pakistan Penal Code 1860", "Pakistan Penal Code, 1860", "Code of Criminal Procedure 1898", "Code of Criminal Procedure, 1898"],
    "robbery": ["Pakistan Penal Code 1860", "Pakistan Penal Code, 1860"],
    "bail": ["Code of Criminal Procedure 1898", "Code of Criminal Procedure, 1898"],
    "family": ["Muslim Family Laws Ordinance 1961", "Family Courts Act 1964", "Guardians and Wards Act 1890", "Dissolution of Muslim Marriages Act 1939"],
    "fraud": ["Pakistan Penal Code 1860", "Pakistan Penal Code, 1860"],
    "constitutional": ["Constitution of Pakistan 1973", "Constitution of Pakistan, 1973"],
    "cybercrime": ["Prevention of Electronic Crimes Act 2016"],
    "narcotics": ["Control of Narcotic Substances Act 1997"],
    "terrorism": ["Anti-Terrorism Act 1997"],
    "labour": ["Industrial Relations Act 2012"],
    "company-corporate": ["Companies Act 2017"],
    "tax": ["Income Tax Ordinance 2001", "Sales Tax Act 1990"],
    "tort-negligence": ["Specific Relief Act 1877", "Specific Relief Act, 1877", "Contract Act 1872"],
    "easement": ["Easements Act 1882", "Easement Act 1882"],
    "adverse-possession": ["Limitation Act 1908", "Transfer of Property Act 1882"],
    "cancellation-documents": ["Specific Relief Act 1877", "Specific Relief Act, 1877", "Transfer of Property Act 1882"],
    "islamic-inheritance": ["Muslim Family Laws Ordinance 1961", "West Pakistan Muslim Personal Law Shariat Application Act 1962"],
    "pre-emption": ["Punjab Pre-Emption Act 1991", "West Pakistan Pre-Emption Act 1964"],
  };

  const targetTitles = new Set<string>();
  for (const topic of intent.topics) {
    const titles = TOPIC_STATUTE_MAP[topic.id];
    if (titles) {
      for (const t of titles) targetTitles.add(t);
    }
  }

  // Also check for statute names mentioned directly in the query text
  const queryLower = intent.normalized;
  const STATUTE_NAME_PATTERNS: [RegExp, string[]][] = [
    [/contract\s*act/i, ["Contract Act 1872"]],
    [/specific\s*relief/i, ["Specific Relief Act 1877", "Specific Relief Act, 1877"]],
    [/transfer\s*of\s*property/i, ["Transfer of Property Act 1882", "Transfer of Property Act, 1882"]],
    [/land\s*revenue/i, ["West Pakistan Land Revenue Act 1967", "West Pakistan Land Revenue Rules 1968"]],
    [/partition/i, ["The Punjab Partition of Immovable Property Act 2012"]],
    [/penal\s*code|ppc/i, ["Pakistan Penal Code 1860", "Pakistan Penal Code, 1860"]],
    [/criminal\s*procedure|crpc/i, ["Code of Criminal Procedure 1898", "Code of Criminal Procedure, 1898"]],
    [/civil\s*procedure|cpc/i, ["Code of Civil Procedure 1908", "Code of Civil Procedure, 1908"]],
    [/constitution/i, ["Constitution of Pakistan 1973", "Constitution of Pakistan, 1973"]],
    [/family\s*law|family\s*court/i, ["Family Courts Act 1964", "Muslim Family Laws Ordinance 1961"]],
    [/registration\s*act/i, ["Registration Act 1908"]],
    [/qanun.e.shahadat|evidence/i, ["Qanun-e-Shahadat Order 1984"]],
  ];
  for (const [pattern, titles] of STATUTE_NAME_PATTERNS) {
    if (pattern.test(queryLower)) {
      for (const t of titles) targetTitles.add(t);
    }
  }

  // ── Run ALL search paths in parallel ───────────────────────────────────
  // 1. Vector similarity search (88K embeddings — primary)
  // 2. Keyword search (ILIKE fallback)
  // 3. Topic-mapped statute title search (supplementary boost)
  const topicMapPromise = targetTitles.size > 0
    ? (async () => {
        const perStatuteLimit = Math.max(3, Math.ceil(limit / targetTitles.size));
        const promises = Array.from(targetTitles).map(async (title) => {
          try {
            const rows = await withTimeout(
              storage.getStatutesByTitle(title, perStatuteLimit * 3).catch(() => []),
              STATUTE_TIMEOUT_MS,
              [],
            ) as any[];
            const scored = rows.map((s: any) => {
              const combined = norm(`${s.shortTitle || ""} ${s.section || ""} ${s.description || ""}`);
              let score = 0;
              for (const word of queryWords) {
                if (combined.includes(word)) score += 10;
              }
              for (const topic of intent.topics) {
                for (const term of [...topic.primary, ...topic.synonyms.slice(0, 6)]) {
                  if (combined.includes(term)) score += 8;
                }
              }
              return {
                shortTitle: String(s.shortTitle || ""),
                section: String(s.section || ""),
                description: String(s.description || ""),
                punishment: String(s.punishment || ""),
                relevanceScore: Math.max(score, 5),
                statuteDocumentTitle: title,
              } as RetrievedStatute;
            });
            return scored.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, perStatuteLimit);
          } catch {
            return [] as RetrievedStatute[];
          }
        });
        const results = await Promise.all(promises);
        return results.flat();
      })()
    : Promise.resolve([] as RetrievedStatute[]);

  const [rawRows, vectorMatches, topicMapResults] = await Promise.all([
    withTimeout(storage.searchStatutes(query, limit * 3).catch(() => []), STATUTE_TIMEOUT_MS, []),
    queryEmbedding
      ? withTimeout(
          similaritySearch({
            userId: "global-admin-statute-sections",
            queryEmbedding,
            queryText: query,
            topK: Math.max(limit * 2, 15),
            vectorWeight: 0.72,
            keywordWeight: 0.28,
          }).catch((err) => {
            console.warn(`[RAG:Statutes] Vector similarity search failed:`, err);
            return [];
          }),
          STATUTE_TIMEOUT_MS,
          [],
        )
      : Promise.resolve([]),
    topicMapPromise,
  ]);

  console.log(`[RAG:Statutes] Results — vector: ${vectorMatches.length}, keyword: ${(rawRows as any[]).length}, topicMap: ${topicMapResults.length}`);

  // ── Merge all results into a single scored map ─────────────────────────
  const statuteMap = new Map<string, RetrievedStatute & { vectorScore?: number; keywordScore?: number; topicBoost?: number }>();
  const getSectionKey = (title: string, sec: string) => `${norm(title)}::${norm(sec)}`;

  // 1. Process vector matches (PRIMARY — highest trust)
  for (const m of vectorMatches) {
    const sTitle = String((m.metadata as any)?.shortTitle || "");
    const sec = String((m.metadata as any)?.section || "");
    if (!sTitle || !sec) continue;

    const key = getSectionKey(sTitle, sec);

    // Parse description and punishment from chunkText
    const parts = (m.chunkText || "").split("\nDESCRIPTION:\n");
    const descAndPunish = parts[1] || "";
    const subParts = descAndPunish.split("\nPUNISHMENT: ");
    const description = subParts[0] || "";
    const punishment = subParts[1] || "None";

    statuteMap.set(key, {
      shortTitle: sTitle,
      section: sec,
      description,
      punishment,
      relevanceScore: 0,
      vectorScore: m.score,
      keywordScore: 0,
      topicBoost: 0,
    });
  }

  // 2. Process keyword rows (merge into existing or add new)
  for (const s of rawRows as any[]) {
    const key = getSectionKey(s.shortTitle, s.section);
    const combined = norm(`${s.shortTitle || ""} ${s.section || ""} ${s.description || ""}`);
    let kwScore = 0;
    for (const word of queryWords) {
      if (combined.includes(word)) kwScore += 10;
    }
    for (const topic of intent.topics) {
      for (const term of [...topic.primary, ...topic.synonyms.slice(0, 4)]) {
        if (combined.includes(term)) kwScore += 8;
      }
    }
    const normKw = Math.min(1.0, kwScore / 50);

    const existing = statuteMap.get(key);
    if (existing) {
      existing.keywordScore = normKw;
    } else {
      statuteMap.set(key, {
        shortTitle: String(s.shortTitle || ""),
        section: String(s.section || ""),
        description: String(s.description || ""),
        punishment: String(s.punishment || ""),
        relevanceScore: 0,
        keywordScore: normKw,
        vectorScore: 0,
        topicBoost: 0,
      });
    }
  }

  // 3. Process topic map results (boost score for matching entries)
  for (const tmResult of topicMapResults) {
    const key = getSectionKey(tmResult.shortTitle, tmResult.section);
    const existing = statuteMap.get(key);
    if (existing) {
      // Boost: this statute was found by both vector/keyword AND topic map
      existing.topicBoost = Math.min(0.15, (tmResult.relevanceScore || 5) / 100);
      // Enrich description if vector match had empty description
      if (!existing.description && tmResult.description) {
        existing.description = tmResult.description;
      }
      if (!existing.punishment && tmResult.punishment) {
        existing.punishment = tmResult.punishment;
      }
      if (tmResult.statuteDocumentTitle) {
        (existing as any).statuteDocumentTitle = tmResult.statuteDocumentTitle;
      }
    } else {
      // Topic map found a statute not in vector or keyword results — add it
      statuteMap.set(key, {
        shortTitle: tmResult.shortTitle,
        section: tmResult.section,
        description: tmResult.description,
        punishment: tmResult.punishment,
        relevanceScore: 0,
        vectorScore: 0,
        keywordScore: 0,
        topicBoost: Math.min(0.15, (tmResult.relevanceScore || 5) / 100),
        statuteDocumentTitle: tmResult.statuteDocumentTitle,
      } as any);
    }
  }

  // 4. Compute fused hybrid scores (vector-first weighting)
  const candidates: RetrievedStatute[] = [];
  for (const item of statuteMap.values()) {
    const fused = 0.65 * (item.vectorScore || 0) + 0.25 * (item.keywordScore || 0) + 0.10 * (item.topicBoost || 0);
    item.relevanceScore = Math.round(fused * 100);
    candidates.push({
      shortTitle: item.shortTitle,
      section: item.section,
      description: item.description,
      punishment: item.punishment,
      relevanceScore: item.relevanceScore,
      statuteDocumentTitle: (item as any).statuteDocumentTitle,
    });
  }

  candidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
  const topCandidates = candidates.slice(0, 15);

  // 5. Apply Voyage Reranker if active
  if (topCandidates.length > 0 && process.env.RAG_EMBEDDING_PROVIDER?.toLowerCase() === "voyage") {
    try {
      const { rerankVoyage } = await import("../rag/embedding-local");
      const docsToRerank = topCandidates.map(
        (c) => `STATUTE: ${c.shortTitle}\nSECTION: ${c.section}\nDESCRIPTION:\n${c.description}`
      );
      const rerankResult = await withTimeout(
        rerankVoyage(query, docsToRerank),
        STATUTE_TIMEOUT_MS,
        [],
      );
      
      const rerankScores = new Map<number, number>();
      for (const item of rerankResult) {
        rerankScores.set(item.index, item.score);
      }

      for (let idx = 0; idx < topCandidates.length; idx++) {
        const rerankScore = rerankScores.get(idx) ?? 0;
        topCandidates[idx].relevanceScore = Math.round(
          (rerankScore * 0.60 + (topCandidates[idx].relevanceScore / 100) * 0.40) * 100
        );
      }
      topCandidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (err) {
      console.warn(`[RAG:Statutes] Voyage reranking failed:`, err);
    }
  }

  return topCandidates.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Admin / Github doc retrieval
// ---------------------------------------------------------------------------

async function fetchAdminDocs(intent: QueryIntent, limit: number, userId?: string): Promise<RetrievedDoc[]> {
  const query = intent.normalized;
  const docs: RetrievedDoc[] = [];

  // Embed the query for direct vector search against statute & knowledge indexes.
  // This is MUCH faster than retrieveForQuery which queries ALL global indexes
  // including global-admin-judgments (5.5M rows, 50-100s per query).
  const embeddingPromise = withTimeout(
    getCachedQueryEmbedding(query).catch(() => null),
    ADMIN_DOC_TIMEOUT_MS,
    null,
  );

  const [githubRaw, adminRaw, queryEmbedding] = await Promise.all([
    withTimeout(storage.searchGithubKnowledge(query, limit).catch(() => []), ADMIN_DOC_TIMEOUT_MS, []),
    withTimeout(storage.searchAdminKnowledge(query, limit).catch(() => []), ADMIN_DOC_TIMEOUT_MS, []),
    embeddingPromise,
  ]);

  // Direct vector search against statute & knowledge indexes only (fast, HNSW indexed)
  if (queryEmbedding) {
    console.log(`[fetchAdminDocs] Embedding OK (dim=${queryEmbedding.length}), running similaritySearch...`);
    const candidateTopK = Math.max(limit * 2, 10);
    const ragMatches = await withTimeout(
      Promise.all([
        similaritySearch({
          userId: GLOBAL_STATUTE_RAG_USER_ID,
          queryEmbedding,
          queryText: query,
          topK: candidateTopK,
          vectorWeight: 0.72,
          keywordWeight: 0.28,   // Hybrid: HNSW vector (<10ms) + GIN full-text (47MB index, <100ms)
        }).catch((err) => { console.warn(`[fetchAdminDocs] statute search error: ${err.message}`); return []; }),
        similaritySearch({
          userId: GLOBAL_ADMIN_KNOWLEDGE_RAG_USER_ID,
          queryEmbedding,
          queryText: query,
          topK: candidateTopK,
          vectorWeight: 0.72,
          keywordWeight: 0.28,
        }).catch((err) => { console.warn(`[fetchAdminDocs] knowledge search error: ${err.message}`); return []; }),
      ]),
      ADMIN_DOC_TIMEOUT_MS,
      [[], []],
    );

    console.log(`[fetchAdminDocs] statute=${ragMatches[0].length} knowledge=${ragMatches[1].length} results`);

    const allMatches = [...ragMatches[0], ...ragMatches[1]]
      .filter((m) => m.score >= 0.15)
      .sort((a, b) => b.score - a.score);

    console.log(`[fetchAdminDocs] ${allMatches.length} matches after score filter (>= 0.15)`);
    for (const m of allMatches.slice(0, 3)) {
      console.log(`  [score=${m.score.toFixed(4)}] sourceType=${(m.metadata as any)?.sourceType || "?"} title="${(m.title || "").slice(0, 50)}"`);
    }

    for (const match of allMatches) {
      if (docs.length >= limit) break;
      const sType = String((match.metadata || {} as any).sourceType || "").toLowerCase();
      if (sType === "admin-statute" || sType === "statute") {
        docs.push({
          title: String(match.title || ""),
          content: String(match.chunkText || ""),
          source: "statute",
        });
      } else {
        docs.push({
          title: String(match.title || ""),
          content: String(match.chunkText || ""),
          source: "admin",
        });
      }
    }
  } else {
    console.log(`[fetchAdminDocs] No embedding available — skipping vector search`);
  }

  for (const doc of (githubRaw as any[])) {
    if (docs.length >= limit) break;
    docs.push({ title: String(doc.title || ""), content: String(doc.content || ""), source: "github" });
  }
  for (const doc of (adminRaw as any[])) {
    if (docs.length >= limit) break;
    docs.push({ title: String(doc.title || ""), content: String(doc.content || ""), source: "admin" });
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
} = {}, focusedQueries?: string[]): Promise<RetrievalResult> {
  const t0 = Date.now();
  const caseLawLimit = limits.caseLaw ?? 10;
  const statuteLimit = limits.statutes ?? 8;
  const adminDocLimit = limits.adminDocs ?? 3;

  const [caseLawResults, statuteResults, adminDocResults] = await Promise.all([
    intent.needsCaseLaw
      ? fetchCaseLaw(intent, userId, caseLawLimit, focusedQueries)
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
