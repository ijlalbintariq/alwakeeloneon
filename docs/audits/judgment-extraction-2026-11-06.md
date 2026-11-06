# Judgment extraction and source-storage audit — 6 November 2026

## Findings

The production database contains 235,392 canonical judgment records. At the start of the audit, 235,387 had nonempty stored text. These counts do not establish completeness or authenticity.

The configured Cloudflare R2 bucket contained 217,001 objects. All 18,503 objects with `.pdf` filenames were checked directly: 5,740 had PDF headers, 12,759 contained text-like content, three contained other binary data, and one was empty. All 216,846 file references in the audited source-file tables resolved to objects. Counting only `judgments.pdf_url` omitted these separate source-file tables.

Confirmed ingestion defects:

1. The browser PDF fast path extracted only the first 20 pages, discarded page text shorter than 30 characters, and sent text instead of the original PDF. The server then stored that text under the original `.pdf` filename.
2. OCR could stop at configured page limits while the caller treated its output as complete. Cloud OCR also discarded empty page results before counting pages and sliced completed results to a page limit.
3. Searchable scanner watermarks prevented image-based pages from reaching OCR. A document could therefore be saved with only repeated scanner labels.
4. Original-PDF storage ran in the background and storage failures could be swallowed before the upload reported success.
5. Chat OCR cleanup sent only a bounded text prefix to an AI model and could accept a shorter rewritten result.
6. Signed case-document uploads accepted PDF declarations without checking their PDF signatures.

The historical import step responsible for the missing sentence in Ramzan has not been established. The defects above were reproduced from current code; they are not proof of that record's historical import path.

## Repairs applied to production data

