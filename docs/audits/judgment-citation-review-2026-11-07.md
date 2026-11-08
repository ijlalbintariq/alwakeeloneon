# Citation disagreement repair — 7–8 November 2026

## Verified result

All **29,411** citation disagreements remaining after the earlier Markdown repair were reviewed against **20,898 cached original files**. Every original passed its SHA-256 and MD5 checks; there were **zero source-file errors**.

**24,852 cohort records received completed, verified identity repairs:**

- **22,540** proven duplicate records were retired and linked to the correct canonical judgment. Their old UUIDs open that same case. False historical citations are not aliases.
- **2,312** canonical records received the citation printed in their complete source, including the corresponding year, journal, page, publisher section and reviewed court metadata.

Another **193 canonical-owner metadata repairs**, outside this cohort, were committed and verified before duplicate links were activated. **185 keyword-index rows** were refreshed and verified: 166 associated with those owners and 19 associated with citation corrections. Ambiguous index records were not assigned to the first matching court or series.

**941 unsupported `own` labels** among the held cohort were changed to `unknown`. These are label corrections, not repaired case identities. Every label update preserved the complete text, citation, title, court and other identity fields. Final checks found **zero `own` labels among the 4,347 active held records**: 3,391 are marked `mislabeled`, and 956 are marked `unknown`.

All operations have durable complete before-images and commit receipts: **262 data-repair transactions**, comprising 250 cohort transactions, two owner-metadata transactions and ten status-quarantine transactions.

## Cause and repair rules

Imports assigned incorrect citation numbers, including legacy exporters that invented page numbers to avoid collisions. The old global year/journal/page uniqueness rule also discarded court and reporter sections. Consequently, a real case body could be stored under another citation, and a numeric lookup could select another court's case.

Citation lookup now retains court and publisher sections and rejects ambiguity. The database namespace includes court and section. Legacy export/backlog paths that guessed identities have been disabled. A corrected citation must be printed in the complete reviewed source; page numbers are never invented.

Duplicate ownership requires matching complete judgment text, corroborating parties and court, and an active, internally consistent owner. Old UUIDs follow one verified canonical hop. Retired sources no longer contribute duplicate judge links or misleading citation edges. A citation reference to a false old number is not redirected to another case merely because its former database row was a duplicate.

Verified MCP titles, body-derived summaries and source URLs come from canonical records. Existing RAG chunks use current canonical metadata and must be supported by the actual judgment body. Unsupported excerpts are withheld. Self-citation filtering preserves court/section distinctions, and keyword repairs consider the complete current namespace rather than only the current repair batch.

## Complete-text and owner-link safeguards

The reader accepts a cached formatted body only when its complete text matches the raw original or the exact deterministic formatter output, allowing whitespace differences. Other cached bodies fall back to the stored original. Matching title/citation headers alone cannot validate changed judicial findings.

The formatter review covered **15,454 canonical owners**: 14,118 had source-derived cached formatting, 1,336 used raw text or had no cached format, and zero had unsupported formatting. An initial strict display-byte comparison failed because formatting removes page markers and joins wrapped words; the sampled returned text exactly matched the existing deterministic formatter. Stored raw source hashes remained exact.

Suggested text-owner links also require identical SHA-256 hashes of the complete source and target bodies, plus an active, internally consistent target. A matching citation alone cannot establish ownership. Actual database checks accepted an identical-body owner and rejected a different-case owner and missing source evidence.

## Validation and deployment

**104 focused tests, TypeScript check and client/server build pass.**

Complete final database verification passed for all **22,540 duplicate links** and **2,312 corrected citations**, including raw source hashes, owner identity, active/canonical state, namespace fields, native title indexes and removed alias graph/judge links. The 19 updated citation-repair keyword rows passed checks for title, court, source-derived summary and generated text indexes. The additional 193 owners and 166 keyword rows passed separate verification. All 941 quarantined labels passed exact text-hash and identity-preservation checks.

**Ten public-reader case checks passed**, covering old UUIDs, canonical UUIDs and available unambiguous citation routes. **Six authenticated MCP `get_judgment` reads passed**, using UUID and citation access across all three repair phases. Titles, complete source-derived text and canonical source links matched. The API key was supplied through hidden stdin and was not written to files.

The actual canonical-reader SQL and excerpt guard were also checked against three real database cases inside a rolled-back transaction. Foreign excerpts were rejected, and the transaction left no persistent changes.

Production was confirmed live at **`556b75c8dfa1a2f39af488063b2902f5fcaa0bc6`**, including the complete-text and suggested-owner hash guards. Earlier schema preparation retained old uniqueness until compatible readers were live; court/section activation then passed native uniqueness tests. Later report-only commits do not change runtime behavior.

## Remaining source review outcomes

**4,559 cohort records remain unresolved as case identities**, including the 941 whose misleading verification labels were cleared:

- **1,741:** identity cannot be established from the available case header and metadata.
- **648:** incomplete source headers.
- **832:** conflicting stored parties.
- **162:** court conflicts.
- **155:** incomplete party names or extraction artifacts.
- **44:** unsupported publisher qualifiers.
- **24:** unparseable source citations.
- **741:** unresolved citation ownership/namespace conflicts.
- **212:** already archived records whose archived state was preserved.

These categories are mutually exclusive. They are review outcomes, not a count of court-authenticated errors. The **4,347 active unresolved records remain unconfirmed/withheld**, while 212 previously archived records remain archived.

Cross-source checking of all 4,347 active held records found **zero unambiguous replacement originals matching existing title, court and citation**. Follow-up checks against the final live namespace found no additional safely recoverable keys after the reviewed duplicate retirements. No case was reassigned by resemblance or by citation existence alone.

## Cost and limits

**No paid AI, embedding or reranking API calls were made. No vector rows were changed.** Workers used cached originals, native PostgreSQL and an external-HTTP fence. Native keyword indexes were refreshed, and supported existing vectors are reused through canonical metadata at retrieval time. No full embedding migration was performed, and incompatible vector spaces were not mixed. Ordinary existing database and hosting usage still applies.

Paid semantic MCP search/research and the ChatGPT UI were not exercised. Records without supported existing vectors may have limited semantic coverage. Source-file consistency **does not independently authenticate court judgments**, and this review does not establish a database-wide accuracy percentage or a bug-free claim.

## Evidence and recovery

Private originals, complete snapshots of 44,981 reviewed rows/owners, source hashes, plans, previews, before-images and receipts remain in `scratch/citation-source-review-2026-11-07/`, excluded from Git. Key results include `committed-verification.json`, `owner-verification.json`, `quarantine-verification.json`, `public-verification.json`, `authenticated-reader-verification.final.json`, `owner-hint-verification.json`, `held-summary.json`, `held-source-review.json` and `finish-pipeline.json`.

Operational and recovery instructions are in `docs/operations/judgment-citation-ownership.md`. Counts above come from committed receipts and completed verification, not proposed plan counts.
