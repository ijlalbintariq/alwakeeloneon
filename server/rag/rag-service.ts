import crypto from "crypto";
import { storage } from "../storage";
import { db, dbAvailable, pool } from "../db";
import { judgments, courtsRef, lawJournals } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { chunkTextByTokens, type TextChunk } from "./chunker";
import { embedTextLocal, embedTextsLocal } from "./embedding-local";
import { cleanLegalDocumentText } from "./text-cleaner";
import {
  deleteVectorsBySourceDocument,
  ensureRagSchema,
  insertDocumentChunkBatch,
  insertDocumentChunksReturningIds,
  markRagDocumentIndexed,
  resetDocumentChunks,
  similaritySearch,
  upsertRagDocument,
  type RagMatch,
} from "./vector-store";
import { getR2ObjectText } from "../r2-storage";

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

export type RAGEnsureIndexResult = {
  candidates: number;
  alreadyIndexed: number;
  attempted: number;
  indexedNow: number;
  failed: number;
};

export const GLOBAL_CASELAW_RAG_USER_ID = "global-admin-case-law";
export const GLOBAL_STATUTE_RAG_USER_ID = "global-admin-statute";
export const GLOBAL_ADMIN_KNOWLEDGE_RAG_USER_ID = "global-admin-knowledge";
export const GLOBAL_JUDGMENTS_RAG_USER_ID = "global-admin-judgments";
export const GLOBAL_ADMIN_RAG_USER_IDS = [
  GLOBAL_CASELAW_RAG_USER_ID,
  GLOBAL_STATUTE_RAG_USER_ID,
  GLOBAL_ADMIN_KNOWLEDGE_RAG_USER_ID,
  GLOBAL_JUDGMENTS_RAG_USER_ID,
] as const;

export type RAGGlobalEnsureSummary = {
  caseLaw: RAGEnsureIndexResult;
  statutes: RAGEnsureIndexResult;
  adminKnowledge: RAGEnsureIndexResult;
  indexedNow: number;
};

const MIN_SCORE = Number(process.env.RAG_MIN_SCORE || 0.15);
const TOP_K = Number(process.env.RAG_TOP_K || 5);
const VECTOR_WEIGHT_RAW = Number(process.env.RAG_VECTOR_WEIGHT || 0.72);
const KEYWORD_WEIGHT_RAW = Number(process.env.RAG_KEYWORD_WEIGHT || 0.28);
const INDEX_BATCH_SIZE = Math.max(1, Number(process.env.RAG_INDEX_BATCH_SIZE || (process.env.NODE_ENV === "production" ? 8 : 16)));
const MAX_CHUNKS_PER_DOC = Math.max(10, Number(process.env.RAG_MAX_CHUNKS_PER_DOC || 600));
const RERANK_POOL_CAP = Math.max(6, Number(process.env.RAG_RERANK_POOL_CAP || 24));
const RERANK_DOC_PENALTY = clamp(Number(process.env.RAG_RERANK_DOC_PENALTY || 0.045), 0.01, 0.15);
const RERANK_MIN_QUERY_TOKEN_LEN = Math.max(2, Number(process.env.RAG_RERANK_MIN_QUERY_TOKEN_LEN || 3));
const STOP_TOKENS = new Set([
  "the", "and", "for", "that", "with", "from", "this", "have", "your", "will", "shall", "into", "under",
  "where", "there", "about", "what", "when", "which", "whose", "their", "were", "been", "is", "are", "was",
  "to", "of", "in", "on", "a", "an", "or", "at", "by", "as", "it", "be", "if", "than", "then", "also", "any",
]);

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

