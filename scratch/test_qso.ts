import "../server/load-env";
import { db } from "../server/db";
import { statutes } from "../shared/schema";
import { sql } from "drizzle-orm";

async function run() {
  try {
    const qso = await db.select({
      shortTitle: statutes.shortTitle,
      count: sql`count(*)`
    }).from(statutes)
      .where(sql`short_title ilike '%shahadat%' or short_title ilike '%qso%'`)
      .groupBy(statutes.shortTitle);
    console.log("QSO short titles in DB:", qso);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
