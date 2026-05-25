import "../server/load-env";
import { db, pool } from "../server/db";
import { statuteDocumentFiles, statuteDocuments } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("==========================================");
  console.log("🔍 QUERYING STATUTE DOCUMENT FILES");
  console.log("==========================================");

  const files = await db.select().from(statuteDocumentFiles).limit(5);
  for (const f of files) {
    console.log(`File ID: ${f.id}`);
    console.log(`  StatuteDocID: ${f.statuteDocumentId}`);
    console.log(`  Provider: ${f.provider}`);
    console.log(`  Bucket: ${f.bucket}`);
    console.log(`  ObjectKey: ${f.objectKey}`);
    console.log(`  ExtractedTextKey: ${f.extractedTextKey}`);
    console.log(`  PublicUrl: ${f.publicUrl}`);
    console.log(`  SizeBytes: ${f.sizeBytes}`);
    console.log("-----------------------------------------");
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("Error in query:", err);
  await pool.end();
});
