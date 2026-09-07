import { storage } from './server/storage';
import { performance } from 'perf_hooks';

async function runTest() {
  console.log("Starting pgvector latency tests...");
  
  // Test 1: Full-Text / Keyword Search
  try {
    const start1 = performance.now();
    // Use the appropriate search function from storage
    // Assuming searchJudgments, searchCaseLaw, searchCitations exist
    if (typeof storage.searchJudgments === 'function') {
      const results1 = await storage.searchJudgments({ query: "murder", limit: 25 });
      const end1 = performance.now();
      console.log(`[Test 1] storage.searchJudgments("murder"): ${Math.round(end1 - start1)}ms, Found: ${results1?.length || 0}`);
    } else {
      console.log("[Test 1] storage.searchJudgments is not a function in storage.ts");
    }
  } catch(e: any) {
    console.log("[Test 1] Error:", e.message);
  }

  // Test 2: Citation Lookup
  try {
    const start2 = performance.now();
    if (typeof storage.getJudgmentByCitation === 'function') {
      const results2 = await storage.getJudgmentByCitation("2024 SCMR 123");
      const end2 = performance.now();
      console.log(`[Test 2] storage.getJudgmentByCitation("2024 SCMR 123"): ${Math.round(end2 - start2)}ms`);
    } else {
      console.log("[Test 2] storage.getJudgmentByCitation is not a function in storage.ts");
    }
  } catch(e: any) {
    console.log("[Test 2] Error:", e.message);
  }
  
  process.exit(0);
}

runTest();
