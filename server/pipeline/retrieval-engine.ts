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

const CASELAW_TIMEOUT_MS = 4000;
const STATUTE_TIMEOUT_MS = 1500;
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

// Case type to court mapping
const CASE_TYPE_MAPPING: Record<string, string> = {
  "c.a": "Court of Appeals",
  "ca": "Court of Appeals",
  "civil appeal": "Court of Appeals",
  "appeal": "Court of Appeals",
  "petition": "Petition",
  "civil petition": "Civil Petition",
  "r.p.a": "Review Petition Appeal",
  "writ petition": "Writ Petition",
};

const LEGAL_CODE_RE = /\b(pld|scmr|ylr|mld|clc|plj|nlr|pcrlj|ptcl|ptd|psc|ald|klr|plc|cld|air|lhc|ihc|shc|phc|bhc|ajkhc)\b/i;
const CASE_NUMBER_RE = /\b(c\.?a\.?|ca|civil\s+appeal|appeal|petition|writ|r\.?p\.?a\.?)\s*[\d\-a-z]+\s*of\s*\d{4}/i;
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
 * Example: "C.A. 8-Q" → "Court of Appeals"
 */
function extractCaseType(caseNumber: string): string {
  const match = caseNumber.match(/\b(c\.?a\.?|ca|civil\s+appeal|appeal|petition|writ|r\.?p\.?a\.?)/i);
  if (match) {
    const caseType = match[0].toLowerCase();
    return CASE_TYPE_MAPPING[caseType] || match[0];
  }
  return "Unknown Case Type";
}

function hasTrustedCitation(row: CaseLaw): boolean {
  const c = String(row.citation || "").trim();
  if (!c || c.length < 5) return false;

  // Format 1: Judgment Citation (has legal code + year)
  // Example: "1970 SCMR 869", "2020 PLD SC 456"
  // Enriches: reportingType (SCMR = Supreme Court Monthly Report), court (extracted)
  const isJudgmentCitation = LEGAL_CODE_RE.test(c) && YEAR_RE.test(c);

  // Format 2: Case Number (has case identifier + year)
  // Example: "C.A. 8-Q of 2017", "Civil Petition No.32-Q of 2017"
  // Enriches: caseType (Appeal, Petition, etc.), year
  const isCaseNumber = CASE_NUMBER_RE.test(c) || YEAR_RE.test(c);

  return isJudgmentCitation || isCaseNumber;
}

// ---------------------------------------------------------------------------
// Relevance scoring (case law)
// ---------------------------------------------------------------------------

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s\-]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreCaseLawRow(row: CaseLaw, intent: QueryIntent): number {
  const title = norm(String(row.title || ""));
  const summary = norm(String(row.summary || ""));
  const kws = (row.keywords || []).map((k) => norm(k)).join(" ");
  const combined = `${title} ${summary} ${kws}`;

  let score = 0;

  // Score against detected topics
  for (const topic of intent.topics) {
    for (const term of topic.primary) {
      if (combined.includes(term)) score += 20;
      if (title.includes(term)) score += 15;
    }
    for (const term of topic.synonyms) {
      if (combined.includes(term)) score += 6;
      if (title.includes(term)) score += 5;
    }
  }

  // Score against raw query words
  const queryWords = intent.normalized.split(/\s+/).filter((w) => w.length >= 3);
  for (const word of queryWords) {
    if (title.includes(word)) score += 10;
    if (summary.includes(word)) score += 6;
    if (kws.includes(word)) score += 7;
  }

  return score;
}

function scoreCaseLawRowForCitationLookup(row: CaseLaw, intent: QueryIntent): number {
  // For direct citation lookup just return all results that match citation format
  const c = norm(String(row.citation || ""));
  const q = intent.normalized;
  if (c.includes(q) || q.includes(c)) return 100;
  // partial match on year / report code
  const words = q.split(/\s+/);
  let score = 0;
  for (const word of words) {
    if (c.includes(word)) score += 20;
  }
  return score;
}

// ---------------------------------------------------------------------------
// Case law retrieval
// ---------------------------------------------------------------------------

async function fetchCaseLaw(intent: QueryIntent, userId: string, limit: number): Promise<RetrievedCaseLaw[]> {
  const expandedQuery = intent.expandedQuery || intent.normalized;

  // Path 1: keyword search with expanded terms
  const keywordPromise = storage.searchCaseLaw(expandedQuery, limit * 3, {
    sort: "relevance",
    includeSourceContentSearch: false,
  }).catch(() => [] as CaseLaw[]);

  // Path 2: RAG vector search (only for users, returns admin-case-law sourceType)
  const ragPromise = userId
    ? retrieveForQuery({ userId, query: expandedQuery, topK: limit * 5 })
        .then(async (retrieval) => {
          const sourceDocIds: number[] = [];
          const seen = new Set<number>();
          for (const match of retrieval.matches) {
            const sType = String((match.metadata || {}).sourceType || "").toLowerCase();
            if (sType !== "admin-case-law") continue;
            const docId = Number(match.sourceDocumentId);
            if (!Number.isInteger(docId) || docId <= 0 || seen.has(docId)) continue;
            seen.add(docId);
            sourceDocIds.push(docId);
            if (sourceDocIds.length >= limit * 4) break;
          }
          if (sourceDocIds.length === 0) return [] as CaseLaw[];
          return storage.getCaseLawBySourceDocuments(sourceDocIds, "admin");
        })
        .catch(() => [] as CaseLaw[])
    : Promise.resolve([] as CaseLaw[]);

  const [keywordRaw, ragRaw] = await Promise.all([
    withTimeout(keywordPromise, CASELAW_TIMEOUT_MS, [] as CaseLaw[]),
    withTimeout(ragPromise, CASELAW_TIMEOUT_MS, [] as CaseLaw[]),
  ]);

  // Merge, deduplicate
  const seen = new Set<string>();
  const merged: CaseLaw[] = [];
  for (const row of [...keywordRaw, ...ragRaw]) {
    const key = `${norm(String(row.citation || ""))}|${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }

  // Discard records with no valid citation
  const withCitation = merged.filter(hasTrustedCitation);

  // Score and filter by topic relevance
  const isCitationLookup = intent.type === "citation-lookup";
  const scoreFn = isCitationLookup ? scoreCaseLawRowForCitationLookup : scoreCaseLawRow;

  const minScore = isCitationLookup
    ? 0
    : intent.topics.length > 0
      ? Math.min(...intent.topics.map((t) => t.minRelevanceScore))
      : 10;

  const scored = withCitation
    .map((row) => ({ row, relevanceScore: scoreFn(row, intent) }))
    .filter((item) => item.relevanceScore >= minScore)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  return scored.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Statute retrieval
// ---------------------------------------------------------------------------

async function fetchStatutes(intent: QueryIntent, limit: number): Promise<RetrievedStatute[]> {
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
  const caseLawLimit = limits.caseLaw ?? 6;
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
      caseLawAfterFilter: caseLawResults.filter((r) => r.relevanceScore > 0).length,
      statutesFetched: statuteResults.length,
      adminDocsFetched: adminDocResults.length,
      strategyUsed: intent.type,
      topicsMatched: intent.topics.map((t) => t.label),
      durationMs,
    },
  };
}
