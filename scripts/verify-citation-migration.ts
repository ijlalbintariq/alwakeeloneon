/**
 * scripts/verify-citation-migration.ts
 *
 * Post-Migration Verification Suite for Database Citation Integrity
 *
 * Asserts:
 * - Zero self-referential links in citation_links (source_judgment_id = target_judgment_id)
 * - Zero resolvable self-citations in unresolved_citations
 * - Zero unclassified text_status IS NULL records in judgments
 * - Zero pending resolvable cross-citations in unresolved_citations
 *
 * Exits with 0 on pass, non-zero (1) on failure.
 * Writes verification report to: reports/citation-verification-report.json
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { resolveDatabaseUrl } from "./audit-citation-identity";

const { Client } = pg;

export interface VerificationCheck {
  count: number;
  expected: number;
  passed: boolean;
  detail?: string;
}

export interface VerificationResult {
  timestamp: string;
  passed: boolean;
  checks: {
    selfReferentialLinks: VerificationCheck;
    resolvableSelfCitations: VerificationCheck;
    unclassifiedTextStatus: VerificationCheck;
    resolvableCrossCitationsPending: VerificationCheck;
  };
  databaseMetrics: {
    totalJudgments: number;
    totalCitationLinks: number;
    totalUnresolvedCitations: number;
  };
  backupTablesFound: string[];
  errors: string[];
}

/**
 * Runs the post-migration verification suite against a database client.
 */
