<p align="center">
  <img src="client/public/logo.svg" alt="Al Wakeelo Logo" width="80" height="80" />
</p>

<h1 align="center">Alwakeelo AI</h1>

<p align="center">
  <strong>Pakistan's First Open-Source Legal AI Platform</strong><br/>
  Search 600,000+ judgments · AI legal chat · Draft petitions & contracts · Case management
</p>

<p align="center">
  <a href="https://www.alwakeelo.com">Website</a> ·
  <a href="https://www.linkedin.com/company/al-wakeelo">LinkedIn</a> ·
  <a href="https://www.alwakeelo.com/blog">Legal Guides</a> ·
  <a href="https://www.alwakeelo.com/contact">Contact</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white" alt="Express 5" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" alt="Vite 7" />
  <img src="https://img.shields.io/badge/Drizzle_ORM-0.45-C5F74F?logo=drizzle&logoColor=black" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

---

## What is Alwakeelo AI?

Alwakeelo AI is a full-stack legal workspace built for Pakistani advocates, law chambers, and legal professionals. It combines retrieval-augmented generation (RAG) with Pakistan's largest digital judgment database to deliver AI responses grounded in verified case law — no hallucinations, no made-up citations.

> *"Research case law, draft petitions and contracts, and generate client-ready legal documents in minutes with Alwakeelo AI, fine-tuned for Pakistani legal practice."*

---

## Features

Alwakeelo ships with 12 core modules:

### 💬 AI Legal Chat
Consult with an AI legal advisor trained on Pakistani law. Get strategy and next-step guidance fast.

### 👑 Al Wakeelo Engine
Use the main legal AI workspace with grounded responses, references, and practical next-step guidance.

### 🔍 Judgment Search
Find relevant Pakistani case law with quick citation-focused search and contextual summaries.

### 🔗 Citation Search
Search directly by year, journal, and page to locate precise judgments and linked details quickly.

### 📚 Statute Lookup
Navigate Pakistani statutes and sections with plain-language legal explanations.

### 📝 Legal Drafting
Prepare petitions, notices, applications, and legal replies with structured templates, clause-ready sections, and style-consistent drafting support.

### 🧠 Style-Memory RAG
Train AI on your uploads, drafts, and accepted edits so output follows your legal style and preferred language.

### 📋 Contract Drafting
Generate client-ready contracts with structured clause sets, risk score breakdown, redline suggestions, and cleaner final drafts for negotiation or execution.

### 📄 Case Documents
Upload, review, and organize matter-specific documents with faster legal analysis support.

### 📖 Knowledge Vault
Maintain private user documents and global admin legal resources for retrieval-grounded outputs.

### 👥 Organization Workspace
Support chamber and team workflows with shared access controls and collaboration-ready structure.

### 🎙️ Audio Transcription
Convert legal voice notes and recorded audio into text for research, drafting, and case preparation.

### Additional Case & Calendar Management Features

#### 📁 Case Management
Organize cases by type (criminal, civil, family, constitutional, tax, corporate, banking, labor, property). Track clients/parties with CNIC and contact details, manage 11 compliance types (hearings, filing deadlines, limitation dates, letter of authority, conflict checks, etc.), and link uploaded documents to specific cases.

