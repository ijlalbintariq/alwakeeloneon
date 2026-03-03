# Citation Platform Implementation Backlog

This backlog is aligned to the current app architecture:
- Backend: Express + TypeScript
- DB: PostgreSQL + Drizzle ORM
- Frontend: React + React Query + Wouter

It maps your 10-prompt target into implementable files and route contracts.

## 1) Database Layer (Prompt 1)

### 1.1 Modify existing schema
- **File:** `shared/schema.ts`
- **Add tables:**
  - `lawJournals`
    - `id serial pk`
    - `code text not null unique` (`PLD`, `SCMR`, etc.)
    - `name text not null`
    - `isActive boolean default true`
    - `createdAt timestamp default now`
  - `courtsRef`
    - `id serial pk`
    - `code text not null unique` (`SC`, `LHC`, `SHC`, etc.)
    - `name text not null`
    - `level text not null` (`supreme`, `high`, `special`, `district`)
    - `isActive boolean default true`
    - `createdAt timestamp default now`
  - `judgments`
    - `id uuid pk default gen_random_uuid()`
    - `year integer not null`
    - `journalId integer not null fk -> lawJournals.id`
    - `page integer not null`
    - `citationString text not null`
    - `title text not null`
    - `petitioner text`
    - `respondent text`
    - `courtId integer fk -> courtsRef.id`
    - `courtNameSnapshot text`
    - `decisionDate timestamp`
    - `headnotes text`
    - `fullText text not null`
    - `pdfUrl text`
    - `isActive boolean default true`
    - `createdAt timestamp default now`
    - `updatedAt timestamp default now`
  - `citationLinks`
    - `id serial pk`
    - `sourceJudgmentId uuid not null fk -> judgments.id`
    - `targetJudgmentId uuid not null fk -> judgments.id`
    - `citationType text not null` (`relied_upon|referred_to|distinguished|overruled`)
    - `contextExcerpt text`
    - `citationText text not null`
    - `startOffset integer`
    - `createdAt timestamp default now`
  - `unresolvedCitations`
    - `id serial pk`
    - `sourceJudgmentId uuid not null fk -> judgments.id`
    - `rawCitation text not null`
    - `year integer`
    - `journalCode text`
    - `page integer`
    - `contextExcerpt text`
    - `status text not null default 'pending'` (`pending|resolved|ignored`)
    - `createdAt timestamp default now`

### 1.2 Add constraints and indexes
- **File:** `server/storage.ts` (`ensureSearchIndexes`) and DB migration SQL
- **Required constraints/indexes:**
  - `unique (year, journal_id, page)` on `judgments`
  - `unique (source_judgment_id, target_judgment_id, citation_type, citation_text)` on `citation_links`
  - `gin` index on `to_tsvector('english', coalesce(title,'') || ' ' || coalesce(headnotes,'') || ' ' || coalesce(full_text,''))`
  - btree on `(year, journal_id, page)` and `(decision_date)`

### 1.3 Seed reference data
- **New file:** `server/seed-citation-reference.ts`
- **Function:** `seedCitationReferenceData()`
- Seed at least 8 journals:
  - `PLD`, `SCMR`, `PLJ`, `MLD`, `CLC`, `PCRLJ`, `YLR`, `CLD`, plus optional `PTD`, `NLR`, `PLC`


## 2) Storage API Layer (Prompt 2 backend foundation)

### 2.1 Extend storage interface
- **File:** `server/storage.ts`
- **Add types:**
  - `CitationSearchParams`
  - `JudgmentDetailDTO`
  - `CitationLinkDTO`
- **Add interface methods:**
  - `getLawJournals(): Promise<Array<{id:number; code:string; name:string}>>`
  - `getCourts(): Promise<Array<{id:number; code:string; name:string}>>`
  - `searchJudgmentsByCitation(params: { year:number; journalCode:string; page:number; court?:string }): Promise<...>`
  - `getJudgmentById(id: string): Promise<...>`
  - `createJudgment(input: ...): Promise<...>`
  - `createCitationLinks(links: ...[]): Promise<number>`
  - `createUnresolvedCitations(rows: ...[]): Promise<number>`
  - `getCitationsMade(judgmentId: string): Promise<CitationLinkDTO[]>`
  - `getCitedBy(judgmentId: string): Promise<CitationLinkDTO[]>`
  - `listUnresolvedCitations(limit?: number): Promise<...>`
  - `resolveUnresolvedCitation(id: number, targetJudgmentId: string, citationType: string): Promise<void>`


