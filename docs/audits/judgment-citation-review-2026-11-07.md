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

- **21,819** duplicate records whose complete text matches an active existing
  case and whose stored parties and court identify that case under its true
  source citation. These point to **15,546** distinct canonical cases.
- **2,026** records with a usable source citation whose numeric key is vacant.
- **1,943** records with a usable source citation whose numeric key is occupied;
  court, reporter section or an incorrectly occupied key needs resolution first.
- **3,623** records whose source identity cannot be safely established under
  the current rules. These remain held rather than being reassigned by similarity.

Among the candidate canonical owners, **193** require source-backed metadata
corrections before duplicate links can be activated. Full before-images for
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

This report records the reviewed repair scope. Committed and verified totals
must come from transaction receipts and final verification, not plan counts.
