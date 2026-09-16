-- Journal codes that appear in judgment "Reported As:" headers but were absent
-- from law_journals, which left those citations unparseable.
--
-- Counts are occurrences across the headers of rows currently labelled
-- text_status = 'unknown':
--   KLR 223, CLR 112, PCTLR 84, PTCL 40, TAX 10, ATIR 6, SCR 1
--
-- `judgments` holds no rows under these journals, so adding them changes no
-- existing citation lookup. It only lets the citation parser recognise the
-- shape of a citation naming one of them.
--
-- The `name` values are placeholders set to the code itself: the full titles
-- were not verifiable from the data, and a legal product should not display a
-- guessed journal name. Replace them when the correct titles are known.

INSERT INTO law_journals (code, name, is_active) VALUES
  ('KLR',   'KLR',   true),
  ('CLR',   'CLR',   true),
  ('PCTLR', 'PCTLR', true),
  ('PTCL',  'PTCL',  true),
  ('TAX',   'TAX',   true),
  ('ATIR',  'ATIR',  true),
  ('SCR',   'SCR',   true)
ON CONFLICT (code) DO NOTHING;
