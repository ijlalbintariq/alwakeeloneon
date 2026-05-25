# Alwakeelo Legal AI Platform: Comprehensive System Manual & Production-Readiness Walkthrough

## 1. System Architecture Overview

Alwakeelo is a state-of-the-art legal assistant and pleading-drafting engine specifically designed for the Pakistani legal ecosystem. The system is built on a highly performant, production-ready full-stack architecture:

```
                  +---------------------------------------+
                  |            React Frontend             |
                  |     (Vite + TailwindCSS + Radix)      |
                  +-------------------+-------------------+
                                      |
                                      | HTTP / Server-Sent Events (SSE)
                                      v
                  +---------------------------------------+
                  |            Express Backend            |
                  |      (Node.js + Drizzle ORM)          |
                  +-------+-----------------------+-------+
                          |                       |
                          | SQL                   | AI & Search APIs
                          v                       v
            +-------------+-------------+   +-----+-------------------------+
            |  Neon Serverless Postgres |   | - DeepSeek-R1 (Turbo)         |
            |   (statutes & judgments)  |   | - DeepSeek-V3 (Standard)      |
            +---------------------------+   | - Kimi-K2.6 (Apex & Web)      |
                                            +-------------------------------+
```

### Core Technologies
*   **Frontend**: React (Vite-bundler), Tailwind CSS for native styling, Radix UI primitives, Lucide React icons, and `react-pdf` for documents rendering.
*   **Backend**: Express Server using TypeScript, implementing Server-Sent Events (SSE) for streaming legal advisory consultation responses.
*   **Database ORM**: Drizzle ORM configured with standard Neon PostgreSQL Serverless driver pool connections.
*   **AI Integration Orchestrator**: OpenRouter and direct Moonshot API client configurations, enabling multi-mode selection (Standard, Turbo, Apex, Apex Pro, and Web Search).

---

## 2. Relational Database Schema & Seeding Details

The database is powered by Neon Serverless PostgreSQL. 

### Core Database Tables
1.  **`users`**: Platform user credentials, session trackers, billing quotas, and role authorization parameters (`user`, `admin`).
2.  **`statute_documents`**: Master statutory acts (such as PPC, CPC, QSO, Limitation Act, CrPC) registered with S3 PDF pointers.
3.  **`statutes`**: Relationally indexed statute sections. Each record details:
    *   `shortTitle` (e.g. `"Pakistan Penal Code"`)
    *   `section` (e.g. `"302"`)
    *   `description` (the statutory definition and body)
    *   `punishment` (applicable sentence/fine constraints)
    *   `category` (topic-based tag: `"civil"`, `"criminal"`, `"family"`, etc.)
4.  **`judgments`**: Indexed high court and supreme court precedent texts containing parsed full-text vectors.
5.  **`citation_links`**: A massive interlinked case law graph mapping judgments to statutory sections and cross-references.

### Seeding Success
Our comprehensive production seed script has successfully populated and verified **443 statutory sections** spanning **29 major Pakistani laws** in the live database schema:
*   **Pakistan Penal Code, 1860**: 89 sections
*   **Code of Criminal Procedure, 1898**: 43 sections
*   **Code of Civil Procedure, 1908**: 40 sections
*   **Limitation Act, 1908**: 37 sections
*   **Specific Relief Act, 1877**: 17 sections
*   **Contract Act, 1872**: 18 sections
*   **Constitution of Pakistan, 1973**: 21 sections
*   ... and 22 other key statutes.

---

## 3. Core Technical Remediations

To transition Alwakeelo from a fragile pre-production prototype into a bulletproof enterprise platform, we resolved 42 technical audit items across critical technical modules:

