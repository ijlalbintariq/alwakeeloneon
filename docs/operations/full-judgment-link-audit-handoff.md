# Antigravity handoff: full judgment link and identity audit

Work in `/Users/macbook/Downloads/Alwakeelo`.

The user authorizes a complete, resumable audit of every judgment in the live AlWakeelo database. The expected size is approximately 250,000 records; obtain the real count instead of assuming that number. Audit all records, including records outside previous repair cohorts.

## Constraints

- Perform an audit only. Do not repair, relabel, delete, reindex, migrate, deploy, or push anything. Report proposed repairs separately for approval.
- Make no paid AI, embedding, reranking, OCR-service, or model calls. Do not invoke semantic MCP search or `legal_research`, because they can call paid services. Existing database/hosting usage still applies.
- Use existing local credentials without displaying or copying secrets into reports, shell arguments, logs, commits, or chat. Do not reuse credentials pasted in conversation history; use the configured environment or ask for a securely configured credential if necessary.
- Use native PostgreSQL with read-only transactions, bounded batches and statement timeouts. Never call an apply/reset mode of an existing repair script.
- Use the existing app identity and formatting helpers. Add only the audit runner, meaningful tests and audit documentation. Preserve unrelated work.
- Keep private snapshots and results under ignored `scratch/full-judgment-link-audit/`. Check that this path is ignored before writing production data. Use restrictive file permissions. Keep secrets and judgment bodies out of Git.
- Do not treat HTTP 200, stored `text_status='own'`, a matching citation, or a SPA HTML shell as proof of case identity.
- Do not report a whole-database pass until all required stages are complete. A launched background process is not a completed audit.

## Existing work to read first

Read applicable `AGENTS.md` instructions, then:

- `docs/audits/judgment-citation-review-2026-11-07.md`
- `docs/operations/judgment-citation-ownership.md`
- `server/citation-verify.ts`
- `server/storage.ts`: `getJudgmentDetail`, `getValidatedJudgmentIntegrity`, `findTextOwnerJudgment`
- `server/routes.ts`: `/api/public/judgments/:id`, PDF handler and public judgment rendering routes
- `server/mcp-server.ts`: judgment retrieval and case-law result construction
- `server/rag/rag-service.ts`, `server/rag/text-cleaner.ts`, `server/rag/repaired-index.ts`
- `shared/schema.ts`, `server/lib/judgmentFormatter.ts`, `shared/source-file-format.ts`
- `script/no_paid_network.ts`
- Existing relevant tests under `tests/unit/`

Reuse relevant verification logic from `scratch/citation-source-review-2026-11-07/verify-committed.mts`, `verify-public.mts`, `verify-authenticated-readers.mts`, and `verify-owner-hint.mts`. These are private local evidence scripts, not a full-database audit. Inspect them before running them because some overwrite previous evidence files. Do not rerun repair workers.

Last completed review repaired 24,852 cohort records: 22,540 duplicate links and 2,312 citation corrections. Another 193 canonical-owner repairs and 185 keyword rows were verified. There were 4,559 unresolved identities in that cohort, including 4,347 active unresolved and 212 previously archived records. Those numbers are not a database-wide error count. Recompute current state; records and deployments may have changed.

## Deliverables and execution

Create a standalone TypeScript audit runner using existing installed dependencies and native Node APIs. Include a self-check or focused tests covering result classification, redirects, checkpoint recovery, response-body identity, and failure handling. Document exact start, status and resume commands. Make all runs read-only against production.

Execute a small pilot first, report measured throughput and a revised time estimate, then continue the full authorized audit without waiting for another approval. Use a persistent process mechanism available on this Mac so the task survives the agent session; save its PID, log and exact resume command. Validate that it remains running. If persistence cannot be established, say so and provide the foreground command instead of claiming the audit continues.

### Stage 1: snapshot and database checks

1. Read the current production commit from `https://www.alwakeelo.com/health` and database health from `/health/db`. Confirm local checker code matches deployed behavior; record differences instead of silently comparing incompatible versions.
2. Record audit start time, code version, database row counts, active/archived/alias counts, source formats and the selected record IDs. Use an inventory snapshot so concurrent inserts do not create an endless run. Record each row's update time and relevant source fingerprint; classify changed records for recheck.
3. Stream records using indexed keyset pagination. Avoid OFFSET, a single huge in-memory load, or a transaction held open for many hours. Read each canonical body once where practical and cache only the evidence needed for later stages.
4. For every record, validate the canonical pointer, target existence, active state, and absence of cycles or unsupported chains. Apply the actual one-hop reader rules. Audit inactive records without aliases separately; an intentional 404 is not automatically a broken active link.
5. Assess active canonical identities with the existing title/court/citation/header checks. Compare complete raw and formatted text using the real deterministic formatter, allowing the same whitespace differences as the app. Record SHA-256 hashes and explicit reasons. Preserve reporter court and publisher-section distinctions; never select the first ambiguous citation match.
6. Check database citation namespace fields and lookup ambiguity. Where citation-based URLs are actually published by the app, inventory and validate them separately from UUID URLs. A deliberately rejected ambiguous citation route is not proof of a wrong UUID link.
7. Compare available original MD/TXT/PDF source evidence with the stored judgment text. Prefer cached source files and validate their hashes. Reuse existing Cloudflare/R2 inventories. Fetch original objects only when necessary and only from configured source locations. Use installed local extraction tools for PDFs; do not install or call paid OCR services. Mark inaccessible originals, image-only PDFs and incomplete headers as insufficient evidence. Do not infer a reliable source association from a filename or citation substring alone.

