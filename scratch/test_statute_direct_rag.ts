import "../server/load-env";
import { retrieveForQuery } from "../server/rag/rag-service";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  const userRow = await db.execute(sql`SELECT id FROM users LIMIT 1`);
  const userId = userRow.rows[0]?.id as string;
  const query = "What is the penalty or punishment under the Control of Narcotic Substances Act 1997?";

  console.log(`Running retrieveForQuery directly for query: "${query}"...`);
  const res = await retrieveForQuery({
    userId,
    query,
    topK: 5,
  });

  console.log(`Total matches returned: ${res.matches.length}`);
  res.matches.forEach((m, idx) => {
    console.log(`\n[Match ${idx + 1}] Title: "${m.title}"`);
    console.log(`  SourceType: ${m.metadata?.sourceType}`);
    console.log(`  Score: ${m.score}`);
    console.log(`  Preview: "${m.chunkText.slice(0, 150)}..."`);
  });
}

main().catch(console.error);
