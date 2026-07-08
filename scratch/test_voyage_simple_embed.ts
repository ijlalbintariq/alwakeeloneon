import "../server/load-env";
import { embedTextLocal } from "../server/rag/embedding-local";

async function main() {
  console.log("Testing embedTextLocal with text 'test'...");
  const t0 = Date.now();
  try {
    const vector = await embedTextLocal("test");
    console.log(`Success! Vector length: ${vector.length} (took ${Date.now() - t0}ms)`);
    console.log("Vector sample (first 5 values):", vector.slice(0, 5));
  } catch (err: any) {
    console.error("Embedding failed:", err.message || err);
  }
}

main().catch(console.error);
