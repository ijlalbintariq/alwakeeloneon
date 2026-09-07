import { db } from "./server/db";
import { judgments } from "./shared/schema";
import { ilike, eq } from "drizzle-orm";

async function run() {
  const q = "%2026 LHC 2236%";
  const res = await db.select().from(judgments).where(ilike(judgments.citationString, q));
  console.log("DB Matches:", res.length);
  if (res.length > 0) {
    console.log("Title:", res[0].title);
    console.log("Citation:", res[0].citationString);
  }
  process.exit(0);
}
run();
