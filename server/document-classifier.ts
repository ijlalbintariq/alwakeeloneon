import { classifyDocumentDomainWithML } from "./ml/ml-client";

export const DOMAIN_TAXONOMY = [
  { key: "civil-litigation", label: "Civil Litigation", keywords: ["civil suit", "civil appeal", "injunction", "plaint", "petition", "writ", "suit", "decree", "summons", "tribunal", "interlocutory", "written statement"] },
  { key: "contracts", label: "Contracts", keywords: ["contract", "agreement", "indemnity", "warranty", "breach of contract", "consideration", "clause", "partnership deed", "lease agreement", "promissory note"] },
  { key: "evidence-notes", label: "Evidence & Notes", keywords: ["evidence", "exhibit", "witness statement", "affidavit", "forensic report", "deposition", "cross examination", "examination in chief", "proof", "annexure", "memo"] },
  { key: "property", label: "Property / Real Estate", keywords: ["property", "land", "real estate", "sale deed", "registry", "tenant", "rent", "lease", "mutation", "allotment", "patwari", "fard", "khasra", "khewat", "inteqal", "shamilat", "ejectment", "partition suit"] },
  { key: "corporate", label: "Corporate / Commercial", keywords: ["company", "corporate", "commercial", "shareholder", "board of directors", "memorandum of association", "articles of association", "merger", "secp", "companies act", "director", "partnership"] },
  { key: "family", label: "Family Law", keywords: ["family court", "nikah", "nikahnama", "khula", "divorce", "maintenance suit", "custody of minor", "guardianship", "inheritance", "dower", "talaq", "dowry", "dissolution of marriage", "jactitation of marriage"] },
  { key: "criminal", label: "Criminal Law", keywords: ["criminal", "fir", "bail", "offence", "ppc", "crpc", "prosecution", "accused", "charge sheet", "sentence", "superdari", "quashment", "anti terrorism", "nab", "cnsa", "cybercrime"] },
  { key: "tax", label: "Tax / Revenue", keywords: ["tax", "fbr", "income tax", "sales tax", "revenue board", "withholding tax", "assessment", "customs act", "excise duty", "refund"] },
  { key: "employment", label: "Labor / Employment", keywords: ["employment", "employee", "employer", "termination", "salary", "wages", "labor court", "gratuity", "service rules", "civil servant", "service tribunal", "pension"] },
  { key: "constitutional", label: "Constitutional", keywords: ["constitution of pakistan", "fundamental rights", "article 199", "article 184", "constitutional petition", "judicial review", "public interest litigation", "suo motu", "quo warranto", "habeas corpus", "mandamus"] },
  { key: "intellectual-property", label: "Intellectual Property", keywords: ["trademark", "copyright", "patent", "ip", "infringement", "design", "licensing", "brand", "passing off"] },
  { key: "other", label: "Other", keywords: [] },
] as const;

export type DomainKey = (typeof DOMAIN_TAXONOMY)[number]["key"];
export type ClassificationMethod = "rule" | "ml" | "fallback";
export type SourceType = "pdf" | "docx" | "txt" | "csv" | "json" | "other";

export type DocumentMetadata = {
  sourceType: SourceType;
  mimeType: string | null;
  fileExtension: string | null;
  detectedDomain: DomainKey;
  detectedDomainLabel: string;
  classificationMethod: ClassificationMethod;
  classificationConfidence: number; // integer 0-100
};

type ScoreRow = {
  key: DomainKey;
  label: string;
  score: number;
};

const DOMAIN_LABEL_MAP = new Map<string, string>(DOMAIN_TAXONOMY.map((d) => [d.key, d.label]));

