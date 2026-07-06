import "../server/load-env";
import { db } from "../server/db";
import { statutes } from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";

async function run() {
  try {
    console.log("Limitation Act sample sections:");
    const lim = await db.select().from(statutes)
      .where(sql`short_title ilike '%limitation%'`)
      .limit(5);
    console.log(lim);

    console.log("CPC sample sections:");
    const cpc = await db.select().from(statutes)
      .where(sql`short_title ilike '%civil procedure%'`)
      .limit(5);
    console.log(cpc);

    console.log("CPC Orders sample sections:");
    const cpcOrders = await db.select().from(statutes)
      .where(and(
        sql`short_title ilike '%civil procedure%'`,
        sql`section ilike 'Order%'`
      ))
      .limit(5);
    console.log(cpcOrders);

    console.log("PPC sample sections:");
    const ppc = await db.select().from(statutes)
      .where(sql`short_title ilike '%penal code%'`)
      .limit(5);
    console.log(ppc);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
