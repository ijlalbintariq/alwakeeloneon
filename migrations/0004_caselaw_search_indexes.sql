-- Migration: Add GIN full-text search index to case_law table
-- Purpose: Fix slow ILIKE queries (8-10s) on 162k rows → <500ms
-- Without this, ILIKE does full sequential scan; GIN index enables fast text search

-- Enable pg_trgm extension for trigram matching (required for ILIKE GIN index)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes on most-searched text columns
-- These make ILIKE '%keyword%' fast (from seconds → milliseconds)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_case_law_citation_trgm
  ON case_law USING gin (citation gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_case_law_title_trgm
  ON case_law USING gin (title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_case_law_summary_trgm
  ON case_law USING gin (summary gin_trgm_ops);

-- tsvector index for full-text search (ts_rank, plainto_tsquery)
-- This is used in the ORDER BY relevance scoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_case_law_fts
  ON case_law USING gin (
    to_tsvector('simple',
      coalesce(citation, '') || ' ' ||
      coalesce(title, '') || ' ' ||
      coalesce(summary, '') || ' ' ||
      coalesce(court, '') || ' ' ||
      coalesce(array_to_string(keywords, ' '), '')
    )
  );

-- B-tree indexes for structured field lookups (year, report, page)
CREATE INDEX IF NOT EXISTS idx_case_law_year ON case_law (citation_year);
CREATE INDEX IF NOT EXISTS idx_case_law_report ON case_law (citation_report);
CREATE INDEX IF NOT EXISTS idx_case_law_page ON case_law (citation_page);
CREATE INDEX IF NOT EXISTS idx_case_law_role ON case_law (citation_role);
CREATE INDEX IF NOT EXISTS idx_case_law_source_type ON case_law (source_type);

-- Composite index for common query pattern: year + report + role
CREATE INDEX IF NOT EXISTS idx_case_law_year_report_role
  ON case_law (citation_year, citation_report, citation_role);
