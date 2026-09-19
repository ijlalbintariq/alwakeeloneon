/**
 * Seeds blog_posts from the bundled articles in shared/blog-data.ts.
 *
 * Run migrations/0009_create_blog_posts.sql first.
 * Re-running is safe: rows are matched on slug and updated in place.
 *
 *   npx tsx scripts/seed-blog-posts.ts            # dry run, prints what it would write
 *   npx tsx scripts/seed-blog-posts.ts --apply    # writes
 */

import "../server/load-env";
import { Pool } from "pg";
import { BLOG_ARTICLES } from "../shared/blog-data";

const apply = process.argv.includes("--apply");

function parseReadTime(value: string): number {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 5;
}

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 4,
  });

  try {
    const exists = await pool.query("SELECT to_regclass('public.blog_posts') AS t");
    if (!exists.rows[0]?.t) {
      throw new Error("blog_posts does not exist — run migrations/0009_create_blog_posts.sql first");
    }

    console.log(`${apply ? "Seeding" : "Dry run:"} ${BLOG_ARTICLES.length} articles`);

    let written = 0;
    for (const article of BLOG_ARTICLES) {
      if (!apply) {
        console.log(`  ${article.slug} (${article.category}, ${parseReadTime(article.readTime)} min)`);
        continue;
      }
      await pool.query(
        `INSERT INTO blog_posts (title, slug, summary, content, category, author, read_time, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'published', COALESCE($8::timestamp, now()))
         ON CONFLICT (slug) DO UPDATE SET
           title = EXCLUDED.title,
           summary = EXCLUDED.summary,
           content = EXCLUDED.content,
           category = EXCLUDED.category,
           read_time = EXCLUDED.read_time,
           updated_at = now()`,
        [
          article.title,
          article.slug,
          article.summary,
          article.content,
          article.category,
          "Al Wakeelo Legal",
          parseReadTime(article.readTime),
          article.publishedAt || null,
        ],
      );
      written += 1;
    }

    if (apply) {
      const total = await pool.query("SELECT count(*)::int AS n FROM blog_posts");
      console.log(`Wrote ${written} articles. blog_posts now holds ${total.rows[0].n} rows.`);
    } else {
      console.log("\nNothing written. Re-run with --apply.");
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
