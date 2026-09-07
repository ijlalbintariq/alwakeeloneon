# Project: Al Wakeelo Experimental Preview Suite

## Architecture
Al Wakeelo Experimental Preview is an enterprise Pakistani legal intelligence workstation suite featuring 14 core litigation modules, 3 chamber administration hubs, and 12 public commercial screens.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     Client Interface: client/src/experimental/                  │
│                     Router: client/src/experimental/AppPreviewRouter.tsx        │
│  - PreviewDocumentAnalyzer (O.7 R.11 CPC, S.24 SRA, Limitation Art. 113) (DONE) │
│  - PreviewChat & ChatInspectorDrawer (Multi-Model, Citation Graph, Grounding)   │
│  - PreviewDrafting & PreviewContractDrafting (TipTap Legal Canvas, Autosave) (DONE)│
│  - PreviewCaseFiles, PreviewDailyDiary, PreviewBookmarks, PreviewHistory, etc.  │
│  - PreviewOrganization (Chamber Activity Logs to PostgreSQL) (DONE)             │
└───────────────────────┬─────────────────────────────────┬───────────────────────┘
                        │ HTTP / REST                     │ React Query / Fetch
                        ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Express Backend: server/                               │
│  - server/index.ts (Rate limiters, CORS, security headers)                      │
│  - server/routes.ts (Core REST API endpoints)                                   │
│  - server/routes/causelist-routes.ts & calendar-routes.ts                       │
│  - server/replit_integrations/auth/routes.ts (Session authentication)           │
└───────────────────────┬─────────────────────────────────┬───────────────────────┘
                        │ Drizzle ORM                     │ pgvector / ONNX / Voyage
                        ▼                                 ▼
┌────────────────────────────────────────┐ ┌──────────────────────────────────────┐
│  Relational Database: PostgreSQL       │ │  Vector Database: pgvector           │
│  - shared/schema.ts                    │ │  - server/rag/vector-store.ts        │
│  - users, threads, messages            │ │  - rag_documents, rag_chunks        │
│  - case_files, diary_entries           │ │  - style_memory_chunks               │
│  - bookmarks, search_history           │ │  - Parent-Child chunking + Hybrid RAG│
│  - document_scans, scan_findings (DONE)│ │  - Local ONNX (384d) & Voyage Law    │
│  - org_activity_logs (DONE)            │ │                                      │
│  - legal_drafts (DONE)                 │ │                                      │
└────────────────────────────────────────┘ └──────────────────────────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Document Analyzer Persistence | Save/retrieve document scan sessions, text, and procedural defect findings to PostgreSQL (`document_scans`, `scan_findings`). | M1 | ORIGINAL_REQUEST §R2 |
| 2 | Chamber Activity Log Persistence | Save/retrieve organization activity logs to PostgreSQL (`org_activity_logs`). | M1 | ORIGINAL_REQUEST §R2 |
| 3 | Legal Drafting Cloud Autosave | Save/retrieve legal contract drafting sessions to PostgreSQL (`legal_drafts`). | M1 | ORIGINAL_REQUEST §R2 |
| 4 | Search History Deletion Fix | Enable live PostgreSQL record deletion for `DELETE /api/search-history/:id`. | M1 | ORIGINAL_REQUEST §R2 |
| 5 | Document Analyzer UI Integration | Migrate `PreviewDocumentAnalyzer.tsx` from `localStorage` to live REST APIs. | M2 | ORIGINAL_REQUEST §R1 |
| 6 | Organization UI Integration | Migrate `PreviewOrganization.tsx` activity log from `localStorage` to live REST APIs. | M2 | ORIGINAL_REQUEST §R1 |
| 7 | Contract & Legal Drafting UI Integration | Migrate `PreviewContractDrafting.tsx` & `PreviewDrafting.tsx` autosave from `localStorage` to live REST APIs. | M2 | ORIGINAL_REQUEST §R1 |
| 8 | UI Layout & Console Warning Audit | Audit and resolve any rendering glitches, broken modals, or hydration issues across all `/preview/*` routes. | M2 | ORIGINAL_REQUEST §R1 |
| 9 | Unit Test Suite Fixture Repair | Resolve legacy `seedJudgmentsData.js` missing module imports in unit tests. | M3 | ORIGINAL_REQUEST §R3 |
| 10 | 4-Tier Automated Verification Suite | Implement comprehensive 4-Tier automated test suite (Feature coverage, Boundary cases, Integration, Real-world legal workflows). | M3 | ORIGINAL_REQUEST §R3 |
| 11 | E2E Regression & Integrity Hardening | Verify 100% test pass rate across all test suites with native test runner. | M3 | ORIGINAL_REQUEST §R3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend & Dual DB Wiring | Add `document_scans`, `scan_findings`, `org_activity_logs`, `legal_drafts` to Drizzle schema & PostgreSQL; wire REST CRUD endpoints in `server/routes.ts`; fix search history delete endpoint. | none | DONE |
| M2 | UI Remediation & State Migration | Replace all `localStorage` state in `PreviewDocumentAnalyzer`, `PreviewOrganization`, `PreviewContractDrafting`, and `PreviewDrafting` with live React Query / API calls; audit all 56 preview routes for clean rendering and error-free interactions. | M1 | DONE |
| M3 | Test Repair & Automated Verification Suite | Fix legacy `seedJudgmentsData.js` import errors in unit tests; create master 4-tier E2E verification suite (`tests/e2e/preview-master-verification.test.ts`); verify all tests pass with 100% success rate. | M2 | DONE |

