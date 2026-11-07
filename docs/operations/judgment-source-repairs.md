# Source-backed judgment repairs

Use `script/repair_judgment_identity.ts` for reviewed corrections to existing judgment records. A plan retains the canonical UUID and citation, records the expected original fingerprint, and identifies complete source bytes by SHA-256. Text and Markdown originals are supported alongside extracted PDF sources. Preview is the default; `--apply` requires a durable, exclusive backup before transactional writes.

For repairs without embedding charges:

```sh
node --import tsx --import ./script/no_paid_network.ts \
  script/repair_judgment_identity.ts \
  --plan /private/path/plan.json --backup /private/path/before.json
```

Inspect the preview, then use a new backup filename and add `--apply`. The preload blocks HTTP clients, including accidental AI/embedding requests. PostgreSQL connections remain available. Never run `index_repaired_sources.ts --apply` in this mode.

Updates refresh existing PostgreSQL text indexes and source-derived search summaries. Existing chunk text and vectors are retained only where the excerpt occurs in the corrected body. Unsupported excerpts are backed up and removed. Retained chunks receive canonical identity metadata and a body hash; retrieval checks that hash and refreshes titles and URLs from the canonical judgment. No replacement vectors are generated. Records with no retained vectors have limited semantic coverage until separately authorized embedding work.

Body replacements rebuild outgoing citation references. Only identity-checked targets with compatible citations receive links; unresolved references stay pending. Incoming references remain subject to reader validation. Numeric citation keys and source associations are checked before mutation. Court references must agree with the reviewed source.

Matching a stored original establishes internal consistency. It does not independently authenticate a court judgment. Ambiguous originals and conflicting canonical keys require separate review; do not rename a citation to match unrelated text.

Keep full source bytes, original snapshots, plans, backups, and receipts in private storage. Do not commit credentials or the judgment corpus.
