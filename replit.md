# Al Wakeel - AI Legal Assistant

## Overview

Al Wakeelo is an AI-powered legal assistant web application. It provides a chat-based interface where authenticated users can consult with an AI legal advisor, manage conversation threads, and upload/manage legal documents. The AI generates responses using Google Gemini (gemini-2.5-flash for general use, gemini-2.5-pro for complex legal briefs) via the @google/genai SDK. The app is themed around Pakistani legal expertise with an exclusive dark slate theme. The project follows a monorepo structure with a React frontend, Express backend, and PostgreSQL database.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Monorepo Structure
The project uses a three-directory monorepo pattern:
- **`client/`** — React single-page application (frontend)
- **`server/`** — Express.js API server (backend)
- **`shared/`** — Shared TypeScript types, schemas, and route definitions used by both client and server

### Frontend Architecture
- **Framework**: React with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router, NOT React Router)
- **State Management**: TanStack React Query for server state; no global client state library
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support). Fonts: "Libre Baskerville" for headings, "Inter" for body text
- **Key Pages**: Landing (`/`), Dashboard (`/dashboard`), Chat/Al Wakeelo Engine (`/al-wakeelo`), Judgment Search (`/judgment-search`), Judgment View (`/judgment-view` — dedicated detail page with AI chat panel), Statute Search (`/statute-search`), Statute View (`/statute-view/:id` — dedicated detail page with TOC + AI chat panel), Legal Drafting (`/legal-drafting`), Contract Drafting (`/contract-drafting`), Case Documents (`/case-documents`), Bookmarks (`/bookmarks`), History (`/history`), Knowledge Vault (`/knowledge-vault`), Admin Panel (`/admin`), User Settings (`/settings`)
- **Auth Hook**: `useAuth()` queries `/api/auth/user` — if 401, user is not authenticated. Login redirects to `/auth` page (standalone email/password + optional Google OAuth)

### Backend Architecture
- **Framework**: Express.js with TypeScript, run via `tsx` in development
- **Build**: Custom build script (`script/build.ts`) using esbuild for server and Vite for client. Production output goes to `dist/`
- **API Pattern**: RESTful JSON API under `/api/*`. Route definitions are shared between client and server via `shared/routes.ts` with Zod validation
- **AI Integration (Multi-Provider)**:
  1. **Groq** (`server/groq-ai.ts`) — Primary provider for Standard mode. Dynamic model selection from Groq dashboard. Fallback: OpenRouter. Configured with `GROQ_API_KEY`
  2. **DeepSeek** (`server/deepseek-ai.ts`) — Turbo mode (Pro/Enterprise only) using `deepseek-chat` via direct API. Fallback: Groq. Configured with `DeepSeek_API_KEY`
  3. **Moonshot/Kimi K2.5** (`server/apex-ai.ts`) — Apex-branded models for Pro/Enterprise users. Fallback: DeepSeek Pro (`deepseek-reasoner`). Configured with `MOONSHOT_API_KEY`
  4. **OpenRouter** (`server/openrouter.ts`) — Fallback provider for Standard mode when Groq fails. Configured with `OPENROUTER_API_KEY`
  The AI has a structured legal assistant system prompt ("Al Wakeelo") via `getLegalSystemPrompt()` function (dynamic current date). Knowledge is gathered from a 3-tier priority system: (1) Internal Knowledge Vault (statutes/case law DB), (2) GitHub Legal Library (synced from github.com/ijlalbintariq/law), (3) AI general knowledge
