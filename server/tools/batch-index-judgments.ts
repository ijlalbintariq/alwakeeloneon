import { db } from "../db";
import { judgments } from "@shared/schema";
import { asc, sql } from "drizzle-orm";
import { indexJudgmentDocument } from "../rag/rag-service";
import { ensureRagSchema } from "../rag/vector-store";

async function main() {
  // Parse CLI args
  const args = process.argv.slice(2);
  const getArg = (name: string, def: number) => {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 && args[idx + 1] ? parseInt(args[idx + 1], 10) : def;
  };
  const BATCH_SIZE = getArg("batch-size", 50);
  const START_OFFSET = getArg("start-offset", 0);
  const LIMIT = getArg("limit", Infinity);
  const CONCURRENCY = getArg("concurrency", 3);

  console.log(`\n=== Judgment Vector Indexer ===`);
  console.log(
    `Batch size: ${BATCH_SIZE}, Start: ${START_OFFSET}, Limit: ${LIMIT === Infinity ? "ALL" : LIMIT}, Concurrency: ${CONCURRENCY}\n`,
  );

  await ensureRagSchema();

  // Count total judgments
  const [countRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(judgments);
  const totalInDb = Number(countRow?.total || 0);
  const effectiveTotal = Math.min(totalInDb - START_OFFSET, LIMIT);
  console.log(
    `Total judgments in DB: ${totalInDb}, will process: ${effectiveTotal}\n`,
  );

  let processed = 0;
  let indexed = 0;
  let failed = 0;
  const t0 = Date.now();

  for (let offset = START_OFFSET; ; offset += BATCH_SIZE) {
    if (processed >= LIMIT) break;

    const batch = await db
      .select({ id: judgments.id, citationString: judgments.citationString })
      .from(judgments)
      .orderBy(asc(judgments.id))
      .offset(offset)
      .limit(Math.min(BATCH_SIZE, LIMIT - processed));

    if (batch.length === 0) break;

    // Process with concurrency
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(async (j: { id: string; citationString: string }) => {
          const start = Date.now();
          try {
            const result = await indexJudgmentDocument(j.id);
            return {
              id: j.id,
              citation: j.citationString,
              chunks: result.chunks,
              ms: Date.now() - start,
            };
          } catch (err: any) {
            throw {
              id: j.id,
              citation: j.citationString,
              error: err?.message || String(err),
              ms: Date.now() - start,
            };
          }
        }),
      );

      for (const result of results) {
        processed++;
        if (result.status === "fulfilled") {
          indexed++;
          const r = result.value;
          if (processed % 10 === 0 || processed <= 5) {
            console.log(
              `[${processed}/${effectiveTotal}] ✓ ${r.citation} (${r.chunks} chunks, ${r.ms}ms)`,
            );
          }
        } else {
          failed++;
          const r = result.reason as {
            id?: string;
            citation?: string;
            error?: string;
          };
          console.error(
            `[${processed}/${effectiveTotal}] ✗ ${r?.citation || r?.id || "unknown"}: ${r?.error || "unknown error"}`,
          );
        }
      }
    }

    // Progress update every batch
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const rate = ((processed / (Date.now() - t0)) * 1000).toFixed(1);
    console.log(
      `  → Batch done. Processed: ${processed}, Indexed: ${indexed}, Failed: ${failed} | ${elapsed}s elapsed, ${rate} judgments/sec`,
    );
  }

  const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n=== COMPLETE ===`);
  console.log(`Processed: ${processed}`);
  console.log(`Indexed:   ${indexed}`);
  console.log(`Failed:    ${failed}`);
  console.log(`Elapsed:   ${totalElapsed}s`);
  console.log(
    `Rate:      ${((processed / (Date.now() - t0)) * 1000).toFixed(1)} judgments/sec`,
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
