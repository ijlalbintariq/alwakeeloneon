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