async function indexChunksInDb(
  ragDocumentId: number,
  userId: string,
  sourceDocumentId: number,
  chunks: TextChunk[],
  metadataBase: Record<string, any>,
): Promise<number> {
  await resetDocumentChunks(ragDocumentId);

  // 1. Separate Parent and Child chunks
  const parents = chunks.filter((c) => c.isParent);
  const children = chunks.filter((c) => !c.isParent);

  if (parents.length === 0) return 0;

  // 2. Insert parent chunks first (no embeddings, embedding = null)
  // We insert parents in batches and receive their mapped database row IDs
  const parentEntries = parents.map((p) => ({
    ragDocumentId,
    userId,
    sourceDocumentId,
    chunkIndex: p.chunkIndex,
    tokenCount: p.tokenCount,
    chunkText: p.text,
    embedding: null, // Parents do not get vector embeddings
    metadata: {
      ...metadataBase,
      isParent: true,
      sectionType: p.sectionType,
      statuteCitations: p.statuteCitations,
      judgmentResult: p.judgmentResult,
    },
  }));

  const parentResultRows = await insertDocumentChunksReturningIds(parentEntries);
  // Map parent chunkIndex to database ID
  const parentIdMap = new Map<number, number>();
  for (const row of parentResultRows) {
    parentIdMap.set(row.chunkIndex, row.id);
  }

  // 3. Insert child chunks in batches (with embeddings)
  // Each child chunk's parentIndex is mapped to its database parent row ID
  const childEntriesWithText = children.map((c) => {
    const parentDbId = c.parentIndex !== undefined ? parentIdMap.get(c.parentIndex) : null;
    return {
      chunk: c,
      parentChunkId: parentDbId,
    };
  });

  let insertedCount = parents.length;
  // Batch embed and insert child chunks
  for (let start = 0; start < childEntriesWithText.length; start += INDEX_BATCH_SIZE) {
    const batch = childEntriesWithText.slice(start, start + INDEX_BATCH_SIZE);
    
    // Generate embeddings for children
    const embeddings = await embedTextsLocal(batch.map((item) => item.chunk.text));
    
    const dbEntries = batch.map((item, idx) => ({
      ragDocumentId,
      userId,
      sourceDocumentId,
      chunkIndex: item.chunk.chunkIndex,
      tokenCount: item.chunk.tokenCount,
      chunkText: item.chunk.text,
      embedding: embeddings[idx], // child gets vector embedding
      parentChunkId: item.parentChunkId,
      metadata: {
        ...metadataBase,
        isParent: false,
        sectionType: item.chunk.sectionType,
        statuteCitations: item.chunk.statuteCitations,
        judgmentResult: item.chunk.judgmentResult,
      },
    }));

    insertedCount += await insertDocumentChunkBatch(dbEntries);
  }

  return insertedCount;
}

function normalizeCategoryToken(value: string | null | undefined): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isCaseLawCategory(value: string | null | undefined): boolean {
  return normalizeCategoryToken(value) === "caselaw";
}

function resolveConfidence(scores: number[]): "high" | "medium" | "low" {
  if (scores.length === 0) return "low";
  const top1 = scores[0] || 0;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (top1 >= 0.45 && avg >= 0.35) return "high";
  if (top1 >= 0.30) return "medium";
  return "low";
}

function normalizeCitationToken(input: string): string {
  return String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function tokenize(text: string, maxTokens: number = 120): string[] {
  const source = cleanLegalDocumentText(text || "").toLowerCase();
  if (!source) return [];
  const tokens = source
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= RERANK_MIN_QUERY_TOKEN_LEN && !STOP_TOKENS.has(t));
  return tokens.slice(0, maxTokens);
}

