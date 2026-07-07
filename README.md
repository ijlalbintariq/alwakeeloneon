<p align="center">
  <img src="client/public/logo.svg" alt="Al Wakeelo Logo" width="80" height="80" />
</p>

<h1 align="center">Alwakeelo AI</h1>

<p align="center">
  <strong>Pakistan's AI-Powered Legal Workspace</strong><br/>
  Search 600,000+ judgments · Draft petitions & contracts · AI legal chat grounded in real case law
</p>

<p align="center">
  <a href="https://www.alwakeelo.com">Website</a> ·
  <a href="https://www.linkedin.com/company/al-wakeelo">LinkedIn</a> ·
  <a href="https://www.alwakeelo.com/blog">Legal Guides</a> ·
  <a href="https://www.alwakeelo.com/contact">Contact</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white" alt="Express 5" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" alt="Vite 7" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

---

## What is Alwakeelo AI?

Alwakeelo AI is a comprehensive legal workspace built for Pakistani advocates, law chambers, and legal professionals. It combines AI-powered research with Pakistan's largest digital judgment database to accelerate legal workflows from hours to minutes.

### The Problem

Pakistan has 600,000+ court judgments scattered across expensive, outdated databases. A single PLD subscription costs PKR 50,000+/year. Most lawyers research case law by physically visiting court libraries. The average time to find a relevant judgment: **2-4 hours**.

### The Solution

An AI-native legal workspace where every AI response is grounded in verified judgments and statutes — no hallucinations, no made-up citations.

---

## Features

### 🔍 Judgment Search Engine
Search 600,000+ Pakistani court judgments from all major courts with full-text search, citation lookup, and advanced filtering.

- **Courts covered**: Supreme Court, Lahore HC, Sindh HC, Peshawar HC, Islamabad HC, Balochistan HC, Federal Shariat Court
- **Law reports**: PLD, SCMR, YLR, MLD, CLC, CLD, PCrLJ, and more
- **Search by**: Citation number, party name, keyword, court, year, judge
- **PostgreSQL full-text search** with `tsvector` indexing for sub-second results
- **Citation Network**: See which cases cite each other — trace legal reasoning chains across courts

### 💬 AI Legal Chat (Al Wakeelo Engine)
Ask legal questions and get answers grounded in verified Pakistani case law and statutes.

- **RAG (Retrieval-Augmented Generation)** — searches verified judgments and statutes before answering
- **Citation verification** — every citation is cross-checked against the database; fake citations are flagged and removed
- **Multi-source retrieval** — searches case law, statutes, admin knowledge base, and user documents simultaneously
- **Intent classification** — understands query complexity, follow-ups, and domain (criminal, civil, family, constitutional, etc.)
- **Conversation threads** — maintain context across multi-turn legal discussions
- **Shareable conversations** — generate public links to share consultations

### 📝 AI Legal Drafting
Draft court-ready legal documents with AI assistance and verified case law citations.

- **Document types**: Writ petitions, bail applications, appeals, legal notices, civil suits, criminal complaints
- **TipTap rich text editor** with legal formatting (tables, citations, headings, numbered paragraphs)
- **Auto-citation insertion** — AI suggests relevant case law while you draft
- **Pakistani court formatting** — proper prayer clauses, verification statements, court headers
- **Draft version history** — track changes across revisions
- **DOCX export** — download court-ready documents

### 📋 Contract Drafting
Generate legally compliant contracts under Pakistani law with AI-powered clause generation.

- **Contract types**: Rental agreements, employment contracts, sale agreements, partnership deeds, NDAs, service agreements
- **Clause library** — AI-generated clause suggestions based on contract type
- **Legal compliance** — references Contract Act 1872, Stamp Act 1899, Registration Act 1908, Arbitration Act 1940
- **Style Memory** — learns your drafting style from uploaded documents and accepted edits

### 📚 Statute Search
Navigate Pakistani statutes with section-level search and full-text access.

- **50+ statutes** — Constitution, PPC, CrPC, CPC, Qanun-e-Shahadat, Family Laws, and more
- **Section-level search** — find specific sections by number or keyword
- **PDF viewer** — read statute documents with in-browser PDF rendering
- **Cross-references** — see which judgments interpret specific statute sections

### 📁 Case Management System
Organize cases, track compliance deadlines, and manage client information.

