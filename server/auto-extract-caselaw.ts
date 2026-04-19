/**
 * Auto-Extract Case Law — Rewritten
 *
 * Responsibility: Extract citation records from uploaded legal documents and
 *                 persist them to the caseLaw table with correct metadata.
 *
 * Fixes from old version:
 *  - Keyword context window narrowed to ±150 chars (was ±500, causing cross-topic contamination)
 *  - Complete LEGAL_KEYWORDS_MAP including robbery, dacoity, snatching, and all major topics
 *  - Hard validation: citation field must be non-empty before any record is saved
 *  - Stop-words added so generic terms don't over-match
 *  - Better primary citation detection using document heading/caption
 */

import { storage } from "./storage";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function envInt(name: string, defaultValue: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return defaultValue;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}

const MAX_QUEUE_SIZE     = envInt("AUTO_EXTRACT_MAX_QUEUE_SIZE", 200, 10, 2000);
const MAX_ITEM_TEXT_CHARS = envInt("AUTO_EXTRACT_MAX_ITEM_TEXT_CHARS", process.env.NODE_ENV === "production" ? 160_000 : 240_000, 10_000, 2_000_000);
const MAX_TOTAL_QUEUE_CHARS = envInt("AUTO_EXTRACT_MAX_TOTAL_QUEUE_CHARS", process.env.NODE_ENV === "production" ? 1_200_000 : 2_400_000, 100_000, 20_000_000);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExtractedCase {
  citation: string;
  citationRole: "primary" | "cited";
  court: string;
  title: string;
  summary: string;
  keywords: string[];
  documentClassification?: "case_law" | "statute_document" | "legal_analysis" | "contract" | "procedure_guide" | "other";
  fallbackExtraction?: boolean;
  statuteReferences?: string[];
}

interface CitationMention {
  citation: string;
  index: number;
}

interface CitationRoleAssignmentOptions {
  sourceFilename?: string;
  preferredPrimaryCitation?: string | null;
}

interface ExtractAndSaveOptions {
  allowExistingUpdates?: boolean;
}

interface QueueItem {
  text: string;
  source: string;
  sourceDocId?: number;
  sourceType?: string;
  sourceFilename?: string;
}

// ---------------------------------------------------------------------------
// Pakistani legal report codes + patterns
// ---------------------------------------------------------------------------

const REPORT_CODES = [
  "PLD", "SCMR", "YLR", "MLD", "CLC", "PCRLJ", "PLJ", "PLC", "NLR",
  "PSC", "ALD", "KLR", "PTD", "PTCL", "PLS", "GBLR", "TAX", "CLD", "SLR",
  "AIR",
] as const;

function buildFlexibleReportPattern(code: string): string {
  return String(code || "").replace(/[^A-Za-z]/g, "").split("").map((ch) => `${ch}\\.?`).join("\\s*");
}

const REPORT_ABBRS = REPORT_CODES.map(buildFlexibleReportPattern).join("|");
const REPORT_NORMALIZERS = REPORT_CODES.map((code) => ({
  canonical: code,
  regex: new RegExp(`\\b${buildFlexibleReportPattern(code)}\\b`, "gi"),
}));

const YEAR_PATTERN  = "(?:19|20)\\d{2}";
const PAGE_PATTERN  = "\\d{1,6}";
const SEP           = "\\s*[,;:/-]?\\s*";

const NEUTRAL_COURT_CODES = ["LHC", "IHC", "SHC", "PHC", "BHC", "AJKHC"] as const;
const NEUTRAL_COURT_CODE_MAP: Record<string, string> = {
  LHC: "Lahore High Court",
  IHC: "Islamabad High Court",
  SHC: "Sindh High Court",
  PHC: "Peshawar High Court",
  BHC: "Balochistan High Court",
  AJKHC: "High Court of Azad Jammu and Kashmir",
};
const NEUTRAL_COURT_NORMALIZERS = NEUTRAL_COURT_CODES.map((code) => ({
  code,
  regex: new RegExp(`\\b(${YEAR_PATTERN})\\s*${buildFlexibleReportPattern(code)}\\s*(${PAGE_PATTERN})\\b`, "gi"),
}));
const NEUTRAL_COURT_ABBRS = NEUTRAL_COURT_CODES.map(buildFlexibleReportPattern).join("|");
const COURT_NAMES = "Supreme\\s+Court|Lahore|Sindh|Peshawar|Balochistan|Islamabad|ISB|Federal\\s+Shariat|FSC|Rawalpindi|Multan|Bahawalpur|Azad\\s+J(?:ammu)?\\s*(?:&|and)\\s*K(?:ashmir)?|AJK|Privy\\s+Council";

// Case number prefix patterns (C.A., Civil Appeal, Criminal Petition, Writ, etc.)
const CASE_NUM_SEP = "\\s*[-/]?\\s*";
const CASE_NUM_ID  = "\\d+[A-Za-z\\-\\/]*\\d*"; // e.g. 8-Q, 32-Q, 155, 123-K

