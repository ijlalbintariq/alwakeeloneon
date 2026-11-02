/**
 * tests/unit/citation-identity-audit.test.ts
 *
 * Unit tests for Milestone M1 (Database Citation Identity Audit & Migration):
 * - Normalization & canonical key generation
 * - Judgment header classification (own, mislabeled, unknown)
 * - Anomaly detection in audit engine
 * - Migration transaction safety & dry-run guarantees
 * - Post-migration verification suite assertions
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalCitationKey,
  classifyJudgmentHeader,
  runCitationIdentityAudit,
} from "../../scripts/audit-citation-identity";
import {
  runCitationMigration,
  type MigrationPlan,
} from "../../scripts/migrate-citation-fixes";
import {
  runCitationVerification,
  type VerificationResult,
} from "../../scripts/verify-citation-migration";

// ============================================================
// 1. Citation Normalization & Canonical Key Tests
// ============================================================
test("canonicalCitationKey standardizes Pakistani journal acronyms across spacing and dots", () => {
  // Spaced acronyms collapse to canonical form
  assert.equal(canonicalCitationKey("2026 S C M R 1478"), "2026SCMR1478");
  assert.equal(canonicalCitationKey("2026 SCMR 1478"), "2026SCMR1478");
  assert.equal(canonicalCitationKey("S.C.M.R. 2024 1085"), "SCMR20241085");

  // Dotted PLD variants
  assert.equal(canonicalCitationKey("P.L.D. 2026 Lahore 593"), "PLD2026LAHORE593");
  assert.equal(canonicalCitationKey("PLD 2026 Lahore 593"), "PLD2026LAHORE593");
  assert.equal(canonicalCitationKey("P L D 2026 398"), "PLD2026398");

  // PCrLJ variants (Pakistan Criminal Law Journal)
  assert.equal(canonicalCitationKey("2026 P Cr. L J 1008"), "2026PCRLJ1008");
  assert.equal(canonicalCitationKey("2026 PCrLJ 1008"), "2026PCRLJ1008");
  assert.equal(canonicalCitationKey("P.Cr.L.J. 2020 450"), "PCRLJ2020450");

  // Notes and specialized divisions
  assert.equal(canonicalCitationKey("2023 Y.L.R. Notes 52"), "2023YLRN52");
  assert.equal(canonicalCitationKey("2022 PLC (C.S.) 1267"), "2022PLCCS1267");
  assert.equal(canonicalCitationKey("2021 C.L.C. Note 15"), "2021CLCN15");

  // Boundary splitting between alphanumeric characters
  assert.equal(canonicalCitationKey("PLD1968281"), "PLD1968281");
});

// ============================================================
// 2. Judgment Header Classification Tests
// ============================================================
test("classifyJudgmentHeader correctly identifies 'own' text provenance", () => {
  // Modern ingestion format with CITATION: field
  const modernText = `CITATION:  2026 SCMR 1478
CASE:      2026S911
TITLE:     MUHAMMAD NAWAZ VS GHULAM SHABBIR
COURT:     SUPREME-COURT
YEAR:      2026
JOURNAL:   SCMR
============================================================

305
2026 S C M R 1478
[Supreme Court of Pakistan]
Present: Shakeel Ahmad and Aamer Farooq, JJ
Judgment body...`;

  const modernResult = classifyJudgmentHeader("2026 SCMR 1478", modernText);
  assert.equal(modernResult.status, "own");
  assert.equal(modernResult.trueCitation, null);

  // Older ingestion format with Reported As:
  const legacyText = `Title: Federation of Pakistan vs Noor Khan
Court Name: Supreme Court of Pakistan
Reported As: 2024 SCMR 1085
Result: appeal dismissed
Full text of judgment follows...`;

  const legacyResult = classifyJudgmentHeader("2024 SCMR 1085", legacyText);
  assert.equal(legacyResult.status, "own");
  assert.equal(legacyResult.trueCitation, null);

  // Variant formatting in header vs stored citation
  const variantText = `CITATION: 2026 P Cr. L J 1008
Before Chief Justice Aalia Neelum
Qalab Abbas vs State...`;

  const variantResult = classifyJudgmentHeader("2026 PCrLJ 1008", variantText);
  assert.equal(variantResult.status, "own");
  assert.equal(variantResult.trueCitation, null);
});

test("classifyJudgmentHeader correctly detects 'mislabeled' text provenance", () => {
  const mislabeledText = `CITATION:  2018 SCMR 500
TITLE:     Different Case vs Different State
COURT:     SUPREME-COURT
Judgment text belonging to 2018 SCMR 500...`;

  const result = classifyJudgmentHeader("2024 SCMR 1085", mislabeledText);
  assert.equal(result.status, "mislabeled");
  assert.equal(result.trueCitation, "2018 SCMR 500");
});

test("classifyJudgmentHeader flags unresolvable or missing headers as 'unknown'", () => {
  // Inconclusive header without citation announcement
  const obscureText = `COURT: Sindh High Court CASE NO: Const. P. 5842/2022
Karachi Bench; attached petitions: 5843 to 5850...`;

  const obscureResult = classifyJudgmentHeader("2022 SHC 607", obscureText);
  assert.equal(obscureResult.status, "unknown");
  assert.equal(obscureResult.trueCitation, null);

  // Explicit 'CITATION: None'
  const noneText = `CITATION: None
CASE: 2013K12
Order sheet...`;

  const noneResult = classifyJudgmentHeader("2013 SHC 366", noneText);
  assert.equal(noneResult.status, "unknown");
  assert.equal(noneResult.trueCitation, null);
});

// ============================================================
// 3. Automated Audit Engine Tests (Mock Client)
// ============================================================
test("runCitationIdentityAudit accurately surfaces anomalies and calculates health metrics", async () => {
  const mockQueries: Record<string, any> = {
    "count(*)::int as count FROM citation_links WHERE source_judgment_id = target_judgment_id": {
      rows: [{ count: 100 }], // 100 self-links
    },
    "count(*)::int as count FROM citation_links": { rows: [{ count: 500 }] },
    "count(*)::int as count FROM judgments": { rows: [{ count: 1000 }] },
    "FROM citation_links WHERE source_judgment_id = target_judgment_id LIMIT 5": {
      rows: [{ id: 1, source_judgment_id: "uuid-1", citation_text: "2020 PLD 1" }],
    },
    "count(*)::int as count FROM unresolved_citations WHERE status = 'pending'": {
      rows: [{ count: 200 }],
    },
    "FROM unresolved_citations u \n      JOIN judgments j ON j.id = u.source_judgment_id": {
      rows: [{ count: 150 }], // 150 self-citations in unresolved
    },
    "SELECT count(*)::int as count \n      FROM unresolved_citations u \n      JOIN judgments j ON LOWER(TRIM(j.citation_string)) = LOWER(TRIM(u.raw_citation)) \n      WHERE u.source_judgment_id != j.id": {
      rows: [{ count: 10 }], // 10 cross-citations
    },
    "WITH matches AS MATERIALIZED": {
      rows: [{ id: 10, source_judgment_id: "src", raw_citation: "2021 SCMR 10", target_judgment_id: "tgt" }],
    },
    "GROUP BY text_status": {
      rows: [
        { status: "own", count: 850 },
        { status: "mislabeled", count: 100 },
        { status: "unknown", count: 20 },
        { status: "NULL", count: 30 }, // 30 unclassified
      ],
    },
    "FILTER (WHERE decision_date IS NULL)": {
      rows: [
        {
          null_dates: 50,
          null_courts: 20,
          null_petitioners: 5,
          null_respondents: 10,
          identical_parties: 15,
        },
      ],
    },
    "WHERE petitioner IS NOT NULL AND respondent IS NOT NULL AND LOWER(TRIM(petitioner)) = LOWER(TRIM(respondent))": {
      rows: [
        { id: "p1", citation_string: "2020 PLD 50", petitioner: "State", respondent: "State" },
      ],
    },
  };

  const mockClient = {
    async query(sqlText: string) {
      for (const [pattern, result] of Object.entries(mockQueries)) {
        if (sqlText.includes(pattern)) {
          return result;
        }
      }
      return { rows: [] };
    },
  };

  const report = await runCitationIdentityAudit(mockClient);

  assert.equal(report.database.totalJudgments, 1000);
  assert.equal(report.database.totalCitationLinks, 500);
  assert.equal(report.citationLinks.selfReferentialLinks, 100);
  assert.equal(report.citationLinks.validCrossLinks, 400);
  assert.equal(report.unresolvedCitations.selfCitations, 150);
  assert.equal(report.unresolvedCitations.resolvableCrossCitations, 10);
  assert.equal(report.textProvenance.unclassified, 30);
  assert.equal(report.metadataQuality.identicalParties, 15);
  assert.ok(report.healthScores.overallHealthScore < 100);
  assert.ok(report.recommendations.length >= 4);
});

// ============================================================
// 4. Migration Transaction & Dry-Run Safety Verification Tests
// ============================================================
test("runCitationMigration STRICTLY executes dry-run by default without mutating state", async () => {
  const executedStatements: string[] = [];

  const mockClient = {
    async query(sqlText: string) {
      executedStatements.push(sqlText.trim());
      if (sqlText.includes("count(*)::int as count FROM citation_links WHERE source_judgment_id = target_judgment_id")) {
        return { rows: [{ count: 148881 }] };
      }
      if (sqlText.includes("FROM unresolved_citations u \n      JOIN judgments j ON j.id = u.source_judgment_id")) {
        return { rows: [{ count: 73500 }] };
      }
      if (sqlText.includes("LOWER(TRIM(j.citation_string)) = LOWER(TRIM(u.raw_citation)) \n      WHERE u.source_judgment_id != j.id")) {
        return { rows: [{ count: 5 }] };
      }
      if (sqlText.includes("SELECT id, citation_string, full_text FROM judgments WHERE text_status IS NULL")) {
        return {
          rows: [
            { id: "j1", citation_string: "2026 SCMR 100", full_text: "CITATION: 2026 SCMR 100\nBody text" },
            { id: "j2", citation_string: "2026 PLD 200", full_text: "Inconclusive header" },
          ],
        };
      }
      return { rows: [] };
    },
  };

  // Run in default dry-run mode (apply: false)
  const plan: MigrationPlan = await runCitationMigration({ apply: false, client: mockClient });

  assert.equal(plan.mode, "dry-run");
  assert.equal(plan.status, "dry-run-completed");
  assert.equal(plan.actions.pruneSelfReferentialLinks.plannedCount, 148881);
  assert.equal(plan.actions.pruneSelfUnresolvedCitations.plannedCount, 73500);
  assert.equal(plan.actions.resolveCrossCitations.plannedCount, 5);
  assert.equal(plan.actions.classifyUnclassifiedJudgments.plannedCount, 2);
  assert.equal(plan.actions.classifyUnclassifiedJudgments.breakdown.own, 1);
  assert.equal(plan.actions.classifyUnclassifiedJudgments.breakdown.unknown, 1);

  // Verify transaction integrity: BEGIN was issued, followed by ROLLBACK. NEVER COMMIT!
  assert.ok(executedStatements.includes("BEGIN"));
  assert.ok(executedStatements.includes("ROLLBACK"));
  assert.ok(!executedStatements.includes("COMMIT"));

  // Verify that NO destructive mutations (DELETE, INSERT INTO citation_links, UPDATE) were executed
  for (const stmt of executedStatements) {
    assert.ok(!stmt.startsWith("DELETE FROM citation_links"), "Must not delete from citation_links during dry-run");
    assert.ok(!stmt.startsWith("DELETE FROM unresolved_citations"), "Must not delete from unresolved_citations during dry-run");
    assert.ok(!stmt.startsWith("INSERT INTO citation_links"), "Must not insert into citation_links during dry-run");
    assert.ok(!stmt.startsWith("UPDATE judgments"), "Must not update judgments during dry-run");
    assert.ok(!stmt.startsWith("CREATE TABLE"), "Must not create backup tables during dry-run");
  }
});

test("runCitationMigration in --apply mode creates backup snapshots, executes mutations, and commits", async () => {
  const executedStatements: string[] = [];

  const mockClient = {
    async query(sqlText: string, params?: any[]) {
      executedStatements.push(sqlText.trim());
      if (sqlText.includes("count(*)::int as count FROM citation_links WHERE source_judgment_id = target_judgment_id")) {
        return { rows: [{ count: 148881 }] };
      }
      if (sqlText.includes("FROM unresolved_citations u \n      JOIN judgments j ON j.id = u.source_judgment_id")) {
        return { rows: [{ count: 73500 }] };
      }
      if (sqlText.includes("LOWER(TRIM(j.citation_string)) = LOWER(TRIM(u.raw_citation)) \n      WHERE u.source_judgment_id != j.id")) {
        return { rows: [{ count: 5 }] };
      }
      if (sqlText.includes("SELECT id, citation_string, full_text FROM judgments WHERE text_status IS NULL")) {
        return {
          rows: [
            { id: "j1", citation_string: "2026 SCMR 100", full_text: "CITATION: 2026 SCMR 100\nBody text" },
          ],
        };
      }
      if (sqlText.startsWith("DELETE FROM citation_links")) {
        return { rowCount: 148881 };
      }
      if (sqlText.startsWith("DELETE FROM unresolved_citations") && sqlText.includes("source_judgment_id = j.id")) {
        return { rowCount: 73500 };
      }
      if (sqlText.startsWith("INSERT INTO citation_links")) {
        return { rowCount: 5 };
      }
      if (sqlText.startsWith("DELETE FROM unresolved_citations") && sqlText.includes("status = 'pending'")) {
        return { rowCount: 5 };
      }
      if (sqlText.startsWith("UPDATE judgments")) {
        return { rowCount: 1 };
      }
      return { rows: [] };
    },
  };

  const plan = await runCitationMigration({ apply: true, client: mockClient });

  assert.equal(plan.mode, "apply");
  assert.equal(plan.status, "applied");
  assert.ok(plan.backupTables?.citationLinks.startsWith("citation_links_backup_"));
  assert.ok(plan.backupTables?.unresolvedCitations.startsWith("unresolved_citations_backup_"));
  assert.equal(plan.actions.pruneSelfReferentialLinks.executedCount, 148881);
  assert.equal(plan.actions.pruneSelfUnresolvedCitations.executedCount, 73500);
  assert.equal(plan.actions.resolveCrossCitations.executedCount, 5);
  assert.equal(plan.actions.classifyUnclassifiedJudgments.executedCount, 1);

  // Verify backup tables were created BEFORE deletions
  const linksBackupIdx = executedStatements.findIndex((s) => s.includes("CREATE TABLE citation_links_backup_"));
  const unresBackupIdx = executedStatements.findIndex((s) => s.includes("CREATE TABLE unresolved_citations_backup_"));
  const deleteLinksIdx = executedStatements.findIndex((s) => s.includes("DELETE FROM citation_links WHERE source_judgment_id = target_judgment_id"));

  assert.ok(linksBackupIdx >= 0, "Links backup table creation executed");
  assert.ok(unresBackupIdx >= 0, "Unresolved backup table creation executed");
  assert.ok(deleteLinksIdx > linksBackupIdx, "Deletions must happen after backup table creation");

  // Verify atomic transaction committed
  assert.ok(executedStatements.includes("COMMIT"));
});

test("runCitationMigration rolls back immediately upon transaction error", async () => {
  const executedStatements: string[] = [];

  const mockClient = {
    async query(sqlText: string) {
      executedStatements.push(sqlText.trim());
      if (sqlText.includes("count(*)::int as count FROM citation_links")) {
        return { rows: [{ count: 10 }] };
      }
      if (sqlText.includes("CREATE TABLE citation_links_backup_")) {
        throw new Error("Disk full simulation or connection lost");
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    async () => {
      await runCitationMigration({ apply: true, client: mockClient });
    },
    { message: "Disk full simulation or connection lost" }
  );

  assert.ok(executedStatements.includes("BEGIN"));
  assert.ok(executedStatements.includes("ROLLBACK"));
  assert.ok(!executedStatements.includes("COMMIT"));
});

// ============================================================
// 5. Verification Suite Assertion Tests
// ============================================================
test("runCitationVerification asserts 0 anomalies on clean post-migration state", async () => {
  const cleanMockClient = {
    async query(sqlText: string) {
      if (sqlText.includes("WHERE source_judgment_id = target_judgment_id")) {
        return { rows: [{ count: 0 }] }; // 0 self-links
      }
      if (sqlText.includes("WHERE u.status = 'pending'") && (sqlText.includes("source_judgment_id = j.id") || sqlText.includes("j.id = u.source_judgment_id"))) {
        return { rows: [{ count: 0 }] }; // 0 self-citations in unresolved
      }
      if (sqlText.includes("WHERE text_status IS NULL")) {
        return { rows: [{ count: 0 }] }; // 0 unclassified judgments
      }
      if (sqlText.includes("WHERE u.source_judgment_id != j.id AND u.status = 'pending'")) {
        return { rows: [{ count: 0 }] }; // 0 pending resolvable cross citations
      }
      if (sqlText.includes("SELECT tablename FROM pg_tables")) {
        return { rows: [{ tablename: "citation_links_backup_20261102210000" }] };
      }
      return { rows: [{ count: 100 }] };
    },
  };

  const result: VerificationResult = await runCitationVerification(cleanMockClient);
  assert.equal(result.passed, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.checks.selfReferentialLinks.count, 0);
  assert.equal(result.checks.resolvableSelfCitations.count, 0);
  assert.equal(result.checks.unclassifiedTextStatus.count, 0);
  assert.equal(result.checks.resolvableCrossCitationsPending.count, 0);
});

test("runCitationVerification catches and reports remaining anomalies", async () => {
  const dirtyMockClient = {
    async query(sqlText: string) {
      if (sqlText.includes("WHERE source_judgment_id = target_judgment_id")) {
        return { rows: [{ count: 12 }] }; // 12 self-links remaining
      }
      if (sqlText.includes("WHERE u.status = 'pending'") && sqlText.includes("source_judgment_id = j.id")) {
        return { rows: [{ count: 5 }] }; // 5 self-citations remaining
      }
      if (sqlText.includes("WHERE text_status IS NULL")) {
        return { rows: [{ count: 3 }] }; // 3 unclassified remaining
      }
      if (sqlText.includes("WHERE u.source_judgment_id != j.id AND u.status = 'pending'")) {
        return { rows: [{ count: 1 }] };
      }
      return { rows: [{ count: 100 }] };
    },
  };

  const result = await runCitationVerification(dirtyMockClient);
  assert.equal(result.passed, false);
  assert.equal(result.errors.length, 4);
  assert.equal(result.checks.selfReferentialLinks.passed, false);
  assert.equal(result.checks.resolvableSelfCitations.passed, false);
  assert.equal(result.checks.unclassifiedTextStatus.passed, false);
  assert.equal(result.checks.resolvableCrossCitationsPending.passed, false);
});
