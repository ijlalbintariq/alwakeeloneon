# Original User Request

## 2026-08-29T00:02:18Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Full Agent Team

Comprehensive audit, testing, and bug-fixing of all Al Wakeelo experimental preview modules to ensure end-to-end functionality, dual database connectivity (Postgres & Vector), and production-readiness through automated testing.

Working directory: /Users/macbook/Downloads/Alwakeelo
Integrity mode: development

## Requirements

### R1. Comprehensive Module Audit & Remediation
Audit all UI components and logic flows within the experimental preview application (`client/src/experimental/*`). Identify and resolve any broken features, layout anomalies, or failing interactions to ensure a polished user experience.

### R2. End-to-End Database Integration
Ensure all experimental modules are fully wired to the backend architecture. Migrate any temporary `localStorage` or mock states to the live PostgreSQL database (via Drizzle ORM). Ensure that AI-driven features correctly interact with the vector database for RAG retrieval.

### R3. Automated Verification Suite
Develop an automated test suite to objectively verify the core workflows of the experimental application. The tests must confirm that the modules are stable and production-ready.

## Acceptance Criteria

### Audit & Remediation
- [ ] All pages under the `/preview/*` routes render cleanly without React hydration errors or console warnings.
- [ ] Core module functions (e.g., Document Analyzer deep scan, Chat Inspector, Drafting Studio) execute completely without silent failures.

### Database Connectivity
- [ ] Experimental modules perform real CRUD operations against the Postgres database (e.g., saving bookmarks, retrieving case files, managing organizations).
- [ ] RAG workflows successfully extract and query the vector database for legal context.

### Verification
- [ ] The newly created automated test suite executes successfully and passes, confirming the stability of the audited modules.

## 2026-09-10T16:52:17Z

Build Phase 3: Judicial Bench Simulator, a multi-turn adversarial RAG system where the AI acts as both Opposing Counsel (finding hostile case law) and a strict Judge (grilling the user on their legal grounds). The system will dynamically adjust its persona and search strategy based on the Court Level, Case Nature, and Proceeding Stage.

Working directory: /Users/macbook/Downloads/Alwakeelo
Integrity mode: development

## Requirements

### R1. State Management Database
Implement schema updates in `shared/schema.ts` to track session configuration, hidden attack plans, and scoring. This includes adding `bench_sessions` and `bench_messages` tables.

### R2. Adversarial Retrieval Pipeline
Create `server/pipeline/bench-pipeline.ts` with logic for generating adversarial queries, running vector searches that strictly filter out overruled cases, and synthesizing a JSON counter-brief.

### R3. API Route & Streaming
Implement the `POST /api/ai/bench-simulator` route to handle multi-turn session rounds. This route must check round status, construct a dynamic system prompt using the attack plan, stream the Judge's hostile question back to the client, and synchronously trigger an LLM evaluation to update the score.

### R4. Frontend UI
Build an immersive chat interface at `client/src/pages/bench-simulator.tsx`. This must include a Pre-session Modal (to select Court Level, Case Nature, and Stage), a Live Score HUD, a formal chat interface, and a Post-Session Report.

## Acceptance Criteria

### Verification & Testing
- [ ] An automated test script (`test-bench-rag.ts`) successfully simulates an argument and verifies that the RAG returns valid hostile cases without returning overruled ones.
- [ ] The API successfully streams the AI Judge's response and updates the Live Score synchronously in the database.
- [ ] The frontend HUD accurately reflects the Live Score and Current Round updates after each user message without race conditions.
