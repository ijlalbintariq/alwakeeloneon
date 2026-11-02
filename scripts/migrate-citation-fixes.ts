/**
 * scripts/migrate-citation-fixes.ts
 *
 * Scripted Database Citation Fix Migration Tool
 *
 * Requirements:
 * - Default mode is STRICTLY --dry-run (does not mutate database; reports exact count of rows).
 * - --apply mode executes in a single atomic transaction:
 *   1. Creates backup tables: citation_links_backup_<timestamp> and unresolved_citations_backup_<timestamp>
 *   2. Prunes self-referential links from citation_links
 *   3. Prunes self-citations from unresolved_citations
 *   4. Resolves pending cross-citations into citation_links where target judgment exists and source != target
 *   5. Classifies unclassified text_status IS NULL judgments based on header inspection
 * - Includes rollback on error.
 *
 * Usage:
 *   node --import tsx scripts/migrate-citation-fixes.ts           # Dry-run (default)
 *   node --import tsx scripts/migrate-citation-fixes.ts --dry-run # Dry-run explicitly
 *   node --import tsx scripts/migrate-citation-fixes.ts --apply   # Atomic transaction apply
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import {
  classifyJudgmentHeader,
  resolveDatabaseUrl,
} from "./audit-citation-identity";

const { Client } = pg;

export interface MigrationOptions {
  apply?: boolean;
  client?: any;
}

export interface MigrationPlan {
  mode: "dry-run" | "apply";
  timestamp: string;
  backupTables?: {
    citationLinks: string;
    unresolvedCitations: string;
  };
  actions: {
    pruneSelfReferentialLinks: {
      plannedCount: number;
      executedCount?: number;
    };
    pruneSelfUnresolvedCitations: {
      plannedCount: number;
      executedCount?: number;
    };
    resolveCrossCitations: {
      plannedCount: number;
      executedCount?: number;
    };
    classifyUnclassifiedJudgments: {
      plannedCount: number;
      executedCount?: number;
      breakdown: {
        own: number;
        mislabeled: number;
        unknown: number;
      };
    };
  };
  status: "dry-run-completed" | "applied" | "failed";
  committedAt?: string;
  error?: string;
}

/**
 * Runs the citation fixes migration either in --dry-run mode (default) or in --apply mode.
 */
