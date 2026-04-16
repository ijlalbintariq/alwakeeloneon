/**
 * Intent Classifier
 *
 * Responsibility: Understand what the user is asking for.
 *
 * Input  : raw query string
 * Output : QueryIntent — a structured description of what retrieval is needed
 *
 * Design rules:
 *  - Pure function: no I/O, no side effects
 *  - Deterministic: same query always produces same output
 *  - Fast: runs in <1ms (no LLM call, no DB access)
 *  - Conservative: when uncertain, over-retrieve rather than under-retrieve
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntentType =
  | "case-law"       // user wants specific case citations / precedents
  | "statute"        // user wants statute / section text
  | "general-legal"  // legal explanation — may benefit from both case-law + statutes
  | "citation-lookup"; // user is looking up a specific citation by its PLD/SCMR/YLR string

export interface LegalTopic {
  id: string;
  label: string;
  /** Terms whose presence in the query immediately signals this topic */
  primary: string[];
  /** Synonyms, PPC section refs, related terms used to widen retrieval */
  synonyms: string[];
  /** Minimum relevance score (0-100) a retrieved record must meet */
  minRelevanceScore: number;
}

export interface QueryIntent {
  raw: string;
  normalized: string;
  type: IntentType;
  /** Detected topics, ordered by confidence */
  topics: LegalTopic[];
  /** The query terms expanded with legal synonyms — used as the retrieval query */
  expandedQuery: string;
  /** Individual expanded terms (for scoring retrieved results) */
  expandedTerms: string[];
  /** Whether to run case-law retrieval */
  needsCaseLaw: boolean;
  /** Whether to run statute retrieval */
  needsStatutes: boolean;
  /** Whether to run admin-knowledge retrieval */
  needsAdminDocs: boolean;
}

// ---------------------------------------------------------------------------
// Legal Topic Taxonomy (Pakistan)
// ---------------------------------------------------------------------------

