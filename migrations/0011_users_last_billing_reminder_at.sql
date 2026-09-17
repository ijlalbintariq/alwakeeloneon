-- shared/models/auth.ts declares users.lastBillingReminderAt (added with the
-- duplicate-reminder lock in commit 20faf04) but no migration ever created the
-- column in the database. Every query Drizzle builds for the users table names
-- it, so login, registration and /api/auth/user all failed with
--   column "last_billing_reminder_at" of relation "users" does not exist  (42703)
--
-- Nullable with no default, so this is a catalogue-only change: no table
-- rewrite, no lock beyond the brief ACCESS EXCLUSIVE to update the catalogue.

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_billing_reminder_at timestamp;
