# Judgment identity repair

The MCP response guards prevent known title/body contradictions from being returned as verified judgments. They do not correct the stored records or authenticate a source document.

## First repair stage

The auto-extractor now distinguishes a source judgment from citations in its narrative. Referenced cases receive citation-only descriptions rather than the source judgment's parties, holding, or keywords. An arbitrary first reference is no longer promoted to the primary case. The API and CLI re-extraction caps preserve that distinction.

Reported headings take precedence over a conflicting filename hint. Filename and explicit caller hints remain identification hints, not source authentication. Do not treat `citationRole: primary` as proof of authenticity; the MCP identity checks remain necessary.

## Read-only review queue

Run:

```sh
node --import tsx script/judgment_identity_review.ts --limit 1000 --output /tmp/judgment-review.jsonl
```

The exporter enforces PostgreSQL read-only mode, reads records in UUID order, and queues records that do not pass the shared identity check. Each entry contains original metadata, the opening text, its body hash, and the reason for review. The output is created with restrictive permissions and will not overwrite an existing file. The companion `.summary.json` records completion and the last processed ID. Resume into a new output file with `--after <lastId>`.

The first run on 31 October 2026 scanned 1,000 records and queued 399. These are review candidates, not 399 confirmed errors. The other 601 passed internal checks; they are not authenticated judgments. The evidence is in `/tmp/alwakeelo-source-review-2026-10-31.jsonl` and its summary file.

## Source repair workflow

1. Prioritize the ten confirmed mismatches in the accuracy audit, then malformed captions and remaining queue entries.
2. Find the actual source document using its case number, parties, court, date, and reporter heading. Decode stored HTML/JSON correctly; extract PDF text or OCR scanned pages when needed.
3. Compare the source heading and substantive body. Keep citations mentioned in the narrative as references only. Record the source URL/path, content hash, reviewed page, and proposed field changes.
4. Preserve the original database row and prepare a field-level correction. Check for an existing owner record before moving any body to another citation. Never invent reporter pages, merge on title similarity, or change citation keys to resolve collisions.
5. Apply only evidence-backed corrections in a transaction that confirms the source record has not changed since review. Invalidate its cached summaries and rebuild affected search entries and graph relationships from the corrected source.
6. Replay MCP search/detail for every corrected case and check the deployed API before declaring the repair complete.

## Confirmed upstream problems still requiring repair

- The local SQLite source for `2025 MLD 1290` already combines GulSher metadata with a body headed `2025 MLD 1574`, Ameer Bux v. Maqsood. Reimporting it unchanged cannot fix the database.
- The local source for `2020 SCMR 420` contains a reporter heading naming Commissioner Inland Revenue v. Wi-Tribe. This supports a targeted caption review; the source metadata also appends judge/counsel text and must not be copied wholesale.
- `scripts/export-sqlite-missing.py` invents journal/year/page defaults and increments colliding pages. `scripts/prepare_missing_payload.py` also fabricates or changes page values. Do not run either legacy importer for the repair until these behaviors are removed and uncertain identities are queued instead.

No production data correction or bulk reindex was performed in this first stage. Existing malformed or conflicting records remain withheld until their source evidence is reviewed.
