-- Apply before deploying canonical-owner-aware readers. Keep the old unique
-- index until the new readers and court-aware lookup are live.
ALTER TABLE judgments ADD COLUMN IF NOT EXISTS canonical_judgment_id UUID REFERENCES judgments(id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='judgments'::regclass AND conname='judgments_canonical_link_valid') THEN
    ALTER TABLE judgments ADD CONSTRAINT judgments_canonical_link_valid
      CHECK (canonical_judgment_id IS NULL OR (canonical_judgment_id <> id AND is_active = false));
  END IF;
END $$;
ALTER TABLE judgments ADD COLUMN IF NOT EXISTS citation_section TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_judgments_citation_parts ON judgments(year,journal_id,page);
CREATE INDEX IF NOT EXISTS judgments_canonical_owner_idx ON judgments(canonical_judgment_id) WHERE canonical_judgment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS judgments_reported_citation_unique ON judgments(
  year,journal_id,page,
  coalesce('id:' || court_id::text,'court:' || lower(regexp_replace(coalesce(court_name_snapshot,''),'[^[:alnum:]]','','g'))),
  citation_section
) WHERE canonical_judgment_id IS NULL;
