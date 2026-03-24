export type ClientExtractedCase = {
  citation: string;
  court: string;
  title: string;
  summary: string;
  keywords: string[];
};

export type ClientExtractOptions = {
  enablePdfFastPath?: boolean;
  pdfMaxPages?: number;
  pdfMinConfidence?: number;
};

type ClientExtractResult = {
  supported: boolean;
  reason?: string;
  content?: string;
  cases: ClientExtractedCase[];
  confidence?: number;
  sourceType?: "browser-hybrid" | "browser-pdf-text";
};

const REPORT_CODES = [
  "PLD", "SCMR", "YLR", "MLD", "CLC", "PCRLJ", "PLJ", "PLC", "NLR",
  "CLD", "PTD", "PTCL", "PSC", "ALD", "KLR", "PLS", "GBLR", "TAX", "SLR",
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

function normalizeCitation(raw: string): string {
  let out = String(raw || "")
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

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function inferCourt(citation: string): string {
  const value = citation.toLowerCase();
  if (/\b(?:19|20)\d{2}lhc\d{1,6}\b/.test(value)) return "Lahore High Court";
  if (/\b(?:19|20)\d{2}ihc\d{1,6}\b/.test(value)) return "Islamabad High Court";
  if (/\b(?:19|20)\d{2}shc\d{1,6}\b/.test(value)) return "Sindh High Court";
  if (/\b(?:19|20)\d{2}phc\d{1,6}\b/.test(value)) return "Peshawar High Court";
  if (/\b(?:19|20)\d{2}bhc\d{1,6}\b/.test(value)) return "Balochistan High Court";
  if (/\b(?:19|20)\d{2}ajkhc\d{1,6}\b/.test(value)) return "High Court of Azad Jammu and Kashmir";
  if (/\bscmr\b|\bpsc\b|supreme\s+court/.test(value)) return "Supreme Court of Pakistan";
  if (/\bazad\s+j(?:ammu)?\s*(?:&|and)\s*k(?:ashmir)?\b|\ba\.?j\.?k\.?\b/.test(value)) return "High Court of Azad Jammu and Kashmir";
  if (/\bprivy\s+council\b|\bp\.?\s*c\.?\b/.test(value)) return "Privy Council";
  if (/\blhc\b|lahore/.test(value)) return "Lahore High Court";
  if (/\bshc\b|sindh|karachi/.test(value)) return "Sindh High Court";
  if (/\bphc\b|peshawar/.test(value)) return "Peshawar High Court";
  if (/\bbhc\b|balochistan|quetta/.test(value)) return "Balochistan High Court";
  if (/\bihc\b|islamabad/.test(value)) return "Islamabad High Court";
  if (/\bfsc\b|federal\s+shariat/.test(value)) return "Federal Shariat Court";
  return "";
}

function extractCasesFromFreeText(content: string): ClientExtractedCase[] {
  const citationSet = new Set<string>();
  for (const pattern of CITATION_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const normalized = normalizeCitation(match[0]);
      if (normalized.length >= 8) citationSet.add(normalized);
      if (citationSet.size >= 2000) break;
    }
    if (citationSet.size >= 2000) break;
  }

  return Array.from(citationSet).map((citation) => ({
    citation,
    court: inferCourt(citation),
    title: `Case reported at ${citation}`,
    summary: `Case cited as ${citation}`,
    keywords: ["Pakistani law", "case law"],
  }));
}

function parseJsonCases(rawJson: string): ClientExtractedCase[] {
  const parsed = JSON.parse(rawJson);
  const entries = Array.isArray(parsed)
    ? parsed
    : (parsed?.cases || parsed?.entries || parsed?.data || parsed?.judgments || parsed?.results || [parsed]);
  if (!Array.isArray(entries)) return [];

  const getCitation = (c: any) => c?.citation || c?.case_citation || c?.ref || c?.reference || c?.case_no || c?.case_number || "";
  const getTitle = (c: any) => c?.title || c?.case_title || c?.case_name || c?.name || c?.parties || "";
  return entries
    .filter((c: any) => getCitation(c) || getTitle(c))
    .slice(0, 4000)
    .map((c: any) => ({
      citation: String(getCitation(c)).trim(),
      court: String(c?.court || c?.court_name || c?.forum || "").trim(),
      title: String(getTitle(c)).trim(),
      summary: String(c?.summary || c?.description || c?.abstract || c?.holding || c?.head_note || c?.headnote || "").trim(),
      keywords: Array.isArray(c?.keywords)
        ? c.keywords.map((k: any) => String(k).trim()).filter(Boolean)
        : (typeof c?.keywords === "string" ? c.keywords.split(",").map((k: string) => k.trim()).filter(Boolean) : []),
    }))
    .filter((c) => c.citation && c.title);
}

function parseCsvCases(rawCsv: string): ClientExtractedCase[] {
  const lines = rawCsv.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const citIdx = headers.indexOf("citation");
  const titleIdx = headers.indexOf("title");
  if (citIdx < 0 || titleIdx < 0) return [];

  const courtIdx = headers.indexOf("court");
  const sumIdx = headers.indexOf("summary");
  const kwIdx = headers.indexOf("keywords");
  const out: ClientExtractedCase[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const citation = String(cols[citIdx] || "").trim();
    const title = String(cols[titleIdx] || "").trim();
    if (!citation || !title) continue;
    out.push({
      citation,
      title,
      court: courtIdx >= 0 ? String(cols[courtIdx] || "").trim() : "",
      summary: sumIdx >= 0 ? String(cols[sumIdx] || "").trim() : "",
      keywords: kwIdx >= 0 && cols[kwIdx]
        ? String(cols[kwIdx]).split(";").map((k) => k.trim()).filter(Boolean)
        : [],
    });
    if (out.length >= 4000) break;
  }

  return out;
}

function dedupeCases(cases: ClientExtractedCase[]): ClientExtractedCase[] {
  const out: ClientExtractedCase[] = [];
  const seen = new Set<string>();
  for (const c of cases) {
    const citation = normalizeCitation(c.citation);
    const title = String(c.title || "").trim();
    if (!citation || !title) continue;
    const key = `${citation}|${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      citation,
      court: String(c.court || "").trim(),
      title,
      summary: String(c.summary || "").trim(),
      keywords: Array.isArray(c.keywords) ? c.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 12) : [],
    });
  }
  return out;
}

async function extractPdfTextOnlyInBrowser(file: File, maxPages: number): Promise<{
  content: string;
  confidence: number;
  cases: ClientExtractedCase[];
}> {
  const { extractText } = await import("unpdf");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extracted = await extractText(bytes, { mergePages: false });
  const pages = Array.isArray(extracted?.text) ? extracted.text : [];
  const pageLimit = Math.max(1, Math.min(maxPages, pages.length || 1));
  const textByPage: string[] = [];
  let pagesWithText = 0;

  for (const rawPageText of pages.slice(0, pageLimit)) {
    const pageText = String(rawPageText || "").replace(/\s+/g, " ").trim();
    if (pageText.length >= 30) {
      pagesWithText += 1;
      textByPage.push(pageText);
    }
  }

  const content = textByPage.join("\n\n").trim();
  const cases = content ? dedupeCases(extractCasesFromFreeText(content)) : [];
  const pageCoverage = pagesWithText / pageLimit;
  const charDensity = clamp(content.length / (pageLimit * 1300), 0, 1);
  const citationSignal = clamp(cases.length / 10, 0, 1);
  const confidence = clamp((pageCoverage * 0.45) + (charDensity * 0.4) + (citationSignal * 0.15), 0, 1);

  return { content, confidence, cases };
}

export async function extractCaseLawInBrowser(
  file: File,
  maxBytes: number = 8 * 1024 * 1024,
  options: ClientExtractOptions = {},
): Promise<ClientExtractResult> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const supportsPdfFastPath = Boolean(options.enablePdfFastPath);
  const allowedExtensions = supportsPdfFastPath
    ? ["txt", "text", "md", "json", "csv", "pdf"]
    : ["txt", "text", "md", "json", "csv"];
  if (!allowedExtensions.includes(ext)) {
    return { supported: false, reason: "unsupported-extension", cases: [] };
  }
  if (file.size > maxBytes) {
    return { supported: false, reason: "file-too-large", cases: [] };
  }

  if (ext === "pdf") {
    try {
      const { content, confidence, cases } = await extractPdfTextOnlyInBrowser(file, Math.max(1, options.pdfMaxPages || 20));
      const minConfidence = clamp(options.pdfMinConfidence ?? 0.45, 0, 1);
      if (!content || content.length < 120) {
        return { supported: true, reason: "pdf-empty-text", cases: [], content, confidence, sourceType: "browser-pdf-text" };
      }
      if (confidence < minConfidence || cases.length === 0) {
        return { supported: true, reason: "pdf-low-confidence", cases, content, confidence, sourceType: "browser-pdf-text" };
      }
      return { supported: true, content, cases, confidence, sourceType: "browser-pdf-text" };
    } catch {
      return { supported: false, reason: "pdf-parse-failed", cases: [] };
    }
  }

  const content = (await file.text()).replace(/\x00/g, "").trim();
  if (!content || content.length < 10) {
    return { supported: true, reason: "empty-content", cases: [], content, confidence: 0, sourceType: "browser-hybrid" };
  }

  try {
    let cases: ClientExtractedCase[] = [];
    if (ext === "json") {
      cases = parseJsonCases(content);
    } else if (ext === "csv") {
      cases = parseCsvCases(content);
    } else {
      cases = extractCasesFromFreeText(content);
    }
    return { supported: true, content, cases: dedupeCases(cases), confidence: 1, sourceType: "browser-hybrid" };
  } catch {
    return { supported: false, reason: "parse-failed", cases: [] };
  }
}