## 3) Citation Extraction Service (Prompt 3)

### 3.1 New service
- **New file:** `server/services/citation-extractor.ts`
- **Class:** `CitationExtractor`
- **Methods:**
  - `extractFromText(text: string, judgmentId: string): ExtractedCitation[]`
  - `resolveCitations(citations: ExtractedCitation[]): Promise<ResolvedCitation[]>`
  - `processJudgment(judgmentId: string, text: string): Promise<{totalFound:number; resolved:number; unresolved:number}>`
  - `inferCitationType(contextText: string): "relied_upon" | "referred_to" | "distinguished" | "overruled"`
- **Dependencies:** `storage`
- **Regex support journals:**
  - `PLD|SCMR|PLJ|MLD|CLC|PCrLJ|YLR|NLR|CLD|PTD|PLC`

### 3.2 Reuse existing NLP extraction where helpful
- **File:** `server/auto-extract-caselaw.ts`
- Keep existing bulk extraction for case-law table.
- Add optional helper export for normalized citation parsing to avoid regex duplication.


## 4) REST API Routes (Prompt 2)

### 4.1 Add API route contracts
- **File:** `shared/routes.ts`
- **Add route definitions:**
  - `GET /api/journals`
  - `GET /api/citation-search`
  - `GET /api/judgments/:id`
  - `POST /api/judgments` (admin)
  - `GET /api/admin/citations/unresolved`
  - `POST /api/admin/citations/:id/resolve`

### 4.2 Implement handlers
- **File:** `server/routes.ts`
- **New handlers (exact):**
  - `app.get("/api/journals", ...)`
  - `app.get("/api/citation-search", ...)`
    - Query: `year`, `journal`, `page`, `court?`
    - Validate: year between 1947 and `currentYear + 1`
  - `app.get("/api/judgments/:id", ...)`
    - Return judgment + `citations.made` + `citations.received`
  - `app.post("/api/judgments", ...)`
    - Admin-only
    - Create judgment + run `CitationExtractor.processJudgment(...)`

### 4.3 Request/response signatures
- **GET `/api/journals` response**
  - `Array<{ id:number; code:string; name:string }>`
- **GET `/api/citation-search` response**
  - `Array<{ id:string; citation:string; title:string; court:string; decisionDate:string|null; url:string|null }>`
- **GET `/api/judgments/:id` response**
  - `{ id, citation, title, petitioner, respondent, court, decisionDate, headnotes, fullText, pdfUrl, citations: { made: CitationLinkDTO[]; received: CitationLinkDTO[] } }`
- **POST `/api/judgments` response**
  - `{ judgmentId:string; citation:string; extraction:{ totalFound:number; resolved:number; unresolved:number } }`


## 5) Frontend: Citation Search (Prompt 4)

### 5.1 New page component
- **New file:** `client/src/pages/citation-search.tsx`
- **Component:** `CitationSearchPage`
- **UI:**
  - Year dropdown
  - Journal dropdown (from `/api/journals`)
  - Page input
  - Optional court filter
  - Live preview: `"{year} {journal} {page}"`

### 5.2 Routing
- **File:** `client/src/App.tsx`
- **Add route:**
  - `/citation-search` -> `CitationSearchPage`


## 6) Frontend: Judgment Detail (Prompt 5)

### 6.1 New page
- **New file:** `client/src/pages/judgment-detail.tsx`
- **Route:** `/judgment/:id`
- **Behavior:**
  - fetch `GET /api/judgments/:id`
  - render:
    - header + parties
    - cases cited
    - cited in
    - full text
  - badges by citation type
  - warning for `overruled`

### 6.2 Optional shared UI helpers
- **New file:** `client/src/components/citation-type-badge.tsx`
- **New file:** `client/src/components/judgment-citation-card.tsx`


## 7) Full-text Search + Suggest (Prompt 6)

### 7.1 Service integration
- **New files:**
  - `server/search/elasticsearch-client.ts`
  - `server/search/judgment-indexer.ts`
  - `server/search/hybrid-search.ts`
- **Dependencies to add:**
  - `@elastic/elasticsearch`

### 7.2 New API endpoints
- **File:** `server/routes.ts`
- **Add:**
  - `POST /api/search`
  - `GET /api/suggest?q=...`
- **Behavior:**
  - If query matches citation regex -> call citation-search logic
  - Else -> Elasticsearch query with boosts `title^3`, `headnotes^2`, `fullText^1`

