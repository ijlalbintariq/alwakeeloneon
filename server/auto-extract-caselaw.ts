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
  court: string;
  title: string;
  summary: string;
  keywords: string[];
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

const COURT_NAMES = "Supreme\\s+Court|S\\.?C\\.?|Lah\\.?|Lahore|Sindh|Kar\\.?|Karachi|Pesh\\.?|Peshawar|Bal\\.?|Balochistan|Quetta|Islamabad|ISB|Federal\\s+Shariat|FSC|Rawalpindi|Multan|Bahawalpur|D\\.?B\\.?|F\\.?B\\.?|Tribunal|ATIR|Appellate\\s+Tribunal";

const CITATION_PATTERNS: RegExp[] = [
  new RegExp(`(?:${REPORT_ABBRS})\\s+\\d{4}\\s+(?:${COURT_NAMES})\\s+\\d+`, "gi"),
  new RegExp(`(?:${REPORT_ABBRS})\\s+\\d{4}\\s+\\d+`, "gi"),
  new RegExp(`\\d{4}\\s+(?:${REPORT_ABBRS})\\s+\\d+`, "gi"),
  new RegExp(`\\(\\d{4}\\)\\s+(?:${REPORT_ABBRS})\\s+\\d+`, "gi"),
  new RegExp(`(?:${REPORT_ABBRS})\\s*\\(\\d{4}\\)\\s+\\d+`, "gi"),
];

const COURT_MAP: Array<[RegExp, string]> = [
  [/\bSupreme\s+Court\b|(?<!\w)S\.?C\.?(?!\w)/i, "Supreme Court of Pakistan"],
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
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "");
  for (const normalizer of REPORT_NORMALIZERS) {
    out = out.replace(normalizer.regex, normalizer.canonical);
  }
  return out.trim();
}

function extractCitationsFromText(text: string): string[] {
  const citationSet = new Set<string>();

  for (const pattern of CITATION_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const normalized = normalizeCitation(match[0]);
      if (normalized.length >= 8) {
        citationSet.add(normalized);
      }
    }
  }

  return Array.from(citationSet);
}

function inferCourt(citation: string): string {
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

function findTitleNearCitation(text: string, citation: string): string {
  const idx = text.indexOf(citation);
  const searchIdx = idx !== -1 ? idx : 0;

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

function extractSummaryNearCitation(text: string, citation: string): string {
  const idx = text.indexOf(citation);
  if (idx === -1) return "";

  const afterCitation = text.substring(idx + citation.length, idx + citation.length + 1000);

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

function extractKeywords(text: string, citation: string): string[] {
  const idx = text.indexOf(citation);
  const contextStart = Math.max(0, (idx !== -1 ? idx : 0) - 500);
  const contextEnd = Math.min(text.length, (idx !== -1 ? idx : 0) + citation.length + 500);
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

export function nlpExtractCases(text: string): ExtractedCase[] {
  const citations = extractCitationsFromText(text);
  const cases: ExtractedCase[] = [];

  for (const citation of citations) {
    const court = inferCourt(citation);
    const title = findTitleNearCitation(text, citation);
    const summary = extractSummaryNearCitation(text, citation);
    const keywords = extractKeywords(text, citation);

    cases.push({
      citation,
      court,
      title: title || `Case reported at ${citation}`,
      summary: summary || `Case cited as ${citation}`,
      keywords,
    });
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

async function extractAndSave(text: string, source: string, sourceDocId?: number, sourceType?: string, sourceFilename?: string): Promise<void> {
  try {
    const extracted = nlpExtractCases(text);

    if (extracted.length === 0) {
      return;
    }

    const newCases: ExtractedCase[] = [];
    for (const c of extracted) {
      if (!c.citation || !c.title) continue;
      const key = c.citation.toLowerCase().trim();
      if (knownCitations.has(key)) continue;
      knownCitations.add(key);
      newCases.push(c);
    }

    if (newCases.length === 0) {
      return;
    }

    const entries = newCases.map(c => ({
      citation: c.citation.trim(),
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
  } catch (err: any) {
    console.error(`[Auto-Extract] Error processing ${source}:`, err?.message || err);
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