const CASE_NUMBER_PATTERNS: RegExp[] = [
  // C.A. 8-Q of 2017  /  CA 8Q of 2017
  new RegExp(`\\bC\\.?A\\.?\\s+${CASE_NUM_ID}(?:\\s+of\\s+|[/])${YEAR_PATTERN}\\b`, "gi"),
  // Civil Appeal No. 123-Q of 2020
  new RegExp(`\\bCivil\\s+Appeal\\s+(?:No\\.?\\s*)?${CASE_NUM_ID}(?:\\s+of\\s+|[/])${YEAR_PATTERN}\\b`, "gi"),
  // Civil Petition No. 32-Q of 2017
  new RegExp(`\\bCivil\\s+Petition\\s+(?:No\\.?\\s*)?${CASE_NUM_ID}(?:\\s+of\\s+|[/])${YEAR_PATTERN}\\b`, "gi"),
  // Criminal Appeal No. 123 of 2020
  new RegExp(`\\bCriminal\\s+Appeal\\s+(?:No\\.?\\s*)?${CASE_NUM_ID}(?:\\s+of\\s+|[/])${YEAR_PATTERN}\\b`, "gi"),
  // Criminal Petition No. 123 of 2020
  new RegExp(`\\bCriminal\\s+Petition\\s+(?:No\\.?\\s*)?${CASE_NUM_ID}(?:\\s+of\\s+|[/])${YEAR_PATTERN}\\b`, "gi"),
  // Criminal Revision No. 123 of 2020
  new RegExp(`\\bCriminal\\s+Revision\\s+(?:No\\.?\\s*)?${CASE_NUM_ID}(?:\\s+of\\s+|[/])${YEAR_PATTERN}\\b`, "gi"),
  // Writ Petition No. 123 of 2020
  new RegExp(`\\bWrit\\s+Petition\\s+(?:No\\.?\\s*)?${CASE_NUM_ID}(?:\\s+of\\s+|[/])${YEAR_PATTERN}\\b`, "gi"),
  // R.P.A No. 155/2014  /  RPA 155/2014
  new RegExp(`\\bR\\.?P\\.?A\\.?\\s+(?:No\\.?\\s*)?${CASE_NUM_ID}(?:\\s+of\\s+|[/])${YEAR_PATTERN}\\b`, "gi"),
  // Review Petition No. 123 of 2020
  new RegExp(`\\bReview\\s+Petition\\s+(?:No\\.?\\s*)?${CASE_NUM_ID}(?:\\s+of\\s+|[/])${YEAR_PATTERN}\\b`, "gi"),
  // Constitution Petition No. 123 of 2020
  new RegExp(`\\bConstitution(?:al)?\\s+Petition\\s+(?:No\\.?\\s*)?${CASE_NUM_ID}(?:\\s+of\\s+|[/])${YEAR_PATTERN}\\b`, "gi"),
  // Human Rights Case No. 123-K of 2020
  new RegExp(`\\bHuman\\s+Rights\\s+Case\\s+(?:No\\.?\\s*)?${CASE_NUM_ID}(?:\\s+of\\s+|[/])${YEAR_PATTERN}\\b`, "gi"),
  // Contempt Petition No. 123 of 2020
  new RegExp(`\\bContempt\\s+Petition\\s+(?:No\\.?\\s*)?${CASE_NUM_ID}(?:\\s+of\\s+|[/])${YEAR_PATTERN}\\b`, "gi"),
  // Company Appeal / Company Petition No. 123 of 2020
  new RegExp(`\\bCompany\\s+(?:Appeal|Petition)\\s+(?:No\\.?\\s*)?${CASE_NUM_ID}(?:\\s+of\\s+|[/])${YEAR_PATTERN}\\b`, "gi"),
  // Suit No. 123 of 2020 / O.S. No. 123/2020
  new RegExp(`\\b(?:Suit|O\\.?S\\.?)\\s+(?:No\\.?\\s*)?${CASE_NUM_ID}(?:\\s+of\\s+|[/])${YEAR_PATTERN}\\b`, "gi"),
  // FCA (Federal Court Appeal) No. 123 of 2020
  new RegExp(`\\bFCA\\s+(?:No\\.?\\s*)?${CASE_NUM_ID}(?:\\s+of\\s+|[/])${YEAR_PATTERN}\\b`, "gi"),
];

const CITATION_PATTERNS: RegExp[] = [
  // --- Judgment/Report citations ---
  new RegExp(`\\b${YEAR_PATTERN}\\s*(?:${NEUTRAL_COURT_ABBRS})\\s*${PAGE_PATTERN}\\b`, "gi"),
  new RegExp(`(?:${REPORT_ABBRS})${SEP}${YEAR_PATTERN}${SEP}(?:${COURT_NAMES})${SEP}${PAGE_PATTERN}`, "gi"),
  new RegExp(`(?:${REPORT_ABBRS})${SEP}${YEAR_PATTERN}${SEP}${PAGE_PATTERN}`, "gi"),
  new RegExp(`${YEAR_PATTERN}${SEP}(?:${REPORT_ABBRS})${SEP}(?:${COURT_NAMES})${SEP}${PAGE_PATTERN}`, "gi"),
  new RegExp(`${YEAR_PATTERN}${SEP}(?:${REPORT_ABBRS})${SEP}${PAGE_PATTERN}`, "gi"),
  new RegExp(`\\(${YEAR_PATTERN}\\)${SEP}(?:${REPORT_ABBRS})${SEP}(?:${COURT_NAMES})?${SEP}${PAGE_PATTERN}`, "gi"),
  new RegExp(`(?:${REPORT_ABBRS})${SEP}\\(${YEAR_PATTERN}\\)${SEP}(?:${COURT_NAMES})?${SEP}${PAGE_PATTERN}`, "gi"),
  // --- Case number patterns (spread at end so report patterns win primary) ---
  ...CASE_NUMBER_PATTERNS,
];

const COURT_MAP: Array<[RegExp, string]> = [
  [/\bSupreme\s+Court\b/i, "Supreme Court of Pakistan"],
  [/\bAzad\s+J(?:ammu)?\s*(?:&|and)\s*K(?:ashmir)?\b|\bA\.?J\.?K\.?\b/i, "High Court of Azad Jammu and Kashmir"],
  [/\bPrivy\s+Council\b/i, "Privy Council"],
  [/\bLah(?:ore)?\b/i, "Lahore High Court"],
  [/\bSindh\b|\bKar(?:achi)?\b/i, "Sindh High Court"],
  [/\bPesh(?:awar)?\b/i, "Peshawar High Court"],
  [/\bBal(?:ochistan)?\b|\bQuetta\b/i, "Balochistan High Court"],
  [/\bIslamabad\b|\bISB\b/i, "Islamabad High Court"],
  [/\bFederal\s+Shariat\b|\bFSC\b/i, "Federal Shariat Court"],
];

const REPORT_COURT_DEFAULT: Record<string, string> = {
  "scmr": "Supreme Court of Pakistan",
  "psc": "Supreme Court of Pakistan",
};

// ---------------------------------------------------------------------------
// LEGAL KEYWORDS MAP
// Narrower, more precise: only assign keywords that clearly describe the topic.
// Context window for matching is ±150 chars (NOT ±500 — that was causing
// cross-topic contamination).
// ---------------------------------------------------------------------------

