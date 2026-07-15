process.env.DATABASE_URL = "postgresql://localhost:5432/dummy_test_db";
process.env.PGHOST = "localhost";

import assert from "node:assert/strict";
import test from "node:test";

// Dynamically import to ensure process.env changes are picked up during module resolution
const { pool } = await import("../../server/db");
const { similaritySearch } = await import("../../server/rag/vector-store");
const { CitationExtractor } = await import("../../server/services/citation-extractor");

test("hybrid search: weight normalization and ranking calculations", () => {
  // Model of the hybrid search scoring logic
  function calculateHybridScore(
    vectorScore: number,
    keywordScore: number,
    vectorWeightRaw: number,
    keywordWeightRaw: number
  ): number {
    const weightSum = vectorWeightRaw + keywordWeightRaw || 1;
    const vectorWeight = Math.max(0, vectorWeightRaw / weightSum);
    const keywordWeight = Math.max(0, keywordWeightRaw / weightSum);
    return (vectorWeight * vectorScore) + (keywordWeight * Math.min(1.0, keywordScore));
  }

  // Sort function matching the SQL: ORDER BY score DESC, vector_score DESC
  function sortResults(items: { id: number; vectorScore: number; keywordScore: number }[], vectorWeight: number, keywordWeight: number) {
    return [...items].map(item => {
      const score = calculateHybridScore(item.vectorScore, item.keywordScore, vectorWeight, keywordWeight);
      return { ...item, score };
    }).sort((a, b) => {
      if (Math.abs(a.score - b.score) > 1e-9) {
        return b.score - a.score;
      }
      return b.vectorScore - a.vectorScore;
    });
  }

  const items = [
    { id: 1, vectorScore: 0.9, keywordScore: 0.1 },
    { id: 2, vectorScore: 0.7, keywordScore: 0.9 },
    { id: 3, vectorScore: 0.5, keywordScore: 1.5 },
  ];

  // Test Case 1: Pure vector search
  const sortedVectorOnly = sortResults(items, 1.0, 0.0);
  assert.equal(sortedVectorOnly[0].id, 1, "Pure vector search should rank highest vectorScore first");
  assert.equal(sortedVectorOnly[1].id, 2);
  assert.equal(sortedVectorOnly[2].id, 3);

  // Test Case 2: Pure keyword search (note: keyword score is capped at 1.0)
  const sortedKeywordOnly = sortResults(items, 0.0, 1.0);
  // Both item 2 (keywordScore = 0.9) and item 3 (keywordScore = 1.5 -> capped at 1.0)
  // are compared. Capped keyword scores: item 3 = 1.0, item 2 = 0.9, item 1 = 0.1.
  assert.equal(sortedKeywordOnly[0].id, 3, "Pure keyword search should rank highest keywordScore first");
  assert.equal(sortedKeywordOnly[1].id, 2);
  assert.equal(sortedKeywordOnly[2].id, 1);

  // Test Case 3: Balanced hybrid search (0.5 vector, 0.5 keyword)
  // scores:
  // item 1: 0.5 * 0.9 + 0.5 * 0.1 = 0.5
  // item 2: 0.5 * 0.7 + 0.5 * 0.9 = 0.8
  // item 3: 0.5 * 0.5 + 0.5 * 1.0 = 0.75 (since keyword score 1.5 is capped at 1.0)
  const sortedBalanced = sortResults(items, 0.5, 0.5);
  assert.equal(sortedBalanced[0].id, 2, "Balanced search should rank item 2 first (score 0.8)");
  assert.equal(sortedBalanced[1].id, 3, "Balanced search should rank item 3 second (score 0.75)");
  assert.equal(sortedBalanced[2].id, 1, "Balanced search should rank item 1 third (score 0.5)");

  // Test Case 4: Weighted hybrid (0.75 vector, 0.25 keyword)
  // scores:
  // item 1: 0.75 * 0.9 + 0.25 * 0.1 = 0.675 + 0.025 = 0.7
  // item 2: 0.75 * 0.7 + 0.25 * 0.9 = 0.525 + 0.225 = 0.75
  // item 3: 0.75 * 0.5 + 0.25 * 1.0 = 0.375 + 0.25 = 0.625
  const sortedWeighted = sortResults(items, 0.75, 0.25);
  assert.equal(sortedWeighted[0].id, 2, "Weighted search should rank item 2 first (score 0.75)");
  assert.equal(sortedWeighted[1].id, 1, "Weighted search should rank item 1 second (score 0.7)");
  assert.equal(sortedWeighted[2].id, 3, "Weighted search should rank item 3 third (score 0.625)");
});

