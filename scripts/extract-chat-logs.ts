import "../server/load-env";
import { db } from "../server/db";
import { aiOutputLog, users } from "../shared/schema";
import { sql, and, gte, lte, ne, eq } from "drizzle-orm";
import { pool } from "../server/db";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Starting chat logs extraction script...");

  // Date range: June 1, 2026 to July 31, 2026 (inclusive)
  const startDate = new Date("2026-06-01T00:00:00.000Z");
  const endDate = new Date("2026-07-31T23:59:59.999Z");

  console.log(`Filtering between ${startDate.toISOString()} and ${endDate.toISOString()}`);
  console.log("Excluding email: 'ijlalbintariq420@gmail.com'");

  // Execute query selecting all columns from ai_output_log and email from users
  const rows = await db.select({
    id: aiOutputLog.id,
    userId: aiOutputLog.userId,
    userEmail: users.email,
    userFirstName: users.firstName,
    userLastName: users.lastName,
    feature: aiOutputLog.feature,
    model: aiOutputLog.model,
    inputSnippet: aiOutputLog.inputSnippet,
    outputSnippet: aiOutputLog.outputSnippet,
    outputLength: aiOutputLog.outputLength,
    qualityScore: aiOutputLog.qualityScore,
    qualityFlags: aiOutputLog.qualityFlags,
    createdAt: aiOutputLog.createdAt,
    userQuery: sql<string>`ai_output_log.user_query`,
    responseTimeMs: sql<number>`ai_output_log.response_time_ms`
  })
    .from(aiOutputLog)
    .innerJoin(users, eq(aiOutputLog.userId, users.id))
    .where(and(
      gte(aiOutputLog.createdAt, startDate),
      lte(aiOutputLog.createdAt, endDate),
      ne(users.email, 'ijlalbintariq420@gmail.com')
    ))
    .orderBy(aiOutputLog.createdAt);

  console.log(`Successfully extracted ${rows.length} rows.`);

  // Prepare output path
  const outputPath = "/Users/macbook/Downloads/Alwakeelo/scratch/extracted_chat_logs_2026.json";
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
  }

  // Format and write JSON file
  fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2), "utf8");
  console.log(`Saved extracted logs to ${outputPath}`);

  // Summary statistics
  const uniqueUsers = new Set(rows.map(r => r.userEmail));
  console.log(`Unique users found: ${uniqueUsers.size}`);
  uniqueUsers.forEach(email => console.log(`  - ${email}`));

  const featureCounts: Record<string, number> = {};
  rows.forEach(r => {
    featureCounts[r.feature] = (featureCounts[r.feature] || 0) + 1;
  });
  console.log("Feature breakdown:", featureCounts);

  await pool.end();
}

main().catch(async (err) => {
  console.error("Error running extraction script:", err);
  await pool.end();
});
