# Project: Alwakeelo Phone & Thread Fixes

This project covers the implementation of phone number collection during user registration, integrating it with the Admin Portal user list and CSV exports, unlocking the Activity log button for all administrators, and fixing consultation thread truncation with a Show More/Less toggle.

## Architecture
- **Auth Schema**: Defines user attributes in `shared/models/auth.ts` using Drizzle ORM.
- **Frontend SPA**: React client using Tailwind CSS. Major files: `client/src/pages/auth.tsx` (Sign Up) and `client/src/pages/admin-panel.tsx` (Admin User List, User Activity, Thread View).
- **Backend Server**: Node/Express server. Registration handles in `server/replit_integrations/auth/routes.ts`, and Admin manual user creation in `server/routes.ts`.

## Milestones

| # | Name | Scope / Modules | Dependencies | Status | Conversation ID |
|---|------|-----------------|--------------|--------|-----------------|
| 1 | DB Schema & Backend Validation | Schema update, registration validation, manual creation validation | None | DONE | 3e341955-6421-4172-b5b6-58ba7bf14ac4 |
| 2 | Registration UI | Sign up form phone number input field & premium icon styling | M1 | DONE | 3e341955-6421-4172-b5b6-58ba7bf14ac4 |
| 3 | Admin User List & CSV | Phone number display in admin panel and CSV exporting | M1 | DONE | 3e341955-6421-4172-b5b6-58ba7bf14ac4 |
| 4 | Activity & Thread Fixes | Unlock Activity button toggle and add Show More/Less toggle for thread truncation | None | DONE | 3e341955-6421-4172-b5b6-58ba7bf14ac4 |
| 5 | E2E Testing & Verification | TypeScript compile checks and full test runs | M1, M2, M3, M4 | DONE | fcc995cb-fe99-476f-85f3-d9088a6db883, 23a41cd7-e163-4700-a667-eb10d36d2721, 6fdc9119-9f09-4c34-9502-475066dbc7ce |

## Interface Contracts
- **Registration**: `/api/auth/register` (POST) requires `{ username, password, email, phoneNumber }`.
- **Admin User Creation**: `/api/admin/users` (POST) requires `{ username, password, email, role, phoneNumber }`.
- **User Record**: `users` database table contains `phoneNumber` (nullable varchar).

## Code Layout
- `shared/models/auth.ts`: Authentication Drizzle schema and TS types.
- `server/replit_integrations/auth/routes.ts`: Register endpoint and validation schema.
- `server/routes.ts`: Admin API endpoints (including manual user creation).
- `client/src/pages/auth.tsx`: Frontend authentication form.
- `client/src/pages/admin-panel.tsx`: Frontend administrative panel.
