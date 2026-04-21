# Al Wakeelo Engineering Handoff Guide

Last updated: 2026-04-16

This document is a practical handoff for developers joining the project. It reflects the current implementation in this repository.

---

## RECENT SESSION UPDATES (April 16, 2026)

### 18.1) User Activity Tracking - `/api/activity/summary`

**Status:** ✅ Deployed (Commit: `fdd72fb`)

New endpoint `GET /api/activity/summary` aggregates real-time user activity for the dashboard:

```typescript
// Returns:
{
  lastActivity: {
    threadId: number,
    threadTitle: string,
    updatedAt: ISO8601,
    displayDate: string,   // "16 Apr"
    displayTime: string    // "10:30"
  },
  recentDocuments: Array<{ id, title, createdAt }>,
  documentCount: number,
  workspaceFocus: string[] // Dynamic suggestions
}
```

**Files:**
- Backend: `server/routes.ts` (line ~8191, new endpoint after `/api/usage`)
- Frontend: `client/src/pages/dashboard.tsx` (queries this endpoint)
- Invalidation: `client/src/pages/chat.tsx` + `legal-drafting.tsx` (invalidate on message/document save)

**How it works:**
1. User sends message → `threads.updatedAt` updated in DB (existing behavior)
2. Dashboard queries `/api/activity/summary`
3. Returns latest thread + recent documents + context-aware suggestions
4. "Last Activity Reminder" displays latest thread with timestamp
5. "Workspace Focus" shows dynamic suggestions based on activity state

**Key implementation detail:**
- Uses existing `thread.updatedAt` field (no schema changes)
- Fallback statute suggestions based on RAG citations if no threads exist
- Frontend invalidates cache when messages sent or documents saved

### 18.2) Citation & Statute References Display

**Status:** ✅ Deployed (Commit: `b21d982`)

**Problem:** Legal Citations and Relevant Statutes sections were empty despite AI responses citing laws/judgments.

**Root cause:** System prompt required structured references block but AI wasn't consistently outputting it.

**Solution:**

System prompt now **critically enforces** structured references requirement:
```
```references
{"laws":[{"name":"Full Statute Name, Year","section":"Section X","description":"..."}],"judgments":[{"citation":"PLD 2024 Supreme Court 123","court":"Supreme Court of Pakistan","description":"..."}]}
```
```

Location: `server/routes.ts`, function `getLegalSystemPrompt()` (line ~5206, section at line ~5280)

Changes:
- Made requirement MANDATORY with emphasis
- Added explicit examples
- Instructions: Every statute/judgment cited in response must appear in block
- Emphasized user dependency on these reference cards

**Fallback extraction** (`client/src/pages/chat.tsx`, `extractInlineReferences`):
- Enhanced regex patterns to catch more Pakistani legal formats
  - Added: SCMR, PLJ, CLD, LHC, IHC, SHC formats
  - Improved statute pattern matching
- Deduplication to prevent duplicates
- Safety net: If AI forgets structured block, fallback still extracts most citations from response text

### 18.3) UI Accessibility & Semantic HTML

**Status:** ✅ Deployed (Commit: `a1575b8`)

**Accessibility improvements** (`client/src/pages/chat.tsx`):
- **Converted 4 div elements to semantic `<button>` elements:**
  - Citation cards (lines ~855, 864)
  - Statute cards (lines ~894, 908)
  - Added `text-left w-full` classes to preserve layout

- **Added keyboard support (Enter key):**
  - `onKeyDown={(e) => e.key === 'Enter' && window.open(..., '_blank')}`
  - All citation/statute cards now keyboard-navigable

- **Fixed bookmark button race condition:**
  - Added `bookmarkMutation.isPending` check in onClick
  - Added `disabled={bookmarkMutation.isPending}` attribute
  - Added `disabled:opacity-50 disabled:cursor-not-allowed` styles
  - Prevents rapid-click duplicate submissions

- **Improved error handling:**
  - Clipboard operations now log errors instead of silently failing
  - Share URL copy failures now show in error UI

- **File upload UX:**
  - Added message when reaching 5-file limit: "Maximum 5 files reached. Remove a file to add more."

### 18.4) Statute Search Dropdown Visibility

**Status:** ✅ Deployed (Commit: `5a32845`)

**Problem:** Search results dropdown was hidden behind UI and unusable.

**Root cause:** Parent section had `overflow-hidden` which clipped the absolutely-positioned dropdown (even with `z-50`).

