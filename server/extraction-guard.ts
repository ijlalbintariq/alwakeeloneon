import { execFile } from "node:child_process";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import { ocrPdfWithTesseract, type OcrPdfOptions, type OcrPdfResult } from "./ocr";

const execFileAsync = promisify(execFile);

const EXTRACTION_QUEUE_CONCURRENCY = Math.max(1, Number(process.env.EXTRACTION_QUEUE_CONCURRENCY || 2));
const EXTRACTION_QUEUE_MAX_PENDING = Math.max(EXTRACTION_QUEUE_CONCURRENCY, Number(process.env.EXTRACTION_QUEUE_MAX_PENDING || 64));
const EXTRACTION_TIMEOUT_MS_DEFAULT = Math.max(3000, Number(process.env.EXTRACTION_TIMEOUT_MS || 120000));
const EXTRACTION_WORKER_ENABLED = /^(1|true|yes|on)$/i.test(String(process.env.EXTRACTION_WORKER_ENABLED || "false"));

type QueueItem = {
  label: string;
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  enqueuedAt: number;
};

class ExtractionTaskQueueFullError extends Error {
  code = "EXTRACTION_QUEUE_FULL";
  constructor(message: string) {
    super(message);
    this.name = "ExtractionTaskQueueFullError";
  }
}

const taskQueue: QueueItem[] = [];
let activeTasks = 0;

function pumpTaskQueue() {
  while (activeTasks < EXTRACTION_QUEUE_CONCURRENCY && taskQueue.length > 0) {
    const next = taskQueue.shift();
    if (!next) return;
    activeTasks += 1;
    next.run()
      .then((value) => next.resolve(value))
      .catch((err) => next.reject(err))
      .finally(() => {
        activeTasks = Math.max(0, activeTasks - 1);
        pumpTaskQueue();
      });
  }
}

export function getExtractionQueueStats() {
  return {
    active: activeTasks,
    queued: taskQueue.length,
    concurrency: EXTRACTION_QUEUE_CONCURRENCY,
    maxPending: EXTRACTION_QUEUE_MAX_PENDING,
    workerEnabled: EXTRACTION_WORKER_ENABLED,
  };
}

export function isExtractionQueueFullError(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as any).code === "EXTRACTION_QUEUE_FULL");
}

export function isExtractionWorkerEnabled(): boolean {
  return EXTRACTION_WORKER_ENABLED;
}

async function enqueueExtractionTask<T>(label: string, run: () => Promise<T>): Promise<T> {
  if (activeTasks + taskQueue.length >= EXTRACTION_QUEUE_MAX_PENDING) {
    throw new ExtractionTaskQueueFullError(
      `Extraction queue is full (${EXTRACTION_QUEUE_MAX_PENDING} pending). Retry shortly.`,
    );
  }

  return await new Promise<T>((resolve, reject) => {
    taskQueue.push({
      label,
      run: async () => await run(),
      resolve: (value) => resolve(value as T),
      reject,
      enqueuedAt: Date.now(),
    });
    pumpTaskQueue();
  });
}

function cleanText(value: string): string {
  return (value || "").replace(/\x00/g, "").trim();
}

async function parsePdfInline(buffer: Buffer): Promise<string> {
  const parseBuffer = Buffer.from(buffer);
  const uint8 = new Uint8Array(parseBuffer.buffer, parseBuffer.byteOffset, parseBuffer.byteLength);
  const parsed = await extractText(uint8, { mergePages: true });
  const rawText = Array.isArray((parsed as any)?.text)
    ? (parsed as any).text.join("\n")
    : ((parsed as any)?.text || "");
  return cleanText(String(rawText));
}

async function parseDocxInline(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  return cleanText(String(result?.value || ""));
}

type WorkerKind = "pdf-parse" | "docx-parse" | "pdf-ocr";