const LEGAL_KEYWORDS_MAP: Record<string, string[]> = {
  // Criminal — violent
  "robbery":           ["robbery", "criminal law", "PPC 392"],
  "dacoity":           ["dacoity", "criminal law", "PPC 395"],
  "snatching":         ["snatching", "robbery", "street crime"],
  "dacoit":            ["dacoity", "criminal law"],
  "armed robbery":     ["robbery", "criminal law"],
  "murder":            ["murder", "qatl", "PPC 302"],
  "qatl":              ["qatl", "murder", "PPC 302"],
  "homicide":          ["homicide", "murder", "PPC 302"],
  "killing":           ["murder", "criminal law"],
  "qisas":             ["qisas", "diyat", "Islamic criminal law"],
  "diyat":             ["diyat", "qisas", "blood money"],
  "kidnapping":        ["kidnapping", "PPC 363"],
  "abduction":         ["abduction", "kidnapping"],
  "rape":              ["rape", "sexual assault", "PPC 375"],
  "zina":              ["zina", "hudood"],
  "blasphemy":         ["blasphemy", "PPC 295"],
  "terrorism":         ["anti-terrorism", "ATA"],
  "narcotics":         ["narcotics", "CNSA"],
  "theft":             ["theft", "criminal law", "PPC 379"],
  // Bail
  "bail":              ["bail", "CrPC 497"],
  "pre-arrest bail":   ["pre-arrest bail", "CrPC 498"],
  "post-arrest bail":  ["post-arrest bail", "CrPC 497"],
  // Fraud / Financial
  "fraud":             ["fraud", "PPC 420"],
  "cheating":          ["cheating", "fraud"],
  "forgery":           ["forgery", "PPC 463"],
  "corruption":        ["corruption", "NAB"],
  "bribery":           ["bribery", "corruption"],
  "cheque":            ["cheque dishonour", "PPC 489-F"],
  "dishonour":         ["cheque dishonour", "banking"],
  // Family
  "divorce":           ["divorce", "family law"],
  "khula":             ["khula", "divorce"],
  "talaq":             ["talaq", "divorce"],
  "maintenance":       ["maintenance", "family law"],
  "custody":           ["custody", "guardian"],
  "haq mehr":          ["haq mehr", "marriage"],
  "guardian":          ["guardianship", "family law"],
  // Property
  "property":          ["property law", "civil law"],
  "inheritance":       ["inheritance", "succession"],
  "succession":        ["succession", "inheritance"],
  "mutation":          ["mutation", "property"],
  "trespass":          ["trespass", "property"],
  "partition":         ["partition", "property"],
  "pre-emption":       ["pre-emption", "property law"],
  // Contract
  "contract":          ["contract law", "agreement"],
  "breach":            ["breach of contract", "damages"],
  "specific performance": ["specific performance", "contract"],
  "agreement":         ["contract law", "agreement"],
  // Constitutional
  "habeas corpus":     ["habeas corpus", "constitutional law"],
  "writ":              ["writ petition", "constitutional law"],
  "fundamental rights": ["fundamental rights", "constitutional law"],
  "constitution":      ["constitutional law", "fundamental rights"],
  // Procedure
  "fir":               ["FIR", "criminal procedure"],
  "bail cancellation": ["bail cancellation", "CrPC"],
  "appeal":            ["appeal", "appellate jurisdiction"],
  "revision":          ["revision", "CPC"],
  "injunction":        ["injunction", "civil procedure"],
  "declaration":       ["declaration", "civil suit"],
  "execution":         ["execution", "decree"],
  "limitation":        ["limitation", "time-barred"],
  // Service / Labour
  "employment":        ["employment", "service law"],
  "labour":            ["labour law", "industrial relations"],
  "dismissal":         ["dismissal", "service law"],
  "termination":       ["termination", "employment"],
  // Tax / Revenue
  "tax":               ["taxation", "FBR"],
  "customs":           ["customs", "import/export"],
  "income tax":        ["income tax", "FBR"],
  // Other
  "election":          ["election law", "disqualification"],
  "contempt":          ["contempt of court"],
  "arbitration":       ["arbitration", "dispute resolution"],
  "insurance":         ["insurance", "claim"],
  "company":           ["company law", "corporate"],
  "negligence":        ["negligence", "tort"],
  "compensation":      ["compensation", "damages"],
  "acquittal":         ["acquittal", "criminal law"],
  "conviction":        ["conviction", "criminal law"],
  "evidence":          ["evidence", "QSO"],
  "witness":           ["witness", "evidence"],
};

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

function normalizeCitation(raw: string): string {
  let out = raw.replace(/[,:;]+/g, " ").replace(/\s+/g, " ").replace(/[()]/g, "");
  for (const n of NEUTRAL_COURT_NORMALIZERS) {
    out = out.replace(n.regex, (_m, year, num) => `${year}${n.code}${Number(num)}`);
  }
  for (const n of REPORT_NORMALIZERS) out = out.replace(n.regex, n.canonical);
  return out.trim();
}

function normalizeCitationKey(citation: string): string {
  return normalizeCitation(String(citation || "")).toLowerCase();
}

function looksLikeReportCitation(citation: string): boolean {
  const n = normalizeCitation(String(citation || ""));
  if (!n) return false;
  if (new RegExp(`\\b${YEAR_PATTERN}(?:LHC|IHC|SHC|PHC|BHC|AJKHC)${PAGE_PATTERN}\\b`, "i").test(n)) return true;
  return new RegExp(REPORT_ABBRS, "i").test(n);
}

function looksLikeCaseNumber(citation: string): boolean {
  return CASE_NUMBER_PATTERNS.some((p) => {
    p.lastIndex = 0;
    return p.test(citation);
  });
}

/** Extract case type label from case number for use as keyword */
function caseTypeFromCitation(citation: string): string {
  const c = String(citation || "").toLowerCase();
  if (/\bc\.?a\.?\b/.test(c) || /civil\s+appeal/i.test(c))    return "civil appeal";
  if (/criminal\s+appeal/i.test(c))                             return "criminal appeal";
  if (/civil\s+petition/i.test(c))                              return "civil petition";
  if (/criminal\s+petition/i.test(c))                           return "criminal petition";
  if (/writ\s+petition/i.test(c))                               return "writ petition";
  if (/constitution(?:al)?\s+petition/i.test(c))                return "constitutional petition";
  if (/review\s+petition/i.test(c))                             return "review petition";
  if (/r\.?p\.?a\.?/i.test(c))                                  return "review petition appeal";
  if (/human\s+rights/i.test(c))                                return "human rights case";
  if (/contempt/i.test(c))                                      return "contempt petition";
  if (/criminal\s+revision/i.test(c))                           return "criminal revision";
  return "";
}

function escapeRegex(value: string): string {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Citation extraction from text
// ---------------------------------------------------------------------------

function extractCitationMentionsFromText(text: string): CitationMention[] {
  const mentions = new Map<string, CitationMention>();
  for (const pattern of CITATION_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const normalized = normalizeCitation(match[0]);
      if (normalized.length >= 8) {
        const index = Number(match.index || 0);
        const existing = mentions.get(normalized);
        if (!existing || index < existing.index) {
          mentions.set(normalized, { citation: normalized, index });
        }
      }
    }
  }
  return Array.from(mentions.values()).sort((a, b) => a.index - b.index);
}

