# Al Wakeel - AI Legal Assistant

## Overview

Al Wakeel is an AI-powered legal assistant web application. It provides a chat-based interface where authenticated users can consult with an AI legal advisor, manage conversation threads, and upload/manage legal documents. The AI generates responses using OpenAI (via Replit AI Integrations) and is themed around Pakistani legal expertise. The project follows a monorepo structure with a React frontend, Express backend, and PostgreSQL database.

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
- **Key Pages**: Landing (`/`), Dashboard (`/dashboard`), Chat (`/chat`, `/chat/:id`), Documents (`/documents`)
- **Auth Hook**: `useAuth()` queries `/api/auth/user` — if 401, user is not authenticated. Login redirects to `/api/login` (Replit Auth flow)

### Backend Architecture
- **Framework**: Express.js with TypeScript, run via `tsx` in development
- **Build**: Custom build script (`script/build.ts`) using esbuild for server and Vite for client. Production output goes to `dist/`
- **API Pattern**: RESTful JSON API under `/api/*`. Route definitions are shared between client and server via `shared/routes.ts` with Zod validation
- **AI Integration**: OpenAI client configured with `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` environment variables (Replit AI Integrations). The AI has a legal assistant system prompt ("Al Wakeel")
- **Dev Server**: Vite dev server is integrated as middleware in development mode (via `server/vite.ts`). In production, static files are served from `dist/public`

### Database
- **Database**: PostgreSQL (required, provisioned via Replit)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration
- **Schema Location**: `shared/schema.ts` (main schema) and `shared/models/` (model-specific files)
- **Key Tables**:
  - `users` — User profiles (varchar ID, email, name, profile image)
  - `sessions` — Session storage for Replit Auth (mandatory, do not drop)
  - `threads` — Chat conversation threads (belongs to user)
  - `messages` — Chat messages within threads (role: user/assistant/system)
  - `documents` — Uploaded legal documents with optional AI summaries
  - `conversations` / `messages` (in `shared/models/chat.ts`) — Alternate chat model used by Replit integrations
- **Migrations**: Use `npm run db:push` (drizzle-kit push) to sync schema to database. Migration files output to `./migrations/`

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
The `attached_assets/` directory contains reference files from a previous version of the application (a Google AI Studio app using Gemini). These serve as design inspiration and feature references but are NOT the active codebase. The current implementation uses OpenAI instead of Gemini.

## External Dependencies

### Required Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (provisioned by Replit)
- `SESSION_SECRET` — Secret for session encryption
- `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI API key (via Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — OpenAI base URL (via Replit AI Integrations)
- `REPL_ID` — Replit environment identifier (set automatically)
- `ISSUER_URL` — OIDC issuer URL for Replit Auth (defaults to `https://replit.com/oidc`)

### Key NPM Dependencies
- **Server**: express, drizzle-orm, pg, passport, openid-client, express-session, connect-pg-simple, openai, zod
- **Client**: react, wouter, @tanstack/react-query, shadcn/ui (Radix primitives), tailwindcss, date-fns, react-hook-form, @hookform/resolvers
- **Build**: vite, esbuild, tsx, typescript, drizzle-kit

### Third-Party Services
- **Replit Auth** — Authentication via OpenID Connect
- **Replit AI Integrations** — OpenAI-compatible API for chat completions, image generation, and audio processing
- **PostgreSQL** — Primary data store (provisioned by Replit)