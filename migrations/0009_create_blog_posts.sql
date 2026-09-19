-- Create the blog_posts table.
--
-- Why: shared/schema.ts has declared blogPosts for a while and /api/blogs reads it,
-- but the table was never created in the database, so both blog endpoints returned
-- 500 "Failed to fetch blogs" on every request:
--
--   GET /api/blogs                -> 500
--   GET /api/blogs/<slug>         -> 500
--   psql: relation "blog_posts" does not exist
--
-- Columns mirror shared/schema.ts exactly.
--
-- After this runs, seed the 48 bundled articles with:
--   npx tsx scripts/seed-blog-posts.ts
--
-- Rollback: DROP TABLE blog_posts;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS blog_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  summary         TEXT NOT NULL,
  content         TEXT NOT NULL,
  category        TEXT NOT NULL,
  author          TEXT NOT NULL,
  read_time       INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'published',
  featured_image  TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts (status);