### 7.3 Infra config
- **New file:** `docker-compose.yml`
  - app, postgres, elasticsearch, redis


## 8) Upload + OCR Pipeline (Prompt 7)

### 8.1 Upload endpoint
- **File:** `server/routes.ts`
- **Add endpoint:**
  - `POST /api/upload-judgment`
  - multipart + metadata (`citation_year`, `citation_journal`, `citation_page`, `court`)

### 8.2 Job processing
- **New files:**
  - `server/jobs/queue.ts`
  - `server/jobs/judgment-processing-worker.ts`
  - `server/services/ocr-service.ts`
  - `server/services/judgment-structure-parser.ts`
- **Dependencies (pick one queue path):**
  - `bullmq` + `ioredis` (recommended)

### 8.3 Storage
- **New file:** `server/services/file-storage.ts`
- Local-first with pluggable S3 adapter

### 8.4 Status endpoint
- **File:** `server/routes.ts`
- **Add:**
  - `GET /api/upload-jobs/:jobId`


## 9) Admin Enhancements (Prompt 8)

### 9.1 Extend current admin panel
- **File:** `client/src/pages/admin-panel.tsx`
- **Add tabs/sections:**
  - Journals CRUD
  - Courts CRUD
  - Unresolved citations queue
  - Manual citation linker
  - Citation type editor

### 9.2 Backend admin routes
- **File:** `server/routes.ts`
- **Add:**
  - `GET/POST/PATCH/DELETE /api/admin/journals`
  - `GET/POST/PATCH/DELETE /api/admin/courts`
  - `GET /api/admin/citations/unresolved`
  - `POST /api/admin/citations/:id/resolve`
  - `POST /api/admin/judgments/:id/reprocess-citations`


## 10) Testing (Prompt 9)

### 10.1 Unit tests
- **New file:** `tests/unit/citation-extractor.test.ts`
  - regex extraction
  - duplicate removal
  - type inference

### 10.2 API tests
- **New file:** `tests/e2e/citation-api.test.ts`
  - `/api/citation-search`
  - `/api/judgments/:id`

### 10.3 Integration tests
- **New file:** `tests/e2e/upload-judgment-flow.test.ts`
  - upload -> process -> links created


## 11) DevOps (Prompt 10)

### 11.1 Container and compose
- **Update:** `Dockerfile` (multi-stage)
- **Add:** `docker-compose.yml`

### 11.2 Health + readiness
- **File:** `server/index.ts`
- **Add endpoint:**
  - `GET /ready`

### 11.3 CI/CD
- **Add files:**
  - `.github/workflows/ci.yml`
  - `.github/workflows/deploy.yml`

### 11.4 Observability/security
- **New files:**
  - `server/observability/logger.ts` (Winston)
  - `server/observability/metrics.ts` (Prometheus client)
  - `server/observability/sentry.ts` (optional)
- Existing session auth can remain; JWT migration is optional and out-of-scope unless required.


## 12) Delivery Sequence (Practical)

### Phase A (2-3 days)
1. Schema + storage methods
2. `/api/journals`, `/api/citation-search`, `/api/judgments/:id`
3. New citation search page + judgment detail page

### Phase B (2-4 days)
1. `CitationExtractor` + link persistence
2. Admin unresolved citation tooling
3. Reprocess endpoint

### Phase C (3-5 days)
1. OCR/job pipeline
2. Elasticsearch + suggest + hybrid routing
3. CI/CD + readiness + metrics


## 13) Route Signature Summary

- `GET /api/journals`
- `GET /api/citation-search?year={int}&journal={code}&page={int}&court={optional}`
- `GET /api/judgments/:id`
- `POST /api/judgments` (admin)
- `POST /api/upload-judgment` (admin or privileged)
- `GET /api/upload-jobs/:jobId`
- `POST /api/search`
- `GET /api/suggest?q=...`
- `GET /api/admin/citations/unresolved`
- `POST /api/admin/citations/:id/resolve`
- `POST /api/admin/judgments/:id/reprocess-citations`


## 14) Notes on Compatibility

- Current app already has:
  - case-law search (`/api/case-law/search`)
  - citation lookup (`/api/case-law/lookup`)
  - case-law extraction helper (`server/auto-extract-caselaw.ts`)
- These should remain during migration.
- Introduce new citation platform endpoints in parallel, then switch frontend progressively.