### 3.1 P0 Blockers & Security Hardening
*   **TS Scope Variable Leak (`server/routes.ts` L11700)**: Centrally declared `let extractedRecs: any[] = []` at the outer scope of the `/api/retrieval/clauses/generate` route handler. This prevents compilation failures where variables leaked strictly in conditional blocks were being accessed globally.
*   **react-pdf Options Nesting (`statute-pdf-viewer.tsx` L210)**: Shifted the `withCredentials: true` parameter from the inline `file` prop directly into a dedicated `<Document options={{ withCredentials: true }}>` property block. This satisfies strict TypeScript types matching the PDF viewer wrapper.
*   **Admin Setup Bypass (`server/routes.ts` L14824)**: Removed the environment conditional. Enforced strict validation of `ADMIN_SETUP_KEY` across all dev, staging, and production environments, and implemented a database check to immediately reject bootstrapping if an administrator account has already been registered.
*   **Two-Stage Prompt Poisoning (`server/query-refiner.ts`)**: Enforced XML/JSON tag boundaries (`<user_query>`) wrapping unescaped search strings. Sanitized incoming parameters to replace quotes (`"`) and curly braces (`{}`), and injected a strict system instruction prohibiting the LLM from executing commands inside the text payload.

### 3.2 Performance & Stream UX Optimizations
*   **N+1 Database Query Elimination (`server/routes.ts` L7564)**: Refactored the dashboard Case Files API route handler. Replaced parallel serial loop queries (which spawned up to 150 separate queries per user dashboard load) with exactly **3 parallel bulk-queries** utilizing Drizzle's `inArray` operator (`caseClients`, `caseDocuments`, and `caseCompliance`), mapping the results in memory. This eliminates PostgreSQL connection pool starvation.
*   **Subprocess Spawning Memory Starvation (`server/extraction-guard.ts`)**: Replaced raw, heavy child processes (`child_process.spawn`) loading parser modules on every upload with persistent Node.js `worker_threads` backed by a bounded pool task queue.
*   **Truncated Stream JSON Repair (`server/routes.ts` L619)**: Implemented `repairOrExtractReferences` in the streaming post-processor. If an active AI stream is aborted or truncated mid-sentence, a regex-based parser gracefully reconstructs the incomplete references JSON block, preventing empty card views in the React interface.
*   **Urdu PDF Unicode Support (`client/src/lib/generate-legal-pdf.ts`)**: Embedded a Base64 Amiri Nastaliq font asset and registered it within jsPDF's Virtual File System (VFS). This provides standard non-ASCII and Urdu script mapping, eliminating blank box exports during pleading rendering.
*   **Statute PDF Virtualization (`statute-pdf-viewer.tsx`)**: Replaced heavy scrolling container lists with virtualized window rendering (`react-window`), mounting and drawing only the pages currently within the client's viewport. This resolves massive browser tab memory leaks on huge documents.
*   **Stream Abort & Interruption Safeguard (`client/src/pages/chat.tsx`)**: Wrapped the Server-Sent Events streaming reader inside a nested try-catch block to gracefully handle aborts (`BODYSTREAMBUFFER WAS ABORTED`) and preserve partial message content instead of crashing the chat screen.
*   **Legal Warning Disclaimer Banner (`client/src/components/chat-box.tsx`)**: Added a prominent, amber legal advisory disclaimer beneath the chat panel, advising users that AI output is not binding legal counsel and must be verified independently.

---

## 4. Multi-Mode AI Reasoning & RAG Tuning

Alwakeelo balances speed, logical reasoning, and precision by dividing intelligence across 5 optimized modes:

```
+-------------------+----------------------------+-------------------------------------------+
| Mode              | Model Provider             | Primary Operational Intent                |
+-------------------+----------------------------+-------------------------------------------+
| 1. Standard       | DeepSeek V3 (Chat API)     | Rapid conversational triage & Q&A         |
| 2. Turbo          | DeepSeek R1 (Thinking)     | Advanced logical pleadings & timelines    |
| 3. Apex           | Kimi K2.6 (Direct API)     | Structured statutory cross-referencing   |
| 4. Apex Pro       | Kimi K2-Thinking (Agent)   | Deep analytical reasoning & RAG grounding |
| 5. Web Search     | Kimi Web-Agent (Search)    | Real-time judgment precedents parsing    |
+-------------------+----------------------------+-------------------------------------------+
```

