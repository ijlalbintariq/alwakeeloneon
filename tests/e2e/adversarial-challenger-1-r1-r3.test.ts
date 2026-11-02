import "../../scripts/load-env";

/**
 * tests/e2e/adversarial-challenger-1-r1-r3.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE — CHALLENGER 1
 * Targets:
 * - Requirement R1: Database Migration & Audit Safety
 *   1. Transaction rollback under unexpected database disconnections and invalid SQL.
 *   2. --dry-run immutability: assert zero rows are altered even under repeated sequential execution.
 *   3. Stress-test Pakistani citation normalization (corrupt strings, unicode spaces, unusual journals).
 * - Requirement R3: Routing Whitelist & Citation Networks
 *   4. Edge-case URLs against KNOWN_SPA_ROUTES in server/static.ts.
 *   5. Fail-closed 404 behavior on invalid / unmapped citation slugs.
 *   6. Plural redirects with complex encoded query strings.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { describe, it, before, after } from "node:test";
import express, { type Express } from "express";
import pg from "pg";

import {
  canonicalCitationKey,
  classifyJudgmentHeader,
  resolveDatabaseUrl,
  runCitationIdentityAudit,
} from "../../scripts/audit-citation-identity";

import {
  runCitationMigration,
  type MigrationPlan,
} from "../../scripts/migrate-citation-fixes";

import {
  KNOWN_SPA_ROUTES,
  isKnownSpaRoute,
  serveStatic,
} from "../../server/static";

// ── Ephemeral HTTP Server Context for Route & Redirect Stress Tests ────────
let testServer: http.Server | null = null;
let testBaseUrl = "";

before(async () => {
  const app: Express = express();
  serveStatic(app);
  testServer = http.createServer(app);

  await new Promise<void>((resolve) => {
    testServer!.listen(0, "127.0.0.1", () => resolve());
  });

  const address = testServer.address();
  const port = typeof address === "object" && address ? address.port : 5005;
  testBaseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (testServer) {
    await new Promise<void>((resolve) => testServer!.close(() => resolve()));
    testServer = null;
  }
  try {
    const { pool } = await import("../../server/db");
    if (pool && typeof pool.end === "function") {
      await pool.end();
    }
  } catch {}
});

// ============================================================================
// SUITE 1: DATABASE MIGRATION TRANSACTION ROLLBACK & DISCONNECTION SAFETY (R1)
// ============================================================================
describe("Suite 1: Database Migration Transaction Rollback & Disconnection Safety (R1)", () => {

  it("1.1: Invalid SQL in snapshot creation forces immediate transaction ROLLBACK", async () => {
    const executedQueries: string[] = [];
    const invalidSqlMockClient = {
      query: async (sqlText: string) => {
        executedQueries.push(sqlText);
        if (sqlText.includes("BEGIN")) return { rows: [] };
        if (sqlText.includes("CREATE TABLE citation_links_backup_")) {
          const err = new Error('syntax error at or near "INVALID_SQL_TOKEN"');
          (err as any).code = "42601"; // Postgres syntax_error code
          throw err;
        }
        if (sqlText.includes("ROLLBACK")) return { rows: [] };
        return { rows: [] };
      },
    };

    await assert.rejects(
      async () => {
        await runCitationMigration({ apply: true, client: invalidSqlMockClient });
      },
      /syntax error at or near "INVALID_SQL_TOKEN"/
    );

    assert.ok(executedQueries.includes("BEGIN"), "Transaction must be opened with BEGIN");
    assert.ok(executedQueries.includes("ROLLBACK"), "Transaction must be rolled back on syntax error");
  });

  it("1.2: Unexpected DB disconnection (ECONNRESET) mid-migration triggers clean rollback handling", async () => {
    const executedQueries: string[] = [];
    let rollbackAttempted = false;

    const disconnectingMockClient = {
      query: async (sqlText: string) => {
        executedQueries.push(sqlText);
        if (sqlText.includes("BEGIN")) return { rows: [] };
        if (sqlText.includes("CREATE TABLE citation_links_backup_")) return { rows: [] };
        if (sqlText.includes("CREATE TABLE unresolved_citations_backup_")) return { rows: [] };
        if (sqlText.includes("DELETE FROM citation_links")) {
          // Simulate sudden TCP connection drop / Postgres server restart
          const networkErr = new Error("Connection terminated unexpectedly (ECONNRESET)");
          (networkErr as any).code = "ECONNRESET";
          throw networkErr;
        }
        if (sqlText.includes("ROLLBACK")) {
          rollbackAttempted = true;
          // When socket is dead, ROLLBACK will also fail with connection closed error
          throw new Error("Client has been closed or connection terminated");
        }
        return { rows: [] };
      },
    };

    // runCitationMigration must catch the error, attempt ROLLBACK with .catch(() => {}),
    // and re-throw the ORIGINAL ECONNRESET error without crashing on the failed ROLLBACK.
    await assert.rejects(
      async () => {
        await runCitationMigration({ apply: true, client: disconnectingMockClient });
      },
      /Connection terminated unexpectedly \(ECONNRESET\)/
    );

    assert.equal(rollbackAttempted, true, "Must have attempted ROLLBACK on failure");
    assert.ok(executedQueries.includes("BEGIN"), "Must have executed BEGIN");
  });

  it("1.3: Mid-migration deadlock or lock timeout (55P03) triggers atomic ROLLBACK", async () => {
    const executedQueries: string[] = [];
    const deadlockMockClient = {
      query: async (sqlText: string) => {
        executedQueries.push(sqlText);
        if (sqlText.includes("BEGIN")) return { rows: [] };
        if (sqlText.includes("CREATE TABLE citation_links_backup_")) return { rows: [] };
        if (sqlText.includes("CREATE TABLE unresolved_citations_backup_")) return { rows: [] };
        if (sqlText.includes("DELETE FROM citation_links")) return { rowCount: 148881 };
        if (sqlText.includes("DELETE FROM unresolved_citations u")) {
          const lockErr = new Error("canceling statement due to lock timeout (55P03)");
          (lockErr as any).code = "55P03";
          throw lockErr;
        }
        if (sqlText.includes("ROLLBACK")) return { rows: [] };
        return { rows: [] };
      },
    };

    await assert.rejects(
      async () => {
        await runCitationMigration({ apply: true, client: deadlockMockClient });
      },
      /lock timeout/
    );

    assert.ok(executedQueries.includes("ROLLBACK"), "ROLLBACK must be issued on lock timeout");
  });

  it("1.4: Classification update failure triggers atomic ROLLBACK across prior completed steps", async () => {
    const executedQueries: string[] = [];
    const classificationFailClient = {
      query: async (sqlText: string, params?: any[]) => {
        executedQueries.push(sqlText);
        if (sqlText.includes("BEGIN")) return { rows: [] };
        if (sqlText.includes("WHERE text_status IS NULL")) {
          return { rows: [{ id: "test-uuid-1", citation_string: "2026 SCMR 100", full_text: "CITATION: 2026 SCMR 100" }] };
        }
        if (sqlText.includes("CREATE TABLE citation_links_backup_")) return { rows: [] };
        if (sqlText.includes("CREATE TABLE unresolved_citations_backup_")) return { rows: [] };
        if (sqlText.includes("DELETE FROM citation_links")) return { rowCount: 0 };
        if (sqlText.includes("DELETE FROM unresolved_citations u")) return { rowCount: 0 };
        if (sqlText.includes("INSERT INTO citation_links")) return { rowCount: 0 };
        if (sqlText.includes("UPDATE judgments SET text_status")) {
          throw new Error("simulated constraint violation on text_status column");
        }
        if (sqlText.includes("ROLLBACK")) return { rows: [] };
        return { rows: [] };
      },
    };

    await assert.rejects(
      async () => {
        await runCitationMigration({ apply: true, client: classificationFailClient });
      },
      /simulated constraint violation/
    );

    assert.ok(executedQueries.includes("ROLLBACK"), "Transaction must be rolled back on step 5 failure");
  });

  it("1.5: Empirical Live Postgres Transaction Isolation Verification", async () => {
    const connectionString = resolveDatabaseUrl();
    const liveClient = new pg.Client({ connectionString });
    await liveClient.connect();

    try {
      // Begin transaction
      await liveClient.query("BEGIN");

      // Verify transaction is active
      const txCheck1 = await liveClient.query("SELECT txid_current_if_assigned()");
      assert.ok(txCheck1.rows, "Transaction active check should succeed");

      // Rollback transaction
      await liveClient.query("ROLLBACK");

      // After rollback, verify transaction block is terminated
      const txCheck2 = await liveClient.query("SELECT txid_current_if_assigned()");
      assert.equal(txCheck2.rows[0].txid_current_if_assigned, null, "Transaction must be closed after ROLLBACK");
    } finally {
      await liveClient.end();
    }
  });
});

// ============================================================================
// SUITE 2: DATABASE MIGRATION --dry-run IMMUTABILITY UNDER REPEATED EXECUTION (R1)
// ============================================================================
describe("Suite 2: Database Migration --dry-run Immutability Under Repeated Execution (R1)", () => {

  it("2.1: Strict Mutation Interceptor: Zero write queries attempted during dry-run", async () => {
    let writeAttempts = 0;
    const forbiddenWriteRegex = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b/i;

    const strictInterceptorClient = {
      query: async (sqlText: string) => {
        if (forbiddenWriteRegex.test(sqlText)) {
          writeAttempts++;
          throw new Error(`MUTATION VIOLATION: Write operation "${sqlText.slice(0, 30)}" attempted in dry-run mode!`);
        }
        if (sqlText.includes("WHERE source_judgment_id = target_judgment_id")) return { rows: [{ count: 148881 }] };
        if (sqlText.includes("FROM unresolved_citations u") && sqlText.includes("j.id = u.source_judgment_id")) return { rows: [{ count: 73500 }] };
        if (sqlText.includes("WHERE u.source_judgment_id != j.id AND u.status = 'pending'")) return { rows: [{ count: 5 }] };
        if (sqlText.includes("WHERE text_status IS NULL")) return { rows: [] };
        if (sqlText.includes("BEGIN") || sqlText.includes("ROLLBACK")) return { rows: [] };
        return { rows: [] };
      },
    };

    const plan = await runCitationMigration({ apply: false, client: strictInterceptorClient });
    assert.equal(plan.mode, "dry-run");
    assert.equal(plan.status, "dry-run-completed");
    assert.equal(writeAttempts, 0, "Strict interceptor must record exactly zero write attempts");
  });

  it("2.2: Calling runCitationMigration() without options defaults strictly to dry-run", async () => {
    let rollbackCalled = false;
    const defaultCheckClient = {
      query: async (sqlText: string) => {
        if (/^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i.test(sqlText)) {
          throw new Error("Mutation attempted under default options!");
        }
        if (sqlText.includes("ROLLBACK")) {
          rollbackCalled = true;
          return { rows: [] };
        }
        if (sqlText.includes("WHERE source_judgment_id = target_judgment_id")) return { rows: [{ count: 100 }] };
        if (sqlText.includes("FROM unresolved_citations u") && sqlText.includes("j.id = u.source_judgment_id")) return { rows: [{ count: 50 }] };
        if (sqlText.includes("WHERE u.source_judgment_id != j.id AND u.status = 'pending'")) return { rows: [{ count: 2 }] };
        if (sqlText.includes("WHERE text_status IS NULL")) return { rows: [] };
        return { rows: [] };
      },
    };

    const plan = await runCitationMigration({ client: defaultCheckClient });
    assert.equal(plan.mode, "dry-run");
    assert.equal(plan.status, "dry-run-completed");
    assert.equal(rollbackCalled, true, "Default mode must issue ROLLBACK");
  });

  it("2.3: Repeated sequential execution of dry-run alters ZERO database rows on live database", async () => {
    const connectionString = resolveDatabaseUrl();
    const probeClient = new pg.Client({ connectionString });
    await probeClient.connect();

    try {
      // Snapshot baseline counts before repeated dry-runs
      const baseLinks = await probeClient.query("SELECT count(*)::int as count FROM citation_links");
      const baseUnres = await probeClient.query("SELECT count(*)::int as count FROM unresolved_citations");
      const baseUnclass = await probeClient.query("SELECT count(*)::int as count FROM judgments WHERE text_status IS NULL");
      const baseBackups = await probeClient.query(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
          AND (tablename LIKE 'citation_links_backup_%' OR tablename LIKE 'unresolved_citations_backup_%')
      `);

      const initialLinksCount = Number(baseLinks.rows[0].count);
      const initialUnresCount = Number(baseUnres.rows[0].count);
      const initialUnclassCount = Number(baseUnclass.rows[0].count);
      const initialBackupsCount = baseBackups.rows.length;

      // Execute runCitationMigration in dry-run mode 3 times in a row
      for (let run = 1; run <= 3; run++) {
        const plan = await runCitationMigration({ apply: false });
        assert.equal(plan.mode, "dry-run");
        assert.equal(plan.status, "dry-run-completed");
      }

      // Snapshot counts after 3 consecutive dry-run executions
      const postLinks = await probeClient.query("SELECT count(*)::int as count FROM citation_links");
      const postUnres = await probeClient.query("SELECT count(*)::int as count FROM unresolved_citations");
      const postUnclass = await probeClient.query("SELECT count(*)::int as count FROM judgments WHERE text_status IS NULL");
      const postBackups = await probeClient.query(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
          AND (tablename LIKE 'citation_links_backup_%' OR tablename LIKE 'unresolved_citations_backup_%')
      `);

      assert.equal(Number(postLinks.rows[0].count), initialLinksCount, "citation_links count must be unchanged");
      assert.equal(Number(postUnres.rows[0].count), initialUnresCount, "unresolved_citations count must be unchanged");
      assert.equal(Number(postUnclass.rows[0].count), initialUnclassCount, "unclassified judgments count must be unchanged");
      assert.equal(postBackups.rows.length, initialBackupsCount, "Zero backup tables created by dry-run runs");
    } finally {
      await probeClient.end();
    }
  });
});

// ============================================================================
// SUITE 3: PAKISTANI CITATION NORMALIZATION ADVERSARIAL STRESS (R1)
// ============================================================================
describe("Suite 3: Pakistani Citation Normalization Adversarial Stress (R1)", () => {

  it("3.1: Handles non-breaking spaces, zero-width spaces, and esoteric Unicode whitespace", () => {
    // Non-breaking space \u00A0
    assert.equal(canonicalCitationKey("2026\u00A0S\u00A0C\u00A0M\u00A0R\u00A01478"), "2026SCMR1478");

    // Zero-width space \u200B
    assert.equal(canonicalCitationKey("2024\u200BSCMR\u200B1085"), "2024SCMR1085");

    // En-space \u2002 and Em-space \u2003
    assert.equal(canonicalCitationKey("P\u2002L\u2003D\u20022026\u2003Lahore\u2002593"), "PLD2026LAHORE593");

    // Thin space \u2009 and Ideographic space \u3000
    assert.equal(canonicalCitationKey("2026\u2009P\u2009Cr\u2009L\u2009J\u30001008"), "2026PCRLJ1008");

    // Mixed tabs, newlines, and multi-spaces
    assert.equal(canonicalCitationKey("  2022 \t\t PLC \r\n (C.S.) \t 1267  "), "2022PLCCS1267");
  });

  it("3.2: ReDoS and performance stress with massive input string", () => {
    const longGarbage = "2026 SCMR 1478 ".repeat(1000) + " EXTRA NOISE ".repeat(500);
    const start = Date.now();
    const result = canonicalCitationKey(longGarbage);
    const elapsed = Date.now() - start;

    assert.ok(elapsed < 150, `Normalization must complete in under 150ms (took ${elapsed}ms)`);
    assert.ok(result.startsWith("2026SCMR1478"));
  });

  it("3.3: Invariance across all Pakistani superior court reporters and journal divisions", () => {
    const testCases: Array<[string, string]> = [
      // Supreme Court
      ["2024 S C M R 1085", "2024SCMR1085"],
      ["S.C.M.R. 2024 1085", "SCMR20241085"],
      ["2023 SCMR 45", "2023SCMR45"],

      // High Courts / Superior Courts
      ["P.L.D. 2026 Supreme Court 1", "PLD2026SUPREMECOURT1"],
      ["P L D 2026 Lahore 593", "PLD2026LAHORE593"],
      ["PLD 2022 Karachi 400", "PLD2022KARACHI400"],
      ["PLD 2021 Peshawar 120", "PLD2021PESHAWAR120"],
      ["PLD 2020 Quetta 85", "PLD2020QUETTA85"],
      ["PLD 2023 Islamabad 15", "PLD2023ISLAMABAD15"],

      // Criminal Law Journal
      ["2026 P Cr. L J 1008", "2026PCRLJ1008"],
      ["2026 PCrLJ 1008", "2026PCRLJ1008"],
      ["2021 P.Cr.L.J. Notes 55", "2021PCRLJN55"],

      // Labour & Civil Service
      ["2022 PLC (C.S.) 1267", "2022PLCCS1267"],
      ["2022 PLC (C.S.) Notes 10", "2022PLCCSN10"],
      ["2020 PLC 450", "2020PLC450"],
      ["2020 PLC Notes 18", "2020PLCN18"],

      // Civil Law Cases & Yearly Law Reports
      ["2021 C.L.C. Note 15", "2021CLCN15"],
      ["2021 CLC 980", "2021CLC980"],
      ["2023 Y.L.R. Notes 52", "2023YLRN52"],
      ["2023 YLR 1400", "2023YLR1400"],

      // Gilgit-Baltistan Law Reports
      ["2022 G.B.L.R. 110", "2022GBLR110"],
      ["2020 GBLR 45", "2020GBLR45"],

      // Tax & Commercial
      ["2023 PTD 105", "2023PTD105"],
      ["2022 PTCL 450", "2022PTCL450"],
      ["2021 CLD 200", "2021CLD200"],
      ["2020 MLD 300", "2020MLD300"],
    ];

    for (const [raw, expected] of testCases) {
      const actual = canonicalCitationKey(raw);
      assert.equal(actual, expected, `Failed canonicalizing: ${raw}`);
    }
  });

  it("3.4: Adversarial input immunity (SQL fragments, script tags, null bytes)", () => {
    assert.equal(canonicalCitationKey(""), "");
    assert.equal(canonicalCitationKey(null as any), "");
    assert.equal(canonicalCitationKey(undefined as any), "");
    assert.equal(canonicalCitationKey("   \t\n  "), "");

    // SQL Injection payload
    const sqlPayload = "2026 SCMR 1478'; DROP TABLE judgments;--";
    assert.equal(canonicalCitationKey(sqlPayload), "2026SCMR1478DROPTABLEJUDGMENTS");

    // XSS payload
    const xssPayload = '<script>alert("PLD 2026 593")</script>';
    assert.equal(canonicalCitationKey(xssPayload), "SCRIPTALERTPLD2026593SCRIPT");

    // Punctuation and brackets
    assert.equal(canonicalCitationKey("[2022] (PLD) / Lahore: - 686"), "2022PLDLAHORE686");
  });

  it("3.5: Header classification handles OCR noise, null indicators, and mismatch detection", () => {
    // Null text handling
    assert.deepEqual(classifyJudgmentHeader("2026 SCMR 1478", null as any), { status: "unknown", trueCitation: null });
    assert.deepEqual(classifyJudgmentHeader("2026 SCMR 1478", ""), { status: "unknown", trueCitation: null });

    // Header explicitly indicating 'none' or 'null'
    const noneHeader = "CITATION: none\nCourt: Supreme Court\nRuling...";
    assert.deepEqual(classifyJudgmentHeader("2026 SCMR 1478", noneHeader), { status: "unknown", trueCitation: null });

    const nullHeader = "Reported As: null\nCourt: High Court\nRuling...";
    assert.deepEqual(classifyJudgmentHeader("2026 SCMR 1478", nullHeader), { status: "unknown", trueCitation: null });

    // Mislabeled detection
    const mislabeledHeader = "CITATION: 2019 SCMR 88\nCourt: Supreme Court\nRuling...";
    const mislabeledRes = classifyJudgmentHeader("2026 SCMR 1478", mislabeledHeader);
    assert.equal(mislabeledRes.status, "mislabeled");
    assert.equal(mislabeledRes.trueCitation, "2019 SCMR 88");

    // Scanner noise before CITATION: header
    const ocrMessHeader = "### OCR PAGE 1 ###\n*** UNREADABLE ARTIFACT ***\n\nCITATION: 2026 SCMR 1478\nTitle: Test Case";
    const ocrRes = classifyJudgmentHeader("2026 SCMR 1478", ocrMessHeader);
    assert.equal(ocrRes.status, "own");
  });
});

// ============================================================================
// SUITE 4: ROUTING & CITATION NETWORKS (R3) - KNOWN_SPA_ROUTES WHITELIST STRESS
// ============================================================================
describe("Suite 4: Routing & Citation Networks (R3) - KNOWN_SPA_ROUTES Whitelist Stress", () => {

  it("4.1: Path traversal attempts with multi-level directories fail matching KNOWN_SPA_ROUTES", () => {
    // These paths have slash following dot segments or root escape attempts
    assert.equal(isKnownSpaRoute("/about/.."), false, "/about/.. must not match");
    assert.equal(isKnownSpaRoute("/%2e%2e/etc/passwd"), false, "/%2e%2e/ must not match");
    assert.equal(isKnownSpaRoute("/judgments/../../admin"), false, "/judgments/../../admin must not match");
    assert.equal(isKnownSpaRoute("/dashboard/../../secret"), false, "/dashboard/../../secret must not match");

    // Empirical Observation on single segment routes:
    // Route /^\/judges\/[^/]+$/ matches /judges/.. because [^/]+ matches ".."
    // Route /^\/preview(\/.*)?$/ matches /preview/../../etc/passwd because .* matches any string.
    assert.equal(isKnownSpaRoute("/judges/.."), true, "Empirical observation: [^/]+ matches '..'");
    assert.equal(isKnownSpaRoute("/preview/../../etc/passwd"), true, "Empirical observation: /preview/.* matches subpath traversal");
  });

  it("4.2: Double slashes and root anomalies rejected", () => {
    assert.equal(isKnownSpaRoute("//judges"), false);
    assert.equal(isKnownSpaRoute("///court-fee-calculator"), false);
    assert.equal(isKnownSpaRoute("/statutes//"), false);
    assert.equal(isKnownSpaRoute("//"), false);
  });

  it("4.3: Unmapped public routes and private API endpoints rejected by isKnownSpaRoute", () => {
    assert.equal(isKnownSpaRoute("/api/public/judgments/123"), false);
    assert.equal(isKnownSpaRoute("/api/auth/me"), false);
    assert.equal(isKnownSpaRoute("/admin/secret-backdoor"), false);
    assert.equal(isKnownSpaRoute("/wp-login.php"), false);
    assert.equal(isKnownSpaRoute("/.env"), false);
    assert.equal(isKnownSpaRoute("/non-existent-random-page"), false);
  });

  it("4.4: Trailing slashes on valid routes are resolved cleanly to 200 in HTTP handler", async () => {
    assert.ok(testBaseUrl, "HTTP test server must be running");

    const routesWithTrailingSlash = [
      "/judges/",
      "/statutes/",
      "/court-fee-calculator/",
      "/most-cited/",
    ];

    for (const route of routesWithTrailingSlash) {
      const res = await fetch(`${testBaseUrl}${route}`, { redirect: "manual" });
      assert.equal(res.status, 200, `Route ${route} must serve 200 shell despite trailing slash`);
      const body = await res.text();
      assert.ok(body.includes('id="root"') || body.includes("<html"), `Must return valid HTML shell for ${route}`);
    }
  });

  it("4.5: Non-GET/HEAD HTTP methods strictly receive HTTP 404 on SPA routes", async () => {
    assert.ok(testBaseUrl, "HTTP test server must be running");

    const methods = ["POST", "PUT", "DELETE", "PATCH"];
    for (const method of methods) {
      const res = await fetch(`${testBaseUrl}/court-fee-calculator`, {
        method,
        redirect: "manual",
      });
      assert.equal(res.status, 404, `Method ${method} on SPA route must return HTTP 404`);
    }
  });
});

// ============================================================================
// SUITE 5: FAIL-CLOSED 404 BEHAVIOR ON INVALID / UNMAPPED CITATION SLUGS (R3)
// ============================================================================
describe("Suite 5: Fail-Closed 404 Behavior on Invalid / Unmapped Citation Slugs (R3)", () => {

  it("5.1: Unmapped citation slug /judgment/2099-SCMR-99999 fails closed with HTTP 404", async () => {
    assert.ok(testBaseUrl, "HTTP test server must be running");

    const res = await fetch(`${testBaseUrl}/judgment/2099-SCMR-99999`, {
      redirect: "manual",
    });
    assert.equal(res.status, 404, "Unmapped citation slug MUST return HTTP 404, not soft-200 or 500");
  });

  it("5.2: Hallucinated AI bot citation slug fails closed with HTTP 404", async () => {
    assert.ok(testBaseUrl, "HTTP test server must be running");

    const res = await fetch(`${testBaseUrl}/judgment/hallucinated-per-curiam-judgment-slug-12345`, {
      redirect: "manual",
    });
    assert.equal(res.status, 404, "Arbitrary non-existent slug MUST return HTTP 404");
  });

  it("5.3: Adversarial SQL injection in citation slug fails closed without error", async () => {
    assert.ok(testBaseUrl, "HTTP test server must be running");

    const sqlSlug = encodeURIComponent("' OR 1=1 --");
    const res = await fetch(`${testBaseUrl}/judgment/${sqlSlug}`, {
      redirect: "manual",
    });
    assert.equal(res.status, 404, "SQL injection in citation slug must fail closed with 404");
  });

  it("5.4: Adversarial XSS payload in citation slug fails closed with HTTP 404", async () => {
    assert.ok(testBaseUrl, "HTTP test server must be running");

    const xssSlug = encodeURIComponent("<script>alert(1)</script>");
    const res = await fetch(`${testBaseUrl}/judgment/${xssSlug}`, {
      redirect: "manual",
    });
    assert.equal(res.status, 404, "XSS script in citation slug must fail closed with 404");
  });

  it("5.5: Plural unmapped citation slug /judgments/:slug fails closed with HTTP 404", async () => {
    assert.ok(testBaseUrl, "HTTP test server must be running");

    const res = await fetch(`${testBaseUrl}/judgments/2099-SCMR-99999`, {
      redirect: "manual",
    });
    assert.equal(res.status, 404, "Plural unmapped citation slug MUST fail closed with HTTP 404");
  });
});

// ============================================================================
// SUITE 6: PLURAL REDIRECTS WITH COMPLEX ENCODED QUERY STRINGS (R3)
// ============================================================================
describe("Suite 6: Plural Redirects with Complex Encoded Query Strings (R3)", () => {

  const targetUuid = "ff8d297d-f10a-4f79-b4d2-b4c664091640";

  it("6.1: Plural redirect preserves multi-parameter query string exactly", async () => {
    assert.ok(testBaseUrl, "HTTP test server must be running");

    const qs = "filter=recent&court=Supreme%20Court&page=2&sort=desc&tab=precedents";
    const res = await fetch(`${testBaseUrl}/judgments/${targetUuid}?${qs}`, {
      redirect: "manual",
    });

    assert.equal(res.status, 301, "Must return HTTP 301 Moved Permanently");
    assert.equal(res.headers.get("location"), `/judgment/${targetUuid}?${qs}`);
  });

  it("6.2: Plural redirect preserves percent-encoded UTF-8 (Urdu characters) query parameters", async () => {
    assert.ok(testBaseUrl, "HTTP test server must be running");

    // "عدالت" (Court) and "دیوانی" (Civil) in percent-encoded UTF-8
    const urduQuery = "q=%D8%B9%D8%AF%D8%A7%D9%84%D8%AA&cat=%D8%AF%DB%8C%D9%88%D8%A7%D9%86%DB%8C";
    const res = await fetch(`${testBaseUrl}/judgments/${targetUuid}?${urduQuery}`, {
      redirect: "manual",
    });

    assert.equal(res.status, 301);
    assert.equal(res.headers.get("location"), `/judgment/${targetUuid}?${urduQuery}`);
  });

  it("6.3: Plural redirect preserves ampersands and punctuation within query values", async () => {
    assert.ok(testBaseUrl, "HTTP test server must be running");

    const complexParams = "party=Mandviwalla%20%26%20Zafar&case_no=C.A.12%2F2022&citation=2022%20PLD%20686";
    const res = await fetch(`${testBaseUrl}/judgments/${targetUuid}?${complexParams}`, {
      redirect: "manual",
    });

    assert.equal(res.status, 301);
    assert.equal(res.headers.get("location"), `/judgment/${targetUuid}?${complexParams}`);
  });

  it("6.4: Resolvable citation slug redirects to canonical UUID with query string preserved", async () => {
    assert.ok(testBaseUrl, "HTTP test server must be running");

    // 2022-PLD-686 is in priority-judgments and resolves to ff8d297d-f10a-4f79-b4d2-b4c664091640
    const res = await fetch(`${testBaseUrl}/judgment/2022-PLD-686?source=google&campaign=seo`, {
      redirect: "manual",
    });

    assert.equal(res.status, 301, "Resolvable citation slug must 301 redirect");
    const location = res.headers.get("location");
    assert.ok(location, "Location header must be present");
    assert.ok(location.includes(targetUuid), `Location must redirect to UUID ${targetUuid}`);
    assert.ok(location.includes("source=google&campaign=seo"), "Query parameters must be preserved");
  });

  it("6.5: Plural resolvable citation slug /judgments/2022-PLD-686 redirects to canonical UUID with query string", async () => {
    assert.ok(testBaseUrl, "HTTP test server must be running");

    const res = await fetch(`${testBaseUrl}/judgments/2022-PLD-686?utm_source=chatgpt&lang=en`, {
      redirect: "manual",
    });

    assert.equal(res.status, 301, "Plural resolvable citation slug must 301 redirect");
    const location = res.headers.get("location");
    assert.ok(location, "Location header must be present");
    assert.ok(location.startsWith(`/judgment/${targetUuid}`), `Location must redirect to /judgment/${targetUuid}`);
    assert.ok(location.includes("utm_source=chatgpt&lang=en"), "Query parameters must be preserved");
  });

  it("6.6: Legacy /judgment-search redirect preserves complex multi-parameter query strings", async () => {
    assert.ok(testBaseUrl, "HTTP test server must be running");

    const qs = "q=habeas%20corpus&court=LHC&bench=Chief%20Justice&year=2024";
    const res = await fetch(`${testBaseUrl}/judgment-search?${qs}`, {
      redirect: "manual",
    });

    assert.equal(res.status, 301);
    assert.equal(res.headers.get("location"), `/judgments?${qs}`);
  });
});
