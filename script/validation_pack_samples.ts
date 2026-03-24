import { db, pool } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  const citationRows = await db.execute(sql.raw("SELECT j.citation_string, j.year, lj.code as journal, j.page, j.title FROM judgments j JOIN law_journals lj ON lj.id=j.journal_id WHERE coalesce(j.full_text,'') <> '' ORDER BY random() LIMIT 8"));
  const keywordRows = await db.execute(sql.raw("SELECT citation, title, summary FROM case_law WHERE coalesce(summary,'') <> '' ORDER BY random() LIMIT 8"));
  const ragRows = await db.execute(sql.raw("SELECT title, summary FROM case_law WHERE coalesce(summary,'') <> '' ORDER BY random() LIMIT 4"));

  const data = {
    citations: (citationRows as any).rows || citationRows,
    keywords: (keywordRows as any).rows || keywordRows,
    rag: (ragRows as any).rows || ragRows,
  };
  console.log(JSON.stringify(data, null, 2));
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool?.end?.();
  });