**Solution:**
- Removed `overflow-hidden` from section (line 122 in `statute-search.tsx`)
- Rounded corners and gradient background preserved
- Dropdown now renders with `z-50` above all content

---

## 1) Product Summary

Al Wakeelo is a Pakistani legal web app with:
- AI chat and drafting modes.
- Citation and statute search.
- Case law and statute document libraries.
- Knowledge Vault uploads with document classification.
- RAG over user documents.
- Admin panel for users, content, security, and analytics.
- Organization/team workspace (Pro/Enterprise).

## 2) Tech Stack

- Frontend: React 18 + TypeScript + Vite + Wouter + TanStack Query + Tailwind/shadcn.
- Backend: Express + TypeScript.
- Database: PostgreSQL + Drizzle ORM.
- Session auth: `express-session` + `connect-pg-simple` (memory fallback if DB session store not available).
- Storage: Neon/Postgres (primary text), Cloudflare R2 (raw files + large extracted text, optional).
- AI providers:
- Groq (standard chat + Whisper transcription).
- DeepSeek (turbo chat + turbo transcription).
- Moonshot/Kimi (Apex chat/transcription).
- OpenRouter (fallback in some paths, optional).
- Local AI/ML:
- Local RAG embeddings (`semantic` local transformers or `hashing` mode).
- Optional local whisper.cpp transcription fallback.
- Optional OCR with `tesseract` + `pdftoppm`.

## 3) Repository Structure

Main directories:

- `client/` SPA frontend.
- `server/` API, AI routing, upload pipelines, security, RAG, OCR.
- `shared/` Drizzle schema + shared API route contracts.
- `tests/` unit and e2e tests.
- `docs/` architecture and implementation docs.
- `script/` build scripts.

Important backend files:

- `server/index.ts`: app bootstrap, security headers, health endpoints, error handler, port fallback.
- `server/routes.ts`: primary API surface.
- `server/storage.ts`: DB access layer.
- `server/document-classifier.ts`: rule + ML domain classification.
- `server/extraction-guard.ts`: extraction queue, worker isolation option, OCR/parse guards.
- `server/r2-storage.ts`: signed R2 PUT/GET/DELETE.
- `server/rag/*`: chunking, embeddings, vector store, retrieval.
- `server/replit_integrations/auth/*`: auth/session routes.

Important frontend files:

- `client/src/App.tsx`: route tree + auth gating + lazy page loading.
- `client/src/components/app-shell.tsx`: sidebar/workspace layout.
- `client/src/pages/chat.tsx`: core AI chat UI, modes, attachments, transcription, RAG ask.
- `client/src/pages/knowledge-vault.tsx`: upload-driven domains/sources + metadata backfill.
- `client/src/pages/admin-panel.tsx`: admin workflows and dashboards.

## 4) Runtime Architecture

### 4.1 Request Path

1. Request enters Express in `server/index.ts`.
2. Security middleware applies headers and same-origin CSRF checks for unsafe `/api` methods.
3. Route handlers in `server/routes.ts` enforce auth, tier, rate/usage limits, and validations.
4. Data access goes through `server/storage.ts`.
5. Responses are JSON and logged with latency.

### 4.2 Startup Behavior

On startup:
- `.env` is loaded (`server/load-env.ts`).
- invalid proxy envs are sanitized (`server/proxy-env.ts`).
- DB health is evaluated (`server/db.ts`).
- OCR availability check runs.
- search/security indexes are ensured if DB is available.
- admin seed may run if enabled.
- auth routes + app routes are registered.
- legal seed + GitHub sync are triggered if DB is available.

### 4.3 Local Port Behavior

Server prefers `PORT` (default 5000) and auto-falls back to `DEV_PORT_FALLBACK` (default 5001) in local/dev if 5000 is occupied.

## 5) Data Model Overview

Core tables (see `shared/schema.ts`):

- `users`, `sessions`, `password_reset_tokens`.
- `threads`, `messages`.
- `documents` with metadata fields:
- `source_type`, `mime_type`, `file_extension`
- `detected_domain`, `detected_domain_label`
- `classification_method` (`rule|ml|fallback`)
- `classification_confidence` (0-100 in DB; API returns 0-1).
- `document_files`, `admin_knowledge_files`, `statute_document_files` for R2 file metadata.
- `statutes`, `case_law`, citation platform tables:
- `law_journals`, `courts_ref`, `judgments`, `citation_links`, `unresolved_citations`.
- `github_knowledge`, `admin_knowledge`, `statute_documents`, `org_knowledge`.
- `query_cache`, `usage_tracking`, `saved_judgments`.
- org tables: `organizations`, `org_members`, `org_invites`.

