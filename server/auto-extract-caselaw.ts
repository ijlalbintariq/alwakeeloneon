import { storage } from "./storage";

function envInt(name: string, defaultValue: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return defaultValue;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}

const MAX_QUEUE_SIZE = envInt("AUTO_EXTRACT_MAX_QUEUE_SIZE", 200, 10, 2000);
const MAX_ITEM_TEXT_CHARS = envInt("AUTO_EXTRACT_MAX_ITEM_TEXT_CHARS", process.env.NODE_ENV === "production" ? 160_000 : 240_000, 10_000, 2_000_000);
const MAX_TOTAL_QUEUE_CHARS = envInt("AUTO_EXTRACT_MAX_TOTAL_QUEUE_CHARS", process.env.NODE_ENV === "production" ? 1_200_000 : 2_400_000, 100_000, 20_000_000);

interface ExtractedCase {
  citation: string;
  citationRole: "primary" | "cited";
  court: string;
  title: string;
  summary: string;
  keywords: string[];
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

let extractionQueue: QueueItem[] = [];
let isProcessing = false;
let queuedChars = 0;
const knownCitations = new Set<string>();
let knownCitationsLoaded = false;

const REPORT_CODES = [
  "PLD", "SCMR", "YLR", "MLD", "CLC", "PCRLJ", "PLJ", "PLC", "NLR",
  "PSC", "ALD", "KLR", "PTD", "PTCL", "PLS", "GBLR", "TAX", "CLD", "SLR",
  "AIR",
] as const;

function buildFlexibleReportPattern(code: string): string {
  const letters = String(code || "").replace(/[^A-Za-z]/g, "").split("");
  return letters.map((ch) => `${ch}\\.?`).join("\\s*");
}

const REPORT_ABBRS = REPORT_CODES.map((code) => buildFlexibleReportPattern(code)).join("|");
const REPORT_NORMALIZERS = REPORT_CODES.map((code) => ({
  canonical: code,
  regex: new RegExp(`\\b${buildFlexibleReportPattern(code)}\\b`, "gi"),
}));

const YEAR_PATTERN = "(?:19|20)\\d{2}";
const PAGE_PATTERN = "\\d{1,6}";
const INTER_TOKEN_SEP = "\\s*[,;:/-]?\\s*";
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
const NEUTRAL_COURT_ABBRS = NEUTRAL_COURT_CODES.map((code) => buildFlexibleReportPattern(code)).join("|");
const COURT_NAMES = "Supreme\\s+Court|S\\.?C\\.?|Lah\\.?|Lahore|Lhr\\.?|Sindh|Sind\\.?|Kar\\.?|Karachi|Pesh\\.?|Peshawar|Bal\\.?|Balochistan|Quetta|Islamabad|ISB|I\\.?H\\.?C\\.?|S\\.?H\\.?C\\.?|P\\.?H\\.?C\\.?|B\\.?H\\.?C\\.?|Federal\\s+Shariat|FSC|Rawalpindi|Multan|Bahawalpur|D\\.?B\\.?|F\\.?B\\.?|Tribunal|ATIR|Appellate\\s+Tribunal|Azad\\s+J\\.?\\s*(?:&|and)\\s*K\\.?|Azad\\s+Jammu\\s*(?:&|and)\\s*Kashmir|A\\.?J\\.?K\\.?|A\\.?J\\.?K\\.?H\\.?C\\.?|P\\.?\\s*C\\.?|Privy\\s+Council";

const CITATION_PATTERNS: RegExp[] = [
  new RegExp(`\\b${YEAR_PATTERN}\\s*(?:${NEUTRAL_COURT_ABBRS})\\s*${PAGE_PATTERN}\\b`, "gi"),
  new RegExp(`(?:${REPORT_ABBRS})${INTER_TOKEN_SEP}${YEAR_PATTERN}${INTER_TOKEN_SEP}(?:${COURT_NAMES})${INTER_TOKEN_SEP}${PAGE_PATTERN}`, "gi"),
  new RegExp(`(?:${REPORT_ABBRS})${INTER_TOKEN_SEP}${YEAR_PATTERN}${INTER_TOKEN_SEP}${PAGE_PATTERN}`, "gi"),
  new RegExp(`${YEAR_PATTERN}${INTER_TOKEN_SEP}(?:${REPORT_ABBRS})${INTER_TOKEN_SEP}(?:${COURT_NAMES})${INTER_TOKEN_SEP}${PAGE_PATTERN}`, "gi"),
  new RegExp(`${YEAR_PATTERN}${INTER_TOKEN_SEP}(?:${REPORT_ABBRS})${INTER_TOKEN_SEP}${PAGE_PATTERN}`, "gi"),
  new RegExp(`\\(${YEAR_PATTERN}\\)${INTER_TOKEN_SEP}(?:${REPORT_ABBRS})${INTER_TOKEN_SEP}(?:${COURT_NAMES})?${INTER_TOKEN_SEP}${PAGE_PATTERN}`, "gi"),
  new RegExp(`(?:${REPORT_ABBRS})${INTER_TOKEN_SEP}\\(${YEAR_PATTERN}\\)${INTER_TOKEN_SEP}(?:${COURT_NAMES})?${INTER_TOKEN_SEP}${PAGE_PATTERN}`, "gi"),
  new RegExp(`(?:${REPORT_ABBRS})${INTER_TOKEN_SEP}(?:${COURT_NAMES})${INTER_TOKEN_SEP}${YEAR_PATTERN}${INTER_TOKEN_SEP}${PAGE_PATTERN}`, "gi"),
];

const COURT_MAP: Array<[RegExp, string]> = [
  [/\bSupreme\s+Court\b|(?<!\w)S\.?C\.?(?!\w)/i, "Supreme Court of Pakistan"],
  [/\bAzad\s+J(?:ammu)?\s*(?:&|and)\s*K(?:ashmir)?\b|(?<!\w)A\.?J\.?K\.?(?!\w)/i, "High Court of Azad Jammu and Kashmir"],
  [/\bPrivy\s+Council\b|(?<!\w)P\.?\s*C\.?(?!\w)/i, "Privy Council"],
  [/\bLah(?:ore)?\.?\b/i, "Lahore High Court"],
  [/\bSindh\b|(?<!\w)Kar(?:achi)?\.?(?!\w)/i, "Sindh High Court"],
  [/\bPesh(?:awar)?\.?\b/i, "Peshawar High Court"],
  [/\bBal(?:ochistan)?\.?\b|(?<!\w)Quetta(?!\w)/i, "Balochistan High Court"],
  [/\bIslamabad\b|(?<!\w)ISB(?!\w)/i, "Islamabad High Court"],
  [/\bFederal\s+Shariat\b|(?<!\w)FSC(?!\w)/i, "Federal Shariat Court"],
  [/\bRawalpindi\b/i, "Lahore High Court (Rawalpindi Bench)"],
  [/\bMultan\b/i, "Lahore High Court (Multan Bench)"],
  [/\bBahawalpur\b/i, "Lahore High Court (Bahawalpur Bench)"],
  [/\bTribunal\b|(?<!\w)ATIR(?!\w)/i, "Appellate Tribunal"],
];

const REPORT_COURT_DEFAULT: Record<string, string> = {
  "scmr": "Supreme Court of Pakistan",
  "psc": "Supreme Court of Pakistan",
  "ptd": "",
  "ptcl": "",
};

const LEGAL_KEYWORDS_MAP: Record<string, string[]> = {
  "murder": ["criminal law", "murder", "PPC"],
  "bail": ["bail", "criminal procedure", "CrPC"],
  "habeas corpus": ["habeas corpus", "fundamental rights", "constitutional law"],
  "writ": ["writ petition", "constitutional law", "judicial review"],
  "divorce": ["family law", "divorce", "khula"],
  "maintenance": ["family law", "maintenance", "nafaqa"],
  "custody": ["family law", "custody", "guardian"],
  "property": ["property law", "land", "civil law"],
  "contract": ["contract law", "agreement", "breach"],
  "rent": ["tenancy", "rent", "landlord"],
  "fraud": ["fraud", "criminal law", "cheating"],
  "theft": ["theft", "criminal law", "PPC"],
  "appeal": ["appeal", "appellate jurisdiction"],
  "revision": ["revision", "revisional jurisdiction"],
  "injunction": ["injunction", "civil procedure"],
  "specific performance": ["specific performance", "contract"],
  "declaration": ["declaration", "civil suit"],
  "partition": ["partition", "property"],
  "pre-emption": ["pre-emption", "property law"],
  "election": ["election law", "disqualification"],
  "tax": ["taxation", "income tax", "revenue"],
  "customs": ["customs", "import", "export"],
  "banking": ["banking law", "financial"],
  "labour": ["labour law", "employment", "worker rights"],
  "service": ["service law", "civil servant"],
  "constitution": ["constitutional law", "fundamental rights"],
  "terrorism": ["anti-terrorism", "ATA"],
  "narcotics": ["narcotics", "CNSA", "drug offence"],
  "qisas": ["qisas", "diyat", "Islamic criminal law"],
  "diyat": ["diyat", "qisas", "blood money"],
  "zina": ["zina", "hudood"],
  "blasphemy": ["blasphemy", "PPC 295"],
  "corruption": ["corruption", "NAB", "accountability"],
  "contempt": ["contempt of court", "judicial authority"],
  "execution": ["execution", "decree", "CPC"],
  "limitation": ["limitation", "time-barred"],
  "registration": ["registration", "Registration Act"],
  "succession": ["succession", "inheritance", "Islamic law"],
  "arbitration": ["arbitration", "dispute resolution"],
  "insurance": ["insurance", "claim"],
  "company": ["company law", "corporate"],
  "negligence": ["negligence", "tort", "damages"],
  "compensation": ["compensation", "damages"],
  "acquittal": ["acquittal", "criminal law"],
  "conviction": ["conviction", "criminal law"],
  "fir": ["FIR", "criminal procedure", "police"],
  "investigation": ["investigation", "criminal procedure"],
  "witness": ["witness", "evidence", "QSO"],
  "evidence": ["evidence", "QSO", "Qanun-e-Shahadat"],
};

function normalizeCitation(raw: string): string {
  let out = raw
    .replace(/[,:;]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "");
  for (const normalizer of NEUTRAL_COURT_NORMALIZERS) {
    out = out.replace(
      normalizer.regex,
      (_m, year, numberPart) => `${year}${normalizer.code}${Number(numberPart)}`,
    );
  }
  for (const normalizer of REPORT_NORMALIZERS) {
    out = out.replace(normalizer.regex, normalizer.canonical);
  }
  return out.trim();
}

function normalizeCitationKey(citation: string): string {
  return normalizeCitation(citation).toLowerCase();
}

function escapeRegex(value: string): string {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractCitationMentionsFromText(text: string): CitationMention[] {
  const mentions = new Map<string, CitationMention>();

  for (const pattern of CITATION_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
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

function inferPrimaryCitation(text: string, mentions: CitationMention[], preferredPrimaryCitation?: string | null): string | null {
  if (mentions.length === 0) return null;
  const preferred = normalizeCitation(String(preferredPrimaryCitation || ""));
  if (preferred) return preferred;
  const headWindow = text.slice(0, Math.min(text.length, 4000));

  for (const mention of mentions) {
    const citationEscaped = escapeRegex(mention.citation);
    const explicitPattern = new RegExp(
      `(?:reported\\s+as|case\\s+reported\\s+at|citation\\s*[:\\-])\\s*${citationEscaped}`,
      "i",
    );
    if (explicitPattern.test(headWindow)) {
      return mention.citation;
    }
  }

  const captionIndex = headWindow.search(/\b(?:vs?\.?|versus|v\.?)\b/i);
  if (captionIndex >= 0) {
    const nearCaption = mentions.find((mention) => mention.index <= captionIndex + 1200);
    if (nearCaption) return nearCaption.citation;
  }

  const topMention = mentions.find((mention) => mention.index < 1600);
  if (topMention) return topMention.citation;
  return mentions[0].citation;
}

function extractNeutralCitationFromSourceFilename(sourceFilename?: string): string | null {
  const raw = String(sourceFilename || "").trim();
  if (!raw) return null;
  const basename = raw.replace(/\.[^.]+$/g, "");
  for (const normalizer of NEUTRAL_COURT_NORMALIZERS) {
    normalizer.regex.lastIndex = 0;
    const match = normalizer.regex.exec(basename);
    if (!match) continue;
    const year = Number(match[1]);
    const numberPart = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(numberPart) || numberPart < 1) continue;
    return `${year}${normalizer.code}${numberPart}`;
  }
  return null;
}

function addPreferredPrimaryMention(mentions: CitationMention[], preferredPrimaryCitation?: string | null): CitationMention[] {
  const preferred = normalizeCitation(String(preferredPrimaryCitation || ""));
  if (!preferred) return mentions;
  const preferredKey = normalizeCitationKey(preferred);
  const alreadyPresent = mentions.some((mention) => normalizeCitationKey(mention.citation) === preferredKey);
  if (alreadyPresent) return mentions;
  return [{ citation: preferred, index: -1 }, ...mentions];
}

function inferCourt(citation: string): string {
  const canonicalNeutral = citation.match(new RegExp(`\\b(${YEAR_PATTERN})(LHC|IHC|SHC|PHC|BHC|AJKHC)(${PAGE_PATTERN})\\b`, "i"));
  if (canonicalNeutral) {
    return NEUTRAL_COURT_CODE_MAP[String(canonicalNeutral[2]).toUpperCase()] || "";
  }
  const flexibleNeutral = citation.match(new RegExp(`\\b${YEAR_PATTERN}\\s*(?:${NEUTRAL_COURT_ABBRS})\\s*${PAGE_PATTERN}\\b`, "i"));
  if (flexibleNeutral) {
    for (const code of NEUTRAL_COURT_CODES) {
      if (new RegExp(buildFlexibleReportPattern(code), "i").test(flexibleNeutral[0])) {
        return NEUTRAL_COURT_CODE_MAP[code];
      }
    }
  }
  for (const [pattern, court] of COURT_MAP) {
    if (pattern.test(citation)) {
      return court;
    }
  }

  const lower = citation.toLowerCase();
  for (const [report, court] of Object.entries(REPORT_COURT_DEFAULT)) {
    if (lower.includes(report) && court) {
      return court;
    }
  }

  return "";
}

function findTitleNearCitation(text: string, citation: string, hintIndex?: number): string {
  const idx = text.indexOf(citation);
  const searchIdx = idx !== -1 ? idx : (Number.isInteger(hintIndex) ? Number(hintIndex) : 0);

  const searchStart = Math.max(0, searchIdx - 500);
  const searchEnd = Math.min(text.length, searchIdx + citation.length + 500);
  const context = text.substring(searchStart, searchEnd);

  const titlePatterns = [
    /(?:(?:Mst\.?|Dr\.?|Mr\.?|Mrs\.?|M\/s\.?|Govt\.?|Government|State|Federation|Province|Commissioner|Secretary|Chairman|Inspector|SHO|DSP|SSP|DPO|Advocate|Barrister)\s+)?([A-Z][\w.']+(?:\s+(?:and|&)\s+(?:others?|another|etc\.?))?(?:\s+[\w.']+)*)\s+(?:vs?\.?|versus|Vs?\.?|V\.?S\.?)\s+(?:(?:Mst\.?|Dr\.?|Mr\.?|Mrs\.?|M\/s\.?|Govt\.?|Government|State|Federation|Province|Commissioner|Secretary|Chairman|Inspector|SHO|DSP|SSP|DPO|Advocate|Barrister)\s+)?([A-Z][\w.']+(?:\s+(?:and|&)\s+(?:others?|another|etc\.?))?(?:\s+[\w.']+)*)/gi,
    new RegExp(`([A-Z][\\w\\s.']+?)\\s+(?:vs?\\.?|versus)\\s+([A-Z][\\w\\s.']+?)(?=\\s*[,.\n(]|\\s+\\d{4}|\\s+(?:${REPORT_ABBRS}))`, "gi"),
  ];

  for (const pattern of titlePatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(context);
    if (match) {
      const fullMatch = match[0].trim();
      if (fullMatch.length > 5 && fullMatch.length < 250) {
        return fullMatch
          .replace(/\s+/g, " ")
          .replace(/[,.]$/, "")
          .trim();
      }
    }
  }

  return "";
}

function extractSummaryNearCitation(text: string, citation: string, hintIndex?: number): string {
  const idx = text.indexOf(citation);
  const searchIdx = idx !== -1 ? idx : (Number.isInteger(hintIndex) ? Number(hintIndex) : -1);
  if (searchIdx === -1) return "";

  const afterCitation = text.substring(searchIdx + citation.length, searchIdx + citation.length + 1000);

  const cleaned = afterCitation.replace(/^\s*[,;:\-–—.)\]]+\s*/, "");

  const sentenceEnders = /[.!?]\s+/;
  const parts = cleaned.split(sentenceEnders);
  const sentences = parts
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.length < 500 && /[a-zA-Z]/.test(s));

  if (sentences.length >= 2) {
    return sentences.slice(0, 2).join(". ").trim() + ".";
  } else if (sentences.length === 1) {
    return sentences[0].trim() + ".";
  }

  return "";
}

