# Legal drafting studio audit — 30 October 2026

Scope: the current studio at `/preview/drafting` and `/legal-drafting`, its shared Tiptap editor, drafting persistence and generation endpoints, AI review panel, style settings, and document exports. Changes are in the local workspace.

## Fixes

| Area | Defect and resulting behavior |
| --- | --- |
| Saves in flight | Edits arriving during a save could be discarded. Saves now serialize per document and drain the latest pending content after the first request, reusing the returned database ID. |
| Autosave coverage | Template loads, AI replacements, paper changes, and documents containing only a table or page break now participate in autosave. Separate document timers preserve changes across tab switches. Untouched blank tabs do not create database rows automatically. |
| Save status | A response for one tab could mark another tab saved. The status now reflects the active document's saved content fingerprint. |
| Closing documents | Closing waits for persistence, includes changes made during that wait, and retains the tab if saving fails. |
| Deleting saved drafts | Pending saves finish before deletion; queued timers cannot recreate the deleted draft. |
| Local recovery | Recovery copies are written immediately and on page exit. Storage keys now include the signed-in account; the previous shared cache migrates once. Restored tabs reject duplicate IDs and invalid database IDs or paper profiles. |
| Saved-document links | Links resume an already-open active draft directly. A combined `docId` and `cite` link inserts into the requested document and preserves other URL parameters. |
| Citation and clause insertion | URL citations and cross-module clauses reach document state even when the launchpad hides the editor. Plain text goes through the text-to-HTML converter instead of raw HTML interpolation. |
| AI tab isolation | Each document retains its own chat messages in the mounted workspace. Switching documents resets selections and cancels the outgoing panel's generation and risk requests. |
| AI review safety | Whole-document proposals reject changes against a newer document revision. Standalone clauses offer insertion rather than replacing the pleading. Conversation history distinguishes pending, accepted, and rejected proposals. |
| Selected edits | Range replacement rejects invalid or collapsed positions, checks the exact original text, and reports the editor command's actual result. Revision bookkeeping follows the selected document. |
| Citation chips | Citation text survives editor plain-text extraction and selection handling, retaining authorities in AI context and text exports. |
| Filing type and request validation | Saved metadata retains `documentType`. Brief generation validates its input, and empty responses or server errors leave the current document available. Draft IDs require complete positive integers. Paper profiles reject inherited object property names. |
| Large diffs | The paragraph fallback has a bounded allocation and preserves original line endings. Whitespace-only revisions count as changes. |
| Formatting and clipboard | Plain-text span markup cannot restore arbitrary attributes. Clipboard failures show an error instead of producing an unhandled rejection. |
| Style settings | The studio now exposes the existing working style-memory panel, which supplies the required module/scope parameters, reads the actual samples response, and persists settings. The local-only controls and fabricated match percentage were removed. |
| Checklist | The label describes a document-structure checklist. Suggested blocks use placeholders rather than invented personal details and fixed dates; matching `act` requires a whole word. Risk results reset when document content changes. |
| Small screens | The tools panel starts closed on smaller screens and overlays the canvas when opened. The tab bar can shrink and scroll. |
| Printing | An isolated, sanitized document frame prints the pleading with its selected paper profile, avoiding workspace controls and clipping from fixed panels. |
| PDF export | Inline bold, italic, and underline remain attached to their own text runs. Page numbers are written once. Oversized table rows split across pages instead of extending below the paper. |

## Validation

