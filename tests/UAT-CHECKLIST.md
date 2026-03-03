# Production UAT Checklist (Desktop + Mobile)

## Preconditions
- Production build deployed with `NODE_ENV=production`.
- Database connected and seeded.
- At least one admin account available.
- Test accounts prepared: `free`, `pro`, `enterprise`, and one banned user.

## Core User Flows
1. Register, login, logout, forgot/reset password.
2. Open chat, send normal query, upload TXT/PDF/DOCX attachment, verify response and references.
3. Verify legal disclaimer visible in chat and drafting pages.
4. Create/edit/delete documents in Knowledge Vault.
5. Search statutes and case law, open source previews.

## Security & Abuse Flows
1. Upload invalid-signature file (e.g., fake `.pdf`) and verify rejection.
2. Upload known-malware sample in staging (EICAR) and verify scanner behavior.
3. Admin ban user; banned user must get `403` on login and API requests.
4. Admin unban user; user regains access.
5. Confirm audit logs contain create/update/delete/ban/unban events.
6. Confirm security events stream shows repeated auth/upload anomalies.

## Admin Flows
1. Add/edit/delete users and tier changes.
2. Suspend/reactivate users with reason.
3. Add/edit/delete case law entries and bulk extraction.
4. Upload/delete statute documents and knowledge documents.
5. Delete-all actions for Knowledge Vault, Case Law, and Statute Library.

## Performance & UX
1. Verify first load and route transitions on desktop and mobile.
2. Confirm lazy-loaded pages render without blank-state regressions.
3. Verify no critical console errors in browser devtools.
4. Check responsiveness for chat, drafting, admin pages (iPhone + Android widths).

## Sign-off Gates
- No critical/high vulnerabilities open.
- No P0/P1 functional regressions.
- Build, typecheck, unit tests, and E2E tests pass.
- UAT evidence captured (screenshots + timestamped run notes).