function rerankAndDiversify(matches: RagMatch[], queryText: string, limit: number): RagMatch[] {
  if (matches.length <= 1) return matches.slice(0, limit);

  const queryTokens = tokenize(queryText, 28);
  const queryTokenSet = new Set(queryTokens);
  const normalizedQuery = cleanLegalDocumentText(queryText || "").toLowerCase();
  const citationToken = normalizeCitationToken(queryText);

  const rescored = matches.map((m) => {
    const chunkTokens = tokenize(`${m.title} ${m.chunkText}`, 180);
    const chunkSet = new Set(chunkTokens);
    let overlap = 0;
    for (const token of queryTokenSet) {
      if (chunkSet.has(token)) overlap += 1;
    }
    const tokenCoverage = queryTokenSet.size > 0 ? overlap / queryTokenSet.size : 0;

    const normalizedChunk = cleanLegalDocumentText(`${m.title} ${m.chunkText}`).toLowerCase();
    const phraseMatch = normalizedQuery.length >= 12 && normalizedChunk.includes(normalizedQuery) ? 1 : 0;

    const normalizedCitationScope = normalizeCitationToken(`${m.title} ${m.chunkText}`);
    const citationMatch = citationToken && /(?:\b(?:PLD|SCMR|CLC|MLD|YLR|PCRLJ|PLJ|NLR|CLD|PTD|PLC|PSC|SLR)\d{1,5}\b|\b\d{4}(?:PLD|SCMR|CLC|MLD|YLR|PCRLJ|PLJ|NLR|CLD|PTD|PLC|PSC|SLR)\d{1,5}\b)/.test(citationToken)
      ? (normalizedCitationScope.includes(citationToken) ? 1 : 0)
      : 0;

    const titleCoverage = (() => {
      const titleTokens = new Set(tokenize(m.title, 30));
      if (queryTokenSet.size === 0 || titleTokens.size === 0) return 0;
      let hit = 0;
      for (const token of queryTokenSet) {
        if (titleTokens.has(token)) hit += 1;
      }
      return hit / queryTokenSet.size;
    })();

    const rerankedScore = clamp(
      (m.score * 0.50) +
      (m.vectorScore * 0.10) +
      (Math.min(1, m.keywordScore) * 0.10) +
      (tokenCoverage * 0.15) +
      (titleCoverage * 0.05) +
      (phraseMatch * 0.05) +
      (citationMatch * 0.05),
      0,
      1,
    );

    const isSupremeCourt =
      String(m.metadata?.court || "").toLowerCase().includes("supreme court") ||
      /\b(?:SCMR|PSC)\b/.test(m.title) ||
      /\bPLD\s+\d{4}\s+SC\b/.test(m.title) ||
      /\bSC\b/.test(m.title);

    let yearBoost = 0;
    const yearMatch = m.title.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      if (year >= 1980) {
        yearBoost = Math.min(0.05, (year - 1980) / 1000);
      }
    }

    const baseScore = rerankedScore + yearBoost;
    const finalScore = clamp(isSupremeCourt ? baseScore * 1.10 : baseScore, 0, 1);

    return {
      ...m,
      score: finalScore,
    };
  });

  const pool = rescored.sort((a, b) => b.score - a.score);
  const selected: RagMatch[] = [];
  const perDoc = new Map<number, number>();
  let statuteCount = 0;
  let judgmentCount = 0;
  let userCount = 0;

  while (pool.length > 0 && selected.length < limit) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i];
      const existing = perDoc.get(candidate.sourceDocumentId) || 0;
      
      const srcType = String(candidate.metadata?.sourceType || "");
      let typePenalty = 0;
      if (srcType === "statute" || srcType === "admin-statute") {
        typePenalty = statuteCount * 0.12;
      } else if (srcType === "judgment" || srcType === "admin-case-law") {
        typePenalty = judgmentCount * 0.12;
      } else {
        typePenalty = userCount * 0.12;
      }

      const adjusted = candidate.score - (existing * RERANK_DOC_PENALTY) - typePenalty;
      if (adjusted > bestScore) {
        bestScore = adjusted;
        bestIdx = i;
      }
    }
    const [picked] = pool.splice(bestIdx, 1);
    selected.push(picked);
    perDoc.set(picked.sourceDocumentId, (perDoc.get(picked.sourceDocumentId) || 0) + 1);
    
    const srcType = String(picked.metadata?.sourceType || "");
    if (srcType === "statute" || srcType === "admin-statute") {
      statuteCount += 1;
    } else if (srcType === "judgment" || srcType === "admin-case-law") {
      judgmentCount += 1;
    } else {
      userCount += 1;
    }
  }

  return selected;
}

export async function indexUserDocument(userId: string, sourceDocumentId: number): Promise<RAGIndexResult> {
  await ensureRagSchema();

  const docs = await storage.getDocuments(userId);
  const doc = docs.find((d) => d.id === sourceDocumentId);
  if (!doc) {
    throw new Error("Document not found");
  }

  const raw = doc.content || "";
  let sourceText = raw;
  try {
    const fileMeta = await storage.getDocumentFile(doc.id, userId);
    if (fileMeta?.extractedTextKey) {
      const fullText = await getR2ObjectText(fileMeta.extractedTextKey);
      if (fullText) {
        sourceText = fullText;
      }
    }
  } catch (err) {
    console.warn("[RAG] Could not load full extracted text from R2, using inline DB content.");
  }

  const cleaned = cleanLegalDocumentText(sourceText);
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
  const inserted = await indexChunksInDb(ragDoc.id, userId, sourceDocumentId, chunks, {
    sourceType: doc.sourceType || "other",
    fileExtension: doc.fileExtension || null,
  });

  await markRagDocumentIndexed(ragDoc.id, inserted);

  return {
    ragDocumentId: ragDoc.id,
    sourceDocumentId,
    title: doc.title || `Document ${doc.id}`,
    chunks: inserted,
    status: "indexed",
  };
}

