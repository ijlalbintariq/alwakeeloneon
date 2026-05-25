import "../server/load-env";
import { db, pool } from "../server/db";
import { statuteDocuments } from "../shared/schema";

async function main() {
  console.log("==========================================");
  console.log("🔍 INSPECTING FORMAT SAMPLES");
  console.log("==========================================");

  const docs = await db.select().from(statuteDocuments).limit(20);
  for (const doc of docs) {
    console.log(`ID: ${doc.id} | Title: "${doc.title}" | Length: ${doc.content.length}`);
    console.log("First 1000 characters:");
    console.log("-----------------------------------------");
    console.log(doc.content.substring(0, 1000));
    console.log("-----------------------------------------\n");
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("Error:", err);
  await pool.end();
});
