import { storage } from './server/storage';
async function run() {
  console.log("Searching with empty query...");
  const results = await storage.searchCaseLaw("", 10, {});
  console.log("Results count:", results.length);
  process.exit(0);
}
run();
