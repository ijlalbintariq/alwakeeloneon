# Al Wakeelo UI Design Handoff

This document is a full UI inventory and structure map of the current app implementation.

## 1) Visual Direction

- Product style: premium dark legal workspace
- Core motif: amber accent on deep navy/blue-black surfaces
- Typography:
  - Headings: `Playfair Display`
  - Body/UI: `Inter`
  - Legal draft body style helper: `Gentium Book Plus` (`.legal-draft-font`)
- Theme mode:
  - Dark-only runtime theme (theme hook is locked to dark mode)
- Key visual effects:
  - Glassmorphism panels (`.glass-shell`, `.glass-surface`, `.glass-soft`)
  - Soft glow/shadow layers
  - Compact app shell density (`.app-ui-compact`)

## 2) Core Theme Tokens

Defined in [client/src/index.css](/Users/macbook/Downloads/Alwakeelo/client/src/index.css).

- Base palette:
  - `--background: 222 47% 6%`
  - `--foreground: 210 40% 92%`
  - `--primary / --accent: 38 92% 50%` (amber)
  - `--secondary: 217 33% 17%`
  - `--card: 215 42% 15%`
  - `--border: 217 33% 20%`
- Font variables:
  - `--font-sans`, `--font-heading`, `--font-serif`, `--font-mono`
- Preview/UI skin tokens:
  - `--preview-bg`, `--preview-surface`, `--preview-border`, `--preview-accent-amber`, etc.

Tailwind extension is in [tailwind.config.ts](/Users/macbook/Downloads/Alwakeelo/tailwind.config.ts), wired to these CSS variables.

## 3) Layout Architecture

Main shell: [client/src/components/app-shell.tsx](/Users/macbook/Downloads/Alwakeelo/client/src/components/app-shell.tsx)

- Left sidebar navigation (collapsible, icon+label)
- Sticky top bar with user identity
- Main content surface with dynamic padding by route
- Full-height app frame (`h-[100dvh]`)
- Wide/edge layouts for:
  - `/al-wakeelo`
  - `/legal-drafting`
  - `/contract-drafting`
  - `/case-documents`
  - `/knowledge-vault`
  - `/organization`

## 4) Route Map (Actual Runtime)

Defined in [client/src/App.tsx](/Users/macbook/Downloads/Alwakeelo/client/src/App.tsx).

### Public Routes

- `/` -> Landing
- `/auth` -> Auth
- `/sign-in`, `/login` -> redirect to `/auth?mode=login`
- `/sign-up`, `/register`, `/signup` -> redirect to `/auth?mode=register`
- `/forgot-password`
- `/reset-password...`
- `/share/:id`
- `/privacy`
- `/terms`
- `/cancellation-return-refund-policy`
- `/ownership-statement`
- `/install`
- `/checkout...`

### Protected Routes (inside AppShell)

- `/dashboard`
- `/judgments`
- `/judgment-search` -> legacy redirect to `/judgments`
- `/judgment-view`
- `/citation-search` -> legacy redirect to `/judgments`
- `/judgment/:id`
- `/statute-search`
- `/statute-view/:id`
- `/al-wakeelo`
- `/legal-drafting`
- `/contract-drafting`
- `/case-documents`
- `/bookmarks`
- `/history`
- `/knowledge-vault`
- `/organization` (tier/admin-gated)
- `/admin`
- `/settings`

## 5) Sidebar Navigation (Primary UX IA)

Configured in [app-shell.tsx](/Users/macbook/Downloads/Alwakeelo/client/src/components/app-shell.tsx).

- Chambers Dashboard
- Judgments
- Statute Search
- Al Wakeelo Engine
- Legal Drafting
- Contract Drafting
- Case Documents
- Bookmarks
- Search History
- Knowledge Vault
- Organization (conditional)
- Footer actions: Admin Panel (conditional), Settings, Logout

## 6) Page Inventory (32 Page Files)

From `client/src/pages/`:

- `admin-panel.tsx`
- `admin-setup.tsx`
- `auth.tsx`
- `bookmarks.tsx`
- `cancellation-return-refund-policy.tsx`
- `case-documents.tsx`
- `chat.tsx`
- `checkout.tsx`
- `citation-search.tsx`
- `contract-drafting.tsx`
- `dashboard.tsx`
- `documents.tsx`
- `forgot-password.tsx`
- `history.tsx`
- `install-app.tsx`
- `judgment-detail.tsx`
- `judgment-search.tsx`
- `judgment-view.tsx`
- `judgments.tsx`
- `knowledge-vault.tsx`
- `landing.tsx`
- `legal-drafting.tsx`
- `not-found.tsx`
- `organization.tsx`
- `ownership-statement.tsx`
- `privacy.tsx`
- `reset-password.tsx`
- `shared-conversation.tsx`
- `statute-search.tsx`
- `statute-view.tsx`
- `terms.tsx`
- `user-panel.tsx`