#### 📅 Daily Diary
Hearing calendar with priority levels, outcomes, next-date tracking, and automated email digests (daily/weekly via Resend). Timezone-aware scheduling (Asia/Karachi default).

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18.3 | UI framework |
| TypeScript | 5.6 | Type safety |
| Vite | 7.3 | Build tool & dev server |
| Tailwind CSS | 3.4 | Utility-first styling |
| Radix UI | — | 20+ accessible component primitives |
| TanStack Query | 5.60 | Server state management & caching |
| TipTap | — | Rich text editor (13 extensions) |
| Wouter | 3.3 | Lightweight client-side routing |
| Framer Motion | 11.18 | Animations |
| Recharts | 2.15 | Data visualization |
| react-pdf | 10.4 | In-browser PDF viewing |
| react-window | 2.2 | Virtualized lists |
| cmdk | 1.1 | Command palette (⌘K) |
| Capacitor | 8.3 | Android native app |
| jsPDF | 4.2 | Client-side PDF generation |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Express | 5.0 | HTTP server |
| PostgreSQL | 16+ | Primary database + pgvector |
| Drizzle ORM | 0.45 | Type-safe queries + Zod validation |
| OpenAI SDK | 6.21 | AI provider client (DeepSeek, OpenRouter, Apex) |
| @xenova/transformers | 2.17 | Local ML embeddings (384-dim multilingual) |
| Passport | 0.7 | Authentication (email/password + Google OAuth) |
| openid-client | 6.8 | Google OpenID Connect |
| Resend | 6.9 | Transactional email |
| Safepay | 0.3 | Pakistani payment gateway (PKR) |
| Cloudflare R2 | — | S3-compatible object storage |
| Multer | 2.0 | File upload handling |
| Tesseract OCR | — | Local OCR (English + Urdu) |
| OCR.space | — | Cloud OCR fallback |
| mammoth | 1.11 | DOCX → text extraction |
| unpdf | 1.4 | PDF text extraction |
| docx | 9.6 | DOCX file generation |
| ws | 8.18 | WebSocket support |

### DevDependencies

| Technology | Version | Purpose |
|---|---|---|
| drizzle-kit | 0.31 | Database migrations |
| esbuild | 0.25 | Server bundling |
| Playwright | 1.59 | E2E testing |
| jsdom | 29.1 | Unit testing (DOM) |
| PostCSS + Autoprefixer | — | CSS processing |
| @tailwindcss/typography | 0.5 | Prose styling |

---

## AI Architecture

### Multi-Provider Fallback Chain

```
User Query
    ↓
Intent Classification → Complexity Detection → Domain Detection
    ↓
Knowledge Retrieval (RAG)
    ├── Case law index (600K+ judgments)
    ├── Statute index (50+ statutes)
    ├── Admin knowledge base
    ├── User documents
    └── Style memory (personalization)
    ↓
AI Generation (with fallback chain)
    ↓
Citation Verification → Strip unverified citations
    ↓
Response to user (with clickable, verified citations)
```

### AI Providers & Models

| Mode | Provider | Model ID | Access |
|------|----------|----------|--------|
| **Standard** | OpenRouter → DeepSeek | `google/gemini-3-flash-preview` → `deepseek-v4-flash` | All tiers |
| **Turbo** | OpenRouter (Kimi) → OpenRouter (Gemini) → DeepSeek Pro/R1 | `moonshotai/kimi-k2.5` (via OpenRouter conceptually) → `google/gemini-3-flash-preview` → DeepSeek Pro/R1 | Pro+ |
| **Apex** | OpenRouter (Apex Pro/Agent) | Claude 3.5 Sonnet (`anthropic/claude-3.5-sonnet`) | Chamber+ |
| **Fallback / Audio** | Moonshot AI (Kimi) | `kimi-k2.5` / `kimi-k2.6` (via `MOONSHOT_API_KEY`) | Chamber+ |

The AI router uses a **race-with-deadline** pattern — if the primary provider doesn't emit a first token within the SLA timeout (30s), it automatically falls back to the next provider in the chain. Streaming and non-streaming fallback paths are handled separately.

#### ⚠️ Core Routing & Integration Notes:
- **Direct Moonshot Integration**: In the actual code implementation (`server/moonshot.ts`), Kimi K2.5 is integrated directly using `MOONSHOT_API_KEY` (pointing to `https://api.moonshot.ai/v1`) rather than OpenRouter.
- **Fallback Chain Configuration**: In the current codebase version, `DEFAULT_TURBO_CHAIN` in `server/ai-router.ts` is configured as `["kimi", "gemini"]`. The DeepSeek Pro/R1 final fallback represents the planned logical routing layer.

The **V2 AI Router** is enabled for `al-wakeelo` (chat), `draft` (legal drafting), and `contract-drafting` modules.

### RAG Pipeline

