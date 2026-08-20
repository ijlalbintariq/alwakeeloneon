/**
 * halfvec-migrate.ts
 * 
 * Converts rag_chunks.embedding from VECTOR(1024) float32 to HALFVEC(1024) float16.
 * Processes in batches of 50,000 rows to avoid long-running transactions.
 * 
 * Usage:
 *   npx tsx scripts/halfvec-migrate.ts --add-column     # Step 1: Add halfvec column
 *   npx tsx scripts/halfvec-migrate.ts --convert         # Step 2: Batch convert vectors
 *   npx tsx scripts/halfvec-migrate.ts --status          # Check progress
 */

import "../server/load-env";
import { Pool } from "pg";

const BATCH_SIZE = 50000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  console.error("Pool error (non-fatal):", err.message);
});

async function addColumn() {
  console.log("Adding embedding_half column (halfvec(1024))...");
  await pool.query("ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS embedding_half halfvec(1024)");
  console.log("Done - Column added (or already exists)");
}

async function getProgress(): Promise<{ total: number; converted: number; remaining: number }> {
  const totalRes = await pool.query("SELECT COUNT(*)::int as cnt FROM rag_chunks WHERE embedding IS NOT NULL");
  const convertedRes = await pool.query("SELECT COUNT(*)::int as cnt FROM rag_chunks WHERE embedding_half IS NOT NULL");
  const total = totalRes.rows[0].cnt;
  const converted = convertedRes.rows[0].cnt;
  return { total, converted, remaining: total - converted };
}

async function showStatus() {
  const { total, converted, remaining } = await getProgress();
  const pct = total > 0 ? ((converted / total) * 100).toFixed(1) : "0";
  console.log("Progress: " + converted.toLocaleString() + " / " + total.toLocaleString() + " (" + pct + "%)");
  console.log("Remaining: " + remaining.toLocaleString() + " rows");
  const estimatedBatches = Math.ceil(remaining / BATCH_SIZE);
  console.log("Estimated batches left: " + estimatedBatches + " (at " + BATCH_SIZE.toLocaleString() + " per batch)");
}

async function convertBatch(): Promise<number> {
  const result = await pool.query(
    "UPDATE rag_chunks SET embedding_half = embedding::halfvec(1024) " +
    "WHERE id IN (SELECT id FROM rag_chunks WHERE embedding IS NOT NULL AND embedding_half IS NULL LIMIT $1)",
    [BATCH_SIZE]
  );
  return result.rowCount || 0;
}

async function convertAll() {
  console.log("\nStarting batch conversion (" + BATCH_SIZE.toLocaleString() + " rows per batch)...\n");
  
  const { total, remaining } = await getProgress();
  if (remaining === 0) {
    console.log("All vectors already converted!");
    return;
  }

  console.log("Total to convert: " + remaining.toLocaleString() + " / " + total.toLocaleString() + "\n");
  
  let batchNum = 0;
  let totalConverted = 0;
  const startTime = Date.now();

  while (true) {
    batchNum++;
    const batchStart = Date.now();
    const converted = await convertBatch();
    const batchMs = Date.now() - batchStart;
    totalConverted += converted;

    if (converted === 0) break;

    const elapsedSec = (Date.now() - startTime) / 1000;
    const rate = totalConverted / elapsedSec;
    const remainingRows = remaining - totalConverted;
    const etaSec = remainingRows / rate;
    const etaMin = Math.ceil(etaSec / 60);

    console.log(
      "  Batch " + batchNum + ": " + converted.toLocaleString() + " rows in " + (batchMs / 1000).toFixed(1) + "s | " +
      "Total: " + totalConverted.toLocaleString() + " | " +
      "Rate: " + Math.round(rate) + "/s | " +
      "ETA: ~" + etaMin + " min"
    );
  }

  const totalSec = (Date.now() - startTime) / 1000;
  console.log("\nConversion complete! " + totalConverted.toLocaleString() + " rows in " + (totalSec / 60).toFixed(1) + " min");
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--add-column")) {
    await addColumn();
  } else if (args.includes("--convert")) {
    await convertAll();
  } else if (args.includes("--status")) {
    await showStatus();
  } else {
    console.log("Usage:");
    console.log("  npx tsx scripts/halfvec-migrate.ts --add-column   # Add halfvec column");
    console.log("  npx tsx scripts/halfvec-migrate.ts --convert       # Batch convert vectors");
    console.log("  npx tsx scripts/halfvec-migrate.ts --status        # Check progress");
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