- **Case files** — organize by type (criminal, civil, family, constitutional, tax, corporate, banking, labor, property)
- **Client management** — parties, opponents, witnesses with CNIC and contact details
- **Compliance tracking** — hearings, filing deadlines, limitation dates, letter of authority tracking (11 compliance types)
- **Daily diary** — hearing calendar with priority levels, outcomes, and next-date tracking
- **Document linking** — attach uploaded documents to specific cases

### 🧠 Style Memory
AI that learns your writing style and adapts its output to match.

- **Learns from**: Uploaded documents, saved drafts, accepted redline edits
- **Ownership modes**: User-level, org-level, or combined
- **Strictness levels**: Strict, balanced, flexible
- **Vector-based retrieval** — finds relevant style samples using pgvector embeddings

### 🏢 Organization Workspace
Collaborate across law chambers with shared resources and pooled AI usage.

- **Org-level knowledge base** — shared legal resources accessible to all members
- **Role-based access** — owner, admin, member roles
- **Email-based invitations** — invite team members with invite codes
- **Pooled AI quotas** — Chamber and Enterprise plans share AI action limits

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| TypeScript 5.6 | Type safety |
| Vite 7 | Build tool |
| Tailwind CSS 3 | Styling |
| Radix UI | Accessible component primitives (20+ components) |
| TanStack Query | Server state management |
| TipTap | Rich text editor (13 extensions) |
| Framer Motion | Animations |
| Wouter | Lightweight routing |
| Recharts | Data visualization |
| react-pdf | In-browser PDF viewing |
| Capacitor | Android native app |

### Backend
| Technology | Purpose |
|---|---|
| Express 5 | HTTP server |
| PostgreSQL | Primary database |
| Drizzle ORM | Type-safe database queries |
| OpenAI SDK | AI provider client (DeepSeek, OpenRouter, Apex) |
| @xenova/transformers | Local ML embeddings (384-dim multilingual) |
| Passport + openid-client | Auth (email/password + Google OAuth) |
| Resend | Transactional email |
| Safepay | Pakistani payment gateway (PKR) |
| Cloudflare R2 | Object storage (S3-compatible) |
| Tesseract + OCR.space | Dual OCR (local + cloud, English + Urdu) |
| Multer | File uploads |

### Infrastructure
| Technology | Purpose |
|---|---|
| Docker | Containerized deployment |
| Render | Cloud hosting |
| Cloudflare R2 | File storage |
| pgvector | Vector similarity search |
| IndexNow | Real-time search engine notification |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React SPA (Vite)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Judgment  │ │ AI Chat  │ │  Legal   │ │ Contract │   │
│  │  Search   │ │ (Al Wak) │ │ Drafting │ │ Drafting │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│       └─────────────┴────────────┴─────────────┘         │
└──────────────────────────┬──────────────────────────────┘
                           │ API
┌──────────────────────────┴──────────────────────────────┐
│                   Express 5 Server                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │   Auth   │ │ AI Router│ │   RAG    │ │   SEO    │   │
│  │ Passport │ │ Fallback │ │ Pipeline │ │ SSR Meta │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│       │             │            │             │          │
│  ┌────┴─────────────┴────────────┴─────────────┴─────┐  │
│  │              PostgreSQL + pgvector                  │  │
│  │  judgments · statutes · case_law · threads ·        │  │
│  │  documents · style_memory · organizations           │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ DeepSeek │ │OpenRouter│ │  Apex AI │ │   R2     │   │
│  │ (Primary)│ │(Fallback)│ │(Premium) │ │(Storage) │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└──────────────────────────────────────────────────────────┘
```

### AI Provider Fallback Chain

```
User Query → Intent Classification → Knowledge Retrieval (RAG)
    ↓
Standard Mode: DeepSeek v4-flash (8K output)
    ↓ (if fails)
Turbo Mode: DeepSeek v4-flash + enhanced context
    ↓ (if fails)
