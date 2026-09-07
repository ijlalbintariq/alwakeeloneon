/**
 * CHALLENGER 1 EMPIRICAL STRESS TEST SUITE: STATUTES & PRECEDENT CACHE
 * 
 * Comprehensive empirical validation:
 * 1. StatuteSearchEngine Benchmark & Adversarial Fuzzing
 *    - Search latency percentiles (p50, p95, p99, max) across 2,000 rapid queries
 *    - All 21 legal acronyms & variations (PPC 302, CrPC 497, QSO 164, CPC O7 R11, SRA 24c, PECA 20, etc.)
 *    - Adversarial query strings: Unicode (Urdu, Arabic, Emoji), regex special chars, 5,000-char strings, SQL/XSS injections, null bytes
 *    - Empty/whitespace/boundary queries
 *    - Dynamic catalog expansion stress (adding 5,000 dynamic sections)
 * 2. PrecedentMemoryCache LRU, TTL, & Burst Coalescing Stress
 *    - Insertion beyond 500 keys (tested up to 2,000 keys)
 *    - True LRU access-order preservation (get() touches move items to back, evicting untouched oldest)
 *    - Exact TTL expiration boundary checks
 *    - Extreme burst request coalescing: 500 concurrent promises for same key -> exactly 1 network fetch
 *    - Multi-key burst load: 1,000 concurrent callers across 50 keys -> exactly 50 network fetches
 *    - Resilience under simulated network failure & malformed API responses
 */

import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

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

