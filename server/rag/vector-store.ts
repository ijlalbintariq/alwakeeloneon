import { pool, dbAvailable } from "../db";

export type RagChunkInsert = {
  ragDocumentId: number;
  userId: string;
  sourceDocumentId: number;
  chunkIndex: number;
  tokenCount: number;
  chunkText: string;
  embedding: number[] | null;
  metadata?: Record<string, unknown>;
  parentChunkId?: number | null;
};

export type RagMatch = {
  id: number;
  ragDocumentId: number;
  sourceDocumentId: number;
  title: string;
  chunkIndex: number;
  tokenCount: number;
  chunkText: string;
  metadata: Record<string, unknown>;
  score: number;
  vectorScore: number;
  keywordScore: number;
};

function assertDb() {
  if (!dbAvailable || !pool) {
    throw new Error("Database is not available for RAG operations");
  }
}

function vectorLiteral(values: number[]): string {
  const safe = values.map((n) => (Number.isFinite(n) ? n : 0));
  return `[${safe.join(",")}]`;
}

export async function ensureRagSchema(): Promise<void> {
  if (!dbAvailable || !pool) return;

  await pool.query("CREATE EXTENSION IF NOT EXISTS vector");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rag_documents (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      org_id INTEGER NULL,
      source_document_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      file_name TEXT NULL,
      mime_type TEXT NULL,
      content_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      chunk_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, source_document_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rag_chunks (
      id BIGSERIAL PRIMARY KEY,
      rag_document_id BIGINT NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      source_document_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      token_count INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      embedding VECTOR(384) NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (rag_document_id, chunk_index)
    )
  `);

  // Ensure embedding is nullable in existing databases
  await pool.query("ALTER TABLE rag_chunks ALTER COLUMN embedding DROP NOT NULL");

  // Add parent_chunk_id column and index for Parent-Child relationships
  await pool.query("ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS parent_chunk_id BIGINT NULL REFERENCES rag_chunks(id) ON DELETE CASCADE");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_rag_chunks_parent ON rag_chunks (parent_chunk_id)");

  await pool.query("CREATE INDEX IF NOT EXISTS idx_rag_documents_user_source ON rag_documents (user_id, source_document_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_rag_chunks_user_doc ON rag_chunks (user_id, source_document_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_rag_chunks_tsv_simple ON rag_chunks USING gin (to_tsvector('simple', chunk_text))");

  // IVFFLAT can fail before enough rows exist; keep startup resilient.
  try {
    await pool.query("CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_cosine ON rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)");
  } catch (err: any) {
    console.warn("[RAG] Could not ensure ivfflat index:", err?.message || err);
  }
}

export async function upsertRagDocument(args: {
  userId: string;
  sourceDocumentId: number;
  title: string;
  fileName?: string | null;
  mimeType?: string | null;
  contentHash: string;
  status?: string;
}): Promise<{ id: number; status: string; chunkCount: number }> {
  assertDb();

  const result = await pool.query(
    `
    INSERT INTO rag_documents (user_id, source_document_id, title, file_name, mime_type, content_hash, status, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, now())
    ON CONFLICT (user_id, source_document_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      file_name = EXCLUDED.file_name,
      mime_type = EXCLUDED.mime_type,
      content_hash = EXCLUDED.content_hash,
      status = EXCLUDED.status,
      updated_at = now()
    RETURNING id, status, chunk_count
    `,
    [
      args.userId,
      args.sourceDocumentId,
      args.title,
      args.fileName || null,
      args.mimeType || null,
      args.contentHash,
      args.status || "pending",
    ],
  );

  return {
    id: Number(result.rows[0].id),
    status: String(result.rows[0].status || "pending"),
    chunkCount: Number(result.rows[0].chunk_count || 0),
  };
}

export async function replaceDocumentChunks(ragDocumentId: number, entries: RagChunkInsert[]): Promise<number> {
  assertDb();

  await resetDocumentChunks(ragDocumentId);
  const inserted = await insertDocumentChunkBatch(entries);
  await markRagDocumentIndexed(ragDocumentId, inserted);
  return inserted;
}

export async function resetDocumentChunks(ragDocumentId: number): Promise<void> {
  assertDb();
  await pool.query("DELETE FROM rag_chunks WHERE rag_document_id = $1", [ragDocumentId]);
  await pool.query("UPDATE rag_documents SET chunk_count = 0, status = 'pending', updated_at = now() WHERE id = $1", [ragDocumentId]);
}

export async function insertDocumentChunkBatch(entries: RagChunkInsert[]): Promise<number> {
  assertDb();
  if (entries.length === 0) return 0;

  // Build a single multi-row INSERT for performance.
  // Each row occupies 9 consecutive $N placeholders.
  const valuePlaceholders: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  for (const chunk of entries) {
    const embedVal = chunk.embedding ? vectorLiteral(chunk.embedding) : null;
    valuePlaceholders.push(
      `($${p},$${p+1},$${p+2},$${p+3},$${p+4},$${p+5},$${p+6}::jsonb,$${p+7},$${p+8})`,
    );
    params.push(
      chunk.ragDocumentId,
      chunk.userId,
      chunk.sourceDocumentId,
      chunk.chunkIndex,
      chunk.tokenCount,
      chunk.chunkText,
      JSON.stringify(chunk.metadata || {}),
      embedVal,
      chunk.parentChunkId || null,
    );
    p += 9;
  }

  const sql = `
    INSERT INTO rag_chunks
      (rag_document_id, user_id, source_document_id, chunk_index, token_count, chunk_text, metadata, embedding, parent_chunk_id)
    VALUES ${valuePlaceholders.join(",")}
    ON CONFLICT (rag_document_id, chunk_index) DO NOTHING
  `;

  const result = await pool.query(sql, params);
  return result.rowCount ?? entries.length;
}

export async function insertDocumentChunksReturningIds(entries: RagChunkInsert[]): Promise<{ id: number; chunkIndex: number }[]> {
  assertDb();
  if (entries.length === 0) return [];

  const valuePlaceholders: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  for (const chunk of entries) {
    const embedVal = chunk.embedding ? vectorLiteral(chunk.embedding) : null;
    valuePlaceholders.push(
      `($${p},$${p+1},$${p+2},$${p+3},$${p+4},$${p+5},$${p+6}::jsonb,$${p+7},$${p+8})`,
    );
    params.push(
      chunk.ragDocumentId,
      chunk.userId,
      chunk.sourceDocumentId,
      chunk.chunkIndex,
      chunk.tokenCount,
      chunk.chunkText,
      JSON.stringify(chunk.metadata || {}),
      embedVal,
      chunk.parentChunkId || null,
    );
    p += 9;
  }

  const sql = `
    INSERT INTO rag_chunks
      (rag_document_id, user_id, source_document_id, chunk_index, token_count, chunk_text, metadata, embedding, parent_chunk_id)
    VALUES ${valuePlaceholders.join(",")}
    ON CONFLICT (rag_document_id, chunk_index) DO UPDATE SET
      chunk_text = EXCLUDED.chunk_text,
      metadata = EXCLUDED.metadata,
      embedding = COALESCE(EXCLUDED.embedding, rag_chunks.embedding)
    RETURNING id, chunk_index
  `;

  const result = await pool.query(sql, params);
  return result.rows.map((row: any) => ({
    id: Number(row.id),
    chunkIndex: Number(row.chunk_index),
  }));
}

export async function markRagDocumentIndexed(ragDocumentId: number, chunkCount: number): Promise<void> {
  assertDb();
  await pool.query("UPDATE rag_documents SET chunk_count = $2, status = 'indexed', updated_at = now() WHERE id = $1", [ragDocumentId, chunkCount]);
}

export async function similaritySearch(args: {
  userId: string;
  queryEmbedding: number[];
  queryText: string;
  sourceDocumentIds?: number[];
  metadataFilters?: Record<string, string>;
  topK: number;
  vectorWeight?: number;
  keywordWeight?: number;
}): Promise<RagMatch[]> {
  assertDb();
  const vectorWeightRaw = Number.isFinite(args.vectorWeight) ? Number(args.vectorWeight) : 0.72;
  const keywordWeightRaw = Number.isFinite(args.keywordWeight) ? Number(args.keywordWeight) : 0.28;
  const weightSum = vectorWeightRaw + keywordWeightRaw || 1;
  const vectorWeight = Math.max(0, vectorWeightRaw / weightSum);
  const keywordWeight = Math.max(0, keywordWeightRaw / weightSum);
  const candidateLimit = Math.max(args.topK * 4, 20);

  const sourceFilter = args.sourceDocumentIds && args.sourceDocumentIds.length > 0
    ? " AND c.source_document_id = ANY($8::int[])"
    : "";

  const params: any[] = [
    args.userId,
    vectorLiteral(args.queryEmbedding),
    args.queryText,
    args.topK,
    candidateLimit,
    vectorWeight,
    keywordWeight,
  ];
  if (args.sourceDocumentIds && args.sourceDocumentIds.length > 0) {
    params.push(args.sourceDocumentIds);
  }

  let filterSql = "";
  if (args.metadataFilters) {
    for (const [key, val] of Object.entries(args.metadataFilters)) {
      if (val !== undefined && val !== null) {
        const safeKey = key.replace(/[^a-zA-Z0-9_]/g, "");
        if (safeKey) {
          filterSql += ` AND c.metadata->>'${safeKey}' = $${params.length + 1}`;
          params.push(val);
        }
      }
    }
  }

  const sql = `
    WITH vector_hits AS (
      SELECT
        c.id,
        c.rag_document_id,
        c.source_document_id,
        d.title,
        c.chunk_index,
        COALESCE(p.token_count, c.token_count) as token_count,
        COALESCE(p.chunk_text, c.chunk_text) as chunk_text,
        c.metadata,
        GREATEST(0, 1 - (c.embedding <=> $2::vector)) AS vector_score,
        COALESCE(ts_rank_cd(to_tsvector('simple', COALESCE(p.chunk_text, c.chunk_text)), plainto_tsquery('simple', $3)), 0) AS keyword_score
      FROM rag_chunks c
      JOIN rag_documents d ON d.id = c.rag_document_id
      LEFT JOIN rag_chunks p ON p.id = c.parent_chunk_id
      WHERE c.user_id = $1${sourceFilter}${filterSql}
      ORDER BY c.embedding <=> $2::vector ASC
      LIMIT $5
    ),
    keyword_hits AS (
      SELECT
        c.id,
        c.rag_document_id,
        c.source_document_id,
        d.title,
        c.chunk_index,
        COALESCE(p.token_count, c.token_count) as token_count,
        COALESCE(p.chunk_text, c.chunk_text) as chunk_text,
        c.metadata,
        GREATEST(0, 1 - (c.embedding <=> $2::vector)) AS vector_score,
        COALESCE(ts_rank_cd(to_tsvector('simple', COALESCE(p.chunk_text, c.chunk_text)), plainto_tsquery('simple', $3)), 0) AS keyword_score
      FROM rag_chunks c
      JOIN rag_documents d ON d.id = c.rag_document_id
      LEFT JOIN rag_chunks p ON p.id = c.parent_chunk_id
      WHERE c.user_id = $1${sourceFilter}${filterSql}
        AND to_tsvector('simple', COALESCE(p.chunk_text, c.chunk_text)) @@ plainto_tsquery('simple', $3)
      ORDER BY keyword_score DESC
      LIMIT $5
    ),
    merged AS (
      SELECT * FROM vector_hits
      UNION
      SELECT * FROM keyword_hits
    )
    SELECT
      id,
      rag_document_id,
      source_document_id,
      title,
      chunk_index,
      token_count,
      chunk_text,
      metadata,
      vector_score,
      keyword_score,
      (($6 * vector_score) + ($7 * LEAST(1.0, keyword_score))) AS score
    FROM merged
    ORDER BY score DESC, vector_score DESC
    LIMIT $4
  `;

  const result = await pool.query(sql, params);
  return result.rows.map((row: any) => ({
    id: Number(row.id),
    ragDocumentId: Number(row.rag_document_id),
    sourceDocumentId: Number(row.source_document_id),
    title: String(row.title || "Untitled Document"),
    chunkIndex: Number(row.chunk_index),
    tokenCount: Number(row.token_count),
    chunkText: String(row.chunk_text || ""),
    metadata: (row.metadata || {}) as Record<string, unknown>,
    score: Number(row.score || 0),
    vectorScore: Number(row.vector_score || 0),
    keywordScore: Number(row.keyword_score || 0),
  }));
}

export async function deleteVectorsBySourceDocument(args: {
  sourceDocumentId: number;
  userId?: string;
}): Promise<number> {
  assertDb();

  if (args.userId) {
    const del = await pool.query(
      `DELETE FROM rag_chunks WHERE source_document_id = $1 AND user_id = $2 RETURNING id`,
      [args.sourceDocumentId, args.userId],
    );
    await pool.query("UPDATE rag_documents SET chunk_count = 0, status = 'pending', updated_at = now() WHERE source_document_id = $1 AND user_id = $2", [args.sourceDocumentId, args.userId]);
    return del.rowCount || 0;
  }

  const del = await pool.query(`DELETE FROM rag_chunks WHERE source_document_id = $1 RETURNING id`, [args.sourceDocumentId]);
  await pool.query("UPDATE rag_documents SET chunk_count = 0, status = 'pending', updated_at = now() WHERE source_document_id = $1", [args.sourceDocumentId]);
  return del.rowCount || 0;
}
