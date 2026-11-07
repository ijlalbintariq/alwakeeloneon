-- Apply only AFTER canonical-owner-aware readers and ambiguous-citation
-- rejection are live. Genuine court sections may share year/journal/page.
ALTER TABLE judgments DROP CONSTRAINT IF EXISTS judgments_year_journal_page_unique;
DROP INDEX IF EXISTS judgments_year_journal_page_unique;
-- Earlier local preparation used this redundant name; keep the existing
-- idx_judgments_citation_parts index instead.
DROP INDEX IF EXISTS judgments_citation_parts_idx;

DROP INDEX IF EXISTS judgments_court_citation_unique;
