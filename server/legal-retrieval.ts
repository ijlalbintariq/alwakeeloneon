/**
 * Legal Retrieval Engine v2
 *
 * Architecture:
 *   1. Query Understanding  — classify legal topic, expand synonyms
 *   2. Hybrid Retrieval     — keyword (BM25-style) + vector (RAG) search
 *   3. Semantic Re-ranking  — score each candidate against the expanded query topic
 *   4. Strict Filtering     — discard candidates below relevance threshold
 *
 * Design contract:
 *   - Returns ONLY results that are topically relevant to the query.
 *   - Returns an empty array rather than unrelated results.
 *   - Never falls back to "recent case law" (which introduces random, irrelevant cases).
 *   - Every returned record MUST have a non-empty `citation` field.
 */

import { storage } from "./storage";
import { retrieveForQuery } from "./rag/rag-service";
import type { CaseLaw } from "../shared/schema";

// ---------------------------------------------------------------------------
// 1. Legal Topic Taxonomy
// ---------------------------------------------------------------------------

interface LegalTopic {
  /** Short identifier for the topic */
  id: string;
  /** Display name */
  label: string;
  /**
   * Primary terms: direct query terms that map to this topic.
   * A query containing ANY of these is classified as this topic.
   */
  primary: string[];
  /**
   * Expansion terms: synonyms, related legal terms, PPC/statute refs.
   * Used to widen the search and to validate retrieved results.
   */
  expand: string[];
  /** Minimum relevance score (0-100) for a result to be included */
  minRelevanceScore: number;
}

