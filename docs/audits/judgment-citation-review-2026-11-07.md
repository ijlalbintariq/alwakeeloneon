# Citation disagreement source review — 7 November 2026

All **29,411** citation disagreements remaining after the earlier Markdown repair
were reviewed against **20,898 cached original files**. Every original passed its
SHA-256 and MD5 checks; there were **zero source-file errors**. This is a complete
review of that flagged cohort, not independent court authentication.

The source review separates an incorrect citation from an incorrect case body.
Imports had assigned incorrect year/journal/page keys, including legacy exporters
that invented numbers to avoid collisions. The previous uniqueness rule also
discarded court and reporter sections. Repeated PLD pages and civil, criminal and
tribunal series therefore require more than a numeric lookup.

The conservative source-backed classification identified:

- **21,640** duplicate records whose complete text matches an active existing
  case and whose stored parties and court identify that case under its true
  source citation. These point to **15,454** distinct canonical cases.
- **2,016** records with a usable source citation whose numeric key is vacant.
- **1,937** records with a usable source citation whose numeric key is occupied;
  court, reporter section or an incorrectly occupied key needs resolution first.
- **3,606** records whose source identity cannot be safely established under
  the current rules. These remain held rather than being reassigned by similarity.
- **212** records were already archived and retain their archived state.

Among the candidate canonical owners, **193** require source-backed metadata
corrections before duplicate links can be activated. These 193 corrections are
committed and verified against complete source hashes; 166 matching keyword
search rows were refreshed and verified. Full before-images for
**44,981** reviewed records and candidate owners were saved and their complete
body SHA-256 values checked against originals before any identity repair.

Canonical-aware readers preserve old UUID navigation for proven duplicates and
return the actual owner's title, text, citation and URL. False old citations are
not aliases. Citation resolution rejects ambiguous numeric matches. Publisher
sections are preserved; unknown labels match literally rather than by guessed
meaning. Graph edges require internally consistent source and target cases and
compatible raw citations. Legacy import and backlog paths that guessed identities
have been blocked.

Repairs use previewed, backed-up transactions and native keyword indexes.
Existing supported vectors are reused through canonical metadata at retrieval
time. No embeddings, reranking or AI services are called. External HTTP is fenced
off for repair workers. Ordinary existing database/hosting usage still applies.

Migration and application order is documented in
`docs/operations/judgment-citation-ownership.md`. Private review classifications,
originals, snapshots, plans, transaction backups and verification receipts are in
`scratch/citation-source-review-2026-11-07/` and are excluded from Git.

The prepared active-record repair scope is **24,852** records: 21,640 existing-owner
duplicates, **2,312** recovered canonical citations and **900** further duplicate
links to those recovered cases. All 21,640 existing-owner repairs passed the full
local ownership proof, with zero rejected proposals. Deployment-dependent data
changes wait until canonical-aware readers are confirmed live. A separate
civil-service reporter regression ensures `PLC(CS)` parentheses do not bypass
numeric ambiguity checks.

**4,559** records are held after this review: 1,964 unconfirmed identities, incomplete party names or unsupported
source citations, 648 incomplete headers, 832 conflicting stored parties, 162
court conflicts, 741 unresolved citation-ownership conflicts and 212 pre-existing
archived records. These counts are mutually exclusive and concern this cohort.

**99 focused tests, TypeScript check and client/server build pass.**

This report records the reviewed repair scope. Committed and verified totals
must come from transaction receipts and final verification, not plan counts.
