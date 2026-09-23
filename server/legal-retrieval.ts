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

import { runRetrieval } from "./pipeline/retrieval-engine";
import { classifyQueryIntent, analyzeQueryExplicitness } from "./pipeline/intent-classifier";
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

// MCP, the ChatGPT REST bridge and MCP petition drafting used to run their own
// retrieval here: keyword search plus admin-case-law vectors only (3k of the
// 5.9M chunks), re-sorted by a keyword heuristic that discarded the vector
// score, with no reranker, while the tool description promised the website's
// pipeline. They now run the website's case-law retrieval (judgments FTS,
// case_law FTS, hybrid vector search, RRF, Voyage rerank, text-provenance
// filtering). Callers keep their own verification on top.
export async function retrieveLegalCaseLaw(opts: LegalRetrievalOptions): Promise<LegalRetrievalResult> {
  const limit = opts.limit ?? 6;
  const query = String(opts.query || "").trim();
  if (!query) {
    return { rows: [], topicsDetected: [], retrievalStrategy: "no-results" };
  }

  const intent = classifyQueryIntent(query);
  intent.tier = analyzeQueryExplicitness(query, intent);
  intent.needsCaseLaw = true;
  intent.needsStatutes = false;
  intent.needsAdminDocs = false;

  const retrieval = await runRetrieval(intent, opts.userId || "", { caseLaw: Math.max(limit, 10) });
  const rows = retrieval.caseLaw.slice(0, limit).map((c) => c.row);
  const topicsDetected = (intent.topics || []).map((t: any) => String(t.label || t.id || ""));

  return {
    rows,
    topicsDetected,
    retrievalStrategy: intent.type === "citation-lookup"
      ? "citation-lookup"
      : rows.length > 0 ? "topic-matched" : "no-results",
  };
}
