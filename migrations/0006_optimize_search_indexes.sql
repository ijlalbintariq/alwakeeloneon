-- Migration: Add stored tsvector columns for faster full-text search
-- Purpose: Pre-compute tsvector at INSERT/UPDATE time instead of per-query
-- This eliminates the expression evaluation overhead on every query,
-- making the GIN index lookups even faster.
--
-- IMPORTANT: The expression-based GIN indexes (idx_judgments_full_text_tsv,
-- idx_case_law_full_text_tsv) still work fine. These stored columns are an
-- optimization — once created, update searchCaseLaw and searchJudgmentsByKeywords
-- to reference the column directly: WHERE search_tsv @@ to_tsquery(...)

-- judgments: stored tsvector from title + headnotes + full_text
ALTER TABLE judgments ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(headnotes, '') || ' ' || coalesce(full_text, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_judgments_search_tsv
  ON judgments USING gin (search_tsv);

-- case_law: stored tsvector from citation + title + summary + court
ALTER TABLE case_law ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(citation, '') || ' ' ||
      coalesce(title, '') || ' ' ||
      coalesce(summary, '') || ' ' ||
      coalesce(court, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_case_law_search_tsv
  ON case_law USING gin (search_tsv);