const WORKER_SCRIPT = String.raw`
const { execFile } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const execFileAsync = promisify(execFile);

function cleanText(value) {
  return String(value || "").replace(/\x00/g, "").trim();
}

async function parsePdf(filePath) {
  const { extractText } = require("unpdf");
  const source = await fs.readFile(filePath);
  const uint8 = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  const parsed = await extractText(uint8, { mergePages: true });
  const rawText = Array.isArray(parsed?.text) ? parsed.text.join("\n") : (parsed?.text || "");
  return cleanText(rawText);
}

async function parseDocx(filePath) {
  const mammoth = require("mammoth");
  const source = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer: source });
  return cleanText(result?.value || "");
}

async function ocrPdf(filePath, options) {
  const maxPages = Math.min(Math.max(1, Number(options.maxPages || 8)), 50);
  const dpi = Math.min(Math.max(120, Number(options.dpi || 220)), 600);
  const timeoutMs = Math.min(Math.max(3000, Number(options.timeoutMs || 120000)), 600000);
  const language = String(options.language || "eng+urd").trim() || "eng+urd";
  const tempDir = path.join(
    os.tmpdir(),
    "alwakeelo-worker-ocr-" + Date.now() + "-" + crypto.randomUUID(),
  );
  const imagePrefix = path.join(tempDir, "page");
  await fs.mkdir(tempDir, { recursive: true });

  try {
    await execFileAsync(
      "pdftoppm",
      ["-f", "1", "-l", String(maxPages), "-r", String(dpi), "-png", filePath, imagePrefix],
      { timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 },
    );
    const pages = (await fs.readdir(tempDir))
      .filter((name) => /^page-\d+\.png$/i.test(name))
      .sort((a, b) => {
        const ai = Number((a.match(/^page-(\d+)\.png$/i) || [])[1] || "0");
        const bi = Number((b.match(/^page-(\d+)\.png$/i) || [])[1] || "0");
        return ai - bi;
      });
    if (pages.length === 0) return { text: "", pageCount: 0, language };
    const parts = [];
    for (const pageName of pages) {
      const { stdout } = await execFileAsync(
        "tesseract",
        [path.join(tempDir, pageName), "stdout", "-l", language, "--psm", "6"],
        { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 },
      );
      if (stdout && String(stdout).trim()) parts.push(String(stdout).trim());
    }
    return { text: cleanText(parts.join("\n\n")), pageCount: pages.length, language };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  // node -e shifts argv compared to file execution, so read from tail.
  const argvTail = process.argv.slice(-3);
  const kind = argvTail[0];
  const inputPath = argvTail[1];
  const optionsRaw = argvTail[2];
  const options = optionsRaw ? JSON.parse(optionsRaw) : {};

  let payload;
  if (kind === "pdf-parse") {
    payload = { text: await parsePdf(inputPath) };
  } else if (kind === "docx-parse") {
    payload = { text: await parseDocx(inputPath) };
  } else if (kind === "pdf-ocr") {
    payload = await ocrPdf(inputPath, options);
  } else {
    throw new Error("Unknown extraction worker task kind: " + kind);
  }

  process.stdout.write(JSON.stringify({ ok: true, payload }));
}

main().catch((err) => {
  const message = err && err.message ? err.message : String(err);
  process.stdout.write(JSON.stringify({ ok: false, error: message }));
  process.exitCode = 1;
});
`;

