# Original User Request

## Initial Request — 2026-05-21T07:05:12+05:00

Fix a systemic statute hallucination problem in the Alwakeelo legal AI platform. The AI currently generates wrong Limitation Act article numbers (e.g., citing "Article 164" instead of the correct "Article 168" for appeal readmission) because the system prompt explicitly allows citing statutes from LLM training data when the database has no match. This problem affects ALL statutes — any article/section number not present in the `statutes` table can be hallucinated. Build a post-generation statute verification system (analogous to the existing judgment citation verification) so that every statute reference in an AI response is validated against the database before being shown to the user.

Working directory: /Users/macbook/Downloads/Alwakeelo
Integrity mode: development

## Context

### The Root Cause
In `server/pipeline/context-builder.ts` line 242, there is a rule:
```
"STATUTE RULE: For well-known Pakistani statutes (PPC, CPC, Constitution, Family Courts Act, etc.) you may also cite from your training knowledge using full formal names."
```
This explicitly green-lights the AI to cite statute sections/articles from its training data when the retrieval pipeline returns no matching rows from the `statutes` table. The AI's training data contains inaccurate statutory mappings (e.g., wrong Limitation Act article numbering), which results in confidently stated but legally wrong citations reaching lawyers.

### The Existing Model (Judgment Verification)
The codebase already has a robust judgment citation verification system:
1. `verifyReferencesBlock()` in `server/routes.ts` (~L2684) rebuilds the references JSON block from prose-extracted citations
2. `extractCaseCitationCandidates()` extracts judgment citations from the AI's prose text
3. Each extracted citation is matched against the database via `resolveCaseCitationFromKnowledgeBase()`
4. Only DB-verified citations get clickable reference cards in the frontend
5. Unverified/hallucinated citations get no card (they are silently dropped)

There is NO equivalent verification for statute citations. The `extractStatuteMentions()` function (routes.ts ~L5069) extracts statute names and section numbers from prose but does NOT verify them against the `statutes` table before building reference cards.

### Statute Data Structure
The `statutes` table has columns: `{id, shortTitle, section, description, punishment}`.
The `searchStatutes()` function in `storage.ts` (~L1414) does ILIKE matching on shortTitle, section, description, and punishment.
The `statuteDocuments` table stores full statute PDFs/text (separate from the section-level `statutes` table).

### What Gemini Flagged (Specific Example)
When asked about restoring a dismissed appeal under Order XLI Rule 19 CPC:
- AI said "Article 164: 30 days for readmission" → **Wrong.** Article 164 is for setting aside ex-parte decrees
- AI should have said "Article 168: 30 days for readmission of appeal" → **Correct**
- AI said "Article 165: 90 days for revision under Section 115 CPC" → **Wrong.** Article 165 is about possession of immovable property
- The 90-day revision limit comes from Section 115(1) CPC itself or Article 181 (omnibus 3-year article)
- AI also cited `[2018 PCRLJ 40]` (a criminal law reporter) for a civil procedure principle — reporter type mismatch

## Requirements

### R1. Add post-generation statute verification to the AI response pipeline
Build a statute verification layer that runs after the AI generates a response but before the references block is finalized. For every statute section/article the AI mentions in its prose:
1. Extract the statute name and section/article number from the prose text (the `extractStatuteMentions()` function already does this)
2. Look up each extracted mention against the `statutes` database table to check if it exists
3. Mark each statute reference as either "verified" (found in DB) or "unverified" (from AI training data only)
4. In the references JSON block, only include statute references that are DB-verified. For unverified statutes, either drop them from the block or tag them so the frontend can visually distinguish them.

This must work the same way the existing judgment verification works — the system already rebuilds judgment references from prose-extracted citations; do the same for statutes.

### R2. Tighten the system prompt statute rule
Replace the current permissive statute rule in `context-builder.ts` (line 242) that says "you may also cite from your training knowledge" with a stricter rule that:
1. Allows the AI to name and discuss statutes generally (e.g., "The Limitation Act, 1908 governs time limits for filing")
2. Explicitly forbids citing specific article/section numbers from training data when they are NOT in the VERIFIED STATUTES section
3. Instructs the AI to say something like "refer to the specific article in the Limitation Act, 1908 for the applicable time period" rather than guessing a wrong article number
4. When the AI does cite a specific section that IS in the verified data, it should cite it with full confidence

### R3. Ensure the verification does NOT break existing statute reference cards
The current frontend renders statute reference cards from the `laws` array in the references JSON block. The verification system must:
1. Continue to produce valid `laws` entries for statute references that ARE in the database
2. Not break any existing statute card rendering, linking, or click behavior
3. Not introduce regressions in the statute sidebar mapping or PDF viewer navigation

