import { storage } from './server/storage';
async function run() {
  const results = await storage.searchJudgmentsByKeywords("", 10);
  console.log("Empty judgments count:", results.length);
  process.exit(0);
}
run();