- **131 unit checks passed**, including nine new regression checks and the existing drafting, pagination, security, follow-up, formatting, diff, and state-migration checks.
- **17 Chrome browser tests passed** against the actual studio UI with mocked API responses. These cover delayed creation/save races, refresh recovery, templates, links, stale reviews, tab isolation, selected edits, insertion, failed-save recovery, mobile layout, printing, style settings, and PDF/DOCX downloads.
- `npm run check` passed.
- The production frontend Vite build passed. It retains the existing warnings about large chunks and an old Browserslist dataset.
- The production server bundle passed using esbuild with the production environment definition and external packages.
- `git diff --check` passed.
- A downloaded two-page A4 PDF was rendered and visually inspected. Text extraction and PDF font assertions confirm single page numbers, preserved citations, and separate normal/bold runs.
- A four-page Legal PDF containing a long table passed page-count, final-word, and text-position checks.
- The downloaded DOCX contains the expected text, table, A4 page dimensions, and explicit page break.

Regression tests:

- `tests/unit/drafting-studio-regressions.test.ts`
- `playwright-tests/drafting-studio-regressions.spec.ts`

The browser suite uses `DRAFTING_TEST_BASE_URL` to select a running preview server and the installed Chrome channel.

## Live production validation and repaired legacy suites

The missing catalog is now a synthetic compatibility fixture under `tests/fixtures/seed-judgments.ts`. All eight test files that imported the removed application catalog now use that fixture. The original three blocked suites pass 82 checks; all eight repaired suites pass 167 checks. The combined drafting validation run passes **298 checks, with zero failures or skips**.

The fixture is never application fallback data and does not establish the authenticity or legal treatment of its historical citation labels. Stale API tests now supply explicit HTTP responses and expect live API records; unknown judgments must not produce invented graph edges. Restoring the broader suites also exposed a real client defect: citation lookup discarded ratio, bench, and category metadata. Those fields now survive both response shapes, and the existing API contract tests exercise the fix.

Live tests ran against `https://www.alwakeelo.com`, deployed commit `8fcd63fbf20c0fd1b4abb936bd729d2bd903ddc5`, using disposable non-admin accounts and actual authentication, database persistence, retrieval, and AI calls. No browser/API responses were mocked in these runs.

Passed live checks:

- Production health and normal password login.
- Creating and updating a draft, independently confirming its content in the real PostgreSQL database.
- Denying unauthenticated access to the test draft.
- Generating a real affidavit from fictional test facts: HTTP 200, 6,069 characters, approximately 37 seconds.
- Applying a real selected-passage AI edit while preserving the surrounding draft.
- Loading a saved draft in Chrome, autosaving typed content into the production database, and recovering it after refresh.
- No application browser exceptions in the completed browser run.

Two production defects remain because the local fixes have not been deployed:

1. Saving drops `metadata.documentType`.
2. The formatting toolbar covers the selection AI actions.

Both have reviewed local fixes and regression coverage. The deployed version is therefore not certified defect-free. Publishing the local changes and rerunning live validation is the remaining step.

The user chose **Keep the changes local** after reviewing these live findings. No commit, push, or deployment was performed.

The first live run stopped at the launchpad after refresh; the validator was corrected to resume the active draft. Its successful real-AI results are preserved separately from the completed browser rerun. The validator's tour setup was restricted to the main page so it does not access storage inside sandboxed third-party frames.

All disposable accounts, drafts, sessions, and their database-dependent test rows were cleaned up. The validator itself is `script/validate_drafting_live.cjs`; `--browser-only` repeats browser checks without paying for additional AI calls.

Evidence:

- `reports/drafting-live-validation-2026-10-30.json` — real AI and database checks from the initial run, including its validator navigation timeout.
- `reports/drafting-live-browser-2026-10-30.json` — completed unmocked Chrome run, the two deployed defects, and cleanup confirmation.
- `/tmp/alwakeelo-drafting-live/production-selection.png` — screenshot reproducing the deployed toolbar overlap.

## Follow-up: selection AI actions

The selection action bar and the sticky formatting toolbar shared the same stacking level, allowing the later formatting toolbar to cover the AI actions. The AI actions now occupy a separate row above the editor scroller, with buttons wrapping on narrow screens. Three targeted browser checks passed: visibility and clickability after scrolling at 1600px and 390px, plus applying a selected-passage edit. TypeScript and whitespace checks also passed.