async function runWorkerTask<T>(kind: WorkerKind, buffer: Buffer, timeoutMs: number, options?: Record<string, unknown>): Promise<T> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "alwakeelo-xtract-"));
  const ext = kind === "docx-parse" ? ".docx" : ".pdf";
  const inputPath = path.join(tempDir, `input${ext}`);
  await fs.writeFile(inputPath, buffer);

  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      ["-e", WORKER_SCRIPT, kind, inputPath, JSON.stringify(options || {})],
      {
        timeout: timeoutMs,
        maxBuffer: 8 * 1024 * 1024,
      },
    );

    const parsed = JSON.parse(String(stdout || "{}")) as { ok?: boolean; payload?: T; error?: string };
    if (!parsed.ok) {
      throw new Error(parsed.error || `Extraction worker failed for ${kind}`);
    }
    return parsed.payload as T;
  } catch (err: any) {
    const stdoutText = typeof err?.stdout === "string"
      ? err.stdout
      : Buffer.isBuffer(err?.stdout)
        ? err.stdout.toString("utf-8")
        : "";
    if (stdoutText.trim()) {
      try {
        const parsed = JSON.parse(stdoutText) as { ok?: boolean; payload?: T; error?: string };
        if (parsed.ok) {
          return parsed.payload as T;
        }
        if (parsed.error) {
          throw new Error(parsed.error);
        }
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message) {
          throw parseErr;
        }
      }
    }
    if (String(err?.message || "").includes("timed out")) {
      throw new Error(`Extraction worker timed out for ${kind} after ${timeoutMs}ms`);
    }
    throw new Error(err?.message || `Extraction worker failed for ${kind}`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function extractPdfTextGuarded(
  buffer: Buffer,
  options?: { timeoutMs?: number; context?: string },
): Promise<string> {
  const timeoutMs = Math.min(Math.max(3000, Number(options?.timeoutMs || EXTRACTION_TIMEOUT_MS_DEFAULT)), 600000);
  const label = `pdf-parse:${options?.context || "default"}`;
  return await enqueueExtractionTask(label, async () => {
    if (EXTRACTION_WORKER_ENABLED) {
      try {
        const result = await runWorkerTask<{ text: string }>("pdf-parse", buffer, timeoutMs);
        return cleanText(result.text || "");
      } catch (workerErr) {
        // Safety fallback: keep extraction working even if worker subprocess fails.
        console.warn(`[ExtractionWorker][pdf-parse] ${options?.context || "default"} failed, using inline parser:`, workerErr);
      }
    }
    return await parsePdfInline(buffer);
  });
}

export async function extractDocxTextGuarded(
  buffer: Buffer,
  options?: { timeoutMs?: number; context?: string },
): Promise<string> {
  const timeoutMs = Math.min(Math.max(3000, Number(options?.timeoutMs || EXTRACTION_TIMEOUT_MS_DEFAULT)), 600000);
  const label = `docx-parse:${options?.context || "default"}`;
  return await enqueueExtractionTask(label, async () => {
    if (EXTRACTION_WORKER_ENABLED) {
      try {
        const result = await runWorkerTask<{ text: string }>("docx-parse", buffer, timeoutMs);
        return cleanText(result.text || "");
      } catch (workerErr) {
        console.warn(`[ExtractionWorker][docx-parse] ${options?.context || "default"} failed, using inline parser:`, workerErr);
      }
    }
    return await parseDocxInline(buffer);
  });
}

export async function extractPdfOcrGuarded(
  buffer: Buffer,
  options: OcrPdfOptions & { context?: string } = {},
): Promise<OcrPdfResult> {
  const timeoutMs = Math.min(Math.max(3000, Number(options.timeoutMs || EXTRACTION_TIMEOUT_MS_DEFAULT)), 600000);
  const label = `pdf-ocr:${options.context || "default"}`;
  return await enqueueExtractionTask(label, async () => {
    if (EXTRACTION_WORKER_ENABLED) {
      try {
        const result = await runWorkerTask<OcrPdfResult>("pdf-ocr", buffer, timeoutMs, {
          maxPages: options.maxPages,
          dpi: options.dpi,
          language: options.language,
          timeoutMs,
        });
        return {
          text: cleanText(result.text || ""),
          pageCount: Number(result.pageCount || 0),
          language: result.language || String(options.language || "eng+urd"),
        };
      } catch (workerErr) {
        console.warn(`[ExtractionWorker][pdf-ocr] ${options.context || "default"} failed, using inline OCR:`, workerErr);
      }
    }
    return await ocrPdfWithTesseract(buffer, {
      maxPages: options.maxPages,
      dpi: options.dpi,
      language: options.language,
      timeoutMs,
    });
  });
}
