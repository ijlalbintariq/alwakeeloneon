# Experimental Preview Codebase Architecture
**Generated via Graphify Cross-Check**

## Overview
The `client/src/experimental` directory constitutes a parallel, next-generation UI layer for the Al Wakeelo AI platform, code-named "Chambers Forest Green". It operates independently of the legacy production UI (`client/src/pages`), utilizing isolated components, routing, and design system tokens.

## Structural Map

### 1. Application Routing & Shell
*   **`AppPreviewRouter.tsx`**: The main entry point that injects the `/preview/*` routes into the main Vite application without colliding with production routes.
*   **`PreviewShell.tsx`**: The authenticated application wrapper providing the global sidebar (`PreviewSidebar.tsx`), header (`PreviewHeader.tsx`), command palette, and layout state.
*   **`public/PublicPreviewShell.tsx`**: The unauthenticated wrapper for public pages (Landing, Pricing, Login, About).
*   **`styles/preview-theme.css`**: The isolated design system enforcing the `#105B38` (Forest Green) primary palette.

### 2. Core Functional Modules

#### A. Case Law & Judgment Research
**Path:** `pages/PreviewJudgments.tsx`
*   **`DirectoryBrowser.tsx`**: Implements the main keyword search interface using PostgreSQL full-text search. Contains dynamic empty states that auto-fetch the latest pre-indexed case law if no query is provided.
*   **`PinpointCitationParser.tsx`**: The "Smart Parser" component containing regular expressions (`parsePakistaniCitation`) to recognize formal reported journal citations. Dynamically queries `/api/journals` for the Field Matrix dropdown.
*   **`JudgmentReader.tsx`**: A distraction-free legal reading interface featuring multiple themes (defaulting to "cream" / Parchment), table of contents generation, and inline AI interaction.
*   **`PrecedentGraph.tsx`**: Renders the bi-directional Precedent Citation Network using interactive nodes.
*   **`JudgmentAiSidecar.tsx`**: The Al Wakeelo AI panel tailored specifically to the context of the open judgment, using `callTurboAI` (Gemini 3.0 Flash via OpenRouter) for instant answers.
*   **`lib/judgmentApiClient.ts`**: Contains `hydrateCitationGraph` which regex-scans judgment text on the fly to detect and map outgoing precedent citations.

#### B. Statutory Law & Section Lookup
**Path:** `pages/PreviewStatutes.tsx`
*   **`statutes/ActSelector.tsx` & `statutes/CleanStatuteViewer.tsx`**: Provides an indexed, collapsible viewer for Pakistani Codes, Acts, and Ordinances.
*   **`lib/statuteSearchEngine.ts` & `lib/actSectionLoader.ts`**: Handles client-side navigation and deep-linking into specific statutory sections.

#### C. AI Drafting & Documentation
**Path:** `pages/PreviewDrafting.tsx` & `PreviewContractDrafting.tsx`
*   **`drafting/AIDraftingAssistantPanel.tsx`**: The core AI editor.
*   **`drafting/StyleMemoryDraftingPanel.tsx`**: Integrates the "Style-Memory RAG" pattern to replicate a specific advocate's drafting voice.
*   **`drafting/StatutoryClauseLibrary.tsx`**: A right-side panel for injecting standard Pakistani legal clauses directly into the draft.

#### D. Organization & Chambers Management
**Path:** `pages/PreviewCaseFiles.tsx` & `PreviewDashboard.tsx`
*   **`cases/CreateCaseModal.tsx` & `cases/CaseDossierOverview.tsx`**: Digital case files incorporating parties, hearing schedules, and related documents.
*   **`dashboard/QuickLaunchpad.tsx` & `dashboard/CourtDocketAgenda.tsx`**: The advocate's daily operational view.

### 3. Verification & API Integrity Check

During this session, several critical integrations between the UI components and the backend server (`server/storage.ts` & `server/routes.ts`) were mapped and verified:
1.  **Citation Cleaning Script:** Executed `fix_citations.ts` directly on PostgreSQL to normalize dirty web-scraped citations (e.g., `2026 SHC 515001` to `Const. P. 11/2026 (SHC)`).
2.  **TSVector Token Sanitation:** Validated that slashes (`/`) and hyphens (`-`) are correctly tokenized by PostgreSQL `to_tsvector` and safely passed through `to_tsquery` in `server/storage.ts` (`searchCaseLaw`).
3.  **Live Journal Hydration:** Replaced hardcoded journal arrays in `PinpointCitationParser.tsx` with dynamic fetches to `/api/journals` to ensure exact parity with production.
4.  **Zero-Query Pre-indexing:** Rebuilt the SQL `WHERE` clause generator in `searchCaseLaw` and `searchJudgmentsByKeywords` to gracefully fallback to `orderBy(desc(year))` when the query is empty, enabling the instant "latest case law" feed.
5.  **Precedent Graph TypeScript Alignment:** Fixed the object mappings in `hydrateCitationGraph` to perfectly match the `PrecedentCitationItem` interface (`citationType`, `linkedCitation`, `contextExcerpt`), fixing the 0-nodes rendering bug.

### 4. Data Mocking Policy
A comprehensive audit verified that the Experimental Preview adheres to the strict **"Zero Mock Data"** rule. All dashboards, search results, and statistics are dynamically populated via PostgreSQL and the Drizzle ORM.

***
*End of Graphify Codebase Cross-Check Report.*
