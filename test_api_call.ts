import { storage } from './server/storage';
async function run() {
  const req = {
    query: {
      q: "",
      journal: "All",
      court: "All Courts",
      year: "All Years",
      limit: "25",
    }
  };
  
  const query = ((req.query.q as string) || "").trim();
  const yearParam = String(req.query.year || "").trim();
  const yearRaw = yearParam.toLowerCase().includes("all") ? NaN : Number(yearParam);
  
  const reportParam = String(req.query.journal || "").trim();
  const reportRaw = reportParam.toLowerCase() === "all" ? "" : reportParam;
  
  const courtRawInput = String(req.query.court || "").trim();
  const isAllCourts = courtRawInput.toLowerCase() === "all" || courtRawInput.toLowerCase() === "all courts";
  const courtRaw = isAllCourts ? "" : courtRawInput;
  
  console.log("Parsed params:", { query, yearRaw, reportRaw, courtRaw });
  
  const results = await storage.searchCaseLaw(query, 25, {
    year: yearRaw,
    report: reportRaw,
    court: courtRaw,
  });
  
  console.log("Results from DB:", results.length);
  process.exit(0);
}
run();