## Acceptance Criteria

### Statute Verification Pipeline
- [ ] Every statute section/article mentioned in AI prose is looked up against the `statutes` database table before the references block is finalized
- [ ] Statute references that exist in the database appear in the references block `laws` array (with their verified description from the DB)
- [ ] Statute references that do NOT exist in the database are either dropped from the references block or clearly tagged as unverified
- [ ] The verification lookup completes within the existing response pipeline without adding more than 500ms latency (statute DB lookups should be fast — the table is small)

### System Prompt Rule
- [ ] The context-builder.ts statute rule no longer says "you may also cite from your training knowledge"
- [ ] The replacement rule explicitly instructs the AI to NOT guess specific article/section numbers for statutes not in the verified data
- [ ] The replacement rule still allows the AI to name and discuss statutes generally when appropriate

### Non-Regression
- [ ] `npm run check` completes with 0 TypeScript errors
- [ ] `npm test` passes all existing tests with 0 failures
- [ ] The existing judgment citation verification (`verifyReferencesBlock`) continues to work unchanged
- [ ] The `extractStatuteMentions()` function continues to work for its existing use cases (statute sidebar linking, statute search)
- [ ] Reference cards for statutes that ARE in the database continue to render correctly in the frontend

## Follow-up — 2026-05-21T09:52:21+05:00

Fix the statute/section citation grounding in the Alwakeelo Pakistani legal AI platform so that statutes receive the same "database-only" enforcement that case law citations already have — eliminating hallucinated section numbers, wrong penalties, and training-data statute references. The case law citation system is already excellent (trusted pool injection, post-generation DB verification, citation mandate blocks). Statutes must reach the same standard.

Working directory: /Users/macbook/Downloads/Alwakeelo
Integrity mode: development

## Technical Context

This is a Node.js/TypeScript full-stack legal AI platform. Key files for this task:

- `server/routes.ts` — Main routes file (~17,000 lines). Contains the system prompt (`getLegalSystemPrompt()` at line 5741), citation verification (`verifyReferencesBlock()` at line 2684), safety guardrails (`applyAlWakeeloSafetyGuardrails()` at line 2978), and the chat handler (line ~12500+). Case law already has strong grounding with fake user/assistant injection turns (lines 13008-13025) and citation mandate blocks (lines 12982-12993).
- `server/pipeline/context-builder.ts` — Formats retrieval results into context strings injected into the system prompt. Line 245 contains the problematic fallback: "You may discuss well-known Pakistani statutes generally" which must be hardened.
- `server/pipeline/retrieval-engine.ts` — Fetches statutes via `fetchStatutes()` (line 403) and case law. Statutes use keyword search only with a 3s timeout.
- `server/pipeline/knowledge-pipeline.ts` — Orchestrates the full retrieval pipeline. Returns empty context string on timeout (line 162) with no safety fallback.
- `server/pipeline/intent-classifier.ts` — Classifies queries and determines `needsStatutes` / `needsCaseLaw`.
- `server/ai-module-profiles.ts` — Module profiles with features like `strictCitations`.

The case law system works well because it has:
1. Six strict citation rules in the system prompt (Rules 1-6)
2. Post-generation `verifyReferencesBlock()` that checks every citation against the DB
3. Trusted pool mode where off-pool citations are rejected
4. Fake user/assistant injection turns for pool adherence
5. Low temperature (0.3) to reduce creative wandering
6. Citation mandate block requiring at least 3 citations from pool

Statutes lack ALL of these protections — they only have a soft prompt instruction and a name-only verification (threshold 6, which passes if just the statute name like "PPC" exists in DB, even if the section number is fabricated).

## Requirements

### R1. Statute-only-from-DB system prompt enforcement
The AI system prompt must enforce that statute section numbers can ONLY come from the internal database context, matching the strictness of case law Rules 1-6. When no statute data is found in the DB, the AI must say "refer to the relevant provision of [Statute Name]" rather than citing specific section numbers from memory. The fallback text in `server/pipeline/context-builder.ts` that currently allows "discussing well-known Pakistani statutes generally" must be replaced with a hard "database-only" constraint.

### R2. Section-level statute verification in post-generation guardrails
The `verifyReferencesBlock()` function must verify both the statute NAME and SECTION NUMBER against the database — not just the statute name. The current verification threshold of 6 (name match only) must be raised so that a hallucinated section number like "Section 999 of PPC" fails verification even though "PPC" exists in the DB. Both name AND section must match a real DB record.

### R3. Prose-level statute fact-checking
After AI generates a response, extract all "Section X of Y" / "Article X of Y" mentions from the prose body and validate each against the statute database. When a hallucinated statute+section combination is detected (exists in prose but NOT in DB), replace the specific section reference with generic text like "refer to the relevant provision of [Statute Name]" — preserving the surrounding legal analysis while removing the fabricated number.

