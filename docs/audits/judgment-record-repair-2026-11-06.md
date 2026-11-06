# Judgment record review and source-backed repairs — 6 November 2026

Four canonical judgments now have corrected identities and complete native text from their original court PDFs. Two linked source copies were restored separately. The repairs are applied to production data and verified through the authenticated MCP protocol and actual website links. This is not a certification of the entire database.

## Full-database identity screening

A single PostgreSQL repeatable-read, read-only snapshot covered **all 235,392 canonical judgments** from 15:22:01 to 15:36:44 UTC. The snapshot began before the four repairs below. Every record was assessed with the shared identity checker using its metadata and first 16,000 text characters; a hash of the complete body was retained for review.

| Screening category | Records |
| --- | ---: |
| Passed internal identity checks | 141,550 |
| Existing `mislabeled` classification | 28,273 |
| Other identity conflicts | 38,142 |
| Missing or insufficient usable text | 36 |
| Identity unconfirmed | 27,391 |
| Total queued for source review | **93,842** |

The queue categories are mutually exclusive. An additional overlapping diagnostic found 38,075 identity conflicts among records stored with `text_status = 'own'`.

**These are automated review flags, not 93,842 confirmed extraction errors or an accuracy percentage.** A valid case can be flagged because its header is absent or difficult to parse. Conversely, internal agreement cannot authenticate a document, establish complete wording, or detect every omitted sentence. Existing `mislabeled` classifications were not independently authenticated during this scan.

All 93,842 exported JSON records were independently parsed on ASCII LF boundaries. Four resolved UUIDs were removed from a separate working queue, leaving **93,838 entries from this snapshot**. This is a snapshot backlog, not a fresh global count after subsequent imports or edits.

## Canonical repairs