export async function indexAdminCaseLawDocument(adminKnowledgeId: number): Promise<RAGIndexResult> {
  await ensureRagSchema();

  const doc = await storage.getAdminKnowledgeById(adminKnowledgeId);
  if (!doc) {
    throw new Error("Admin case law document not found");
  }
  if (!isCaseLawCategory(doc.category)) {
    throw new Error("Admin knowledge document is not in case-law category");
  }

  const raw = doc.content || "";
  let sourceText = raw;
  let mimeType: string | null = null;
  let fileName: string | null = doc.filename || null;
  try {
    const fileMeta = await storage.getAdminKnowledgeFile(doc.id);
    if (fileMeta) {
      mimeType = fileMeta.mimeType || null;
      fileName = fileMeta.originalFilename || fileName;
    }
    if (fileMeta?.extractedTextKey) {
      const fullText = await getR2ObjectText(fileMeta.extractedTextKey);
      if (fullText) {
        sourceText = fullText;
      }
    }
  } catch {
    console.warn("[RAG] Could not load full admin case-law text from R2, using inline DB content.");
  }

  const cleaned = cleanLegalDocumentText(sourceText);
  if (!cleaned) {
    throw new Error("Admin case law document has no indexable text content");
  }

  const contentHash = sha256(cleaned);
  const ragDoc = await upsertRagDocument({
    userId: GLOBAL_CASELAW_RAG_USER_ID,
    sourceDocumentId: doc.id,
    title: doc.title || `Case Law ${doc.id}`,
    fileName,
    mimeType,
    contentHash,
    status: "pending",
  });

  const chunks = chunkTextByTokens(cleaned).slice(0, MAX_CHUNKS_PER_DOC);
  const inserted = await indexChunksInDb(ragDoc.id, GLOBAL_CASELAW_RAG_USER_ID, doc.id, chunks, {
    sourceType: "admin-case-law",
    category: "case-law",
    adminKnowledgeId: doc.id,
    filename: fileName,
  });

  await markRagDocumentIndexed(ragDoc.id, inserted);

  return {
    ragDocumentId: ragDoc.id,
    sourceDocumentId: doc.id,
    title: doc.title || `Case Law ${doc.id}`,
    chunks: inserted,
    status: "indexed",
  };
}

export async function indexAdminKnowledgeDocument(adminKnowledgeId: number): Promise<RAGIndexResult> {
  await ensureRagSchema();

  const doc = await storage.getAdminKnowledgeById(adminKnowledgeId);
  if (!doc) {
    throw new Error("Admin knowledge document not found");
  }
  if (isCaseLawCategory(doc.category)) {
    throw new Error("Admin knowledge document belongs to case-law category");
  }

  const raw = doc.content || "";
  let sourceText = raw;
  let mimeType: string | null = null;
  let fileName: string | null = doc.filename || null;
  try {
    const fileMeta = await storage.getAdminKnowledgeFile(doc.id);
    if (fileMeta) {
      mimeType = fileMeta.mimeType || null;
      fileName = fileMeta.originalFilename || fileName;
    }
    if (fileMeta?.extractedTextKey) {
      const fullText = await getR2ObjectText(fileMeta.extractedTextKey);
      if (fullText) {
        sourceText = fullText;
      }
    }
  } catch {
    console.warn("[RAG] Could not load full admin knowledge text from R2, using inline DB content.");
  }

  const cleaned = cleanLegalDocumentText(sourceText);
  if (!cleaned) {
    throw new Error("Admin knowledge document has no indexable text content");
  }

  const contentHash = sha256(cleaned);
  const ragDoc = await upsertRagDocument({
    userId: GLOBAL_ADMIN_KNOWLEDGE_RAG_USER_ID,
    sourceDocumentId: doc.id,
    title: doc.title || `Knowledge ${doc.id}`,
    fileName,
    mimeType,
    contentHash,
    status: "pending",
  });

  const chunks = chunkTextByTokens(cleaned).slice(0, MAX_CHUNKS_PER_DOC);
  const inserted = await indexChunksInDb(ragDoc.id, GLOBAL_ADMIN_KNOWLEDGE_RAG_USER_ID, doc.id, chunks, {
    sourceType: "admin-knowledge",
    category: doc.category || "general",
    adminKnowledgeId: doc.id,
    filename: fileName,
  });

  await markRagDocumentIndexed(ragDoc.id, inserted);

  return {
    ragDocumentId: ragDoc.id,
    sourceDocumentId: doc.id,
    title: doc.title || `Knowledge ${doc.id}`,
    chunks: inserted,
    status: "indexed",
  };
}