| Component | Provider / Technology | Details |
|-----------|------------------------|---------|
| **Intent Classifier** | Custom Rule + AI | Query complexity, domain detection, follow-up detection |
| **Query Rewriter** | AI | Reformulates queries for better retrieval |
| **RAG Embeddings** | **Voyage AI** (Primary) or Xenova | **Voyage Law 2** (`voyage-law-2`, 1024 dims) or local `MiniLM-L12` (384 dims) |
| **Reranking** | **Voyage Reranker** | **Voyage Rerank 2** (`rerank-2`) for document scoring |
| **Vector Store** | pgvector | PostgreSQL vectorized storage |
| **Chunker** | Custom sliding-window | Optimizes context window coverage |

---

## Database

45 tables across PostgreSQL with pgvector extension:

| Domain | Tables | Highlights |
|--------|--------|------------|
| **Auth & Sessions** | 4 | Users, sessions (pg-backed), password reset, email verification |
| **Legal Research** | 8 | Judgments (tsvector FTS), case_law, citation_links, unresolved_citations, statutes, statute_documents, law_journals, courts_ref |
| **AI Chat** | 3 | Threads, messages, query_cache |
| **Documents & Files** | 4 | Documents with auto-classification, R2 file metadata |
| **Knowledge (RAG)** | 4 | Admin knowledge, GitHub-synced, org-level, file storage |
| **Style Memory** | 4 | Settings, samples, chunks (pgvector embeddings), events |
| **Case Management** | 5 | Case files, clients/parties, compliance (11 types), notes, diary entries |
| **Organizations** | 3 | Orgs, members (owner/admin/member roles), email invites |
| **Payments** | 1 | Safepay payment records (PKR) |
| **Analytics** | 4 | Usage tracking, AI output quality log, search history, bookmarks |
| **Lead Generation** | 3 | Visitor sessions, case leads, funnel events |
| **Notifications** | 1 | Per-user email digest preferences (daily/weekly) |

---

## Subscription Tiers

| Tier | Monthly (PKR) | AI Actions | Modes | OCR Pages | Users |
|------|--------------|------------|-------|-----------|-------|
| **Free** | 0 | 12 | Standard | 100 | 1 |
| **Standard** | 500 | 120 | Standard | 250 | 1 |
| **Pro** ⭐ | 1,000 | 350 | Standard + Turbo | 500 | 1 |
| **Chamber** | 4,500 | 1,200 (pooled) | All modes + Apex | 1,500 | 3 |
| **Enterprise** | 50,000 | 30,000 | All modes + priority | Custom | Custom |

Billing cycles: Monthly · Quarterly (10% off) · Yearly (20% off)

---

## Courts & Law Reports

**Courts:** Supreme Court of Pakistan · Lahore High Court · Sindh High Court · Peshawar High Court · Islamabad High Court · Balochistan High Court · Federal Shariat Court

**Law Reports:** PLD · SCMR · YLR · MLD · CLC · CLD · PCrLJ

---

## SEO Infrastructure

130,000+ indexable pages with enterprise-grade server-side SEO:

- **Server-side meta injection** — unique `<title>`, `<meta description>`, canonical, OG/Twitter tags per route via `seo-meta.ts`
- **Pre-render blocks** — visible HTML with judgment text, headnotes, court metadata for crawlers
- **Dynamic sitemap** — paginated XML sitemaps (10K URLs/page), ordered by `decisionDate DESC`
- **Schema.org** — CourtCase, Legislation, BlogPosting, Organization, LegalService, Dataset, WebSite, SoftwareApplication JSON-LD
- **IndexNow** — real-time Bing/Yandex/Seznam/Naver notification
- **Google Indexing API** — direct URL submission
- **Proper 404s** — HTTP 404 for non-existent judgments (prevents soft 404s)
- **Legacy redirects** — 301s for old URLs (`/judgment-search` → `/judgments`)

---

## Security