- Restored the complete nine-page court text for **2024 SCMR 1085**, Muhammad Ramzan v. Khizar Hayat & another, using the [original Supreme Court PDF](https://www.supremecourt.gov.pk/downloads_judgements/crl.p._887_l_2013_24042024.pdf). Preserved the case identity and court-confirmed date, 17 April 2024. Attached the original PDF URL, refreshed the matching search summary, and removed 38 backed-up stale search chunks.
- Repaired the separately linked Ramzan admin source, ID 193518, with the same complete text. Stored a new copy of the original court PDF and extracted text in R2, updated the source-file association, and preserved the previous Markdown object. The bucket snapshot above predates these two new objects.
- Relabelled **12,758 verified text-only sources** as `.extracted.txt` in file metadata, parent document filenames and linked case-law source filenames. Existing R2 object keys and bytes remain intact for stable links and recovery.
- Labelled **three non-PDF binary uploads** as `.unreadable.bin`; preserved their bytes.
- Restored **53 scanned source records from all 380 PDF pages** using local OCR. These records previously contained fewer than 40 words, often only scanner watermarks. Original PDFs, titles and source associations were preserved. Every replacement passed page-count, source-hash, replacement-hash and OCR-confidence checks; production content hashes were verified after applying the repair.
- Retained **two duplicate source records as PDF-only**. They contain the same 14-page mixed Urdu/English judgment. Unreliable watermark text was removed and extraction was marked for transcription review. Their original PDFs remain available. Neither uncertain OCR text nor a guessed translation was published.

Every database mutation had a durable local backup written before the first update and was performed transactionally. Failed repair attempts rolled back. No R2 originals were deleted or overwritten.

OCR confidence is a processing check, not court authentication or a guarantee of perfect wording. Quotations must still be checked against the original PDF.

## Scope of source comparison

All **5,256 header-confirmed admin PDFs** were downloaded and their embedded text compared locally with stored source text. Separately stored full extracted text in R2 was used when present; an intentionally shortened database preview was not treated as lost text.

The comparison screened 4,844 sources with at least 98% source-token coverage, 34 sources with other text/layout differences, four Urdu records whose word segmentation differed substantially, and 374 image-based PDFs requiring OCR. These are screening categories, not database error counts. High token coverage can still miss a short omitted sentence.

All 374 image-based sources received a local last-page OCR screen. The 55 with fewer than 40 stored words received full-page OCR recovery. The OCR audit parser was corrected to treat quotation marks literally in TSV output before any OCR replacement was applied. Fifty-three passed the recovery checks; the two mixed-language copies remain PDF-only. No court documents were sent to external OCR or generative AI services during this research.

The remaining 319 image-based sources already had more substantial text. Last-page screening does not certify every page. Stored Markdown/text-only judgments without reliable originals cannot be authenticated through internal consistency checks.

## Application fixes

- PDFs use the original-file upload path; the text-only endpoint rejects PDF declarations.
- PDF extraction retains short text and all native pages. Image pages with only short text or watermarks require OCR.
- Local and cloud OCR results must account for every source page. Partial provider responses are rejected. Pages are not silently sliced from completed OCR output.
- OCR text is retained without AI rewriting or prefix-only cleanup.
- PDF uploads wait for original storage and report storage failure. Original PDF headers determine PDF MIME metadata.
- Text MIME takes precedence over a misleading `.pdf` name in source downloads and previews. New text objects receive text filenames.
- Signed case uploads reject non-PDF bytes before creating records.

OCR beyond available engine/service capacity fails explicitly instead of presenting a partial judgment as complete.

## Alternative embeddings

The user requested an alternative to Voyage. The already configured OpenRouter endpoint was tested with `openai/text-embedding-3-small` at 1,024 dimensions. Four generic legal sentences returned valid vectors; the related pair scored more highly than the unrelated pair. This test sent no judgment text.

With the user's approval, **55 affected records** were indexed in a separate `rag_repaired_chunks` table: the canonical Ramzan judgment, its repaired admin source, and the 53 recovered scanned sources. They produced **328 chunks**, using `openai/text-embedding-3-small` through OpenRouter at **1,024 dimensions**. Provider-reported usage was **221,320 tokens**, costing **USD 0.0044264**. The original Voyage corpus and global embedding provider were not migrated or changed.

Queries against the repaired table use the same fixed alternative model. Results are merged by rank, without comparing cosine distances between models. Current title, body, file association and access scope are rechecked against source fingerprints before returning an excerpt. Duplicate source chunks are suppressed. An explicit Ramzan source alias requires exact agreement with its canonical judgment title and body before sharing its UUID and link. Other recovered admin sources remain source documents, without inferred case identities or source-authentication claims. Repaired excerpts bypass the legacy Voyage reranker.

Repaired lookup has a six-second budget, including a cold provider request. When repaired matches are available, retrieval stops waiting for the legacy index at 6.5 seconds, before the case-law pipeline's eight-second cutoff. An unavailable or slow legacy index therefore cannot silently discard otherwise usable repaired results. Searches without repaired matches retain the existing legacy behavior.

Database verification confirmed all 55 source fingerprints and all 328 vector dimensions. Two real semantic queries returned Ramzan with the correct canonical UUID and case link; an unrelated recipe query returned no repaired-source matches. These checks exercised the production database and alternative provider using local application code. Production application activation is verified separately after deployment.

The OpenAI-compatible path was also hardened: API failures now reject instead of returning hashing vectors, and malformed/missing/wrong-dimension batch results are rejected before indexing. This prevents silent corruption when the alternative path is used.

References: [OpenAI embeddings guide](https://developers.openai.com/api/docs/guides/embeddings), [OpenRouter embedding API](https://openrouter.ai/docs/api/api-reference/embeddings/create-embeddings).

## Validation and evidence

Regression checks cover original-file preservation, page 21, short page text, watermarked scanned pages, incomplete OCR, blank-page accounting, MIME/filename mismatches, upload-storage failure, invalid signed uploads, source-repair safeguards, embedding failures, model isolation, stale-source rejection, access scopes, canonical links and rank fusion. Client/server builds and TypeScript checking are required before deployment.

Final local validation passed 96 relevant regression tests, 11 extraction tests with workers enabled, TypeScript checking, and client/server production builds. Separate checks reproduced legacy failure and legacy timeout without losing repaired matches.

After the database repair, nine live checks verified that the public API and authenticated MCP return the complete court text, restored sentence, correct date/title/citation, original PDF URL and canonical case link. This exercised the real MCP protocol, not ChatGPT's UI.

Private backups, PDF originals, extracted text, confidence evidence, signature checks and per-record verification are stored locally under `/tmp/alwakeelo-extraction-repair-2026-11-06/` and `/tmp/alwakeelo-storage-audit-2026-11-06/`. They are intentionally excluded from the repository.
