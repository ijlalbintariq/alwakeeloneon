import { execFile } from "node:child_process";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Worker } from "node:worker_threads";
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

function htmlToText(value: string): string {
  return cleanText(
    String(value || "")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, " "),
  );
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
  const source = Buffer.from(buffer);
  const raw = await mammoth.extractRawText({ buffer: source });
  const rawText = cleanText(String(raw?.value || ""));
  if (rawText.length >= 40) return rawText;
  try {
    const html = await mammoth.convertToHtml({ buffer: source });
    const htmlText = htmlToText(String(html?.value || ""));
    return htmlText.length > rawText.length ? htmlText : rawText;
  } catch {
    return rawText;
  }
}

type WorkerKind = "pdf-parse" | "docx-parse" | "pdf-ocr";

const WORKER_SCRIPT = String.raw`
const { execFile } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const { parentPort, workerData } = require("node:worker_threads");
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
  const raw = await mammoth.extractRawText({ buffer: source });
  const rawText = cleanText(raw?.value || "");
  if (rawText.length >= 40) return rawText;
  try {
    const html = await mammoth.convertToHtml({ buffer: source });
    const htmlText = cleanText(
      String(html?.value || "")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\s+/g, " "),
    );
    return htmlText.length > rawText.length ? htmlText : rawText;
  } catch {
    return rawText;
  }
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
  const { kind, inputPath, options } = workerData;
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

  parentPort.postMessage({ ok: true, payload });
}

main().catch((err) => {
  const message = err && err.message ? err.message : String(err);
  parentPort.postMessage({ ok: false, error: message });
});
`;

async function runWorkerTask<T>(kind: WorkerKind, buffer: Buffer, timeoutMs: number, options?: Record<string, unknown>): Promise<T> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "alwakeelo-xtract-"));
  const ext = kind === "docx-parse" ? ".docx" : ".pdf";
  const inputPath = path.join(tempDir, `input${ext}`);
  await fs.writeFile(inputPath, buffer);

  return new Promise<T>((resolve, reject) => {
    const worker = new Worker(WORKER_SCRIPT, {
      eval: true,
      workerData: { kind, inputPath, options: options || {} },
    });

    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error(`Worker timed out for ${kind} after ${timeoutMs}ms`));
    }, timeoutMs);

    worker.on("message", (parsed: any) => {
      clearTimeout(timer);
      if (!parsed.ok) {
        reject(new Error(parsed.error || `Extraction worker failed for ${kind}`));
      } else {
        resolve(parsed.payload as T);
      }
    });

    worker.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    worker.on("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  }).finally(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });
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