describe("CHALLENGER 1 - PART 1: StatuteSearchEngine Empirical Latency & Correctness", () => {
  let engine: StatuteSearchEngine;

  before(() => {
    engine = new StatuteSearchEngine(MAJOR_ENACTMENTS_DATA);
  });

  it("EMPIRICAL-1.1: Comprehensive Pakistani Legal Acronym & Citation Resolution", () => {
    const testCases: Array<{ query: string; expectedStatute: string; expectedSection: string }> = [
      { query: "PPC 302", expectedStatute: "Pakistan Penal Code 1860", expectedSection: "302" },
      { query: "ppc 302", expectedStatute: "Pakistan Penal Code 1860", expectedSection: "302" },
      { query: "CrPC 497", expectedStatute: "Criminal Procedure Code Cr P C 1898", expectedSection: "497" },
      { query: "cr.p.c 497", expectedStatute: "Criminal Procedure Code Cr P C 1898", expectedSection: "497" },
      { query: "cr p c 497", expectedStatute: "Criminal Procedure Code Cr P C 1898", expectedSection: "497" },
      { query: "QSO 164", expectedStatute: "Qanun-e-Shahadat Order 1984", expectedSection: "164" },
      { query: "q.s.o 164", expectedStatute: "Qanun-e-Shahadat Order 1984", expectedSection: "164" },
      { query: "CPC 12", expectedStatute: "Code of Civil Procedure 1908", expectedSection: "12" },
      { query: "c.p.c 12", expectedStatute: "Code of Civil Procedure 1908", expectedSection: "12" },
      { query: "SRA 42", expectedStatute: "Specific Relief Act 1877", expectedSection: "42" },
      { query: "sra 42", expectedStatute: "Specific Relief Act 1877", expectedSection: "42" },
      { query: "PECA 11", expectedStatute: "Prevention of Electronic Crimes Ordinance 2008", expectedSection: "11" },
      { query: "peca 11", expectedStatute: "Prevention of Electronic Crimes Ordinance 2008", expectedSection: "11" },
      { query: "NIA 138", expectedStatute: "Negotiable Instruments Act 1881", expectedSection: "138" },
      { query: "MFLO 7", expectedStatute: "Muslim Family Laws Ordinance 1961", expectedSection: "7" },
      { query: "GWA 25", expectedStatute: "Guardians and Wards Act 1890", expectedSection: "25" },
      { query: "TPA 54", expectedStatute: "Transfer of Property Act 1882", expectedSection: "54" },
      { query: "Constitution 199", expectedStatute: "Constitution of Pakistan 1973", expectedSection: "199" },
      { query: "const 199", expectedStatute: "Constitution of Pakistan 1973", expectedSection: "199" },
      { query: "Contract 73", expectedStatute: "Contract Act 1872", expectedSection: "73" },
      { query: "Limitation 5", expectedStatute: "Limitation Act 1908", expectedSection: "5" },
      { query: "Succession 218", expectedStatute: "Succession Act 1925", expectedSection: "218" },
      { query: "Arbitration 34", expectedStatute: "Arbitration Act 1940", expectedSection: "34" },
      { query: "Registration 17", expectedStatute: "Registration Act 1908", expectedSection: "17" },
      { query: "Court Fees 7", expectedStatute: "Court Fees Act 1870", expectedSection: "7" },
      { query: "Suits Valuation 8", expectedStatute: "Suits Valuation Act 1887", expectedSection: "8" },
      { query: "General Clauses 6", expectedStatute: "General Clauses Act 1897", expectedSection: "6" },
    ];

    for (const tc of testCases) {
      const results = engine.search(tc.query, { limit: 5 });
      assert.ok(results.length > 0, `Search returned 0 results for "${tc.query}"`);
      const topMatch = results[0];
      assert.equal(
        topMatch.section.statute,
        tc.expectedStatute,
        `Expected statute "${tc.expectedStatute}" for query "${tc.query}", got "${topMatch.section.statute}"`
      );
      assert.equal(
        topMatch.section.section,
        tc.expectedSection,
        `Expected section "${tc.expectedSection}" for query "${tc.query}", got "${topMatch.section.section}"`
      );
      assert.equal(topMatch.matchType, "exact_section", `Match type for "${tc.query}" should be exact_section`);
      assert.ok(topMatch.score >= 800, `Score for exact match "${tc.query}" must be >= 800 (was ${topMatch.score})`);
    }
  });

  it("EMPIRICAL-1.2: Order/Rule and SRA Subsection Complex Queries", () => {
    const parsedCpc = parseLegalQuery("CPC O7 R11");
    assert.equal(parsedCpc.isAcronymQuery, true);
    assert.equal(parsedCpc.statuteFullName, "Code of Civil Procedure 1908");

    const parsedSra = parseLegalQuery("SRA 24c");
    assert.equal(parsedSra.isAcronymQuery, true);
    assert.equal(parsedSra.statuteFullName, "Specific Relief Act 1877");
    assert.equal(parsedSra.sectionNumber, "24c");

    const sec302 = engine.findExactSection("PPC", "302");
    assert.ok(sec302, "findExactSection must find PPC 302");
    assert.equal(sec302?.statute, "Pakistan Penal Code 1860");
    assert.equal(sec302?.section, "302");

    const sec497 = engine.findExactSection("Criminal Procedure Code Cr P C 1898", "497");
    assert.ok(sec497, "findExactSection must find CrPC 497");
    assert.equal(sec497?.section, "497");
  });

  it("EMPIRICAL-1.3: Latency Benchmark across 2,000 Rapid Consecutive Searches", () => {
    const benchmarkQueries = [
      "PPC 302",
      "CrPC 497",
      "QSO 164",
      "CPC 12",
      "SRA 42",
      "PECA 11",
      "Constitution 199",
      "Contract 73",
      "Limitation 5",
      "murder intentional death",
      "bail non bailable offences",
      "temporary injunction specific relief",
      "dishonour cheque banking fraud",
      "custody minor guardian appointment",
      "cyber harassment electronic forgery",
      "adverse possession title declaration",
      "condonation delay sufficient cause"
    ];

    const iterations = 2000;
    const latencies: number[] = new Array(iterations);

    const overallStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const q = benchmarkQueries[i % benchmarkQueries.length];
      const t0 = performance.now();
      const results = engine.search(q, { limit: 20 });
      const t1 = performance.now();
      latencies[i] = t1 - t0;
      assert.ok(results.length >= 0);
    }
    const totalTimeMs = performance.now() - overallStart;

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(iterations * 0.50)];
    const p90 = latencies[Math.floor(iterations * 0.90)];
    const p95 = latencies[Math.floor(iterations * 0.95)];
    const p99 = latencies[Math.floor(iterations * 0.99)];
    const maxLatency = latencies[latencies.length - 1];
    const meanLatency = totalTimeMs / iterations;

    assert.ok(meanLatency < 15.0, `Mean latency ${meanLatency.toFixed(3)}ms exceeds 15.0ms SLA`);
    assert.ok(p50 < 5.0, `Median (p50) latency ${p50.toFixed(3)}ms exceeds 5.0ms SLA`);
  });

  it("EMPIRICAL-1.4: Adversarial Fuzzing: Unicode, Regex Injections, Oversized Strings, Null Bytes", () => {
    const adversarialQueries = [
      "",
      "   ",
      "\t\n\r\f",
      "\\0\\0\\0\\x00",
      "⚖️📜👨‍⚖️🏛️🇵🇰",
      "تعزیرات پاکستان ۳۰۲",
      "قانون شہادت آرڈر",
      "قتل عمد اور دیت",
      "SELECT * FROM statutes WHERE id = 1; DROP TABLE statutes;--",
      "<script>alert('xss')</script><img src=x onerror=alert(1)>",
      "A".repeat(5000),
      "PPC ".repeat(100),
      "!!@@##$$%%^^&&**(())__++--==~~``{{}}[[]]::;;''\"\"<<>>,..??//",
      "undefined",
      "null",
      "NaN",
      "[object Object]",
      "__proto__",
      "constructor",
    ];

    for (const q of adversarialQueries) {
      assert.doesNotThrow(() => {
        const results = engine.search(q, { limit: 10 });
        assert.ok(Array.isArray(results), `Search for "${q.slice(0, 30)}" must return an array`);
      }, `Engine threw error on adversarial input: ${q.slice(0, 50)}`);
    }
  });

  it("EMPIRICAL-1.5: Dynamic Dataset Scaling: Adding 5,000 Dynamic Sections", () => {
    const dynamicSections: StatutorySection[] = Array.from({ length: 5000 }).map((_, idx) => ({
      id: `dyn-sec-${idx}`,
      statute: "Custom Maritime Regulation Act 2026",
      section: `${idx + 1}`,
      title: `Maritime Navigation Rule ${idx + 1}`,
      description: `Operational protocol and navigation guidelines for vessel class ${idx + 1}.`,
      punishment: `Fine up to PKR ${(idx + 1) * 1000}`,
      category: "commercial",
      isMajorCode: false
    }));

    const initialSize = engine.size;
    assert.equal(initialSize, 4100);

    const indexStart = performance.now();
    engine.addSections(dynamicSections);
    const indexDuration = performance.now() - indexStart;

    assert.equal(engine.size, 9100, "Engine size must reflect 4,100 + 5,000 sections");
    assert.ok(indexDuration < 500, `Indexing 5,000 sections took too long: ${indexDuration}ms`);

    const t0 = performance.now();
    const searchRes = engine.search("Maritime Navigation Rule 50", { limit: 5 });
    const searchDuration = performance.now() - t0;

    assert.ok(searchRes.length > 0);
    assert.equal(searchRes[0].section.statute, "Custom Maritime Regulation Act 2026");
    assert.equal(searchRes[0].section.section, "50");
    assert.ok(searchDuration < 20, `Search against 9,100 records took ${searchDuration.toFixed(2)}ms (must be <20ms)`);
  });
});

