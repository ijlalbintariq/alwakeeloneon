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
- **Key Pages**: Landing (`/`), Dashboard (`/dashboard`), Chat (`/chat`, `/chat/:id`), Documents (`/documents`), Admin Panel (`/admin`, admin-only), User Settings (`/settings`)
- **Auth Hook**: `useAuth()` queries `/api/auth/user` — if 401, user is not authenticated. Login redirects to `/api/login` (Replit Auth flow)

### Backend Architecture
- **Framework**: Express.js with TypeScript, run via `tsx` in development
- **Build**: Custom build script (`script/build.ts`) using esbuild for server and Vite for client. Production output goes to `dist/`
- **API Pattern**: RESTful JSON API under `/api/*`. Route definitions are shared between client and server via `shared/routes.ts` with Zod validation
- **AI Integration**: Google Gemini via `@google/genai` SDK, configured with `GOOGLE_API_KEY` environment variable. Uses `gemini-3-flash-preview` for general chat/search and `gemini-3-pro-preview` for complex legal briefs. The AI has a legal assistant system prompt ("Al Wakeelo"). Knowledge is gathered from a 3-tier priority system: (1) Internal Knowledge Vault (statutes/case law DB), (2) GitHub Legal Library (synced from github.com/ijlalbintariq/law), (3) Gemini AI general knowledge
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

### PWA (Progressive Web App)
- **Manifest**: `client/public/manifest.json` with app name, icons, theme color
- **Service Worker**: `client/public/sw.js` with network-first strategy for pages, cache fallback for offline
- **Install**: Users can "Add to Home Screen" on mobile browsers for native-like experience

### Authentication
- **Method**: Replit Auth (OpenID Connect)
- **Session Store**: PostgreSQL-backed sessions via `connect-pg-simple`
- **Flow**: Login via `/api/login`, logout via `/api/logout`, user info via `/api/auth/user`
- **Middleware**: `isAuthenticated` middleware protects API routes; returns 401 for unauthenticated requests
- **Important**: The `sessions` and `users` tables are mandatory for Replit Auth — never drop them

### Replit Integrations
The `server/replit_integrations/` directory contains pre-built integration modules:
- **`auth/`** — Replit Auth setup (OIDC, passport, session management)
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
- `GOOGLE_API_KEY` — Google Gemini API key (user-provided)
- `REPL_ID` — Replit environment identifier (set automatically)
- `ISSUER_URL` — OIDC issuer URL for Replit Auth (defaults to `https://replit.com/oidc`)

### Key NPM Dependencies
- **Server**: express, drizzle-orm, pg, passport, openid-client, express-session, connect-pg-simple, @google/genai, zod
- **Client**: react, wouter, @tanstack/react-query, shadcn/ui (Radix primitives), tailwindcss, date-fns, react-hook-form, @hookform/resolvers
- **Build**: vite, esbuild, tsx, typescript, drizzle-kit

### Third-Party Services
- **Replit Auth** — Authentication via OpenID Connect
- **Google Gemini** — AI language model for legal chat, search, and document generation
- **PostgreSQL** — Primary data store (provisioned by Replit)