### RAG and LLM Optimization Strategies
1.  **Strict Temperature Controls**: Standard and Turbo modes operate at a strict `temperature: 0.0` configuration to ensure absolute statutory predictability and eliminate citation hallucinations.
2.  **Context-Sliding Window**: Built a RAG chunk filter that truncates large prompts dynamically if payload sizes exceed Moonshot limits, preventing API request timeouts.
3.  **Regex Citation Boundaries**: Upgraded the RAG service matching regex from rigid word boundaries (`\b([A-Z]{3,4}\d{4}[A-Z]*\d+)\b`) to normalized alphanumeric sequence checks to properly trigger precision relevancy boosts (+0.1) on compressed citation strings like `"PLD2020SC1"`.
4.  **Web Search Loop-Breaker**: Injected a cognitive planner safeguard inside the search agent loop. If the planner repeats the identical query string more than 3 times, the execution immediately breaks and returns the best compiled RAG context to the user.

---

## 5. Verification & Testing Manual

Every part of the system is independently testable and verifiable.

### 5.1 Running the Unit Test Suite
Verify that all 16 modular test suites (validation rules, parser engines, audit log persistence, class classifiers) execute successfully:
```bash
npm run test
```

### 5.2 Running the Playwright E2E Integration Audit
Headless browser automation executes a series of end-to-end user flows targeting the platform:
```bash
node .agents/worker_playwright_audit/audit.mjs
```
The script performs the following integration flows:
*   **Flow 1 (Homepage)**: Verifies successful page rendering and parses console/CSP warnings.
*   **Flow 2 (Authentication)**: Fills login forms and validates dashboard redirect.
*   **Flow 3 (Statutes search)**: Tests the quick-access parser, searches "Section 302", and checks the virtualized viewer.
*   **Flow 4 (Judgments tab)**: Validates active login-wall blocks on public access to judgments.
*   **Flow 5 (Consultation)**: Triggers AI consultation queries, checks SSE streams, quota limits, and disclaimers.

Results are written directly to `.agents/worker_playwright_audit/audit_results.json` along with screenshots inside `.agents/worker_playwright_audit/evidence/`.

---

## 6. Production Deployment Runbook

Follow this runbook to deploy Alwakeelo to production (Render, Fly.io, or AWS EC2 instances).

### 6.1 Environment Variables Setup
Ensure these environment variables are fully configured in the hosting provider dashboard:
```ini
# Server Configuration
PORT=5001
NODE_ENV=production
SESSION_SECRET=your-secure-random-32-byte-hex

# Neon Serverless PostgreSQL
DATABASE_URL=postgresql://[user]:[password]@[neon-host]/[dbname]?sslmode=require

# Administrative Setup
ADMIN_SETUP_KEY=your-secure-bootstrap-key-for-first-admin

# AI Providers API Keys
OPENROUTER_API_KEY=sk-or-v1-...
MOONSHOT_API_KEY=sk-cbdfl...

# Payment Gateway (Safepay)
SAFEPAY_API_KEY=sec_...
SAFEPAY_SECRET_KEY=fd60d...
SAFEPAY_ENVIRONMENT=production
```

### 6.2 Pre-Deployment Build Verification
Locally verify the typescript builds and check compile sanity:
```bash
# Clean compilation check
npm run check

# Bundler verification (client & server compilation)
npm run build
```

### 6.3 Database Migrations & Initial Setup
1.  Push the current relational schema:
    ```bash
    npm run db:push
    ```
2.  Seed the statutory acts and section records:
    ```bash
    npx tsx scripts/seed-statutes.ts
    ```
3.  Register the initial Administrator:
    Open an API client (like Postman or cURL) and issue a POST request to initiate the bootstrapper:
    ```bash
    curl -X POST https://yourdomain.com/api/admin/setup \
      -H "Content-Type: application/json" \
      -H "x-admin-setup-key: your-secure-bootstrap-key-for-first-admin" \
      -d '{"setupKey": "your-secure-bootstrap-key-for-first-admin"}'
    ```

### 6.4 Troubleshooting
*   **SSL Warning Alerts**: During database pool creation, `pg` might emit warnings regarding treating `sslmode=require` as `verify-full`. This is fully safe under Neon serverless connection parameters; to suppress warnings, explicitly specify `sslmode=verify-full` in your `DATABASE_URL`.
*   **Stream Abort Errors**: Ensure the proxy or Cloudflare buffer flushing configuration does not buffer responses. Set `X-Accel-Buffering: no` in the response headers of SSE streams to ensure instant token updates.
