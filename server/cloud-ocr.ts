import type { OcrPdfResult } from "./ocr";

const CLOUD_OCR_PROVIDER = String(process.env.CLOUD_OCR_PROVIDER || "ocrspace").trim().toLowerCase();
const OCRSPACE_API_KEY = String(process.env.OCRSPACE_API_KEY || "").trim();
const OCRSPACE_ENDPOINT = String(process.env.OCRSPACE_ENDPOINT || "https://api.ocr.space/parse/image").trim();
const OCRSPACE_ENGINE = String(process.env.OCRSPACE_ENGINE || "2").trim();

function cleanText(value: string): string {
  return String(value || "").replace(/\x00/g, "").trim();
}

function resolveLanguage(requested?: string): string {
  const raw = String(requested || process.env.CLOUD_OCR_LANG || "eng").toLowerCase();
  if (raw.includes("urd")) return "ara";
  if (raw.includes("english") || raw.includes("eng")) return "eng";
  return raw || "eng";
}

export function getCloudPdfOcrProviderName(): string {
  return CLOUD_OCR_PROVIDER || "none";
}

export function isCloudPdfOcrAvailable(): boolean {
  if (!CLOUD_OCR_PROVIDER || CLOUD_OCR_PROVIDER === "none") return false;
  if (CLOUD_OCR_PROVIDER === "ocrspace") {
    return OCRSPACE_API_KEY.length > 0;
  }
  return false;
}

export async function ocrPdfWithCloud(
  pdfBuffer: Buffer,
  options: {
    filename?: string;
    language?: string;
    timeoutMs?: number;
  } = {},
): Promise<OcrPdfResult> {
  if (CLOUD_OCR_PROVIDER !== "ocrspace") {
    throw new Error(`Unsupported cloud OCR provider: ${CLOUD_OCR_PROVIDER || "none"}`);
  }
  if (!OCRSPACE_API_KEY) {
    throw new Error("OCRSPACE_API_KEY is not configured.");
  }

  const timeoutMs = Math.min(Math.max(5000, Number(options.timeoutMs || process.env.CLOUD_OCR_TIMEOUT_MS || 120000)), 600000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const language = resolveLanguage(options.language);
    const form = new FormData();
    form.append("apikey", OCRSPACE_API_KEY);
    form.append("isOverlayRequired", "false");
    form.append("language", language);
    form.append("OCREngine", OCRSPACE_ENGINE);
    form.append("scale", "true");
    form.append("detectOrientation", "true");
    form.append(
      "file",
      new Blob([pdfBuffer], { type: "application/pdf" }),
      options.filename || "document.pdf",
    );

    const res = await fetch(OCRSPACE_ENDPOINT, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    const body = await res.text();
    if (!res.ok) {
      throw new Error(`OCR.space HTTP ${res.status}: ${body.slice(0, 240)}`);
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error(`OCR.space returned non-JSON response: ${body.slice(0, 240)}`);
    }

    const pageTexts = Array.isArray(parsed?.ParsedResults)
      ? parsed.ParsedResults.map((item: any) => cleanText(String(item?.ParsedText || ""))).filter(Boolean)
      : [];
    const text = cleanText(pageTexts.join("\n\n"));

    if (!text) {
      const errMsg =
        (Array.isArray(parsed?.ErrorMessage) ? parsed.ErrorMessage.join("; ") : parsed?.ErrorMessage) ||
        parsed?.ErrorDetails ||
        "Cloud OCR returned empty text.";
      throw new Error(String(errMsg));
    }

    return {
      text,
      pageCount: pageTexts.length,
      language,
    };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(`Cloud OCR timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

