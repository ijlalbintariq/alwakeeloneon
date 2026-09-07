import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";

import {
  StatuteSearchEngine,
  statuteSearchEngine,
  searchStatutes,
  parseLegalQuery,
  normalizeSectionNumber,
  PAKISTANI_LEGAL_ALIASES,
  debounce
} from "../client/src/experimental/lib/statuteSearchEngine.js";

import {
  PrecedentMemoryCache,
  precedentCache,
  type LandmarkPrecedent
} from "../client/src/experimental/lib/precedentCache.js";

import {
  MAJOR_ENACTMENTS_DATA,
  type StatutorySection
} from "../client/src/experimental/data/majorEnactmentsData.js";

async function runAllBenchmarks() {
  console.log("=== STARTING CHALLENGER 1 EMPIRICAL BENCHMARKS ===");

  const engine = new StatuteSearchEngine(MAJOR_ENACTMENTS_DATA);
  console.log(`[1] Engine initialized with ${engine.size} major enactment sections.`);

  // Test 1: Acronyms
  console.log("[2] Testing Acronyms & Legal Queries...");
  const acronymQueries = [
    { query: "PPC 302", expectedStatute: "Pakistan Penal Code 1860", expectedSection: "302" },
    { query: "CrPC 497", expectedStatute: "Criminal Procedure Code Cr P C 1898", expectedSection: "497" },
    { query: "QSO 164", expectedStatute: "Qanun-e-Shahadat Order 1984", expectedSection: "164" },
    { query: "CPC 12", expectedStatute: "Code of Civil Procedure 1908", expectedSection: "12" },
    { query: "SRA 42", expectedStatute: "Specific Relief Act 1877", expectedSection: "42" },
    { query: "PECA 11", expectedStatute: "Prevention of Electronic Crimes Ordinance 2008", expectedSection: "11" },
    { query: "NIA 138", expectedStatute: "Negotiable Instruments Act 1881", expectedSection: "138" },
    { query: "MFLO 7", expectedStatute: "Muslim Family Laws Ordinance 1961", expectedSection: "7" },
    { query: "GWA 25", expectedStatute: "Guardians and Wards Act 1890", expectedSection: "25" },
    { query: "TPA 54", expectedStatute: "Transfer of Property Act 1882", expectedSection: "54" },
    { query: "Constitution 199", expectedStatute: "Constitution of Pakistan 1973", expectedSection: "199" },
    { query: "Contract 73", expectedStatute: "Contract Act 1872", expectedSection: "73" },
    { query: "Limitation 5", expectedStatute: "Limitation Act 1908", expectedSection: "5" },
    { query: "Arbitration 34", expectedStatute: "Arbitration Act 1940", expectedSection: "34" },
    { query: "Registration 17", expectedStatute: "Registration Act 1908", expectedSection: "17" },
    { query: "Court Fees 7", expectedStatute: "Court Fees Act 1870", expectedSection: "7" },
  ];

  for (const tc of acronymQueries) {
    const res = engine.search(tc.query, { limit: 5 });
    assert.ok(res.length > 0, `No result for ${tc.query}`);
    assert.equal(res[0].section.statute, tc.expectedStatute);
    assert.equal(res[0].section.section, tc.expectedSection);
    assert.equal(res[0].matchType, "exact_section");
  }
  console.log("   -> Acronym and Legal Section Resolution: 100% PASSED");

  // Test 2: Latency Benchmark
  console.log("[3] Running Latency Benchmark over 2,000 queries...");
  const benchmarkQueries = [
    "PPC 302", "CrPC 497", "QSO 164", "CPC 12", "SRA 42", "PECA 11",
    "Constitution 199", "Contract 73", "Limitation 5",
    "murder intentional death", "bail non bailable offences",
    "temporary injunction specific relief", "dishonour cheque banking fraud",
    "custody minor guardian appointment", "cyber harassment electronic forgery",
    "adverse possession title declaration", "condonation delay sufficient cause"
  ];

  const iterations = 2000;
  const latencies: number[] = new Array(iterations);
  const tStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const q = benchmarkQueries[i % benchmarkQueries.length];
    const t0 = performance.now();
    const res = engine.search(q, { limit: 20 });
    latencies[i] = performance.now() - t0;
  }
  const tTotal = performance.now() - tStart;
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(iterations * 0.50)];
  const p90 = latencies[Math.floor(iterations * 0.90)];
  const p95 = latencies[Math.floor(iterations * 0.95)];
  const p99 = latencies[Math.floor(iterations * 0.99)];
  const max = latencies[latencies.length - 1];
  const mean = tTotal / iterations;

  console.log(`   -> Total Latency: ${tTotal.toFixed(2)} ms for ${iterations} searches`);
  console.log(`   -> Mean: ${mean.toFixed(4)} ms | p50: ${p50.toFixed(4)} ms | p95: ${p95.toFixed(4)} ms | p99: ${p99.toFixed(4)} ms | max: ${max.toFixed(4)} ms`);
  console.log(`   -> Throughput: ${(iterations / (tTotal / 1000)).toFixed(0)} queries/sec`);

  // Test 3: Adversarial Queries
  console.log("[4] Testing Adversarial and Edge-Case Inputs...");
  const adversarialQueries = [
    "", "   ", "\t\n\r", "\\0\\0\\0", "⚖️📜👨‍⚖️🏛️🇵🇰", "تعزیرات پاکستان ۳۰۲",
    "SELECT * FROM statutes;--", "<script>alert(1)</script>",
    "A".repeat(5000), "PPC ".repeat(100), "!@#$%^&*()_+~`",
    "undefined", "null", "NaN", "[object Object]", "__proto__"
  ];
  for (const q of adversarialQueries) {
    const res = engine.search(q, { limit: 10 });
    assert.ok(Array.isArray(res));
  }
  console.log("   -> Adversarial & Fuzzing Inputs: 100% PASSED (0 unhandled exceptions)");

  // Test 4: Precedent Cache LRU Eviction > 500 keys
  console.log("[5] Stress-Testing Precedent LRU Cache (inserting 2,000 keys into max 500 cache)...");
  const cache = new PrecedentMemoryCache(500, 30 * 60 * 1000);
  for (let i = 1; i <= 2000; i++) {
    cache.set(`key_${i}`, [{ citation: `${i} SCMR ${i}`, title: `Case ${i}`, court: "SC", year: 2024, ratio: "Ratio" }]);
    assert.ok(cache.size() <= 500);
  }
  assert.equal(cache.size(), 500);
  // Verify first 1500 evicted
  for (let i = 1; i <= 1500; i++) {
    assert.equal(cache.get(`key_${i}`), undefined);
  }
  // Verify last 500 retained
  for (let i = 1501; i <= 2000; i++) {
    assert.ok(cache.get(`key_${i}`));
  }
  console.log("   -> LRU Eviction Capacity Test (500 max / 2,000 inserted): 100% PASSED");

  // Test 5: LRU Touch Promotion
  console.log("[6] Testing LRU Touch Promotion (get() moves item to MRU)...");
  const touchCache = new PrecedentMemoryCache(5, 60000);
  for (let i = 1; i <= 5; i++) touchCache.set(`k_${i}`, [{ citation: `C_${i}`, title: `T_${i}`, court: "SC", year: 2024, ratio: "R" }]);
  touchCache.get("k_1");
  touchCache.get("k_2");
  touchCache.set("k_6", [{ citation: "C_6", title: "T_6", court: "SC", year: 2024, ratio: "R" }]);
  touchCache.set("k_7", [{ citation: "C_7", title: "T_7", court: "SC", year: 2024, ratio: "R" }]);
  assert.equal(touchCache.get("k_3"), undefined, "k_3 must be evicted");
  assert.equal(touchCache.get("k_4"), undefined, "k_4 must be evicted");
  assert.ok(touchCache.get("k_1"), "k_1 must be retained");
  assert.ok(touchCache.get("k_2"), "k_2 must be retained");
  console.log("   -> LRU Touch Promotion Order: 100% PASSED");

  // Test 6: TTL Expiration
  console.log("[7] Testing TTL Expiration (50ms TTL)...");
  const ttlCache = new PrecedentMemoryCache(50, 50);
  ttlCache.set("exp_key", [{ citation: "EXP CIT", title: "EXP", court: "SC", year: 2024, ratio: "R" }]);
  assert.ok(ttlCache.get("exp_key"));
  await new Promise(r => setTimeout(r, 70));
  assert.equal(ttlCache.get("exp_key"), undefined);
  assert.equal(ttlCache.size(), 0);
  console.log("   -> TTL Expiration Invalidation: 100% PASSED");

  // Test 7: Burst Request Coalescing
  console.log("[8] Testing Request Coalescing under Burst Load (500 simultaneous callers)...");
  let backendCount = 0;
  const mockBackend = async (q: string) => {
    backendCount++;
    await new Promise(r => setTimeout(r, 40));
    return [{ citation: "2024 SCMR 100", title: "Coalesced Case", summary: "Ratio" }];
  };
  const burstCache = new PrecedentMemoryCache(500, 60000);
  const tBurst0 = performance.now();
  const burstPromises = Array.from({ length: 500 }).map(() =>
    burstCache.resolvePrecedents("Pakistan Penal Code 1860", "302", mockBackend)
  );
  const burstResults = await Promise.all(burstPromises);
  const tBurst = performance.now() - tBurst0;
  assert.equal(backendCount, 1, `Expected 1 backend call for 500 callers, got ${backendCount}`);
  assert.equal(burstResults.length, 500);
  for (const r of burstResults) {
    assert.equal(r[0].citation, "2024 SCMR 100");
  }
  console.log(`   -> 500 Concurrent Callers Coalescing: 100% PASSED in ${tBurst.toFixed(2)} ms (1 single network fetch)`);

  // Test 8: Multi-Key Burst (1,000 callers across 50 keys)
  console.log("[9] Testing Multi-Key Burst (1,000 callers across 50 keys)...");
  let multiBackendCount = 0;
  const mockMulti = async (q: string) => {
    multiBackendCount++;
    await new Promise(r => setTimeout(r, 20));
    return [{ citation: `CIT_${q}`, title: `Title ${q}`, summary: "Summary" }];
  };
  const multiCache = new PrecedentMemoryCache(500, 60000);
  const multiPromises: Promise<LandmarkPrecedent[]>[] = [];
  for (let k = 1; k <= 50; k++) {
    for (let c = 0; c < 20; c++) {
      multiPromises.push(multiCache.resolvePrecedents(`Act_${k}`, `Sec_${k}`, mockMulti));
    }
  }
  const multiResults = await Promise.all(multiPromises);
  assert.equal(multiBackendCount, 50, `Expected 50 backend executions, got ${multiBackendCount}`);
  assert.equal(multiResults.length, 1000);
  console.log("   -> 1,000 Multi-Key Concurrent Callers: 100% PASSED (exactly 50 executions)");

  console.log("\n=== ALL CHALLENGER 1 EMPIRICAL BENCHMARKS PASSED SUCCESSFULLY ===");
}

runAllBenchmarks().catch(err => {
  console.error("BENCHMARK ERROR:", err);
  process.exit(1);
});
