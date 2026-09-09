/**
 * Safe raw SQL migration for Engine Intelligence columns.
 * Adds authority_score + is_overruled to judgments & case_law,
 * and treatment to citation_links. Idempotent — safe to re-run.
 *
 * Usage: npx tsx script/migrate-engine.ts
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[migrate-engine] Starting...");

  const statements = [
    // judgments
    `ALTER TABLE judgments ADD COLUMN IF NOT EXISTS authority_score DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `ALTER TABLE judgments ADD COLUMN IF NOT EXISTS is_overruled BOOLEAN NOT NULL DEFAULT false`,
    // case_law
    `ALTER TABLE case_law ADD COLUMN IF NOT EXISTS authority_score DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `ALTER TABLE case_law ADD COLUMN IF NOT EXISTS is_overruled BOOLEAN NOT NULL DEFAULT false`,
    // citation_links
    `ALTER TABLE citation_links ADD COLUMN IF NOT EXISTS treatment TEXT NOT NULL DEFAULT 'cited'`,
  ];

  for (const stmt of statements) {
    try {
      await db.execute(sql.raw(stmt));
      console.log(`  OK: ${stmt.slice(0, 80)}...`);
    } catch (err: any) {
      console.error(`  FAIL: ${stmt.slice(0, 80)}...`);
      console.error(`    ${err?.message || err}`);
    }
  }

  console.log("[migrate-engine] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate-engine] FATAL:", err);
  process.exit(1);
});