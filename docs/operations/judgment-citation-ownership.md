# Source-backed citation and duplicate repair

The reported citation namespace includes its court and publisher section. A year,
journal and page alone can identify several different cases. Importers must not
invent a page number to avoid a collision.

Apply `0013_judgment_canonical_ownership.sql` before deployment. It only adds
backward-compatible columns and indexes. Keep the original global unique index
until canonical-aware readers and ambiguity rejection are confirmed live.
Then apply `0014_enable_court_scoped_citations.sql` to permit genuine court and
publisher sections to share numeric citation components.

`repair_judgment_identity.ts` accepts reviewed citation corrections only when the
complete unchanged original establishes the existing parties and court under
the corrected citation. The corrected citation must appear in the source header.
Use `--keyword-only` to avoid embedding operations. The database maintains its
native text indexes. Citation graphs and obsolete incoming references are updated
in the same backed-up transaction.

`repair_judgment_ownership.ts` retires only complete-text duplicates whose parties,
court and source match an active, internally consistent canonical case. Archived
rows retain their historical metadata and receive an explicit canonical UUID.
Old UUID readers follow one hop; false historical citations are never aliases.
The worker refuses chains and preserves all vector rows. Query-time retrieval
uses the canonical title, citation and URL and checks excerpts against its body.
Incorrect graph references become pending rather than evidence for another case.

Both workers preview by default, require source checksums and record fingerprints,
and durably save complete before-images before their first mutation. Plans contain
at most 100 records. Keep snapshots, source files, plans, backups and receipts out
of Git. To prohibit external HTTP during a zero-cost operation, preload
`--import ./script/no_paid_network.ts`; use native PostgreSQL connections only.

Source consistency does not independently authenticate a court judgment. Hold
records whose original, parties, court, publisher section or citation ownership
cannot be established. Do not substitute a similar case or silently overwrite
another court's case.