export async function indexAdminStatuteDocument(statuteDocumentId: number): Promise<RAGIndexResult> {
  await ensureRagSchema();

  const doc = await storage.getStatuteDocument(statuteDocumentId);
  if (!doc) {
    throw new Error("Statute document not found");
  }

  const raw = doc.content || "";
  let sourceText = raw;
  let mimeType: string | null = null;
  let fileName: string | null = doc.filename || null;
  try {
    const fileMeta = await storage.getStatuteDocumentFile(doc.id);
    if (fileMeta) {
      mimeType = fileMeta.mimeType || null;
      fileName = fileMeta.originalFilename || fileName;
    }
    if (fileMeta?.extractedTextKey) {
      const fullText = await getR2ObjectText(fileMeta.extractedTextKey);
      if (fullText) {
        sourceText = fullText;
      }
    }
  } catch {
    console.warn("[RAG] Could not load full statute text from R2, using inline DB content.");
  }

  const cleaned = cleanLegalDocumentText(sourceText);
  if (!cleaned) {
    throw new Error("Statute document has no indexable text content");
  }

  const contentHash = sha256(cleaned);
  const ragDoc = await upsertRagDocument({
    userId: GLOBAL_STATUTE_RAG_USER_ID,
    sourceDocumentId: doc.id,
    title: doc.title || `Statute ${doc.id}`,
    fileName,
    mimeType,
    contentHash,
    status: "pending",
  });

  const chunks = chunkTextByTokens(cleaned).slice(0, MAX_CHUNKS_PER_DOC);
  const inserted = await indexChunksInDb(ragDoc.id, GLOBAL_STATUTE_RAG_USER_ID, doc.id, chunks, {
    sourceType: "admin-statute",
    category: doc.category || "general",
    statuteDocumentId: doc.id,
    filename: fileName,
  });

  await markRagDocumentIndexed(ragDoc.id, inserted);

  return {
    ragDocumentId: ragDoc.id,
    sourceDocumentId: doc.id,
    title: doc.title || `Statute ${doc.id}`,
    chunks: inserted,
    status: "indexed",
  };
}

// Index a single judgment from the judgments table into RAG vector store.
// The fullText + headnotes are embedded so semantic search can find real DB judgments.
export async function indexJudgmentDocument(judgmentId: string): Promise<RAGIndexResult> {
  await ensureRagSchema();

  const [row] = await db
    .select({
      id: judgments.id,
      citationString: judgments.citationString,
      title: judgments.title,
      petitioner: judgments.petitioner,
      respondent: judgments.respondent,
      headnotes: judgments.headnotes,
      fullText: judgments.fullText,
      decisionDate: judgments.decisionDate,
      courtName: courtsRef.name,
      journalCode: lawJournals.code,
    })
    .from(judgments)
    .leftJoin(courtsRef, eq(judgments.courtId, courtsRef.id))
    .innerJoin(lawJournals, eq(judgments.journalId, lawJournals.id))
    .where(eq(judgments.id, judgmentId))
    .limit(1);

  if (!row) throw new Error(`Judgment not found: ${judgmentId}`);

  // Build rich text: citation + title + parties + headnotes + full text
  const parts: string[] = [];
  parts.push(`CITATION: ${row.citationString}`);
  parts.push(`COURT: ${row.courtName || ""}`);
  if (row.title) parts.push(`TITLE: ${row.title}`);
  if (row.petitioner) parts.push(`PETITIONER: ${row.petitioner}`);
  if (row.respondent) parts.push(`RESPONDENT: ${row.respondent}`);
  if (row.headnotes) parts.push(`HEADNOTES:\n${row.headnotes}`);
  if (row.fullText) parts.push(`JUDGMENT:\n${row.fullText}`);

  const raw = parts.join("\n\n");
  const cleaned = cleanLegalDocumentText(raw);
  if (!cleaned) throw new Error(`Judgment ${judgmentId} has no indexable text`);

  const contentHash = sha256(cleaned);

  // Use numeric hash of UUID as sourceDocumentId (vector store expects integer)
  const sourceDocumentId = Math.abs(
    parseInt(judgmentId.replace(/-/g, "").slice(0, 8), 16),
  );

  const ragDoc = await upsertRagDocument({
    userId: GLOBAL_JUDGMENTS_RAG_USER_ID,
    sourceDocumentId,
    title: `${row.citationString} — ${row.title || "Judgment"}`,
    fileName: null,
    mimeType: null,
    contentHash,
    status: "pending",
  });

  const chunks = chunkTextByTokens(cleaned).slice(0, MAX_CHUNKS_PER_DOC);
  const inserted = await indexChunksInDb(ragDoc.id, GLOBAL_JUDGMENTS_RAG_USER_ID, sourceDocumentId, chunks, {
    sourceType: "judgment",
    category: "judgment",
    judgmentId: row.id,
    citationString: row.citationString,
    court: row.courtName || "",
    title: row.title || "",
  });

  await markRagDocumentIndexed(ragDoc.id, inserted);

  return {
    ragDocumentId: ragDoc.id,
    sourceDocumentId,
    title: `${row.citationString} — ${row.title || "Judgment"}`,
    chunks: inserted,
    status: "indexed",
  };
}