function cleanText(input: string): string {
  return (input || "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function detectSourceType(filename: string, mimeType?: string | null): { sourceType: SourceType; fileExtension: string | null; mimeType: string | null } {
  const normalizedMime = (mimeType || "").trim().toLowerCase() || null;
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";

  if (ext === "pdf" || normalizedMime?.includes("pdf")) {
    return { sourceType: "pdf", fileExtension: "pdf", mimeType: normalizedMime };
  }
  if (["doc", "docx"].includes(ext) || normalizedMime?.includes("word")) {
    return { sourceType: "docx", fileExtension: ext || "docx", mimeType: normalizedMime };
  }
  if (["txt", "md"].includes(ext) || normalizedMime?.includes("text/plain")) {
    return { sourceType: "txt", fileExtension: ext || "txt", mimeType: normalizedMime };
  }
  if (ext === "csv" || normalizedMime?.includes("csv")) {
    return { sourceType: "csv", fileExtension: "csv", mimeType: normalizedMime };
  }
  if (ext === "json" || normalizedMime?.includes("json")) {
    return { sourceType: "json", fileExtension: "json", mimeType: normalizedMime };
  }

  return {
    sourceType: "other",
    fileExtension: ext || "unknown",
    mimeType: normalizedMime,
  };
}

function scoreByRules(title: string, content: string): { primary: ScoreRow | null; secondary: ScoreRow | null; total: number } {
  const haystack = cleanText(`${title}\n${content}`);
  const rows: ScoreRow[] = DOMAIN_TAXONOMY
    .filter((domain) => domain.key !== "other")
    .map((domain) => {
      let score = 0;
      for (const keyword of domain.keywords) {
        if (!keyword) continue;
        const rx = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (rx.test(haystack)) score += 1;
      }
      return { key: domain.key, label: domain.label, score };
    })
    .sort((a, b) => b.score - a.score);

  const total = rows.reduce((sum, row) => sum + row.score, 0);
  return {
    primary: rows[0] || null,
    secondary: rows[1] || null,
    total,
  };
}

async function classifyWithML(title: string, content: string): Promise<{ key: DomainKey; confidence: number } | null> {
  const response = await classifyDocumentDomainWithML({
    title,
    content,
    taxonomy: DOMAIN_TAXONOMY.map((d) => d.key),
  });

  if (!response?.key) return null;
  if (!DOMAIN_LABEL_MAP.has(response.key)) return null;

  return {
    key: response.key as DomainKey,
    confidence: Math.max(0, Math.min(1, response.confidence)),
  };
}

export async function classifyDocumentMetadata(params: {
  title: string;
  content: string;
  filename: string;
  mimeType?: string | null;
}): Promise<DocumentMetadata> {
  const { sourceType, fileExtension, mimeType } = detectSourceType(params.filename, params.mimeType);
  const rule = scoreByRules(params.title, params.content);

  if (rule.primary && rule.primary.score > 0) {
    const primary = rule.primary;
    const secondary = rule.secondary;
    const isAmbiguous = !!secondary && secondary.score > 0 && primary.score - secondary.score <= 1;

    if (!isAmbiguous && rule.total > 0) {
      const confidence = Math.max(0.35, Math.min(0.95, primary.score / rule.total));
      return {
        sourceType,
        mimeType,
        fileExtension,
        detectedDomain: primary.key,
        detectedDomainLabel: primary.label,
        classificationMethod: "rule",
        classificationConfidence: Math.round(confidence * 100),
      };
    }
  }

  try {
    const ml = await classifyWithML(params.title, params.content);
    if (ml && DOMAIN_LABEL_MAP.has(ml.key)) {
      return {
        sourceType,
        mimeType,
        fileExtension,
        detectedDomain: ml.key,
        detectedDomainLabel: DOMAIN_LABEL_MAP.get(ml.key) || "Other",
        classificationMethod: "ml",
        classificationConfidence: Math.round(ml.confidence * 100),
      };
    }
  } catch {
    // Fall through to fallback metadata.
  }

  return {
    sourceType,
    mimeType,
    fileExtension,
    detectedDomain: "other",
    detectedDomainLabel: "Other",
    classificationMethod: "fallback",
    classificationConfidence: 0,
  };
}
