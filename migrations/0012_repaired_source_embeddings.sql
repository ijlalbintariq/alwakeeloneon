-- Alternative embeddings are isolated from the existing Voyage index.
CREATE TABLE IF NOT EXISTS rag_repaired_chunks (
  id BIGSERIAL PRIMARY KEY,
  model TEXT NOT NULL,
  user_id TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('judgment', 'admin')),
  source_id TEXT NOT NULL,
  source_document_id INTEGER NOT NULL,
  source_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding HALFVEC(1024) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model, user_id, source_kind, source_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS rag_repaired_chunks_scope_idx ON rag_repaired_chunks (model, user_id);
