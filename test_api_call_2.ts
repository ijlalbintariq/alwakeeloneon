import { storage } from './server/storage';
import { filterToPrimaryCaseLawRows, filterToTrustedCaseLawRows } from './server/utils';
async function run() {
  const caseLawResults = await storage.searchCaseLaw("", 25, {});
  const headnoteResults = await storage.searchJudgmentsByKeywords("", 25, "");
  
  const primaryCaseLaw = filterToPrimaryCaseLawRows(filterToTrustedCaseLawRows(caseLawResults))
    .filter((r) => {
      const court = String(r.court || "").toLowerCase().trim();
      const title = String(r.title || "").toLowerCase().trim();
      if (court === "statute reference") return false;
      if (title.startsWith("statute reference")) return false;
      return true;
    });
    
  console.log("Primary case law count:", primaryCaseLaw.length);
  console.log("Headnote count:", headnoteResults.length);
  
  const results = [];
  for (const r of [...primaryCaseLaw, ...headnoteResults]) {
    results.push(r);
  }
  
  console.log("Final results:", results.length);
  process.exit(0);
}
run();