export const LEGAL_TOPICS: LegalTopic[] = [
  {
    id: "robbery",
    label: "Robbery / Dacoity / Snatching",
    primary: ["robbery", "dacoity", "snatching", "dacoit", "loot"],
    synonyms: ["ppc 392", "ppc 393", "ppc 394", "ppc 395", "ppc 396", "ppc 397", "ppc 399", "armed robbery", "street crime", "mobile snatching", "vehicle snatching", "daku", "theft with force", "violent theft"],
    minRelevanceScore: 22,
  },
  {
    id: "murder",
    label: "Murder / Qatl / Homicide",
    primary: ["murder", "homicide", "qatl", "killing", "qisas", "diyat"],
    synonyms: ["ppc 302", "ppc 299", "ppc 300", "ppc 301", "ppc 303", "culpable homicide", "death penalty", "intentional killing", "qatl-i-amd", "manslaughter", "capital punishment"],
    minRelevanceScore: 22,
  },
  {
    id: "bail",
    label: "Bail",
    primary: ["bail", "pre-arrest bail", "post-arrest bail", "anticipatory bail"],
    synonyms: ["crpc 497", "crpc 498", "bail application", "bailable", "non-bailable", "surety", "pre-arrest", "post-arrest", "ad-interim bail", "transit bail", "protective bail", "grant of bail", "bail cancellation"],
    minRelevanceScore: 28,
  },
  {
    id: "cheque",
    label: "Cheque Dishonour",
    primary: ["cheque", "dishonour", "dishonored", "bounced", "489-f", "489f"],
    synonyms: ["cheque bounce", "post-dated cheque", "negotiable instrument", "ppc 489", "banking instrument", "bank cheque"],
    minRelevanceScore: 28,
  },
  {
    id: "corruption",
    label: "Corruption / NAB / Accountability",
    primary: ["corruption", "nab", "accountability", "corrupt", "bribery", "kickback", "embezzlement"],
    synonyms: ["national accountability bureau", "accountability court", "misuse of authority", "assets beyond means", "benami", "gratification", "pecuniary advantage", "public servant", "misappropriation", "corruption of public official"],
    minRelevanceScore: 22,
  },
  {
    id: "contract",
    label: "Contract / Breach / Specific Performance",
    primary: ["contract", "agreement", "breach", "specific performance"],
    synonyms: ["consideration", "offer and acceptance", "contract act", "damages", "indemnity", "guarantee", "void agreement", "voidable", "specific relief", "contractual obligation", "breach of contract"],
    minRelevanceScore: 22,
  },
  {
    id: "family",
    label: "Family Law / Divorce / Custody",
    primary: ["divorce", "khula", "talaq", "custody", "maintenance", "dower", "haq mehr", "guardian", "marriage"],
    synonyms: ["family court", "mflo", "muslim family laws", "guardians and wards", "minor welfare", "hizanat", "iddat", "mehr", "dissolution of marriage", "family courts act", "matrimonial"],
    minRelevanceScore: 22,
  },
  {
    id: "property",
    label: "Property / Inheritance / Land",
    primary: ["property", "inheritance", "succession", "mutation", "trespass", "ownership", "possession", "land"],
    synonyms: ["transfer of property", "sale deed", "gift deed", "waqf", "easement", "partition", "co-sharer", "title dispute", "adverse possession", "tenancy", "revenue record"],
    minRelevanceScore: 18,
  },
  {
    id: "fraud",
    label: "Fraud / Cheating / Forgery",
    primary: ["fraud", "cheating", "forgery", "deceit", "misrepresentation"],
    synonyms: ["ppc 420", "ppc 463", "ppc 465", "ppc 468", "false documents", "counterfeit", "impersonation", "fabrication"],
    minRelevanceScore: 22,
  },
  {
    id: "kidnapping",
    label: "Kidnapping / Abduction",
    primary: ["kidnapping", "abduction", "ransom", "kidnap"],
    synonyms: ["ppc 363", "ppc 364", "ppc 365", "ppc 366", "ppc 367", "wrongful confinement", "human trafficking", "abduction for ransom"],
    minRelevanceScore: 22,
  },
  {
    id: "rape-sexual",
    label: "Rape / Sexual Assault / Harassment",
    primary: ["rape", "sexual assault", "zina", "harassment", "molestation"],
    synonyms: ["ppc 375", "ppc 376", "outrage of modesty", "zina-bil-jabr", "protection of women", "harassment act", "sexual harassment"],
    minRelevanceScore: 22,
  },
  {
    id: "constitutional",
    label: "Constitutional / Writ / Fundamental Rights",
    primary: ["writ", "habeas corpus", "mandamus", "certiorari", "constitution", "fundamental rights", "article 199"],
    synonyms: ["constitutional petition", "quo warranto", "high court", "supreme court", "basic rights", "writ petition"],
    minRelevanceScore: 18,
  },
  {
    id: "fir",
    label: "FIR / Police / Registration",
    primary: ["fir", "first information report", "police", "22-a"],
    synonyms: ["crpc 154", "crpc 155", "justice of peace", "registration of fir", "police station", "lodging fir", "complaint"],
    minRelevanceScore: 22,
  },
  {
    id: "tax",
    label: "Tax / Revenue",
    primary: ["tax", "income tax", "sales tax", "customs"],
    synonyms: ["fbr", "tribunal", "withholding tax", "income tax ordinance", "sales tax act", "duty"],
    minRelevanceScore: 22,
  },
  {
    id: "labor",
    label: "Labour / Employment / Service",
    primary: ["employment", "labor", "labour", "service", "dismissal", "termination", "worker"],
    synonyms: ["reinstatement", "provident fund", "eobi", "industrial relations", "factories act", "workman", "wrongful termination"],
    minRelevanceScore: 18,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CITATION_PATTERN = /\b(pld|scmr|ylr|mld|clc|plj|nlr|pcrlj|ptcl|ptd)\s+\d{4}\b/i;

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Main classifier
// ---------------------------------------------------------------------------

export function classifyQueryIntent(rawQuery: string): QueryIntent {
  const raw = rawQuery.trim();
  const normalized = norm(raw);
  const words = normalized.split(/\s+/);

  // --- Citation lookup? ---
  if (CITATION_PATTERN.test(normalized)) {
    return {
      raw,
      normalized,
      type: "citation-lookup",
      topics: [],
      expandedQuery: normalized,
      expandedTerms: words,
      needsCaseLaw: true,
      needsStatutes: false,
      needsAdminDocs: false,
    };
  }

  // --- Score each topic ---
  type ScoredTopic = { topic: LegalTopic; score: number };
  const scored: ScoredTopic[] = [];

  for (const topic of LEGAL_TOPICS) {
    let score = 0;
    // Primary term hit — strong signal
    for (const term of topic.primary) {
      if (normalized.includes(term)) score += 12;
    }
    // Synonym hit — weaker signal
    for (const term of topic.synonyms) {
      if (normalized.includes(term)) score += 4;
    }
    // Partial word match against primary terms
    for (const word of words) {
      if (word.length < 3) continue;
      for (const term of topic.primary) {
        if (term !== word && (term.includes(word) || word.includes(term))) score += 2;
      }
    }
    if (score > 0) scored.push({ topic, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const topTopics = scored.slice(0, 3).map((s) => s.topic);

  // --- Build expanded query ---
  const termSet = new Set<string>([normalized]);
  // Add top 2 topics' synonyms (first 6 each)
  for (const { topic } of scored.slice(0, 2)) {
    for (const t of topic.synonyms.slice(0, 6)) termSet.add(t);
    for (const t of topic.primary) termSet.add(t);
  }
  const expandedTerms = Array.from(termSet);
  const expandedQuery = expandedTerms.slice(0, 5).join(" ");

  // --- Detect intent type ---
  const statuteIndicators = ["section", "act", "ordinance", "ppc", "crpc", "statute", "provision", "law", "code"];
  const caseIndicators = ["case", "judgment", "precedent", "ruling", "court held", "citation", "appeal", "conviction"];
  let statuteScore = 0;
  let caseScore = 0;
  for (const word of words) {
    if (statuteIndicators.includes(word)) statuteScore++;
    if (caseIndicators.includes(word)) caseScore++;
  }

  let type: IntentType;
  if (caseScore > statuteScore) {
    type = "case-law";
  } else if (statuteScore > caseScore) {
    type = "statute";
  } else {
    type = "general-legal"; // retrieve both
  }

  return {
    raw,
    normalized,
    type,
    topics: topTopics,
    expandedQuery,
    expandedTerms,
    needsCaseLaw: type !== "statute",
    needsStatutes: type !== "case-law",
    needsAdminDocs: true,
  };
}