### Stage 2: live URL checks for every record

1. Start at low load: at most four requests in flight and two requests per second globally. Time a small pilot, then adapt conservatively to production latency and rate limits. Do not promise the earlier theoretical 5–20 checks/second estimates as measured capacity.
2. Check the actual `/judgment/<uuid>` URL and `/api/public/judgments/<uuid>` response for every inventoried UUID, including old aliases. These requests exercise different paths. A page returning the SPA shell proves only route availability; API identity/content checks are also required. Reuse a canonical content comparison for aliases only when its source fingerprint is unchanged, but still request every old URL.
3. For a confirmed case, verify the returned canonical ID, title, citation, integrity state and complete source-derived text. Compare complete normalized text or normalized hashes, not just the first header lines. Confirm reported source URLs resolve to that expected canonical case. Separate raw-source hashes from normalized-display hashes.
4. For unconfirmed records, verify the deployed response follows the app's withholding rules. Classify these as correctly withheld or insufficient evidence, never as identity verified. For retired records, compare the response with their expected canonical or intentional unavailable state.
5. Inventory judgment PDF/download URLs and stored source-object URLs that the app actually publishes. Where present, check availability, MIME/signature and whether the app allows access for that integrity state. Reuse cached original evidence; do not download the same large object for every alias. A generated text PDF and an original court PDF must be identified separately. Text-only records are valid and do not require an original PDF. If content/identity cannot be established, leave it unverified.
6. Use bounded response sizes and timeouts. Retry transient network errors and 5xx responses a limited number of times. Honor `Retry-After`; back off on 429. Stop the live worker and save a checkpoint if persistent errors, sustained slowdowns or deployment changes make comparisons unreliable. Do not suppress failures to improve the pass count.
7. Restrict automated requests to the configured AlWakeelo origins and established source hosts. Validate redirects and do not forward authentication headers across origins. Do not request arbitrary URLs found inside judgment text.

### Stage 3: search and MCP consistency without paid services

1. Audit existing `case_law` and judgment-linked retrieval records in bounded native queries. Identify stale titles/courts/summaries, ambiguous mappings and chunks unsupported by the current canonical judgment body. Use actual schema and retrieval logic; do not invent JSON fields or joins.
2. Distinguish stale stored data from incorrect served results: the app may already replace metadata or withhold unsupported excerpts. Record both outcomes. Do not change vector rows or rebuild embeddings.
3. Confirm the MCP result-construction path uses the same validated canonical identity and UUID source link for the audited records. Exercise the actual shared handler logic locally where feasible and run focused MCP regression tests with model/network calls blocked.
4. If a securely configured MCP key is available, perform representative authenticated `get_judgment` checks across outcome categories. Do not call paid search/research. Report precisely how many authenticated calls were checked; local handler checks are not equivalent to 250,000 authenticated network calls or a ChatGPT UI test.

### Stage 4: checkpoints, results and final report

- Save an append-only per-record result containing requested UUID, expected and returned canonical IDs, title/citation checks, source/display hashes, link results, reasons, attempts, timestamps and deployment version. Do not save credentials or full judgment bodies in this result stream.
- Keep stage checkpoints and totals durable and recoverable. Use atomic checkpoint replacement and an exclusive run lock. Do not advance past unpersisted results; tolerate or deduplicate a final result replay after a crash. Retain failed IDs for a separate retry pass.
- Keep database identity, source evidence, live link, PDF and search-index outcomes as separate fields. Use a disjoint overall classification with documented precedence for totals. A withheld record can have a working URL without a verified identity.
- Report exact coverage denominators: inventoried, database checked, original source checked, live page checked, API checked, PDF checked where applicable, search records checked, changed during audit, and still pending. Ensure every snapshot UUID is accounted for; do not hide skipped records.
- Summarize matched records, valid aliases, correctly withheld records, intentional archived/unavailable records, broken links, wrong-case responses, stale search data, missing sources and transient failures. Give representative IDs and evidence for each failure category.
- Write a concise human-readable report under `docs/audits/` with aggregate counts and no private data. Keep detailed artifacts in ignored scratch. Explain that internal/source consistency does not independently authenticate judgments against official court records.
- Show the user the final results and proposed repair groups. Do not claim all links are verified while the process is still running or any required stage is pending.

## Acceptance criteria

Every judgment UUID from the inventory has a durable result or an explicit pending/changed reason. Every confirmed title/text/link match has actual supporting evidence. Expected withholding and archive behavior are reported separately from confirmed identities and genuine defects. No production records changed, no paid model services used, and no secrets exposed.
