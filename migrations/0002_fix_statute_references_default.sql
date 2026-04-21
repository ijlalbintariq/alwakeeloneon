-- Migration: Fix statute_references column default
-- Removes the problematic DEFAULT '{}' from statute_references column

ALTER TABLE case_law
ALTER COLUMN statute_references DROP DEFAULT;