function extractKeywords(text: string, citation: string, hintIndex?: number): string[] {
  const idx = text.indexOf(citation);
  const searchIdx = idx !== -1 ? idx : (Number.isInteger(hintIndex) ? Number(hintIndex) : 0);
  const contextStart = Math.max(0, searchIdx - 500);
  const contextEnd = Math.min(text.length, searchIdx + citation.length + 500);
  const context = text.substring(contextStart, contextEnd).toLowerCase();

  const keywords = new Set<string>();

  for (const [term, relatedKeywords] of Object.entries(LEGAL_KEYWORDS_MAP)) {
    if (context.includes(term.toLowerCase())) {
      for (const kw of relatedKeywords.slice(0, 2)) {
        keywords.add(kw);
      }
    }
  }

  const reportMatch = citation.match(new RegExp(REPORT_ABBRS, "i"));
  if (reportMatch) {
    keywords.add(reportMatch[0].toUpperCase().replace(/[^A-Z0-9]/g, ""));
  }

  if (keywords.size === 0) {
    keywords.add("Pakistani law");
    keywords.add("case law");
  }

  return Array.from(keywords).slice(0, 8);
}

export function assignCitationRolesToCases(
  text: string,
  cases: Array<Pick<ExtractedCase, "citation" | "court" | "title" | "summary" | "keywords">>,
  options?: CitationRoleAssignmentOptions,
): ExtractedCase[] {
  if (!Array.isArray(cases) || cases.length === 0) return [];

  const filenamePrimary = extractNeutralCitationFromSourceFilename(options?.sourceFilename);
  const preferredPrimary = options?.preferredPrimaryCitation || filenamePrimary;
  const mentions = addPreferredPrimaryMention(extractCitationMentionsFromText(text || ""), preferredPrimary);
  const inferredPrimary = inferPrimaryCitation(text || "", mentions, preferredPrimary);
  const inferredPrimaryKey = inferredPrimary ? normalizeCitationKey(inferredPrimary) : "";

  let assignedPrimary = false;
  const mapped = cases.map((item) => {
    const normalizedCitation = normalizeCitation(String(item.citation || ""));
    const citation = normalizedCitation || String(item.citation || "").trim();
    const citationKey = normalizeCitationKey(citation);
    const isPrimary = !assignedPrimary && !!citationKey && citationKey === inferredPrimaryKey;
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

  if (!assignedPrimary && mapped.length > 0) {
    mapped[0].citationRole = "primary";
  }
  return mapped;
}

export function nlpExtractCases(text: string, options?: CitationRoleAssignmentOptions): ExtractedCase[] {
  const filenamePrimary = extractNeutralCitationFromSourceFilename(options?.sourceFilename);
  const preferredPrimary = options?.preferredPrimaryCitation || filenamePrimary;
  const mentions = addPreferredPrimaryMention(extractCitationMentionsFromText(text), preferredPrimary);
  const cases: ExtractedCase[] = [];
  const inferredPrimary = inferPrimaryCitation(text, mentions, preferredPrimary);
  const inferredPrimaryKey = inferredPrimary ? normalizeCitationKey(inferredPrimary) : "";
  let assignedPrimary = false;

  for (const mention of mentions) {
    const citation = mention.citation;
    const court = inferCourt(citation);
    const title = findTitleNearCitation(text, citation, mention.index);
    const summary = extractSummaryNearCitation(text, citation, mention.index);
    const keywords = extractKeywords(text, citation, mention.index);
    const citationKey = normalizeCitationKey(citation);
    const isPrimary = !assignedPrimary && citationKey === inferredPrimaryKey;
    if (isPrimary) assignedPrimary = true;

    cases.push({
      citation,
      citationRole: isPrimary ? "primary" : "cited",
      court,
      title: title || `Case reported at ${citation}`,
      summary: summary || `Case cited as ${citation}`,
      keywords,
    });
  }

  if (!assignedPrimary && cases.length > 0) {
    cases[0].citationRole = "primary";
  }
  return cases;
}

async function loadKnownCitations(): Promise<void> {
  if (knownCitationsLoaded) return;
  try {
    const existing = await storage.getCaseLawCitations();
    for (const c of existing) {
      knownCitations.add(c);
    }
    knownCitationsLoaded = true;
  } catch (err: any) {
    console.error("[Auto-Extract] Failed to load known citations:", err?.message);
  }
}

export function queueAutoExtraction(text: string, source: string, opts?: { sourceDocId?: number; sourceType?: string; sourceFilename?: string }): void {
  if (!text || text.length < 100) return;
  const safeText = text.replace(/\x00/g, "").trim().slice(0, MAX_ITEM_TEXT_CHARS);
  if (safeText.length < 100) return;
  if (extractionQueue.length >= MAX_QUEUE_SIZE) {
    console.log(`[Auto-Extract] Queue full (${MAX_QUEUE_SIZE}), skipping: ${source}`);
    return;
  }
  if ((queuedChars + safeText.length) > MAX_TOTAL_QUEUE_CHARS) {
    console.log(`[Auto-Extract] Queue memory cap reached (${MAX_TOTAL_QUEUE_CHARS} chars), skipping: ${source}`);
    return;
  }
  extractionQueue.push({ text: safeText, source, ...opts });
  queuedChars += safeText.length;
  if (!isProcessing) {
    processQueue();
  }
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
): Promise<{ extracted: number; saved: number; skippedKnown: number }> {
  try {
    const extracted = nlpExtractCases(text, { sourceFilename });

    if (extracted.length === 0) {
      return { extracted: 0, saved: 0, skippedKnown: 0 };
    }

    const newCases: ExtractedCase[] = [];
    let skippedKnown = 0;
    const allowExistingUpdates = !!options.allowExistingUpdates;
    for (const c of extracted) {
      if (!c.citation || !c.title) continue;
      const key = c.citation.toLowerCase().trim();
      if (!allowExistingUpdates && knownCitations.has(key)) {
        skippedKnown += 1;
        continue;
      }
      if (!knownCitations.has(key)) {
        knownCitations.add(key);
      }
      newCases.push(c);
    }

    if (newCases.length === 0) {
      return { extracted: extracted.length, saved: 0, skippedKnown };
    }

    const entries = newCases.map(c => ({
      citation: c.citation.trim(),
      citationRole: c.citationRole,
      court: (c.court || "").trim(),
      title: c.title.trim(),
      summary: (c.summary || "").trim(),
      keywords: Array.isArray(c.keywords) ? c.keywords : [],
      sourceDocId: sourceDocId || null,
      sourceType: sourceType || null,
      sourceFilename: sourceFilename || null,
    }));

    await storage.bulkCreateCaseLaw(entries);
    console.log(`[Auto-Extract] Added ${entries.length} new case law entries from: ${source}`);
    return { extracted: extracted.length, saved: entries.length, skippedKnown };
  } catch (err: any) {
    console.error(`[Auto-Extract] Error processing ${source}:`, err?.message || err);
    return { extracted: 0, saved: 0, skippedKnown: 0 };
  }
}

export async function extractFromAllExistingSources(): Promise<void> {
  console.log("[Auto-Extract] Scanning all knowledge sources for case law (NLP mode - no API cost)...");

  try {
    await loadKnownCitations();

    const allGithubDocs = await storage.getAllGithubKnowledge();
    let githubQueued = 0;
    for (const doc of allGithubDocs) {
      if (doc.content && doc.content.length > 200) {
        queueAutoExtraction(doc.content, `github:${doc.filename}`, {
          sourceDocId: doc.id,
          sourceType: "github",
          sourceFilename: doc.filename,
        });
        githubQueued++;
      }
    }
    console.log(`[Auto-Extract] Queued ${githubQueued} GitHub knowledge documents`);

    let adminQueued = 0;
    let adminOffset = 0;
    const PAGE_SIZE = 100;
    while (true) {
      const page = await storage.getAdminKnowledgePage(PAGE_SIZE, adminOffset);
      if (page.items.length === 0) break;
      for (const row of page.items) {
        const doc = await storage.getAdminKnowledgeById(row.id);
        if (!doc || !doc.content || doc.content.length <= 200) continue;
        queueAutoExtraction(doc.content, `admin:${doc.filename}`, {
          sourceDocId: doc.id,
          sourceType: "admin",
          sourceFilename: doc.filename,
        });
        adminQueued++;
      }
      adminOffset += page.items.length;
      if (!page.hasMore) break;
    }
    console.log(`[Auto-Extract] Queued ${adminQueued} admin knowledge documents`);

    let statuteQueued = 0;
    let statuteOffset = 0;
    while (true) {
      const page = await storage.getStatuteDocumentsPage(PAGE_SIZE, statuteOffset);
      if (page.items.length === 0) break;
      for (const row of page.items) {
        const doc = await storage.getStatuteDocument(row.id);
        if (!doc || !doc.content || doc.content.length <= 200) continue;
        queueAutoExtraction(doc.content, `statute:${doc.filename}`, {
          sourceDocId: doc.id,
          sourceType: "statute",
          sourceFilename: doc.filename,
        });
        statuteQueued++;
      }
      statuteOffset += page.items.length;
      if (!page.hasMore) break;
    }
    console.log(`[Auto-Extract] Queued ${statuteQueued} statute documents`);

    const userDocs = await storage.getAllDocuments();
    let userQueued = 0;
    for (const doc of userDocs) {
      if (doc.content && doc.content.length > 200) {
        queueAutoExtraction(doc.content, `user:${doc.title}`, {
          sourceDocId: doc.id,
          sourceType: "user",
          sourceFilename: doc.title || undefined,
        });
        userQueued++;
      }
    }
    console.log(`[Auto-Extract] Queued ${userQueued} user Knowledge Vault documents`);
  } catch (err: any) {
    console.error("[Auto-Extract] Error scanning sources:", err?.message || err);
  }
}

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
  const shouldStop = typeof args?.shouldStop === "function" ? args.shouldStop : () => false;
  const onProgress = typeof args?.onProgress === "function" ? args.onProgress : undefined;

  await loadKnownCitations();
  await storage.resetAllCaseLawCitationRolesToCited();

  const githubDocs = await storage.getAllGithubKnowledge();
  const adminFirstPage = await storage.getAdminKnowledgePage(1, 0);
  const statuteFirstPage = await storage.getStatuteDocumentsPage(1, 0);
  const userDocs = await storage.getAllDocuments();
  const totalDocuments = Number(githubDocs.length || 0)
    + Number(adminFirstPage.total || 0)
    + Number(statuteFirstPage.total || 0)
    + Number(userDocs.length || 0);

  let processedDocuments = 0;
  let extractedCitations = 0;
  let savedCitations = 0;
  let failedDocuments = 0;
  let stopped = false;
  let activeSource: CaseLawRoleReindexProgress["source"] = "github";

  const publish = (done: boolean = false) => {
    onProgress?.({
      running: !done,
      source: activeSource,
      totalDocuments,
      processedDocuments,
      extractedCitations,
      savedCitations,
      failedDocuments,
      stopped,
      done,
    });
  };

  const processDocument = async (
    content: string,
    source: string,
    sourceDocId?: number,
    sourceType?: string,
    sourceFilename?: string,
  ) => {
    if (shouldStop()) {
      stopped = true;
      return;
    }
    const normalized = String(content || "").replace(/\x00/g, "").trim();
    if (normalized.length < 200) {
      processedDocuments += 1;
      publish();
      return;
    }
    try {
      const result = await extractAndSave(
        normalized,
        source,
        sourceDocId,
        sourceType,
        sourceFilename,
        { allowExistingUpdates: true },
      );
      extractedCitations += Number(result.extracted || 0);
      savedCitations += Number(result.saved || 0);
    } catch {
      failedDocuments += 1;
    } finally {
      processedDocuments += 1;
      publish();
    }
  };

  // GitHub knowledge
  activeSource = "github";
  for (const doc of githubDocs) {
    if (stopped) break;
    await processDocument(doc.content || "", `github:${doc.filename}`, doc.id, "github", doc.filename);
  }

  // Admin knowledge vault
  if (!stopped) {
    activeSource = "admin";
    let adminOffset = 0;
    const PAGE_SIZE = 100;
    while (true) {
      if (shouldStop()) {
        stopped = true;
        break;
      }
      const page = await storage.getAdminKnowledgePage(PAGE_SIZE, adminOffset);
      if (page.items.length === 0) break;
      for (const row of page.items) {
        if (shouldStop()) {
          stopped = true;
          break;
        }
        const doc = await storage.getAdminKnowledgeById(row.id);
        if (!doc) {
          processedDocuments += 1;
          publish();
          continue;
        }
        await processDocument(doc.content || "", `admin:${doc.filename}`, doc.id, "admin", doc.filename);
      }
      adminOffset += page.items.length;
      if (!page.hasMore || stopped) break;
    }
  }

  // Statute library documents
  if (!stopped) {
    activeSource = "statute";
    let statuteOffset = 0;
    const PAGE_SIZE = 100;
    while (true) {
      if (shouldStop()) {
        stopped = true;
        break;
      }
      const page = await storage.getStatuteDocumentsPage(PAGE_SIZE, statuteOffset);
      if (page.items.length === 0) break;
      for (const row of page.items) {
        if (shouldStop()) {
          stopped = true;
          break;
        }
        const doc = await storage.getStatuteDocument(row.id);
        if (!doc) {
          processedDocuments += 1;
          publish();
          continue;
        }
        await processDocument(doc.content || "", `statute:${doc.filename}`, doc.id, "statute", doc.filename);
      }
      statuteOffset += page.items.length;
      if (!page.hasMore || stopped) break;
    }
  }

  // User knowledge vault documents
  if (!stopped) {
    activeSource = "user";
    for (const doc of userDocs) {
      if (shouldStop()) {
        stopped = true;
        break;
      }
      await processDocument(doc.content || "", `user:${doc.title}`, doc.id, "user", doc.title || undefined);
    }
  }

  publish(true);
  return {
    totalDocuments,
    processedDocuments,
    extractedCitations,
    savedCitations,
    failedDocuments,
    stopped,
  };
}