- CSRF protection (origin/referer validation on mutating requests)
- Content Security Policy (CSP) with strict directives
- Rate limiting (auth, AI, global API — IP-based)
- bcrypt password hashing
- CAPTCHA (Cloudflare Turnstile + Google reCAPTCHA fallback)
- Optional single-IP session enforcement
- User ban system with admin audit logging
- File upload scanning
- HTTPS enforcement + HSTS in production
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, `CORP` headers

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ with pgvector extension
- Tesseract OCR + poppler-utils (optional, for local OCR)

### Installation

```bash
# Clone the repository
git clone https://github.com/ijlalbintariq/alwakeeloneon.git
cd alwakeeloneon

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL, API keys, etc.

# Push database schema
npm run db:push

# Start development server
npm run dev
```

### Key Environment Variables

| Variable | Required / Optional | Description |
|----------|---------------------|-------------|
| `DATABASE_URL` | ✅ Required | PostgreSQL connection string (with pgvector) |
| `SESSION_SECRET` | ✅ Required | Express session secret |
| `DEEPSEEK_API_KEY` | ✅ Required | Primary AI provider (DeepSeek v4) |
| `MOONSHOT_API_KEY` | Optional (Required if using Kimi/Moonshot) | API key for direct Moonshot/Kimi integration (points to `https://api.moonshot.ai/v1`) |
| `OPENROUTER_API_KEY` | Recommended | Fallback AI + Apex mode (Claude Sonnet 5, Kimi K2.5, Gemini 3 Flash) |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID for login |
| `RESEND_API_KEY` | Optional | Transactional email provider API key (via Resend) |
| `RESEND_FROM_EMAIL` | Optional | The sender email address for Resend notifications |
| `SAFEPAY_API_KEY` | Optional | Public key for Safepay payment gateway integration (PKR checkout session) |
| `SAFEPAY_SECRET_KEY` | Optional | Secret key for Safepay payment gateway operations |
| `SAFEPAY_ENVIRONMENT` | Optional | Environment for Safepay (`sandbox` or `production`) |
| `SAFEPAY_WEBHOOK_SECRET` | Optional | Webhook verification secret for Safepay payment notifications |
| `R2_ACCOUNT_ID` | Optional | Cloudflare R2 Account ID for S3-compatible storage |
| `R2_ACCESS_KEY_ID` | Optional | Cloudflare R2 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | Optional | Cloudflare R2 Secret Access Key |
| `R2_BUCKET` | Optional | Cloudflare R2 Bucket name |
| `R2_ENDPOINT` | Optional | Cloudflare R2 endpoint URL |
| `R2_REGION` | Optional | Cloudflare R2 region (e.g. `auto`) |
| `R2_PUBLIC_BASE_URL` | Optional | Public CDN or base URL mapping to Cloudflare R2 |
| `GOOGLE_INDEXING_CREDENTIALS` | Optional | Google Indexing API JSON credentials for service account URL submission |
| `INDEXNOW_KEY` | Optional | Key for IndexNow real-time Bing/Yandex search indexing notification |
| `OCRSPACE_API_KEY` | Optional | Cloud OCR.space API key for PDF/image OCR fallback |
| `CAPTCHA_ENFORCED` | Optional | Set to `true` to enable CAPTCHA on auth forms |
| `TURNSTILE_SECRET_KEY` | Optional | Cloudflare Turnstile CAPTCHA secret key |
| `RECAPTCHA_SECRET_KEY` | Optional | Google reCAPTCHA fallback secret key |

### Docker

```bash
docker build -t alwakeelo-ai .
docker run -p 5000:5000 --env-file .env alwakeelo-ai
```

The Dockerfile uses `node:20-bookworm-slim` and installs `tesseract-ocr` (English + Urdu), `poppler-utils`, and `ca-certificates`.

### Production

```bash
npm run build    # Builds client (Vite) + server (esbuild), 1.5GB memory limit
npm start        # Runs node dist/index.cjs
```

