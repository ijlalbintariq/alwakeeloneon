# Al Wakeelo — Developer Guide

## Overview
Al Wakeelo is a full‑stack TypeScript app:
- Client: React + Vite
- Server: Express + TypeScript, bundled with esbuild
- Database: Postgres (Neon), ORM: Drizzle
- Auth: Email/password, sessions in Postgres; optional Google OAuth
- AI: Google Gemini via GOOGLE_API_KEY

## Prerequisites
- Node.js 20.x–22.x
- Postgres database (Neon recommended)
- Environment variables (set in hosting, not committed):
  - DATABASE_URL
  - SESSION_SECRET
  - GOOGLE_API_KEY
  - Optional: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

## Install
- Clone the repo
- Install deps:

```bash
npm install
```

If deploying on platforms that skip devDependencies, ensure dev tools install:
- Add NPM_CONFIG_PRODUCTION=false in env, or
- Use .npmrc with: production=false

## Development
- Start server:

```bash
npm run dev
```

- Start client (optional separate dev server):

```bash
npx vite --port 5173 --host
```

## Build and Start (Production)
- Build:

```bash
npm run build
```

- Start:

```bash
npm run start
```

Outputs:
- Client assets: dist/public/*
- Server bundle: dist/index.cjs

## Environment
- DATABASE_URL: Neon connection string
- SESSION_SECRET: long random string
- GOOGLE_API_KEY: Gemini key
- NODE_ENV: production (for deploys)
- Optional OAuth:
  - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
  - Redirect URI: https://<your-domain>/api/auth/google/callback

## Database and ORM
- Drizzle config: drizzle.config.ts
- Push schema to database:

```bash
npm run db:push
```

- Seed data:
  - Automatic seed runs on server start
  - Manual endpoint: POST /api/seed-legal-data

## Auth
- Email/password with session cookies stored in Postgres
- Google sign‑in:
  - Set GOOGLE_CLIENT_ID/SECRET
  - Status endpoint: GET /api/auth/google/status
  - Sign‑in: GET /api/auth/google

## Admin
- First admin setup:
  - Sign in → visit /admin-setup → Claim Admin Access
- Admin panel: /admin
- Admin APIs: /api/admin/*

## AI Features
- Chat: /api/ai/chat (SSE supported)
- Statute search: /api/ai/searchStatutes
- Judgment search: /api/ai/searchJudgments
- Judgment summary: /api/ai/judgmentSummary
- Drafting modes: type=draft or type=contract-drafting

## Usage and Cost Tracking
- Tracks tokens and estimated cost per feature
- Usage limits by plan:
  - free: 10 queries/month
  - pro: 500 queries/month
  - enterprise: unlimited

## Deployment
### Render (Node runtime)
- Node version: engines >=20 <23
- Build command:

```bash
npm install && npm run build
```

- Start command:

```bash
node dist/index.cjs
```

- Set Variables: DATABASE_URL, SESSION_SECRET, GOOGLE_API_KEY, NODE_ENV=production
- If build fails with missing dev tools:
  - Add NPM_CONFIG_PRODUCTION=false (Variables), or
  - Ensure .npmrc sets production=false

### Railway (Node or Docker)
- Node service:
  - Build: npm run build
  - Start: node dist/index.cjs
- Docker (optional):
  - Repo includes Dockerfile

## Testing and Quality
- Typecheck:

```bash
npm run check
```

- Linting: not configured yet (optional to add ESLint + Prettier)
- Add tests: choose preferred framework (Vitest/Jest), and CI later

## Troubleshooting
- “tsx not found” on build:
  - Build script uses node script/build.mjs (no tsx in prod)
  - Ensure devDependencies (esbuild, vite) are installed
- “ERR_MODULE_NOT_FOUND: esbuild” on Render:
  - Install devDeps via NPM_CONFIG_PRODUCTION=false or .npmrc production=false
- Local Postgres errors:
  - Use Neon DATABASE_URL; do not rely on localhost in production
- Port binding issues:
  - Hosting sets PORT; server reads it automatically

## Security
- Do not commit secrets or .env
- Sessions stored in Postgres with SESSION_SECRET
- File uploads restricted and parsed safely; PDFs via text extraction

## Project Structure
- client/ — React app (pages, components)
- server/ — Express app (routes, auth, storage)
- shared/ — Drizzle schema and shared contracts
- dist/ — build outputs
- docs/ — documentation

## Commands
- Dev: npm run dev
- Build: npm run build
- Start: npm run start
- Typecheck: npm run check
- DB push: npm run db:push
