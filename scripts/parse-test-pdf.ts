import "../server/load-env";
import { extractPdfTextGuarded } from "../server/extraction-guard";
import * as fs from "fs/promises";
import * as path from "path";

async function main() {
  console.log("==========================================");
  console.log("🔍 TESTING PDF EXTRACTION ON ATTACHED ASSET");
  console.log("==========================================");

  const pdfPath = path.resolve(process.cwd(), "attached_assets/Pakistan_Law_Bot_1771273478681.pdf");
  try {
    const buffer = await fs.readFile(pdfPath);
    console.log(`Successfully read PDF buffer: ${buffer.length} bytes.`);
    
    const text = await extractPdfTextGuarded(buffer, { context: "pdf-test" });
    console.log(`Successfully extracted text. Length: ${text.length} characters.`);
    console.log("First 2000 characters:");
    console.log("-----------------------------------------");
    console.log(text.substring(0, 2000));
    console.log("-----------------------------------------");
  } catch (err: any) {
    console.error("Failed to parse PDF:", err);
  }
}

main();
