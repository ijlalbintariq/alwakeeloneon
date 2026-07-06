import "../server/load-env";
import { db } from "../server/db";
import { statutes } from "../shared/schema";
import { sql } from "drizzle-orm";

async function run() {
  try {
    const distinctStatutes = await db.select({
      shortTitle: statutes.shortTitle,
      count: sql`count(*)`
    }).from(statutes).groupBy(statutes.shortTitle).orderBy(sql`count(*) DESC`);
    
    console.log("Distinct statutes in DB:", distinctStatutes.length);
    console.log("Top 30 statutes by section count:");
    console.log(distinctStatutes.slice(0, 30));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
