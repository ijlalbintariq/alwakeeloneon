import "../server/load-env";
import { pool } from "../server/db";
import { enforceStatuteSectionIntegrity } from "../server/routes";
import { storage } from "../server/storage";

async function debug() {
  const inputs = [
    {
      id: "A19",
      text: "The petitioner seeks a civil revision under Section 115 of the Code of Civil Procedure, 1908 to challenge the appellate decree."
    },
    {
      id: "B11",
      text: "The pre-emptor made the demands of pre-emption under Section 13 of the Punjab Pre-emption Act, 1991."
    },
    {
      id: "B5",
      text: "Notice of Talaq was served under Section 7 of Muslim Family Laws Ordinance, 1961."
    },
    {
      id: "C14",
      text: "The abettor is prosecuted under Section 109 of the Qanun-e-Shahadat Order, 1984."
    }
  ];

  for (const item of inputs) {
    console.log(`\n================= DEBUG ${item.id} =================`);
    console.log(`Input: "${item.text}"`);
    
    // Let's run the regex manually
    const sectionPattern = /\b((?:Section|Article|S\.)\s+\d+[A-Za-z]?)\s+(?:of\s+(?:the\s+)?)((?:(?:Pakistan|Pak\.?)\s+)?[A-Z][A-Za-z\s,.'()]+?(?:Act|Code|Ordinance|Order|Rules|Regulation|Constitution)[^\n,;)]*?)(?=[,;.)\s]|$)/gi;
    let match;
    while ((match = sectionPattern.exec(item.text)) !== null) {
      console.log(`Matched: "${match[0]}"`);
      console.log(`  sectionPart: "${match[1]}"`);
      console.log(`  statuteName: "${match[2]}"`);
      
      const matched = match[1] ? await storage.searchStatutes(match[1], 25).catch(() => []) : [];
      console.log(`  DB search returned ${matched.length} rows.`);
      for (const row of matched) {
        console.log(`    DB Row: "${row.shortTitle}" | "${row.section}"`);
      }
    }

    const output = await enforceStatuteSectionIntegrity(item.text);
    console.log(`Output: "${output}"`);
  }

  await pool.end();
}

debug();