export async function retrieveForQuery(args: {
  userId: string;
  query: string;
  documentIds?: number[];
  metadataFilters?: Record<string, string>;
  topK?: number;
  expandedQueryText?: string;
}): Promise<RAGRetrievalResult> {
  await ensureRagSchema();

  const queryText = cleanLegalDocumentText(args.query || "");
  if (!queryText) {
    return { matches: [], confidence: "low" };
  }

  // Use expanded query for keyword search (better recall) but keep original for embedding
  const keywordQueryText = args.expandedQueryText
    ? cleanLegalDocumentText(args.expandedQueryText)
    : queryText;

  const requestedTopK = Math.max(1, args.topK || TOP_K);
  const queryEmbedding = await embedTextLocal(queryText);
  const { vectorWeight, keywordWeight } = resolveHybridWeights();
  const candidateTopK = Math.min(RERANK_POOL_CAP, Math.max(requestedTopK, requestedTopK * 4));
  const isGlobalAdminUser = GLOBAL_ADMIN_RAG_USER_IDS.includes(args.userId as any);
  const includeGlobalAdminSources = !isGlobalAdminUser && (!args.documentIds || args.documentIds.length === 0);
  const globalSearches = includeGlobalAdminSources
    ? GLOBAL_ADMIN_RAG_USER_IDS.map((globalUserId) =>
      similaritySearch({
        userId: globalUserId,
        queryEmbedding,
        queryText: keywordQueryText,
        metadataFilters: args.metadataFilters,
        topK: candidateTopK,
        vectorWeight,
        keywordWeight,
      }),
    )
    : [];
  const [userMatches, ...globalMatchGroups] = await Promise.all([
    similaritySearch({
      userId: args.userId,
      queryEmbedding,
      queryText: keywordQueryText,
      sourceDocumentIds: args.documentIds,
      metadataFilters: args.metadataFilters,
      topK: candidateTopK,
      vectorWeight,
      keywordWeight,
    }),
    ...globalSearches,
  ]);
  const globalMatches = globalMatchGroups.flat();
  const matches = [...userMatches, ...globalMatches]
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(candidateTopK, requestedTopK));

  // Strict filter: only return results that meet the minimum relevance threshold.
  // No last-resort fallbacks — returning wrong documents is worse than returning nothing.
  // Also filter out internal workspace state documents (not real user content).
  const filtered = matches
    .filter((m) => Number.isFinite(m.score) && m.score >= MIN_SCORE)
    .filter((m) => !m.title.startsWith("__"));

  // Ensure source diversity: separate statutes, judgments, and user documents.
  const statuteResults = filtered.filter((m) => {
    const srcType = String(m.metadata?.sourceType || "");
    return srcType === "statute" || srcType === "admin-statute";
  });
  const judgmentResults = filtered.filter((m) => {
    const srcType = String(m.metadata?.sourceType || "");
    return srcType === "judgment" || srcType === "admin-case-law";
  });
  const userResults = filtered.filter((m) => {
    const srcType = String(m.metadata?.sourceType || "");
    return srcType !== "statute" && srcType !== "admin-statute" && srcType !== "judgment" && srcType !== "admin-case-law";
  });

  // Build diverseResults by including candidates from all three categories.
  // Slice each category up to candidateTopK to ensure we pass a rich selection to reranking.
  const diverseResults: RagMatch[] = [];
  const maxCategorySlice = Math.max(candidateTopK, 15);
  diverseResults.push(...statuteResults.slice(0, maxCategorySlice));
  diverseResults.push(...judgmentResults.slice(0, maxCategorySlice));
  diverseResults.push(...userResults.slice(0, maxCategorySlice));

  const reranked = rerankAndDiversify(diverseResults, queryText, requestedTopK);
  const confidence = resolveConfidence(reranked.map((m) => m.score));
  return { matches: reranked, confidence };
}

