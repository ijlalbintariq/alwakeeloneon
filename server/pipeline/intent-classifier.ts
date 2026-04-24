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
  /** Detected statute reference (e.g. PPC 392), if present */
  statuteRef?: StatuteRef;
}

// ---------------------------------------------------------------------------
// Statute Abbreviation Map (Pakistan)
// ---------------------------------------------------------------------------

export interface StatuteRef {
  /** Short abbreviation as typed by the user, e.g. "PPC" */
  abbr: string;
  /** Full statutory name */
  fullName: string;
  /** Section or article number extracted from query, e.g. "392" */
  sectionOrArticle: string;
}

export const STATUTE_ABBREVIATION_MAP: Record<string, string> = {
  // Criminal law
  ppc: "Pakistan Penal Code",
  crpc: "Code of Criminal Procedure",
  cpc: "Code of Civil Procedure",
  // Evidence
  qso: "Qanun-e-Shahadat Order 1984",
  qe: "Qanun-e-Shahadat Order 1984",
  // Constitution
  constitution: "Constitution of Pakistan 1973",
  "constitution of pakistan": "Constitution of Pakistan 1973",
  // Family
  mflo: "Muslim Family Laws Ordinance 1961",
  gwa: "Guardians and Wards Act 1890",
  fca: "Family Courts Act 1964",
  // Terrorism / accountability
  ata: "Anti-Terrorism Act 1997",
  nao: "National Accountability Ordinance 1999",
  poca: "Prevention of Corruption Act 1947",
  // Narcotics
  cnsa: "Control of Narcotic Substances Act 1997",
  // Cybercrime
  peca: "Prevention of Electronic Crimes Act 2016",
  // Immigration / passports
  fia: "Federal Investigation Agency Act 1974",
  // Property / land
  tpa: "Transfer of Property Act 1882",
  ra: "Registration Act 1908",
  // Tax
  ito: "Income Tax Ordinance 2001",
  sta: "Sales Tax Act 1990",
  // Labor
  ira: "Industrial Relations Act 2012",
  // Corporate
  ca: "Companies Act 2017",
  // Financial
  fcra: "Foreign Contributions Regulation Act",
  // Arms
  aa: "Arms Act 1878",
  // Other common ones
  mvoa: "Motor Vehicles Ordinance 1965",
  pa: "Partnership Act 1932",
};

/**
 * Detect statute references like "PPC 392", "Section 302 PPC", "Article 25 Constitution",
 * "CrPC 497", "section 489-F PPC".
 * Returns null if no statute reference is found.
 */
