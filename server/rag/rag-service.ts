import crypto from "crypto";
import { storage } from "../storage";
import { chunkTextByTokens } from "./chunker";
import { embedTextLocal } from "./embedding-local";
import { cleanLegalDocumentText } from "./text-cleaner";
import {
  deleteVectorsBySourceDocument,
  ensureRagSchema,
  replaceDocumentChunks,
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

const MIN_SCORE = Number(process.env.RAG_MIN_SCORE || 0.62);
const TOP_K = Number(process.env.RAG_TOP_K || 5);

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function resolveConfidence(scores: number[]): "high" | "medium" | "low" {
  if (scores.length === 0) return "low";
  const top1 = scores[0] || 0;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (top1 >= 0.72 && avg >= 0.66) return "high";
  if (top1 >= 0.66) return "medium";
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

  const chunks = chunkTextByTokens(cleaned);
  const embeddings = chunks.map((c) => embedTextLocal(c.text));

  const inserted = await replaceDocumentChunks(
    ragDoc.id,
    chunks.map((chunk, idx) => ({
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
    })),
  );

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

  const queryEmbedding = embedTextLocal(queryText);
  const matches = await similaritySearch({
    userId: args.userId,
    queryEmbedding,
    sourceDocumentIds: args.documentIds,
    topK: Math.max(1, args.topK || TOP_K),
  });

  const filtered = matches.filter((m) => Number.isFinite(m.score) && m.score >= MIN_SCORE);
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
