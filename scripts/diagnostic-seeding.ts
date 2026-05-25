import "../server/load-env";
import { db } from "../server/db";
import { statuteDocuments, statuteDocumentFiles } from "../shared/schema";
import { isR2StorageEnabled, getR2ObjectText, getR2ObjectBinary } from "../server/r2-storage";
import { extractPdfTextGuarded } from "../server/extraction-guard";
import { pool } from "../server/db";
import { eq } from "drizzle-orm";
import * as fs from "fs/promises";
import * as path from "path";

async function main() {
  console.log("==========================================");
  console.log("🔍 RUNNING BULK SEEDING DIAGNOSTIC");
  console.log("==========================================");

  // 1. Check R2 Storage Enabled
  const r2Enabled = isR2StorageEnabled();
  console.log(`- isR2StorageEnabled(): ${r2Enabled}`);

  // 2. Query all statute documents
  console.log("\n- Fetching all entries from statuteDocuments...");
  const docs = await db.select().from(statuteDocuments);
  console.log(`Found ${docs.length} master documents.`);

  for (const doc of docs) {
    console.log(`  * ID: ${doc.id} | Title: "${doc.title}" | Filename: "${doc.filename}" | Content Length: ${doc.content?.length || 0}`);
  }

  // 3. Query all statute document files
  console.log("\n- Fetching all entries from statuteDocumentFiles...");
  const files = await db.select().from(statuteDocumentFiles);
  console.log(`Found ${files.length} document files in R2 mapping.`);

  for (const file of files) {
    console.log(`  * ID: ${file.id} | DocID: ${file.statuteDocumentId} | Bucket: ${file.bucket} | Key: "${file.objectKey}" | ExtractedKey: "${file.extractedTextKey || 'None'}" | Size: ${file.sizeBytes} bytes | Mime: ${file.mimeType}`);
  }

  // 4. Look for Code of Criminal Procedure or others
  const crpcDoc = docs.find(d => 
    d.title.toLowerCase().includes("criminal procedure") || 
    d.filename.toLowerCase().includes("crpc") || 
    d.filename.toLowerCase().includes("criminal")
  );
  if (crpcDoc) {
    console.log(`\n- Found potential CrPC master doc: ID ${crpcDoc.id}, Title: "${crpcDoc.title}"`);
  } else {
    console.log(`\n- No explicit "Code of Criminal Procedure" document found in statute_documents by title search.`);
  }

  // 5. Download a sample file to check structure
  if (files.length > 0) {
    const sampleFile = files[0];
    console.log(`\n- Attempting to download sample file ID ${sampleFile.id} from R2 key: "${sampleFile.objectKey}"...`);
    
    // Let's see if we have extracted text first
    if (sampleFile.extractedTextKey) {
      console.log(`  * Has extractedTextKey: "${sampleFile.extractedTextKey}". Fetching text...`);
      const text = await getR2ObjectText(sampleFile.extractedTextKey);
      if (text) {
        console.log(`  * Successfully downloaded extracted text. Length: ${text.length} chars.`);
        console.log(`  * First 1000 characters of extracted text:`);
        console.log("--------------------------------------------------");
        console.log(text.substring(0, 1000));
        console.log("--------------------------------------------------");
        
        // Write a temp copy to inspect or use
        const tempPath = path.join(__dirname, "../temp_sample_text.txt");
        await fs.writeFile(tempPath, text);
        console.log(`  * Wrote sample text to ${tempPath}`);
      } else {
        console.log(`  * Failed to download extracted text from key.`);
      }
    } else {
      console.log(`  * No extractedTextKey. Fetching binary content...`);
      const binary = await getR2ObjectBinary(sampleFile.objectKey);
      if (binary) {
        console.log(`  * Successfully downloaded binary object. Size: ${binary.buffer.length} bytes.`);
        
        if (sampleFile.mimeType === "application/pdf" || sampleFile.objectKey.endsWith(".pdf")) {
          console.log(`  * File is PDF. Parsing with extractPdfTextGuarded...`);
          const text = await extractPdfTextGuarded(binary.buffer, { context: "diagnostic-test" });
          console.log(`  * Successfully extracted text from PDF. Length: ${text.length} chars.`);
          console.log(`  * First 1000 characters:`);
          console.log("--------------------------------------------------");
          console.log(text.substring(0, 1000));
          console.log("--------------------------------------------------");
          
          const tempPath = path.join(__dirname, "../temp_sample_text.txt");
          await fs.writeFile(tempPath, text);
          console.log(`  * Wrote parsed text to ${tempPath}`);
        } else {
          console.log(`  * Extracted text is not PDF. Text content (first 500 chars):`);
          const text = binary.buffer.toString("utf-8");
          console.log(text.substring(0, 500));
        }
      } else {
        console.log(`  * Failed to download binary object.`);
      }
    }
  } else {
    console.log("\n- No document files found to download.");
  }

  console.log("==========================================");
  console.log("🏁 DIAGNOSTIC COMPLETE");
  console.log("==========================================");
  await pool.end();
}

main().catch(async (e) => {
  console.error("Diagnostic execution error:", e);
  await pool.end();
});