test("similaritySearch: SQL construction and query branch selection", async () => {
  let lastSql = "";
  let lastParams: any[] = [];

  // Setup database query mock on the pool
  const originalQuery = pool.query;
  pool.query = async (sql: string, params?: any[]) => {
    lastSql = sql;
    lastParams = params || [];
    return {
      rows: [
        {
          id: 42,
          rag_document_id: 10,
          source_document_id: 100,
          title: "Test Title",
          chunk_index: 2,
          token_count: 150,
          chunk_text: "Mock text snippet",
          metadata: { section: "test" },
          vector_score: 0.85,
          keyword_score: 0.45,
          score: 0.73,
        }
      ]
    };
  };

  try {
    // 1. Check vector-only search (keywordWeight = 0)
    const resultsVectorOnly = await similaritySearch({
      userId: "test-user-1",
      queryEmbedding: new Array(384).fill(0.1),
      queryText: "hello world",
      topK: 5,
      vectorWeight: 1.0,
      keywordWeight: 0.0,
    });

    assert.ok(lastSql.includes("vector_hits"), "Should include vector_hits CTE");
    assert.ok(!lastSql.includes("keyword_hits"), "Should not include keyword_hits CTE when keywordWeight = 0");
    assert.equal(resultsVectorOnly.length, 1);
    assert.equal(resultsVectorOnly[0].id, 42);
    assert.equal(resultsVectorOnly[0].score, 0.73);

    // Reset track variables
    lastSql = "";
    lastParams = [];

    // 2. Check hybrid search (keywordWeight > 0)
    const resultsHybrid = await similaritySearch({
      userId: "test-user-1",
      queryEmbedding: new Array(384).fill(0.1),
      queryText: "hello world",
      topK: 5,
      vectorWeight: 0.7,
      keywordWeight: 0.3,
    });

    assert.ok(lastSql.includes("vector_hits"), "Should include vector_hits CTE");
    assert.ok(lastSql.includes("keyword_hits"), "Should include keyword_hits CTE when keywordWeight > 0");
    assert.ok(lastSql.includes("UNION"), "Should union vector and keyword hits");
    assert.ok(lastSql.includes("merged"), "Should select from merged CTE");
    assert.equal(resultsHybrid.length, 1);
  } finally {
    pool.query = originalQuery;
  }
});

test("CitationExtractor parses compact/neutral high court citations and standard spacing citations", () => {
  const extractor = new CitationExtractor();

  const text = `
    Standard format: 2022 PLD 100.
    Compact neutral format: 2021LHC1234.
    Another compact format: 2020IHC567.
    Compact with spaces: 2019 SHC 999.
    Compact lowercase: 2018lhC4321.
    Some non-citation: 2020 ABC 123 (ABC is not in JOURNAL_CODES).
    Double check standard: 2021 SCMR 77.
  `;

  const extracted = extractor.extractFromText(text, "test-doc-1");

  const citationMap = new Map(extracted.map(c => [c.rawCitation, c]));

  assert.ok(citationMap.has("2022 PLD 100"), "Should extract standard PLD citation");
  assert.ok(citationMap.has("2021 LHC 1234"), "Should extract compact LHC citation and normalize with spaces");
  assert.ok(citationMap.has("2020 IHC 567"), "Should extract compact IHC citation and normalize with spaces");
  assert.ok(citationMap.has("2019 SHC 999"), "Should extract compact SHC citation with spaces");
  assert.ok(citationMap.has("2018 LHC 4321"), "Should extract compact lowercase LHC citation");
  assert.ok(citationMap.has("2021 SCMR 77"), "Should extract standard SCMR citation");

  // Verify non-matching journal code is NOT extracted
  assert.ok(!extracted.some(c => c.journalCode === "ABC"), "Should not extract unrecognized journal code");

  // Verify specific extraction properties for compact LHC citation
  const lhc = citationMap.get("2021 LHC 1234")!;
  assert.equal(lhc.year, 2021);
  assert.equal(lhc.journalCode, "LHC");
  assert.equal(lhc.page, 1234);
});

test("court report mapping resolving logic tests", () => {
  const COURT_REPORT_MAP: Record<string, string> = {
    LAHORE: "LHC",
    LAH: "LHC",
    KARACHI: "SHC",
    KAR: "SHC",
    SINDH: "SHC",
    SHC: "SHC",
    PESHAWAR: "PHC",
    PESH: "PHC",
    BALOCHISTAN: "BHC",
    ISLAMABAD: "IHC",
    AJK: "AJKHC",
    AJKHC: "AJKHC",
  };
  
  function resolveReport(raw: string): string | null {
    const direct = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (COURT_REPORT_MAP[direct]) return COURT_REPORT_MAP[direct];
    return null;
  }

  assert.equal(resolveReport("Lahore"), "LHC");
  assert.equal(resolveReport("Lah"), "LHC");
  assert.equal(resolveReport("Karachi"), "SHC");
  assert.equal(resolveReport("Sindh"), "SHC");
  assert.equal(resolveReport("Islamabad"), "IHC");
  assert.equal(resolveReport("Peshawar"), "PHC");
});
