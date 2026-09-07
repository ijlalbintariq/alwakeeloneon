import { storage } from './server/storage';
async function run() {
  const query = "Const. P. 11/2026 (SHC)";
  console.log("Searching for:", query);
  const results = await storage.searchCaseLaw(query, 10, {});
  console.log("Results count:", results.length);
  if (results.length > 0) {
    console.log("First result:", results[0].citation);
  }
  process.exit(0);
}
run();
