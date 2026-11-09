/**
 * tests/unit/full-judgment-link-audit.test.ts
 *
 * Unit and Self-Check Suite for Full Judgment Link & Identity Audit Runner.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  classifyAuditResult,
  normalizeWhitespace,
  computeSha256,
  saveCheckpoint,
  loadCheckpoint,
  acquireLock,
  releaseLock,
  formatReportMarkdown,
  SCRATCH_AUDIT_DIR,
  CHECKPOINT_FILE,
  LOCK_FILE,
  type AuditCheckpoint,
} from "../../scripts/audit-full-judgment-links";

test("normalizeWhitespace handles whitespace, newlines, and null bytes", () => {
  assert.equal(normalizeWhitespace("  hello   \t\n  world  "), "hello world");
  assert.equal(normalizeWhitespace("null\u0000byte"), "null byte");
  assert.equal(normalizeWhitespace(""), "");
});

test("computeSha256 produces valid 64-char hex string", () => {
  const hash = computeSha256("test text content");
  assert.equal(hash.length, 64);
  assert.equal(/^[a-f0-9]{64}$/.test(hash), true);
  // deterministic
  assert.equal(computeSha256("test text content"), hash);
});

test("classifyAuditResult correctly applies disjoint precedence rules", () => {
  // Case 1: Broken canonical pointer takes precedence over live link
  const brokenPointer = classifyAuditResult({
    isActive: false,
    isAlias: true,
    canonicalPointerValid: false,
    textStatus: "mislabeled",
    textIntegrity: "mislabeled",
    formattedTextValid: true,
    namespaceValid: true,
    liveApiStatus: 500,
  });
  assert.equal(brokenPointer.category, "broken_canonical_pointer");
  assert.ok(brokenPointer.reasons[0].includes("Invalid canonical pointer"));

  // Case 2: Live link broken (5xx) for valid active record
  const liveBroken500 = classifyAuditResult({
    isActive: true,
    isAlias: false,
    canonicalPointerValid: true,
    textStatus: "own",
    textIntegrity: "own",
    formattedTextValid: true,
    namespaceValid: true,
    liveApiStatus: 503,
  });
  assert.equal(liveBroken500.category, "live_link_broken");
  assert.ok(liveBroken500.reasons[0].includes("HTTP 503"));

  // Case 3: Live link broken (404 on active record)
  const liveBroken404 = classifyAuditResult({
    isActive: true,
    isAlias: false,
    canonicalPointerValid: true,
    textStatus: "own",
    textIntegrity: "own",
    formattedTextValid: true,
    namespaceValid: true,
    liveApiStatus: 404,
  });
  assert.equal(liveBroken404.category, "live_link_broken");

  // Case 4: Content mismatch (mismatched ID)
  const contentMismatchId = classifyAuditResult({
    isActive: true,
    isAlias: false,
    canonicalPointerValid: true,
    textStatus: "own",
    textIntegrity: "own",
    formattedTextValid: true,
    namespaceValid: true,
    liveApiStatus: 200,
    liveApiIdMatch: false,
    liveApiTitleMatch: true,
    liveApiTextMatch: true,
    liveApiIntegrityMatch: true,
  });
  assert.equal(contentMismatchId.category, "content_mismatch_live");

  // Case 5: Correctly withheld mislabeled
  const withheldMislabeled = classifyAuditResult({
    isActive: true,
    isAlias: false,
    canonicalPointerValid: true,
    textStatus: "mislabeled",
    textIntegrity: "mislabeled",
    formattedTextValid: true,
    namespaceValid: true,
    liveApiStatus: 200,
    liveApiIdMatch: true,
    liveApiTitleMatch: true,
    liveApiTextMatch: true,
    liveApiIntegrityMatch: true,
  });
  assert.equal(withheldMislabeled.category, "correctly_withheld_mislabeled");

  // Case 6: Correctly withheld unknown
  const withheldUnknown = classifyAuditResult({
    isActive: true,
    isAlias: false,
    canonicalPointerValid: true,
    textStatus: "unknown",
    textIntegrity: "unknown",
    formattedTextValid: true,
    namespaceValid: true,
    liveApiStatus: 200,
    liveApiIdMatch: true,
    liveApiTitleMatch: true,
    liveApiTextMatch: true,
    liveApiIntegrityMatch: true,
  });
  assert.equal(withheldUnknown.category, "correctly_withheld_unknown");

  // Case 7: Confirmed alias redirect
  const confirmedAlias = classifyAuditResult({
    isActive: false,
    isAlias: true,
    canonicalPointerValid: true,
    textStatus: "mislabeled",
    textIntegrity: "mislabeled",
    formattedTextValid: true,
    namespaceValid: true,
    liveApiStatus: 200,
    liveApiIdMatch: true,
    liveApiTitleMatch: true,
    liveApiTextMatch: true,
    liveApiIntegrityMatch: true,
  });
  assert.equal(confirmedAlias.category, "confirmed_alias_redirect");

  // Case 8: Confirmed active canonical
  const confirmedCanonical = classifyAuditResult({
    isActive: true,
    isAlias: false,
    canonicalPointerValid: true,
    textStatus: "own",
    textIntegrity: "own",
    formattedTextValid: true,
    namespaceValid: true,
    liveApiStatus: 200,
    liveApiIdMatch: true,
    liveApiTitleMatch: true,
    liveApiTextMatch: true,
    liveApiIntegrityMatch: true,
  });
  assert.equal(confirmedCanonical.category, "confirmed_active_canonical");

  // Case 9: Intentional archived record without alias
  const archivedNoAlias = classifyAuditResult({
    isActive: false,
    isAlias: false,
    canonicalPointerValid: true,
    textStatus: "own",
    textIntegrity: "own",
    formattedTextValid: true,
    namespaceValid: true,
    liveApiStatus: 404,
  });
  assert.equal(archivedNoAlias.category, "intentional_archived_no_alias");

  // Case 10: Stale search index row on unconfirmed record
  const staleSearch = classifyAuditResult({
    isActive: false,
    isAlias: false,
    canonicalPointerValid: true,
    textStatus: null,
    textIntegrity: "unknown",
    formattedTextValid: true,
    namespaceValid: true,
    liveApiStatus: 200,
    searchRowsStale: 1,
  });
  assert.equal(staleSearch.category, "search_index_stale");

  // Case 11: Active canonical with searchRowsStale keeps confirmed_active_canonical and notes reason
  const canonicalWithStaleSearch = classifyAuditResult({
    isActive: true,
    isAlias: false,
    canonicalPointerValid: true,
    textStatus: "own",
    textIntegrity: "own",
    formattedTextValid: true,
    namespaceValid: true,
    liveApiStatus: 200,
    liveApiIdMatch: true,
    liveApiTitleMatch: true,
    liveApiTextMatch: true,
    liveApiIntegrityMatch: true,
    searchRowsStale: 2,
  });
  assert.equal(canonicalWithStaleSearch.category, "confirmed_active_canonical");
  assert.ok(canonicalWithStaleSearch.reasons[0].includes("Search index row(s) contain stale metadata"));
});

test("checkpoint save and load maintains atomic integrity and counters", () => {
  const testCheckpointFile = path.join(SCRATCH_AUDIT_DIR, `test-checkpoint-${Date.now()}.json`);
  const dummyCheckpoint: AuditCheckpoint = {
    version: "1.0.0",
    startedAt: "2026-11-09T00:00:00.000Z",
    updatedAt: "2026-11-09T00:05:00.000Z",
    mode: "pilot",
    commitSha: "testcommit1234567890",
    dbHost: "neon.tech",
    totalInventoryCount: 235392,
    processedCount: 150,
    lastId: "00000000-0000-0000-0000-000000000150",
    pilotMetrics: {
      pilotSize: 150,
      durationMs: 75000,
      recordsPerSecond: 2.0,
      projectedRemainingHours: 32.6,
    },
    coverage: {
      inventoried: 235392,
      databaseChecked: 150,
      sourceCachedChecked: 12,
      livePageChecked: 150,
      liveApiChecked: 150,
      livePdfChecked: 1,
      searchRowsChecked: 140,
      pendingCount: 235242,
    },
    categories: {
      confirmed_active_canonical: 130,
      confirmed_alias_redirect: 15,
      correctly_withheld_mislabeled: 3,
      correctly_withheld_unknown: 2,
      intentional_archived_no_alias: 0,
      broken_canonical_pointer: 0,
      identity_mismatch_active: 0,
      live_link_broken: 0,
      content_mismatch_live: 0,
      search_index_stale: 0,
      insufficient_evidence: 0,
      transient_failed: 0,
    },
    failureSamples: [],
    status: "running",
  };

  try {
    saveCheckpoint(dummyCheckpoint, testCheckpointFile);
    const loaded = loadCheckpoint(testCheckpointFile);
    assert.ok(loaded);
    assert.equal(loaded.totalInventoryCount, 235392);
    assert.equal(loaded.processedCount, 150);
    assert.equal(loaded.categories.confirmed_active_canonical, 130);
    assert.equal(loaded.pilotMetrics?.recordsPerSecond, 2.0);
  } finally {
    try { fs.unlinkSync(testCheckpointFile); } catch {}
  }
});

test("exclusive run lock acquires, detects existing, and releases cleanly", () => {
  const testLockFile = path.join(SCRATCH_AUDIT_DIR, `test-lock-${Date.now()}.lock`);
  releaseLock(testLockFile);

  const lock1 = acquireLock(testLockFile);
  assert.equal(lock1.acquired, true);
  assert.equal(lock1.pid, process.pid);

  // Trying to acquire again with the same active pid reports active lock
  const lock2 = acquireLock(testLockFile);
  assert.equal(lock2.acquired, false);
  assert.equal(lock2.pid, process.pid);

  releaseLock(testLockFile);
  assert.equal(fs.existsSync(testLockFile), false);
});

test("formatReportMarkdown formats comprehensive markdown summary", () => {
  const dummyCheckpoint: AuditCheckpoint = {
    version: "1.0.0",
    startedAt: "2026-11-09T00:00:00.000Z",
    updatedAt: "2026-11-09T00:05:00.000Z",
    mode: "pilot",
    commitSha: "01b36657bff2dd5367e24dcec9fa07c2dbc62d3e",
    dbHost: "neon.tech",
    totalInventoryCount: 235392,
    processedCount: 200,
    lastId: "00000000-0000-0000-0000-000000000200",
    pilotMetrics: {
      pilotSize: 200,
      durationMs: 100000,
      recordsPerSecond: 2.0,
      projectedRemainingHours: 32.7,
    },
    coverage: {
      inventoried: 235392,
      databaseChecked: 200,
      sourceCachedChecked: 18,
      livePageChecked: 200,
      liveApiChecked: 200,
      livePdfChecked: 2,
      searchRowsChecked: 195,
      pendingCount: 235192,
    },
    categories: {
      confirmed_active_canonical: 180,
      confirmed_alias_redirect: 16,
      correctly_withheld_mislabeled: 3,
      correctly_withheld_unknown: 1,
      intentional_archived_no_alias: 0,
      broken_canonical_pointer: 0,
      identity_mismatch_active: 0,
      live_link_broken: 0,
      content_mismatch_live: 0,
      search_index_stale: 0,
      insufficient_evidence: 0,
      transient_failed: 0,
    },
    failureSamples: [],
    status: "paused",
  };

  const md = formatReportMarkdown(dummyCheckpoint);
  assert.ok(md.includes("AlWakeelo Full Judgment Link and Identity Audit Report"));
  assert.ok(md.includes("235,392"));
  assert.ok(md.includes("2 records/second"));
  assert.ok(md.includes("32.7 hours"));
  assert.ok(md.includes("confirmed_active_canonical"));
});
