import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type OcrAvailability = {
  python3: boolean;
  paddleocr: boolean;
};

let availabilityCache: OcrAvailability | null = null;
let availabilityPromise: Promise<OcrAvailability> | null = null;

async function commandExists(command: string, args: string[] = []): Promise<boolean> {
  try {
    await execFileAsync(command, args.length > 0 ? args : ["--version"], {
      timeout: 10000,
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
    const python3 = await commandExists("python3");
    let paddleocr = false;
    if (python3) {
      try {
        await execFileAsync("python3", ["-c", "import paddleocr; import fitz; print('ok')"], {
          timeout: 15000,
          maxBuffer: 64 * 1024,
        });
        paddleocr = true;
      } catch {
        paddleocr = false;
      }
    }
    const result = { python3, paddleocr };
    availabilityCache = result;
    availabilityPromise = null;
    console.log(
      `[PaddleOCR] Availability check: python3=${python3}, paddleocr=${paddleocr}`,
    );
    return result;
  })();

  return availabilityPromise;
}

export async function isPdfOcrAvailable(): Promise<boolean> {
  const availability = await resolveAvailability();
  return availability.python3 && availability.paddleocr;
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

const WORKER_SCRIPT_PATH = path.resolve(__dirname, "paddle-ocr-worker.py");

/**
 * OCR a PDF using PaddleOCR PP-OCRv5 Mobile models.
 *
 * Calls the Python worker script via child_process for isolation:
 * - Separate process = memory is fully freed on completion
 * - Killable via timeout if stuck
 * - Page-by-page processing inside the worker
 */
export async function ocrPdfWithPaddle(
  pdfBuffer: Buffer,
  options: OcrPdfOptions = {},
): Promise<OcrPdfResult> {
  if (!(await isPdfOcrAvailable())) {
    throw new Error(
      "PaddleOCR is not available. Install: pip install paddlepaddle paddleocr PyMuPDF",
    );
  }

  const maxPages = Math.min(options.maxPages ?? getEnvInt("PDF_OCR_MAX_PAGES", 8), 50);
  const timeoutMs = Math.min(
    options.timeoutMs ?? getEnvInt("PDF_OCR_TIMEOUT_MS", 120000),
    600000,
  );
  const language = (
    options.language ||
    process.env.TESSERACT_OCR_LANG ||
    process.env.TESSERACT_LANG ||
    process.env.PADDLEOCR_LANG ||
    "en"
  ).trim();

  // Write PDF buffer to a temp file for the Python worker
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const crypto = await import("node:crypto");
  const tempDir = path.join(
    os.tmpdir(),
    `alwakeelo-paddle-${Date.now()}-${crypto.randomUUID()}`,
  );
  const pdfPath = path.join(tempDir, "input.pdf");

  await fs.mkdir(tempDir, { recursive: true });
  await fs.writeFile(pdfPath, pdfBuffer);

  try {
    const { stdout, stderr } = await execFileAsync(
      "python3",
      [
        WORKER_SCRIPT_PATH,
        pdfPath,
        String(maxPages),
        language,
        String(timeoutMs),
      ],
      {
        timeout: timeoutMs + 10000, // Give 10s extra for Python startup
        maxBuffer: 32 * 1024 * 1024,
        env: {
          ...process.env,
          // Ensure CPU-only
          CUDA_VISIBLE_DEVICES: "",
          OMP_NUM_THREADS: "1",
          MKL_NUM_THREADS: "1",
        },
      },
    );

    if (stderr && stderr.trim()) {
      // PaddleOCR may emit warnings to stderr — log but don't fail
      const stderrShort = stderr.trim().slice(0, 500);
      if (!/warning|info|download/i.test(stderrShort)) {
        console.warn(`[PaddleOCR] stderr: ${stderrShort}`);
      }
    }

    const result = JSON.parse(String(stdout || "{}")) as {
      ok?: boolean;
      payload?: OcrPdfResult;
      error?: string;
    };

    if (!result.ok) {
      throw new Error(result.error || "PaddleOCR worker returned failure");
    }

    return {
      text: (result.payload?.text || "").replace(/\x00/g, "").trim(),
      pageCount: Number(result.payload?.pageCount || 0),
      language: result.payload?.language || language,
    };
  } catch (err: any) {
    // Try to parse stdout even on error (worker may have written partial output)
    if (err?.stdout) {
      try {
        const parsed = JSON.parse(String(err.stdout)) as {
          ok?: boolean;
          payload?: OcrPdfResult;
          error?: string;
        };
        if (parsed.ok && parsed.payload) {
          return {
            text: (parsed.payload.text || "").replace(/\x00/g, "").trim(),
            pageCount: Number(parsed.payload.pageCount || 0),
            language: parsed.payload.language || language,
          };
        }
        if (parsed.error) {
          throw new Error(parsed.error);
        }
      } catch {
        // Fall through to original error
      }
    }

    if (String(err?.message || "").includes("timed out")) {
      throw new Error(`PaddleOCR timed out after ${timeoutMs}ms`);
    }
    throw new Error(
      `PaddleOCR failed: ${err?.message || String(err)}`,
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Legacy Tesseract compatibility aliases ──────────────────────────────────
// Keep the old function name so extraction-guard.ts import doesn't break
// during the transition. Points to PaddleOCR now.
export const ocrPdfWithTesseract = ocrPdfWithPaddle;