export function detectStatuteRef(query: string): StatuteRef | null {
  const q = query.toLowerCase().replace(/[^a-z0-9\s\-]/g, " ").replace(/\s+/g, " ").trim();

  // Pattern: ABBR <section> — e.g. "ppc 392", "crpc 497", "peca 20"
  const abbrFirst = /\b(ppc|crpc|cpc|qso|qe|mflo|gwa|fca|ata|nao|poca|cnsa|peca|fia|tpa|ra|ito|sta|ira|ca|aa|mvoa|pa)\s+(\d[\d\-a-z]*)\b/i.exec(q);
  if (abbrFirst) {
    const abbr = abbrFirst[1].toLowerCase();
    const fullName = STATUTE_ABBREVIATION_MAP[abbr];
    if (fullName) return { abbr: abbrFirst[1].toUpperCase(), fullName, sectionOrArticle: abbrFirst[2] };
  }

  // Pattern: section/article <num> ABBR — e.g. "section 302 ppc", "article 25 constitution"
  const sectionFirst = /\b(?:section|s\.|art(?:icle)?\.?)\s+(\d[\d\-a-z]*)\s+(?:of\s+)?([a-z\s]+)/i.exec(q);
  if (sectionFirst) {
    const sectionNum = sectionFirst[1];
    const afterSection = sectionFirst[2].trim().split(/\s+/);
    for (const word of afterSection) {
      const abbr = word.toLowerCase();
      const fullName = STATUTE_ABBREVIATION_MAP[abbr];
      if (fullName) return { abbr: word.toUpperCase(), fullName, sectionOrArticle: sectionNum };
    }
    // Also check multi-word like "constitution of pakistan"
    const tail = sectionFirst[2].trim();
    const fullName = STATUTE_ABBREVIATION_MAP[tail.toLowerCase()];
    if (fullName) return { abbr: tail, fullName, sectionOrArticle: sectionNum };
  }

  // Pattern: "Article 25 Constitution" (article first)
  const articleFirst = /\barticle\s+(\d[\d\-a-z]*)\s+(?:of\s+)?(?:the\s+)?([a-z\s]+)/i.exec(q);
  if (articleFirst) {
    const sectionNum = articleFirst[1];
    const tail = articleFirst[2].trim().split(/\s+/)[0].toLowerCase();
    const fullName = STATUTE_ABBREVIATION_MAP[tail];
    if (fullName) return { abbr: tail.toUpperCase(), fullName, sectionOrArticle: sectionNum };
    // Try longer match
    const longTail = articleFirst[2].trim().toLowerCase();
    const fullName2 = STATUTE_ABBREVIATION_MAP[longTail];
    if (fullName2) return { abbr: longTail, fullName: fullName2, sectionOrArticle: sectionNum };
  }

  return null;
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

// Matches both report-style citations (1970 SCMR 869) AND case numbers (C.A. 8-Q of 2017)
const CITATION_PATTERN = /\b(?:pld|scmr|ylr|mld|clc|plj|nlr|pcrlj|ptcl|ptd|lhc|ihc|shc|phc|bhc)\s+\d{4}|(?:19|20)\d{2}\s+(?:pld|scmr|ylr|mld|clc|plj|nlr|pcrlj|ptcl|ptd)\b|\bc\.?a\.?\s+\d+[\w\-]*\s+of\s+(?:19|20)\d{2}\b|\b(?:civil|criminal)\s+(?:appeal|petition)\s+(?:no\.?\s*)?\d+[\w\-]*\s+of\s+(?:19|20)\d{2}\b|\bwrit\s+petition\s+(?:no\.?\s*)?\d+[\w\-]*\s+of\s+(?:19|20)\d{2}\b|\br\.?p\.?a\.?\s+\d+[\w\-]*\s+of\s+(?:19|20)\d{2}\b/i;

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

  // --- Statute section reference? (e.g. "PPC 392", "Article 25 Constitution") ---
  const statuteRef = detectStatuteRef(raw);
  if (statuteRef) {
    const expandedStat = `${statuteRef.fullName} section ${statuteRef.sectionOrArticle} ${normalized}`;
    return {
      raw,
      normalized,
      type: "general-legal",  // Not "statute" — users asking about a section also want case law on it
      topics: [],
      expandedQuery: expandedStat,
      expandedTerms: expandedStat.split(/\s+/),
      needsCaseLaw: true,   // Always fetch case law — rulings on this section are valuable
      needsStatutes: true,
      needsAdminDocs: false,
      statuteRef,
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
  // 15 terms: the DB splits these into individual tokens for ILIKE matching (storage.ts queryTokens).
  // 5 was too few — topic synonyms were truncated, missing key retrieval terms.
  const expandedQuery = expandedTerms.slice(0, 15).join(" ");

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
    // If any legal topics were detected, ALWAYS fetch case law — the classifier's
    // statute/case-law split is imperfect. Queries like "what PPC sections apply to murder"
    // score higher on statute indicators but the user wants relevant judgments too.
    needsCaseLaw: type !== "statute" || topTopics.length > 0,
    // Similarly, always fetch statutes when topics are present — most legal questions
    // benefit from seeing both the law text and the case law applying it.
    needsStatutes: type !== "case-law" || topTopics.length > 0,
    needsAdminDocs: true,
  };
}
