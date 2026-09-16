-- Judgment text provenance.
--
-- The original ingest wrote a document's body to every citation that document
-- mentioned, not only to the citation it is reported under. About 20% of
-- `judgments` rows therefore hold a body belonging to a different case, with a
-- plausible title, headnotes and date, so the mislabelling is invisible.
--
-- These columns record, per row, whether the stored body actually belongs to
-- that row's citation. No text is deleted: a row whose body belongs elsewhere
-- keeps it, and `text_true_citation` records the citation the body announces
-- itself under ("Reported As:" in the body's own header).
--
--   text_status = 'own'        body belongs to this citation, safe to serve
--   text_status = 'mislabeled' body belongs to text_true_citation, not this row
--   text_status = 'unknown'    shared body, true owner not yet determined
--   text_status IS NULL        not yet classified

ALTER TABLE judgments ADD COLUMN IF NOT EXISTS text_status text;
ALTER TABLE judgments ADD COLUMN IF NOT EXISTS text_true_citation text;

CREATE INDEX IF NOT EXISTS idx_judgments_text_status ON judgments (text_status);
