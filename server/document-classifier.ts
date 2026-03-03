import OpenAI from "openai";

export const DOMAIN_TAXONOMY = [
  { key: "civil-litigation", label: "Civil Litigation", keywords: ["civil", "injunction", "appeal", "plaint", "petition", "writ", "suit", "decree", "summons", "tribunal"] },
  { key: "contracts", label: "Contracts", keywords: ["contract", "agreement", "indemnity", "warranty", "breach", "consideration", "clause", "party", "purchase", "lease agreement"] },
  { key: "evidence-notes", label: "Evidence & Notes", keywords: ["evidence", "exhibit", "statement", "affidavit", "forensic", "note", "witness", "proof", "annexure", "memo"] },
  { key: "property", label: "Property / Real Estate", keywords: ["property", "land", "real estate", "sale deed", "registry", "tenant", "rent", "lease", "mutation", "allotment"] },
  { key: "corporate", label: "Corporate / Commercial", keywords: ["company", "corporate", "commercial", "shareholder", "board", "memorandum", "articles", "merger", "acquisition", "director"] },
  { key: "family", label: "Family Law", keywords: ["family", "nikah", "khula", "divorce", "maintenance", "custody", "guardianship", "inheritance", "dower", "talaq"] },
  { key: "criminal", label: "Criminal Law", keywords: ["criminal", "fir", "bail", "offence", "ppc", "crpc", "prosecution", "accused", "charge", "sentence"] },
  { key: "tax", label: "Tax / Revenue", keywords: ["tax", "fbr", "income tax", "sales tax", "revenue", "withholding", "assessment", "customs", "duty", "refund"] },
  { key: "employment", label: "Labor / Employment", keywords: ["employment", "employee", "employer", "termination", "salary", "wages", "labor", "gratuity", "service rules", "hr"] },
  { key: "constitutional", label: "Constitutional", keywords: ["constitution", "fundamental rights", "article", "constitutional petition", "article 199", "article 184", "judicial review", "public interest"] },
  { key: "intellectual-property", label: "Intellectual Property", keywords: ["trademark", "copyright", "patent", "ip", "infringement", "design", "licensing", "brand", "passing off"] },
  { key: "other", label: "Other", keywords: [] },
] as const;

export type DomainKey = (typeof DOMAIN_TAXONOMY)[number]["key"];
export type ClassificationMethod = "rule" | "ai" | "fallback";
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

function parseAiJson(raw: string): { key?: string; confidence?: number } | null {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const jsonSlice = cleaned.slice(start, end + 1);
  try {
    const parsed = JSON.parse(jsonSlice);
    return typeof parsed === "object" && parsed ? parsed : null;
  } catch {
    return null;
  }
}

function resolveAiClient(): { client: OpenAI; model: string } | null {
  if (process.env.OPENROUTER_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "https://al-wakeelo.replit.app",
          "X-Title": "Al Wakeelo Legal Assistant",
        },
      }),
      model: "google/gemini-2.0-flash-001",
    };
  }

  if (process.env.OPENAI_API_KEY && !/^replace_/i.test((process.env.OPENAI_API_KEY || "").trim())) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: "gpt-4o-mini",
    };
  }

  return null;
}

async function classifyWithAI(title: string, content: string): Promise<{ key: DomainKey; confidence: number } | null> {
  const resolved = resolveAiClient();
  if (!resolved) return null;

  const taxonomyText = DOMAIN_TAXONOMY.map((d) => `- ${d.key}: ${d.label}`).join("\n");
  const input = `${title}\n\n${content}`.slice(0, 8000);

  const response = await resolved.client.chat.completions.create({
    model: resolved.model,
    temperature: 0,
    response_format: { type: "json_object" },
    max_tokens: 120,
    messages: [
      {
        role: "system",
        content: `Classify Pakistani legal documents into one taxonomy key. Return strict JSON: {"key":"<taxonomy>","confidence":<0-1>}. Keys:\n${taxonomyText}`,
      },
      {
        role: "user",
        content: input,
      },
    ],
  });

  const raw = response.choices?.[0]?.message?.content || "";
  const parsed = parseAiJson(raw);
  if (!parsed?.key || typeof parsed.key !== "string") return null;

  const normalizedKey = parsed.key.trim().toLowerCase();
  if (!DOMAIN_LABEL_MAP.has(normalizedKey)) return null;

  const confidenceRaw = typeof parsed.confidence === "number" ? parsed.confidence : 0.55;
  const confidence = Math.max(0, Math.min(1, confidenceRaw));

  return { key: normalizedKey as DomainKey, confidence };
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
    const ai = await classifyWithAI(params.title, params.content);
    if (ai && DOMAIN_LABEL_MAP.has(ai.key)) {
      return {
        sourceType,
        mimeType,
        fileExtension,
        detectedDomain: ai.key,
        detectedDomainLabel: DOMAIN_LABEL_MAP.get(ai.key) || "Other",
        classificationMethod: "ai",
        classificationConfidence: Math.round(ai.confidence * 100),
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