| Citation and UUID | Correct identity | Court evidence and correction |
| --- | --- | --- |
| **2021 PCRLJ 242**, `6e64cf23-af00-4c2f-8390-15ee28d42bda` | Khalid Hussain & others v. Asif Iqbal & others | Restored all eight pages from the [original Sindh High Court PDF](https://caselaw.shc.gov.pk/caselaw/view-file/MTM3NzQwY2Ztcy1kYzgz). Removed judicial prose from the title. Corrected the date to **8 March 2019**, corroborated by the court register; a [separate court judgment](https://caselaw.shc.gov.pk/caselaw/view-file/MjQ1NDAwY2Ztcy1kYzgz), page 5, corroborates the citation. |
| **2019 YLR 700**, `013ad9e6-8f0c-4af7-a3d5-27e6af780138` | Arshad Rasool v. Mst. Saniya & others | Restored all seven pages from the [original court PDF](https://caselaw.shc.gov.pk/caselaw/view-file/MTIzNjcyY2Ztcy1kYzgz). Removed appended extraction text from the caption. The court register confirms the citation and **27 February 2018** date. |
| **2024 PLD 480 (Sindh)**, `0006248d-1b0a-4374-91b1-30854a3351cc` | Managing Director, Sui Southern Gas Company Limited and 8 others v. Presiding Officer, Consumer Protection Court Kashmore at Kandhkot and another | Restored all six pages from the [original court PDF](https://caselaw.shc.gov.pk/caselaw/view-file/MjA5MDY3Y2Ztcy1kYzgz), including the missing respondent. The PDF distinguishes the **11 January 2024** decision from reasons released on 15 January. [Published reporter metadata](https://pakistanlawyer.com/sindh-consumer-protection-act-2014-xvii-of-2015-section-2c2024-pld-480-karachi-high-court-sindh-civil-appeal-no-s-04-of-2023-decided-on-11th-january-2024/) corroborates the citation; no legal body was copied from that secondary page. |
| **2019 PLD 69 (Sindh)**, `017ebc53-d47d-41cf-8c09-bb40f992330c` | TCS Private Limited & others v. Pakistan Post & another | Restored all **32 pages** from the [original court PDF](https://caselaw.shc.gov.pk/caselaw/view-file/MTI5NDE2Y2Ztcy1kYzgz), including the full petitioner name. The last page confirms **3 August 2018**. The public register incorrectly uses an SC reporter qualifier; it was not copied. A [separate High Court judgment](https://caselaw.shc.gov.pk/caselaw/view-file/MTQ0NDAyY2Ztcy1kYzgz), page 4, footnote 13, independently confirms **PLD 2019 Sindh 69**. |

Original court text was extracted without generative rewriting. Heading and concluding pages were visually inspected, as were the relevant citation-reference pages. Complete normalized PDF text was compared with the live MCP body for every repaired case. No claim is made that every character on every page received manual proofreading.

Canonical UUIDs and reporter keys were preserved. The repair tool saved durable, exclusive backups before mutations, verified reviewed source hashes and record fingerprints, and applied each correction transactionally. Generated formatted text, headnotes, and old summaries were invalidated. Matching case-law search rows were refreshed from the corrected identities and bodies. **175 stale canonical chunks** were backed up and removed: 29 Khalid, 26 Arshad, 16 Sui Southern, and 104 TCS. No matching cached responses were present to delete.

## Source copies and Cloudflare

- **Khalid source 177209:** restored the complete canonical text and title, stored the original court PDF and complete extracted text as new R2 objects, and corrected file MIME and filename associations.
- **Salman Akram Raja source 144576:** restored the complete text and original 16-page [court PDF](https://districtcourtseast.gos.pk/pdfs/gbv.pdf) for **2013 SCMR 203**. Its canonical record, `6835c01c-9525-4509-916a-f9dac186b28e`, was already repaired earlier; this operation corrected the separate source copy.
- **Arshad source 169316 was preserved.** It is a different judgment that cites Arshad. Its title, content, and filename were checked against the pre-repair snapshot and remain unchanged.

The old R2 objects were preserved. Production object downloads confirmed that both newly stored PDFs match the reviewed court-original bytes and that their extracted-text objects match the complete canonical bodies. MIME metadata correctly identifies the originals as PDFs. Earlier bucket inventory counts predate these new objects and must not be presented as current totals.

## Affected search refresh

Only eight explicit records were indexed: the four repaired canonical judgments; the two restored admin copies; and the previously corrected canonical Salman and Wi-Tribe records, whose legacy entries were still pending with zero chunks. The Wi-Tribe operation restores search coverage of its existing text; it does not claim new authentication of its complete body.

The two approved OpenRouter batches used `openai/text-embedding-3-small`, **1,024 dimensions**, in the separate repaired-source index:

| Batch | Sources | Chunks | Tokens | Provider-reported cost, USD |
| --- | ---: | ---: | ---: | ---: |
| First affected set | 6 | 55 | 35,991 | 0.00071982 |
| Sui Southern and TCS | 2 | 27 | 17,745 | 0.00035490 |
| **Total this operation** | **8** | **82** | **53,736** | **0.00107472** |

These amounts cover this operation's embedding generation, excluding ordinary hosting, database, and subsequent query costs. No whole-corpus migration was performed. Legacy Voyage vectors were not mixed with the alternative model's vectors. Read-only production verification confirmed current source fingerprints, model IDs, and all affected vector dimensions. The repaired table now contains **63 sources and 410 chunks**, including the previous extraction repairs.

## Code and validation

The audit exporter previously used a PostgreSQL startup option unsupported by the configured connection. It now explicitly starts a read-only repeatable-read transaction and verifies that mode before reading judgments. Summaries distinguish capped scans from exhausted scope, classify the queue, check accounting, and record expected coverage. Unicode line separators are escaped so line-based tools do not split a valid JSON record into several entries. Regression coverage checks source-text preservation after escaping.

- **62 relevant unit tests passed**, including the exporter, repair safeguards, MCP identity checks, embedding isolation, and repaired retrieval.
- TypeScript checking and client/server production builds passed. The final exporter-only escaping change was followed by the relevant tests and another TypeScript check.
- **29 production data/storage checks passed**, including exact reviewed-body hashes, invalidated generated fields, eight index fingerprints, actual Cloudflare bytes, and cited-parent preservation.
- **31 authenticated live MCP/public-reader checks passed** on deployed runtime `cb250fbe44f7041a314fd5e8137616c2a401ae58`: four complete court-body comparisons; title, citation, date, and PDF agreement; four citation searches; two natural-language searches; real returned website links and redirects; and continued withholding of the unrepaired `2022 PLD 565` mismatch.

This exercises the actual authenticated MCP protocol and live website, not ChatGPT's user interface. The code changes in this repair stage affect the audit CLI and its tests; the data corrections are already applied and do not await a deployment.

## Remaining work and evidence

The remaining snapshot queue requires individual source review. In particular, `2022 PLD 565` still has a conflicting Salman caption and Sardar Begum body. The local reporter archive and independent references support further investigation, but an adequate original source was not recovered for a production correction in this run. A different judgment's PDF was not attached as its original. Internal checks continue to withhold the mismatch.

Other historical source problems remain, including the SQLite `2025 MLD 1290` record containing a body headed `2025 MLD 1574`, and the two mixed-language PDF-only copies documented in the earlier extraction audit. Legacy importers that invent or increment reporter pages were not used and remain unsuitable for the repair workflow. Bulk renaming, citation reassignment, or automatic acceptance based only on title similarity would recreate the original attribution problem.

Private source PDFs, review plans, source-register responses, before-images, embedding receipts, and verification results are under `/tmp/alwakeelo-record-repair-2026-11-06/`. Important files include `full-review.jsonl.summary.json`, `resolved-review-entries.json`, `remaining-review.jsonl`, `data-storage-verification.json`, and `live-mcp-verification.json`. These files are intentionally excluded from the repository. A private archive is retained at `scratch/judgment-record-repair-2026-11-06.tar.gz`; its checksum is stored alongside it. Backups and original source bytes must be preserved before any subsequent repair.