- **Markdown Rendering**: AI responses rendered via `react-markdown` + `remark-gfm` with the `LegalMarkdown` component (`client/src/components/legal-markdown.tsx`). Statute references in `**[Statute Name, Year]**` format become clickable links to `/statute-search?q=...`. Case citations matching PLD/SCMR/YLR/MLD/CLC/PCRLJ/PLJ patterns link to `/judgment-search?q=...`. Both search pages support `?q=` URL parameters for auto-search on navigation
- **Conversation Sharing**: Threads have optional `shareToken` column. POST `/api/threads/:id/share` generates a 32-char hex token. GET `/api/shared/:token` returns public conversation data (no auth required). Public share page at `/share/:token` displays conversation with CTA. Share button appears in chat header after 2+ messages
- **Reference Cards**: AI responses include a ```references JSON block at the end with structured law/judgment references. Frontend parses via `parseReferences()` in `client/src/components/reference-cards.tsx`, strips the block from display, and renders clickable "Relevant Laws" and "Relevant Judgments" cards below each assistant message. Cards link to statute-search and judgment-search pages
- **AI Model Selection**: Frontend model selector offers Standard (Groq) for all users, Turbo (DeepSeek) for Pro/Enterprise users, plus Apex models (Kimi K2.5 via Moonshot) for Pro/Enterprise users
- **GitHub Knowledge Sync**: `server/github-sync.ts` fetches .txt legal documents from the GitHub repo at startup and stores them in the `github_knowledge` table. The `gatherKnowledgeContext()` function in routes.ts searches all tiers and injects relevant content into AI prompts transparently
- **Dev Server**: Vite dev server is integrated as middleware in development mode (via `server/vite.ts`). In production, static files are served from `dist/public`

### Database
- **Database**: PostgreSQL (required, provisioned via Replit)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration
- **Schema Location**: `shared/schema.ts` (main schema) and `shared/models/` (model-specific files)
- **Key Tables**:
  - `users` — User profiles (varchar ID, email, name, profile image, subscriptionTier: free/pro/enterprise)
  - `sessions` — Session storage for Replit Auth (mandatory, do not drop)
  - `threads` — Chat conversation threads (belongs to user)
  - `messages` — Chat messages within threads (role: user/assistant/system)
  - `documents` — Uploaded legal documents with optional AI summaries
  - `github_knowledge` — Synced legal documents from GitHub repository (auto-populated on startup)
  - `admin_knowledge` — Admin-uploaded legal documents for AI knowledge (title, filename, content, category, uploadedBy)
  - `saved_judgments` — User-saved judgments (userId, citation, court, title, summary, keywords, uri, source, aiAnalysis). Prevents duplicates via server-side check
  - `query_cache` — Cached AI responses with 7-day TTL (endpoint, queryHash, response, hitCount)
  - `usage_tracking` — Per-user AI query usage tracking (userId, feature, inputTokens, outputTokens, estimatedCost, createdAt)
  - `conversations` / `messages` (in `shared/models/chat.ts`) — Alternate chat model used by Replit integrations
- **Migrations**: Use `npm run db:push` (drizzle-kit push) to sync schema to database. Migration files output to `./migrations/`

### Usage Limits & Tier System
- **Tiers**: Free (10 queries/month), Pro (500 queries/month), Enterprise (unlimited)
- **Tracking**: Every AI endpoint call logs to `usage_tracking` table with estimated token counts and cost. Monthly counts reset automatically
- **Cost Analytics**: GET `/api/admin/cost-analytics` returns per-feature breakdown of queries, tokens, and estimated costs (admin only). Displayed in admin panel Analytics tab
- **Enforcement**: `checkUsageLimit()` function runs before every AI endpoint. Returns 429 with tier info when limit reached. Includes per-user 2-second rate limiting to prevent rapid-fire queries
- **Frontend**: Dashboard shows usage progress bar, remaining queries, and upgrade prompts at 80%/100% thresholds
- **API**: GET `/api/usage` returns current tier, used count, remaining, and percentage

### Query Cache System
- **TTL**: 7 days. Normalized query text hashed with SHA-256
- **Cached endpoints**: searchJudgments, searchStatutes, summarize, brief, chat (first messages), ai-chat (standalone chat)
- **Auto-cleanup**: Expired entries removed on startup + daily interval

### Cost Optimization System
- **Knowledge context limits**: Excerpts capped at 1,500 chars (down from 3,000), max 2 sources per tier, 3 statutes/case law results
- **Response length limits**: Per-endpoint maxOutputTokens (chat: 4096, search: 2048, summarize: 3072, brief: 6144). System prompt includes concise response instructions
- **Chat caching**: First messages in threads and standalone AI chat are cached, follow-up conversation messages are not cached (context-dependent)
- **Rate limiting**: Per-user 2-second cooldown between AI requests (in-memory Map with auto-cleanup)
- **Cost tracking**: Each AI call estimates input/output tokens and cost, stored in usage_tracking table. Admin panel shows per-feature cost breakdown with progress bars

### Enterprise Features
- **Organizations**: Enterprise users can create organizations with team collaboration. Tables: `organizations`, `org_members`, `org_invites`, `org_knowledge`
- **Team Management**: Owner can invite members by email, remove members. Invited users see pending invitations and can accept/decline. Single-org constraint enforced
- **Custom Knowledge Base**: Organization members can upload private legal documents (TXT, PDF, DOCX) to a shared org knowledge base. These documents are automatically included as AI context for all org members
- **Priority API Access**: Enterprise users bypass monthly query limits and always use the Pro model (gemini-3-pro-preview) for higher quality responses
- **Authorization**: Invite accept/decline validates ownership. Knowledge deletion restricted to org owner. Org membership uniqueness enforced
- **Frontend**: `/organization` page with create org form, team member list with role badges, invite system, knowledge base upload/management
- **API Routes**: `/api/org` (CRUD), `/api/org/:id/members`, `/api/org/:id/invite`, `/api/org/:id/invites`, `/api/org/invites/pending`, `/api/org/invites/:id/accept|decline`, `/api/org/:id/knowledge` (CRUD with file upload)

### Apex AI Integration (Kimi K2.5)
- **Branding**: Kimi K2.5 by Moonshot AI, branded as "Apex" models within Al Wakeelo
- **Models**: 
  - `apex` (Apex) — For Pro users. Fast instant mode (temp 0.6, 4K tokens)
  - `apex-pro` (Apex Pro) — For Enterprise users. Thinking mode with reasoning traces (temp 1.0, 8K tokens)
  - `apex-agent` (Apex Agent) — For Enterprise users. Agent capabilities (temp 0.7, 8K tokens)
- **Backend**: `server/apex-ai.ts` — Moonshot OpenAI-compatible API at `api.moonshot.ai/v1`. Requires `MOONSHOT_API_KEY` env var
- **Frontend**: Model selector dropdown in chat input area. Shows available Apex models based on user tier. Emerald green accent for Apex branding
- **API Routes**: GET `/api/apex/models` (available models per tier), POST `/api/apex/chat` (send message to Apex model)
- **Knowledge Integration**: Apex chat includes same legal system prompt and knowledge context as Gemini

### PWA (Progressive Web App)
- **Manifest**: `client/public/manifest.json` with app name, icons, theme color
- **Service Worker**: `client/public/sw.js` with network-first strategy for pages, cache fallback for offline
- **Install**: Users can "Add to Home Screen" on mobile browsers for native-like experience. Dedicated install guide page at `/install` with step-by-step instructions for iOS, Android, and Desktop

### Authentication
- **Method**: Standalone email/password authentication with optional Google OAuth
- **Session Store**: PostgreSQL-backed sessions via `connect-pg-simple`
- **Registration**: POST `/api/auth/register` with email, password, firstName, lastName. Passwords hashed with bcrypt (12 rounds)
- **Login**: POST `/api/auth/login` with email, password. Returns user data and creates session
- **Google OAuth**: GET `/api/auth/google` redirects to Google, callback at `/api/auth/google/callback`. Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars (optional — app works without them)
- **Logout**: POST `/api/auth/logout` destroys session
- **User Info**: GET `/api/auth/user` returns authenticated user (401 if not logged in)
- **Middleware**: `isAuthenticated` middleware checks `req.session.userId`; returns 401 for unauthenticated requests
- **Important**: The `sessions` and `users` tables are mandatory — never drop them

### Replit Integrations
The `server/replit_integrations/` directory contains integration modules:
- **`auth/`** — Standalone auth setup (email/password + Google OAuth, session management)
- **`chat/`** — Generic chat storage and routes using the conversations/messages model
- **`audio/`** — Voice chat with speech-to-text, text-to-speech, and audio streaming
- **`image/`** — Image generation via `gpt-image-1`
- **`batch/`** — Batch processing utilities with rate limiting and retries

### Attached Assets
The `attached_assets/` directory contains reference files from a previous version of the application. These serve as design inspiration and feature references.

## External Dependencies

### Required Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (provisioned by Replit)
- `SESSION_SECRET` — Secret for session encryption
- `GROQ_API_KEY` — Groq API key for Standard mode (primary provider, required)
- `DeepSeek_API_KEY` — DeepSeek API key for Turbo mode (required for Pro/Enterprise)
- `OPENROUTER_API_KEY` — OpenRouter API key (Standard mode fallback)
- `GOOGLE_CLIENT_ID` — Google OAuth client ID (optional, for Google login)
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret (optional, for Google login)
- `MOONSHOT_API_KEY` — Moonshot AI API key for Apex models (optional, for Kimi K2.5 integration)

### Key NPM Dependencies
- **Server**: express, drizzle-orm, pg, passport, openid-client, express-session, connect-pg-simple, openai (for Groq/DeepSeek/OpenRouter/Moonshot), zod
- **Client**: react, wouter, @tanstack/react-query, shadcn/ui (Radix primitives), tailwindcss, date-fns, react-hook-form, @hookform/resolvers
- **Build**: vite, esbuild, tsx, typescript, drizzle-kit

### Third-Party Services
- **Groq** — Primary AI provider for Standard mode (chat, search, drafting). Dynamic model selection
- **DeepSeek** — Turbo mode AI provider (`deepseek-chat`). Direct API at api.deepseek.com. Fallback: Groq
- **OpenRouter** — Fallback AI provider for Standard mode when Groq fails
- **Moonshot AI (Kimi K2.5)** — Apex-branded AI models for Pro/Enterprise users. Fallback: DeepSeek Pro
- **PostgreSQL** — Primary data store (provisioned by Replit)
- **Google OAuth** — Optional social login (requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)