Note:
- `judgment-search.tsx`, `citation-search.tsx`, `documents.tsx` exist in codebase, while routing currently redirects/uses other pages for main flows.

## 7) Shared Component Inventory

### App-level Components (8)

From `client/src/components/`:

- `app-shell.tsx`
- `chat-dock.tsx`
- `document-viewer.tsx`
- `layout-shell.tsx`
- `legal-markdown.tsx`
- `public-legal-chat-widget.tsx`
- `reference-cards.tsx`
- `style-memory-panel.tsx`

### UI Primitive Library (47)

From `client/src/components/ui/`:

- `accordion`, `alert-dialog`, `alert`, `aspect-ratio`, `avatar`
- `badge`, `breadcrumb`, `button`
- `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`
- `dialog`, `drawer`, `dropdown-menu`
- `form`
- `hover-card`
- `input`, `input-otp`
- `label`
- `menubar`
- `navigation-menu`
- `pagination`, `popover`, `progress`
- `radio-group`, `resizable`
- `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `switch`
- `table`, `tabs`, `textarea`, `toast`, `toaster`, `toggle`, `toggle-group`, `tooltip`

## 8) Major UX Modules

### A) Al Wakeelo Engine (Chat)
File: [chat.tsx](/Users/macbook/Downloads/Alwakeelo/client/src/pages/chat.tsx)

- Multi-mode AI selector (`standard`, `turbo`, `apex-pro`, `apex-agent`, `apex-agent-web`)
- Left/right rail layout
- Attachments, audio upload/transcription hooks
- Message bookmarks, share links, citations/reference cards
- RAG-aware message metadata and citation parsing

### B) Legal Drafting
File: [legal-drafting.tsx](/Users/macbook/Downloads/Alwakeelo/client/src/pages/legal-drafting.tsx)

- Court filing type templates (civil, criminal, high court, supreme court, custom)
- Draft recommendations and suggestions workflow
- Legal references payload:
  - Case law refs
  - Statute refs
  - Removed/unresolved refs
- Document viewer and style memory panel integration

### C) Contract Drafting
File: [contract-drafting.tsx](/Users/macbook/Downloads/Alwakeelo/client/src/pages/contract-drafting.tsx)

- Clause library catalog
- Risk/compliance checks and redline flow
- Contract form state and autosave
- Download/print/compare UX affordances

### D) Judgments + Statutes + Knowledge

- `judgments.tsx`, `judgment-view.tsx`, `judgment-detail.tsx`
- `statute-search.tsx`, `statute-view.tsx`
- `knowledge-vault.tsx`
- Unified dark premium data-search style with citation/document panels

### E) Admin/Operations UI

- `admin-panel.tsx` (high-density operational interface)
- `admin-setup.tsx`
- premium admin CSS skin in `index.css` (`.admin-panel-premium` section)

## 9) Auth UX Summary

File: [auth.tsx](/Users/macbook/Downloads/Alwakeelo/client/src/pages/auth.tsx)

- Login/register dual mode in one view
- Google OAuth CTA
- Terms acceptance gate for register mode
- Password visibility toggle
- Forgot/reset/password verification support
- URL mode support (`?mode=login|register`) via `/sign-in` and `/sign-up`

## 10) Responsive + Runtime Notes

- Root font-size scales:
  - desktop: `15px`
  - <=1024px: `14.5px`
  - <=640px: `14px`
- Splash screen hides on app-ready callback + safety timeout
- Query + toast providers wrap entire app
- Global public legal chat widget mounted app-wide

## 11) Legal/Policy Surface Pages

- Terms
- Privacy
- Cancellation/Return/Refund
- Ownership Statement

Current ownership statement text now includes:
- “Al Wakeelo is owned and operated by Majnoon Studio.”

## 12) Where to Edit What (Quick Index)

- Global theme tokens: [index.css](/Users/macbook/Downloads/Alwakeelo/client/src/index.css)
- Tailwind variable wiring: [tailwind.config.ts](/Users/macbook/Downloads/Alwakeelo/tailwind.config.ts)
- Route behavior: [App.tsx](/Users/macbook/Downloads/Alwakeelo/client/src/App.tsx)
- Auth page UI: [auth.tsx](/Users/macbook/Downloads/Alwakeelo/client/src/pages/auth.tsx)
- Main shell/nav: [app-shell.tsx](/Users/macbook/Downloads/Alwakeelo/client/src/components/app-shell.tsx)
- Module UIs:
  - Chat: [chat.tsx](/Users/macbook/Downloads/Alwakeelo/client/src/pages/chat.tsx)
  - Legal Drafting: [legal-drafting.tsx](/Users/macbook/Downloads/Alwakeelo/client/src/pages/legal-drafting.tsx)
  - Contract Drafting: [contract-drafting.tsx](/Users/macbook/Downloads/Alwakeelo/client/src/pages/contract-drafting.tsx)