### R4. Empty-context safety gate
When the knowledge pipeline returns empty context (timeout or no results), inject a hard safety instruction into the system prompt that prevents the AI from citing ANY specific section numbers or case law from memory. The AI should still provide general legal guidance but with ZERO specific section numbers or citations, and direct users to search /judgment-search and the statute library.

### R5. Statute citation mandate (matching case law mandate pattern)
Create a statute injection pattern similar to the case law "tool search turns" fake user/assistant injection. When verified statutes are retrieved from the DB, inject them as a high-priority conversational turn that the AI must cite from — matching the proven pattern that dramatically improved case law pool adherence.

## Acceptance Criteria

### Statute grounding enforcement
- [ ] System prompt contains explicit statute-only-from-DB rules matching case law Rules 1-6 strictness
- [ ] `context-builder.ts` no longer has fallback text allowing statute citation from memory — replaced with hard "database-only" constraint
- [ ] When no statutes are found in DB for a query about PPC Section 420, the AI response mentions "PPC" generally but does NOT cite a specific section number from training data

### Post-generation verification
- [ ] `verifyReferencesBlock()` requires both statute name AND section number to match a real DB record (not just name)
- [ ] A fabricated section reference (e.g., "Section 999 PPC" when only Sections 1-511 exist) is stripped from the references block
- [ ] Prose-level extraction catches "Section X of Y" patterns and validates them; unverified sections are replaced with generic "refer to the relevant provision" text

### Empty context safety
- [ ] When knowledge pipeline returns empty context string, a safety gate instruction is injected into the system prompt
- [ ] The safety instruction explicitly prohibits citing specific section numbers and case citations from memory
- [ ] AI responses generated with empty context contain general legal guidance and direct users to /judgment-search and the statute library

### Statute mandate injection
- [ ] When statutes are retrieved from DB, they are injected as fake user/assistant turns (matching the case law pattern at lines 13008-13025)
- [ ] The injection includes a mandate that the AI must cite statutes from the provided list

### Non-regression
- [ ] All existing case law citation handling continues working unchanged
- [ ] The references block JSON format remains valid
- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] The application starts successfully (`npm run dev` boots without crash)

## Follow-up — 2026-05-21T10:52:33+05:00

Automate the validation and adversarial stress-testing of the newly implemented Alwakeelo statute retrieval and hallucination prevention pipeline. Create an automated test harness to run a diverse suite of 50+ legal queries, verifying that the dual-defense system (prompt rules, database checking, and prose-level self-healing) prevents all statute hallucinations.

Working directory: /Users/macbook/Downloads/Alwakeelo
Integrity mode: development

## Context

We have successfully implemented a dual-defense system to prevent statute hallucination:
1.  **Prompt Constraints:** Absolute rules in context-builder.ts instructing the LLM to only cite verified sections from the database.
2.  **References Filtering:** Backend extraction and database lookup in routes.ts that drops any unverified reference cards.
3.  **Prose Self-Healing:** The enforceStatuteSectionIntegrity function in routes.ts which parses the AI's prose, detects any unverified "Section X of Y" or "Article X of Y" statements, and automatically rewrites them to "the relevant provision of [Statute Name]".

We need a robust, production-grade test harness to stress-test this entire pipeline under adversarial legal prompts and verify its performance.

## Requirements

### R1. Implement an Automated Validation Script
Create an idempotent test/validation script at scripts/validate-statute-pipeline.ts that can be run from the command line. The script must:
1.  Initialize the database connection and import/run the core response pipeline (specifically the prompt builder, LLM generation, and safety/verification layers).
2.  Run the validation test suite (defined in R2).
3.  Analyze the output text and JSON reference blocks for each test run.
4.  Log detailed test execution metrics (pass/fail status, expected vs. actual output, self-healing matches, and API latency).

### R2. Design a 50+ Adversarial Legal Test Suite
Define a comprehensive, diverse test suite of at least 50 distinct legal queries within the validation script:
1.  **Category A (Seeded Statutes - 20 cases):** Queries about specific sections of the 29 seeded statutes (e.g., PPC 302, CrPC 497, CPC O41 R19, Limitation Act Art 168). Verify that the correct sections are retrieved, cited, and mapped to cards successfully without getting scrubbed.
2.  **Category B (Unseeded Statutes - 15 cases):** Queries referencing niche, obscure, or local laws not present in the 443 seeded database entries. Verify that the self-healing processor successfully converts any specific section mentions to generic phrasings (e.g. rewriting "Section 15 of Punjab Rented Premises Act" to "the relevant provision of Punjab Rented Premises Act").
3.  **Category C (Trick/Adversarial - 15 cases):** Prompts designed to deceive the LLM into citing fake sections from its training memory (e.g., asking for non-existent articles, or feeding fake section-statute pairs). Verify that no hallucinated sections bypass the prose-scrubbing filter.