RAG tables are created directly through SQL (`server/rag/vector-store.ts`):
- `rag_documents`.
- `rag_chunks` with `VECTOR(384)` embeddings and hybrid search indices.

## 6) AI Architecture and Fallbacks

### 6.1 Chat Routing

Standard route:
- Primary: Groq (`chatWithGroq`).
- Fallback: OpenRouter if configured.

Turbo route:
- Primary: DeepSeek (`chatWithDeepSeek`).
- Fallback: Groq.

Apex route (`/api/apex/chat`):
- Primary: Moonshot Kimi (`apex`, `apex-pro`, `apex-agent` all map to Kimi config variants).
- Fallback: DeepSeek Pro (`deepseek-reasoner`) if Kimi path fails.

### 6.2 Transcription Routing (`/api/ai/transcribe`)

Standard mode:
- Primary: Groq Whisper (`whisper-large-v3-turbo`).
- Fallback: local whisper.cpp (if configured).

Turbo mode:
- Primary: DeepSeek audio.
- Fallback 1: Groq Whisper.
- Fallback 2: local whisper.cpp.

Apex mode:
- Primary: Kimi audio (Moonshot).
- Fallback 1: Groq Whisper.
- Fallback 2: local whisper.cpp.

### 6.3 Retrieval and Drafting Hybrid

- Clause suggestion (`/api/retrieval/clauses/suggest`):
- Retrieval-first from clause library.
- AI fallback only when retrieval confidence is below threshold.
- Clause generation (`/api/retrieval/clauses/generate`):
- Retrieval-first.
- AI fallback when low confidence/fallback state.

### 6.4 Non-LLM ML

Document classification:
- Rule-first keyword scoring.
- ML fallback via external service (`ML_SERVICE_URL`) in `server/ml/ml-client.ts`.
- Hard fallback to `other`.

## 7) RAG Architecture

Main endpoints:
- `POST /api/rag/index-document`
- `POST /api/rag/ask`
- `DELETE /api/rag/documents/:documentId/vectors` (admin)

Pipeline:
1. Load document content.
2. If `extractedTextKey` exists, fetch full text from R2.
3. Clean text (`rag/text-cleaner.ts`).
4. Chunk at 700 tokens with 120 overlap (`rag/chunker.ts`).
5. Embed chunks locally (`semantic` local model or `hashing` fallback).
6. Store vectors/chunks in pgvector tables.
7. Retrieval uses hybrid scoring:
- Vector score + keyword score.
- Weighted by `RAG_VECTOR_WEIGHT` and `RAG_KEYWORD_WEIGHT`.
8. `/api/rag/ask` enforces context-grounded answers and returns citations metadata.

Cost note:
- Embeddings are local and do not consume external embedding API tokens.
- Final answer generation still uses chat model calls.

## 8) Upload and Extraction Pipeline

### 8.1 Guardrails

Two queues:
- Upload queue in `routes.ts`.
- Extraction queue in `extraction-guard.ts`.

Controls:
- Concurrency and max pending caps.
- File count and size caps by endpoint type.
- Timeout wrappers for extraction.
- Optional worker-process extraction isolation (`EXTRACTION_WORKER_ENABLED=true`).

### 8.2 Security Checks

Before accepting files:
- extension + binary signature checks.
- malware scan via `clamscan` (optional/required/off modes).
- explicit type allowlists per endpoint.

### 8.3 OCR Behavior

PDF extraction flow:
1. Parse text with `unpdf`.
2. If empty, OCR fallback via Tesseract + `pdftoppm`.
3. If OCR disabled/unavailable and PDF is image-only, extraction fails with actionable message.

### 8.4 Storage Behavior

For upload targets (`documents`, `admin_knowledge`, `statute_documents`):
- Text content is stored in DB.
- If content is large, DB gets truncated marker and full extracted text goes to R2 (`extractedTextKey`).
- Original binary can be uploaded to R2 with metadata rows in `*_files` tables.
- If R2 fails, code falls back to DB-only behavior (non-fatal).

## 9) Frontend Architecture

Routing:
- Wouter route map in `client/src/App.tsx`.
- Auth-aware route gating and redirects.
- Lazy loading of page modules.

State/Data:
- TanStack Query for server state and caching.
- `apiRequest` wrapper handles non-2xx errors and JSON error messages.

