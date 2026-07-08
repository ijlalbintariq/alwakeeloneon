import "../server/load-env";
import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { storage } from "../server/storage";
import { getR2ObjectText } from "../server/r2-storage";
import { cleanLegalDocumentText } from "../server/rag/text-cleaner";
import { ensureRagSchema } from "../server/rag/vector-store";

async function main() {
  console.log("1. Initializing DB schema check...");
  await ensureRagSchema();
  console.log("✓ Schema checked.");

  console.log("2. Querying only the first statute document's metadata to prevent memory overflow...");
  // Query only the first document using a limit of 1
  const docResult = await db.execute(sql`SELECT id, title, content FROM statute_documents ORDER BY id ASC LIMIT 1`);
  if (docResult.rows.length === 0) {
    console.log("No statute documents found in DB!");
    return;
  }

  const doc = docResult.rows[0] as any;
  console.log(`Targeting doc: id=${doc.id}, title="${doc.title}"`);

  console.log("3. Fetching file metadata from storage...");
  const fileMeta = await storage.getStatuteDocumentFile(doc.id);
  console.log("File metadata:", JSON.stringify(fileMeta, null, 2));

  let sourceText = doc.content || "";
  console.log(`Initial content length: ${sourceText.length} chars`);

  if (fileMeta?.extractedTextKey) {
    console.log(`4. Fetching text from R2 with key: ${fileMeta.extractedTextKey}...`);
    try {
      const fullText = await getR2ObjectText(fileMeta.extractedTextKey);
      console.log(`R2 text fetched successfully. Length: ${fullText?.length || 0} chars`);
      if (fullText) sourceText = fullText;
    } catch (e: any) {
      console.error("R2 fetch failed:", e.message);
    }
  } else {
    console.log("No extractedTextKey found. Using content from DB.");
  }

  console.log("5. Cleaning text...");
  const cleaned = cleanLegalDocumentText(sourceText);
  console.log(`Cleaned text length: ${cleaned?.length || 0} chars`);

  console.log("6. Calling indexAdminStatuteDocument directly...");
  const { indexAdminStatuteDocument } = await import("../server/rag/rag-service");
  
  const t0 = Date.now();
  const res = await indexAdminStatuteDocument(doc.id);
  console.log(`✓ Completed indexAdminStatuteDocument in ${((Date.now() - t0)/1000).toFixed(1)}s`);
  console.log("Result:", JSON.stringify(res, null, 2));
}

main().catch(err => {
  console.error("Fatal error in test:", err);
});
