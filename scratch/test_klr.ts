import "../server/load-env";
import { db } from "../server/db";
import { caseLaw } from "../shared/schema";
import { sql } from "drizzle-orm";

async function run() {
  try {
    const klr = await db.select().from(caseLaw)
      .where(sql`citation ilike '%KLR%'`)
      .limit(10);
    console.log("KLR samples in case_law:");
    console.log(klr.map((r: any) => r.citation));

    const revenue = await db.select().from(caseLaw)
      .where(sql`citation ilike '%1987%' and citation ilike '%Revenue%'`)
      .limit(10);
    console.log("1987 Revenue samples:");
    console.log(revenue.map((r: any) => r.citation));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