const LEGAL_TOPICS: LegalTopic[] = [
  {
    id: "robbery",
    label: "Robbery / Dacoity / Snatching",
    primary: ["robbery", "dacoity", "snatching", "dacoit", "loot", "looting"],
    expand: ["robbery", "dacoity", "snatching", "ppc 392", "ppc 393", "ppc 394", "ppc 395", "ppc 396", "ppc 397", "ppc 398", "ppc 399", "theft with force", "armed robbery", "street crime", "mobile snatching", "vehicle snatching", "daku", "dacoit"],
    minRelevanceScore: 25,
  },
  {
    id: "murder",
    label: "Murder / Homicide / Qatl",
    primary: ["murder", "homicide", "qatl", "killing", "killed", "qisas", "diyat"],
    expand: ["murder", "homicide", "qatl", "ppc 302", "ppc 299", "ppc 300", "ppc 301", "ppc 303", "culpable homicide", "death penalty", "capital punishment", "intentional killing", "qatl-i-amd", "qatl-i-khata", "manslaughter"],
    minRelevanceScore: 25,
  },
  {
    id: "bail",
    label: "Bail",
    primary: ["bail", "pre-arrest bail", "post-arrest bail", "anticipatory bail"],
    expand: ["bail", "crpc 497", "crpc 498", "bail application", "bailable offence", "non-bailable", "surety", "pre-arrest", "post-arrest", "ad-interim bail", "transit bail", "protective bail", "grant of bail", "cancellation of bail"],
    minRelevanceScore: 30,
  },
  {
    id: "cheque",
    label: "Cheque Dishonour / Banking",
    primary: ["cheque", "check", "dishonour", "dishonored", "bounced", "489-f", "489f"],
    expand: ["cheque dishonour", "489-f", "dishonoured cheque", "bank cheque", "post-dated cheque", "cheque bounce", "negotiable instrument", "banking", "financial instrument"],
    minRelevanceScore: 30,
  },
  {
    id: "corruption",
    label: "Corruption / Accountability / NAB",
    primary: ["corruption", "nab", "accountability", "corrupt", "bribery", "kickback", "embezzlement"],
    expand: ["corruption", "nab", "national accountability bureau", "accountability court", "bribery", "misuse of authority", "assets beyond means", "benami", "gratification", "pecuniary advantage", "public servant", "misappropriation"],
    minRelevanceScore: 25,
  },
  {
    id: "contract",
    label: "Contract / Agreement / Breach",
    primary: ["contract", "agreement", "breach", "specific performance", "consideration"],
    expand: ["contract", "agreement", "breach of contract", "specific performance", "consideration", "offer and acceptance", "contract act", "damages", "indemnity", "guarantee", "void agreement", "voidable contract", "specific relief act"],
    minRelevanceScore: 25,
  },
  {
    id: "family",
    label: "Family Law / Divorce / Custody",
    primary: ["divorce", "khula", "talaq", "custody", "maintenance", "dower", "haq mehr", "guardian"],
    expand: ["divorce", "khula", "talaq", "custody", "maintenance", "haq mehr", "dower", "guardian", "guardianship", "family court", "family courts act", "muslim family laws ordinance", "mflo", "mehr", "iddat", "guardians and wards act", "minor welfare", "hizanat"],
    minRelevanceScore: 25,
  },
  {
    id: "property",
    label: "Property / Inheritance / Land",
    primary: ["property", "inheritance", "succession", "mutation", "trespass", "ownership", "title", "possession", "land"],
    expand: ["property", "inheritance", "succession", "mutation", "trespass", "ownership", "title", "possession", "land", "transfer of property", "sale deed", "gift deed", "will", "waqf", "easement", "partition", "shareholder", "co-sharer"],
    minRelevanceScore: 20,
  },
  {
    id: "fraud",
    label: "Fraud / Cheating / Forgery",
    primary: ["fraud", "cheating", "forgery", "deceit", "misrepresentation", "420"],
    expand: ["fraud", "cheating", "forgery", "deceit", "misrepresentation", "ppc 420", "ppc 463", "ppc 464", "ppc 465", "ppc 468", "false documents", "counterfeit", "impersonation"],
    minRelevanceScore: 25,
  },
  {
    id: "kidnapping",
    label: "Kidnapping / Abduction",
    primary: ["kidnapping", "abduction", "ransom", "kidnap", "abduct"],
    expand: ["kidnapping", "abduction", "ransom", "ppc 363", "ppc 364", "ppc 365", "ppc 366", "ppc 367", "ppc 368", "wrongful confinement", "human trafficking"],
    minRelevanceScore: 25,
  },
  {
    id: "rape",
    label: "Rape / Sexual Assault / Zina",
    primary: ["rape", "sexual assault", "zina", "molestation", "sexual harassment", "harassment"],
    expand: ["rape", "sexual assault", "zina", "ppc 375", "ppc 376", "outrage of modesty", "sexual harassment", "zina-bil-jabr", "molestation", "protection of women act", "protection against harassment act"],
    minRelevanceScore: 25,
  },
  {
    id: "writ",
    label: "Constitutional / Writ Petitions",
    primary: ["writ", "habeas corpus", "mandamus", "certiorari", "quo warranto", "constitution", "fundamental rights", "article 199"],
    expand: ["writ petition", "habeas corpus", "mandamus", "certiorari", "article 199", "high court", "supreme court", "fundamental rights", "constitutional petition", "quo warranto"],
    minRelevanceScore: 20,
  },
  {
    id: "fir",
    label: "FIR / Registration / Police",
    primary: ["fir", "first information report", "registration of fir", "police", "22-a"],
    expand: ["fir", "first information report", "22-a", "justice of peace", "police station", "registration", "crpc 154", "crpc 155", "lodging fir"],
    minRelevanceScore: 25,
  },
  {
    id: "tax",
    label: "Tax / Revenue / Customs",
    primary: ["tax", "income tax", "sales tax", "customs", "revenue"],
    expand: ["tax", "income tax", "sales tax", "customs", "revenue", "income tax ordinance", "fbr", "tribunal", "withholding tax", "vat"],
    minRelevanceScore: 25,
  },
  {
    id: "labor",
    label: "Labor / Employment / Service",
    primary: ["employment", "labor", "labour", "service", "dismissal", "termination", "workman", "worker"],
    expand: ["employment", "labor law", "labour law", "service law", "dismissal", "termination", "reinstatement", "provident fund", "eobi", "industrial relations", "factories act", "workman compensation"],
    minRelevanceScore: 20,
  },
];

