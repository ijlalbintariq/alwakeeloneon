import { storage } from './server/storage';
async function run() {
  const query = "";
  const limit = 25;
  const courtRaw = "";
  
  const caseLawResults = await storage.searchCaseLaw(query, limit, {
    year: NaN,
    report: "",
    court: undefined,
    sort: "relevance",
    parsedCitation: null,
    includeSourceContentSearch: false,
  });
  
  const headnoteResults = await storage.searchJudgmentsByKeywords(query, limit, courtRaw).catch(() => []);
  
  // We mock the filtering logic
  const primaryCaseLaw = caseLawResults.filter(r => String(r.citationRole || "").toLowerCase() === "primary")
    .filter(r => {
      // Mocking isTrustedCaseLawCitationParts
      if (!r.citationPage) return false;
      return true;
    });
    
  console.log(`caseLawResults: ${caseLawResults.length}`);
  console.log(`primaryCaseLaw (after trust filter): ${primaryCaseLaw.length}`);
  console.log(`headnoteResults: ${headnoteResults.length}`);
  
  const results = [];
  const seenMap = new Map<string, number>();
  for (const r of [...primaryCaseLaw, ...headnoteResults]) {
    const key = String(r.citation || "").toLowerCase().replace(/\s+/g, "").trim();
    if (!key) continue;
    if (seenMap.has(key)) continue;
    seenMap.set(key, results.length);
    results.push(r);
    if (results.length >= limit) break;
  }
  
  console.log(`Final Merged Results: ${results.length}`);
  if (results.length > 0) {
    console.log("First result title:", results[0].title);
  }
  
  process.exit(0);
}
run();
