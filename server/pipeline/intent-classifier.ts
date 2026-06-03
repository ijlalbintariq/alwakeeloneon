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
  // =========================================================================
  // EXISTING TOPICS (16) — expanded with additional synonyms
  // =========================================================================
  {
    id: "robbery",
    label: "Robbery / Dacoity / Snatching",
    primary: ["robbery", "dacoity", "snatching", "dacoit", "loot"],
    synonyms: ["ppc 392", "ppc 393", "ppc 394", "ppc 395", "ppc 396", "ppc 397", "ppc 399", "armed robbery", "street crime", "mobile snatching", "vehicle snatching", "daku", "theft with force", "violent theft", "attempt to rob", "gang robbery", "highway robbery", "carjacking"],
    minRelevanceScore: 22,
  },
  {
    id: "murder",
    label: "Murder / Qatl / Homicide",
    primary: ["murder", "homicide", "qatl", "killing", "qisas", "diyat"],
    synonyms: ["ppc 302", "ppc 299", "ppc 300", "ppc 301", "ppc 303", "culpable homicide", "death penalty", "intentional killing", "qatl-i-amd", "manslaughter", "capital punishment", "qatl-i-khata", "qatl-bis-sabab", "fasad-fil-arz", "hurt leading to death", "attempt to murder", "ppc 324", "ppc 304"],
    minRelevanceScore: 22,
  },
  {
    id: "bail",
    label: "Bail",
    primary: ["bail", "pre-arrest bail", "post-arrest bail", "anticipatory bail"],
    synonyms: ["crpc 497", "crpc 498", "bail application", "bailable", "non-bailable", "surety", "pre-arrest", "post-arrest", "ad-interim bail", "transit bail", "protective bail", "grant of bail", "bail cancellation", "interim bail", "confirmation of bail", "bail bond", "personal bond", "section 426", "section 561-a", "inherent powers"],
    minRelevanceScore: 28,
  },
  {
    id: "cheque",
    label: "Cheque Dishonour",
    primary: ["cheque", "dishonour", "dishonored", "bounced", "489-f", "489f"],
    synonyms: ["cheque bounce", "post-dated cheque", "negotiable instrument", "ppc 489", "banking instrument", "bank cheque", "negotiable instruments act", "holder in due course", "endorsement", "blank cheque", "account payee"],
    minRelevanceScore: 28,
  },
  {
    id: "corruption",
    label: "Corruption / NAB / Accountability",
    primary: ["corruption", "nab", "accountability", "corrupt", "bribery", "kickback", "embezzlement"],
    synonyms: ["national accountability bureau", "accountability court", "misuse of authority", "assets beyond means", "benami", "gratification", "pecuniary advantage", "public servant", "misappropriation", "corruption of public official", "plea bargain", "voluntary return", "nab reference", "investigation officer", "assets declaration"],
    minRelevanceScore: 22,
  },
  {
    id: "contract",
    label: "Contract / Breach / Specific Performance",
    primary: ["contract", "agreement", "breach", "specific performance"],
    synonyms: ["consideration", "offer and acceptance", "contract act", "damages", "indemnity", "guarantee", "void agreement", "voidable", "specific relief", "contractual obligation", "breach of contract", "arbitration clause", "force majeure", "liquidated damages", "stamp paper", "notarized", "privity"],
    minRelevanceScore: 22,
  },
  {
    id: "family",
    label: "Family Law / Divorce / Custody",
    primary: ["divorce", "khula", "talaq", "custody", "maintenance", "dower", "haq mehr", "guardian", "marriage"],
    synonyms: ["family court", "mflo", "muslim family laws", "guardians and wards", "minor welfare", "hizanat", "iddat", "mehr", "dissolution of marriage", "family courts act", "matrimonial", "nikah", "rukhsati", "baraat", "nafaqa", "jactitation", "restitution of conjugal rights", "dowry", "jahez", "child support", "visitation", "guardianship"],
    minRelevanceScore: 22,
  },
  {
    id: "property",
    label: "Property / Inheritance / Land",
    primary: ["property", "inheritance", "succession", "mutation", "trespass", "ownership", "possession", "land"],
    synonyms: ["transfer of property", "sale deed", "gift deed", "waqf", "easement", "partition", "co-sharer", "title dispute", "adverse possession", "tenancy", "revenue record", "pre-emption", "shuf'a", "benami", "khasra", "fard", "registry", "allotment", "plot", "evacuee property", "cantonment"],
    minRelevanceScore: 18,
  },
  {
    id: "fraud",
    label: "Fraud / Cheating / Forgery",
    primary: ["fraud", "cheating", "forgery", "deceit", "misrepresentation"],
    synonyms: ["ppc 420", "ppc 463", "ppc 465", "ppc 468", "false documents", "counterfeit", "impersonation", "fabrication", "criminal breach of trust", "ppc 405", "ppc 406", "ppc 409", "misappropriation", "criminal conspiracy", "ppc 120-b"],
    minRelevanceScore: 22,
  },
  {
    id: "kidnapping",
    label: "Kidnapping / Abduction",
    primary: ["kidnapping", "abduction", "ransom", "kidnap"],
    synonyms: ["ppc 363", "ppc 364", "ppc 365", "ppc 366", "ppc 367", "wrongful confinement", "human trafficking", "abduction for ransom", "wrongful restraint", "ppc 339", "ppc 340", "child kidnapping", "abduction of woman", "ppc 496-a"],
    minRelevanceScore: 22,
  },
  {
    id: "rape-sexual",
    label: "Rape / Sexual Assault / Harassment",
    primary: ["rape", "sexual assault", "zina", "harassment", "molestation"],
    synonyms: ["ppc 375", "ppc 376", "outrage of modesty", "zina-bil-jabr", "protection of women", "harassment act", "sexual harassment", "ppc 377", "unnatural offence", "sodomy", "child abuse", "minor victim", "medical examination", "dna evidence"],
    minRelevanceScore: 22,
  },
  {
    id: "constitutional",
    label: "Constitutional / Writ / Fundamental Rights",
    primary: ["writ", "habeas corpus", "mandamus", "certiorari", "constitution", "fundamental rights", "article 199"],
    synonyms: ["constitutional petition", "quo warranto", "high court", "supreme court", "basic rights", "writ petition", "article 184", "article 25", "article 10-a", "suo motu", "intra vires", "ultra vires", "due process", "right to fair trial", "freedom of speech", "article 19"],
    minRelevanceScore: 18,
  },
  {
    id: "fir",
    label: "FIR / Police / Registration",
    primary: ["fir", "first information report", "police", "22-a"],
    synonyms: ["crpc 154", "crpc 155", "justice of peace", "registration of fir", "police station", "lodging fir", "complaint", "quashment of fir", "cross fir", "counter fir", "zero fir", "murasla", "daily diary", "challan"],
    minRelevanceScore: 22,
  },
  {
    id: "tax",
    label: "Tax / Revenue",
    primary: ["tax", "income tax", "sales tax", "customs"],
    synonyms: ["fbr", "tribunal", "withholding tax", "income tax ordinance", "sales tax act", "duty", "customs tribunal", "appellate tribunal", "tax exemption", "tax credit", "advance tax", "capital gains", "property tax"],
    minRelevanceScore: 22,
  },
  {
    id: "labor",
    label: "Labour / Employment / Service",
    primary: ["employment", "labor", "labour", "service", "dismissal", "termination", "worker"],
    synonyms: ["reinstatement", "provident fund", "eobi", "industrial relations", "factories act", "workman", "wrongful termination", "social security", "minimum wage", "overtime", "bonus", "gratuity", "standing orders", "unfair labor practice", "trade union"],
    minRelevanceScore: 18,
  },
  {
    id: "banking",
    label: "Banking / Finance / Recovery",
    primary: ["bank", "banking", "financing", "loan", "mortgage", "markup", "recovery", "credit"],
    synonyms: [
      "set-off", "lien", "guarantee", "guarantor", "restructuring",
      "credit bureau", "defaulter", "overdue", "installment",
      "letter of credit", "term finance", "cash finance", "overdraft",
      "floating charge", "hypothecation", "pledge", "security",
      "prudential regulations", "state bank", "sbp",
      "financial institution", "recovery proceedings",
      "banking court", "banking tribunal",
      "interest", "markup rate", "riba",
      "mohtasib", "banking ombudsman", "leasing", "musharika", "mudaraba", "islamic banking", "sukuk",
    ],
    minRelevanceScore: 18,
  },

  // =========================================================================
  // NEW CRIMINAL LAW TOPICS (13)
  // =========================================================================
  {
    id: "narcotics",
    label: "Narcotics / Drug Offences",
    primary: ["narcotics", "drug trafficking", "drugs", "cnsa", "controlled substance"],
    synonyms: ["hashish", "heroin", "charas", "opium", "methamphetamine", "ice", "cannabis", "cocaine", "poppy", "drug smuggling", "drug possession", "recovery of narcotics", "narcotic substance", "control of narcotic substances act"],
    minRelevanceScore: 22,
  },
  {
    id: "arms-weapons",
    label: "Arms / Weapons / Firearms",
    primary: ["arms", "weapons", "firearms", "unlicensed weapon", "explosives"],
    synonyms: ["arms act 1878", "ammunition", "pistol", "kalashnikov", "rifle", "gun", "revolver", "shotgun", "bomb", "licensed weapon", "arms license", "prohibited bore", "non-prohibited bore", "weapon recovery"],
    minRelevanceScore: 22,
  },
  {
    id: "terrorism",
    label: "Terrorism / Anti-Terrorism",
    primary: ["terrorism", "anti-terrorism", "terrorist", "ata", "scheduled offence"],
    synonyms: ["anti-terrorism act 1997", "anti-terrorism court", "terrorism financing", "proscribed organization", "terrorist act", "bomb blast", "sectarian violence", "militant", "target killing", "suicide attack", "atc"],
    minRelevanceScore: 22,
  },
  {
    id: "blasphemy",
    label: "Blasphemy / Religious Offences",
    primary: ["blasphemy", "blasphemous", "desecration", "religious offence", "derogatory remarks"],
    synonyms: ["ppc 295", "ppc 295-a", "ppc 295-b", "ppc 295-c", "quran desecration", "defiling quran", "prophet insult", "religious hatred", "religious sentiments", "religious remarks", "anti-islamic", "sacrilege"],
    minRelevanceScore: 28,
  },
  {
    id: "hurt-bodily-injury",
    label: "Hurt / Bodily Injury",
    primary: ["hurt", "bodily injury", "grievous hurt", "simple hurt", "bodily harm"],
    synonyms: ["ppc 332", "ppc 333", "ppc 334", "ppc 335", "ppc 336", "ppc 337", "ppc 338", "arsh", "daman", "itlaf-i-udw", "shajjah", "injury", "fracture", "wound", "assault causing hurt"],
    minRelevanceScore: 22,
  },
  {
    id: "theft-burglary",
    label: "Theft / Burglary / Housebreaking",
    primary: ["theft", "burglary", "housebreaking", "stealing", "shoplifting"],
    synonyms: ["ppc 378", "ppc 379", "ppc 380", "ppc 381", "ppc 382", "trespass at night", "lurking", "breaking open", "stolen property", "receiving stolen goods", "night break", "house trespass", "criminal trespass"],
    minRelevanceScore: 22,
  },
  {
    id: "extortion",
    label: "Extortion / Bhatta / Criminal Intimidation",
    primary: ["extortion", "bhatta", "threatening", "criminal intimidation", "blackmail"],
    synonyms: ["ppc 383", "ppc 384", "ppc 385", "ppc 386", "ppc 387", "ppc 388", "ppc 389", "protection money", "ransom demand", "coercion", "threat of violence", "threat to life", "menacing"],
    minRelevanceScore: 22,
  },
  {
    id: "defamation",
    label: "Defamation / Libel / Slander",
    primary: ["defamation", "defamatory", "libel", "slander", "reputation damage"],
    synonyms: ["ppc 499", "ppc 500", "ppc 501", "ppc 502", "imputation", "false accusation", "character assassination", "malicious publication", "defamation suit", "damage to reputation", "injurious falsehood", "published defamatory"],
    minRelevanceScore: 22,
  },
  {
    id: "obscenity",
    label: "Obscenity / Indecent Material",
    primary: ["obscenity", "indecent material", "pornography", "immoral content"],
    synonyms: ["ppc 292", "ppc 293", "ppc 294", "child pornography", "obscene publication", "explicit material", "offensive content", "vulgar material", "obscene acts", "indecent exposure"],
    minRelevanceScore: 24,
  },
  {
    id: "riots-unlawful-assembly",
    label: "Riots / Unlawful Assembly",
    primary: ["riot", "rioting", "unlawful assembly", "affray", "mob violence"],
    synonyms: ["ppc 141", "ppc 142", "ppc 143", "ppc 144", "ppc 145", "ppc 146", "ppc 147", "ppc 148", "ppc 149", "ppc 158", "section 144", "dispersal order", "public gathering", "civil commotion", "stone pelting"],
    minRelevanceScore: 22,
  },
  {
    id: "criminal-mischief",
    label: "Criminal Mischief / Destruction of Property",
    primary: ["criminal mischief", "mischief by fire", "arson", "destruction of property"],
    synonyms: ["ppc 425", "ppc 426", "ppc 427", "ppc 430", "ppc 435", "ppc 436", "ppc 440", "damage to property", "setting fire", "vandalism", "malicious damage", "willful destruction"],
    minRelevanceScore: 22,
  },
  {
    id: "honor-killing",
    label: "Honor Killing / Karo Kari",
    primary: ["honor killing", "honour killing", "karo kari", "ghairat"],
    synonyms: ["ppc 302 proviso", "ppc 311", "honor crime", "honour crime", "vani", "swara", "watta satta", "tribal killing", "pretext of honor", "pretext of honour", "grave and sudden provocation"],
    minRelevanceScore: 24,
  },
  {
    id: "acid-attack",
    label: "Acid Attack / Burn Injuries",
    primary: ["acid attack", "acid throwing", "burn injuries", "disfigurement"],
    synonyms: ["ppc 336-a", "ppc 336-b", "corrosive substance", "acid burn", "acid victim", "facial disfigurement", "acid crime", "chemical attack", "permanent disfigurement", "scarring"],
    minRelevanceScore: 24,
  },

  // =========================================================================
  // NEW CIVIL / COMMERCIAL LAW TOPICS (15)
  // =========================================================================
  {
    id: "rent-tenancy",
    label: "Rent / Tenancy / Landlord-Tenant",
    primary: ["rent", "tenancy", "tenant", "landlord", "eviction", "ejectment"],
    synonyms: ["rent control", "landlord-tenant", "rent tribunal", "lease", "lease expiry", "subletting", "rent increase", "vacancy", "tenant rights", "rent agreement", "rent petition", "monthly rent"],
    minRelevanceScore: 22,
  },
  {
    id: "company-corporate",
    label: "Company / Corporate Law",
    primary: ["company", "corporate", "winding up", "directors", "shareholders"],
    synonyms: ["companies act 2017", "secp", "memorandum of association", "articles of association", "board of directors", "annual general meeting", "company registration", "incorporation", "liquidation", "corporate governance", "dividend"],
    minRelevanceScore: 22,
  },
  {
    id: "insurance",
    label: "Insurance / Indemnity",
    primary: ["insurance", "claim", "policy", "premium", "indemnity"],
    synonyms: ["third party insurance", "life insurance", "motor insurance", "health insurance", "insurance company", "insurance agent", "insurer", "insured", "coverage", "risk", "actuarial", "reinsurance"],
    minRelevanceScore: 22,
  },
  {
    id: "consumer-protection",
    label: "Consumer Protection",
    primary: ["consumer", "defective goods", "consumer court", "warranty", "consumer rights"],
    synonyms: ["consumer protection", "product liability", "defective product", "consumer complaint", "consumer forum", "unfair trade", "misleading advertisement", "sale of goods", "consumer welfare"],
    minRelevanceScore: 22,
  },
  {
    id: "intellectual-property",
    label: "Intellectual Property / Copyright / Trademark",
    primary: ["copyright", "trademark", "patent", "intellectual property", "ip infringement"],
    synonyms: ["trade secret", "piracy", "counterfeit goods", "brand protection", "design registration", "copyright act", "trademark act", "patent office", "infringement suit", "passing off"],
    minRelevanceScore: 22,
  },
  {
    id: "partnership",
    label: "Partnership / Firm",
    primary: ["partnership", "partner", "dissolution of firm", "profit sharing"],
    synonyms: ["partnership act", "reconstitution", "goodwill", "sleeping partner", "active partner", "partnership deed", "firm registration", "joint venture", "partnership dissolution", "capital contribution"],
    minRelevanceScore: 22,
  },
  {
    id: "arbitration-adr",
    label: "Arbitration / ADR / Mediation",
    primary: ["arbitration", "mediation", "conciliation", "dispute resolution", "arbitral award"],
    synonyms: ["alternative dispute resolution", "adr", "arbitrator", "arbitral tribunal", "arbitration agreement", "arbitration clause", "enforcement of award", "international arbitration", "domestic arbitration"],
    minRelevanceScore: 22,
  },
  {
    id: "specific-relief",
    label: "Specific Relief / Injunction",
    primary: ["specific relief", "declaratory suit", "injunction", "mandatory injunction"],
    synonyms: ["permanent injunction", "temporary injunction", "perpetual injunction", "prohibitory injunction", "specific relief act", "declaration of rights", "status quo order", "restraining order"],
    minRelevanceScore: 22,
  },
  {
    id: "limitation",
    label: "Limitation / Time Bar",
    primary: ["limitation", "time barred", "condonation of delay", "prescribed period"],
    synonyms: ["limitation act", "statute of limitations", "lapse of time", "limitation period", "extension of time", "delay in filing", "condone delay", "barred by limitation"],
    minRelevanceScore: 22,
  },
  {
    id: "execution-decree",
    label: "Execution of Decree",
    primary: ["execution", "decree holder", "judgment debtor", "money decree"],
    synonyms: ["execution of decree", "attachment", "auction", "sale in execution", "garnishee order", "arrest of judgment debtor", "satisfaction of decree", "execution petition", "executing court", "order 21 cpc"],
    minRelevanceScore: 22,
  },
  {
    id: "succession-probate",
    label: "Succession / Probate",
    primary: ["succession certificate", "letters of administration", "probate", "legal heirs"],
    synonyms: ["succession act", "probate court", "grant of probate", "administrator", "executor", "testamentary succession", "intestate succession", "heir certificate", "death certificate"],
    minRelevanceScore: 22,
  },
  {
    id: "power-of-attorney",
    label: "Power of Attorney",
    primary: ["power of attorney", "general power of attorney", "special power of attorney"],
    synonyms: ["irrevocable power of attorney", "revocation", "attorney holder", "gpa", "spa", "authorized agent", "delegation of authority", "agent authority", "proxy"],
    minRelevanceScore: 22,
  },
  {
    id: "stamp-registration",
    label: "Stamp / Registration",
    primary: ["stamp duty", "registration fee", "stamp act", "registration act"],
    synonyms: ["sub-registrar", "stamp paper", "registration of documents", "conveyance deed", "deficiency of stamp", "impounding", "unstamped document", "registered deed"],
    minRelevanceScore: 22,
  },
  {
    id: "pre-emption",
    label: "Pre-emption / Shuf'a",
    primary: ["pre-emption", "right of pre-emption", "shuf'a", "shufa"],
    synonyms: ["talb-i-muwathibat", "talb-i-ishhad", "talb-i-tamlik", "pre-emption act", "co-sharer right", "adjacent owner", "pre-emptive right", "pre-emption suit", "pre-emptor", "first refusal"],
    minRelevanceScore: 22,
  },
  {
    id: "debt-recovery",
    label: "Debt Recovery / Money Suit",
    primary: ["promissory note", "debt", "creditor", "debtor", "recovery suit"],
    synonyms: ["money decree", "recovery of debt", "financial obligation", "unpaid debt", "defaulting debtor", "debt collection", "loan recovery", "outstanding dues", "acknowledgment of debt"],
    minRelevanceScore: 22,
  },

  // =========================================================================
  // NEW INHERITANCE / ISLAMIC SUCCESSION TOPICS (10)
  // =========================================================================
  {
    id: "islamic-inheritance",
    label: "Islamic Inheritance / Miras",
    primary: ["islamic inheritance", "miras", "wirasat", "legal heirs", "sharers"],
    synonyms: ["residuaries", "inheritance law", "muslim inheritance", "personal law", "sharia inheritance", "islamic succession", "heir share", "inheritance rights", "compulsory heirs"],
    minRelevanceScore: 20,
  },
  {
    id: "faraid",
    label: "Faraid / Fixed Shares",
    primary: ["faraid", "fixed shares", "quranic shares", "inheritance share"],
    synonyms: ["husband share", "wife share", "daughter share", "son share", "mother share", "father share", "sunni hanafi", "hanafi law", "prescribed shares", "obligatory heirs", "quranic heirs"],
    minRelevanceScore: 22,
  },
  {
    id: "daughter-inheritance",
    label: "Daughter Inheritance Rights",
    primary: ["daughter inheritance", "daughter share", "daughter right", "equal share"],
    synonyms: ["double share", "residuary with son", "sole daughter", "multiple daughters", "daughter exclusion", "daughter property rights", "female inheritance", "girl child inheritance"],
    minRelevanceScore: 24,
  },
  {
    id: "widow-inheritance",
    label: "Widow Inheritance / Wife Share",
    primary: ["widow share", "wife inheritance", "widow inheritance", "widow rights"],
    synonyms: ["one-eighth", "one-fourth", "dower first", "widow property", "surviving spouse", "husband death", "wife entitlement", "widow claim", "deceased husband"],
    minRelevanceScore: 24,
  },
  {
    id: "will-wasiyat",
    label: "Will / Wasiyat / Testamentary",
    primary: ["will", "wasiyat", "testamentary disposition", "bequest"],
    synonyms: ["one-third rule", "testator", "beneficiary", "codicil", "revocation of will", "oral will", "written will", "death-bed will", "marad-ul-maut", "testamentary succession"],
    minRelevanceScore: 22,
  },
  {
    id: "gift-hiba",
    label: "Gift / Hiba",
    primary: ["hiba", "gift", "gift deed", "hiba-bil-iwaz"],
    synonyms: ["hiba-ba-shart-ul-iwaz", "sadaqah", "gift inter vivos", "donee", "donor", "delivery of possession", "relinquishment", "gift of immovable property", "oral gift", "gift revocation"],
    minRelevanceScore: 22,
  },
  {
    id: "exclusion-heirs",
    label: "Exclusion of Heirs",
    primary: ["exclusion", "disinheritance", "partial exclusion", "total exclusion"],
    synonyms: ["murderer heir", "excluded heir", "disqualified heir", "non-muslim heir", "apostate heir", "inheritance exclusion", "blocking heir", "nearer heir", "remote heir"],
    minRelevanceScore: 24,
  },
  {
    id: "joint-family-property",
    label: "Joint Family Property / Ancestral Property",
    primary: ["joint family property", "ancestral property", "self-acquired", "coparcenary"],
    synonyms: ["partition", "division of property", "family property", "undivided property", "common property", "ancestral land", "joint ownership", "family settlement", "property division"],
    minRelevanceScore: 22,
  },
  {
    id: "succession-certificate",
    label: "Succession Certificate / Legal Heir Certificate",
    primary: ["succession certificate", "legal heir certificate", "letters of administration"],
    synonyms: ["probate court", "certificate of inheritance", "bank account succession", "pension succession", "provident fund claim", "death claim", "legal heir affidavit", "heirship certificate"],
    minRelevanceScore: 22,
  },
  {
    id: "inheritance-disputes",
    label: "Inheritance Disputes / Mutation of Inheritance",
    primary: ["inheritance dispute", "mutation of inheritance", "intaqal", "family settlement", "deprived", "sister", "brother"],
    synonyms: ["deprived of share", "property dispute", "brother sister dispute", "ancestral property dispute", "illegal mutation", "fraudulent mutation", "inheritance fraud", "disinherited", "forced disinheritance", "share in property", "denied inheritance", "father death", "mother death"],
    minRelevanceScore: 22,
  },

  // =========================================================================
  // NEW CIVIL PROCEDURE TOPICS (20)
  // =========================================================================
  {
    id: "declaratory-suit",
    label: "Declaratory Suit / Declaration of Rights",
    primary: ["declaratory suit", "declaration of rights", "suit for declaration", "title declaration"],
    synonyms: ["cpc order vii", "declare ownership", "legal character", "declaratory decree", "right title and interest", "declaration suit", "judicial declaration", "establish rights"],
    minRelevanceScore: 22,
  },
  {
    id: "suit-possession",
    label: "Suit for Possession / Recovery of Possession",
    primary: ["recovery of possession", "dispossession", "illegal occupation", "eviction suit"],
    synonyms: ["suit for possession", "forcible dispossession", "wrongful possession", "possessory suit", "ejectment suit", "trespass and possession", "restoration of possession", "right of possession"],
    minRelevanceScore: 22,
  },
  {
    id: "cancellation-documents",
    label: "Cancellation of Documents",
    primary: ["cancellation of sale deed", "void document", "voidable instrument", "fraudulent transfer"],
    synonyms: ["cancellation suit", "annulment of deed", "fraudulent deed", "forged document", "unregistered document", "cancellation of gift deed", "sham transaction", "collusive transfer"],
    minRelevanceScore: 22,
  },
  {
    id: "partition-suit",
    label: "Partition Suit / Division of Property",
    primary: ["partition of property", "partition suit", "division of joint property", "co-sharer"],
    synonyms: ["co-owner", "partition decree", "metes and bounds", "property division", "share allotment", "partition by court", "right to partition", "joint property division", "partition proceedings"],
    minRelevanceScore: 22,
  },
  {
    id: "tort-negligence",
    label: "Tort / Negligence / Damages",
    primary: ["tortious liability", "negligence", "compensation", "damages", "personal injury"],
    synonyms: ["wrongful act", "duty of care", "contributory negligence", "vicarious liability", "strict liability", "tort claim", "injury claim", "bodily damage", "pecuniary damages"],
    minRelevanceScore: 22,
  },
  {
    id: "easement",
    label: "Easement / Right of Way",
    primary: ["easement", "right of way", "light and air", "prescriptive easement"],
    synonyms: ["easement act", "guzargah", "servient tenement", "dominant tenement", "easement by prescription", "easement by necessity", "access right", "passage right"],
    minRelevanceScore: 22,
  },
  {
    id: "adverse-possession",
    label: "Adverse Possession",
    primary: ["adverse possession", "hostile possession", "open and continuous"],
    synonyms: ["12 years", "twelve years", "prescriptive title", "limitation adverse possession", "squatter", "possessory title", "statutory period", "uninterrupted possession", "adverse claim"],
    minRelevanceScore: 22,
  },
  {
    id: "attachment-before-judgment",
    label: "Attachment Before Judgment",
    primary: ["attachment before judgment", "order 38 cpc", "interlocutory order"],
    synonyms: ["security deposit", "furnish security", "abj application", "prevent alienation", "dissipation of assets", "interim protection", "pre-judgment attachment", "property attachment"],
    minRelevanceScore: 24,
  },
  {
    id: "lis-pendens",
    label: "Lis Pendens / Transfer During Litigation",
    primary: ["lis pendens", "transfer during litigation", "section 52 tpa", "pending suit"],
    synonyms: ["pendente lite", "alienation during suit", "notice of lis pendens", "transfer pending suit", "doctrine of lis pendens", "litigation transfer", "sale during suit"],
    minRelevanceScore: 24,
  },
  {
    id: "res-judicata",
    label: "Res Judicata / Issue Estoppel",
    primary: ["res judicata", "issue estoppel", "constructive res judicata", "section 11 cpc"],
    synonyms: ["former suit", "decided matter", "bar of res judicata", "previously adjudicated", "final judgment", "binding judgment", "same cause of action", "same parties"],
    minRelevanceScore: 22,
  },
  {
    id: "compromise-settlement",
    label: "Compromise / Settlement",
    primary: ["compromise decree", "out of court settlement", "consent decree"],
    synonyms: ["order 23 cpc", "compromise agreement", "settlement deed", "withdrawal of suit", "amicable settlement", "mutual consent", "court settlement", "compromise petition"],
    minRelevanceScore: 22,
  },
  {
    id: "representative-suit",
    label: "Representative Suit / Class Action",
    primary: ["representative suit", "class action", "common interest"],
    synonyms: ["order 1 rule 8", "numerous parties", "common grievance", "group litigation", "collective suit", "representative capacity", "public interest suit", "community suit"],
    minRelevanceScore: 24,
  },
  {
    id: "civil-appeal",
    label: "Civil Appeal / Revision",
    primary: ["civil appeal", "civil revision", "first appeal", "second appeal"],
    synonyms: ["letters patent appeal", "appellate court", "appellate jurisdiction", "right of appeal", "leave to appeal", "appeal dismissed", "appeal allowed", "revisional jurisdiction"],
    minRelevanceScore: 22,
  },
  {
    id: "guardian-ad-litem",
    label: "Guardian Ad Litem / Minor Litigation",
    primary: ["minor", "next friend", "guardian ad litem", "order 32 cpc"],
    synonyms: ["minor plaintiff", "minor defendant", "litigation guardian", "disability", "incompetent person", "suit by minor", "minor representation", "legal guardian suit"],
    minRelevanceScore: 24,
  },
  {
    id: "interpleader",
    label: "Interpleader / Rival Claimants",
    primary: ["interpleader", "rival claimants", "order 35 cpc", "stakeholder"],
    synonyms: ["conflicting claims", "interpleader suit", "multiple claimants", "disputed ownership", "deposit in court", "competing claims", "adverse claimants"],
    minRelevanceScore: 24,
  },
  {
    id: "set-off-counterclaim",
    label: "Set-Off / Counterclaim",
    primary: ["set-off", "counterclaim", "cross-demand", "mutual debts"],
    synonyms: ["order 8 rule 6", "legal set-off", "equitable set-off", "counter suit", "cross claim", "defendant claim", "reciprocal demand", "set off plea"],
    minRelevanceScore: 24,
  },
  {
    id: "replevin",
    label: "Replevin / Recovery of Movable Property",
    primary: ["replevin", "recovery of movable property", "return of goods"],
    synonyms: ["detention of goods", "wrongful detention", "movable property suit", "delivery of goods", "specific delivery", "recovery of chattel", "goods recovery", "personal property recovery"],
    minRelevanceScore: 24,
  },
  {
    id: "accounting-suit",
    label: "Suit for Accounts / Rendition of Accounts",
    primary: ["suit for accounts", "rendition of accounts", "partnership accounting"],
    synonyms: ["account settlement", "profit and loss account", "rendering accounts", "unaudited accounts", "accounting dispute", "financial accounting", "account books", "fiduciary accounting"],
    minRelevanceScore: 24,
  },
  {
    id: "mesne-profits",
    label: "Mesne Profits / Use and Occupation",
    primary: ["mesne profits", "use and occupation", "wrongful possession"],
    synonyms: ["section 2(12) cpc", "mesne profit claim", "occupation charges", "rent for wrongful possession", "compensation for use", "profit from possession", "unauthorized occupation"],
    minRelevanceScore: 22,
  },
  {
    id: "civil-court-procedure",
    label: "Civil Court Procedure / Trial",
    primary: ["plaint", "written statement", "framing of issues", "replication"],
    synonyms: ["trial court", "civil procedure", "civil suit", "issues in suit", "examination of witness", "arguments", "hearing", "judgment writing", "order sheet"],
    minRelevanceScore: 18,
  },

  // =========================================================================
  // NEW SPECIALIZED LAW TOPICS (11)
  // =========================================================================
  {
    id: "cybercrime",
    label: "Cybercrime / PECA",
    primary: ["cybercrime", "online fraud", "hacking", "data theft", "cyber stalking", "fake", "facebook", "social media"],
    synonyms: ["peca 2016", "social media defamation", "identity theft", "phishing", "online harassment", "electronic crime", "digital fraud", "unauthorized access", "cyber bullying", "fake profile", "fake account", "instagram", "twitter", "whatsapp"],
    minRelevanceScore: 22,
  },
  {
    id: "motor-vehicle",
    label: "Motor Vehicle / Road Accident",
    primary: ["road accident", "hit and run", "rash driving", "traffic challan"],
    synonyms: ["motor vehicle ordinance", "traffic violation", "driving license", "vehicle registration", "accident compensation", "reckless driving", "traffic police", "motor accident claim", "dangerous driving"],
    minRelevanceScore: 22,
  },
  {
    id: "environmental",
    label: "Environmental Law / Pollution",
    primary: ["pollution", "environmental", "epa", "environmental tribunal"],
    synonyms: ["industrial waste", "environmental protection act", "air pollution", "water pollution", "noise pollution", "environmental impact", "climate", "hazardous waste", "deforestation", "green tribunal"],
    minRelevanceScore: 22,
  },
  {
    id: "election",
    label: "Election / Electoral Law",
    primary: ["election", "election petition", "disqualification", "election commission"],
    synonyms: ["ecp", "returning officer", "election tribunal", "ballot", "polling", "election rigging", "nomination papers", "electoral roll", "bye-election", "general election"],
    minRelevanceScore: 22,
  },
  {
    id: "military",
    label: "Military / Court Martial",
    primary: ["court martial", "military court", "army act", "military law"],
    synonyms: ["pakistan army act 1952", "military tribunal", "field general court martial", "summary court martial", "military service", "armed forces", "court martial proceedings", "military officer", "defence service"],
    minRelevanceScore: 24,
  },
  {
    id: "immigration",
    label: "Immigration / Visa / Passport",
    primary: ["immigration", "visa", "passport", "deportation"],
    synonyms: ["fia", "human smuggling", "illegal entry", "travel ban", "exit control list", "ecl", "passport act", "immigration officer", "foreign national", "overstay", "work permit"],
    minRelevanceScore: 22,
  },
  {
    id: "medical-malpractice",
    label: "Medical Malpractice / Negligence",
    primary: ["medical negligence", "medical malpractice", "doctor liability", "wrong diagnosis"],
    synonyms: ["medical board", "hospital negligence", "wrong surgery", "clinical negligence", "patient rights", "medical complaint", "healthcare liability", "surgical error", "misdiagnosis", "permanent disability"],
    minRelevanceScore: 22,
  },
  {
    id: "education",
    label: "Education Law",
    primary: ["university", "examination", "admission", "educational institution"],
    synonyms: ["degree", "plagiarism", "student rights", "academic", "scholarship", "affiliation", "education board", "higher education commission", "hec", "private school"],
    minRelevanceScore: 22,
  },
  {
    id: "domestic-violence",
    label: "Domestic Violence",
    primary: ["domestic violence", "wife beating", "cruelty", "matrimonial cruelty"],
    synonyms: ["domestic violence act", "protection order", "residence order", "domestic abuse", "spousal abuse", "physical abuse", "verbal abuse", "emotional abuse", "restraining order domestic", "battered woman"],
    minRelevanceScore: 22,
  },
  {
    id: "child-juvenile",
    label: "Child / Juvenile Justice",
    primary: ["juvenile justice", "juvenile", "child labor", "child marriage"],
    synonyms: ["borstal", "juvenile court", "minor offender", "reformatory", "child protection", "child rights", "underage", "juvenile delinquent", "child welfare", "juvenile offender"],
    minRelevanceScore: 22,
  },
  {
    id: "waqf-trust",
    label: "Waqf / Trust / Charity",
    primary: ["waqf", "trust", "charity", "endowment"],
    synonyms: ["auqaf", "mutawalli", "charitable trust", "trust deed", "religious endowment", "trust property", "charitable purpose", "trust act", "waqf board", "dedication"],
    minRelevanceScore: 22,
  },

  // =========================================================================
  // NEW ADMINISTRATIVE / REGULATORY LAW TOPICS (13)
  // =========================================================================
  {
    id: "contempt-of-court",
    label: "Contempt of Court",
    primary: ["contempt", "contempt of court", "willful disobedience", "court order violation"],
    synonyms: ["scandalizing court", "civil contempt", "criminal contempt", "contempt proceedings", "non-compliance", "disobedience of order", "contempt petition", "punishing contempt"],
    minRelevanceScore: 22,
  },
  {
    id: "anti-money-laundering",
    label: "Anti-Money Laundering",
    primary: ["money laundering", "amla", "proceeds of crime", "suspicious transaction"],
    synonyms: ["amla 2010", "anti money laundering act", "financial crime", "terror financing", "cash smuggling", "money trail", "financial investigation", "freezing of assets", "predicate offence"],
    minRelevanceScore: 22,
  },
  {
    id: "media-press",
    label: "Media / Press / Broadcasting",
    primary: ["pemra", "press council", "broadcast", "journalist"],
    synonyms: ["cable tv", "freedom of press", "media regulation", "press freedom", "broadcasting license", "electronic media", "print media", "media rights", "journalist protection"],
    minRelevanceScore: 22,
  },
  {
    id: "ombudsman",
    label: "Ombudsman / Wafaqi Mohtasib",
    primary: ["ombudsman", "wafaqi mohtasib", "maladministration", "grievance"],
    synonyms: ["federal ombudsman", "provincial ombudsman", "mohtasib order", "ombudsman complaint", "administrative injustice", "public grievance", "government complaint", "ombudsman jurisdiction"],
    minRelevanceScore: 22,
  },
  {
    id: "public-interest-litigation",
    label: "Public Interest Litigation / PIL",
    primary: ["pil", "suo motu", "public interest", "article 184(3)"],
    synonyms: ["public interest litigation", "public cause", "fundamental rights violation", "suo motu notice", "constitutional jurisdiction", "public welfare", "public benefit", "judicial activism"],
    minRelevanceScore: 22,
  },
  {
    id: "customs-excise",
    label: "Customs / Excise / Smuggling",
    primary: ["customs act", "smuggling", "seizure", "confiscation", "customs"],
    synonyms: ["duty evasion", "contraband", "customs officer", "customs duty", "excise duty", "import duty", "export duty", "customs tribunal", "show cause notice", "customs court"],
    minRelevanceScore: 22,
  },
  {
    id: "local-government",
    label: "Local Government / Municipal",
    primary: ["municipal", "local bodies", "union council", "district council"],
    synonyms: ["tehsil", "local government", "town committee", "metropolitan corporation", "cantonment board", "municipal committee", "local election", "local administration"],
    minRelevanceScore: 22,
  },
  {
    id: "civil-servants",
    label: "Civil Servants / Government Service",
    primary: ["government servant", "civil service", "efficiency and discipline"],
    synonyms: ["posting", "transfer", "seniority", "civil servant rights", "service tribunal", "service rules", "pension rights", "departmental inquiry", "suspension", "removal from service"],
    minRelevanceScore: 22,
  },
  {
    id: "land-revenue",
    label: "Land Revenue / Revenue Record",
    primary: ["patwari", "revenue record", "fard", "khasra", "girdawari"],
    synonyms: ["mutation", "revenue officer", "tehsildar", "land record", "jamabandi", "shajra", "mauza", "land revenue act", "revenue court"],
    minRelevanceScore: 22,
  },
  {
    id: "cooperative-societies",
    label: "Cooperative Societies",
    primary: ["cooperative society", "registrar", "member rights"],
    synonyms: ["cooperative societies act", "dissolution of society", "cooperative housing", "cooperative bank", "society registration", "general body meeting", "managing committee", "bylaws"],
    minRelevanceScore: 24,
  },
  {
    id: "prohibition-liquor",
    label: "Prohibition / Liquor / Alcohol",
    primary: ["prohibition", "liquor", "alcohol", "intoxicating"],
    synonyms: ["hplo", "prohibition order", "illicit liquor", "bootlegging", "liquor license", "non-muslim permit", "alcohol ban", "temperance", "intoxicant"],
    minRelevanceScore: 22,
  },
  {
    id: "preventive-detention",
    label: "Preventive Detention / MPO",
    primary: ["preventive detention", "mpo", "maintenance of public order", "externment"],
    synonyms: ["mpo 3", "detention order", "security of state", "public safety", "internment", "national security", "detention without trial", "preventive custody"],
    minRelevanceScore: 22,
  },
  {
    id: "search-seizure",
    label: "Search / Seizure / Recovery",
    primary: ["search warrant", "seizure", "recovery memo", "search and seizure"],
    synonyms: ["crpc 165", "crpc 96", "house search", "search operation", "illegal search", "contraband seizure", "evidence recovery", "police search", "search authorization"],
    minRelevanceScore: 22,
  },

  // =========================================================================
  // ADDITIONAL TOPICS — Evidence, Procedure, Specialized (28)
  // =========================================================================
  {
    id: "evidence-witness",
    label: "Evidence / Witness / Testimony",
    primary: ["evidence", "witness", "testimony", "qanun-e-shahadat", "qso"],
    synonyms: ["cross-examination", "examination-in-chief", "re-examination", "burden of proof", "onus of proof", "hearsay", "corroboration", "hostile witness", "interested witness", "expert witness", "ocular evidence", "circumstantial evidence", "documentary evidence", "primary evidence", "secondary evidence", "best evidence rule", "admissibility", "relevancy", "article 17", "article 46", "article 59", "article 164", "impeaching credit", "dying declaration", "confession before magistrate", "recovery evidence"],
    minRelevanceScore: 18,
  },
  {
    id: "criminal-appeal-revision",
    label: "Criminal Appeal / Revision / Reference",
    primary: ["criminal appeal", "criminal revision", "jail petition", "criminal reference"],
    synonyms: ["crpc 410", "crpc 417", "crpc 435", "crpc 439", "high court appeal", "leave to appeal", "suspension of sentence", "conviction appeal", "acquittal appeal", "enhancement of sentence", "commutation", "appeal against conviction", "criminal miscellaneous", "bail pending appeal"],
    minRelevanceScore: 22,
  },
  {
    id: "confession-retraction",
    label: "Confession / Retracted Confession / Judicial Confession",
    primary: ["confession", "confessional statement", "retracted confession", "judicial confession"],
    synonyms: ["crpc 164", "section 164", "extra-judicial confession", "voluntary confession", "confession before magistrate", "retraction", "co-accused confession", "confession during investigation", "confession evidence", "warning by magistrate", "recording of confession"],
    minRelevanceScore: 24,
  },
  {
    id: "investigation-police",
    label: "Investigation / Police Procedure / Challan",
    primary: ["investigation", "police investigation", "challan", "charge sheet"],
    synonyms: ["crpc 173", "investigation officer", "io", "scene of crime", "spot inspection", "recovery memo", "site plan", "medico-legal", "mlr", "post mortem", "autopsy", "forensic report", "police diary", "case diary", "supplementary challan", "final report", "cancellation report", "b class"],
    minRelevanceScore: 20,
  },
  {
    id: "hudood-zina",
    label: "Hudood / Zina / Moral Offences",
    primary: ["hudood", "zina", "zina ordinance", "hadd", "tazir"],
    synonyms: ["hudood ordinance 1979", "offence of zina", "zina-bil-jabr", "zina-bil-raza", "qazf", "false accusation of zina", "punishment of hadd", "punishment of tazir", "women protection act 2006", "fornication", "adultery", "illicit relations", "proof of zina", "four witnesses"],
    minRelevanceScore: 24,
  },
  {
    id: "land-acquisition",
    label: "Land Acquisition / Eminent Domain / Compulsory Acquisition",
    primary: ["land acquisition", "compulsory acquisition", "eminent domain", "acquisition of land"],
    synonyms: ["land acquisition act 1894", "notification under section 4", "section 4 notification", "section 6 declaration", "section 11 award", "market value", "compensation for land", "collector award", "reference to court", "solatium", "acquisition for public purpose", "enhancement of compensation", "possession of acquired land", "de-notification"],
    minRelevanceScore: 22,
  },
  {
    id: "habeas-corpus",
    label: "Habeas Corpus / Illegal Detention / Missing Person",
    primary: ["habeas corpus", "illegal detention", "unlawful detention", "produce the body"],
    synonyms: ["article 199", "detention without authority", "wrongful confinement", "missing person", "enforced disappearance", "commission of inquiry", "safe custody", "protective custody", "recovery of detenu", "freedom of person", "liberty of person", "personal liberty"],
    minRelevanceScore: 22,
  },
  {
    id: "smuggling",
    label: "Smuggling / Anti-Smuggling / Contraband",
    primary: ["smuggling", "anti-smuggling", "contraband", "smuggled goods"],
    synonyms: ["customs act 1969", "smuggling of goods", "border smuggling", "gold smuggling", "currency smuggling", "cigarette smuggling", "vehicle smuggling", "non-duty paid", "seizure of goods", "confiscation order", "adjudication", "customs tribunal", "preventive force", "intelligence and investigation"],
    minRelevanceScore: 22,
  },
  {
    id: "jail-parole-remission",
    label: "Jail / Prison / Parole / Remission",
    primary: ["jail", "prison", "parole", "remission", "probation"],
    synonyms: ["prison rules", "jail manual", "good conduct remission", "special remission", "conditional release", "parole board", "open air camp", "prison reform", "prisoner rights", "death row", "solitary confinement", "jail petition", "premature release", "probation of offenders", "probation officer"],
    minRelevanceScore: 22,
  },
  {
    id: "service-tribunal",
    label: "Service Tribunal / Government Employee Appeal",
    primary: ["service tribunal", "federal service tribunal", "provincial service tribunal"],
    synonyms: ["service tribunal act", "government employee", "appeal against dismissal", "appeal against demotion", "terms and conditions of service", "civil servant appeal", "service matter", "departmental proceedings", "show cause notice", "major penalty", "minor penalty", "compulsory retirement"],
    minRelevanceScore: 22,
  },
  {
    id: "banking-court-recovery",
    label: "Banking Court / Financial Institution Recovery",
    primary: ["banking court", "financial institution", "recovery of finance"],
    synonyms: ["financial institutions recovery ordinance", "firo", "banking company", "leave to defend", "judgment debtor banking", "finance facility", "running finance", "term loan", "default in payment", "banking court decree", "hypothecated property", "pledge of goods", "equitable mortgage", "banking ombud"],
    minRelevanceScore: 22,
  },
  {
    id: "irrigation-water",
    label: "Irrigation / Water Disputes / Canal",
    primary: ["irrigation", "water dispute", "canal", "water course"],
    synonyms: ["irrigation department", "canal act", "water distribution", "watercourse act", "tube well", "abiana", "water rights", "riparian rights", "canal breach", "flood damage", "irrigation officer", "water theft"],
    minRelevanceScore: 24,
  },
  {
    id: "forensic-dna",
    label: "Forensic Evidence / DNA / Scientific Evidence",
    primary: ["forensic", "dna", "scientific evidence", "forensic report"],
    synonyms: ["dna test", "dna evidence", "forensic laboratory", "pfsa", "chemical examiner", "ballistic report", "finger prints", "blood group", "serology", "toxicology", "handwriting expert", "digital forensics", "cctv footage", "call data record", "cdr", "electronic evidence", "mobile forensics"],
    minRelevanceScore: 22,
  },
  {
    id: "abetment-conspiracy",
    label: "Abetment / Criminal Conspiracy / Common Intention",
    primary: ["abetment", "criminal conspiracy", "common intention", "common object"],
    synonyms: ["ppc 107", "ppc 108", "ppc 109", "ppc 120", "ppc 120-b", "ppc 34", "ppc 149", "abettor", "instigator", "conspiracy to commit", "hatching conspiracy", "agreement to commit offence", "aiding and abetting", "vicarious liability criminal"],
    minRelevanceScore: 22,
  },
  {
    id: "quashment-proceedings",
    label: "Quashment of FIR / Proceedings / Section 561-A",
    primary: ["quashment", "quash fir", "quash proceedings", "561-a"],
    synonyms: ["crpc 561-a", "inherent powers", "abuse of process", "quashing of complaint", "quashing criminal case", "frivolous fir", "malicious prosecution", "high court jurisdiction", "proceedings quashed", "charge quashed", "discharge of accused", "no prima facie case"],
    minRelevanceScore: 22,
  },
  {
    id: "transfer-cases",
    label: "Transfer of Cases / Change of Venue",
    primary: ["transfer of case", "change of venue", "transfer application"],
    synonyms: ["crpc 526", "transfer petition", "fair trial", "impartial trial", "bias of judge", "prejudice", "transfer to another court", "change of judge", "transfer from sessions", "inter-provincial transfer"],
    minRelevanceScore: 24,
  },
  {
    id: "review-petition",
    label: "Review Petition / Review of Judgment",
    primary: ["review petition", "review of judgment", "review application"],
    synonyms: ["order 47 cpc", "mistake or error apparent", "discovery of new evidence", "sufficient reason", "review of decree", "review of order", "review dismissed", "review allowed", "error on face of record", "clerical error", "recall of order"],
    minRelevanceScore: 22,
  },
  {
    id: "court-fees-valuation",
    label: "Court Fees / Valuation / Jurisdiction Amount",
    primary: ["court fee", "court fees", "valuation", "pecuniary jurisdiction"],
    synonyms: ["court fees act", "ad valorem", "fixed court fee", "deficiency of court fee", "exemption from court fee", "suit valuation", "territorial jurisdiction", "subject matter jurisdiction", "plaint return", "rejection of plaint", "order 7 rule 11"],
    minRelevanceScore: 24,
  },
  {
    id: "negotiable-instruments",
    label: "Negotiable Instruments / Promissory Note / Bill of Exchange",
    primary: ["negotiable instrument", "promissory note", "bill of exchange", "hundi"],
    synonyms: ["negotiable instruments act 1881", "holder in due course", "endorsement", "presentment", "noting and protest", "dishonor of instrument", "liability of parties", "discharge of instrument", "demand promissory note", "accommodation bill"],
    minRelevanceScore: 22,
  },
  {
    id: "sale-of-goods",
    label: "Sale of Goods / Buyer-Seller Disputes",
    primary: ["sale of goods", "buyer", "seller", "delivery of goods"],
    synonyms: ["sale of goods act 1930", "implied conditions", "implied warranties", "caveat emptor", "passing of property", "risk of loss", "right of unpaid seller", "stoppage in transit", "breach of warranty", "rejection of goods", "merchantable quality"],
    minRelevanceScore: 22,
  },
  {
    id: "agency-principal",
    label: "Agency / Principal-Agent / Authority",
    primary: ["agency", "principal", "agent", "authority of agent"],
    synonyms: ["contract act chapter x", "implied authority", "ostensible authority", "ratification", "sub-agent", "agent liability", "undisclosed principal", "termination of agency", "commission agent", "del credere agent", "factor", "broker"],
    minRelevanceScore: 24,
  },
  {
    id: "surety-guarantee",
    label: "Surety / Guarantee / Indemnity",
    primary: ["surety", "guarantee", "indemnity", "guarantor"],
    synonyms: ["contract of guarantee", "contract of indemnity", "surety bond", "continuing guarantee", "revocation of guarantee", "discharge of surety", "co-surety", "bank guarantee", "performance guarantee", "principal debtor", "liability of surety"],
    minRelevanceScore: 22,
  },
  {
    id: "human-trafficking",
    label: "Human Trafficking / Bonded Labour / Modern Slavery",
    primary: ["human trafficking", "bonded labour", "trafficking in persons", "modern slavery"],
    synonyms: ["prevention of trafficking act", "prevention of smuggling of migrants act", "bonded labour system abolition act", "forced labour", "child trafficking", "sex trafficking", "labour exploitation", "trafficking victim", "anti-trafficking", "fia human trafficking"],
    minRelevanceScore: 22,
  },
  {
    id: "federal-shariat-court",
    label: "Federal Shariat Court / Islamic Law Challenge",
    primary: ["federal shariat court", "shariat court", "repugnancy to islam"],
    synonyms: ["article 203-d", "shariat petition", "islamic law", "repugnant to quran", "repugnant to sunnah", "shariat appeal", "ulema", "islamic jurisprudence", "fiqh", "ijtihad", "shariat bench", "islamization"],
    minRelevanceScore: 22,
  },
  {
    id: "right-to-information",
    label: "Right to Information / Freedom of Information",
    primary: ["right to information", "freedom of information", "rti", "information access"],
    synonyms: ["right of access to information act", "information commission", "public body", "information request", "exempted information", "classified document", "public interest disclosure", "whistleblower", "transparency", "accountability through information"],
    minRelevanceScore: 24,
  },
  {
    id: "damages-compensation",
    label: "Damages / Compensation / Maawza",
    primary: ["damages", "compensation", "maawza", "pecuniary damages"],
    synonyms: ["general damages", "special damages", "exemplary damages", "punitive damages", "liquidated damages", "unliquidated damages", "loss of earnings", "pain and suffering", "loss of consortium", "fatal accident", "compensation claim", "quantum of damages", "assessment of damages"],
    minRelevanceScore: 20,
  },
  {
    id: "supreme-court-appeal",
    label: "Appeal to Supreme Court / Leave to Appeal",
    primary: ["supreme court appeal", "leave to appeal", "petition for leave"],
    synonyms: ["article 185", "article 212", "cpla", "civil petition for leave to appeal", "criminal petition for leave to appeal", "substantial question of law", "public importance", "supreme court rules", "appeal as of right", "special leave", "intra-court appeal", "letters patent appeal"],
    minRelevanceScore: 22,
  },
  {
    id: "missing-persons-enforced-disappearance",
    label: "Missing Persons / Enforced Disappearance",
    primary: ["missing person", "enforced disappearance", "disappeared person"],
    synonyms: ["commission of inquiry on enforced disappearances", "missing person petition", "unidentified body", "recovery of missing person", "defense forces disappearance", "intelligence agencies", "whereabouts unknown", "traced missing person", "voice of baloch missing persons", "missing person fir"],
    minRelevanceScore: 22,
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
    // ALWAYS search for case law — the user can ask about ANY legal topic.
    // Even if no predefined topic matched, the raw query tokens will still
    // find relevant judgments via tsvector full-text search on 174k records.
    // Previously this was conditional, causing "no case law" errors on
    // uncommon topics not covered by LEGAL_TOPICS.
    needsCaseLaw: true,
    // Same for statutes — always search, never skip.
    needsStatutes: true,
    needsAdminDocs: true,
  };
}