Key UI modules:
- `chat.tsx`: model mode selector, attachments, transcription, RAG toggle path.
- `knowledge-vault.tsx`:
- dynamic legal domains and source counts from `/api/documents/insights`.
- metadata backfill loop `/api/documents/backfill-metadata`.
- table filters powered by server metadata.
- `admin-panel.tsx`:
- paginated admin endpoints (`limit`/`offset`) to reduce memory.
- user, knowledge, case law, statute library operations.

Theme:
- Dark mode is hard-set by `use-theme.tsx`.

## 10) API Surface (High-Level)

User/auth:
- `/api/auth/register|login|logout|user|google/*|forgot-password|reset-password`

Core workspace:
- `/api/threads`, `/api/threads/:id/messages`, sharing endpoints.
- `/api/documents`, `/api/documents/upload`, `/api/documents/insights`, `/api/documents/backfill-metadata`.
- `/api/bookmarks`, `/api/search-history`, `/api/usage`.

AI:
- `/api/ai/chat`, `/api/ai/transcribe`, `/api/ai/search-judgments`, `/api/ai/search-statutes`, `/api/ai/summarize`, `/api/ai/brief`, `/api/ai/judgment-summary`.
- `/api/apex/models`, `/api/apex/chat`.
- `/api/rag/*`.
- `/api/retrieval/clauses/*`.

Legal search/citation:
- `/api/journals`, `/api/citation-search`, `/api/judgments/:id`, `/api/judgments`.
- `/api/case-law/search`, `/api/case-law/lookup`, `/api/case-law/:id/source`.
- `/api/statute-documents/search`, `/api/statute-documents/:id`, `/api/statute-lookup`.

Admin:
- `/api/admin/*` for users, bans, audit/security, stats, cost analytics, queue stats, content libraries.

Organization:
- `/api/org`, `/api/org/:id/*`, invite/member/knowledge routes.

Health:
- `/health`, `/health/db`, `/health/ocr`.

## 11) Environment Variables

Required for production baseline:
- `NODE_ENV=production`
- `DATABASE_URL`
- `SESSION_SECRET`

AI keys:
- `GROQ_API_KEY`
- `DEEPSEEK_API_KEY` (optional but needed for turbo path)
- `MOONSHOT_API_KEY` (optional but needed for Apex path)
- `OPENROUTER_API_KEY` (optional fallback path)

File/object storage:
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_REGION`, `R2_PUBLIC_BASE_URL` (optional)

OCR:
- `TESSERACT_OCR_LANG`, `PDF_OCR_MAX_PAGES`, `PDF_OCR_DPI`, `PDF_OCR_TIMEOUT_MS`

Local transcription fallback:
- `WHISPER_BIN_PATH`, `WHISPER_MODEL_PATH`, `WHISPER_CPP_THREADS`, `WHISPER_CPP_LANGUAGE`

RAG tuning:
- `RAG_EMBEDDING_PROVIDER`, `RAG_SEMANTIC_MODEL`, `RAG_EMBEDDING_DIM`
- `RAG_MIN_SCORE`, `RAG_TOP_K`, `RAG_MAX_CONTEXT_CHUNKS`, `RAG_FORCE_CONTEXT`
- `RAG_VECTOR_WEIGHT`, `RAG_KEYWORD_WEIGHT`, `RAG_INDEX_BATCH_SIZE`, `RAG_MAX_CHUNKS_PER_DOC`

Memory/safety controls:
- `DOCUMENT_UPLOAD_MAX_FILE_MB`, `DOCUMENT_UPLOAD_MAX_FILES`
- `ADMIN_UPLOAD_MAX_FILE_MB`, `ADMIN_UPLOAD_MAX_FILES`
- `EXTRACTION_TIMEOUT_MS`
- `UPLOAD_QUEUE_CONCURRENCY`, `UPLOAD_QUEUE_MAX_PENDING`
- `EXTRACTION_QUEUE_CONCURRENCY`, `EXTRACTION_QUEUE_MAX_PENDING`, `EXTRACTION_WORKER_ENABLED`
- `AUTO_EXTRACT_MAX_QUEUE_SIZE`, `AUTO_EXTRACT_MAX_ITEM_TEXT_CHARS`, `AUTO_EXTRACT_MAX_TOTAL_QUEUE_CHARS`

## 12) Local Development Runbook

1. Install dependencies:
- `npm ci`

2. Configure `.env` from `.env.example`.

3. Push schema:
- `npm run db:push`

4. Run dev server:
- `npm run dev`

5. If `5000` busy, app may auto-bind `5001`.

6. Health checks:
- `curl -i http://localhost:5000/health`
- `curl -i http://localhost:5000/health/db`
- `curl -i http://localhost:5000/health/ocr`

