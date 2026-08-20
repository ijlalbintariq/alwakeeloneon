-- Phase 1 Migration: Court Cause Lists System

CREATE TABLE IF NOT EXISTS "cause_list_scrape_runs" (
  "id" serial PRIMARY KEY,
  "court" text NOT NULL,
  "bench" text NOT NULL,
  "target_date" text NOT NULL,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "finished_at" timestamp,
  "status" text DEFAULT 'running' NOT NULL,
  "http_status" integer,
  "source_url" text,
  "documents_found" integer DEFAULT 0 NOT NULL,
  "documents_parsed" integer DEFAULT 0 NOT NULL,
  "items_extracted" integer DEFAULT 0 NOT NULL,
  "items_inserted" integer DEFAULT 0 NOT NULL,
  "items_updated" integer DEFAULT 0 NOT NULL,
  "error_message" text,
  "raw_metadata" jsonb
);

CREATE TABLE IF NOT EXISTS "court_cause_lists" (
  "id" serial PRIMARY KEY,
  "court" text NOT NULL,
  "bench" text NOT NULL,
  "court_number" text,
  "judge_name" text NOT NULL,
  "list_type" text DEFAULT 'regular' NOT NULL,
  "hearing_date" timestamp NOT NULL,
  "source_hash" varchar(64),
  "revision_number" integer DEFAULT 1 NOT NULL,
  "raw_pdf_url" text,
  "storage_key" text,
  "status" text DEFAULT 'active' NOT NULL,
  "supersedes_list_id" integer,
  "item_count" integer DEFAULT 0 NOT NULL,
  "scraped_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "court_cause_lists_roster_unique_idx"
  ON "court_cause_lists" ("court", "bench", "hearing_date", "court_number", "list_type", "revision_number");

CREATE INDEX IF NOT EXISTS "court_cause_lists_court_bench_date_idx"
  ON "court_cause_lists" ("court", "bench", "hearing_date");

CREATE TABLE IF NOT EXISTS "court_cause_list_items" (
  "id" serial PRIMARY KEY,
  "cause_list_id" integer REFERENCES "court_cause_lists"("id") ON DELETE CASCADE NOT NULL,
  "serial_number" integer,
  "case_number" text NOT NULL,
  "case_type" text,
  "case_year" integer,
  "case_title" text NOT NULL,
  "petitioner" text,
  "respondent" text,
  "petitioner_advocate" text,
  "respondent_advocate" text,
  "fixation_purpose" text,
  "is_red_list" boolean DEFAULT false NOT NULL,
  "raw_text" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "court_cause_list_items_unique_idx"
  ON "court_cause_list_items" ("cause_list_id", "serial_number", "case_number");

CREATE INDEX IF NOT EXISTS "court_cause_list_items_case_number_idx"
  ON "court_cause_list_items" ("case_number");

CREATE TABLE IF NOT EXISTS "cause_list_trackers" (
  "id" serial PRIMARY KEY,
  "user_id" varchar REFERENCES "users"("id") ON DELETE CASCADE NOT NULL,
  "track_type" text NOT NULL,
  "query" text NOT NULL,
  "court" text,
  "notify_email" boolean DEFAULT true NOT NULL,
  "notify_daily_diary" boolean DEFAULT true NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Add cause_list_item_id to diary_entries if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diary_entries' AND column_name = 'cause_list_item_id'
  ) THEN
    ALTER TABLE "diary_entries" ADD COLUMN "cause_list_item_id" integer REFERENCES "court_cause_list_items"("id") ON DELETE SET NULL;
  END IF;
END $$;
