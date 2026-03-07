import { pool, dbAvailable } from "../db";
import type { RetrievedStyleChunk, StyleMemoryModule } from "./types";

type InsertStyleChunkArgs = {
  sampleId: number;
  userId: string;
  orgId?: number | null;
  module: StyleMemoryModule;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embedding: number[];
};

function assertDb() {
  if (!dbAvailable || !pool) {
    throw new Error("Database is not available for style-memory operations");
  }
}

function vectorLiteral(values: number[]): string {
  const safe = values.map((n) => (Number.isFinite(n) ? n : 0));
  return `[${safe.join(",")}]`;
}

export async function ensureStyleMemorySchema(): Promise<void> {
  if (!dbAvailable || !pool) return;
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS style_memory_settings (
      id serial PRIMARY KEY,
      user_id text NOT NULL,
      org_id integer NULL,
      module text NOT NULL,
      enabled boolean NOT NULL DEFAULT true,
      ownership_mode text NOT NULL DEFAULT 'user-org',
      learning_source text NOT NULL DEFAULT 'full-activity',
      coverage text NOT NULL DEFAULT 'generation-only',
      strictness text NOT NULL DEFAULT 'balanced',
      last_backfill_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS style_memory_samples (
      id serial PRIMARY KEY,
      user_id text NOT NULL,
      org_id integer NULL,
      module text NOT NULL,
      source_type text NOT NULL,
      source_ref text NULL,
      title text NOT NULL,
      raw_text text NOT NULL,
      text_hash text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS style_memory_chunks (
      id serial PRIMARY KEY,
      sample_id integer NOT NULL REFERENCES style_memory_samples(id) ON DELETE CASCADE,
      user_id text NOT NULL,
      org_id integer NULL,
      module text NOT NULL,
      chunk_index integer NOT NULL,
      content text NOT NULL,
      token_count integer NOT NULL,
      embedding vector(384) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_style_memory_samples_hash ON style_memory_samples (module, user_id, coalesce(org_id, 0), text_hash)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_style_memory_chunks_unique ON style_memory_chunks (sample_id, chunk_index)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_style_memory_chunks_scope ON style_memory_chunks (module, user_id, org_id, sample_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_style_memory_chunks_tsv ON style_memory_chunks USING gin (to_tsvector('simple', content))`);
  try {
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_style_memory_chunks_embedding_cosine ON style_memory_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`);
  } catch (err: any) {
    console.warn("[StyleMemory] Could not ensure ivfflat index:", err?.message || err);
  }
}

export async function clearSampleChunks(sampleId: number): Promise<void> {
  assertDb();
  await pool.query("DELETE FROM style_memory_chunks WHERE sample_id = $1", [sampleId]);
}

export async function insertStyleChunkBatch(entries: InsertStyleChunkArgs[]): Promise<number> {
  assertDb();
  if (entries.length === 0) return 0;
  for (const entry of entries) {
    await pool.query(
      `
      INSERT INTO style_memory_chunks (sample_id, user_id, org_id, module, chunk_index, content, token_count, embedding)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
      ON CONFLICT (sample_id, chunk_index)
      DO UPDATE SET
        content = EXCLUDED.content,
        token_count = EXCLUDED.token_count,
        embedding = EXCLUDED.embedding
      `,
      [
        entry.sampleId,
        entry.userId,
        entry.orgId ?? null,
        entry.module,
        entry.chunkIndex,
        entry.content,
        entry.tokenCount,
        vectorLiteral(entry.embedding),
      ],
    );
  }
  return entries.length;
}

export async function styleSimilaritySearch(args: {
  userId: string;
  module: StyleMemoryModule;
  orgId?: number | null;
  includeOrg: boolean;
  queryText: string;
  queryEmbedding: number[];
  topK: number;
}): Promise<RetrievedStyleChunk[]> {
  assertDb();
  const candidateLimit = Math.max(20, args.topK * 5);
  const scopeSql = args.includeOrg && args.orgId
    ? "(c.user_id = $1 AND c.org_id IS NULL) OR (c.org_id = $3)"
    : "(c.user_id = $1 AND c.org_id IS NULL)";

  const result = await pool.query(
    `
    WITH vector_hits AS (
      SELECT
        c.sample_id,
        s.title,
        s.source_type,
        c.chunk_index,
        c.content,
        GREATEST(0, 1 - (c.embedding <=> $4::vector)) AS vector_score,
        COALESCE(ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', $5)), 0) AS keyword_score
      FROM style_memory_chunks c
      JOIN style_memory_samples s ON s.id = c.sample_id
      WHERE (${scopeSql})
        AND c.module = $2
        AND s.status = 'active'
      ORDER BY c.embedding <=> $4::vector ASC
      LIMIT $6
    ),
    keyword_hits AS (
      SELECT
        c.sample_id,
        s.title,
        s.source_type,
        c.chunk_index,
        c.content,
        GREATEST(0, 1 - (c.embedding <=> $4::vector)) AS vector_score,
        COALESCE(ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', $5)), 0) AS keyword_score
      FROM style_memory_chunks c
      JOIN style_memory_samples s ON s.id = c.sample_id
      WHERE (${scopeSql})
        AND c.module = $2
        AND s.status = 'active'
        AND to_tsvector('simple', c.content) @@ plainto_tsquery('simple', $5)
      ORDER BY keyword_score DESC
      LIMIT $6
    ),
    merged AS (
      SELECT * FROM vector_hits
      UNION
      SELECT * FROM keyword_hits
    )
    SELECT
      sample_id,
      title,
      source_type,
      chunk_index,
      content,
      vector_score,
      keyword_score,
      ((0.74 * vector_score) + (0.26 * LEAST(1.0, keyword_score))) AS score
    FROM merged
    ORDER BY score DESC, vector_score DESC
    LIMIT $7
    `,
    [
      args.userId,
      args.module,
      args.orgId ?? null,
      vectorLiteral(args.queryEmbedding),
      args.queryText,
      candidateLimit,
      Math.max(1, args.topK),
    ],
  );

  return result.rows.map((row: any) => ({
    sampleId: Number(row.sample_id),
    title: String(row.title || "Style sample"),
    sourceType: String(row.source_type || "upload") as any,
    chunkIndex: Number(row.chunk_index || 0),
    content: String(row.content || ""),
    vectorScore: Number(row.vector_score || 0),
    keywordScore: Number(row.keyword_score || 0),
    score: Number(row.score || 0),
  }));
}

