-- Per-tenant HNSW indexes for rag_chunks.
--
-- Why: rag_chunks holds every tenant in one table and one shared HNSW index.
-- global-admin-judgments is 96% of the rows, so a vector search restricted to any
-- other tenant scanned judgment vectors, filtered them all away, and returned
-- zero rows. Measured with a real voyage-law-2 query vector:
--
--   global-admin-judgments          -> 39 rows
--   global-admin-statute            ->  0 rows
--   global-admin-statute-sections   ->  1 row
--
-- A partial index turns the tenant filter into a pre-filter, so the graph walk
-- only ever visits that tenant's vectors.
--
-- CONCURRENTLY keeps the table readable and writable during the build, but it
-- cannot run inside a transaction block. Run each statement on its own.
-- Expected build time is minutes per index; disk cost is roughly 2 KB per vector.
--
-- Rollback: DROP INDEX CONCURRENTLY <name>;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_chunks_hnsw_statute
  ON rag_chunks USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE user_id = 'global-admin-statute';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_chunks_hnsw_statute_sections
  ON rag_chunks USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE user_id = 'global-admin-statute-sections';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_chunks_hnsw_case_law
  ON rag_chunks USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE user_id = 'global-admin-case-law';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_chunks_hnsw_knowledge
  ON rag_chunks USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE user_id = 'global-admin-knowledge';

-- Judgments keep using the existing shared index idx_rag_chunks_embedding_hnsw,
-- which already works for them because they dominate it.
