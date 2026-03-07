import crypto from "crypto";
import { storage } from "../storage";
import { cleanLegalDocumentText } from "../rag/text-cleaner";
import { chunkStyleText } from "./chunker";
import { embedStyleChunks } from "./embed";
import { ensureStyleMemorySchema, insertStyleChunkBatch } from "./store";
import type { StyleMemoryModule, StyleMemorySourceType } from "./types";

type IngestArgs = {
  userId: string;
  module: StyleMemoryModule;
  sourceType: StyleMemorySourceType;
  sourceRef?: string | null;
  title: string;
  rawText: string;
  orgId?: number | null;
};

export type IngestResult = {
  accepted: boolean;
  deduped: boolean;
  indexedChunks: number;
  sampleId: number | null;
  reason?: string;
};

const MIN_STYLE_TEXT_CHARS = Math.max(120, Number(process.env.STYLE_MEMORY_MIN_CHARS || 240));
const MAX_STYLE_TEXT_CHARS = Math.max(4000, Number(process.env.STYLE_MEMORY_MAX_CHARS || 120000));
const MAX_STYLE_CHUNKS_PER_SAMPLE = Math.max(6, Number(process.env.STYLE_MEMORY_MAX_CHUNKS || 120));
const INDEX_BATCH_SIZE = Math.max(1, Number(process.env.STYLE_MEMORY_INDEX_BATCH_SIZE || 10));
const QUEUE_CONCURRENCY = Math.max(1, Number(process.env.STYLE_MEMORY_QUEUE_CONCURRENCY || 1));
const QUEUE_MAX_PENDING = Math.max(QUEUE_CONCURRENCY, Number(process.env.STYLE_MEMORY_QUEUE_MAX_PENDING || 100));

type QueueTask<T> = {
  fn: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
};

const queue: Array<QueueTask<any>> = [];
let activeWorkers = 0;

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function stripToBudget(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

async function runNextQueueTask() {
  if (activeWorkers >= QUEUE_CONCURRENCY) return;
  const task = queue.shift();
  if (!task) return;
  activeWorkers += 1;
  try {
    const result = await task.fn();
    task.resolve(result);
  } catch (err) {
    task.reject(err);
  } finally {
    activeWorkers = Math.max(0, activeWorkers - 1);
    if (queue.length > 0) {
      await runNextQueueTask();
    }
  }
}

function enqueueStyleJob<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (queue.length >= QUEUE_MAX_PENDING) {
      reject(new Error(`Style memory indexing queue is full (${QUEUE_MAX_PENDING} pending)`));
      return;
    }
    queue.push({ fn, resolve, reject });
    void runNextQueueTask();
  });
}

async function ingestNow(args: IngestArgs): Promise<IngestResult> {
  await ensureStyleMemorySchema();
  const normalized = cleanLegalDocumentText(stripToBudget(args.rawText || "", MAX_STYLE_TEXT_CHARS));
  if (!normalized || normalized.length < MIN_STYLE_TEXT_CHARS) {
    return {
      accepted: false,
      deduped: false,
      indexedChunks: 0,
      sampleId: null,
      reason: `text is too short (min ${MIN_STYLE_TEXT_CHARS} chars)`,
    };
  }

  const textHash = sha256(normalized);
  const existing = await storage.getStyleMemorySampleByHash(args.userId, args.module, textHash, args.orgId);
  if (existing) {
    return {
      accepted: true,
      deduped: true,
      indexedChunks: 0,
      sampleId: existing.id,
      reason: "duplicate sample",
    };
  }

  let sample;
  try {
    sample = await storage.addStyleMemorySample({
      userId: args.userId,
      orgId: args.orgId ?? null,
      module: args.module,
      sourceType: args.sourceType,
      sourceRef: args.sourceRef ?? null,
      title: args.title,
      rawText: normalized,
      textHash,
      status: "active",
    });
  } catch (err: any) {
    const existingAfterRace = await storage.getStyleMemorySampleByHash(args.userId, args.module, textHash, args.orgId);
    if (existingAfterRace) {
      return {
        accepted: true,
        deduped: true,
        indexedChunks: 0,
        sampleId: existingAfterRace.id,
        reason: "duplicate sample (race)",
      };
    }
    throw err;
  }

  const chunks = chunkStyleText(normalized).slice(0, MAX_STYLE_CHUNKS_PER_SAMPLE);
  if (chunks.length === 0) {
    return {
      accepted: false,
      deduped: false,
      indexedChunks: 0,
      sampleId: sample.id,
      reason: "no indexable chunks",
    };
  }

  let indexed = 0;
  for (let start = 0; start < chunks.length; start += INDEX_BATCH_SIZE) {
    const batch = chunks.slice(start, start + INDEX_BATCH_SIZE);
    const embeddings = await embedStyleChunks(batch.map((chunk) => chunk.text));
    indexed += await insertStyleChunkBatch(
      batch.map((chunk, idx) => ({
        sampleId: sample.id,
        userId: args.userId,
        orgId: args.orgId ?? null,
        module: args.module,
        chunkIndex: chunk.chunkIndex,
        content: chunk.text,
        tokenCount: chunk.tokenCount,
        embedding: embeddings[idx],
      })),
    );
  }

  await storage.logStyleMemoryEvent({
    eventType: `style.sample.${args.sourceType}.indexed`,
    userId: args.userId,
    orgId: args.orgId ?? null,
    module: args.module,
    metadata: {
      sampleId: sample.id,
      chunks: indexed,
      sourceRef: args.sourceRef ?? null,
    },
  });

  return {
    accepted: true,
    deduped: false,
    indexedChunks: indexed,
    sampleId: sample.id,
  };
}

export async function ingestStyleSample(args: IngestArgs): Promise<IngestResult> {
  return enqueueStyleJob(() => ingestNow(args));
}

export function getStyleMemoryQueueStats() {
  return {
    active: activeWorkers,
    pending: queue.length,
    concurrency: QUEUE_CONCURRENCY,
    maxPending: QUEUE_MAX_PENDING,
  };
}