### NPM Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start development server (tsx) |
| `npm run build` | Production build |
| `npm start` | Production server |
| `npm run check` | TypeScript type checking |
| `npm run db:push` | Push Drizzle schema to database |
| `npm test` | Unit tests |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run reindex:admin-caselaw` | Reindex case law RAG vectors |
| `npm run reindex:statutes` | Reindex statute RAG vectors |

---

## Project Structure

```
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── pages/           # 41 page components
│   │   ├── components/      # 21 shared components + ui/
│   │   ├── hooks/           # Custom React hooks
│   │   └── lib/             # Utilities
│   ├── public/              # Static assets, PWA manifest
│   └── index.html           # SPA shell with schema.org JSON-LD
├── server/                  # Express 5 backend
│   ├── routes.ts            # API routes (906KB monolith)
│   ├── storage.ts           # Data access layer (220KB)
│   ├── pipeline/            # AI intent classification & retrieval
│   ├── rag/                 # RAG service, vector store, embeddings
│   ├── style-memory/        # Style learning system (11 files)
│   ├── retrieval/           # Clause library, TOC parser
│   ├── services/            # Citation extractor, DOCX generator, Google indexing
│   ├── middleware/          # Rate limiting
│   ├── ai-router.ts         # Multi-provider AI with fallback chains
│   ├── deepseek-ai.ts       # DeepSeek v4-flash / v4-pro
│   ├── openrouter-ai.ts     # OpenRouter (Gemini 3 Flash)
│   ├── apex-ai.ts           # Apex (Claude Sonnet 5)
│   ├── static.ts            # Static serving + SSR SEO injection
│   ├── seo-meta.ts          # Per-route meta tag generation
│   ├── sitemap.ts           # Dynamic XML sitemap
│   ├── indexnow.ts          # Real-time search engine notification
│   ├── safepay.ts           # Payment processing (PKR)
│   ├── email.ts             # Transactional email (Resend)
│   ├── ocr.ts               # Local Tesseract OCR
│   ├── cloud-ocr.ts         # Cloud OCR.space
│   └── r2-storage.ts        # Cloudflare R2
├── shared/                  # Shared code (client + server)
│   ├── schema.ts            # Drizzle ORM schema (45 tables)
│   ├── blog-data.ts         # Blog articles (125KB, 19 articles)
│   └── models/              # Auth models
├── Dockerfile               # Production container
├── render.yaml              # Render.com deployment config
├── drizzle.config.ts        # Drizzle migration config
└── vite.config.ts           # Vite build config
```

---

## Deployment

Deployed on [Render](https://render.com) via Docker:

- **Plan**: Starter
- **Health check**: `/health`
- **Auto-deploy**: enabled
- **Database**: PostgreSQL (Neon or Render Postgres)
- **File storage**: Cloudflare R2
- **Email**: Resend
- **Payments**: Safepay (Pakistani gateway)

---

## Blog & Legal Guides

19 comprehensive legal guides covering Pakistani law topics:

- Muslim Family Laws (Nikah, Talaq, Khula)
- Bail & Criminal Procedure under CrPC
- Contract Act 1872 for Business
- Cybercrime & PECA 2016
- Land Revenue Records (Fard, Mutation)
- How to File a Civil Suit
- Section 489-F PPC (Dishonoured Cheques)
- Inheritance & Islamic Succession
- Consumer Protection Laws
- Trademark Registration
- Writ Petitions & Article 199
- Rent & Tenancy Laws
- Labor & Employment Rights
- Power of Attorney
- Property Gift (Hiba)
- Defamation Laws
- FIR Guide (Registration & Quashment)
- Company Registration (SECP)
- ADR & Arbitration Act 1940
- Complete Pakistani legal corpus references (1947 to present)

---

## Contributing

We welcome contributions! Please open an issue or submit a pull request.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Contact

- **Website**: [www.alwakeelo.com](https://www.alwakeelo.com)
- **Email**: support@alwakeelo.com
- **Phone/WhatsApp**: +92 335 834 1897
- **LinkedIn**: [Al Wakeelo](https://www.linkedin.com/company/al-wakeelo)

---

<p align="center">
  Built with ❤️ in Pakistan 🇵🇰
</p>