Apex Mode: Claude Sonnet 5 via OpenRouter (agentic search)
```

Every AI response passes through the **citation verification pipeline** — citations are cross-checked against the judgment database. Unverified citations are flagged and removed before reaching the user.

---

## Database Schema

36+ tables organized into these domains:

| Domain | Tables | Key Models |
|--------|--------|------------|
| **Auth** | 4 | users, sessions, password_reset_tokens, email_verification_tokens |
| **Legal Research** | 8 | judgments, case_law, citation_links, statutes, statute_documents, law_journals, courts_ref |
| **AI Chat** | 3 | threads, messages, query_cache |
| **Documents** | 3 | documents, document_files, case_documents |
| **Knowledge (RAG)** | 4 | admin_knowledge, github_knowledge, org_knowledge + files |
| **Style Memory** | 4 | style_memory_settings, samples, chunks (pgvector), events |
| **Case Management** | 5 | case_files, case_clients, case_compliance, case_notes, diary_entries |
| **Organizations** | 3 | organizations, org_members, org_invites |
| **Business** | 6 | bookmarks, search_history, usage_tracking, ai_output_log, payment_records, notification_preferences |
| **Lead Gen** | 3 | visitor_sessions, case_leads, public_funnel_events |

---

## Subscription Tiers

| Tier | Price (PKR/mo) | AI Actions | AI Modes | OCR Pages | Users |
|------|---------------|------------|----------|-----------|-------|
| Free | 0 | 12 | Standard | 100 | 1 |
| Standard | 500 | 120 | Standard | 250 | 1 |
| Pro | 1,000 | 350 | Standard + Turbo | 500 | 1 |
| Chamber | 3,000 | 1,200 | All modes | 1,500 | 3 (pooled) |
| Enterprise | 50,000 | 30,000 | All modes | Custom | Custom |

Quarterly (10% off) and Yearly (20% off) billing cycles available.

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ with pgvector extension
- Tesseract OCR + poppler-utils (optional, for local OCR)

### Installation

```bash
# Clone the repository
git clone https://github.com/alwakeelo/alwakeelo-ai.git
cd alwakeelo-ai

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL, API keys, etc.

# Push database schema
npm run db:push

# Start development server
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Express session secret |
| `DEEPSEEK_API_KEY` | ✅ | Primary AI provider |
| `OPENROUTER_API_KEY` | Optional | Fallback AI + Apex mode |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth login |
| `RESEND_API_KEY` | Optional | Transactional emails |
| `SAFEPAY_API_KEY` | Optional | Payment processing |
| `R2_*` | Optional | Cloudflare R2 file storage |
| `OCRSPACE_API_KEY` | Optional | Cloud OCR fallback |
| `INDEXNOW_KEY` | Optional | Search engine ping |

### Docker

```bash
docker build -t alwakeelo-ai .
docker run -p 5000:5000 --env-file .env alwakeelo-ai
```

### Production Build

```bash
npm run build    # Builds client (Vite) + server (esbuild)
npm start        # Runs production server
```

---

## SEO Infrastructure

The app includes enterprise-grade SEO for 130,000+ indexable pages:

- **Server-side meta injection** — unique `<title>`, `<meta description>`, canonical URL, OG/Twitter tags per route
- **Pre-render blocks** — visible HTML content for crawlers (judgment text, headnotes, court metadata)
- **Dynamic sitemap** — paginated XML sitemaps (10K URLs/page) with real `lastmod` dates
- **Schema.org markup** — CourtCase, Legislation, BlogPosting, Organization, LegalService JSON-LD
- **IndexNow** — real-time Bing/Yandex notification on content changes
- **Google Indexing API** — direct URL submission
- **404 handling** — proper HTTP 404 for non-existent judgments (prevents soft 404s)

---

## Security

- CSRF protection (origin/referer validation on mutating requests)
- Content Security Policy (CSP) headers
- Rate limiting (auth, AI, global API tiers)
- Bcrypt password hashing
- CAPTCHA support (Cloudflare Turnstile + Google reCAPTCHA)
- Single-IP session enforcement (optional)
- User ban system with admin audit logging
- File upload scanning
- HTTPS enforcement + HSTS in production

---

## Courts & Law Reports

### Courts Covered
Supreme Court of Pakistan · Lahore High Court · Sindh High Court · Peshawar High Court · Islamabad High Court · Balochistan High Court · Federal Shariat Court

### Law Reports Indexed
PLD (Pakistan Legal Decisions) · SCMR (Supreme Court Monthly Review) · YLR (Yearly Law Reporter) · MLD (Monthly Law Digest) · CLC (Civil Law Cases) · CLD (Corporate Law Decisions) · PCrLJ (Pakistan Criminal Law Journal)

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