export async function ensureIndexedForUserDocuments(args: {
  userId: string;
  sourceDocumentIds?: number[];
  maxToIndex?: number;
}): Promise<RAGEnsureIndexResult> {
  await ensureRagSchema();

  const allDocs = await storage.getDocuments(args.userId);
  const wantedIds = Array.isArray(args.sourceDocumentIds) && args.sourceDocumentIds.length > 0
    ? new Set(args.sourceDocumentIds.filter((id) => Number.isInteger(id) && id > 0))
    : null;
  const candidates = wantedIds
    ? allDocs.filter((doc) => wantedIds.has(doc.id))
    : allDocs;

  if (candidates.length === 0) {
    return {
      candidates: 0,
      alreadyIndexed: 0,
      attempted: 0,
      indexedNow: 0,
      failed: 0,
    };
  }

  const indexedIds = new Set<number>();
  if (dbAvailable && pool) {
    try {
      const ids = candidates.map((doc) => doc.id);
      const rows = await pool.query(
        `
        SELECT source_document_id
        FROM rag_documents
        WHERE user_id = $1
          AND status = 'indexed'
          AND chunk_count > 0
          AND source_document_id = ANY($2::int[])
        `,
        [args.userId, ids],
      );
      for (const row of rows.rows || []) {
        const id = Number((row as { source_document_id?: number }).source_document_id);
        if (Number.isInteger(id) && id > 0) indexedIds.add(id);
      }
    } catch {
      // If relation is not ready yet or query fails, continue and try indexing directly.
    }
  }

  const maxToIndex = Math.max(1, Number(args.maxToIndex || 3));
  const pending = candidates.filter((doc) => !indexedIds.has(doc.id)).slice(0, maxToIndex);

  let indexedNow = 0;
  let failed = 0;
  for (const doc of pending) {
    try {
      const result = await indexUserDocument(args.userId, doc.id);
      if (result.chunks > 0) {
        indexedNow += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return {
    candidates: candidates.length,
    alreadyIndexed: indexedIds.size,
    attempted: pending.length,
    indexedNow,
    failed,
  };
}

async function ensureIndexedForGlobalSource(args: {
  userId: string;
  sourceIds: number[];
  maxToIndex: number;
  indexFn: (sourceId: number) => Promise<RAGIndexResult>;
}): Promise<RAGEnsureIndexResult> {
  if (args.sourceIds.length === 0) {
    return {
      candidates: 0,
      alreadyIndexed: 0,
      attempted: 0,
      indexedNow: 0,
      failed: 0,
    };
  }

  const indexedIds = new Set<number>();
  if (dbAvailable && pool) {
    try {
      const rows = await pool.query(
        `
        SELECT source_document_id
        FROM rag_documents
        WHERE user_id = $1
          AND status = 'indexed'
          AND chunk_count > 0
          AND source_document_id = ANY($2::int[])
        `,
        [args.userId, args.sourceIds],
      );
      for (const row of rows.rows || []) {
        const id = Number((row as { source_document_id?: number }).source_document_id);
        if (Number.isInteger(id) && id > 0) indexedIds.add(id);
      }
    } catch {
      // If relation is not ready yet or query fails, continue and try indexing directly.
    }
  }

  const pending = args.sourceIds.filter((id) => !indexedIds.has(id)).slice(0, Math.max(1, args.maxToIndex));

  let indexedNow = 0;
  let failed = 0;
  for (const sourceId of pending) {
    try {
      const result = await args.indexFn(sourceId);
      if (result.chunks > 0) {
        indexedNow += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return {
    candidates: args.sourceIds.length,
    alreadyIndexed: indexedIds.size,
    attempted: pending.length,
    indexedNow,
    failed,
  };
}

export async function ensureIndexedForGlobalCaseLaw(args: {
  maxToIndex?: number;
}): Promise<RAGEnsureIndexResult> {
  await ensureRagSchema();

  let sourceIds: number[] = [];
  if (dbAvailable && pool) {
    try {
      const rows = await pool.query(
        `
        SELECT id
        FROM admin_knowledge
        WHERE replace(replace(replace(lower(coalesce(category, '')), '-', ''), ' ', ''), '_', '') = 'caselaw'
        ORDER BY id ASC
        `,
      );
      sourceIds = (rows.rows || [])
        .map((row: any) => Number(row.id))
        .filter((id: number) => Number.isInteger(id) && id > 0);
    } catch {
      // Fallback below when direct query fails.
    }
  }
  if (sourceIds.length === 0) {
    const allDocs = await storage.getAllAdminKnowledge();
    sourceIds = allDocs
      .filter((doc) => isCaseLawCategory(doc.category))
      .map((doc) => doc.id);
  }

  return ensureIndexedForGlobalSource({
    userId: GLOBAL_CASELAW_RAG_USER_ID,
    sourceIds,
    maxToIndex: Number(args.maxToIndex || 3),
    indexFn: (sourceId) => indexAdminCaseLawDocument(sourceId),
  });
}

export async function ensureIndexedForGlobalStatutes(args: {
  maxToIndex?: number;
}): Promise<RAGEnsureIndexResult> {
  await ensureRagSchema();

  let sourceIds: number[] = [];
  if (dbAvailable && pool) {
    try {
      const rows = await pool.query(
        `
        SELECT id
        FROM statute_documents
        ORDER BY id ASC
        `,
      );
      sourceIds = (rows.rows || [])
        .map((row: any) => Number(row.id))
        .filter((id: number) => Number.isInteger(id) && id > 0);
    } catch {
      // Fallback below when direct query fails.
    }
  }
  if (sourceIds.length === 0) {
    const allDocs = await storage.getAllStatuteDocuments();
    sourceIds = allDocs.map((doc) => doc.id);
  }

  return ensureIndexedForGlobalSource({
    userId: GLOBAL_STATUTE_RAG_USER_ID,
    sourceIds,
    maxToIndex: Number(args.maxToIndex || 3),
    indexFn: (sourceId) => indexAdminStatuteDocument(sourceId),
  });
}

export async function ensureIndexedForGlobalAdminKnowledge(args: {
  maxToIndex?: number;
}): Promise<RAGEnsureIndexResult> {
  await ensureRagSchema();

  let sourceIds: number[] = [];
  if (dbAvailable && pool) {
    try {
      const rows = await pool.query(
        `
        SELECT id
        FROM admin_knowledge
        WHERE replace(replace(replace(lower(coalesce(category, '')), '-', ''), ' ', ''), '_', '') <> 'caselaw'
        ORDER BY id ASC
        `,
      );
      sourceIds = (rows.rows || [])
        .map((row: any) => Number(row.id))
        .filter((id: number) => Number.isInteger(id) && id > 0);
    } catch {
      // Fallback below when direct query fails.
    }
  }
  if (sourceIds.length === 0) {
    const allDocs = await storage.getAllAdminKnowledge();
    sourceIds = allDocs
      .filter((doc) => !isCaseLawCategory(doc.category))
      .map((doc) => doc.id);
  }

  return ensureIndexedForGlobalSource({
    userId: GLOBAL_ADMIN_KNOWLEDGE_RAG_USER_ID,
    sourceIds,
    maxToIndex: Number(args.maxToIndex || 3),
    indexFn: (sourceId) => indexAdminKnowledgeDocument(sourceId),
  });
}

export async function ensureIndexedForGlobalAdminSources(args: {
  maxCaseLawToIndex?: number;
  maxStatuteToIndex?: number;
  maxKnowledgeToIndex?: number;
}): Promise<RAGGlobalEnsureSummary> {
  const caseLaw = await ensureIndexedForGlobalCaseLaw({
    maxToIndex: Number(args.maxCaseLawToIndex || 3),
  });
  const statutes = await ensureIndexedForGlobalStatutes({
    maxToIndex: Number(args.maxStatuteToIndex || 2),
  });
  const adminKnowledge = await ensureIndexedForGlobalAdminKnowledge({
    maxToIndex: Number(args.maxKnowledgeToIndex || 2),
  });

  return {
    caseLaw,
    statutes,
    adminKnowledge,
    indexedNow: caseLaw.indexedNow + statutes.indexedNow + adminKnowledge.indexedNow,
  };
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
