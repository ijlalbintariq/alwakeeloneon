# Al Wakeelo — Full Developer Reference Guide

**Version**: Current (February 2026)  
**Stack**: React + TypeScript (frontend) · Express.js + TypeScript (backend) · PostgreSQL + Drizzle ORM · Google Gemini AI · Kimi K2.5 (Apex)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Technology Stack](#3-technology-stack)
4. [Environment Variables](#4-environment-variables)
5. [Database Schema](#5-database-schema)
6. [Authentication System](#6-authentication-system)
7. [User Tier & Usage Limit System](#7-user-tier--usage-limit-system)
8. [AI Integration Architecture](#8-ai-integration-architecture)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Backend Routes Reference](#10-backend-routes-reference)
11. [Feature-by-Feature Flow](#11-feature-by-feature-flow)
    - [Registration & Login](#111-registration--login)
    - [Main AI Chat (Al Wakeelo Engine)](#112-main-ai-chat-al-wakeelo-engine)
    - [Judgment Search](#113-judgment-search)
    - [Statute Search & Statute View](#114-statute-search--statute-view)
    - [Legal Drafting](#115-legal-drafting)
    - [Contract Drafting](#116-contract-drafting)
    - [File Attachments & Audio Transcription](#117-file-attachments--audio-transcription)
    - [Apex AI Models (Kimi K2.5)](#118-apex-ai-models-kimi-k25)
    - [Conversation Sharing](#119-conversation-sharing)
    - [Bookmarks](#1110-bookmarks)
    - [Knowledge Vault (User Documents)](#1111-knowledge-vault-user-documents)
    - [Search History](#1112-search-history)
    - [Organization & Team Collaboration](#1113-organization--team-collaboration)
    - [Admin Panel](#1114-admin-panel)
    - [Password Reset](#1115-password-reset)
12. [Knowledge Context System](#12-knowledge-context-system)
13. [Caching System](#13-caching-system)
14. [Cost Tracking & Analytics](#14-cost-tracking--analytics)
15. [PWA & Install Guide](#15-pwa--install-guide)
16. [Startup Processes](#16-startup-processes)
17. [Build & Deployment](#17-build--deployment)

---

## 1. Project Overview

Al Wakeelo is an AI-powered Pakistani legal assistant web application. It provides:

- A chat interface where users consult an AI legal advisor (Google Gemini / Kimi K2.5)
- Pakistani judgment search and case law lookup
- Pakistani statute search with table-of-contents navigation
- AI-powered legal document and contract drafting
- File upload and audio transcription for case context
- A personal knowledge vault for user documents
- Team collaboration through organizations (Enterprise tier)
- An admin panel for content management and system analytics
- Subscription tiers: Free (10 queries/month), Pro (500/month), Enterprise (unlimited)

The system is designed so the AI always works within Pakistani legal context, using a layered knowledge system: internal statutes/case law database → GitHub-synced legal library → admin-uploaded documents → user's own case files → organization shared knowledge.

---

## 2. Repository Structure

```
Alwakeelo/
├── client/                        # React SPA (frontend)
│   ├── public/
│   │   ├── manifest.json          # PWA manifest
│   │   └── sw.js                  # Service worker (PWA)
│   └── src/
│       ├── App.tsx                # Root router & auth guard
│       ├── main.tsx               # React entry point
│       ├── components/
│       │   ├── app-shell.tsx      # Sidebar layout wrapper for protected pages
│       │   ├── legal-markdown.tsx # Markdown renderer with clickable statute/case links
│       │   ├── reference-cards.tsx# Parses ```references JSON blocks from AI output
│       │   └── ui/                # shadcn/ui component library
│       ├── hooks/
│       │   └── use-auth.ts        # useAuth() — current user + logout
│       ├── lib/
│       │   └── queryClient.ts     # TanStack Query client + apiRequest helper
│       └── pages/
│           ├── landing.tsx
│           ├── auth.tsx
│           ├── dashboard.tsx
│           ├── chat.tsx           # Reusable ChatModule used by 3 pages
│           ├── judgment-search.tsx
│           ├── judgment-view.tsx
│           ├── statute-search.tsx
│           ├── statute-view.tsx
│           ├── legal-drafting.tsx
│           ├── contract-drafting.tsx
│           ├── case-documents.tsx
│           ├── bookmarks.tsx
│           ├── history.tsx
│           ├── knowledge-vault.tsx
│           ├── organization.tsx
│           ├── admin-panel.tsx
│           ├── user-panel.tsx
│           ├── admin-setup.tsx
│           ├── shared-conversation.tsx
│           ├── install-app.tsx
│           ├── privacy.tsx
│           ├── terms.tsx
│           ├── forgot-password.tsx
│           └── reset-password.tsx
├── server/
│   ├── index.ts                   # Express app entry point
│   ├── routes.ts                  # All API route handlers (~2500 lines)
│   ├── storage.ts                 # Database abstraction layer (Drizzle queries)
│   ├── apex-ai.ts                 # Kimi K2.5 (Moonshot API) integration
│   ├── github-sync.ts             # Syncs legal texts from GitHub on startup
│   ├── auto-extract-caselaw.ts    # Background AI extraction of case law
│   ├── vite.ts                    # Vite dev middleware integration
│   └── replit_integrations/
│       └── auth/
│           └── routes.ts          # Auth routes (register, login, OAuth, password reset)
├── shared/
│   ├── schema.ts                  # Drizzle ORM schema (all tables)
│   └── models/
│       └── auth.ts                # Auth-related table definitions
├── script/
│   └── build.ts                   # esbuild + Vite production build
├── migrations/                    # Drizzle migration output
├── database_export.sql            # Last exported database dump
└── DEVELOPER_GUIDE.md             # This file
```

---

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + TypeScript |
| Frontend bundler | Vite |
| Client routing | Wouter (NOT React Router) |
| Server state | TanStack React Query |
| UI components | shadcn/ui (Radix UI + Tailwind CSS) |
| Animations | Framer Motion |
| Markdown rendering | react-markdown + remark-gfm |
| Backend framework | Express.js + TypeScript |
| Backend runtime | tsx (development), Node.js (production) |
| Database | PostgreSQL |
| ORM | Drizzle ORM + drizzle-kit |
| Sessions | express-session + connect-pg-simple |
| Auth | bcryptjs (password hashing), Passport.js (Google OAuth) |
| Primary AI | Google Gemini via @google/genai SDK |
| Secondary AI | Kimi K2.5 via Moonshot API (OpenAI-compatible) |
| File processing | multer (upload), unpdf (PDF text), mammoth (DOCX text) |
| Email | Resend API (password reset emails) |

---

## 4. Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GOOGLE_API_KEY` | Yes | Google Gemini AI API key |
| `SESSION_SECRET` | Yes | express-session signing secret |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth client secret |
| `MOONSHOT_API_KEY` | Optional | Kimi K2.5 (Apex models) via Moonshot API |
| `RESEND_API_KEY` | Optional | Resend email service for password resets |
| `FROM_EMAIL` | Optional | Sender address for reset emails |

---

## 5. Database Schema

All tables are defined in `shared/schema.ts` and `shared/models/auth.ts`. Migrations are applied with `npm run db:push`.

### Core Tables

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | varchar (UUID) | Primary key, auto-generated |
| email | varchar | Unique |
| firstName | varchar | |
| lastName | varchar | |
| profileImageUrl | varchar | Optional |
| passwordHash | varchar | Nullable (null for OAuth users) |
| authProvider | varchar | `"email"` or `"google"` |
| subscriptionTier | varchar | `"free"`, `"pro"`, `"enterprise"` (default: free) |
| isAdmin | boolean | Admin flag (default: false) |
| createdAt | timestamp | Auto |
| updatedAt | timestamp | Auto |

#### `sessions`
Managed by connect-pg-simple. **Never drop this table** — it stores active user sessions.

#### `password_reset_tokens`
| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| userId | varchar | FK → users |
| token | varchar | 32-byte hex |
| expiresAt | timestamp | 1 hour after creation |
| used | boolean | Marked true after use |

#### `threads`
| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| userId | varchar | FK → users |
| title | varchar | Thread title |
| shareToken | varchar | Nullable; set when user shares conversation |
| createdAt | timestamp | |

#### `messages`
| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| threadId | integer | FK → threads |
| role | varchar | `"user"`, `"assistant"`, `"system"` |
| content | text | Message content |
| createdAt | timestamp | |

#### `documents`
User-uploaded files in the Knowledge Vault.

| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| userId | varchar | FK → users |
| title | varchar | |
| filename | varchar | |
| content | text | Extracted text content |
| summary | text | AI-generated summary (optional) |
| createdAt | timestamp | |

#### `bookmarks`
| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| userId | varchar | FK → users |
| title | varchar | |
| content | text | Full AI response text |
| type | varchar | `"al-wakeelo"`, `"draft"`, `"contract"` |
| category | varchar | |
| createdAt | timestamp | |

#### `searchHistory`
| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| userId | varchar | FK → users |
| type | varchar | `"judgment"`, `"statute"`, `"chat"`, `"draft"`, `"contract"` |
| query | varchar | First 80 chars of query |
| createdAt | timestamp | |

### Legal Knowledge Tables

#### `statutes`
Structured Pakistani statute entries (PPC sections, CrPC, CPC, etc.)

| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| shortTitle | varchar | Statute short name |
| section | varchar | Section number/name |
| description | text | Section description |
| punishment | text | Punishment/penalty (if applicable) |
| keywords | text | Searchable keywords |

#### `caseLaw`
Pakistani case law (judgments from PLD, SCMR, YLR, MLD, CLC, etc.)

| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| citation | varchar | e.g., "PLD 2019 SC 412" |
| court | varchar | Court name |
| title | varchar | Case title |
| summary | text | Case summary |
| keywords | text | Search keywords |
| uri | varchar | External link (optional) |

#### `githubKnowledge`
Auto-populated on startup by syncing from the GitHub repository `ijlalbintariq/law`.

| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| filename | varchar | Source filename |
| title | varchar | Document title |
| content | text | Full text content |
| createdAt | timestamp | |

#### `adminKnowledge`
Documents uploaded by admins to the shared knowledge vault.

| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| title | varchar | |
| filename | varchar | |
| content | text | |
| category | varchar | |
| uploadedBy | varchar | FK → users (nullable) |
| createdAt | timestamp | |

#### `statuteDocuments`
Full-text statute documents uploaded by admins (acts, ordinances, etc.)

| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| title | varchar | |
| filename | varchar | |
| content | text | Full extracted text |
| category | varchar | |
| createdAt | timestamp | |

#### `savedJudgments`
Judgments bookmarked by individual users.

| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| userId | varchar | FK → users |
| citation | varchar | |
| court | varchar | |
| title | varchar | |
| summary | text | |
| keywords | text | |
| uri | varchar | |
| source | varchar | |
| aiAnalysis | text | AI-generated analysis |
| createdAt | timestamp | |

### Performance Tables

#### `queryCache`
| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| endpoint | varchar | Feature name/endpoint |
| queryHash | varchar | SHA-256 of normalized query |
| response | text | Cached AI response |
| hitCount | integer | Number of cache hits |
| createdAt | timestamp | Used to enforce 7-day TTL |

#### `usageTracking`
| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| userId | varchar | FK → users |
| feature | varchar | `"chat"`, `"search-judgments"`, `"brief"`, etc. |
| model | varchar | AI model used |
| inputTokens | integer | Estimated input tokens |
| outputTokens | integer | Estimated output tokens |
| estimatedCost | text | Cost in USD (string decimal) |
| createdAt | timestamp | Used for monthly rollup |

### Organization Tables

#### `organizations`
| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| name | varchar | |
| description | text | |
| ownerId | varchar | FK → users |
| createdAt | timestamp | |

#### `orgMembers`
| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| orgId | integer | FK → organizations |
| userId | varchar | FK → users |
| role | varchar | `"owner"` or `"member"` |
| joinedAt | timestamp | |

#### `orgInvites`
| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| orgId | integer | FK → organizations |
| email | varchar | Invited user's email |
| status | varchar | `"pending"`, `"accepted"`, `"declined"` |
| createdAt | timestamp | |

#### `orgKnowledge`
| Column | Type | Notes |
|---|---|---|
| id | serial | Primary key |
| orgId | integer | FK → organizations |
| title | varchar | |
| filename | varchar | |
| content | text | |
| uploadedBy | varchar | FK → users |
| createdAt | timestamp | |

---

## 6. Authentication System

**File**: `server/replit_integrations/auth/routes.ts`

The app uses **session-based authentication**. Sessions are stored in PostgreSQL via `connect-pg-simple`.

### Session Flow
1. On login/register, the server sets `req.session.userId = user.id`
2. express-session serializes this into a cookie (`connect.sid`) sent to the browser
3. On every protected request, the `isAuthenticated` middleware checks `req.session.userId`
4. If no session or session expired → 401 Unauthorized

### isAuthenticated Middleware
```typescript
function isAuthenticated(req, res, next) {
  if (req.session?.userId) return next();
  return res.status(401).json({ message: "Unauthorized" });
}
```

### Password Hashing
bcryptjs with 12 salt rounds. Passwords are never stored in plain text.

### Google OAuth Flow
1. Frontend calls `GET /api/auth/google/status` to check if Google OAuth is configured
2. If configured, shows "Continue with Google" button
3. User clicks → Google credential returned as JWT token
4. Frontend sends token to `POST /api/auth/google/token`
5. Server verifies token with Google OAuth API, finds or creates user in DB
6. Creates session exactly like normal login

### Frontend Auth State
`useAuth()` hook in `client/src/hooks/use-auth.ts`:
- Queries `GET /api/auth/user` via React Query
- Returns `{ user, isLoading, logout }`
- If 401 returned → `user = null` → App.tsx redirects to `/auth`
- `logout()` calls `POST /api/auth/logout` then invalidates the query

---

## 7. User Tier & Usage Limit System

### Tier Definitions
```typescript
TIER_LIMITS = {
  free:       { monthly: 10,     label: "Free Plan" },
  pro:        { monthly: 500,    label: "Pro Plan" },
  enterprise: { monthly: 999999, label: "Enterprise Plan" }
}
```

### How Limits Are Enforced
Every AI endpoint calls `checkUsageLimit(userId, feature, res)` before processing:

1. Query `usageTracking` table: `COUNT(*) WHERE userId = ? AND createdAt >= start_of_month`
2. Get user's tier from `users` table
3. Enterprise users bypass limits entirely and also bypass the 2-second rate limit
4. If `used >= limit` → returns HTTP 429 with tier info
5. Per-user rate limit: In-memory Map tracks last request time; rejects if < 2 seconds since last request

### Usage Logging
After every successful AI call:
```typescript
logUsageCost(userId, feature, model, inputText, outputText)
```
- Estimates tokens: `Math.ceil(text.length / 4)`
- Calculates cost: `(tokens / 1000) * rate_per_1k`
- Cost rates:
  - gemini-3-flash-preview: $0.00015/1K input, $0.0006/1K output
  - gemini-3-pro-preview: $0.00125/1K input, $0.005/1K output
- Inserts row into `usageTracking`

### Frontend Usage Display
`GET /api/usage` returns:
```json
{
  "tier": "pro",
  "tierLabel": "Pro Plan",
  "monthlyLimit": 500,
  "used": 23,
  "remaining": 477,
  "percentage": 4.6
}
```
Dashboard shows a progress bar; warnings appear at 80% and 100%.

---

## 8. AI Integration Architecture

### 8.1 Google Gemini

**SDK**: `@google/genai`  
**Config**: `GOOGLE_API_KEY` environment variable  
**Initialization**: `getAI()` function (lazy singleton)

**Models used**:
- `gemini-3-flash-preview` — Default; used for chat, search, summaries, drafting (free/pro/enterprise)
- `gemini-3-pro-preview` — Upgraded model; used when `turbo: true` (Pro/Enterprise only) or for legal briefs

**Automatic fallback**: If the pro model returns a 429 (quota exceeded), the server transparently falls back to the flash model and re-tries, without the user knowing.

**Max token limits by feature**:
```typescript
MAX_OUTPUT_TOKENS = {
  chat:               4096,
  "search-judgments": 2048,
  "search-statutes":  2048,
  summarize:          3072,
  brief:              6144,
  draft:              6144,
  toc:                8192,
}
```

### 8.2 Kimi K2.5 (Apex Models)

**File**: `server/apex-ai.ts`  
**Provider**: Moonshot AI API at `https://api.moonshot.ai/v1` (OpenAI-compatible)  
**Config**: `MOONSHOT_API_KEY` environment variable

**Model mapping**:
| Branded Name | API Model | Tier | Temperature | Thinking | Max Tokens |
|---|---|---|---|---|---|
| Apex | kimi-k2.5 | Pro | 0.6 | Off | 4096 |
| Apex Pro | kimi-k2.5 | Enterprise | 1.0 | On | 8192 |
| Apex Agent | kimi-k2.5 | Enterprise | 0.7 | On | 8192 |

When thinking is enabled, the API returns a `reasoning_content` field with the model's chain-of-thought, which is passed back to the frontend in the response.

### 8.3 System Prompt

The legal system prompt is returned by `getLegalSystemPrompt()` in `server/routes.ts`:

```
You are Al Wakeelo — Your Digital Lawyer, inspired by Saul Goodman.
- Answer in user's language (English or Urdu)
- Always cite Pakistani sources: PLD, SCMR, YLR, MLD, CLC, PCRLJ
- Mandatory response structure with markdown sections:
  ### Legal Context
  ### Statutory Framework & Provisions
  ### Leading Case Law & Precedents
  ### Practical Legal Strategy
  ```references
  { "laws": [...], "judgments": [...] }
  ```
```

The system prompt is dynamically injected with:
- Current date
- Knowledge context from all 6 knowledge sources
- Attached document content (if files uploaded)
- Draft mode instruction (for legal drafting pages)

### 8.4 Streaming Responses

When `stream: true` is sent in the request body, the server uses Server-Sent Events (SSE):

```
Server → Client (SSE format):
data: {"text": "The Pakistan"}\n\n
data: {"text": " Penal Code"}\n\n
data: {"text": " Section 302"}\n\n
data: {"done": true, "model": "gemini-3-flash-preview"}\n\n
```

Frontend reads the stream chunk by chunk, appending to the message content in real time using React state updates.

### 8.5 Reference Cards

The AI is instructed to append a structured JSON block at the end of every response:

````
```references
{
  "laws": [
    { "name": "Pakistan Penal Code", "section": "302", "description": "..." }
  ],
  "judgments": [
    { "citation": "PLD 2019 SC 412", "title": "...", "summary": "..." }
  ]
}
```
````

The frontend component `reference-cards.tsx` parses this block via `parseReferences()`:
1. Uses regex to find the `references` code block
2. Strips it from the displayed message text
3. Renders it as clickable "Relevant Laws" and "Relevant Judgments" cards below the message
4. Cards navigate to `/statute-search?q=...` and `/judgment-search?q=...`

---

## 9. Frontend Architecture

### Routing (Wouter)

All routing happens in `client/src/App.tsx`. The router checks:
1. If route is public (landing, auth, forgot-password, reset-password, shared conversation, privacy, terms, install) → render directly
2. If user is not authenticated → redirect to `/auth`
3. Otherwise → wrap in `AppShell` and render the matching protected page

### AppShell

`client/src/components/app-shell.tsx` renders the sidebar navigation and the main content area for all protected pages. The sidebar contains links to all features and adapts based on screen size (collapsible on mobile).

### ChatModule (Shared Component)

Three pages reuse the same `ChatModule` component from `chat.tsx`:
- `/al-wakeelo` — type `"chat"`, title "Al Wakeelo Engine"
- `/legal-drafting` — type `"draft"`, title "Legal Drafting"
- `/contract-drafting` — type `"contract-drafting"`, used inside split layout

The `type` field changes the system prompt behavior on the backend.

### LegalMarkdown Component

`client/src/components/legal-markdown.tsx` renders AI responses with:
- Standard markdown formatting (bold, italic, headers, lists, code)
- **Statute links**: `**[Statute Name, Year]**` becomes a link to `/statute-search?q=...`
- **Case citation links**: Patterns like `PLD 2019 SC 412` become links to `/judgment-search?q=...`

### State Management

- **React Query**: All server data (no Redux, no Zustand)
- **Local React state**: UI state (input values, modals, loading flags)
- **chatStateStore**: A module-level object that caches chat messages between page navigations (so returning to a chat page doesn't reset the conversation)

---

## 10. Backend Routes Reference

### Auth Routes (`server/replit_integrations/auth/routes.ts`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | No | Register with email/password |
| POST | /api/auth/login | No | Login with email/password |
| POST | /api/auth/logout | No | Destroy session |
| GET | /api/auth/user | Yes | Get current user |
| POST | /api/auth/google/token | No | Google OAuth sign-in |
| GET | /api/auth/google/status | No | Check if Google OAuth is configured |
| POST | /api/auth/forgot-password | No | Request password reset email |
| POST | /api/auth/reset-password | No | Reset password with token |

### Threads & Messages (`server/routes.ts`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/threads | Yes | List user's threads |
| POST | /api/threads | Yes | Create thread + first AI reply |
| GET | /api/threads/:id | Yes | Get thread + all messages |
| DELETE | /api/threads/:id | Yes | Delete thread and messages |
| POST | /api/threads/:id/share | Yes | Generate share token |
| DELETE | /api/threads/:id/share | Yes | Revoke share token |
| POST | /api/threads/save-for-share | Yes | Save conversation for sharing |
| GET | /api/shared/:token | No | Get shared conversation (public) |
| POST | /api/threads/:id/messages | Yes | Send message to existing thread |

### Documents, Bookmarks, History
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/documents | Yes | List user's documents |
| POST | /api/documents | Yes | Upload/create document |
| DELETE | /api/documents/:id | Yes | Delete document |
| GET | /api/bookmarks | Yes | List bookmarks |
| POST | /api/bookmarks | Yes | Save bookmark |
| DELETE | /api/bookmarks/:id | Yes | Delete bookmark |
| GET | /api/search-history | Yes | List search history |
| POST | /api/search-history | Yes | Log a search query |

### Legal Search
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/statutes/search?q= | No | Search statutes DB |
| GET | /api/statute-documents/search?q= | No | Search statute documents |
| GET | /api/statute-documents/:id | No | Get full statute document |
| GET | /api/case-law/search?q= | No | Search case law DB |
| GET | /api/saved-judgments | Yes | List user's saved judgments |
| POST | /api/saved-judgments | Yes | Save a judgment |
| DELETE | /api/saved-judgments/:id | Yes | Delete saved judgment |
| GET | /api/statute-lookup?name=&section= | Yes | Multi-source statute lookup |

### AI Endpoints
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/ai/chat | Yes | Main AI chat (streaming or JSON) |
| POST | /api/ai/transcribe | Yes | Transcribe audio file to text |
| POST | /api/ai/search-judgments | Yes | AI-powered judgment search |
| POST | /api/ai/judgment-summary | Yes | AI analysis of a judgment |
| POST | /api/ai/search-statutes | Yes | AI-powered statute search |
| POST | /api/ai/summarize | Yes | Summarize search findings |
| POST | /api/ai/brief | Yes | Generate detailed legal brief |
| POST | /api/ai/document-chat | Yes | Chat about a specific document |
| POST | /api/statute-documents/:id/toc | Yes | Extract table of contents from statute |

### Apex AI
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/apex/models | Yes | List Apex models available to user's tier |
| POST | /api/apex/chat | Yes | Send message to Apex model |

### Profile & Usage
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/usage | Yes | Get monthly usage stats |
| GET | /api/profile | Yes | Get user profile |
| PATCH | /api/profile | Yes | Update name fields |

### Organization
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/org | Yes | Get user's organization |
| POST | /api/org | Yes (Enterprise) | Create organization |
| DELETE | /api/org/:id | Yes (Owner) | Delete organization |
| GET | /api/org/:id/members | Yes (Member) | List members |
| POST | /api/org/:id/invite | Yes (Owner) | Invite by email |
| GET | /api/org/:id/invites | Yes (Owner) | List pending invites |
| DELETE | /api/org/:id/members/:userId | Yes (Owner) | Remove member |
| GET | /api/org/invites/pending | Yes | Get own pending invites |
| POST | /api/org/invites/:id/accept | Yes | Accept invite |
| POST | /api/org/invites/:id/decline | Yes | Decline invite |
| GET | /api/org/:id/knowledge | Yes (Member) | List org knowledge docs |
| POST | /api/org/:id/knowledge | Yes (Member) | Upload org document |
| DELETE | /api/org/:id/knowledge/:docId | Yes (Owner) | Delete org document |

### Admin (all require isAdmin = true)
| Method | Path | Description |
|---|---|---|
| GET | /api/admin/check | Check if admin exists |
| POST | /api/admin/setup | Claim first admin |
| GET | /api/admin/users | List all users |
| POST | /api/admin/users | Create user |
| PATCH | /api/admin/users/:id | Update user tier/admin |
| DELETE | /api/admin/users/:id | Delete user and all data |
| GET | /api/admin/stats | System statistics |
| GET | /api/admin/cost-analytics | Cost breakdown by feature |
| GET/POST/DELETE | /api/admin/knowledge | Admin knowledge vault CRUD |
| GET/POST/DELETE | /api/admin/case-law | Case law database CRUD |
| POST | /api/admin/case-law/bulk | Bulk import case law |
| POST | /api/admin/case-law/extract | Extract case law from file |
| POST | /api/admin/case-law/auto-extract | Background AI extraction |
| GET/POST/DELETE | /api/admin/statute-documents | Statute documents CRUD |

---

## 11. Feature-by-Feature Flow

### 11.1 Registration & Login

**Registration (email/password)**:
1. User fills out form on `/auth` page
2. Frontend calls `POST /api/auth/register` with `{ email, password, firstName, lastName }`
3. Server checks if email already exists → 409 if duplicate
4. Password hashed with bcryptjs (12 rounds)
5. New `users` row inserted with `subscriptionTier = "free"`, `authProvider = "email"`
6. `req.session.userId = newUser.id` → session created
7. Response: user object (no passwordHash)
8. Frontend invalidates `/api/auth/user` query → React Query refetches → user is now logged in → redirect to `/`

**Login (email/password)**:
1. `POST /api/auth/login` with `{ email, password }`
2. Server finds user by email → 401 if not found
3. `bcrypt.compare(password, user.passwordHash)` → 401 if mismatch
4. If user's authProvider is "google" → 400 (use Google sign-in instead)
5. Session created, user returned

### 11.2 Main AI Chat (Al Wakeelo Engine)

**User action**: Types a message and hits Send on `/al-wakeelo`

**Frontend flow** (`chat.tsx` → `handleSend()`):
1. User message appended to local state immediately (optimistic UI)
2. Input cleared, loading state set
3. If Apex model selected → goes to Apex flow (see §11.8)
4. Otherwise → `POST /api/ai/chat` with:
   - `messages`: Array of `{role, content}` (full conversation history)
   - `type`: `"chat"` (or `"draft"`, `"contract-drafting"`)
   - `turbo`: boolean (Pro/Enterprise users toggle this)
   - `stream`: `true`
5. Response is an SSE stream
6. Frontend reads stream chunks with `ReadableStream.getReader()`
7. Each `data: {text: "..."}` chunk is appended to the assistant message in real time
8. Final `data: {done: true}` signals end of stream
9. After stream ends: logs to `/api/search-history`, invalidates `/api/usage`

**Backend flow** (`POST /api/ai/chat`):
1. `isAuthenticated` middleware → 401 if no session
2. `checkUsageLimit(userId, "chat", res)` → 429 if over limit
3. Parse request: handle both `multipart/form-data` (with files) and `application/json`
4. If files attached: extract text using `unpdf` (PDF) or `mammoth` (DOCX)
5. Build system prompt: `getLegalSystemPrompt()` + optional draft mode instruction
6. `gatherKnowledgeContext(lastUserMessage, userId)` → appends relevant legal content
7. If files: prepend extracted text as "ATTACHED DOCUMENTS FROM USER"
8. Check query cache (SHA-256 hash of first message only)
9. Select model: pro model if `turbo && tier in [pro, enterprise]`, flash otherwise
10. If `stream: true`:
    - Set SSE headers
    - Call `getAI().models.generateContentStream()`
    - Forward each chunk as `data: {text: chunk}\n\n`
    - On 429 from pro model: fallback to flash, re-stream
    - End: `data: {done: true, model: "..."}\n\n`
11. `logUsageCost(userId, "chat", model, inputText, fullContent)`

### 11.3 Judgment Search

**User action**: Types a search query on `/judgment-search`

**Frontend flow**:
1. State: `query`, `localResults`, `externalResults`, `summaries`
2. On Search button click:
   - Calls `GET /api/case-law/search?q=query` → local database results immediately
   - Calls `POST /api/ai/search-judgments` with `{ query }` → AI-powered results
3. Results shown in two tabs: Local Database and AI Search
4. User can click "Get Analysis" on any result → `POST /api/ai/judgment-summary`
5. Summary modal opens with full AI analysis
6. User can save judgment → `POST /api/saved-judgments`
7. User can click judgment card → navigates to `/judgment-view` (data passed via sessionStorage)

**Backend - `/api/ai/search-judgments`**:
1. Check usage limit
2. Gather knowledge context
3. Call Gemini with `responseMimeType: "application/json"`
4. Prompt instructs AI to return array of `{citation, court, title, summary, keywords, uri}`
5. Parse JSON response, return array

**Backend - `/api/ai/judgment-summary`**:
1. Search `githubKnowledge` and `adminKnowledge` for the judgment's full text
2. If full text found: send to Gemini for detailed analysis based on actual text
3. If not found: Gemini generates analysis from general knowledge + disclaimer
4. Returns `{ summary, fullText, source, verified }`

### 11.4 Statute Search & Statute View

**Statute Search** (`/statute-search`):
1. User types in search bar (debounced 300ms)
2. `GET /api/statute-documents/search?q=query` returns matching statute documents
3. Dropdown suggestions shown
4. On selection: navigate to `/statute-view/:id`
5. Common statute buttons also available (hardcoded list, clicking searches for that statute)

**Statute View** (`/statute-view/:id`):
1. On mount: `GET /api/statute-documents/:id` fetches full statute text
2. `POST /api/statute-documents/:id/toc` → AI extracts table of contents structure from document text (returns JSON array of chapters/sections)
3. TOC displayed in left sidebar; clicking a section scrolls to that part of document
4. User can type in chat input at bottom → `POST /api/ai/document-chat` with `{ documentType, documentTitle, documentContent, messages }`
5. Response appended to chat in statute view

**Backend - TOC extraction**:
- Sends first 15,000 chars of statute to Gemini
- Prompt instructs JSON output of TOC structure: `[{title, level, children?}]`
- Response cached in `queryCache` (7-day TTL)

### 11.5 Legal Drafting

`/legal-drafting` renders `ChatModule` with `type="draft"`.

The only difference from regular chat:
- Backend appends to system prompt: `"You are in legal drafting mode. Help draft legal documents in proper Pakistani legal format."`
- Search history logged as type `"draft"`
- Bookmarks saved with type `"draft"`

### 11.6 Contract Drafting

`/contract-drafting` has a split layout:
- Left: List of 16 contract template types
- Right: `ChatModule` with `type="contract-drafting"`

**User selects a template**:
1. `selectedTemplate` state updated
2. `chatKey` incremented → forces ChatModule to re-mount and reset messages
3. `initialMessage` prop set to e.g. `"Draft an Employment Agreement for me."`
4. ChatModule auto-sends this as the first user message on mount

### 11.7 File Attachments & Audio Transcription

**File attachments**:
1. User clicks paperclip icon → `<input type="file">` triggers (accepts .txt, .pdf, .docx)
2. Up to 5 files can be attached; size validation done client-side
3. Files shown as preview chips in input area
4. On send: `FormData` constructed instead of JSON body
5. Backend uses `multer` to receive files
6. Text extraction:
   - `.txt` → read directly
   - `.pdf` → `unpdf` library extracts text from each page
   - `.docx` → `mammoth` library extracts text
7. Extracted text prepended to AI context as "ATTACHED DOCUMENTS FROM USER"

**Audio transcription**:
1. User clicks microphone icon → `<input type="file">` accepts audio (mp3, wav, m4a, webm, ogg)
2. File sent to `POST /api/ai/transcribe`
3. Backend reads file as base64, sends to `gemini-2.0-flash` with `inlineData`
4. Gemini transcribes audio → returns text
5. Transcribed text inserted into the chat input field
6. User can review and edit before sending

### 11.8 Apex AI Models (Kimi K2.5)

**Availability check on mount**:
- `GET /api/apex/models` queried when chat page loads
- Returns `{ available: boolean, models: [...], tier: string }`
- If `available: false` (no MOONSHOT_API_KEY), dropdown is not shown

**User selects Apex model**:
1. "Apex Models" dropdown appears next to the Standard/Turbo toggle
2. User selects a model (e.g., Apex Pro)
3. `selectedApexModel` state set to model ID, `turboMode` set to false
4. UI shows model name in emerald green

**Sending a message with Apex**:
1. `handleSend()` detects `selectedApexModel` is set
2. `POST /api/apex/chat` with `{ model: "apex-pro", message: text }`
3. Backend validates tier access to that model → 403 if not allowed
4. Checks usage limit
5. Fetches conversation history from thread if `threadId` provided
6. Calls `chatWithApex({ model, messages, maxTokens })`
7. `chatWithApex()` in `apex-ai.ts`:
   - Constructs OpenAI-compatible payload with `extra_body: { chat_template_kwargs: { thinking: bool } }`
   - POSTs to Moonshot API at `https://api.moonshot.ai/v1/chat/completions`
   - Returns `{ content, reasoning, model }`
8. Response JSON returned to frontend (not streaming)
9. Frontend handles via existing JSON response path (`data.content`)

### 11.9 Conversation Sharing

**User clicks Share**:
1. Button appears after 2+ messages in chat
2. Click → `POST /api/threads/save-for-share` if no threadId yet (saves in-memory conversation to DB first)
3. Then `POST /api/threads/:id/share` → server generates `crypto.randomBytes(16).toString("hex")` (32-char token)
4. Token stored in `threads.shareToken` column
5. Returns `{ shareToken, shareUrl: "/share/<token>" }`
6. Frontend shows shareable URL; copy button available

**Recipient visits share URL** (`/share/<token>`):
1. `GET /api/shared/:token` (no auth required)
2. Server finds thread by shareToken, fetches all messages
3. Returns `{ title, createdAt, messages[], sharedBy: "User Name" }`
4. Page renders read-only conversation view with reference cards

### 11.10 Bookmarks

**User bookmarks an AI response**:
1. Bookmark icon appears on each assistant message
2. Click → `POST /api/bookmarks` with `{ title: first 60 chars, content: full message, type: "al-wakeelo", category: "legal-advice" }`
3. Bookmark ID stored in local `bookmarkedIds` Set
4. Icon turns filled (saved state)

**Bookmarks page** (`/bookmarks`):
1. `GET /api/bookmarks` → list of all saved bookmarks
2. User can open preview modal, download as .txt, or delete (`DELETE /api/bookmarks/:id`)

### 11.11 Knowledge Vault (User Documents)

**Uploading a document**:
1. User selects file on `/knowledge-vault`
2. File read client-side with `FileReader.readAsText()`
3. `POST /api/documents` with `{ title: filename, content: fileText }`
4. Server sanitizes null bytes, inserts into `documents` table

**How documents are used in AI**:
- Every AI call triggers `gatherKnowledgeContext(query, userId)`
- The function searches `documents` table for content matching the query (ILIKE)
- Up to 2 matching excerpts (1500 chars each) appended to AI system prompt as "USER'S CASE DOCUMENTS"

### 11.12 Search History

Every AI interaction logs to `searchHistory`:
- `POST /api/search-history` called after each successful AI query
- `type`: one of `"chat"`, `"judgment"`, `"statute"`, `"draft"`, `"contract"`
- `query`: first 80 characters of the user's message

The `/history` page shows:
- Recent chat threads (horizontal scroll, click to open thread messages)
- Full search history table with type badge, query text, timestamp

### 11.13 Organization & Team Collaboration

**Creating an organization (Enterprise only)**:
1. `POST /api/org` with `{ name, description }`
2. Server checks user tier is `"enterprise"` or `isAdmin`
3. Checks user doesn't already have an org
4. Creates `organizations` row + `orgMembers` row (owner role)

**Inviting a member**:
1. Owner enters email in invite form
2. `POST /api/org/:id/invite` with `{ email }`
3. `orgInvites` row created with status `"pending"`

**Invited user sees pending invite**:
1. `GET /api/org/invites/pending` checks `orgInvites` WHERE email = current user's email AND status = "pending"
2. User sees invite with org name and owner info
3. Accept → `POST /api/org/invites/:id/accept`:
   - Checks user doesn't already belong to an org
   - Inserts `orgMembers` row
   - Updates invite status to `"accepted"`
4. Decline → `POST /api/org/invites/:id/decline` → updates status

**Organization knowledge base**:
- Members upload files via `POST /api/org/:id/knowledge`
- Files extracted (PDF/DOCX/TXT), stored in `orgKnowledge` table
- `gatherKnowledgeContext()` always includes org knowledge if user is an org member (up to 3 results)
- Only the org owner can delete documents

**Priority API access for Enterprise**:
- `checkUsageLimit()` bypasses monthly limit for enterprise users
- `gatherKnowledgeContext()` always returns org knowledge for enterprise org members
- Pro model auto-selected for enterprise without needing turbo toggle

### 11.14 Admin Panel

The admin panel at `/admin` has 5 tabs:

**Analytics tab**:
- `GET /api/admin/stats` → total users, threads, messages, documents, cache entries, monthly queries
- `GET /api/admin/cost-analytics` → per-feature breakdown of queries, tokens, cost for current month
- Displayed as stat cards + feature cost table with progress bars

**Users tab**:
- `GET /api/admin/users` → all users listed
- Admin can change tier: `PATCH /api/admin/users/:id` with `{ subscriptionTier: "pro" }`
- Admin can toggle admin status (cannot remove own admin)
- Admin can delete user: `DELETE /api/admin/users/:id` → cascades and deletes all user data

**Knowledge Vault tab**:
- `GET/POST/DELETE /api/admin/knowledge`
- Admin uploads .txt, .pdf, .json, .csv files (up to 500 at once)
- Text extracted and stored in `adminKnowledge` table
- These documents feed into `gatherKnowledgeContext()` as high-priority knowledge

**Case Law tab**:
- Full CRUD on the `caseLaw` table
- Bulk import: JSON or CSV file with case law entries
- AI extraction: Upload a PDF/DOCX/TXT, server uses NLP to extract structured case law entries
- Auto-extract: Background job runs Gemini over synced GitHub documents to auto-populate case law

**Statute Library tab**:
- Full CRUD on the `statuteDocuments` table
- PDF/TXT files uploaded, text extracted
- Documents become searchable on `/statute-search` and viewable on `/statute-view`

### 11.15 Password Reset

1. User goes to `/forgot-password`, enters email
2. `POST /api/auth/forgot-password`:
   - Finds user by email (returns same success message even if not found, for security)
   - Generates 32-byte hex token, stores in `password_reset_tokens` (expires in 1 hour)
   - Sends email via Resend API with reset link
3. User clicks link → `/reset-password?token=<token>`
4. `POST /api/auth/reset-password` with `{ token, password }`:
   - Validates token exists, not expired, not used
   - Hashes new password, updates `users.passwordHash`
   - Marks token as used
5. Frontend redirects to `/auth`

---

## 12. Knowledge Context System

**File**: `server/routes.ts` → `gatherKnowledgeContext(query, userId)`

This is the core function that makes the AI know Pakistani law. Called before every AI request.

### Priority Order (highest to lowest)
1. **Internal Statutes DB** — `storage.searchStatutes(query, 3)` → searches `statutes` table
2. **Internal Case Law DB** — `storage.searchCaseLaw(query, 3)` → searches `caseLaw` table
3. **GitHub Legal Library** — searches `githubKnowledge` table (348+ synced legal documents)
4. **Admin Knowledge Vault** — searches `adminKnowledge` table
5. **User's Case Documents** — searches `documents` table filtered by userId
6. **Organization Knowledge** — searches `orgKnowledge` for org members

### Search Mechanism
- All searches use PostgreSQL ILIKE (case-insensitive substring match) on relevant text columns
- Results limited per tier to control token usage
- Each excerpt capped at 1,500 characters

### Output Format
```
=== INTERNAL KNOWLEDGE VAULT: STATUTES ===
[Short Title, Section]: Description. Punishment: ...

=== INTERNAL KNOWLEDGE VAULT: CASE LAW ===
Citation (Court): Title — Summary

=== CHAMBERS LEGAL LIBRARY (CURATED SOURCES) ===
[Filename]: Content excerpt...

=== CHAMBERS KNOWLEDGE VAULT (ADMIN UPLOADED) ===
[Title]: Content excerpt...

=== USER'S CASE DOCUMENTS ===
[Title]: Content excerpt...

=== ORGANIZATION KNOWLEDGE BASE ===
[Title]: Content excerpt...
```

### GitHub Sync (Startup Process)
`server/github-sync.ts`:
1. Fetches file list from GitHub API: `repos/ijlalbintariq/law/git/trees/HEAD?recursive=1`
2. Filters for `.txt` files
3. For each file not already in DB: fetches content, inserts into `githubKnowledge`
4. Skips if already synced (checks by filename)
5. 350 documents currently synced

---

## 13. Caching System

**Table**: `queryCache`  
**TTL**: 7 days  
**Hash**: SHA-256 of normalized query text (lowercase, trimmed)

### What Gets Cached
- First message in a new chat thread
- Standalone AI chat (first message only)
- Judgment searches
- Statute searches
- Summaries and briefs
- TOC extraction

Follow-up messages in a thread are NOT cached (they depend on conversation context).

### Cache Flow
```
Request arrives
    ↓
Normalize query → SHA-256 hash
    ↓
SELECT from queryCache WHERE queryHash = hash AND endpoint = feature
    ↓
Found & not expired?
    ├── Yes → Return cached response, INCREMENT hitCount
    └── No  → Call Gemini API → Store result in queryCache → Return result
```

### Cache Cleanup
- On server startup: `DELETE FROM queryCache WHERE createdAt < NOW() - INTERVAL 7 DAYS`
- Daily interval job repeats the cleanup

---

## 14. Cost Tracking & Analytics

### Token Estimation
```typescript
estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);  // ~4 chars per token
}
```

### Cost Rates (USD per 1K tokens)
| Model | Input | Output |
|---|---|---|
| gemini-3-flash-preview | $0.00015 | $0.0006 |
| gemini-3-pro-preview | $0.00125 | $0.005 |

### Analytics Aggregation
`GET /api/admin/cost-analytics` runs:
```sql
SELECT feature, 
  COUNT(*) as totalQueries,
  SUM(inputTokens) as totalInputTokens,
  SUM(outputTokens) as totalOutputTokens,
  SUM(CAST(estimatedCost AS DECIMAL)) as totalCost
FROM usageTracking
WHERE createdAt >= start_of_current_month
GROUP BY feature
```

---

## 15. PWA & Install Guide

### Service Worker (`client/public/sw.js`)
- Network-first strategy for HTML pages
- Cache fallback for offline access
- Caches static assets on install

### Manifest (`client/public/manifest.json`)
- App name: "Al Wakeelo"
- Theme color: amber/gold
- Display mode: `standalone` (no browser chrome)
- Icons defined for various sizes

### Install Guide Page (`/install`)
A standalone page (no auth required) that shows step-by-step installation instructions for:
- **iOS**: Open in Safari → Share button → "Add to Home Screen" → Add
- **Android**: Open in Chrome → Three-dot menu → "Add to Home Screen" → Install
- **Desktop**: Open in Chrome/Edge → Install icon in address bar → Install

---

## 16. Startup Processes

When the server starts (`server/index.ts`):

1. **Express app initialized** — sessions, body parsers, multer, passport, CORS
2. **Database connection** — Drizzle ORM connects via `DATABASE_URL`
3. **Schema push** — Tables created/synced if not existing
4. **Query cache cleanup** — Expired entries (>7 days) deleted
5. **Search index creation** — PostgreSQL text search indexes verified/created on key tables
6. **GitHub Sync** — `syncGitHubKnowledge()` runs:
   - Fetches file tree from GitHub API
   - Inserts any new `.txt` files not already in `githubKnowledge`
   - Skips if already synced (logs: "Knowledge base already synced (350 documents)")
7. **Vite dev middleware** — In development, Vite HMR middleware integrated into Express
8. **Routes registered** — All auth, API, and static file routes registered
9. **Server listens** on port 5000

---

## 17. Build & Deployment

### Development
```bash
npm run dev
# Runs: NODE_ENV=development tsx server/index.ts
# Vite dev middleware serves frontend with HMR
# Backend serves on port 5000
```

### Production Build
```bash
npm run build
# script/build.mjs runs:
#   1. Vite build → dist/public/ (frontend SPA)
#   2. esbuild → dist/index.cjs (backend bundle)
```

### Production Start
```bash
npm run start
# Runs: node dist/index.cjs
# Serves frontend static files from dist/public/
# All routes handled by the single Express server
```

### Database Migrations
```bash
npm run db:push
# Runs: drizzle-kit push
# Syncs shared/schema.ts to the live PostgreSQL database
# Safe for development — does not drop data
```

### Environment Notes
- In development, Vite dev server runs as Express middleware (same port 5000)
- In production, Express serves the Vite-built static files directly
- All environment variables must be set before starting (see §4)
- The `sessions` and `users` tables must never be dropped — they store active sessions

---

## 18. Case Law Ingestion & Extraction

### 1) Auto-Seeded on First Startup
- If `case_law` is empty, 5 landmark Pakistani cases are inserted automatically (one-time seed)

### 2) Admin Panel → Case Law (Manual Entry)
- Single entry: citation, court, title, summary, keywords → saves to `case_law`
- Bulk import (JSON/CSV): upload many at once; server validates and inserts in batches

### 3) Document Upload → “Extract Case Law”
- Supported formats: PDF, TXT, JSON, CSV
- DOC/DOCX are not parsed; convert to PDF or TXT before upload
- PDF text extracted via `unpdf`; TXT/JSON/CSV read directly
- Extraction pipeline uses Gemini (prompted) to produce:
  - citation, court, title, summary, keywords[]
- Admin sees extracted cases for review before saving

### 4) Background Auto-Extraction
- Trigger from Admin: “Auto Extract” scans existing sources
- Sources scanned:
  - GitHub-synced legal documents
  - Admin Knowledge Vault documents
  - Statute Library documents
- A bounded background queue processes documents and inserts new cases
  - Skips citations already present (in-memory `knownCitations` set)
  - Inserts new items via `bulkCreateCaseLaw()`
- New uploads are queued automatically for extraction

---

## 19. Statutes Ingestion

### 1) Auto-Seeded on First Startup
- If `statutes` is empty, 14 foundational entries are inserted:
  - PPC sections (302, 420, 489-F, 406, 506)
  - CrPC sections (497, 498, 22-A)
  - Constitution (199, 10-A)
  - Family law and Contract Act sections

### 2) Admin Panel → Statute Library (Full Documents)
- Upload full statute PDFs or TXT
- Server stores full text in `statute_documents`
- Auto-queues document for case law extraction as well
- Table of contents generated via AI on demand

### 3) Manual Entry via API
- POST endpoints exist for adding entries directly when needed

---

*This document covers the complete technical architecture of Al Wakeelo as of February 2026. For changes, update both this file and `replit.md`.*

---

## 20. Offline Transcription (No External API)

### Overview
Al Wakeelo supports pure offline speech-to-text using local ffmpeg plus whisper.cpp. No external AI provider is required. The API converts uploaded audio to 16kHz mono WAV and runs whisper.cpp locally to produce a transcript.

### API
- POST /api/transcribe
- Body: `{ "audio": "<base64-audio>" }`
- Response: `{ "text": "..." }` or 503 if not configured
- Code: [audio-local.ts](file:///Users/macbook/Downloads/Alwakeelo/server/audio-local.ts) is registered in [index.ts](file:///Users/macbook/Downloads/Alwakeelo/server/index.ts#L65-L69)

### Requirements
- ffmpeg available on PATH
- whisper.cpp binary and model on disk
- Environment:
  - WHISPER_BIN_PATH: absolute path to the whisper.cpp binary (e.g., /usr/local/bin/whisper)
  - WHISPER_MODEL_PATH: absolute path to the ggml model file (e.g., /opt/whisper/models/ggml-base.en.bin)

### Install (macOS example)
1. Install ffmpeg:
   - brew install ffmpeg
2. Build whisper.cpp:
   - git clone https://github.com/ggerganov/whisper.cpp.git
   - cd whisper.cpp && make
3. Download a model:
   - bash ./models/download-ggml-model.sh base
   - Note the full path to ggml-base.en.bin
4. Set env variables in your process manager or hosting:
   - WHISPER_BIN_PATH=/path/to/whisper.cpp/main
   - WHISPER_MODEL_PATH=/path/to/ggml-base.en.bin

### Client Usage Example
Convert an audio file to base64 and POST:

```bash
node -e "const fs=require('fs'); const b=fs.readFileSync('sample.webm').toString('base64'); fetch('http://localhost:5000/api/transcribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio:b})}).then(r=>r.json()).then(console.log)"
```

### Notes
- Route is safe when not configured: it returns 503 if WHISPER_BIN_PATH or WHISPER_MODEL_PATH are not set.
- The server converts non-WAV inputs to WAV (16kHz mono) via ffmpeg before transcription.
