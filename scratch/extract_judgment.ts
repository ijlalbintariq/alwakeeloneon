import { db } from "../server/db";
import { judgments } from "../shared/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function run() {
  console.log("Searching for 2026 CLC 424 in database...");
  try {
    const rows = await db
      .select()
      .from(judgments)
      .where(eq(judgments.citationString, "2026 CLC 424"))
      .limit(1);

    if (rows.length === 0) {
      console.log("No judgment found with citation 2026 CLC 424");
      process.exit(1);
    }

    const judgment = rows[0];
    const text = judgment.fullText || "No text available.";

    // Write to artifacts folder
    const artifactPath = "/Users/macbook/.gemini/antigravity/brain/d3637a00-b092-4601-8640-8967cb845ae1/2026_clc_424_judgment.md";
    
    const mdContent = `# Raw Judgment Text — 2026 CLC 424

**Title:** ${judgment.title || "ASLIYAT KHAN VS Mst. SAEEDA"}
**Citation:** ${judgment.citationString}
**Court:** Peshawar High Court

---

\`\`\`text
${text}
\`\`\`
`;

    fs.writeFileSync(artifactPath, mdContent, "utf8");
    console.log(`Successfully wrote judgment text to: ${artifactPath}`);
  } catch (err) {
    console.error("Failed to query database:", err);
  } finally {
    process.exit(0);
  }
}

run();
