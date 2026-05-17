import { execFile } from "node:child_process";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type OcrAvailability = {
  tesseract: boolean;
  pdftoppm: boolean;
};

let availabilityCache: OcrAvailability | null = null;
let availabilityPromise: Promise<OcrAvailability> | null = null;

async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync("which", [command], {
      timeout: 2500,
      maxBuffer: 64 * 1024,
    });
    return true;
  } catch {
    return false;
  }
}

async function resolveAvailability(): Promise<OcrAvailability> {
  if (availabilityCache) return availabilityCache;
  if (availabilityPromise) return availabilityPromise;

  availabilityPromise = (async () => {
    const [tesseract, pdftoppm] = await Promise.all([
      commandExists("tesseract"),
      commandExists("pdftoppm"),
    ]);
    const result = { tesseract, pdftoppm };
    availabilityCache = result;
    availabilityPromise = null;
    return result;
  })();

  return availabilityPromise;
}

export async function isPdfOcrAvailable(): Promise<boolean> {
  const availability = await resolveAvailability();
  return availability.tesseract && availability.pdftoppm;
}

function getEnvInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.floor(raw));
}

export interface OcrPdfOptions {
  maxPages?: number;
  dpi?: number;
  language?: string;
  timeoutMs?: number;
}

export interface OcrPdfResult {
  text: string;
  pageCount: number;
  language: string;
}

export async function ocrPdfWithTesseract(
  pdfBuffer: Buffer,
  options: OcrPdfOptions = {},
): Promise<OcrPdfResult> {
  if (!(await isPdfOcrAvailable())) {
    throw new Error("PDF OCR dependencies are unavailable. Install both `tesseract` and `pdftoppm`.");
  }

  const maxPages = Math.min(options.maxPages ?? getEnvInt("PDF_OCR_MAX_PAGES", 8), 50);
  const dpi = Math.min(options.dpi ?? getEnvInt("PDF_OCR_DPI", 220), 600);
  const timeoutMs = Math.min(options.timeoutMs ?? getEnvInt("PDF_OCR_TIMEOUT_MS", 120000), 600000);
  const preferredLanguage =
    (options.language || process.env.TESSERACT_OCR_LANG || process.env.TESSERACT_LANG || "eng+urd").trim();
  const languageCandidates = Array.from(
    new Set([preferredLanguage, "eng"].filter((lang) => typeof lang === "string" && lang.trim().length > 0)),
  );

  const tempDir = path.join(os.tmpdir(), `alwakeelo-ocr-${Date.now()}-${crypto.randomUUID()}`);
  const pdfPath = path.join(tempDir, "input.pdf");
  const imagePrefix = path.join(tempDir, "page");

  await fs.mkdir(tempDir, { recursive: true });
  await fs.writeFile(pdfPath, pdfBuffer);

  try {
    await execFileAsync(
      "pdftoppm",
      [
        "-f",
        "1",
        "-l",
        String(maxPages),
        "-r",
        String(dpi),
        "-png",
        pdfPath,
        imagePrefix,
      ],
      {
        timeout: timeoutMs,
        maxBuffer: 2 * 1024 * 1024,
      },
    );

    const pageImages = (await fs.readdir(tempDir))
      .filter((name) => /^page-\d+\.png$/i.test(name))
      .sort((a, b) => {
        const aNum = Number((a.match(/^page-(\d+)\.png$/i) || [])[1] || "0");
        const bNum = Number((b.match(/^page-(\d+)\.png$/i) || [])[1] || "0");
        return aNum - bNum;
      });

    if (pageImages.length === 0) {
      return { text: "", pageCount: 0, language: preferredLanguage };
    }

    let lastError: unknown;

    for (const language of languageCandidates) {
      try {
        const parts: string[] = [];
        for (const imageName of pageImages) {
          const imagePath = path.join(tempDir, imageName);
          const { stdout } = await execFileAsync(
            "tesseract",
            [imagePath, "stdout", "-l", language, "--psm", "6"],
            {
              timeout: timeoutMs,
              maxBuffer: 32 * 1024 * 1024,
            },
          );
          if (stdout && stdout.trim()) parts.push(stdout.trim());
        }
        return {
          text: parts.join("\n\n").trim(),
          pageCount: pageImages.length,
          language,
        };
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("Tesseract OCR failed for all language candidates.");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
