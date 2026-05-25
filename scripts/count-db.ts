import "../server/load-env";
import { db } from "../server/db";
import { statutes, judgments, caseLaw } from "../shared/schema";
import { sql } from "drizzle-orm";
import { pool } from "../server/db";

async function main() {
  const statutesCount = await db.select({ count: sql<number>`count(*)` }).from(statutes);
  const judgmentsCount = await db.select({ count: sql<number>`count(*)` }).from(judgments);
  const caseLawCount = await db.select({ count: sql<number>`count(*)` }).from(caseLaw);

  console.log("==========================================");
  console.log("🚀 Neon PostgreSQL Live Database Stats");
  console.log("==========================================");
  console.log(`- Total Statutes Indexed:  ${statutesCount[0]?.count}`);
  console.log(`- Total Judgments Indexed: ${judgmentsCount[0]?.count}`);
  console.log(`- Total Case Law Indexed:  ${caseLawCount[0]?.count}`);
  console.log("==========================================");

  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
});
