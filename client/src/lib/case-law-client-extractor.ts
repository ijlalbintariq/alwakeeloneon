export type ClientExtractedCase = {
  citation: string;
  court: string;
  title: string;
  summary: string;
  keywords: string[];
};

type ClientExtractResult = {
  supported: boolean;
  reason?: string;
  content?: string;
  cases: ClientExtractedCase[];
};

const REPORT_ABBRS = "PLD|SCMR|YLR|MLD|CLC|PCRLJ|PCr\\.?LJ|PLJ|PLC|NLR|CLD|PTD|PTCL";

const CITATION_PATTERNS: RegExp[] = [
  new RegExp(`(?:${REPORT_ABBRS})\\s+\\d{4}\\s+\\d+`, "gi"),
  new RegExp(`\\d{4}\\s+(?:${REPORT_ABBRS})\\s+\\d+`, "gi"),
  new RegExp(`\\(\\d{4}\\)\\s+(?:${REPORT_ABBRS})\\s+\\d+`, "gi"),
];

function normalizeCitation(raw: string): string {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .replace(/PCr\.?LJ/gi, "PCRLJ")
    .trim();
}

function inferCourt(citation: string): string {
  const value = citation.toLowerCase();
  if (/\bscmr\b|\bpsc\b|supreme\s+court/.test(value)) return "Supreme Court of Pakistan";
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

export async function extractCaseLawInBrowser(file: File, maxBytes: number = 8 * 1024 * 1024): Promise<ClientExtractResult> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!["txt", "text", "md", "json", "csv"].includes(ext)) {
    return { supported: false, reason: "unsupported-extension", cases: [] };
  }
  if (file.size > maxBytes) {
    return { supported: false, reason: "file-too-large", cases: [] };
  }

  const content = (await file.text()).replace(/\x00/g, "").trim();
  if (!content || content.length < 10) {
    return { supported: true, reason: "empty-content", cases: [], content };
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
    return { supported: true, content, cases: dedupeCases(cases) };
  } catch {
    return { supported: false, reason: "parse-failed", cases: [] };
  }
}