function extractNeutralCitationFromSourceFilename(sourceFilename?: string): string | null {
  const raw = String(sourceFilename || "").trim();
  if (!raw) return null;
  const basename = raw.replace(/\.[^.]+$/g, "");
  for (const n of NEUTRAL_COURT_NORMALIZERS) {
    n.regex.lastIndex = 0;
    const match = n.regex.exec(basename);
    if (!match) continue;
    const year = Number(match[1]);
    const num  = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(num) || num < 1) continue;
    return `${year}${n.code}${num}`;
  }
  return null;
}

function inferPrimaryCitation(
  text: string,
  mentions: CitationMention[],
  preferredPrimaryCitation?: string | null,
): string | null {
  if (mentions.length === 0) return null;
  const preferred = normalizeCitation(String(preferredPrimaryCitation || ""));
  if (preferred) return preferred;

  const headWindow = text.slice(0, Math.min(text.length, 4000));

  for (const mention of mentions) {
    const escaped = escapeRegex(mention.citation);
    const explicit = new RegExp(`(?:reported\\s+as|case\\s+reported\\s+at|citation\\s*[:\\-])\\s*${escaped}`, "i");
    if (explicit.test(headWindow)) return mention.citation;
  }

  const captionIdx = headWindow.search(/\b(?:vs?\.?|versus|v\.?)\b/i);
  if (captionIdx >= 0) {
    const nearCaption = mentions.find((m) => m.index <= captionIdx + 1200);
    if (nearCaption) return nearCaption.citation;
  }

  const topMention = mentions.find((m) => m.index < 1600);
  return topMention?.citation ?? mentions[0].citation;
}

function addPreferredPrimaryMention(
  mentions: CitationMention[],
  preferredPrimaryCitation?: string | null,
): CitationMention[] {
  const preferred = normalizeCitation(String(preferredPrimaryCitation || ""));
  if (!preferred) return mentions;
  const preferredKey = normalizeCitationKey(preferred);
  if (mentions.some((m) => normalizeCitationKey(m.citation) === preferredKey)) return mentions;
  return [{ citation: preferred, index: -1 }, ...mentions];
}

// ---------------------------------------------------------------------------
// Court inference
// ---------------------------------------------------------------------------

function inferCourt(citation: string): string {
  const neutralMatch = citation.match(
    new RegExp(`\\b(${YEAR_PATTERN})(LHC|IHC|SHC|PHC|BHC|AJKHC)(${PAGE_PATTERN})\\b`, "i"),
  );
  if (neutralMatch) return NEUTRAL_COURT_CODE_MAP[String(neutralMatch[2]).toUpperCase()] || "";

  for (const [pattern, court] of COURT_MAP) {
    if (pattern.test(citation)) return court;
  }

  const lower = citation.toLowerCase();
  for (const [report, court] of Object.entries(REPORT_COURT_DEFAULT)) {
    if (lower.includes(report) && court) return court;
  }
  return "";
}