// ---------------------------------------------------------------------------
// 2. Query Understanding
// ---------------------------------------------------------------------------

export interface LegalQueryAnalysis {
  /** Detected legal topics (ordered by confidence) */
  topics: LegalTopic[];
  /** Expanded query string for search */
  expandedTerms: string[];
  /** Whether the query is a direct citation lookup */
  isCitationLookup: boolean;
}

function normQ(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s\-]/g, " ").replace(/\s+/g, " ").trim();
}

export function analyzeLegalQuery(query: string): LegalQueryAnalysis {
  const q = normQ(query);
  const words = q.split(/\s+/);

  // Citation pattern detection
  const citationPattern = /\b(pld|scmr|ylr|mld|clc|plj|nlr|pcrlj)\s+\d{4}\b/i;
  const isCitationLookup = citationPattern.test(q);

  // Score each topic
  const scored: Array<{ topic: LegalTopic; score: number }> = [];
  for (const topic of LEGAL_TOPICS) {
    let score = 0;
    for (const term of topic.primary) {
      if (q.includes(term)) score += 10;
    }
    for (const term of topic.expand) {
      if (q.includes(term)) score += 3;
    }
    // Partial word match
    for (const word of words) {
      if (word.length < 3) continue;
      for (const term of topic.primary) {
        if (term.includes(word) || word.includes(term)) score += 2;
      }
    }
    if (score > 0) scored.push({ topic, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const topics = scored.slice(0, 3).map((s) => s.topic);

  // Build expanded terms
  const expandedTerms: string[] = [q];
  for (const { topic } of scored.slice(0, 2)) {
    expandedTerms.push(...topic.expand.slice(0, 6));
  }
  // Deduplicate
  const seen = new Set<string>();
  const uniqueTerms = expandedTerms.filter((t) => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });

  return { topics, expandedTerms: uniqueTerms, isCitationLookup };
}

// ---------------------------------------------------------------------------
// 3. Relevance Scoring
// ---------------------------------------------------------------------------

function scoreCaseLawRelevance(row: CaseLaw, analysis: LegalQueryAnalysis): number {
  const titleL = normQ(String(row.title || ""));
  const summaryL = normQ(String(row.summary || ""));
  const keywordsL = (row.keywords || []).map((k) => normQ(k)).join(" ");
  const citationL = normQ(String(row.citation || ""));
  const combined = `${titleL} ${summaryL} ${keywordsL} ${citationL}`;

  let score = 0;

  // Check against each topic's primary + expand terms
  for (const topic of analysis.topics) {
    for (const term of topic.primary) {
      if (combined.includes(term)) score += 20;
      if (titleL.includes(term)) score += 15;
    }
    for (const term of topic.expand) {
      if (combined.includes(term)) score += 5;
      if (titleL.includes(term)) score += 5;
    }
  }

  // Check against expanded query terms directly
  const originalTerms = normQ(analysis.expandedTerms[0] || "").split(/\s+/).filter((t) => t.length >= 3);
  for (const term of originalTerms) {
    if (titleL.includes(term)) score += 10;
    if (summaryL.includes(term)) score += 6;
    if (keywordsL.includes(term)) score += 8;
  }

  return score;
}

function hasCitationTrust(row: CaseLaw): boolean {
  const citation = String(row.citation || "").trim();
  if (!citation) return false;
  // Must match standard Pakistani legal citation format
  const pattern = /\b(pld|scmr|ylr|mld|clc|plj|nlr|pcrlj|ptcl|ptd|plc|psc|ald|klr|sls|gblr|cld|tax|air|lhc|ihc|shc|phc|bhc|ajkhc)\b/i;
  return pattern.test(citation) && /\b(19|20)\d{2}\b/.test(citation);
}

// ---------------------------------------------------------------------------
// 4. Main Retrieval Function
// ---------------------------------------------------------------------------

export interface LegalRetrievalOptions {
  userId: string;
  query: string;
  limit?: number;
  /** Skip semantic validation (use only for direct citation lookups) */
  skipTopicFilter?: boolean;
}

export interface LegalRetrievalResult {
  rows: CaseLaw[];
  topicsDetected: string[];
  retrievalStrategy: "topic-matched" | "citation-lookup" | "no-results";
}

export async function retrieveLegalCaseLaw(opts: LegalRetrievalOptions): Promise<LegalRetrievalResult> {
  const limit = opts.limit ?? 6;
  const query = String(opts.query || "").trim();
  if (!query) {
    return { rows: [], topicsDetected: [], retrievalStrategy: "no-results" };
  }

  const analysis = analyzeLegalQuery(query);
  const topicsDetected = analysis.topics.map((t) => t.label);

  // ---- A. Keyword search with expanded terms ----
  const expandedQuery = analysis.expandedTerms.slice(0, 4).join(" ");
  const keywordResultsPromise = storage.searchCaseLaw(expandedQuery || query, limit * 3, {
    sort: "relevance",
    includeSourceContentSearch: false,
  });

  // ---- B. RAG vector search ----
  const ragResultsPromise = opts.userId
    ? (async (): Promise<CaseLaw[]> => {
        try {
          const retrieval = await retrieveForQuery({
            userId: opts.userId,
            query: expandedQuery || query,
            topK: limit * 5,
          });

          const sourceDocIds: number[] = [];
          const seen = new Set<number>();
          for (const match of retrieval.matches) {
            const sourceType = String((match.metadata || {}).sourceType || "").toLowerCase();
            if (sourceType !== "admin-case-law") continue;
            const docId = Number(match.sourceDocumentId);
            if (!Number.isInteger(docId) || docId <= 0 || seen.has(docId)) continue;
            seen.add(docId);
            sourceDocIds.push(docId);
            if (sourceDocIds.length >= limit * 4) break;
          }

          if (sourceDocIds.length === 0) return [];
          return storage.getCaseLawBySourceDocuments(sourceDocIds, "admin");
        } catch {
          return [];
        }
      })()
    : Promise.resolve([]);

  const [keywordRaw, ragRaw] = await Promise.all([keywordResultsPromise, ragResultsPromise]);

  // ---- C. Merge and deduplicate ----
  const seen = new Set<string>();
  const merged: CaseLaw[] = [];
  for (const row of [...keywordRaw, ...ragRaw]) {
    const key = `${normQ(String(row.citation || ""))}_${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }

  // ---- D. Filter: must have valid citation, and filter out "Statute Reference" junk entries ----
  const withCitation = merged.filter((row) => {
    if (!hasCitationTrust(row)) return false;
    const court = String(row.court || "").toLowerCase().trim();
    const title = String(row.title || "").toLowerCase().trim();
    if (court === "statute reference") return false;
    if (title.startsWith("statute reference")) return false;
    return true;
  });

  // ---- E. Semantic topic validation ----
  // For citation lookups, skip topic filter
  if (analysis.isCitationLookup || opts.skipTopicFilter) {
    const sorted = withCitation
      .map((row) => ({ row, score: scoreCaseLawRelevance(row, analysis) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.row);
    return {
      rows: sorted,
      topicsDetected,
      retrievalStrategy: "citation-lookup",
    };
  }

  // If no topics detected, do a lighter relevance filter (any match)
  const minScore = analysis.topics.length > 0
    ? Math.max(...analysis.topics.map((t) => t.minRelevanceScore))
    : 10;

  const scored = withCitation
    .map((row) => ({ row, score: scoreCaseLawRelevance(row, analysis) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score);

  const topResults = scored.slice(0, limit).map((x) => x.row);

  if (topResults.length === 0) {
    return { rows: [], topicsDetected, retrievalStrategy: "no-results" };
  }

  return {
    rows: topResults,
    topicsDetected,
    retrievalStrategy: "topic-matched",
  };
}
