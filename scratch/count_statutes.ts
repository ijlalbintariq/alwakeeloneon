import "../server/load-env";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Checking statutes count...");
  const countRes = await db.execute(sql`SELECT count(*)::integer FROM statutes`);
  console.log("Total statutes:", countRes.rows[0].count);

  try {
    const missingRes = await db.execute(sql`
      SELECT count(*)::integer FROM statutes WHERE embedding IS NULL
    `);
    console.log("Statutes with NULL embedding:", missingRes.rows[0].count);
  } catch (err: any) {
    console.log("embedding column might not exist yet:", err?.message || err);
  }
}

main().catch(console.error);