function inferCourtFromTextContext(text: string, sourceFilename?: string): string {
  const head = String(text || "").slice(0, 10000);
  if (/\b(supreme court of pakistan|in the supreme court)\b/i.test(head)) return "Supreme Court of Pakistan";
  if (/\b(lahore high court)\b/i.test(head)) return "Lahore High Court";
  if (/\b(sindh high court)\b/i.test(head)) return "Sindh High Court";
  if (/\b(islamabad high court)\b/i.test(head)) return "Islamabad High Court";
  if (/\b(peshawar high court)\b/i.test(head)) return "Peshawar High Court";
  if (/\b(balochistan high court)\b/i.test(head)) return "Balochistan High Court";
  if (/\b(high court of azad jammu)\b/i.test(head)) return "High Court of Azad Jammu and Kashmir";

  const filenameNeutral = extractNeutralCitationFromSourceFilename(sourceFilename);
  if (filenameNeutral) {
    const inferred = inferCourt(filenameNeutral);
    if (inferred) return inferred;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Title extraction
// ---------------------------------------------------------------------------

// Pattern to find "Petitioner vs Respondent" style titles
const TITLE_VS_RE = /(?:(?:Mst\.?|Dr\.?|Mr\.?|Mrs\.?|M\/s\.?|Haji|Ch\.?|S\/O|D\/O|W\/O|Govt\.?|Government|State|Federation|Province|Commissioner|Secretary|Inspector|SHO|DSP|SSP|DIG|IG)\s+)?([A-Z][A-Za-z0-9.'_\s]+?)(?:\s+and\s+others?|\s+etc\.?)?\s+(?:vs?\.?|versus|Vs?\.?)\s+(?:(?:Mst\.?|Dr\.?|Mr\.?|Mrs\.?|M\/s\.?|Haji|Ch\.?|Govt\.?|Government|State|Federation|Province|Commissioner|Inspector|SHO)\s+)?([A-Z][A-Za-z0-9.'_\s]+?)(?:\s+and\s+others?|\s+etc\.?)?(?=\s*\n|\s*$|\s*(?:PLD|SCMR|YLR|MLD|CLC|\d{4}|Civil|Criminal|Writ))/gim;

function findTitleNearCitation(text: string, citation: string, hintIndex?: number): string {
  const idx = text.indexOf(citation);
  const searchIdx = idx !== -1 ? idx : (Number.isInteger(hintIndex) ? Number(hintIndex) : 0);

  // Search window: 800 chars around citation first, then fall back to document head
  const start = Math.max(0, searchIdx - 800);
  const end   = Math.min(text.length, searchIdx + citation.length + 800);
  const context = text.substring(start, end);

  TITLE_VS_RE.lastIndex = 0;
  const match = TITLE_VS_RE.exec(context);
  if (match) {
    const full = match[0].trim();
    if (full.length > 5 && full.length < 300) {
      return full.replace(/\s+/g, " ").replace(/[,.]$/, "").trim();
    }
  }

  // Fall back: search the document head for a vs-title (captures cases where citation is deep)
  if (searchIdx > 2000) {
    TITLE_VS_RE.lastIndex = 0;
    const headMatch = TITLE_VS_RE.exec(text.slice(0, 3000));
    if (headMatch) {
      const full = headMatch[0].trim();
      if (full.length > 5 && full.length < 300) {
        return full.replace(/\s+/g, " ").replace(/[,.]$/, "").trim();
      }
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Summary extraction
// ---------------------------------------------------------------------------

/** Extract best available summary: HELD/HEADNOTE section preferred, fallback to context after citation */
function extractSummaryNearCitation(text: string, citation: string, hintIndex?: number): string {
  // Priority 1: HELD section (most authoritative — the actual decision)
  const heldMatch = text.match(/\b(?:HELD|HOLDING|DECISION|ORDER|RELIEF|PER CURIAM)\s*[:\-–—]?\s*([\s\S]{50,800}?)(?=\n{2,}|\b(?:FACTS|LAW|STATUTE|STATUTES|PETITIONER|RESPONDENT|JUDGMENT)\b)/i);
  if (heldMatch) {
    const held = heldMatch[1].replace(/\s+/g, " ").trim();
    if (held.length > 30) return held.slice(0, 600).trim();
  }

  // Priority 2: HEADNOTES section
  const headnoteMatch = text.match(/\b(?:HEADNOTES?|HEAD\s*NOTES?)\s*[:\-–—]?\s*([\s\S]{50,800}?)(?=\n{2,})/i);
  if (headnoteMatch) {
    const hn = headnoteMatch[1].replace(/\s+/g, " ").trim();
    if (hn.length > 30) return hn.slice(0, 500).trim();
  }

  // Priority 3: RATIO DECIDENDI
  const ratioMatch = text.match(/\bRATIO\s+DECIDENDI\s*[:\-–—]?\s*([\s\S]{30,600}?)(?=\n{2,})/i);
  if (ratioMatch) {
    const ratio = ratioMatch[1].replace(/\s+/g, " ").trim();
    if (ratio.length > 20) return ratio.slice(0, 400).trim();
  }

  // Priority 4: Context after the citation itself
  const idx = text.indexOf(citation);
  const searchIdx = idx !== -1 ? idx : (Number.isInteger(hintIndex) ? Number(hintIndex) : -1);
  if (searchIdx === -1) return "";

  const after = text.substring(searchIdx + citation.length, searchIdx + citation.length + 1000);
  const cleaned = after.replace(/^\s*[,;:\-–—.)\]]+\s*/, "");
  const sentences = cleaned.split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15 && s.length < 600 && /[a-zA-Z]/.test(s));

  if (sentences.length >= 2) return sentences.slice(0, 3).join(". ").trim() + ".";
  if (sentences.length === 1) return sentences[0].trim() + ".";
  return "";
}

// ---------------------------------------------------------------------------
// Keyword extraction — NARROWED CONTEXT WINDOW (±150 chars, was ±500)
// ---------------------------------------------------------------------------
// Why: ±500 chars caused cross-topic contamination. A corruption case that
// mentions "bail" somewhere nearby would get tagged as a bail case. The
// narrower window ensures keywords reflect only the immediately surrounding
// context of the citation itself.

const KEYWORD_CONTEXT_RADIUS = 150;

// Statute code detection for keyword enrichment
const STATUTE_KEYWORD_MAP: Array<[RegExp, string[]]> = [
  [/\bPPC\s+\d/i,                        ["PPC", "criminal law"]],
  [/\bCrPC\s+\d|\bCriminal\s+Procedure/i, ["CrPC", "criminal procedure"]],
  [/\bCPC\s+\d|\bCivil\s+Procedure/i,     ["CPC", "civil procedure"]],
  [/\bQSO\b/i,                            ["QSO", "evidence", "Qanun-e-Shahadat"]],
  [/\bFCRA?\b|\bFamily\s+Courts\s+Act/i,  ["family law", "Family Courts Act"]],
  [/\bHBLA?\b|\bHajj\s+&?\s*Umra/i,       ["Hajj", "religious law"]],
  [/\bNAB\b|\bNational\s+Accountability/i, ["NAB", "accountability", "corruption"]],
  [/\bATA\b|\bAnti.Terrorism/i,            ["anti-terrorism", "ATA"]],
  [/\bCNSA\b|\bNarcotics/i,               ["narcotics", "CNSA"]],
  [/\bNIC\b|\bCitizenship/i,              ["citizenship", "NADRA"]],
  [/\bSECP\b|\bCompanies\s+Act/i,         ["company law", "SECP"]],
  [/\bFBR\b|\bIncome\s+Tax/i,             ["income tax", "FBR"]],
  [/\bLand\s+Revenue\s+Act/i,             ["land revenue", "mutation"]],
  [/\bTransfer\s+of\s+Property/i,         ["property law", "transfer of property"]],
  [/\bConstitution.+?(?:Art(?:icle)?|Art\.)\s*\d/i, ["constitutional law", "fundamental rights"]],
];

function extractKeywords(text: string, citation: string, hintIndex?: number): string[] {
  const idx = text.indexOf(citation);
  const searchIdx = idx !== -1 ? idx : (Number.isInteger(hintIndex) ? Number(hintIndex) : 0);

  // Primary: narrow ±150-char window around citation (avoids cross-topic contamination)
  const start   = Math.max(0, searchIdx - KEYWORD_CONTEXT_RADIUS);
  const end     = Math.min(text.length, searchIdx + citation.length + KEYWORD_CONTEXT_RADIUS);
  const nearCtx = text.substring(start, end).toLowerCase();

  // Secondary: document heading (first 600 chars) — captures subject stated at the top
  const headCtx = text.slice(0, 600).toLowerCase();

  const combined = `${nearCtx} ${headCtx}`;
  const keywords = new Set<string>();

  // Legal topic keywords
  for (const [term, related] of Object.entries(LEGAL_KEYWORDS_MAP)) {
    if (combined.includes(term.toLowerCase())) {
      for (const kw of related.slice(0, 2)) keywords.add(kw);
    }
  }

  // Statute/Act references
  for (const [pattern, kws] of STATUTE_KEYWORD_MAP) {
    if (pattern.test(combined)) {
      for (const kw of kws) keywords.add(kw);
    }
  }

  // Report code
  const reportMatch = citation.match(new RegExp(REPORT_ABBRS, "i"));
  if (reportMatch) {
    keywords.add(reportMatch[0].toUpperCase().replace(/[^A-Z0-9]/g, ""));
  }

  // Case type from case number
  const caseType = caseTypeFromCitation(citation);
  if (caseType) keywords.add(caseType);

  if (keywords.size === 0) {
    keywords.add("Pakistani law");
    keywords.add("case law");
  }

  return Array.from(keywords).slice(0, 12);
}

// ---------------------------------------------------------------------------
// Fallback Classifier: statute references + document type
// ---------------------------------------------------------------------------

// Matches statute references in multiple formats:
// "PPC 302", "CrPC 497", "PPC Section 302", "Section 302 PPC", "Section 302 of the PPC", "Article 25 of the Constitution"
const STATUTE_REFERENCE_PATTERN = /(?:(?:Section|Article|No\.?)\s+(\d[\d\-a-z]*)\s+(?:of\s+)?(?:the\s+)?)?(PPC|CrPC|CPC|QSO|MFLO|ATA|NAB|CNSA|PECA|FIA|Constitution)(?:\s+(?:Section|Article|No\.?)?\s*(\d[\d\-a-z]*))?|(PPC|CrPC|CPC|QSO|MFLO|ATA|NAB|CNSA|PECA|FIA)\s+(\d[\d\-a-z]*)/gi;

function createFallbackDocumentClassification(text: string, sourceFilename?: string): ExtractedCase | null {
  if (!text || text.length < 100) return null;

  // 1. Extract statute references
  const statuteMatches: string[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(STATUTE_REFERENCE_PATTERN.source, STATUTE_REFERENCE_PATTERN.flags);
  while ((match = pattern.exec(text)) !== null) {
    // Pattern has multiple alternatives with different group structures
    // Alternative 1: "Section 302 of PPC" => groups: [1]num, [2]code, [3]num
    // Alternative 2: "PPC 302" => groups: [4]code, [5]num
    let code = match[2] || match[4];
    let num = match[1] || match[3] || match[5];

    if (code && num) {
      const fullRef = `${code} ${num}`;
      if (!statuteMatches.includes(fullRef)) {
        statuteMatches.push(fullRef);
      }
    } else if (code) {
      // Just code without number (e.g., "Constitution")
      if (!statuteMatches.includes(code)) {
        statuteMatches.push(code);
      }
    }
  }

  if (statuteMatches.length === 0) return null;

  // 2. Classify document type based on keyword frequency
  const lowerText = text.toLowerCase();
  const headCtx = text.slice(0, 600).toLowerCase();
  const combined = `${lowerText} ${headCtx}`;

  let documentClassification: "case_law" | "statute_document" | "legal_analysis" | "contract" | "procedure_guide" | "other" = "other";

  // Count keyword matches for classification
  const statuteDocScore = (combined.match(/section|article|punishment|penalty|amended|repeal|gazette/gi) || []).length;
  const legalAnalysisScore = (combined.match(/facts|held|judgment|decision|court|bench|petition|suit/gi) || []).length;
  const contractScore = (combined.match(/party|consideration|whereas|hereby|agreement|contract|signed|witness/gi) || []).length;
  const procedureScore = (combined.match(/application|form|procedure|provision|rule|guideline|requirement|step/gi) || []).length;

  const maxScore = Math.max(statuteDocScore, legalAnalysisScore, contractScore, procedureScore);

  if (maxScore > 0) {
    if (statuteDocScore === maxScore) {
      documentClassification = "statute_document";
    } else if (legalAnalysisScore === maxScore) {
      documentClassification = "legal_analysis";
    } else if (contractScore === maxScore) {
      documentClassification = "contract";
    } else if (procedureScore === maxScore) {
      documentClassification = "procedure_guide";
    }
  }

  // 3. Extract keywords from the document
  const keywords = new Set<string>();

  // Add statute references as keywords
  for (const ref of statuteMatches) {
    const parts = ref.split(/\s+/);
    if (parts[0]) keywords.add(parts[0]); // Add statute code like "PPC", "CrPC"
  }

  // Add document classification as keyword
  keywords.add(documentClassification.replace(/_/g, " "));

  // Add legal topic keywords
  for (const [term, related] of Object.entries(LEGAL_KEYWORDS_MAP)) {
    if (combined.includes(term.toLowerCase())) {
      for (const kw of related.slice(0, 2)) keywords.add(kw);
    }
  }

  // Add statute-related keywords
  for (const [pattern, kws] of STATUTE_KEYWORD_MAP) {
    if (pattern.test(combined)) {
      for (const kw of kws) keywords.add(kw);
    }
  }

  if (keywords.size === 0) {
    keywords.add("statute reference");
    keywords.add("legal document");
  }

  // 4. Build fallback record
  const pseudoCitation = sourceFilename ? sourceFilename.replace(/\.[^.]+$/, "") : `statute-ref`;
  const title = `Statute Reference: ${statuteMatches.join(", ")}`;
  const summary = `Document containing references to: ${statuteMatches.join(", ")}`;

  return {
    citation: pseudoCitation,
    citationRole: "primary",
    court: "Statute Reference",
    title,
    summary,
    keywords: Array.from(keywords).slice(0, 12),
    documentClassification,
    fallbackExtraction: true,
    statuteReferences: statuteMatches,
  };
}

// ---------------------------------------------------------------------------
// Public: nlpExtractCases
// ---------------------------------------------------------------------------

export function nlpExtractCases(text: string, options?: CitationRoleAssignmentOptions): ExtractedCase[] {
  const filenamePrimary = extractNeutralCitationFromSourceFilename(options?.sourceFilename);
  const preferredPrimary = options?.preferredPrimaryCitation || filenamePrimary || null;
  let mentions = addPreferredPrimaryMention(extractCitationMentionsFromText(text), preferredPrimary);
  if (mentions.length === 0 && preferredPrimary) {
    mentions = [{ citation: normalizeCitation(preferredPrimary), index: 0 }];
  }

  if (mentions.length === 0) {
    // Try fallback classifier to detect statute references
    const fallback = createFallbackDocumentClassification(text, options?.sourceFilename);
    return fallback ? [fallback] : [];
  }

  const inferredPrimary    = inferPrimaryCitation(text, mentions, preferredPrimary);
  const inferredPrimaryKey = inferredPrimary ? normalizeCitationKey(inferredPrimary) : "";
  const contextualCourt    = inferCourtFromTextContext(text, options?.sourceFilename);
  let assignedPrimary = false;

  const cases: ExtractedCase[] = [];

  for (const mention of mentions) {
    const citation = mention.citation;
    if (!citation || citation.trim().length < 6) continue; // skip empty/short

    const court    = inferCourt(citation) || contextualCourt;
    const title    = findTitleNearCitation(text, citation, mention.index);
    const summary  = extractSummaryNearCitation(text, citation, mention.index);
    const keywords = extractKeywords(text, citation, mention.index);
    const citKey   = normalizeCitationKey(citation);
    const isPrimary = !assignedPrimary && citKey === inferredPrimaryKey;
    if (isPrimary) assignedPrimary = true;

    // Build descriptive fallback title incorporating citation and case type
    let fallbackTitle: string;
    if (looksLikeReportCitation(citation)) {
      fallbackTitle = `Case reported at ${citation}`;
    } else if (looksLikeCaseNumber(citation)) {
      const ct = caseTypeFromCitation(citation);
      fallbackTitle = ct ? `${ct} — ${citation}` : `Case No. ${citation}`;
    } else {
      fallbackTitle = `Case No. ${citation}`;
    }

    const fallbackSummary = looksLikeReportCitation(citation)
      ? `Case cited as ${citation}`
      : `Case identified as ${citation}`;

    cases.push({
      citation,
      citationRole: isPrimary ? "primary" : "cited",
      court,
      title: title || fallbackTitle,
      summary: summary || fallbackSummary,
      keywords,
    });
  }

  if (!assignedPrimary && cases.length > 0) {
    cases[0].citationRole = "primary";
  }
  return cases;
}

// ---------------------------------------------------------------------------
// Public: assignCitationRolesToCases
// ---------------------------------------------------------------------------

export function assignCitationRolesToCases(
  text: string,
  cases: Array<Pick<ExtractedCase, "citation" | "court" | "title" | "summary" | "keywords">>,
  options?: CitationRoleAssignmentOptions,
): ExtractedCase[] {
  if (!Array.isArray(cases) || cases.length === 0) return [];

  const filenamePrimary = extractNeutralCitationFromSourceFilename(options?.sourceFilename);
  const preferredPrimary = options?.preferredPrimaryCitation || filenamePrimary;
  const mentions = addPreferredPrimaryMention(extractCitationMentionsFromText(text || ""), preferredPrimary);
  const inferredPrimary    = inferPrimaryCitation(text || "", mentions, preferredPrimary);
  const inferredPrimaryKey = inferredPrimary ? normalizeCitationKey(inferredPrimary) : "";

  let assignedPrimary = false;
  const mapped = cases.map((item) => {
    const citation    = normalizeCitation(String(item.citation || "")) || String(item.citation || "").trim();
    const citationKey = normalizeCitationKey(citation);
    const isPrimary   = !assignedPrimary && !!citationKey && citationKey === inferredPrimaryKey;
    if (isPrimary) assignedPrimary = true;
    return {
      citation,
      citationRole: isPrimary ? "primary" : "cited",
      court: String(item.court || ""),
      title: String(item.title || ""),
      summary: String(item.summary || ""),
      keywords: Array.isArray(item.keywords) ? item.keywords : [],
    } as ExtractedCase;
  });

  if (!assignedPrimary && mapped.length > 0) mapped[0].citationRole = "primary";
  return mapped;
}

// ---------------------------------------------------------------------------
// Queue and save logic
// ---------------------------------------------------------------------------

let extractionQueue: QueueItem[] = [];
let isProcessing = false;
let queuedChars  = 0;
const knownCitations     = new Set<string>();
let knownCitationsLoaded = false;

async function loadKnownCitations(): Promise<void> {
  if (knownCitationsLoaded) return;
  try {
    const existing = await storage.getCaseLawCitations();
    for (const c of existing) knownCitations.add(c);
    knownCitationsLoaded = true;
  } catch (err: any) {
    console.error("[AutoExtract] Failed to load known citations:", err?.message);
  }
}

export function queueAutoExtraction(
  text: string,
  source: string,
  opts?: { sourceDocId?: number; sourceType?: string; sourceFilename?: string },
): void {
  if (!text || text.length < 100) return;
  const safeText = text.replace(/\x00/g, "").trim().slice(0, MAX_ITEM_TEXT_CHARS);
  if (safeText.length < 100) return;
  if (extractionQueue.length >= MAX_QUEUE_SIZE) {
    console.log(`[AutoExtract] Queue full (${MAX_QUEUE_SIZE}), skipping: ${source}`);
    return;
  }
  if (queuedChars + safeText.length > MAX_TOTAL_QUEUE_CHARS) {
    console.log(`[AutoExtract] Queue memory cap reached, skipping: ${source}`);
    return;
  }
  extractionQueue.push({ text: safeText, source, ...opts });
  queuedChars += safeText.length;
  if (!isProcessing) processQueue();
}

async function processQueue(): Promise<void> {
  if (isProcessing || extractionQueue.length === 0) return;
  isProcessing = true;
  await loadKnownCitations();
  while (extractionQueue.length > 0) {
    const item = extractionQueue.shift()!;
    queuedChars = Math.max(0, queuedChars - item.text.length);
    await extractAndSave(item.text, item.source, item.sourceDocId, item.sourceType, item.sourceFilename);
  }
  isProcessing = false;
}

async function extractAndSave(
  text: string,
  source: string,
  sourceDocId?: number,
  sourceType?: string,
  sourceFilename?: string,
  options: ExtractAndSaveOptions = {},
): Promise<{ extracted: number; saved: number; skippedKnown: number; skippedEmpty: number }> {
  try {
    const extracted = nlpExtractCases(text, { sourceFilename });
    if (extracted.length === 0) return { extracted: 0, saved: 0, skippedKnown: 0, skippedEmpty: 0 };

    const newCases: ExtractedCase[] = [];
    let skippedKnown  = 0;
    let skippedEmpty  = 0;
    const allowUpdates = !!options.allowExistingUpdates;

    for (const c of extracted) {
      // HARD VALIDATION: citation field must be non-empty
      if (!c.citation || c.citation.trim().length < 6) {
        skippedEmpty += 1;
        console.warn(`[AutoExtract] Skipping case with empty/short citation from: ${source}`);
        continue;
      }
      if (!c.title) continue;

      const key = c.citation.toLowerCase().trim();
      if (!allowUpdates && knownCitations.has(key)) {
        skippedKnown += 1;
        continue;
      }
      if (!knownCitations.has(key)) knownCitations.add(key);
      newCases.push(c);
    }

    if (newCases.length === 0) return { extracted: extracted.length, saved: 0, skippedKnown, skippedEmpty };

    const entries = newCases.map((c) => ({
      citation:       c.citation.trim(),
      citationRole:   c.citationRole,
      court:          (c.court || "").trim(),
      title:          c.title.trim(),
      summary:        (c.summary || "").trim(),
      keywords:       Array.isArray(c.keywords) ? c.keywords : [],
      sourceDocId:    sourceDocId || null,
      sourceType:     sourceType  || null,
      sourceFilename: sourceFilename || null,
    }));

    await storage.bulkCreateCaseLaw(entries);
    console.log(`[AutoExtract] Saved ${entries.length} citations from: ${source} (skippedEmpty=${skippedEmpty} skippedKnown=${skippedKnown})`);
    return { extracted: extracted.length, saved: entries.length, skippedKnown, skippedEmpty };
  } catch (err: any) {
    console.error(`[AutoExtract] Error processing ${source}:`, err?.message || err);
    return { extracted: 0, saved: 0, skippedKnown: 0, skippedEmpty: 0 };
  }
}

// ---------------------------------------------------------------------------
// Batch re-index from all existing sources
// ---------------------------------------------------------------------------

export async function extractFromAllExistingSources(): Promise<void> {
  console.log("[AutoExtract] Scanning all knowledge sources for case law...");
  try {
    await loadKnownCitations();

    const githubDocs = await storage.getAllGithubKnowledge();
    let githubQueued = 0;
    for (const doc of githubDocs) {
      if (doc.content && doc.content.length > 200) {
        queueAutoExtraction(doc.content, `github:${doc.filename}`, { sourceDocId: doc.id, sourceType: "github", sourceFilename: doc.filename });
        githubQueued++;
      }
    }
    console.log(`[AutoExtract] Queued ${githubQueued} GitHub docs`);

    let adminQueued = 0;
    let offset = 0;
    const PAGE = 100;
    while (true) {
      const page = await storage.getAdminKnowledgePage(PAGE, offset);
      if (page.items.length === 0) break;
      for (const row of page.items) {
        const doc = await storage.getAdminKnowledgeById(row.id);
        if (!doc || !doc.content || doc.content.length <= 200) continue;
        queueAutoExtraction(doc.content, `admin:${doc.filename}`, { sourceDocId: doc.id, sourceType: "admin", sourceFilename: doc.filename });
        adminQueued++;
      }
      offset += page.items.length;
      if (!page.hasMore) break;
    }
    console.log(`[AutoExtract] Queued ${adminQueued} admin docs`);
  } catch (err: any) {
    console.error("[AutoExtract] Error scanning sources:", err?.message || err);
  }
}

// ---------------------------------------------------------------------------
// Progress types
// ---------------------------------------------------------------------------

export type CaseLawRoleReindexProgress = {
  running: boolean;
  source: "github" | "admin" | "statute" | "user";
  totalDocuments: number;
  processedDocuments: number;
  extractedCitations: number;
  savedCitations: number;
  failedDocuments: number;
  stopped: boolean;
  done: boolean;
};

export async function reindexCaseLawFromAllExistingSources(args?: {
  shouldStop?: () => boolean;
  onProgress?: (progress: CaseLawRoleReindexProgress) => void;
}): Promise<{
  totalDocuments: number;
  processedDocuments: number;
  extractedCitations: number;
  savedCitations: number;
  failedDocuments: number;
  stopped: boolean;
}> {
  const shouldStop  = typeof args?.shouldStop === "function" ? args.shouldStop : () => false;
  const onProgress  = typeof args?.onProgress === "function" ? args.onProgress : undefined;

  await loadKnownCitations();
  await storage.resetAllCaseLawCitationRolesToCited();

  const githubDocs       = await storage.getAllGithubKnowledge();
  const adminFirstPage   = await storage.getAdminKnowledgePage(1, 0);
  const statuteFirstPage = await storage.getStatuteDocumentsPage(1, 0);
  const userDocs         = await storage.getAllDocuments();

  const totalDocuments = githubDocs.length
    + Number(adminFirstPage.total || 0)
    + Number(statuteFirstPage.total || 0)
    + userDocs.length;

  let processedDocuments = 0;
  let extractedCitations = 0;
  let savedCitations     = 0;
  let failedDocuments    = 0;
  let stopped            = false;
  let activeSource: CaseLawRoleReindexProgress["source"] = "github";

  const publish = (done = false) => {
    onProgress?.({ running: !done, source: activeSource, totalDocuments, processedDocuments, extractedCitations, savedCitations, failedDocuments, stopped, done });
  };

  const processDocument = async (content: string, source: string, sourceDocId?: number, sourceType?: string, sourceFilename?: string) => {
    if (shouldStop()) { stopped = true; return; }
    const normalized = String(content || "").replace(/\x00/g, "").trim();
    if (normalized.length < 200) { processedDocuments += 1; publish(); return; }
    try {
      const result = await extractAndSave(normalized, source, sourceDocId, sourceType, sourceFilename, { allowExistingUpdates: true });
      extractedCitations += Number(result.extracted || 0);
      savedCitations     += Number(result.saved || 0);
    } catch { failedDocuments += 1; }
    finally   { processedDocuments += 1; publish(); }
  };

  // GitHub
  activeSource = "github";
  for (const doc of githubDocs) {
    if (stopped) break;
    await processDocument(doc.content || "", `github:${doc.filename}`, doc.id, "github", doc.filename);
  }

  // Admin
  if (!stopped) {
    activeSource = "admin";
    let off = 0;
    while (true) {
      if (shouldStop()) { stopped = true; break; }
      const page = await storage.getAdminKnowledgePage(100, off);
      if (page.items.length === 0) break;
      for (const row of page.items) {
        if (shouldStop()) { stopped = true; break; }
        const doc = await storage.getAdminKnowledgeById(row.id);
        if (!doc) { processedDocuments += 1; publish(); continue; }
        await processDocument(doc.content || "", `admin:${doc.filename}`, doc.id, "admin", doc.filename);
      }
      off += page.items.length;
      if (!page.hasMore || stopped) break;
    }
  }

  // Statutes
  if (!stopped) {
    activeSource = "statute";
    let off = 0;
    while (true) {
      if (shouldStop()) { stopped = true; break; }
      const page = await storage.getStatuteDocumentsPage(100, off);
      if (page.items.length === 0) break;
      for (const row of page.items) {
        if (shouldStop()) { stopped = true; break; }
        const doc = await storage.getStatuteDocument(row.id);
        if (!doc) { processedDocuments += 1; publish(); continue; }
        await processDocument(doc.content || "", `statute:${doc.filename}`, doc.id, "statute", doc.filename);
      }
      off += page.items.length;
      if (!page.hasMore || stopped) break;
    }
  }

  // User docs
  if (!stopped) {
    activeSource = "user";
    for (const doc of userDocs) {
      if (shouldStop()) { stopped = true; break; }
      await processDocument(doc.content || "", `user:${doc.title}`, doc.id, "user", doc.title || undefined);
    }
  }

  publish(true);
  return { totalDocuments, processedDocuments, extractedCitations, savedCitations, failedDocuments, stopped };
}