// ---------------------------------------------------------------------------
// Query Complexity Detection
// ---------------------------------------------------------------------------

export type QueryComplexity = "simple" | "moderate" | "complex";

const SIMPLE_QUERY_STARTERS = /^(is|are|can|could|should|would|do|does|did|will|won't|isn't|aren't|define|what is|whats|what's|who is|when|where|why)\b/i;

const COMPLEX_QUERY_INDICATORS = /\b(compare|comparison|vs\.?|versus|difference|differences|scenario|draft|drafting|prepare|write|analyze|analysis|explain in detail|step.?by.?step|elaborate|comprehensive|my client|i am charged|i was charged|i have been|advise me|advice on|case study|hypothetical)\b/i;

const FOLLOWUP_QUESTION_STARTERS = /^(is it|is this|is that|are they|are these|can it|can they|can i|does it|do they|will it|what about|how about|what if|and |but |so |then |also |why |how |when |where |yes|no|ok|okay|sure|right|tell me|explain|elaborate|more about|regarding|concerning|in that case|furthermore|additionally|what's the|whats the|what is the)/i;

/**
 * Mid-sentence indicators of a follow-up question — checked anywhere in the query,
 * not just at the start. These reference prior conversational context.
 */
const FOLLOWUP_CONTENT_INDICATORS = /\b(you (said|mentioned|stated|explained|noted)|as you|mentioned (above|earlier|before|previously)|above|earlier|previous|previously|follow.?up|in (that|this) (case|regard|context|scenario)|same (question|topic|issue|statute|section|act)|section \d+|the (same|above|previous)|referring to|back to|going back|continue|continuing|more (details?|info|information|about|on)|further)\b/i;


/**
 * Classify a query into simple/moderate/complex to scale response length.
 *
 * Heuristics (no LLM, no DB):
 *  - SIMPLE   : short (<100 chars) AND starts with a yes/no or definition word
 *  - COMPLEX  : long (>200 chars) OR contains comparison/drafting/scenario words
 *  - MODERATE : everything else
 */
export function detectQueryComplexity(rawQuery: string): QueryComplexity {
  const q = (rawQuery || "").trim();
  if (!q) return "simple";

  const len = q.length;
  const wordCount = q.split(/\s+/).length;

  // Complex signals — explicit drafting/comparison/long-form work
  if (len > 200 || wordCount > 35) return "complex";
  if (COMPLEX_QUERY_INDICATORS.test(q)) return "complex";

  // Simple signals — short, yes/no or definition style
  if (len < 100 && SIMPLE_QUERY_STARTERS.test(q)) return "simple";
  if (len < 60 && wordCount <= 8) return "simple";

  return "moderate";
}

/**
 * Detect a brief follow-up question in an ongoing conversation.
 *
 * Used to force "simple" classification when the user is clearly continuing
 * a thread (so they don't get a 2000-word essay for "is it bailable?").
 */
export function isFollowUpQuestion(
  currentQuery: string,
  previousMessageAgeMs: number | null,
): boolean {
  const q = (currentQuery || "").trim();
  if (!q) return false;
  if (previousMessageAgeMs == null) return false;
  // Must be within 10 minutes of last message
  if (previousMessageAgeMs > 10 * 60 * 1000) return false;
  // Short message limit (relaxed from 120)
  if (q.length >= 200) return false;

  // Very short messages in an active conversation are almost always follow-ups
  const wordCount = q.split(/\s+/).length;
  if (q.length < 60 && wordCount <= 8) return true;

  // Question-style opener
  if (FOLLOWUP_QUESTION_STARTERS.test(q)) return true;

  // Mid-sentence context references
  if (FOLLOWUP_CONTENT_INDICATORS.test(q)) return true;

  return false;
}
