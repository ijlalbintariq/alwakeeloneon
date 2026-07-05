import { db } from "../server/db";
import { caseLaw } from "../shared/schema";
import { ilike } from "drizzle-orm";

async function check() {
  console.log("Checking case_law table for citation 2026 CLC 424...");
  try {
    const rows = await db.select().from(caseLaw).where(ilike(caseLaw.citation, "%2026 CLC 424%"));
    console.log(`Found ${rows.length} rows in case_law:`);
    for (const row of rows) {
      console.log("- ID:", row.id);
      console.log("  Citation:", row.citation);
      console.log("  Title:", row.title);
      console.log("  Court:", row.court);
    }
  } catch (err) {
    console.error("Error querying DB:", err);
  } finally {
    process.exit(0);
  }
}

check();
