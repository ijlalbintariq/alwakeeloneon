import { db } from "../server/db";
import { sql } from "drizzle-orm";
import fs from "fs";

async function normalizeBatch(batch: string[]): Promise<Record<string, string>> {
  const prompt = `You are a legal data normalization assistant.
I will give you a JSON array of messy judge names parsed from Pakistani court documents.
Many are variations of the same name (e.g. "Mr. Justice Yahya Afridi", "Justice Yahya Afridi", "Yahya Afridi, J", "Justice (Retd.) Yahya").
Your task is to return a JSON object mapping EACH exact original string to a clean, normalized name.
The normalized name should ideally follow the format "Justice [First Name] [Last Name]".
Remove prefixes like "Mr.", "Mrs.", "Miss", "Dr.", "Hon'ble", "HCJ", "CJP".
Remove suffixes like ", J", ", J.", ", CJ".
Keep "Justice" at the front. Do not combine names of different people! Only clean formatting.
If it contains multiple people (like "Justice A and Justice B"), do your best or just clean them as a combined string.

Return ONLY a valid JSON object with the original strings as keys and the normalized strings as values. No markdown blocks, no extra text.

Names:
${JSON.stringify(batch, null, 2)}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      response_format: { type: "json_object" }
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter API error: ${await res.text()}`);
  }
  const data = await res.json();
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch (e) {
    console.error("Failed to parse JSON:", data.choices[0].message.content);
    return {};
  }
}

async function main() {
  console.log("Fetching distinct judge names...");
  const res = await db.execute<{ judge_name: string }>(
    sql`SELECT DISTINCT judge_name FROM judge_case_links WHERE judge_name IS NOT NULL`
  );
  
  const names = res.rows.map(r => r.judge_name);
  console.log(`Found ${names.length} distinct judge names.`);

  const BATCH_SIZE = 250;
  let allMappings: Record<string, string> = {};
  
  for (let i = 0; i < names.length; i += BATCH_SIZE) {
    const batch = names.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(names.length/BATCH_SIZE)}...`);
    
    // retry logic
    let attempts = 0;
    while (attempts < 3) {
      try {
        const mapping = await normalizeBatch(batch);
        allMappings = { ...allMappings, ...mapping };
        break;
      } catch (err: any) {
        console.error("Batch failed, retrying...", err.message);
        attempts++;
        if (attempts >= 3) throw err;
      }
    }
  }

  // Save to file for safety
  fs.writeFileSync("script/judge-mappings.json", JSON.stringify(allMappings, null, 2));
  console.log("Saved mapping to script/judge-mappings.json");

  // Now apply the mappings
  console.log("Applying mappings to the database...");
  let updatedCount = 0;
  for (const [original, normalized] of Object.entries(allMappings)) {
    if (original && normalized && original !== normalized && normalized.length > 3) {
      try {
        const result = await db.execute(
          sql`UPDATE judge_case_links SET judge_name = ${normalized} WHERE judge_name = ${original}`
        );
        updatedCount++;
      } catch (e) {
        console.error(`Error updating ${original} -> ${normalized}`, e);
      }
    }
  }

  console.log(`Successfully normalized ${updatedCount} judge names!`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
