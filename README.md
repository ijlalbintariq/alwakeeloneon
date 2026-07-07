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

### 🔍 Judgment Search
Search 600,000+ court judgments with PostgreSQL full-text search (`tsvector`). Filter by citation (PLD, SCMR, YLR, MLD, CLC, CLD, PCrLJ), party name, court, year, judge, or keyword. Sub-second results across the entire corpus.

### 🔗 Citation Search
Look up judgments by exact citation — year, journal, and page number. Trace citation networks to see which cases cite each other and follow legal reasoning chains across courts.

### 💬 AI Legal Chat (Al Wakeelo Engine)
The main AI workspace. Ask legal questions and receive answers grounded in verified Pakistani case law and statutes. Every citation is cross-checked against the database — unverified citations are flagged and removed before reaching the user.

### 📝 Legal Drafting
Draft court-ready writ petitions, bail applications, appeals, legal notices, and civil suits. Powered by a TipTap rich text editor with 13 extensions (tables, color, highlight, typography, text-align, subscript, superscript, underline, placeholder, citation autocomplete). Includes draft version history and DOCX export.

### 📋 Contract Drafting
Generate client-ready contracts with structured clause sets, risk score breakdown, redline suggestions, and cleaner final drafts. Supports rental agreements, employment contracts, sale agreements, partnership deeds, NDAs, and service agreements — all compliant with Contract Act 1872, Stamp Act 1899, and Registration Act 1908.

### 📚 Statute Lookup
Navigate 50+ statutes with section-level search — Constitution, PPC, CrPC, CPC, Qanun-e-Shahadat Order, Family Laws, and more. In-browser PDF viewing with `react-pdf`.

### 🧠 Style Memory (RAG-based Personalization)
Train the AI on your uploads, saved drafts, and accepted redline edits so output follows your legal style and preferred language. Uses pgvector embeddings with configurable strictness levels (strict, balanced, flexible) and ownership modes (user-level, org-level, or combined).

### 📁 Case Management
Organize cases by type (criminal, civil, family, constitutional, tax, corporate, banking, labor, property). Track clients/parties with CNIC and contact details, manage 11 compliance types (hearings, filing deadlines, limitation dates, letter of authority, conflict checks, etc.), and link uploaded documents to specific cases.

### 📅 Daily Diary
Hearing calendar with priority levels, outcomes, next-date tracking, and automated email digests (daily/weekly via Resend). Timezone-aware scheduling (Asia/Karachi default).

### 📄 Case Documents
Upload, review, and organize matter-specific documents with auto-classification by legal domain. Supports PDF, DOCX, and image uploads with dual OCR (Tesseract local + OCR.space cloud, English + Urdu).

### 📖 Knowledge Vault
Private user documents and global admin legal resources for retrieval-grounded AI outputs. Supports GitHub-synced knowledge bases and organization-level shared resources.

### 🎙️ Audio Transcription
Convert legal voice notes and recorded audio into text using Whisper.cpp (local) or cloud transcription via DeepSeek/OpenRouter. Includes ffmpeg audio conversion.

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
| **Turbo** | OpenRouter (Kimi) → OpenRouter (Gemini) → DeepSeek Pro | `moonshotai/kimi-k2.5` → `google/gemini-3-flash-preview` → `deepseek-v4-pro` | Pro+ |
| **Apex** | OpenRouter (Apex Pro/Agent) | `anthropic/claude-sonnet-5` (with Agentic step visualization) | Chamber+ |
| **Fallback / Audio** | Moonshot AI (Kimi) | `kimi-k2.5` / `kimi-k2.6` (via `MOONSHOT_API_KEY`) | Chamber+ |

The AI router uses a **race-with-deadline** pattern — if the primary provider doesn't emit a first token within the SLA timeout (30s), it automatically falls back to the next provider in the chain. Streaming and non-streaming fallback paths are handled separately.

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

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (with pgvector) |
| `SESSION_SECRET` | ✅ | Express session secret |
| `DEEPSEEK_API_KEY` | ✅ | Primary AI provider (DeepSeek v4) |
| `OPENROUTER_API_KEY` | Recommended | Fallback AI + Apex mode (Claude Sonnet 5, Kimi K2.5, Gemini 3 Flash) |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth login |
| `RESEND_API_KEY` | Optional | Transactional emails |
| `SAFEPAY_API_KEY` | Optional | Payment processing (PKR) |
| `R2_*` | Optional | Cloudflare R2 file storage (6 vars) |
| `OCRSPACE_API_KEY` | Optional | Cloud OCR fallback |
| `INDEXNOW_KEY` | Optional | Search engine real-time notification |
| `CAPTCHA_ENFORCED` | Optional | Enable CAPTCHA on auth forms |

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
- **LinkedIn**: [Al Wakeelo](https://www.linkedin.com/company/al-wakeelo)

---

<p align="center">
  Built with ❤️ in Pakistan 🇵🇰
</p>