export async function runCitationMigration(
  options: MigrationOptions = {}
): Promise<MigrationPlan> {
  const isApply = Boolean(options.apply);
  const mode = isApply ? "apply" : "dry-run";

  let client = options.client;
  let ownClient = false;

  if (!client) {
    const connectionString = resolveDatabaseUrl();
    client = new Client({
      connectionString,
      options: isApply ? "-c default_transaction_read_only=off" : "-c default_transaction_read_only=on",
      statement_timeout: 120000,
    });
    await client.connect();
    ownClient = true;
  }

  let transactionActive = false;

  try {
    // Start atomic transaction
    await client.query("BEGIN");
    transactionActive = true;

    // 1. Calculate self-referential links count in citation_links
    const selfLinksRes = await client.query(
      "SELECT count(*)::int as count FROM citation_links WHERE source_judgment_id = target_judgment_id"
    );
    const selfLinksCount = Number(selfLinksRes.rows[0]?.count || 0);

    // 2. Calculate self-citations count in unresolved_citations
    const selfUnresRes = await client.query(`
      SELECT count(*)::int as count 
      FROM unresolved_citations u 
      JOIN judgments j ON j.id = u.source_judgment_id 
        AND (LOWER(TRIM(j.citation_string)) = LOWER(TRIM(u.raw_citation)) 
             OR (j.year = u.year AND j.page = u.page))
      WHERE u.status = 'pending'
    `);
    const selfUnresCount = Number(selfUnresRes.rows[0]?.count || 0);

    // 3. Calculate resolvable cross-citations count in unresolved_citations
    const crossRes = await client.query(`
      SELECT count(*)::int as count 
      FROM unresolved_citations u 
      JOIN judgments j ON LOWER(TRIM(j.citation_string)) = LOWER(TRIM(u.raw_citation)) 
      WHERE u.source_judgment_id != j.id AND u.status = 'pending'
    `);
    const crossCount = Number(crossRes.rows[0]?.count || 0);

    // 4. Calculate unclassified judgments count and compute classification plan
    const unclassRes = await client.query(
      "SELECT id, citation_string, full_text FROM judgments WHERE text_status IS NULL"
    );
    const unclassifiedRows = unclassRes.rows || [];
    const unclassifiedCount = unclassifiedRows.length;

    let plannedOwn = 0;
    let plannedMislabeled = 0;
    let plannedUnknown = 0;

    const classifiedItems: Array<{
      id: string;
      status: "own" | "mislabeled" | "unknown";
      trueCitation: string | null;
    }> = [];

    for (const row of unclassifiedRows) {
      const cls = classifyJudgmentHeader(row.citation_string, row.full_text);
      if (cls.status === "own") plannedOwn++;
      else if (cls.status === "mislabeled") plannedMislabeled++;
      else plannedUnknown++;

      classifiedItems.push({
        id: String(row.id),
        status: cls.status,
        trueCitation: cls.trueCitation,
      });
    }

    const plan: MigrationPlan = {
      mode,
      timestamp: new Date().toISOString(),
      actions: {
        pruneSelfReferentialLinks: {
          plannedCount: selfLinksCount,
        },
        pruneSelfUnresolvedCitations: {
          plannedCount: selfUnresCount,
        },
        resolveCrossCitations: {
          plannedCount: crossCount,
        },
        classifyUnclassifiedJudgments: {
          plannedCount: unclassifiedCount,
          breakdown: {
            own: plannedOwn,
            mislabeled: plannedMislabeled,
            unknown: plannedUnknown,
          },
        },
      },
      status: isApply ? "applied" : "dry-run-completed",
    };

    if (!isApply) {
      // In dry-run mode: explicitly rollback transaction so nothing is mutated
      await client.query("ROLLBACK");
      transactionActive = false;
      return plan;
    }

    // ==========================================
    // EXECUTE ATOMIC MUTATIONS (--apply mode)
    // ==========================================
    const nowStamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    const linksBackupTable = `citation_links_backup_${nowStamp}`;
    const unresBackupTable = `unresolved_citations_backup_${nowStamp}`;

    plan.backupTables = {
      citationLinks: linksBackupTable,
      unresolvedCitations: unresBackupTable,
    };

    // Step 1: Create backup snapshot tables
    console.log(`[Apply] Creating snapshot table: ${linksBackupTable}...`);
    await client.query(`CREATE TABLE ${linksBackupTable} AS TABLE citation_links;`);

    console.log(`[Apply] Creating snapshot table: ${unresBackupTable}...`);
    await client.query(`CREATE TABLE ${unresBackupTable} AS TABLE unresolved_citations;`);

    // Step 2: Prune self-referential links from citation_links
    console.log(`[Apply] Pruning ${selfLinksCount.toLocaleString()} self-referential links...`);
    const delLinksRes = await client.query(
      "DELETE FROM citation_links WHERE source_judgment_id = target_judgment_id;"
    );
    plan.actions.pruneSelfReferentialLinks.executedCount = delLinksRes.rowCount ?? selfLinksCount;

    // Step 3: Prune self-citations from unresolved_citations
    console.log(`[Apply] Pruning ${selfUnresCount.toLocaleString()} self-citations from unresolved backlog...`);
    const delUnresRes = await client.query(`
      DELETE FROM unresolved_citations u
      USING judgments j
      WHERE u.source_judgment_id = j.id
        AND (LOWER(TRIM(j.citation_string)) = LOWER(TRIM(u.raw_citation))
             OR (j.year = u.year AND j.page = u.page));
    `);
    plan.actions.pruneSelfUnresolvedCitations.executedCount = delUnresRes.rowCount ?? selfUnresCount;

    // Step 4: Resolve pending cross-citations into citation_links
    console.log(`[Apply] Resolving ${crossCount} cross-citations into citation_links...`);
    const insertCrossRes = await client.query(`
      INSERT INTO citation_links (
        source_judgment_id, 
        target_judgment_id, 
        citation_text, 
        context_excerpt, 
        citation_type, 
        created_at
      )
      SELECT 
        u.source_judgment_id,
        j.id AS target_judgment_id,
        u.raw_citation,
        u.context_excerpt,
        CASE 
          WHEN LOWER(COALESCE(u.context_excerpt, '')) LIKE '%relied on%' OR 
               LOWER(COALESCE(u.context_excerpt, '')) LIKE '%relied upon%' OR 
               LOWER(COALESCE(u.context_excerpt, '')) LIKE '%following%' OR 
               LOWER(COALESCE(u.context_excerpt, '')) LIKE '%followed%' THEN 'relied_upon'
          WHEN LOWER(COALESCE(u.context_excerpt, '')) LIKE '%distinguish%' OR 
               LOWER(COALESCE(u.context_excerpt, '')) LIKE '%distinguished%' THEN 'distinguished'
          WHEN LOWER(COALESCE(u.context_excerpt, '')) LIKE '%overrule%' OR 
               LOWER(COALESCE(u.context_excerpt, '')) LIKE '%overruled%' THEN 'overruled'
          ELSE 'referred_to'
        END AS citation_type,
        NOW()
      FROM unresolved_citations AS u
      JOIN judgments AS j ON LOWER(TRIM(j.citation_string)) = LOWER(TRIM(u.raw_citation))
      WHERE u.source_judgment_id != j.id AND u.status = 'pending'
      ON CONFLICT (source_judgment_id, target_judgment_id, citation_type, citation_text) DO NOTHING;
    `);

    // Delete resolved citations from unresolved_citations
    const delCrossRes = await client.query(`
      DELETE FROM unresolved_citations u
      USING judgments j
      WHERE LOWER(TRIM(j.citation_string)) = LOWER(TRIM(u.raw_citation))
        AND u.source_judgment_id != j.id
        AND u.status = 'pending';
    `);
    plan.actions.resolveCrossCitations.executedCount = delCrossRes.rowCount ?? crossCount;

    // Step 5: Classify unclassified text_status IS NULL judgments
    console.log(`[Apply] Classifying ${unclassifiedCount} unclassified judgments...`);
    let classifiedCount = 0;
    for (const item of classifiedItems) {
      await client.query(
        "UPDATE judgments SET text_status = $2, text_true_citation = $3, updated_at = NOW() WHERE id = $1",
        [item.id, item.status, item.trueCitation]
      );
      classifiedCount++;
    }
    plan.actions.classifyUnclassifiedJudgments.executedCount = classifiedCount;

    // Step 6: Commit transaction
    console.log("[Apply] Committing atomic migration transaction...");
    await client.query("COMMIT");
    transactionActive = false;

    plan.status = "applied";
    plan.committedAt = new Date().toISOString();
    return plan;
  } catch (error: any) {
    if (transactionActive) {
      console.error("[Migration] Error encountered. Rolling back transaction immediately...");
      await client.query("ROLLBACK").catch(() => {});
      transactionActive = false;
    }
    throw error;
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
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const isDryRun = args.includes("--dry-run") || !isApply;

  console.log("=== Alwakeelo Database Citation Fix Migration ===");
  console.log(`Mode: ${isApply ? "APPLY (WRITING TO DATABASE)" : "DRY-RUN (NO MUTATIONS)"}`);

  const reportsDir = path.resolve(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const result = await runCitationMigration({ apply: isApply });

  const fileName = isApply ? "citation-migration-result.json" : "citation-migration-plan.json";
  const outputPath = path.join(reportsDir, fileName);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf8");

  console.log("\nMigration Plan / Execution Summary:");
  console.log("--------------------------------------------------");
  console.log(`Mode                             : ${result.mode.toUpperCase()}`);
  console.log(`Status                           : ${result.status}`);
  if (result.backupTables) {
    console.log(`Citation Links Backup Table      : ${result.backupTables.citationLinks}`);
    console.log(`Unresolved Citations Backup Table: ${result.backupTables.unresolvedCitations}`);
  }
  console.log(`Prune Self-Referential Links     : ${result.actions.pruneSelfReferentialLinks.plannedCount.toLocaleString()} rows`);
  console.log(`Prune Self-Citations (Unresolved): ${result.actions.pruneSelfUnresolvedCitations.plannedCount.toLocaleString()} rows`);
  console.log(`Resolve Pending Cross-Citations  : ${result.actions.resolveCrossCitations.plannedCount.toLocaleString()} rows`);
  console.log(`Classify Unclassified Judgments  : ${result.actions.classifyUnclassifiedJudgments.plannedCount.toLocaleString()} rows`);
  console.log(`  - Plan to mark as 'own'        : ${result.actions.classifyUnclassifiedJudgments.breakdown.own.toLocaleString()}`);
  console.log(`  - Plan to mark as 'mislabeled' : ${result.actions.classifyUnclassifiedJudgments.breakdown.mislabeled.toLocaleString()}`);
  console.log(`  - Plan to mark as 'unknown'    : ${result.actions.classifyUnclassifiedJudgments.breakdown.unknown.toLocaleString()}`);
  console.log("--------------------------------------------------");
  if (!isApply) {
    console.log("DRY-RUN COMPLETE: 0 rows modified or deleted in database.");
    console.log("To apply these changes, run with: --apply");
  } else {
    console.log(`APPLY COMPLETE: Migration committed successfully at ${result.committedAt}`);
  }
  console.log(`Report written to                : ${outputPath}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
