/**
 * Batch index all 5,906 statute documents into RAG vector store
 * using Voyage Law-2 embeddings (1024 dimensions).
 * 
 * This runs the existing ensureIndexedForGlobalStatutes pipeline
 * in batches to avoid memory issues and API rate limits.
 */
import "../server/load-env";
import { ensureIndexedForGlobalStatutes } from "../server/rag/rag-service";
import { ensureRagSchema } from "../server/rag/vector-store";

const BATCH_SIZE = 50; // Process 50 documents per batch call
const TOTAL_DOCS = 5906;

async function main() {
  console.log("=== Statute Embedding Pipeline (Voyage Law-2) ===");
  console.log(`Total statute documents to index: ${TOTAL_DOCS}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Estimated batches: ${Math.ceil(TOTAL_DOCS / BATCH_SIZE)}`);
  console.log("");

  await ensureRagSchema();

  let totalIndexed = 0;
  let totalFailed = 0;
  let batchNumber = 0;

  while (true) {
    batchNumber++;
    const t0 = Date.now();
    
    console.log(`[Batch ${batchNumber}] Starting (maxToIndex=${BATCH_SIZE})...`);
    
    try {
      const result = await ensureIndexedForGlobalStatutes({
        maxToIndex: BATCH_SIZE,
      });

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      totalIndexed += result.indexedNow;
      totalFailed += result.failed;

      console.log(`[Batch ${batchNumber}] Done in ${elapsed}s — candidates=${result.candidates} alreadyIndexed=${result.alreadyIndexed} indexedNow=${result.indexedNow} failed=${result.failed}`);
      console.log(`[Progress] Total indexed so far: ${totalIndexed} | Failed: ${totalFailed} | Already done: ${result.alreadyIndexed}`);
      console.log("");

      // If no new documents were attempted or all are already indexed, we're done
      if (result.attempted === 0 || result.alreadyIndexed >= result.candidates) {
        console.log("✅ All statute documents have been indexed!");
        break;
      }

      // Small delay between batches to avoid API rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err: any) {
      console.error(`[Batch ${batchNumber}] ERROR: ${err.message || err}`);
      // Continue with next batch
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log(`\n=== FINAL SUMMARY ===`);
  console.log(`Total newly indexed: ${totalIndexed}`);
  console.log(`Total failed: ${totalFailed}`);
  console.log(`Batches processed: ${batchNumber}`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
