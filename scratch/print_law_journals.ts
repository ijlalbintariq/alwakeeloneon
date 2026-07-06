import "../server/load-env";
import { db } from "../server/db";
import { lawJournals } from "../shared/schema";

async function run() {
  try {
    const journals = await db.select().from(lawJournals);
    console.log("Law Journals in DB:");
    console.log(journals);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
