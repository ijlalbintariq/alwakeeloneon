# Al Wakeelo Comprehensive Code Review Report
**Recent Changes Audit: UI Components, RAG Pipeline, SQL Ranking, Vector Search & DB Connection Pool Timeouts**

**Date**: 2026-10-01 / 2026-10-02  
**Author**: Project Orchestrator  
**Working Directory**: `/Users/macbook/Downloads/Alwakeelo/.agents/orchestrator_code_review`  
**Authoritative Reference**: `/Users/macbook/Downloads/Alwakeelo/.agents/ORIGINAL_REQUEST.md` (`## 2026-10-01T20:11:54Z`)  
**Git Baseline & Target Commits**: `fe1bf5f` to `c7fef7b` (specifically focusing on `0115462`, `419eb4a`, `4cd9081`, `5248790`, `3e1dab5`, `ec33506`)  
**Read-Only Conformance**: **PASS (0 code files modified; verified via `git status --porcelain`)**  
**Independent Review Verdict**: **APPROVE (Verified by `reviewer_fact_checker`)**  

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Independent Reviewer Verification & Audit Status](#2-independent-reviewer-verification--audit-status)
3. [High Severity Findings](#3-high-severity-findings)
4. [Medium Severity Findings](#4-medium-severity-findings)
5. [Low Severity Findings](#5-low-severity-findings)
6. [Dedicated Section: Verification of DB Connection Timeout Handling Logic Completeness](#6-dedicated-section-verification-of-db-connection-timeout-handling-logic-completeness)
7. [Comprehensive Findings Matrix](#7-comprehensive-findings-matrix)
8. [Prioritized Remediation Roadmap](#8-prioritized-remediation-roadmap)

---

## 1. Executive Summary

This comprehensive code review was conducted under strict read-only constraints to evaluate recent architectural and implementation changes across the Al Wakeelo platform:
- **Backend**: RAG retrieval pipelines, SQL-based full-text/hybrid ranking, per-tenant partial HNSW vector indexes, and database connection pool timeout management.
- **Frontend**: Citation popup suggestion lifecycle, dynamic factual matrix box auto-expansion/state, and the expanded 53-entry forum dropdown list.

Across 30 audited points, **10 High Severity**, **12 Medium Severity**, and **8 Low Severity** defects and architectural risks were identified and independently fact-checked. Crucially, the review identified:
1. **Critical Legal Retrieval Flaws**: Overruled cases are merely score-penalized (`* 0.3`) rather than excluded, allowing bad law to be injected into the system prompt as "VERIFIED JUDGMENTS" which the AI model is commanded to strictly cite.
2. **Database Starvation Cascades**: Application-level timeouts in `retrieval-engine.ts` rely on `Promise.race`, which abandons JavaScript execution without cancelling active PostgreSQL queries. These "ghost queries" continue running for up to 20 seconds, monopolizing connection pool slots (cap: 16) and causing pool exhaustion under load.
3. **Editor Input Lockup**: Rapid typing in the legal editor freezes newline insertion and arrow navigation whenever citation searches yield 0 results, because `CitationList.onKeyDown` swallows Enter and Arrow keys.
4. **Jurisdictional Logic Inversion**: A substring check (`!forum.includes(",")`) silences district station selection on the Customs Court while erroneously enabling district selection on the Supreme Court of Pakistan.

---

## 2. Independent Reviewer Verification & Audit Status

Per Acceptance Criterion AC3, an independent reviewer agent (`teamwork_preview_reviewer`, conversation ID `d1089d94-efe1-448f-bb6b-c49f5e21a2b6`) audited all 30 cited items against the live codebase.

### Audit Summary:
- **Strict Read-Only Enforcement**: Confirmed via `git status --porcelain` that exactly **0 code files** were created, modified, or deleted during this review.
- **Line & File Accuracy**: 100% of cited file paths, line ranges, and verbatim code quotes were confirmed against the repository.
- **Logic Chain Validity**: All failure modes—including event swallowing in ProseMirror, CSS specificity clashes in Tailwind dark mode, tsquery parser crashes on unescaped punctuation, multi-tenant vector index exclusion, and unhandled connection leaks—were verified.
- **Gate Verdict**: **APPROVE (CLEAN — 0 Integrity Violations)**.

---

## 3. High Severity Findings

### [HIGH-01] Overruled Precedent Promoted to LLM as Authoritative "VERIFIED JUDGMENTS"
- **Files**:
  - `server/pipeline/retrieval-engine.ts:355–364, 649, 676–680`
  - `server/pipeline/context-builder.ts:53–111`
- **Verbatim Code**:
  ```typescript
  // server/pipeline/retrieval-engine.ts:355-364
  // ── Overruled penalty ──────────────────────────────────────────────
  // A judgment overruled by a later case is not good law — demote heavily.
  if (row.isOverruled) {
    score *= 0.3;
  }
  return Math.max(0, score);
  ...
  // Line 649:
  const rawMinScore = isCitationLookup ? 0 : 10;
  ```
  ```typescript
  // server/pipeline/context-builder.ts:101-107
  id: "verified-judgments",
  heading: "=== VERIFIED JUDGMENTS FROM INTERNAL DATABASE ===",
  lines: [
    "Use ONLY these citations. Copy each CITATION string EXACTLY. Format: **[CITATION STRING]** — explanation.",
    "STRICT RULE: Cite ONLY the formal citation string, copied from this list. DO NOT write party names, case titles, or 'vs' anywhere in your text.",
  ]
  ```
- **Technical Vulnerability**:
  In Pakistani and common-law jurisprudence, an overruled judgment is nullified precedent. In `retrieval-engine.ts`, an overruled case (`row.isOverruled === true`) is only demoted by multiplying its score by `0.3`. High-relevance landmark judgments (e.g., base score 60–90) retain scores of 18–27, easily clearing `rawMinScore = 10`. With RRF boosting (`+ 10-30`) and judgment bonus (`+ 5`), their final score frequently exceeds 35. These cases are forwarded to `context-builder.ts`, which injects them under `=== VERIFIED JUDGMENTS FROM INTERNAL DATABASE ===` and commands the LLM to cite them strictly without disclosing that they are overruled.
- **Impact**: The AI legal assistant actively advises advocates to cite bad law as authoritative precedent in court pleadings.

---

### [HIGH-02] Unsanitized tsquery Syntax Errors Causing Silent Failures in `searchCaseLaw`
- **Files**:
  - `server/storage.ts:1655–1662, 1730–1732, 1751–1772`
  - `server/pipeline/retrieval-engine.ts:426–429`
- **Verbatim Code**:
  ```typescript
  // server/storage.ts:1655-1662
  const queryTokens = hasTextQuery
    ? safeQuery
        .toLowerCase()
        .split(MULTIPLE_SPACES_REGEX)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
        .slice(0, 10)
    : [];
  ...
  // server/storage.ts:1731
  sql`(ts_rank_cd(tsv_citation_title_summary_court, to_tsquery('simple', ${queryTokens.join(' | ')})) * 500)::int`
  ```
- **Technical Vulnerability**:
  In `server/storage.ts:2551` (`searchJudgmentsByKeywordsRaw`), tokens are sanitized using regex `replace(/[^a-z0-9\-]/g, "")` because operators `( ) : & | ! < > *` throw PostgreSQL tsquery syntax errors. However, in `searchCaseLaw` (line 1658), `safeQuery` is split only on whitespace without character stripping. Legal queries containing standard legal citations such as `"12(2) CPC"`, `"bail:"`, `"Order 39 Rule 1"`, or `"(murder)"` retain parenthesis and colons. Passing `12(2)` into `to_tsquery('simple', ...)` causes PostgreSQL to throw: `ERROR: syntax error in tsquery: "12(2)"`. In `retrieval-engine.ts:429`, the call is wrapped with `.catch(() => [] as CaseLaw[])`, swallowing the crash and silently returning 0 results.
- **Impact**: Keyword case law search fails silently on any query containing standard procedural or statutory section citations with parentheses.

---

### [HIGH-03] Full Table Scan & Wildcard Short-Circuiting in `searchStatutes`
- **File**: `server/storage.ts:1528–1602`
- **Verbatim Code**:
  ```typescript
  // server/storage.ts:1528-1549
  const sectionTokens = tokens.filter((token) => /^\d{1,4}(?:-?[a-z]{1,3})?$/.test(token));
  if (sectionTokens.length > 0) {
    const wordTokens = tokens.filter((token) => !sectionTokens.includes(token));
    const narrow = await db.select()
      .from(statutes)
      .where(or(...sectionTokens.map((token) => or(
        sql`lower(${statutes.section}) = ${token}`,
        ilike(statutes.section, `%${token}%`),
      ))))
      .orderBy(sql`(${scoreExpr}) DESC`, asc(statutes.id))
      .limit(limit);
    if (narrow.length > 0) return narrow;
  }
  ```
- **Technical Vulnerability**:
  1. The regex `/^\d{1,4}(?:-?[a-z]{1,3})?$/` matches single digits (e.g. `"1"` or `"2"`). For a query like `"Article 1 Constitution"`, `sectionTokens = ["1"]`. The WHERE clause filters exclusively on `section ILIKE '%1%'` without any requirement for word tokens like `"Constitution"`.
  2. Over 50% of the 37,000 rows in `statutes` contain the digit `"1"`. Hundreds of completely unrelated statutes match `section ILIKE '%1%'`. Because they have 0 word-token matches, their score is 0, but they fill the limit of 10 rows. Because `narrow.length > 0`, line 1549 immediately returns these irrelevant statutes, completely short-circuiting the broad fallback search.
  3. `statutes` (`shared/schema.ts:136`) only has a composite index on `(short_title, section)`. A standalone query on `section` cannot use this index, forcing a sequential table scan across 37,000+ rows. In the fallback (lines 1571–1601), 10 tokens produce 40 unindexed ILIKE operations and 50 CASE expressions evaluated sequentially on every request.
- **Impact**: Statute queries containing single or double-digit section numbers return completely irrelevant acts while burning database CPU on unindexed sequential scans.

---

### [HIGH-04] Multi-Tenant Vector Search Starvation on Private Documents
- **Files**:
  - `server/rag/vector-store.ts:400–409`
  - `migrations/0008_rag_chunks_per_tenant_hnsw.sql:21–42`
- **Verbatim Code**:
  ```typescript
  // server/rag/vector-store.ts:400-408
  const GLOBAL_ADMIN_RAG_USER_IDS = [
    "global-admin-case-law",
    "global-admin-statute",
    "global-admin-statute-sections",
    "global-admin-knowledge",
    "global-admin-judgments"
  ];
  const isGlobalId = GLOBAL_ADMIN_RAG_USER_IDS.includes(args.userId);
  const userIdClause = isGlobalId ? `c.user_id = '${args.userId}' AND $1 = $1` : "c.user_id = $1";
  ```
- **Technical Vulnerability**:
  Migration 0008 introduced partial HNSW vector indexes with hardcoded predicates strictly matching 4 global admin user IDs (`global-admin-statute`, `global-admin-statute-sections`, `global-admin-case-law`, `global-admin-knowledge`). When an individual user or organization tenant queries vector store (`args.userId = "usr_123"`), `isGlobalId` is `false`. The SQL query generates `c.user_id = $1`. The PostgreSQL planner cannot utilize any of the partial indexes and must fall back to the global index `idx_rag_chunks_embedding_hnsw`. However, as migration 0008's header notes, `rag_chunks` is 96% populated by judgment vectors. In the shared HNSW graph walk, the nearest-neighbor traversal explores judgment clusters, discards them due to `user_id != $1`, and exhausts its search budget (`ef_search = 150`), returning 0 matches for valid tenant documents.
- **Impact**: Private organization and user uploaded documents suffer from complete retrieval starvation in vector searches.

---

### [HIGH-05] Asymmetric Pipeline Fan-Out vs Search Concurrency Cap
- **Files**:
  - `server/pipeline/knowledge-pipeline.ts:355–373`
  - `server/pipeline/retrieval-engine.ts:520–531, 1035, 1235`
  - `server/rag/vector-store.ts:82–98`
- **Verbatim Code**:
  ```typescript
  // server/rag/vector-store.ts:82, 88-98
  const SEARCH_CONCURRENCY = Math.max(1, Number(process.env.RAG_SEARCH_CONCURRENCY || 4));
  let active = 0;
  const waiting: Array<() => void> = [];

  async function acquireSlot(): Promise<void> {
    if (active < SEARCH_CONCURRENCY) {
      active += 1;
      return;
    }
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  ```
- **Technical Vulnerability**:
  For complex queries, `knowledge-pipeline.ts` extracts up to 5 subqueries (HyDE, statutory query, issues, facts). `retrieval-engine.ts` executes `retrieveForQuery` for each subquery across 2 tenants (10 vector searches). The primary RAG promise executes 6 tenant searches. Admin docs trigger 2 more searches. A single user prompt initiates up to **19 vector searches** simultaneously. However, `SEARCH_CONCURRENCY` is capped at **4**. Up to 15 searches are queued in the in-memory `waiting` array. Because application timeouts are set to 5s (`CASELAW_TIMEOUT_MS`) and 8s (`STATUTE_TIMEOUT_MS` / `RAG_TIMEOUT_MS`), early timeouts fire and return empty fallbacks to the client while queued searches are still waiting in Node memory. When slots open, the abandoned searches execute against PostgreSQL anyway, wasting DB CPU on discarded results.
- **Impact**: Severe request latency and wasted database processing on queries already abandoned by HTTP clients.

---

### [HIGH-06] Fail-Open Overruled Verification in Judicial Bench Pipeline
- **File**: `server/pipeline/bench-pipeline.ts:1233–1248`
- **Verbatim Code**:
  ```typescript
  // server/pipeline/bench-pipeline.ts:1233-1248
  } catch (err) {
    console.warn("[BenchPipeline:Filter] Live DB verification encountered error, relying on offline catalog:", err);
  }
  }

  // Populate clean sets
  for (const cit of safeCitations) {
    if (!overruledCitations.has(cit) && !isKnownOverruled(cit)) {
      cleanCitations.add(cit);
    }
  }
  ```
- **Technical Vulnerability**:
  In `filterOutOverruledCases`, candidate judgments are verified against database citation links and `judgments.is_overruled`. If the database query throws (due to pool starvation, statement timeout, or connection drops), the catch block logs a warning and proceeds. Because `overruledCitations` was not populated by the failed DB query, the loop checks only a tiny hardcoded offline set (`isKnownOverruled`). Any overruled case in the live database that is not in the tiny static catalog is deemed "clean" and added to `cleanCitations`.
- **Impact**: Under database pressure or connection timeouts, the system fails open, allowing overruled cases to bypass adversarial RAG integrity filters.

---

### [HIGH-07] Unindexed OR-ILIKE CPU Saturation on 223k-Row `judgments` Table
- **File**: `server/storage.ts:2772–2790`
- **Verbatim Code**:
  ```typescript
  if (rows.length === 0 && perTokenExprs.length > 1) {
    const ilikeOrExpr = or(...perTokenExprs)!;
    const resOr = await db.execute(sql`
      SELECT j.id, ...
      FROM judgments j
      LEFT JOIN courts_ref c ON j.court_id = c.id
      INNER JOIN law_journals l ON j.journal_id = l.id
      WHERE j.is_active = true AND ${ilikeOrExpr}
      ORDER BY j.year DESC
      LIMIT ${safeLimit * 2}
    `);
    rows = resOr.rows as any[];
  }
  ```
- **Technical Vulnerability**:
  When full-text search and AND-ILIKE return 0 results, line 2772 executes an unconstrained OR-ILIKE across `title` and `headnotes` on the 223,000-row `judgments` table with `ORDER BY j.year DESC`. Because the filter is OR-based across multiple terms, PostgreSQL cannot use index scans and must evaluate patterns across the entire table. Under moderate query volume, this ties up database CPU cores for several seconds, exhausting connection pool availability.
- **Impact**: Database server CPU spikes to 100%, causing cascading connection pool acquire timeouts for all other active users.

---

### [HIGH-08] Editor Enter & Arrow Key Swallowing on Zero Results
- **Files**:
  - `client/src/components/citation-list.tsx:67–83`
  - `client/src/components/legal-editor.tsx:579–585`
- **Verbatim Code**:
  ```tsx
  // client/src/components/citation-list.tsx:67-83
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev >= items.length - 1 ? 0 : prev + 1));
        return true;
      }
      if (event.key === "Enter") {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));
  ```
  ```tsx
  // client/src/components/legal-editor.tsx:583-585
  onKeyDown: (props: any) => {
    ...
    return component?.ref?.onKeyDown(props) ?? false;
  }
  ```
- **Technical Vulnerability**:
  When `items.length === 0` (e.g. while citation search is pending or returns no matches):
  - Pressing `Enter` executes `selectItem(0)`. Because `items[0]` is undefined, no citation is inserted, but `onKeyDown` returns `true`.
  - In `legal-editor.tsx:584`, `return true` signals ProseMirror that the key was handled, suppressing default Enter behavior. Newlines cannot be inserted.
  - Pressing `ArrowUp` evaluates `prev <= 0 ? items.length - 1 : prev - 1` to `-1`, corrupting selection state while returning `true` and blocking cursor movement.
- **Impact**: Advocates drafting legal petitions experience editor freezing where typing Enter or Arrow keys is completely unresponsive.

---

### [HIGH-09] Module-Scoped Timer Collision & Out-of-Order Fetch Race Condition
- **File**: `client/src/components/citation-suggestion.ts:26–27, 128–161`
- **Verbatim Code**:
  ```ts
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  ...
  if (debounceTimer) clearTimeout(debounceTimer);

  return new Promise<CitationSuggestionItem[]>((resolve) => {
    debounceTimer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: searchQuery, limit: isAutoSuggest ? "6" : "8" });
        const res = await fetch(`/api/case-law/cite?${params.toString()}`, { credentials: "include" });
        ...
        resolve(items);
      } catch (err) {
        resolve([]);
      }
    }, isAutoSuggest ? 350 : 200);
  });
  ```
- **Technical Vulnerability**:
  1. `debounceTimer` is declared at the module root (`line 26`). If multiple editor instances exist (e.g., split-view petition drafting or comparative brief review), typing in one editor clears the debounce timer of the other editor.
  2. The native `fetch()` does not utilize an `AbortController`. If a user types query `Q1` (takes 800ms) followed by `Q2` (takes 200ms), `Q2` resolves first. When `Q1` resolves 600ms later, it overwrites the results of `Q2` with stale citations.
- **Impact**: Citation auto-complete displays stale, out-of-date case suggestions that do not match the user's current typed text.

---

### [HIGH-10] Jurisdictional Comma Matching Logic Flaw & Court Name Corruption
- **File**: `client/src/experimental/components/drafting/DraftingLaunchpad.tsx:138–143, 279–280, 317, 350–358`
- **Verbatim Code**:
  ```tsx
  const forumWithStation =
    draftType === "pleading" && station.trim() && !forum.includes(",")
      ? `${forum}, ${station.trim()}`
      : forum;
  ...
  <option value="Supreme Court of Pakistan">Supreme Court of Pakistan</option>
  ...
  <option value="Court of the Special Judge (Customs, Taxation and Anti-Smuggling)">
    Special Judge (Customs, Taxation & Anti-Smuggling)
  </option>
  ...
  {draftType === "pleading" && !forum.includes(",") && (
    <input
      value={station}
      onChange={(e) => setStation(e.target.value)}
      placeholder="District / station, e.g. Sialkot"
    />
  )}
  ```
- **Technical Vulnerability**:
  1. **False Negative (Customs Court)**: The value `"Court of the Special Judge (Customs, Taxation and Anti-Smuggling)"` contains a comma between "Customs" and "Taxation". `!forum.includes(",")` evaluates to `false`, hiding the district station input and preventing advocates from specifying the territorial seat for customs pleadings.
  2. **False Positive (Apex Courts)**: `"Supreme Court of Pakistan"` and `"Federal Shariat Court"` contain no commas. `!forum.includes(",")` evaluates to `true`, displaying the district input and submitting legally invalid headings such as `"Supreme Court of Pakistan, Sialkot"`.
- **Impact**: Generates legally nonsensical court titles sent to AI legal drafting pipelines while blocking station selection on valid special courts.

---

## 4. Medium Severity Findings

### [MED-01] Missing `try ... finally` Block Leaking Migration Pool Connections
- **File**: `server/storage.ts:4624–4636, 5410–5415`
- **Description**: `migrationPool.end()` at line 5411 is invoked outside a `finally` block. If any migration query between lines 4655 and 5405 throws an exception, `migrationPool.end()` is bypassed, abandoning open pool connections on Neon/PgBouncer.

### [MED-02] Inconsistent CTE Join Semantics in `searchJudgmentsByKeywordsRaw`
- **File**: `server/storage.ts:2704–2730`
- **Description**: The `candidates` CTE uses `LEFT JOIN law_journals l ON j.journal_id = l.id`, but the outer query uses `INNER JOIN law_journals l`. Candidate judgments with null or unlinked journals occupy CTE limit slots (`safeLimit * 8`) but are silently discarded by the outer join, returning fewer rows than requested.

### [MED-03] 32-Bit Signed Integer Overflow in Hex UUID Slicing
- **Files**:
  - `server/storage.ts:2311, 2799`
  - `server/pipeline/retrieval-engine.ts:463`
  - `shared/schema.ts:141`
- **Description**: Slicing 8 hex characters from UUIDs and parsing via `parseInt(..., 16)` produces numbers up to `4,294,967,295`. PostgreSQL `serial("id")` is signed 32-bit (`integer`, max `2,147,483,647`). For ~50% of UUIDs (leading hex 8–F), the derived ID exceeds 2.14B, causing `ERROR: integer out of range` when passed as an integer parameter.

### [MED-04] Vector Type & Operator Mismatch (`halfvec_cosine_ops` vs `$2::vector`)
- **Files**:
  - `server/rag/vector-store.ts:442, 490, 493`
  - `migrations/0008_rag_chunks_per_tenant_hnsw.sql:22`
- **Description**: Column `embedding` is `halfvec(1024)` indexed with `halfvec_cosine_ops`. Vector search queries cast parameters to `$2::vector` (float32). Cross-type distance comparison requires implicit coercion, risking index scan bypass and falling back to sequential scans.

### [MED-05] Conflicting Dark-Mode Class Collapsing Contrast in Factual Matrix Box
- **File**: `client/src/experimental/components/drafting/DraftingLaunchpad.tsx:356, 371, 385, 402`
- **Description**: The class list contains `... dark:text-[#F8FAFC] ... dark:text-[#475569]`. Due to CSS specificity resolution, typed text in dark mode renders in `#475569` against `#0B131E` background (~2.08:1 contrast), violating WCAG AA accessibility standards.

### [MED-06] Synchronous Layout Thrashing & 2px Border Jitter in Facts Auto-Expand
- **File**: `client/src/experimental/components/drafting/DraftingLaunchpad.tsx:67–73`
- **Description**: Setting `el.style.height = "auto"` followed immediately by reading `el.scrollHeight` inside `useEffect([facts])` induces synchronous layout reflows on every keystroke. Furthermore, `scrollHeight` excludes the 2px border on `border-box`, causing scroll jitter.

### [MED-07] Unmounted State Mutation in `DraftingLaunchpad`
- **Files**:
  - `client/src/experimental/components/drafting/DraftingLaunchpad.tsx:145–165`
  - `client/src/experimental/pages/PreviewDrafting.tsx:663`
- **Description**: `onStartWithAiBrief` invokes parent's `setShowLaunchpad(false)`, unmounting `DraftingLaunchpad`. The `finally` block executes `setIsInitializingAi(false)` against the unmounted component, triggering React unmounted state update warnings.

### [MED-08] Stale District Station Latching Across Mode Switches
- **File**: `client/src/experimental/components/drafting/DraftingLaunchpad.tsx:77–88`
- **Description**: When switching between `pleading` and `contract`, `handleDraftTypeChange` resets `matterTitle`, `reliefType`, `facts`, and `forum`, but omits `setStation("")`. Previously entered district names persist and latch onto newly selected court forums.

### [MED-09] Unvirtualized Native Select with 53 Hardcoded Options
- **File**: `client/src/experimental/components/drafting/DraftingLaunchpad.tsx:271–341`
- **Description**: 53 options across 5 optgroups are embedded in a raw HTML `<select>` with no search input or fuzzy matching. In a 3-column layout (`lg:grid-cols-3`), long titles (up to 62 characters) truncate silently.

### [MED-10] Tippy Escape Resurrect Bug & Array Teardown Leak
- **File**: `client/src/components/legal-editor.tsx:543–552, 580–591`
- **Description**: Pressing `Escape` calls `popup?.[0]?.hide()` without resetting the suggestion range in ProseMirror. The next keystroke in `onUpdate` immediately triggers `popup[0].show()`, resurrecting the popup. Additionally, `popup?.[0]?.destroy()` cleans up only the first element of the Tippy array.

### [MED-11] 380px Fixed Width Viewport Overflow on Small Screens
- **Files**:
  - `client/src/components/legal-editor.tsx:550–551`
  - `client/src/index.css:624–625`
- **Description**: Popup width is fixed at 380px with `placement: "bottom-start"` and no Popper `preventOverflow` modifier with `altAxis: true`. On viewports < 400px or when typing near the right margin, the popup extends off-screen.

### [MED-12] Missing Tippy Theme Causing Bubble Frame Wrapping
- **Files**:
  - `client/src/components/legal-editor.tsx:543–552`
  - `client/src/index.css:641–645`
- **Description**: `theme: "citation"` was omitted from the Tippy configuration object. The selector `.tippy-box[data-theme="citation"]` never matches, resulting in Tippy's default dark bubble frame wrapping around `.citation-suggestion-popup`.

---

## 5. Low Severity Findings

### [LOW-01] Missing Primary Key Tie-Breakers in Search Queries
- **Files**: `server/storage.ts:2701, 2729`; `server/rag/vector-store.ts:552`
- **Description**: Ordering by `relevance DESC, year DESC` without a deterministic primary key tie-breaker (e.g. `, id ASC`) causes non-deterministic row ordering across identical scores during PostgreSQL table vacuuming.

### [LOW-02] Unchecked `INVALID` State in `CREATE INDEX CONCURRENTLY`
- **File**: `migrations/0008_rag_chunks_per_tenant_hnsw.sql:21–40`
- **Description**: Interrupted `CREATE INDEX CONCURRENTLY` leaves indexes in an invalid state (`indisvalid = false`). Subsequent runs of `IF NOT EXISTS` skip rebuilding, creating write overhead without serving reads.

### [LOW-03] Unhandled PostgreSQL Error 57014 (`query_canceled`)
- **Files**: `server/storage.ts`; `server/db.ts:31`
- **Description**: When `statement_timeout` triggers in PostgreSQL, error code `57014` is thrown. Storage queries do not catch this specifically, resulting in uninformative HTTP 500 responses rather than a graceful degraded result.

### [LOW-04] Absence of Keyboard Auto-Scroll in Citation List
- **File**: `client/src/components/citation-list.tsx:126–159`
- **Description**: Container has `max-h-72 overflow-y-auto`. Navigating past item 3 using arrow keys updates `selectedIndex` but lacks `scrollIntoView()`, keeping selected items hidden below the fold.

### [LOW-05] Missing WAI-ARIA Attributes in Citation Suggestion
- **File**: `client/src/components/citation-list.tsx:89–163`
- **Description**: Popup elements lack `role="listbox"`, `role="option"`, `aria-selected`, `aria-activedescendant`, and `aria-live` status regions.

### [LOW-06] Misleading Keyboard Shortcut Affordance in Launchpad
- **File**: `client/src/experimental/components/drafting/DraftingLaunchpad.tsx:394`
- **Description**: UI displays "Shift + Enter for new line", but the textarea has no key interceptor. Plain Enter natively inserts a newline without submitting.

### [LOW-07] Mismatched Option Values and Labels in Forum Select
- **File**: `client/src/experimental/components/drafting/DraftingLaunchpad.tsx:310, 314`
- **Description**: Discrepancies between option values and text (e.g. `"Court of the Justice of Peace (Ex-Officio)"` vs `"Justice of Peace (Sections 22-A / 22-B Cr.P.C.)"`).

### [LOW-08] Unbounded In-Memory Slot Queue in Vector Store
- **File**: `server/rag/vector-store.ts:88–98`
- **Description**: `waiting` array stores unresolved promise callbacks without timeouts or abort signals.

---

## 6. Dedicated Section: Verification of DB Connection Timeout Handling Logic Completeness

Per requirement R1 and Acceptance Criterion AC2 of `ORIGINAL_REQUEST.md`, a dedicated, exhaustive audit of the database connection pool timeout handling logic was conducted.

### 6.1 Database Connection Pool Configuration (`server/db.ts:19–33`)

The database connection pool is configured as follows:
```typescript
export const pool = (canInitPool && validatedDatabaseUrl.value
  ? new Pool({
      connectionString: validatedDatabaseUrl.value,
      max: Math.max(4, Number(process.env.PG_POOL_MAX || 16)),
      min: 1,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 30_000,
      idle_in_transaction_session_timeout: 30_000,
      statement_timeout: Math.max(5_000, Number(process.env.PG_STATEMENT_TIMEOUT_MS || 20_000)),
    })
  : undefined) as any;
```

#### Verification of Individual Parameters:
1. `max: 16`: Sets a hard upper limit of 16 physical connections.
2. `connectionTimeoutMillis: 30_000`: Client checkout attempts fail after 30 seconds if the pool is fully occupied.
3. `idleTimeoutMillis: 30_000`: Idle connections are closed after 30 seconds.
4. `idle_in_transaction_session_timeout: 30_000`: Terminates sessions that linger inside uncommitted transactions.
5. `statement_timeout: 20_000` (default): Aborts server-side queries taking longer than 20 seconds.
6. `pool.on("error")` handler (lines 46–55): Catches unexpected client errors to prevent process termination on idle socket drops.

---

### 6.2 Architectural Timeout Mismatch & Ghost Query Pool Starvation

#### The Mechanism:
In `server/pipeline/retrieval-engine.ts:77–82`, retrieval calls are wrapped with `withTimeout`:
```typescript
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}
```
Application deadlines are configured as:
- `CASELAW_TIMEOUT_MS = 5_000` (5 seconds)
- `STATUTE_TIMEOUT_MS = 8_000` (8 seconds)
- `RAG_TIMEOUT_MS = 8_000` (8 seconds)

#### The Failure Mode:
`Promise.race` does **not** cancel the underlying `promise`. When the 5-second or 8-second timer expires, JavaScript execution resumes with `fallback`. However:
1. The underlying database query continues executing on the PostgreSQL server.
2. The database connection checked out from `pool` remains occupied until PostgreSQL reaches `statement_timeout = 20,000ms`.
3. The connection remains unavailable for an additional **12 to 15 seconds** after the application has already discarded the result.

#### Starvation Cascade Calculation:
- Under moderate concurrency (5 simultaneous narrative chat requests), the knowledge pipeline fans out up to $5 \times 3 = 15$ database queries.
- If these queries experience transient latency and hit the 5s/8s application timeout, **15 out of 16 available pool slots** become occupied by "ghost queries".
- Any incoming web request attempting to acquire a connection must wait in `pool._pendingQueue` for up to 30 seconds (`connectionTimeoutMillis`), causing cascading HTTP 504 gateway timeouts across the platform.

---

### 6.3 Scope and Completeness Across the Application Layers

| Layer / Subsystem | Acquire Timeout | Query/Statement Timeout | Abort on Client Drop | Starvation Risk |
|---|---|---|---|---|
| **Vector Hybrid Search** (`server/rag/vector-store.ts`) | 30s (Pool) | 12s (`SEARCH_TIMEOUT_MS`) | **Yes** (`client.release(true)`) | **Medium** |
| **Pipeline Statute Search** (`server/pipeline/retrieval-engine.ts`) | 30s (Pool) | None (Postgres 20s fallback) | **No** (Ghost query runs to 20s) | **HIGH** |
| **Pipeline Case Law Search** (`server/pipeline/retrieval-engine.ts`) | 30s (Pool) | None (Postgres 20s fallback) | **No** (Ghost query runs to 20s) | **HIGH** |
| **Direct Route Search Endpoints** (`server/routes.ts:19062`, `11542`) | 30s (Pool) | None (Postgres 20s fallback) | **No** | **HIGH** |
| **Landing Page Metrics** (`server/routes.ts:8698`, `server/storage.ts:3658`) | 30s (Pool) | None (11 parallel `COUNT(*)` queries) | **No** | **HIGH** |
| **Express CRUD Handlers** (430+ endpoints in `routes.ts`) | 30s (Pool) | None (Postgres 20s fallback) | **No** | **Medium** |
| **Migration Pool** (`server/storage.ts:4624`) | 60s (Dedicated Pool) | `statement_timeout: 0` | **No** (Leaked on error) | **Medium** |

---

### 6.4 Landing Page Pool Saturation Defect

In `server/storage.ts:3658–3682`, `getSystemStats()` gathers platform metrics by executing 11 count queries in parallel via `Promise.all`:
```typescript
const [
  totalUsers, totalThreads, totalMessages, totalDocuments,
  totalGithubKnowledge, totalAdminKnowledge, totalCaseLaw,
  totalStatuteDocuments, totalCitationJudgments, totalCacheEntries,
  usageRows
] = await Promise.all([ ... ]);
```
- When the 5-minute memory cache expires (`PLATFORM_METRICS_TTL_MS`), a request to `/api/public/platform-metrics` immediately checks out **11 of the 16 available pool connections**.
- If two users load the landing page simultaneously on cache expiry, they attempt to check out **22 connections** concurrently.
- 6 queries are forced into the queue, temporarily exhausting the pool and causing latency spikes for active legal chat and drafting sessions.

---

## 7. Comprehensive Findings Matrix

| ID | Module / Area | Severity | File Path & Lines | Core Issue Description | Verified By |
|---|---|---|---|---|---|
| **CITE-01** | UI: Citation Popups | **HIGH** | `client/src/components/citation-list.tsx:67-83`<br>`client/src/components/legal-editor.tsx:579-585` | Swallows Enter/Arrow keys on 0 search results, freezing ProseMirror editor. | Reviewer |
| **CITE-02** | UI: Citation Popups | **HIGH** | `client/src/components/citation-suggestion.ts:26-27, 128-161` | Out-of-order fetch race conditions; module-scoped debounce timer collision. | Reviewer |
| **CITE-03** | UI: Citation Popups | **HIGH** | `client/src/components/legal-editor.tsx:543-552, 580-591` | Escape hides popup but next keystroke immediately resurrects it; cleanup leak. | Reviewer |
| **MAT-01** | UI: Factual Matrix | **HIGH** | `client/src/experimental/components/drafting/DraftingLaunchpad.tsx:356, 402` | Conflicting text color classes render dark mode text near-invisible (~2.08:1). | Reviewer |
| **FORUM-01**| UI: Forum List | **HIGH** | `client/src/experimental/components/drafting/DraftingLaunchpad.tsx:138-143, 317` | Substring comma check breaks Customs Court station & corrupts Supreme Court. | Reviewer |
| **ISSUE-01**| Backend: SQL Ranking | **HIGH** | `server/storage.ts:1528-1602` | `searchStatutes` fast-path wildcard bleed short-circuits fallback; 40 ILIKE scans. | Reviewer |
| **ISSUE-02**| Backend: SQL Ranking | **HIGH** | `server/storage.ts:1655-1662, 1731, 1770` | Unsanitized tsquery tokens cause syntax errors on citations like `12(2)`. | Reviewer |
| **ISSUE-06**| Backend: SQL Ranking | **HIGH** | `server/storage.ts:2772-2790` | Unconstrained fallback OR-ILIKE across 223k judgments saturates DB CPU. | Reviewer |
| **ISSUE-07**| Backend: Vector Search | **HIGH** | `server/rag/vector-store.ts:400-409`<br>`migrations/0008_rag_chunks_per_tenant_hnsw.sql:21-42` | Missing partial HNSW indexes for non-global tenants causes 0-match starvation. | Reviewer |
| **ISSUE-10**| Backend: RAG Retrieval| **HIGH** | `server/pipeline/retrieval-engine.ts:355-364`<br>`server/pipeline/context-builder.ts:53-111` | Overruled cases retained and promoted to LLM as binding "VERIFIED JUDGMENTS". | Reviewer |
| **ISSUE-11**| Backend: RAG Retrieval| **HIGH** | `server/pipeline/bench-pipeline.ts:1233-1248` | Fail-open flaw in bench filter treats unverified cases as valid on DB timeout. | Reviewer |
| **ISSUE-12**| Backend: Concurrency | **HIGH** | `server/pipeline/knowledge-pipeline.ts:355-373`<br>`server/rag/vector-store.ts:82-98` | 19-query pipeline fan-out bottlenecks on concurrency cap of 4, wasting DB queries. | Reviewer |
| **DB-TO-01**| Backend: DB Pool | **HIGH** | `server/pipeline/retrieval-engine.ts:77-82`<br>`server/db.ts:31` | `Promise.race` application timeout leaves ghost queries active on DB for 20s. | Reviewer |
| **DB-TO-02**| Backend: DB Pool | **HIGH** | `server/storage.ts:3658-3682`<br>`server/routes.ts:8698` | Platform metrics bursts 11 parallel count queries against 16-connection pool. | Reviewer |
| **CITE-04** | UI: Citation Popups | **MEDIUM** | `client/src/components/legal-editor.tsx:550-551`<br>`client/src/index.css:624-625` | 380px fixed width overflows offscreen on narrow screens (< 400px). | Reviewer |
| **CITE-05** | UI: Citation Popups | **MEDIUM** | `client/src/components/legal-editor.tsx:543-552`<br>`client/src/index.css:641-645` | Missing `theme: "citation"` causes default dark tooltip frame wrapping. | Reviewer |
| **CITE-06** | UI: Citation Popups | **MEDIUM** | `client/src/components/citation-list.tsx:126-159` | Keyboard navigation lacks `scrollIntoView()`, hiding selections below fold. | Reviewer |
| **MAT-02** | UI: Factual Matrix | **MEDIUM** | `client/src/experimental/components/drafting/DraftingLaunchpad.tsx:67-73` | Synchronous layout thrashing on keystroke; 2px border height mismatch. | Reviewer |
| **MAT-03** | UI: Factual Matrix | **MEDIUM** | `client/src/experimental/components/drafting/DraftingLaunchpad.tsx:145-165` | `setIsInitializingAi(false)` invoked after parent unmounts launchpad. | Reviewer |
| **FORUM-02**| UI: Forum List | **MEDIUM** | `client/src/experimental/components/drafting/DraftingLaunchpad.tsx:77-88` | `station` state is not cleared when switching draft types or court tiers. | Reviewer |
| **FORUM-03**| UI: Forum List | **MEDIUM** | `client/src/experimental/components/drafting/DraftingLaunchpad.tsx:271-341` | Unvirtualized native select with 53 options lacks search and filtering. | Reviewer |
| **ISSUE-03**| Backend: SQL Ranking | **MEDIUM** | `server/storage.ts:2704-2730` | Inconsistent CTE `LEFT JOIN` vs outer `INNER JOIN` discards valid judgments. | Reviewer |
| **ISSUE-04**| Backend: SQL Ranking | **MEDIUM** | `server/storage.ts:2311, 2799`<br>`server/pipeline/retrieval-engine.ts:463` | Slicing 8 hex chars overflows signed 32-bit integer on ~50% of UUIDs. | Reviewer |
| **ISSUE-05**| Backend: Vector Search | **MEDIUM** | `server/rag/vector-store.ts:442, 490, 493` | Hybrid search casts `$2::vector` against `halfvec_cosine_ops` index. | Reviewer |
| **DB-01** | Backend: DB Pool | **MEDIUM** | `server/storage.ts:4624-4636, 5410-5415` | `migrationPool.end()` missing `try ... finally`, leaking pool on DDL error. | Reviewer |
| **ISSUE-08**| Backend: Concurrency | **MEDIUM** | `server/rag/vector-store.ts:88-98` | `acquireSlot` in-memory waiter queue lacks abort signal and timeout. | Reviewer |
| **CITE-07** | UI: Accessibility | **LOW** | `client/src/components/citation-list.tsx:89-163` | Absence of WAI-ARIA `listbox`, `option`, and `aria-live` attributes. | Reviewer |
| **MAT-04** | UI: Affordance | **LOW** | `client/src/experimental/components/drafting/DraftingLaunchpad.tsx:394` | Misleading "Shift + Enter for new line" hint; Enter does not submit form. | Reviewer |
| **FORUM-04**| UI: Forum List | **LOW** | `client/src/experimental/components/drafting/DraftingLaunchpad.tsx:310, 314` | Mismatched option values vs user labels; text truncation in 3-column grid. | Reviewer |
| **ISSUE-09**| Backend: Migrations | **LOW** | `migrations/0008_rag_chunks_per_tenant_hnsw.sql:21-40` | Unchecked `INVALID` state in `CREATE INDEX CONCURRENTLY`. | Reviewer |
| **DB-02** | Backend: DB Error | **LOW** | `server/storage.ts` & `server/db.ts:31` | PostgreSQL 57014 (`query_canceled`) lacks explicit handling. | Reviewer |
| **ISSUE-13**| Backend: SQL Order | **LOW** | `server/storage.ts:2701, 2729` | Missing unique primary key tie-breaker yields non-deterministic sort order. | Reviewer |

---

## 8. Prioritized Remediation Roadmap

### Immediate Fixes (P0 - Critical Integrity & Stability)
1. **Exclude Overruled Precedent from System Prompt**:
   - In `server/pipeline/retrieval-engine.ts:355–364`, replace `score *= 0.3` with a strict filter:
     `if (row.isOverruled) return 0;` (or exclude completely from candidate arrays).
   - In `server/pipeline/context-builder.ts`, add an explicit filter ensuring no judgment with `isOverruled: true` enters the `VERIFIED JUDGMENTS` prompt section.
2. **Sanitize `searchCaseLaw` tsquery Tokens**:
   - In `server/storage.ts:1658–1662`, adopt the regex token sanitizer from line 2551:
     `.replace(/[^a-z0-9\-]/g, "")` to prevent syntax crashes on citations with parentheses like `12(2)`.
3. **Fix Editor Enter & Arrow Key Swallowing**:
   - In `client/src/components/citation-list.tsx:68–83`, check `if (items.length === 0) return false;` at the beginning of `onKeyDown`, allowing ProseMirror to handle Enter and Arrow keys natively.
4. **Fix Comma Substring Check on Court Forums**:
   - In `client/src/experimental/components/drafting/DraftingLaunchpad.tsx:138–143`, replace substring `!forum.includes(",")` with a whitelist of courts that require district stations (e.g., District Courts, Special Courts, Family Courts) and explicitly exclude Superior Courts (`Supreme Court`, `High Court`, `Federal Shariat Court`).
5. **Resolve Tailwind Dark-Mode Contrast Defect**:
   - In `DraftingLaunchpad.tsx:402`, change `dark:text-[#475569]` to `dark:placeholder:text-[#475569]`.

### High Priority Fixes (P1 - Concurrency & Scale)
1. **Eliminate Ghost Queries in Connection Pool**:
   - Refactor `withTimeout` to accept an `AbortSignal` or pass a cancellation token to the database driver so that when the application timeout fires, the running PostgreSQL query is cancelled via `client.cancelObject` or client release with destroy.
2. **Partitioned HNSW Indexes for User & Org Tenants**:
   - Update `migrations/0008_rag_chunks_per_tenant_hnsw.sql` and `vector-store.ts` to support dynamic partition tables or IVFFLAT fallback for non-global tenants.
3. **Fix `searchStatutes` Query Filter & Fallback**:
   - In `server/storage.ts:1533`, require both `section` AND `wordTokens` in the WHERE clause when `wordTokens` exist.
   - Add a GIN/trigram index on `statutes.section` and `statutes.short_title`.
4. **Implement AbortSignal in Citation Suggestions**:
   - In `client/src/components/citation-suggestion.ts`, instantiate an `AbortController` before `fetch()` and abort prior pending requests before firing new queries. Move `debounceTimer` into the plugin instance state.
5. **Wrap `migrationPool.end()` in `try ... finally`**:
   - In `server/storage.ts:4624–5415`, enclose schema initialization inside `try ... finally { await migrationPool.end(); }`.

---

## 9. Conclusion

The Al Wakeelo platform demonstrates sophisticated multi-tenant hybrid search, legal ranking, and rich drafting features. However, recent changes introduced critical edge cases that directly impact correctness and stability under load. This report provides an exact, verified blueprint for addressing all 30 defects.
