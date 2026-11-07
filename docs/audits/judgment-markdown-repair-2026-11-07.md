# Markdown judgment repair — 7 November 2026

## Status

Code and reviewed repair plans are prepared. **No database repair transaction has committed in this run.** The last public health check still served `cb250fb`; main contains the required current-body excerpt guard in `23cc470`. Deploy that guard before applying keyword-only repairs. The workspace cannot read Render build status or trigger its deployments.

The user requested no spending. No AI, reranking, or embedding API calls were made for this repair. The worker disables external HTTP. Original source files are cached locally; no further source downloads are required for the prepared cohort. No full vector migration is planned.

## Source matching

The earlier complete snapshot contains 93,838 flagged judgments. Flags are review candidates, not proven errors. Stored Markdown/text originals are valid evidence for internal consistency; a PDF is not required.

The prepared cohort contains **12,461 records in 129 transactional batches**, supported by **11,847 distinct cached original source files**. Source SHA-256 values were rechecked after plan filtering. Expected changes overlap:

- 6,121 judgment-body replacements, preserving canonical UUIDs and citation strings.
- 12,388 caption corrections.
- 5,549 court-reference or court-caption corrections.
- 1,200 provenance-label corrections.

There are 9,330 proposed associations to existing search rows; the applier checks each search row's citation and court before updating it. This count is not the number of distinct repaired judgments or a promise that every association will pass.

1,630 proposals failed source/identity validation. A further 425 records have conflicting numeric lookup keys or nonstandard docket keys and were excluded from automatic application. Other flagged records lack a unique complete matching original or require further review. The separate 1,189 historical indexing-gap records have not been processed by this operation.

## Code changes

Header reading and labeling share citation parsing, Markdown handling, and wrapped parallel-citation handling. The labeler reads up to 16,000 header characters rather than the former short single-line window. SCMR cannot validate an explicitly non-Supreme Court body. Citation lookup checks the returned record's actual citation instead of trusting its numeric lookup key alone; exact stored docket identifiers retain precedence.

Reader citation links require internally consistent target identities and compatible citations/courts. Legacy RAG results refresh titles and URLs from canonical records. Both the returned parent paragraph and the matched child excerpt must occur in the current raw or deterministically cleaned judgment text. Previously tagged body hashes must also match. Unsupported excerpts are withheld even when an old vector remains stored.

`--keyword-only` updates canonical records and existing PostgreSQL text indexes, refreshes source-derived search summaries, rebuilds outgoing references for replaced bodies, and invalidates matching cached responses. It leaves all vector rows untouched. Missing semantic coverage remains pending; no new embedding vectors are generated.

An earlier full vector-cleanup attempt hit database I/O timeouts and rolled back. Backups were preserved. Keyword-only mode avoids those expensive vector-row rewrites. A read-only 95-record keyword-only preview passed with zero vector changes and zero embedding calls.

## Validation and evidence

**78 focused tests, TypeScript check, and client/server build pass.** Tests cover wrapped headers, known mismatches, exact docket lookup, conflicting numeric lookups, multiple-ID SQL parameter binding, wrong citation links, stale parent/child excerpts, and blocked HTTP calls.

Private originals, complete record snapshots, source hashes, filtered plans, preview results, and failed-transaction backups remain under `scratch/markdown-source-audit-2026-11-07/` and `scratch/markdown-repair-2026-11-07/`. They are excluded from Git. Use the current `reviewed-plans/` and `batch-manifest.json`; earlier plan directories are superseded.

Source matching establishes internal consistency, not independent court authentication. No corpus-wide accuracy percentage or bug-free claim is established. Production retrieval and applied-record verification remain pending deployment and execution.
