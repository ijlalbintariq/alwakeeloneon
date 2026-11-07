# Markdown judgment repair — 7 November 2026

## Result

**12,461 source-backed judgment repairs committed in 129 backed-up transactions. Final database verification passed for all 12,461 records and 8,606 refreshed legacy search rows.** The retrieval guard was confirmed live at `99db539` before the first repair. The required runtime change is `23cc470`.

The user requested no spending. **No AI, reranking, or embedding API calls were made for this repair. No vector rows were modified.** Keyword-only workers ran with external HTTP disabled. Cached source originals supplied all replacement text. Existing database resources were used; this report does not claim that ordinary hosting or database usage is unmetered.

## What changed

Counts overlap; each judgment is counted once in the 12,461 total:

- **6,121** judgment-body replacements from complete matching originals.
- **12,388** caption corrections.
- **5,549** court-reference or court-caption corrections.
- **1,200** provenance-label corrections.

Canonical UUIDs and citation strings were preserved. Source SHA-256 values and original record fingerprints were checked before mutation. Full before-images were durably backed up before each transaction. Stale formatted text, headnotes and generated summaries were cleared. Dates and PDFs were changed only where specified by the reviewed plan.

All 12,461 canonical titles, court references, source-body hashes, provenance labels and native title text indexes passed final read-only checks. **8,606** legacy search rows passed checks for corrected titles, courts, body-derived summaries and generated keyword indexes. Another **724** candidate search rows did not pass identity/court matching and were left unchanged, protecting potentially different cases.

Outgoing references were rebuilt for replaced bodies using internally consistent targets and compatible citations. Unconfirmed references remain pending. The complete repaired cohort currently has 25,575 outgoing links, 14,226 pending references and no self-links; these totals include unchanged-body records whose existing references were retained.

## Retrieval and indexing

Header reading and labeling share citation parsing, Markdown handling and wrapped parallel-citation handling. The labeler reads up to 16,000 header characters rather than the former short single-line window. SCMR cannot validate an explicitly non-Supreme Court body. Citation lookup checks the returned record's actual citation instead of trusting its numeric lookup key alone; exact stored docket identifiers retain precedence.

Reader citation links require internally consistent target identities and compatible citations/courts. Legacy RAG results refresh titles and URLs from canonical records. Both the returned parent paragraph and the matched child excerpt must occur in the current raw or deterministically cleaned judgment text. Previously tagged body hashes must also match. Unsupported excerpts are withheld even when their old vectors remain stored.

`--keyword-only` refreshes existing PostgreSQL text indexes and matching search rows without rewriting the large vector index. **No new semantic embeddings were generated.** Records without supported existing excerpts have limited semantic coverage. No models or vector spaces were mixed, and the separate repaired-source embedding index was left unchanged.

Earlier full vector-cleanup attempts hit database I/O timeouts and rolled back. Their backups were preserved. Keyword-only mode avoided those expensive vector-row rewrites. A separate read-only check confirmed **2,768 sampled vector rows**, including text, metadata, embeddings and parent pointers, were identical to their pre-repair backup; 2,355 contained nonnull embeddings.

## Live checks

**78 focused tests, TypeScript check, and client/server build pass.** Coverage includes wrapped headers, known mismatches, exact docket lookup, conflicting numeric lookups, multiple-ID SQL parameter binding, wrong citation links, stale parent/child excerpts and blocked HTTP calls.

**Three authenticated MCP `get_judgment` reads passed:** titles, full text, citations and source-link UUIDs matched the originals. The verifier restricted tool calls to `get_judgment`, kept the API key out of files/output and did not invoke semantic search. ChatGPT's UI and paid MCP semantic search were not exercised.

Public reader checks covered **seven distinct repaired cases**, using both UUID and citation links and comparing complete returned text against the cached source SHA-256. These included:

- `1971 PLC 120`: restored the Manick Chandra Seal / Fazli Brothers caption.
- `2022 PLD 565`: restored the Sardar Begum Farooqui / Azhar Masood Farooqui caption.
- `1994 PLD 323`: removed caption-extraction contamination.
- `2020 PSC 1127`: confirmed long parallel-citation headers no longer prevent access to matching text.

The known unresolved `1963 PLD 295`, `2007 SCMR 1681` and `1995 PLC(CS) 500` mismatches were also checked live. All three continue to withhold their conflicting bodies.

## Remaining review

The original snapshot contained **93,838 flagged judgments**. Flags are review candidates, not proven errors. This repair covers 12,461 of those records; **81,377 original snapshot flags remain outside this repair**.

Of the original **30,591 citation disagreements**, **1,180** were repaired in this cohort; **29,411** remain for source review. These are counts against the original snapshot, not a fresh corpus-wide accuracy estimate.

1,630 proposals failed source/identity validation. Another 425 records with conflicting numeric lookup keys or nonstandard docket keys were excluded from automatic application. Other records lack a unique complete matching original or require further review. The separate 1,189 historical indexing-gap records were not processed by this operation.

Stored Markdown/text originals are valid evidence for internal consistency; a PDF is not required. **Matching an original does not independently authenticate a court judgment.** No overall accuracy percentage or bug-free claim is established.

## Evidence

Private originals, complete record snapshots, source hashes, filtered plans, compressed before-images, commit receipts and verification results remain under `scratch/markdown-source-audit-2026-11-07/` and `scratch/markdown-repair-2026-11-07/`. They are excluded from Git. Key results include `committed-summary.json`, `verified-summary.json`, `verification-final.log`, `authenticated-reader-verification.json`, `public-reader-verification.*.json`, `unresolved-reader-verification.json` and `unchanged-vector-verification.json`.

Use the current `reviewed-plans/` and `batch-manifest.json`; earlier plan directories are superseded. Operational instructions are in `docs/operations/judgment-source-repairs.md`.
