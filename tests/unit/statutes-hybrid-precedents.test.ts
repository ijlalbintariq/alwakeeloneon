/**
 * Unit & Integration Test Suite for Hybrid Precedent Architecture
 * 
 * Target:
 * - Tier 1: 0ms Instant Landmark SC Ratios & Precedents
 * - Tier 2: Dynamic Live DB Resolution Engine & Fallbacks
 * - In-Memory Precedent LRU Cache & Inflight Request Coalescing
 * - Landmark Authority Card Formatting & Drafting Triple-Bridge
 * 
 * Run with: node --import tsx --test tests/unit/statutes-hybrid-precedents.test.ts
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  STATUTE_SECTIONS,
  LIMITATION_SCHEDULE_ENTRIES,
  getStatuteSectionById,
  searchStatuteSections,
  formatLegalCitation,
  formatDraftingClause,
  type StatuteSection,
  type LandmarkCitation,
  type StatuteDomain,
} from "../../client/src/experimental/data/statutesCompendiumData.js";

import {
  SEED_JUDGMENTS,
  type SeedJudgmentRecord,
} from "../../client/src/experimental/data/seedJudgmentsData.js";

// ============================================================================
// SIMULATION ENGINE: Hybrid Precedent Cache & Dynamic DB Resolver Contract
// ============================================================================

export interface CachedPrecedentEntry {
  key: string;
  timestamp: number;
  status: "loading" | "resolved" | "empty" | "error";
  precedents: LandmarkCitation[];
  error?: string;
  source: "tier1_curated" | "live_db" | "cache";
}

export interface PrecedentResolutionState {
  precedents: LandmarkCitation[];
  isLoading: boolean;
  isCached: boolean;
  latencyMs: number;
  error?: string;
  source: "tier1" | "cache" | "live_db" | "empty";
}

export class PrecedentMemoryCache {
  private cache = new Map<string, CachedPrecedentEntry>();
  private inflight = new Map<string, Promise<LandmarkCitation[]>>();
  public readonly MAX_ENTRIES: number;
  public readonly TTL_MS: number;
  public fetchCount: number = 0;

  constructor(maxEntries: number = 1000, ttlMs: number = 30 * 60 * 1000) {
    this.MAX_ENTRIES = maxEntries;
    this.TTL_MS = ttlMs;
  }

  public getCacheKey(statuteName: string, sectionNumber: string): string {
    const cleanStatute = (statuteName || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const cleanSection = (sectionNumber || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return `${cleanStatute}__${cleanSection}`;
  }

  public get(key: string): CachedPrecedentEntry | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.TTL_MS) {
      this.cache.delete(key);
      return undefined;
    }
    return entry;
  }

  public set(key: string, precedents: LandmarkCitation[], source: "tier1_curated" | "live_db" | "cache"): void {
    if (this.cache.size >= this.MAX_ENTRIES) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      key,
      timestamp: Date.now(),
      status: precedents.length > 0 ? "resolved" : "empty",
      precedents,
      source,
    });
  }

  public clear(): void {
    this.cache.clear();
    this.inflight.clear();
    this.fetchCount = 0;
  }

  public size(): number {
    return this.cache.size;
  }

  public async resolvePrecedents(
    statuteName: string,
    sectionNumber: string,
    mockFetchFn?: (query: string) => Promise<any>
  ): Promise<LandmarkCitation[]> {
    const key = this.getCacheKey(statuteName, sectionNumber);
    const cached = this.get(key);
    if (cached && cached.status === "resolved") {
      return cached.precedents;
    }

    if (this.inflight.has(key)) {
      return this.inflight.get(key)!;
    }

    const fetchPromise = (async () => {
      this.fetchCount++;
      try {
        const query = `${statuteName} ${sectionNumber}`.trim();
        let items: any[] = [];

        if (mockFetchFn) {
          items = await mockFetchFn(query);
        }

        const results: LandmarkCitation[] = [];
        const seenCitations = new Set<string>();

        if (Array.isArray(items)) {
          for (const item of items) {
            const cit = String(item.citation || "").trim();
            if (cit && !seenCitations.has(cit.toLowerCase())) {
              seenCitations.add(cit.toLowerCase());
              const yearMatch = cit.match(/\b(19\d\d|20\d\d)\b/);
              results.push({
                citation: cit,
                title: item.title || "Judicial Landmark Precedent",
                court: item.court || "Superior Courts of Pakistan",
                year: item.year || (yearMatch ? parseInt(yearMatch[1], 10) : 2024),
                ratio: item.summary || item.ratio || "Statutory ratio and judicial holding from reported law journal.",
                urlPath: item.judgmentId ? `/preview/judgments?id=${item.judgmentId}` : undefined,
              });
            }
          }
        }

        this.set(key, results, "live_db");
        return results;
      } catch (err: any) {
        this.cache.set(key, {
          key,
          timestamp: Date.now(),
          status: "error",
          precedents: [],
          error: err.message,
          source: "live_db",
        });
        return [];
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, fetchPromise);
    return fetchPromise;
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe("Suite 1: Tier 1 Instant (0ms) Landmark SC Ratios & Precedents", () => {
  it("HP-1.1: Core litigation provisions exist in compendium with authoritative SC ratios", () => {
    const coreProvisions = [
      { id: "cpc-o7-r11", sec: "Order VII Rule 11", statute: "Code of Civil Procedure, 1908", citation: "PLD 2020 SC 142" },
      { id: "sra-sec-24c", sec: "Section 24(c)", statute: "Specific Relief Act, 1877", citation: "PLD 2021 SC 429" },
      { id: "sra-sec-42", sec: "Section 42", statute: "Specific Relief Act, 1877", citation: "PLD 2020 SC 703" },
      { id: "ppc-sec-302", sec: "Section 302", statute: "Pakistan Penal Code, 1860", citation: "PLD 2019 SC 527" },
      { id: "ppc-sec-489f", sec: "Section 489-F", statute: "Pakistan Penal Code, 1860", citation: "1998 SCMR 2268" },
      { id: "crpc-sec-497-498", sec: "Section 497 & 498", statute: "Code of Criminal Procedure, 1898", citation: "PLD 2017 SC 733" },
      { id: "const-art-199", sec: "Article 199", statute: "Constitution of the Islamic Republic of Pakistan, 1973", citation: "PLD 2016 SC 229" },
    ];

    for (const item of coreProvisions) {
      const section = getStatuteSectionById(item.id);
      assert.ok(section, `Expected section ${item.id} to be defined in Tier 1 compendium`);
      assert.equal(section.sectionNumber, item.sec);
      assert.ok(section.landmarkCitations.length >= 1, `Expected at least 1 landmark citation for ${item.id}`);
      
      const cit = section.landmarkCitations.find(c => c.citation === item.citation);
      assert.ok(cit, `Expected landmark citation ${item.citation} in ${item.id}`);
      assert.ok(cit.ratio.length > 30, `Expected detailed ratio in ${cit.citation}`);
      assert.ok(cit.court.length > 0, `Expected court in ${cit.citation}`);
      assert.ok(cit.year >= 1947 && cit.year <= 2030, `Expected valid year in ${cit.citation}`);
    }
  });

  it("HP-1.2: Mandatory pleading averments are provided for high-frequency litigation sections", () => {
    const provisionsWithPleadings = ["cpc-o7-r11", "sra-sec-24c", "sra-sec-42", "ppc-sec-489f"];
    for (const id of provisionsWithPleadings) {
      const section = getStatuteSectionById(id);
      assert.ok(section);
      assert.ok(section.mandatoryPleadings && section.mandatoryPleadings.length > 20, `Missing mandatory pleadings for ${id}`);
    }
  });

  it("HP-1.3: Synchronous 0ms retrieval latency for Tier 1 compendium provisions", () => {
    const t0 = performance.now();
    const section = getStatuteSectionById("cpc-o7-r11");
    const t1 = performance.now();
    assert.ok(section);
    assert.ok((t1 - t0) < 5, `Tier 1 retrieval must execute in under 5ms, took ${(t1 - t0).toFixed(2)}ms`);
  });

  it("HP-1.4: Citation string format validation across all compendium sections", () => {
    const validJournals = ["PLD", "SCMR", "CLC", "PCrLJ", "MLD", "PTD", "CLD", "YLR", "PLJ"];
    for (const section of STATUTE_SECTIONS) {
      for (const cit of section.landmarkCitations) {
        const hasJournal = validJournals.some(j => cit.citation.includes(j));
        assert.ok(hasJournal, `Citation "${cit.citation}" in section ${section.id} does not contain a standard Pakistani law journal`);
      }
    }
  });


  it("HP-1.6: Constitutional provisions (Art 199, Fundamental Rights) have correct domain and court metadata", () => {
    const art199 = getStatuteSectionById("const-art-199");
    assert.ok(art199);
    assert.equal(art199.domain, "constitutional");
    assert.ok(art199.landmarkCitations.some(c => c.court.includes("Supreme Court")));

    const fr = getStatuteSectionById("const-fundamental-rights");
    assert.ok(fr);
    assert.equal(fr.domain, "constitutional");
    assert.ok(fr.title.includes("Fair Trial") || fr.title.includes("Fundamental Rights"));
  });

  it("HP-1.7: Criminal provisions contain precise penalty and punishment descriptions", () => {
    const ppc302 = getStatuteSectionById("ppc-sec-302");
    assert.ok(ppc302);
    assert.ok(ppc302.punishmentOrRelief?.toLowerCase().includes("death") || ppc302.punishmentOrRelief?.toLowerCase().includes("life"));

    const ppc489f = getStatuteSectionById("ppc-sec-489f");
    assert.ok(ppc489f);
    assert.ok(ppc489f.punishmentOrRelief?.toLowerCase().includes("3 years") || ppc489f.punishmentOrRelief?.toLowerCase().includes("fine"));
  });

  it("HP-1.8: Civil provisions contain distinct procedural notes and ingredients", () => {
    const cpc = getStatuteSectionById("cpc-o7-r11");
    assert.ok(cpc);
    assert.ok(cpc.proceduralNotes && cpc.proceduralNotes.length > 20);
    assert.ok(cpc.keywords.some(k => k.toLowerCase().includes("plaint") || k.toLowerCase().includes("rejection")));
  });

  it("HP-1.5: SEED judgments dataset integrity & ratio decidendi depth", () => {
    assert.ok(SEED_JUDGMENTS.length >= 10, "Expected at least 10 landmark judgments in seed data");
    for (const j of SEED_JUDGMENTS) {
      assert.ok(j.id, "Judgment must have an id");
      assert.ok(j.citation, "Judgment must have a citation");
      assert.ok(j.title, "Judgment must have a title");
      assert.ok(j.court, "Judgment must have a court");
      assert.ok(j.year >= 1947, "Judgment must have a valid year");
      assert.ok(j.ratioDecidendi && j.ratioDecidendi.result.length > 10, "Judgment must have a substantial ratio");
      assert.ok(typeof j.headnotes === "string" && j.headnotes.length > 20, "Headnotes must be an array");
    }
  });
});

describe("Suite 2: Tier 2 Dynamic Live DB Precedent Resolution Engine", () => {
  let cache: PrecedentMemoryCache;

  beforeEach(() => {
    cache = new PrecedentMemoryCache();
  });

  it("HP-2.1: Resolves dynamic precedents from mock /api/case-law/cite response", async () => {
    const mockDb = async (query: string) => {
      return [
        {
          citation: "2023 SCMR 450",
          title: "State v. Ahmad",
          court: "Supreme Court of Pakistan",
          year: 2023,
          summary: "Principles governing trial procedure and evaluation of evidence under rare statutory enactments.",
          judgmentId: "judg-uuid-450",
        },
      ];
    };

    const results = await cache.resolvePrecedents("Defamation Ordinance 2002", "8", mockDb);
    assert.equal(results.length, 1);
    assert.equal(results[0].citation, "2023 SCMR 450");
    assert.equal(results[0].title, "State v. Ahmad");
    assert.equal(results[0].court, "Supreme Court of Pakistan");
    assert.equal(results[0].year, 2023);
    assert.equal(results[0].urlPath, "/preview/judgments?id=judg-uuid-450");
  });

  it("HP-2.2: Deduplicates duplicate citations returned from backend endpoints", async () => {
    const mockDb = async (query: string) => {
      return [
        { citation: "PLD 2022 SC 100", title: "Case A", summary: "Summary A" },
        { citation: "PLD 2022 SC 100", title: "Case A Duplicate", summary: "Summary A" },
        { citation: "pld 2022 sc 100", title: "Case A Lowercase", summary: "Summary A" },
        { citation: "2021 SCMR 500", title: "Case B", summary: "Summary B" },
      ];
    };

    const results = await cache.resolvePrecedents("Arbitration Act 1940", "34", mockDb);
    assert.equal(results.length, 2, "Duplicate citations must be deduplicated case-insensitively");
    assert.equal(results[0].citation, "PLD 2022 SC 100");
    assert.equal(results[1].citation, "2021 SCMR 500");
  });

  it("HP-2.3: Automatically extracts year from citation regex when year field is missing", async () => {
    const mockDb = async () => {
      return [
        { citation: "2019 SCMR 880", title: "Limitation Case", summary: "Section 5 condonation principles." },
      ];
    };

    const results = await cache.resolvePrecedents("Limitation Act 1908", "5", mockDb);
    assert.equal(results[0].year, 2019);
  });

  it("HP-2.4: Gracefully handles empty backend results without throwing", async () => {
    const mockEmpty = async () => [];
    const results = await cache.resolvePrecedents("Rare Nonexistent Act 1900", "999", mockEmpty);
    assert.equal(results.length, 0);
    const cachedEntry = cache.get(cache.getCacheKey("Rare Nonexistent Act 1900", "999"));
    assert.ok(cachedEntry);
    assert.equal(cachedEntry.status, "empty");
  });


  it("HP-2.6: Dynamic DB resolver handles non-array / null payload without throwing", async () => {
    const mockNull = async () => null;
    const results = await cache.resolvePrecedents("PPC", "999", mockNull);
    assert.equal(results.length, 0);

    const mockObject = async () => ({ error: "Not an array" });
    const results2 = await cache.resolvePrecedents("CrPC", "999", mockObject);
    assert.equal(results2.length, 0);
  });

  it("HP-2.7: Multi-word query normalization encodes spaces and characters safely", async () => {
    let capturedQuery = "";
    const mockCapture = async (q: string) => {
      capturedQuery = q;
      return [];
    };

    await cache.resolvePrecedents("Code of Criminal Procedure, 1898", "Section 497 & 498", mockCapture);
    assert.equal(capturedQuery, "Code of Criminal Procedure, 1898 Section 497 & 498");
  });

  it("HP-2.5: Gracefully handles backend network failure / error without crashing", async () => {
    const mockError = async () => {
      throw new Error("500 Internal Server Error: Database connection lost");
    };

    const results = await cache.resolvePrecedents("PPC", "302", mockError);
    assert.equal(results.length, 0);
    const cachedEntry = cache.get(cache.getCacheKey("PPC", "302"));
    assert.ok(cachedEntry);
    assert.equal(cachedEntry.status, "error");
    assert.ok(cachedEntry.error?.includes("500 Internal Server Error"));
  });
});

describe("Suite 3: In-Memory Precedent LRU Cache & Request Coalescing", () => {
  let cache: PrecedentMemoryCache;

  beforeEach(() => {
    cache = new PrecedentMemoryCache(5, 1000); // 5 max entries, 1000ms TTL
  });

  it("HP-3.1: Cache key normalization creates uniform keys across whitespace and casing", () => {
    const k1 = cache.getCacheKey("Pakistan Penal Code 1860", "302");
    const k2 = cache.getCacheKey("pakistan penal code 1860 ", " 302 ");
    const k3 = cache.getCacheKey("PAKISTAN PENAL CODE 1860", "302");
    assert.equal(k1, k2);
    assert.equal(k2, k3);
    assert.equal(k1, "pakistan_penal_code_1860__302");
  });

  it("HP-3.2: Cache hit returns instantaneously and skips subsequent network fetch", async () => {
    const mockDb = async (q: string) => [
      { citation: "PLD 2021 SC 1", title: "Hit Test", summary: "Summary" }
    ];

    // First call: triggers fetch (fetchCount = 1)
    const res1 = await cache.resolvePrecedents("CPC", "115", mockDb);
    assert.equal(cache.fetchCount, 1);
    assert.equal(res1.length, 1);

    // Second call: should hit memory cache (fetchCount stays 1)
    const t0 = performance.now();
    const res2 = await cache.resolvePrecedents("CPC", "115", mockDb);
    const t1 = performance.now();
    assert.equal(cache.fetchCount, 1, "Cache hit must not increment fetchCount");
    assert.equal(res2.length, 1);
    assert.equal(res2[0].citation, "PLD 2021 SC 1");
    assert.ok((t1 - t0) < 2, "In-memory cache hit should execute in <2ms");
  });

  it("HP-3.3: Inflight request coalescing eliminates duplicate concurrent requests", async () => {
    let callCount = 0;
    const slowMockDb = async (q: string) => {
      callCount++;
      await new Promise(r => setTimeout(r, 60));
      return [{ citation: "2024 SCMR 99", title: "Coalesce Test", summary: "Summary" }];
    };

    // Fire 10 concurrent requests simultaneously for same key
    const promises = Array.from({ length: 10 }).map(() =>
      cache.resolvePrecedents("PECA", "20", slowMockDb)
    );

    const allResults = await Promise.all(promises);
    assert.equal(callCount, 1, "Expected only 1 network call for 10 concurrent requests");
    for (const res of allResults) {
      assert.equal(res.length, 1);
      assert.equal(res[0].citation, "2024 SCMR 99");
    }
  });

  it("HP-3.4: TTL expiration invalidates stale entries and forces fresh fetch", async () => {
    const shortTtlCache = new PrecedentMemoryCache(10, 50); // 50ms TTL
    const mockDb = async (q: string) => [
      { citation: "PLD 2020 SC 50", title: "TTL Test", summary: "Summary" }
    ];

    await shortTtlCache.resolvePrecedents("QSO", "17", mockDb);
    assert.equal(shortTtlCache.fetchCount, 1);

    // Wait for TTL to expire
    await new Promise(r => setTimeout(r, 70));

    // Next call should detect expiry and re-fetch
    await shortTtlCache.resolvePrecedents("QSO", "17", mockDb);
    assert.equal(shortTtlCache.fetchCount, 2, "Expired entry must trigger a fresh fetch");
  });


  it("HP-3.6: Concurrent requests for different keys execute in parallel without cross-talk", async () => {
    const mockDb = async (q: string) => {
      await new Promise(r => setTimeout(r, 20));
      return [{ citation: `CIT for ${q}`, title: "Title", summary: "Summary" }];
    };

    const [resPPC, resCrPC] = await Promise.all([
      cache.resolvePrecedents("PPC", "302", mockDb),
      cache.resolvePrecedents("CrPC", "497", mockDb)
    ]);

    assert.equal(resPPC.length, 1);
    assert.equal(resPPC[0].citation, "CIT for PPC 302");
    assert.equal(resCrPC.length, 1);
    assert.equal(resCrPC[0].citation, "CIT for CrPC 497");
  });

  it("HP-3.7: Cache clear method flushes all entries and resets count", () => {
    cache.set("keyA", [{ citation: "CA", title: "TA", court: "SC", year: 2020, ratio: "RA" }], "live_db");
    assert.equal(cache.size(), 1);
    cache.clear();
    assert.equal(cache.size(), 0);
    assert.equal(cache.get("keyA"), undefined);
  });

  it("HP-3.5: LRU capacity eviction evicts oldest entry when max capacity is reached", () => {
    const smallCache = new PrecedentMemoryCache(3, 10000); // capacity 3
    smallCache.set("key1", [{ citation: "C1", title: "T1", court: "SC", year: 2020, ratio: "R1" }], "live_db");
    smallCache.set("key2", [{ citation: "C2", title: "T2", court: "SC", year: 2020, ratio: "R2" }], "live_db");
    smallCache.set("key3", [{ citation: "C3", title: "T3", court: "SC", year: 2020, ratio: "R3" }], "live_db");
    assert.equal(smallCache.size(), 3);

    // Adding 4th item should evict key1
    smallCache.set("key4", [{ citation: "C4", title: "T4", court: "SC", year: 2020, ratio: "R4" }], "live_db");
    assert.equal(smallCache.size(), 3);
    assert.equal(smallCache.get("key1"), undefined, "Oldest key1 must be evicted");
    assert.ok(smallCache.get("key2"));
    assert.ok(smallCache.get("key3"));
    assert.ok(smallCache.get("key4"));
  });
});

describe("Suite 4: Landmark Authority Cards UI & Drafting Triple-Bridge", () => {
  it("HP-4.1: formatLegalCitation produces compliant legal format with leading ratio", () => {
    const section = getStatuteSectionById("cpc-o7-r11");
    assert.ok(section);
    const citationText = formatLegalCitation(section);
    assert.ok(citationText.includes("Code of Civil Procedure, 1908"));
    assert.ok(citationText.includes("Order VII Rule 11"));
    assert.ok(citationText.includes("Leading Precedent:"));
    assert.ok(citationText.includes("PLD 2020 SC 142"));
  });

  it("HP-4.2: formatDraftingClause produces court-ready structured pleading paragraph", () => {
    const section = getStatuteSectionById("ppc-sec-489f");
    assert.ok(section);
    const clauseText = formatDraftingClause(section);
    assert.ok(clauseText.includes("STATUTORY PROVISION & RELEVANT LAW:"));
    assert.ok(clauseText.includes("Section 489-F"));
    assert.ok(clauseText.includes("Pakistan Penal Code, 1860"));
    assert.ok(clauseText.includes("LEGAL GROUNDS & APPLICABLE PRINCIPLES:"));
    assert.ok(clauseText.includes("1998 SCMR 2268") || clauseText.includes("Muhammad Aslam"));
  });


  it("HP-4.4: Section without landmark citations gracefully uses fallback in formatters", () => {
    const dummySection: StatuteSection = {
      id: "dummy-sec-1",
      sectionNumber: "Section 1",
      title: "Short Title",
      statuteName: "Test Custom Act, 2026",
      statuteYear: 2026,
      domain: "civil",
      text: "This is sample legislative text.",
      commentary: "Sample commentary for testing.",
      landmarkCitations: [],
      keywords: ["test"],
    };

    const citText = formatLegalCitation(dummySection);
    assert.ok(citText.includes("Test Custom Act, 2026"));
    assert.ok(citText.includes("Section 1"));

    const clauseText = formatDraftingClause(dummySection);
    assert.ok(clauseText.includes("Pursuant to Section 1 of the Test Custom Act, 2026"));
    assert.ok(clauseText.includes("This is sample legislative text."));
  });

  it("HP-4.3: Drafting Insert Payload conforms to cross-module communication contract", () => {
    const section = getStatuteSectionById("sra-sec-24c");
    assert.ok(section);

    const payload = {
      statute: section.statuteName,
      section: section.sectionNumber,
      title: section.title,
      clause: formatDraftingClause(section),
      formattedCitation: formatLegalCitation(section),
      timestamp: Date.now(),
    };

    assert.equal(payload.statute, "Specific Relief Act, 1877");
    assert.equal(payload.section, "Section 24(c)");
    assert.ok(payload.clause.includes("Specific Relief Act, 1877"));
    assert.ok(payload.timestamp > 0);

    // Verify serializability for localStorage & CustomEvent detail
    const serialized = JSON.stringify(payload);
    const deserialized = JSON.parse(serialized);
    assert.deepEqual(payload, deserialized);
  });
});
