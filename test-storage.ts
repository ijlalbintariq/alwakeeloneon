import { storage } from "./server/storage";

async function runTest() {
  const result = await storage.getStatuteByTitleAndSection("Pakistan Penal Code", "302");
  console.log("Statute result:", result);
  process.exit(0);
}

runTest().catch(console.error);
