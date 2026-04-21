-- Migration: Add document classification and fallback extraction fields to case_law table
-- Timestamp: 2026-04-19

-- Add 3 new columns to case_law table for fallback document classification
ALTER TABLE case_law
ADD COLUMN document_classification TEXT DEFAULT 'case_law' NOT NULL,
ADD COLUMN fallback_extraction BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN statute_references TEXT[] NOT NULL;

-- Create index for fallback extraction queries
CREATE INDEX case_law_fallback_extraction_idx ON case_law(fallback_extraction);

-- Create index for document classification queries
CREATE INDEX case_law_document_classification_idx ON case_law(document_classification);

-- Create GIN index for statute_references array searches (PostgreSQL specific)
CREATE INDEX case_law_statute_references_idx ON case_law USING GIN(statute_references);
