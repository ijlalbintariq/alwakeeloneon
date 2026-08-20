-- Migration: 0008_create_google_calendar_table
-- Description: Create user_google_calendar_connections table and add google_event_id to diary_entries

CREATE TABLE IF NOT EXISTS "user_google_calendar_connections" (
  "id" SERIAL PRIMARY KEY,
  "user_id" VARCHAR NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "email" TEXT,
  "access_token" TEXT NOT NULL,
  "refresh_token" TEXT,
  "token_expiry" TIMESTAMP,
  "scope" TEXT,
  "calendar_id" TEXT NOT NULL DEFAULT 'primary',
  "auto_sync_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "sync_reminders_minutes" INTEGER NOT NULL DEFAULT 60,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Add google_event_id to diary_entries for two-way sync reference
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'diary_entries' AND column_name = 'google_event_id'
  ) THEN 
    ALTER TABLE "diary_entries" ADD COLUMN "google_event_id" TEXT;
  END IF;
END $$;
