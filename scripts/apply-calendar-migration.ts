import { db } from "../server/db";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function applyMigration() {
  console.log("Applying Migration 0008: Google Calendar Connections...");
  if (!db) {
    console.error("Database connection unavailable.");
    process.exit(1);
  }

  const sqlPath = path.resolve(process.cwd(), "migrations/0008_create_google_calendar_table.sql");
  const sqlContent = fs.readFileSync(sqlPath, "utf-8");

  await db.execute(sql.raw(sqlContent));
  console.log("✅ Migration 0008 applied successfully to Neon database!");
  process.exit(0);
}

applyMigration().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
