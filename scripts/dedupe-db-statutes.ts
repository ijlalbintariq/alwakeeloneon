import "../server/load-env";
import { db, pool } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("==========================================");
  console.log("🧹 RUNNING DATABASE DEDUPLICATION SCRIPT");
  console.log("==========================================");

  try {
    // We execute the delete query to remove duplicates keeping only the smallest id
    const result = await db.execute(sql`
      DELETE FROM statutes
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM statutes
        GROUP BY short_title, section
      )
    `);

    console.log("✅ Successfully deduplicated statutes table in PostgreSQL.");
    console.log(result);
  } catch (error) {
    console.error("❌ Error during deduplication:", error);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

main().catch((err) => {
  console.error("Fatal Error in deduplication:", err);
  process.exit(1);
});