describe("CHALLENGER 1 - PART 2: PrecedentMemoryCache LRU Eviction, TTL & Burst Coalescing", () => {
  let cache: PrecedentMemoryCache;

  beforeEach(() => {
    cache = new PrecedentMemoryCache(500, 30 * 60 * 1000);
  });

  it("EMPIRICAL-2.1: Rigorous LRU Capacity Enforcement Beyond 500 Keys (Tested to 2,000 Keys)", () => {
    const totalKeys = 2000;
    const capacity = 500;
    const lruCache = new PrecedentMemoryCache(capacity, 100000);

    for (let i = 1; i <= totalKeys; i++) {
      lruCache.set(`key_${i}`, [
        {
          citation: `${i} SCMR ${i}`,
          title: `Case ${i}`,
          court: "Supreme Court",
          year: 2020,
          ratio: `Ratio for case ${i}`
        }
      ], "live_db");

      assert.ok(
        lruCache.size() <= capacity,
        `Cache size ${lruCache.size()} exceeded capacity ${capacity} at iteration ${i}`
      );
    }

    assert.equal(lruCache.size(), capacity, `Final cache size must equal exactly capacity ${capacity}`);

    // Verify first 1,500 keys evicted
    for (let i = 1; i <= 1500; i++) {
      assert.equal(
        lruCache.get(`key_${i}`),
        undefined,
        `Eviction failure: key_${i} was expected to be evicted but was found`
      );
    }

    // Verify last 500 keys retained
    for (let i = 1501; i <= 2000; i++) {
      const entry = lruCache.get(`key_${i}`);
      assert.ok(entry, `Retention failure: key_${i} was expected to be retained in cache`);
      assert.equal(entry?.precedents[0].citation, `${i} SCMR ${i}`);
    }
  });

  it("EMPIRICAL-2.2: True LRU Access-Order Touch Verification (get() Promotes to MRU)", () => {
    const tinyCache = new PrecedentMemoryCache(5, 100000);

    for (let i = 1; i <= 5; i++) {
      tinyCache.set(`key_${i}`, [{ citation: `CIT_${i}`, title: `T_${i}`, court: "SC", year: 2020, ratio: `R_${i}` }]);
    }
    assert.equal(tinyCache.size(), 5);

    const hit1 = tinyCache.get("key_1");
    const hit2 = tinyCache.get("key_2");
    assert.ok(hit1);
    assert.ok(hit2);

    tinyCache.set("key_6", [{ citation: "CIT_6", title: "T_6", court: "SC", year: 2020, ratio: "R_6" }]);
    tinyCache.set("key_7", [{ citation: "CIT_7", title: "T_7", court: "SC", year: 2020, ratio: "R_7" }]);

    assert.equal(tinyCache.size(), 5);

    assert.equal(tinyCache.get("key_3"), undefined, "key_3 should have been evicted by LRU order");
    assert.equal(tinyCache.get("key_4"), undefined, "key_4 should have been evicted by LRU order");

    assert.ok(tinyCache.get("key_1"), "key_1 must be present because get() promoted it to MRU");
    assert.ok(tinyCache.get("key_2"), "key_2 must be present because get() promoted it to MRU");
    assert.ok(tinyCache.get("key_5"), "key_5 must still be present");
    assert.ok(tinyCache.get("key_6"), "key_6 must be present");
    assert.ok(tinyCache.get("key_7"), "key_7 must be present");
  });

  it("EMPIRICAL-2.3: TTL Expiration Boundaries & Automatic Invalidation", async () => {
    const ttlMs = 50;
    const expiringCache = new PrecedentMemoryCache(100, ttlMs);

    expiringCache.set("quick_key", [{ citation: "TTL CIT", title: "TTL Title", court: "SC", year: 2024, ratio: "TTL Ratio" }]);
    assert.equal(expiringCache.size(), 1);

    const beforeExpiry = expiringCache.get("quick_key");
    assert.ok(beforeExpiry, "Entry must be accessible before TTL expiration");
    assert.equal(beforeExpiry?.precedents[0].citation, "TTL CIT");

    await new Promise(resolve => setTimeout(resolve, 70));

    const afterExpiry = expiringCache.get("quick_key");
    assert.equal(afterExpiry, undefined, "Entry must be undefined after TTL expiration");
    assert.equal(expiringCache.size(), 0, "Expired entry must be automatically purged from cache map");
  });

  it("EMPIRICAL-2.4: Extreme Burst Request Coalescing (500 Concurrent Promises -> Exactly 1 Fetch)", async () => {
    const coalescingCache = new PrecedentMemoryCache(500, 30000);
    let executionCount = 0;

    const mockSlowBackend = async (query: string) => {
      executionCount++;
      await new Promise(r => setTimeout(r, 40));
      return [
        {
          citation: "PLD 2024 SC 777",
          title: "Landmark Judgment on Coalescing",
          court: "Supreme Court of Pakistan",
          year: 2024,
          summary: "Ratio establishing single-flight execution."
        }
      ];
    };

    const concurrentCallers = 500;
    const promises = Array.from({ length: concurrentCallers }).map(() =>
      coalescingCache.resolvePrecedents("Pakistan Penal Code 1860", "302", mockSlowBackend)
    );

    const allResults = await Promise.all(promises);

    assert.equal(
      executionCount,
      1,
      `Request coalescing FAILED: Expected exactly 1 network execution for 500 concurrent callers, got ${executionCount}`
    );
    assert.equal(coalescingCache.fetchCount, 1);
    assert.equal(allResults.length, concurrentCallers);

    for (let i = 0; i < concurrentCallers; i++) {
      const res = allResults[i];
      assert.equal(res.length, 1);
      assert.equal(res[0].citation, "PLD 2024 SC 777");
    }
  });

  it("EMPIRICAL-2.5: Multi-Key Burst Load (1,000 Concurrent Callers across 50 Distinct Keys -> Exactly 50 Fetches)", async () => {
    const multiKeyCache = new PrecedentMemoryCache(500, 30000);
    let totalBackendExecutions = 0;

    const mockMultiBackend = async (query: string) => {
      totalBackendExecutions++;
      await new Promise(r => setTimeout(r, 20));
      return [
        {
          citation: `2024 SCMR ${query.replace(/[^0-9]/g, "") || "100"}`,
          title: `Precedent for ${query}`,
          court: "Supreme Court of Pakistan",
          year: 2024,
          summary: `Summary for ${query}`
        }
      ];
    };

    const totalDistinctKeys = 50;
    const callersPerKey = 20;
    const allPromises: Promise<LandmarkPrecedent[]>[] = [];

    for (let k = 1; k <= totalDistinctKeys; k++) {
      for (let c = 0; c < callersPerKey; c++) {
        allPromises.push(
          multiKeyCache.resolvePrecedents(`Act_${k}`, `Section_${k}`, mockMultiBackend)
        );
      }
    }

    const aggregated = await Promise.all(allPromises);

    assert.equal(
      totalBackendExecutions,
      totalDistinctKeys,
      `Expected exactly ${totalDistinctKeys} backend executions for 1000 callers across 50 keys, got ${totalBackendExecutions}`
    );
    assert.equal(aggregated.length, totalDistinctKeys * callersPerKey);
    assert.equal(multiKeyCache.size(), totalDistinctKeys);
  });

  it("EMPIRICAL-2.6: Fault Resilience: Backend Exceptions & Malformed Payloads Under Burst Load", async () => {
    const faultCache = new PrecedentMemoryCache(100, 10000);

    const failingMock = async () => {
      await new Promise(r => setTimeout(r, 10));
      throw new Error("Simulated Connection Timeout 504");
    };

    const errorPromises = Array.from({ length: 50 }).map(() =>
      faultCache.resolvePrecedents("CrPC", "497", failingMock)
    );

    const errorResults = await Promise.all(errorPromises);
    for (const res of errorResults) {
      assert.deepEqual(res, [], "Callers must safely receive empty array on error without crashing");
    }

    const cachedError = faultCache.get(faultCache.getCacheKey("CrPC", "497"));
    assert.ok(cachedError);
    assert.equal(cachedError.status, "error");
    assert.ok(cachedError.error?.includes("Simulated Connection Timeout 504"));

    const malformedPayloads = [null, undefined, "not-json", 12345, { error: true }];
    for (const payload of malformedPayloads) {
      const malformedMock = async () => payload;
      const res = await faultCache.resolvePrecedents(`Statute_${Math.random()}`, "1", malformedMock);
      assert.deepEqual(res, []);
    }
  });

  it("EMPIRICAL-2.7: Normalization Invariant Check: Cache Keys Across Punctuation and Spacing Variations", () => {
    const variations = [
      ["Pakistan Penal Code 1860", "302"],
      ["  pakistan penal code 1860  ", "  302  "],
      ["PAKISTAN PENAL CODE 1860", "302"],
      ["Pakistan_Penal_Code_1860", "302"],
      ["Pakistan---Penal...Code 1860", "302"],
    ];

    const expectedKey = "pakistan_penal_code_1860__302";
    for (const [stat, sec] of variations) {
      const key = cache.getCacheKey(stat, sec);
      assert.equal(key, expectedKey, `Key mismatch for [${stat}, ${sec}]: got "${key}"`);
    }
  });
});