### R3. Generate a Markdown Test Report
The script must automatically output a highly detailed, clean markdown report at statute_test_report.md in the workspace root. The report must contain:
1.  An executive summary of overall results (Total Tests, Passes, Failures, Success Rate).
2.  A detailed table showing every query, the raw model output, the post-processed/healed output, and whether it passed verification.
3.  Latency metrics showing the exact time overhead (in milliseconds) added by the database verification and self-healing parser layers.

## Acceptance Criteria

### Execution & Test Harness
- [ ] The validation script runs cleanly via a package script or npx tsx scripts/validate-statute-pipeline.ts with no compiler errors.
- [ ] The test suite contains at least 50 distinct, legally diverse, and realistic test cases split across Category A, B, and C.

### Pipeline Correctness & Safety
- [ ] 0% Hallucination Leakage: The script asserts that 100% of unverified statute citations (either in reference cards or prose text) are either dropped or successfully rewritten into a generic safe provision form.
- [ ] 0% False Negatives for Seeded Law: The script asserts that verified sections of seeded statutes are preserved correctly (not scrubbed) and successfully render reference cards.
- [ ] Performance Threshold: The average latency overhead for the server-side verification and self-healing layers is measured and stays below 300ms.

### Reporting
- [ ] A clean markdown report statute_test_report.md is automatically generated on execution, detailing all metrics, passes, and failure logs.
- [ ] The repository passes all existing standard checks (npm run check / npm test) with zero regressions.

## Follow-up — 2026-05-21T11:57:04+05:00

Implement the collection of user phone numbers during registration (Sign Up) and integrate it with the Admin User Portal. Additionally, fix the truncation issue in the Admin consultation thread view and make the user activity tracking panel available to all administrators.

Working directory: /Users/macbook/Downloads/Alwakeelo
Integrity mode: development

## Requirements

### R1. Database Schema Update
- Add a nullable `phoneNumber` column to the `users` table in `shared/models/auth.ts` (using `varchar("phone_number")`).
- Keep the field optional at the database level to prevent breaking existing users, but make it required during the email registration flow.

### R2. Signup Form and Backend Validation
- In `client/src/pages/auth.tsx`, add a Phone Number input field when in sign-up mode (collecting `phoneNumber` state). Import the `Phone` icon from `lucide-react` to styled the input premium-ly.
- In `server/replit_integrations/auth/routes.ts`, update `registerSchema` to require and validate `phoneNumber` (string, minimum 1 character).
- Extract and pass `phoneNumber` to `authStorage.upsertUser` in `/api/auth/register`.

### R3. Admin Portal User List and CSV Export
- In `client/src/pages/admin-panel.tsx`, display the user's phone number in the users list (under their email) using a phone icon.
- Update `exportUsersCsv()` to include the `phone_number` column in both the CSV headers and data rows.

### R4. Admin Portal Manual User Creation
- Update the admin manual user creation form in `client/src/pages/admin-panel.tsx` to include a Phone Number input field.
- Update the backend manual user creation endpoint `/api/admin/users` in `server/routes.ts` to require, validate, and store the `phoneNumber`.

### R5. Admin Portal User Activity & Consultation Thread Fixes
- **Unlock Activity Button**: Remove the `isSuperAdmin` email check restriction from the "Activity" button toggle in `client/src/pages/admin-panel.tsx` so that any administrator can view a user's recent searches and threads.
- **Fix Consultation Thread Truncation**: Remove the hard-truncation of thread messages to 800 characters in `client/src/pages/admin-panel.tsx`. Implement a beautiful, interactive "Show More / Show Less" toggle button so admins can read the complete message content.

## Acceptance Criteria

### Phone Number Feature
- [ ] Registration form validates and requires phone number.
- [ ] Registered users have their phone numbers stored in the PostgreSQL database.
- [ ] Admin panel lists registered users' phone numbers with a premium layout under their email.
- [ ] Creating a user manually from the admin panel validates and stores their phone number.
- [ ] Exporting users to CSV includes a `phone_number` column.

### Activity & Thread Fixes
- [ ] The "Activity" button is visible and fully functional for any administrator account.
- [ ] Consultation thread messages exceeding 800 characters are not permanently cut off; they show a "Show More" toggle which reveals the full message.

### System Integrity
- [ ] `npm run check` compiles with 0 TypeScript errors.
- [ ] `npm test` runs and passes with 0 failures.