export async function runCitationVerification(
  clientOrPool?: any
): Promise<VerificationResult> {
  let client = clientOrPool;
  let ownClient = false;

  if (!client) {
    const connectionString = resolveDatabaseUrl();
    client = new Client({
      connectionString,
      options: "-c default_transaction_read_only=on",
      statement_timeout: 60000,
    });
    await client.connect();
    ownClient = true;
  }

  const errors: string[] = [];

  try {
    // 1. Check self-referential links in citation_links
    const selfLinksRes = await client.query(
      "SELECT count(*)::int as count FROM citation_links WHERE source_judgment_id = target_judgment_id"
    );
    const selfLinksCount = Number(selfLinksRes.rows[0]?.count || 0);
    const selfLinksPassed = selfLinksCount === 0;
    if (!selfLinksPassed) {
      errors.push(
        `Assertion failed: citation_links contains ${selfLinksCount.toLocaleString()} self-referential links (expected 0)`
      );
    }

    // 2. Check self-citations in unresolved_citations
    const selfUnresRes = await client.query(`
      SELECT count(*)::int as count 
      FROM unresolved_citations u 
      JOIN judgments j ON j.id = u.source_judgment_id 
        AND (LOWER(TRIM(j.citation_string)) = LOWER(TRIM(u.raw_citation)) 
             OR (j.year = u.year AND j.page = u.page))
      WHERE u.status = 'pending'
    `);
    const selfUnresCount = Number(selfUnresRes.rows[0]?.count || 0);
    const selfUnresPassed = selfUnresCount === 0;
    if (!selfUnresPassed) {
      errors.push(
        `Assertion failed: unresolved_citations contains ${selfUnresCount.toLocaleString()} resolvable self-citations (expected 0)`
      );
    }

    // 3. Check unclassified judgments (text_status IS NULL)
    const unclassRes = await client.query(
      "SELECT count(*)::int as count FROM judgments WHERE text_status IS NULL"
    );
    const unclassCount = Number(unclassRes.rows[0]?.count || 0);
    const unclassPassed = unclassCount === 0;
    if (!unclassPassed) {
      errors.push(
        `Assertion failed: judgments contains ${unclassCount.toLocaleString()} unclassified records where text_status IS NULL (expected 0)`
      );
    }

    // 4. Check pending resolvable cross-citations
    const crossRes = await client.query(`
      SELECT count(*)::int as count 
      FROM unresolved_citations u 
      JOIN judgments j ON LOWER(TRIM(j.citation_string)) = LOWER(TRIM(u.raw_citation)) 
      WHERE u.source_judgment_id != j.id AND u.status = 'pending'
    `);
    const crossCount = Number(crossRes.rows[0]?.count || 0);
    const crossPassed = crossCount === 0;
    if (!crossPassed) {
      errors.push(
        `Assertion failed: unresolved_citations contains ${crossCount.toLocaleString()} pending cross-citations matching existing judgments (expected 0)`
      );
    }

    // 5. Query overall database metrics
    const totalJudgmentsRes = await client.query("SELECT count(*)::int as count FROM judgments");
    const totalLinksRes = await client.query("SELECT count(*)::int as count FROM citation_links");
    const totalUnresRes = await client.query("SELECT count(*)::int as count FROM unresolved_citations");

    const totalJudgments = Number(totalJudgmentsRes.rows[0]?.count || 0);
    const totalCitationLinks = Number(totalLinksRes.rows[0]?.count || 0);
    const totalUnresolvedCitations = Number(totalUnresRes.rows[0]?.count || 0);

    // 6. Inspect existing backup tables
    const backupsRes = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND (tablename LIKE 'citation_links_backup_%' OR tablename LIKE 'unresolved_citations_backup_%')
      ORDER BY tablename DESC
      LIMIT 10
    `);
    const backupTablesFound = backupsRes.rows.map((r: any) => String(r.tablename));

    const overallPassed =
      selfLinksPassed && selfUnresPassed && unclassPassed && crossPassed;

    const result: VerificationResult = {
      timestamp: new Date().toISOString(),
      passed: overallPassed,
      checks: {
        selfReferentialLinks: {
          count: selfLinksCount,
          expected: 0,
          passed: selfLinksPassed,
        },
        resolvableSelfCitations: {
          count: selfUnresCount,
          expected: 0,
          passed: selfUnresPassed,
        },
        unclassifiedTextStatus: {
          count: unclassCount,
          expected: 0,
          passed: unclassPassed,
        },
        resolvableCrossCitationsPending: {
          count: crossCount,
          expected: 0,
          passed: crossPassed,
        },
      },
      databaseMetrics: {
        totalJudgments,
        totalCitationLinks,
        totalUnresolvedCitations,
      },
      backupTablesFound,
      errors,
    };

    return result;
  } finally {
    if (ownClient && client) {
      await client.end().catch(() => {});
    }
  }
}

/**
 * CLI execution handler.
 */
async function main() {
  console.log("=== Alwakeelo Post-Migration Citation Verification ===");
  const result = await runCitationVerification();

  const reportsDir = path.resolve(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const outputPath = path.join(reportsDir, "citation-verification-report.json");
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf8");

  console.log("\nVerification Results:");
  console.log("--------------------------------------------------");
  console.log(
    `1. Self-referential links (citation_links)    : ${result.checks.selfReferentialLinks.count.toLocaleString()} (expected: 0) -> ${
      result.checks.selfReferentialLinks.passed ? "PASS [OK]" : "FAIL [ERROR]"
    }`
  );
  console.log(
    `2. Self-citations (unresolved_citations)      : ${result.checks.resolvableSelfCitations.count.toLocaleString()} (expected: 0) -> ${
      result.checks.resolvableSelfCitations.passed ? "PASS [OK]" : "FAIL [ERROR]"
    }`
  );
  console.log(
    `3. Unclassified status (judgments text_status): ${result.checks.unclassifiedTextStatus.count.toLocaleString()} (expected: 0) -> ${
      result.checks.unclassifiedTextStatus.passed ? "PASS [OK]" : "FAIL [ERROR]"
    }`
  );
  console.log(
    `4. Resolvable pending cross-citations         : ${result.checks.resolvableCrossCitationsPending.count.toLocaleString()} (expected: 0) -> ${
      result.checks.resolvableCrossCitationsPending.passed ? "PASS [OK]" : "FAIL [ERROR]"
    }`
  );
  console.log("--------------------------------------------------");
  console.log(`Database State:`);
  console.log(`  - Total Judgments                   : ${result.databaseMetrics.totalJudgments.toLocaleString()}`);
  console.log(`  - Total Citation Links              : ${result.databaseMetrics.totalCitationLinks.toLocaleString()}`);
  console.log(`  - Total Unresolved Citations        : ${result.databaseMetrics.totalUnresolvedCitations.toLocaleString()}`);
  if (result.backupTablesFound.length > 0) {
    console.log(`  - Backup Tables Detected (${result.backupTablesFound.length}):`);
    for (const b of result.backupTablesFound) {
      console.log(`      * ${b}`);
    }
  }
  console.log("--------------------------------------------------");
  console.log(`Report written to                      : ${outputPath}`);

  if (result.passed) {
    console.log("\n>>> OVERALL VERIFICATION: PASSED (Exit Code: 0) <<<\n");
    process.exit(0);
  } else {
    console.error("\n>>> OVERALL VERIFICATION: FAILED (Exit Code: 1) <<<");
    console.error("Violations detected:");
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    console.error("Run `npm run citation:fix:apply` or `node --import tsx scripts/migrate-citation-fixes.ts --apply` to fix.\n");
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Verification failed with uncaught error:", err);
    process.exit(1);
  });
}