## Interface Contracts

### 1. Document Analyzer API (Implemented & Verified)
- `POST /api/document-analyzer/scans`
  - Body: `{ title: string, documentType: string, text: string, summary?: string, overallRisk?: string, findings: Array<{ pillar: string, category: string, severity: string, issue: string, statuteRef?: string, recommendation: string, rawSnippet?: string }> }`
  - Returns: `201 Created` with `{ scan: DocumentScan, findings: ScanFinding[] }`
- `GET /api/document-analyzer/scans`
  - Returns: `200 OK` with `DocumentScan[]`
- `GET /api/document-analyzer/scans/:id`
  - Returns: `200 OK` with `{ scan: DocumentScan, findings: ScanFinding[] }`
- `DELETE /api/document-analyzer/scans/:id`
  - Returns: `204 No Content`

### 2. Organization Activity Logs API (Implemented & Verified)
- `GET /api/org/:id/activity`
  - Returns: `200 OK` with `OrgActivityLog[]`
- `POST /api/org/:id/activity`
  - Body: `{ action: string, details?: string, actorId?: number, actorName?: string, category?: string }`
  - Returns: `201 Created` with `OrgActivityLog`

### 3. Legal Drafts API (Implemented & Verified)
- `GET /api/drafts`
  - Returns: `200 OK` with `LegalDraft[]`
- `GET /api/drafts/:id`
  - Returns: `200 OK` with `LegalDraft`
- `POST /api/drafts`
  - Body: `{ title: string, templateType?: string, content: string, status?: string, metadata?: any }`
  - Returns: `201 Created` with `LegalDraft`
- `PATCH /api/drafts/:id`
  - Body: `{ title?: string, content?: string, status?: string, metadata?: any }`
  - Returns: `200 OK` with `LegalDraft`
- `DELETE /api/drafts/:id`
  - Returns: `204 No Content`

### 4. Search History API (Implemented & Verified)
- `DELETE /api/search-history/:id`
  - Deletes row from PostgreSQL `search_history` where `id = :id AND userId = req.user.id`. Returns `204 No Content`.

## Code Layout
- `shared/schema.ts`: Drizzle ORM PostgreSQL schema models & TypeScript types
- `server/routes.ts`: Server Express API routes & handlers
- `client/src/experimental/pages/*`: Experimental preview UI pages & components (Migrated to live DB APIs)
- `client/src/experimental/lib/*`: Client API clients & utilities
- `tests/unit/*` & `tests/e2e/*`: Unit and E2E automated test suites (Owned by M3 Worker / Test Writer)