7. Build/type checks:
- `npm run check`
- `npm run build`

## 13) Deployment Notes (Render)

Current Render config:
- Native Node runtime.
- Build installs OCR packages (`tesseract-ocr`, `poppler-utils`) then builds app.
- Start command `node dist/index.cjs`.
- Health check path `/health`.

If deployment logs show missing tables:
- Run schema sync against the production DB (`npm run db:push` with production `DATABASE_URL`).
- Missing relation errors like `org_members` or `courts_ref` indicate schema not applied.

If deployment logs show R2 `NoSuchBucket`:
- Verify `R2_BUCKET` is exact existing bucket name.
- Keep `R2_ENDPOINT` as account endpoint format:
- `https://<account_id>.r2.cloudflarestorage.com`
- Ensure key pair belongs to same account and has bucket permissions.

## 14) Testing Strategy

Commands:
- Unit: `npm test`
- E2E: `npm run test:e2e`

Current tests cover:
- citation extractor logic.
- document classifier rule/fallback.
- malware scanning behavior.
- security governance (ban/unban + audit).
- e2e security flow (requires admin credentials + DB).

Manual QA checklist:
- `tests/UAT-CHECKLIST.md`.

## 15) Operational Troubleshooting

### High memory / restarts

Check:
- extraction/upload queue saturation.
- large batch uploads.
- semantic embedding mode in low-memory instances.

Mitigations:
- lower upload and extraction concurrency.
- enable extraction worker isolation.
- keep `RAG_EMBEDDING_PROVIDER=hashing` on small instances.
- reduce `RAG_INDEX_BATCH_SIZE`.

### OCR not working

Symptoms:
- startup says OCR disabled.
- PDF upload says searchable PDF required.

Fix:
- install `tesseract` and `pdftoppm` on runtime.
- verify `/health/ocr` returns 200.

### Malware scanner warnings

`FILE_SCAN_MODE=optional` logs warnings if scanner missing but allows uploads.
Set:
- `FILE_SCAN_MODE=required` to enforce hard blocking when scanner unavailable.
- `FILE_SCAN_MODE=off` to disable scanning.

### 401 responses during curl checks

Admin and protected endpoints require authenticated session cookie.
Use login first and pass cookie jar in subsequent calls.

## 16) Recent Critical Fixes

### Citation Persistence Fix (2026-04-21)

**Issue:** Case law and statute citations were disappearing from Al Wakeelo chat responses after initial render.

**Root Cause:** The Al Wakeelo module had `strictCitations: true` enabled, which enforced that only citations with `citationRole: "primary"` and valid linked sources would pass the `enforceInternalCaseCitationIntegrity()` post-processing check. Secondary citations and citations missing metadata were being removed from responses.

**Solution:** Changed `server/ai-module-profiles.ts` line 49:
```typescript
// Before:
strictCitations: true,

// After:
strictCitations: false,
```

**Impact:**
- Citations no longer stripped from responses by overly strict enforcement
- Any database-backed citation (primary OR cited) now persists
- System prompt no longer restricts AI to "use only PRIMARY citations"
- Tested with PLD 2020 SC 456, SCMR 2022 123, and statute references - all persist correctly

**Files Modified:**
- `server/ai-module-profiles.ts` (line 49)

## 17) Known Gaps and Technical Debt

- `server/routes.ts` is very large and should be split by domain modules.
- OpenRouter fallback remains in code; if strategy changes, remove provider and fallback branches consistently.
- `server/replit_integrations/audio|chat|image` modules exist but are currently not wired into route registration.
- Older docs (`README.md` and legacy guide files) may not fully reflect latest provider routing and guardrails.

## 18) New Developer Onboarding Checklist

Day 1:
- Run app locally, verify auth and health endpoints.
- Read `server/index.ts`, `server/routes.ts`, `server/storage.ts`, `shared/schema.ts`.
- Trace one request end-to-end: chat, upload, and admin upload.

Day 2:
- Validate AI provider keys and fallback behavior in non-prod.
- Index one document with RAG and test `/api/rag/ask`.
- Run unit tests and one e2e flow.

Day 3:
- Review memory guard env values for your target instance size.
- Review security events, audit logs, and ban/unban workflow.
- Align Render env configuration with this guide.

