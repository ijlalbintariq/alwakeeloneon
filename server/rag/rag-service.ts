import crypto from "crypto";
import { storage } from "../storage";
import { chunkTextByTokens } from "./chunker";
import { embedTextLocal, embedTextsLocal } from "./embedding-local";
import { cleanLegalDocumentText } from "./text-cleaner";
import {
  deleteVectorsBySourceDocument,
  ensureRagSchema,
  insertDocumentChunkBatch,
  markRagDocumentIndexed,
  resetDocumentChunks,
  similaritySearch,
  upsertRagDocument,
  type RagMatch,
} from "./vector-store";

export type RAGIndexResult = {
  ragDocumentId: number;
  sourceDocumentId: number;
  title: string;
  chunks: number;
  status: "indexed";
};

export type RAGRetrievalResult = {
  matches: RagMatch[];
  confidence: "high" | "medium" | "low";
};

const MIN_SCORE = Number(process.env.RAG_MIN_SCORE || 0.5);
const TOP_K = Number(process.env.RAG_TOP_K || 5);
const VECTOR_WEIGHT_RAW = Number(process.env.RAG_VECTOR_WEIGHT || 0.72);
const KEYWORD_WEIGHT_RAW = Number(process.env.RAG_KEYWORD_WEIGHT || 0.28);
const INDEX_BATCH_SIZE = Math.max(1, Number(process.env.RAG_INDEX_BATCH_SIZE || (process.env.NODE_ENV === "production" ? 8 : 16)));
const MAX_CHUNKS_PER_DOC = Math.max(10, Number(process.env.RAG_MAX_CHUNKS_PER_DOC || 600));

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function resolveHybridWeights(): { vectorWeight: number; keywordWeight: number } {
  const vectorWeight = clamp(VECTOR_WEIGHT_RAW, 0, 1);
  const keywordWeight = clamp(KEYWORD_WEIGHT_RAW, 0, 1);
  const sum = vectorWeight + keywordWeight;
  if (sum <= 0) return { vectorWeight: 0.72, keywordWeight: 0.28 };
  return {
    vectorWeight: vectorWeight / sum,
    keywordWeight: keywordWeight / sum,
  };
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function resolveConfidence(scores: number[]): "high" | "medium" | "low" {
  if (scores.length === 0) return "low";
  const top1 = scores[0] || 0;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (top1 >= 0.78 && avg >= 0.64) return "high";
  if (top1 >= 0.62) return "medium";
  return "low";
}

export async function indexUserDocument(userId: string, sourceDocumentId: number): Promise<RAGIndexResult> {
  await ensureRagSchema();

  const docs = await storage.getDocuments(userId);
  const doc = docs.find((d) => d.id === sourceDocumentId);
  if (!doc) {
    throw new Error("Document not found");
  }

  const raw = doc.content || "";
  const cleaned = cleanLegalDocumentText(raw);
  if (!cleaned) {
    throw new Error("Document has no indexable text content");
  }

  const contentHash = sha256(cleaned);
  const ragDoc = await upsertRagDocument({
    userId,
    sourceDocumentId,
    title: doc.title || `Document ${doc.id}`,
    fileName: doc.title || null,
    mimeType: doc.mimeType || null,
    contentHash,
    status: "pending",
  });

  const chunks = chunkTextByTokens(cleaned).slice(0, MAX_CHUNKS_PER_DOC);
  await resetDocumentChunks(ragDoc.id);

  let inserted = 0;
  for (let start = 0; start < chunks.length; start += INDEX_BATCH_SIZE) {
    const batch = chunks.slice(start, start + INDEX_BATCH_SIZE);
    const embeddings = await embedTextsLocal(batch.map((c) => c.text));
    const entries = batch.map((chunk, idx) => ({
      ragDocumentId: ragDoc.id,
      userId,
      sourceDocumentId,
      chunkIndex: chunk.chunkIndex,
      tokenCount: chunk.tokenCount,
      chunkText: chunk.text,
      embedding: embeddings[idx],
      metadata: {
        sourceType: doc.sourceType || "other",
        fileExtension: doc.fileExtension || null,
      },
    }));
    inserted += await insertDocumentChunkBatch(entries);
  }

  await markRagDocumentIndexed(ragDoc.id, inserted);

  return {
    ragDocumentId: ragDoc.id,
    sourceDocumentId,
    title: doc.title || `Document ${doc.id}`,
    chunks: inserted,
    status: "indexed",
  };
}

export async function retrieveForQuery(args: {
  userId: string;
  query: string;
  documentIds?: number[];
  topK?: number;
}): Promise<RAGRetrievalResult> {
  await ensureRagSchema();

  const queryText = cleanLegalDocumentText(args.query || "");
  if (!queryText) {
    return { matches: [], confidence: "low" };
  }

  const queryEmbedding = await embedTextLocal(queryText);
  const { vectorWeight, keywordWeight } = resolveHybridWeights();
  const matches = await similaritySearch({
    userId: args.userId,
    queryEmbedding,
    queryText,
    sourceDocumentIds: args.documentIds,
    topK: Math.max(1, args.topK || TOP_K),
    vectorWeight,
    keywordWeight,
  });

  let filtered = matches.filter((m) => Number.isFinite(m.score) && m.score >= MIN_SCORE);
  if (filtered.length === 0 && matches.length > 0) {
    // Soft fallback to avoid false negatives on short/simple legal queries.
    const relaxedCutoff = Math.max(0.35, MIN_SCORE - 0.08);
    filtered = matches.filter((m) => Number.isFinite(m.score) && m.score >= relaxedCutoff).slice(0, Math.max(1, Math.min(2, TOP_K)));
  }

  const confidence = resolveConfidence(filtered.map((m) => m.score));
  return { matches: filtered, confidence };
}

export async function deleteDocumentVectors(sourceDocumentId: number, userId?: string): Promise<number> {
  await ensureRagSchema();
  return deleteVectorsBySourceDocument({ sourceDocumentId, userId });
}

export function buildRagContext(matches: RagMatch[], maxChunks: number = Number(process.env.RAG_MAX_CONTEXT_CHUNKS || 5)): string {
  const selected = matches.slice(0, Math.max(1, maxChunks));
  if (selected.length === 0) return "";

  const blocks = selected.map((m, idx) => {
    const excerpt = m.chunkText.length > 1400 ? `${m.chunkText.slice(0, 1400)}...` : m.chunkText;
    return [
      `[Source ${idx + 1}]`,
      `Document: ${m.title}`,
      `Document ID: ${m.sourceDocumentId}`,
      `Chunk: ${m.chunkIndex}`,
      `Score: ${m.score.toFixed(3)}`,
      `Text: ${excerpt}`,
    ].join("\n");
  });

  return blocks.join("\n\n");
}
