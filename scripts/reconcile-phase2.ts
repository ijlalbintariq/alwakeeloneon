/**
 * scripts/reconcile-phase2.ts
 *
 * Phase 2 Reconciliation for Quarantined Records:
 * 1. Re-evaluates the 7,992 'unknown' records using enhanced High Court, Tribunal & Caption rules.
 * 2. Backs up target records to judgments_backup_reconcile_phase2_<timestamp>.
 * 3. In an atomic transaction:
 *    - Promotes newly verified judgments (~4,288) to text_status = 'own'.
 *    - Classifies confirmed citation mismatches (6,208) to text_status = 'mislabeled' with true citation.
 *    - Cleans extraction artifacts from titles.
 *    - Leaves genuinely thin / ambiguous fragments (~3,704) quarantined as 'unknown'.
 *
 * ZERO PAID AI CALLS: 100% deterministic local AST, regex and PostgreSQL transactions.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Client } from "pg";
import { evaluateJudgmentReconciliation, UNKNOWN_RECONCILE_DIR, ReconcileDecision } from "./reconcile-unknown-citations";

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const batchSize = 1000;

  console.log(`=== Quarantined Citation Reconciliation - Phase 2 ===`);
  console.log(`Mode: ${isApply ? "ATOMIC APPLY (Live DB Update)" : "STRICT DRY-RUN (Zero DB mutations)"}`);
  console.log(`Paid AI calls: ZERO (Deterministic AST / Regex only)\n`);

  const decisionsFile = path.join(UNKNOWN_RECONCILE_DIR, "reconcile-decisions.jsonl");
  const forceEval = args.includes("--re-evaluate");
  const phase2DecisionsFile = path.join(UNKNOWN_RECONCILE_DIR, "reconcile-decisions-phase2.jsonl");

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
    query_timeout: 120000,
  });
  await client.connect();

  let newRecoveredIds: string[] = [];
  let existingOwnIds: string[] = [];
  const mislabeledDecisions: { id: string; trueCitation?: string }[] = [];
  let remainingUnknownCount = 0;

  const previousOwnSet = new Set<string>();
  if (fs.existsSync(decisionsFile)) {
    const rlPrev = readline.createInterface({ input: fs.createReadStream(decisionsFile), crlfDelay: Infinity });
    for await (const line of rlPrev) {
      if (!line) continue;
      const d = JSON.parse(line);
      if (d.proposedTextStatus === "own") previousOwnSet.add(d.id);
    }
  }

  if (fs.existsSync(phase2DecisionsFile) && !forceEval) {
    console.log(`[Phase 2] Loading pre-computed decisions from ${phase2DecisionsFile}...`);
    const fileStream = fs.createReadStream(phase2DecisionsFile);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line) continue;
      const d = JSON.parse(line) as ReconcileDecision;
      if (d.proposedTextStatus === "own") {
        newRecoveredIds.push(d.id);
      } else if (d.proposedTextStatus === "mislabeled") {
        mislabeledDecisions.push({ id: d.id, trueCitation: d.proposedTextTrueCitation });
      } else {
        remainingUnknownCount++;
      }
    }
    console.log(`[Phase 2] Loaded ${newRecoveredIds.length} verified 'own' records (${previousOwnSet.size} from Phase 1, ${newRecoveredIds.length - previousOwnSet.size} newly verified in Phase 2).`);
    console.log(`[Phase 2] Loaded ${mislabeledDecisions.length} confirmed 'mislabeled' records.`);
    console.log(`[Phase 2] Loaded ${remainingUnknownCount} remaining 'unknown' records.`);
  } else {
    console.log(`[Phase 2] Reading existing decisions from ${decisionsFile}...`);
    const fileStream = fs.createReadStream(decisionsFile);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const unknownIds: string[] = [];
    const outStream = fs.createWriteStream(phase2DecisionsFile, { flags: "w", mode: 0o600 });

    for await (const line of rl) {
      if (!line) continue;
      const d = JSON.parse(line) as ReconcileDecision;
      if (d.proposedTextStatus === "unknown") {
        unknownIds.push(d.id);
      } else {
        outStream.write(line + "\n");
        if (d.proposedTextStatus === "own") existingOwnIds.push(d.id);
        else if (d.proposedTextStatus === "mislabeled") mislabeledDecisions.push({ id: d.id, trueCitation: d.proposedTextTrueCitation });
      }
    }

    console.log(`[Phase 2] Retained ${existingOwnIds.length} existing 'own' records.`);
    console.log(`[Phase 2] Retained ${mislabeledDecisions.length} confirmed 'mislabeled' records.`);
    console.log(`[Phase 2] Evaluating ${unknownIds.length} 'unknown' records with enhanced rules...`);

    let newRecoveredCount = 0;
    const tStart = Date.now();
    for (let i = 0; i < unknownIds.length; i += batchSize) {
      const batch = unknownIds.slice(i, i + batchSize);
      const res = await client.query(
        `SELECT id, citation_string, title, court_name_snapshot, text_status, text_true_citation, full_text
         FROM judgments
         WHERE id = ANY($1::uuid[])`,
        [batch]
      );

      for (const row of res.rows) {
        const decision = evaluateJudgmentReconciliation(row);
        outStream.write(JSON.stringify(decision) + "\n");

        if (decision.proposedTextStatus === "own") {
          newRecoveredCount++;
          newRecoveredIds.push(row.id);
        } else {
          remainingUnknownCount++;
        }
      }

      const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
      console.log(`[Phase 2 Eval] Processed ${Math.min(i + batchSize, unknownIds.length)}/${unknownIds.length} in ${elapsed}s...`);
    }

    outStream.end();

    console.log(`\n=== Phase 2 Evaluation Summary ===`);
    console.log(`Previously Recovered 'own': ${existingOwnIds.length}`);
    console.log(`Newly Recovered 'own': ${newRecoveredCount}`);
    console.log(`Total Active 'own' Cohort: ${existingOwnIds.length + newRecoveredCount} / 53,094`);
    console.log(`Confirmed 'mislabeled' (Citations Extracted): ${mislabeledDecisions.length}`);
    console.log(`Truly Thin / Ambiguous Quarantined 'unknown': ${remainingUnknownCount}`);
    console.log(`Phase 2 decisions written to: ${phase2DecisionsFile}`);
  }

  if (isApply) {
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const backupTableName = `judgments_backup_reconcile_phase2_${timestamp}`;
    const phase2OwnToUpdate = newRecoveredIds.filter((id) => !previousOwnSet.has(id));
    const allTargetIds = [...phase2OwnToUpdate, ...mislabeledDecisions.map((m) => m.id)];

    console.log(`\n[Phase 2 Apply] Creating backup table ${backupTableName} for ${allTargetIds.length} target records (${phase2OwnToUpdate.length} newly recovered 'own' + ${mislabeledDecisions.length} mislabeled)...`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${backupTableName} (
        id UUID PRIMARY KEY,
        title TEXT,
        text_status TEXT,
        text_true_citation TEXT,
        updated_at TIMESTAMP
      );
    `);

    for (let i = 0; i < allTargetIds.length; i += 2000) {
      const batch = allTargetIds.slice(i, i + 2000);
      await client.query(
        `INSERT INTO ${backupTableName} (id, title, text_status, text_true_citation, updated_at)
         SELECT id, title, text_status, text_true_citation, updated_at
         FROM judgments
         WHERE id = ANY($1::uuid[])
         ON CONFLICT (id) DO NOTHING;`,
        [batch]
      );
    }

    const backupRes = await client.query(`SELECT count(*) FROM ${backupTableName};`);
    console.log(`[Phase 2 Apply] ✔ Backup verified: ${backupRes.rows[0].count} records stored in ${backupTableName}.`);

    console.log(`[Phase 2 Apply] Executing atomic transaction for live database update...`);
    await client.query("BEGIN;");

    try {
      // 1. Promote new recovered records to 'own'
      let promotedCount = 0;
      let titlesCleaned = 0;
      for (let i = 0; i < phase2OwnToUpdate.length; i += batchSize) {
        const batch = phase2OwnToUpdate.slice(i, i + batchSize);
        const titleRes = await client.query(
          `UPDATE judgments
           SET title = RTRIM(REGEXP_REPLACE(title, '[.]?[[:space:]]*Honou?rable[[:space:]]+Justice.*$', '', 'i')),
               updated_at = NOW()
           WHERE id = ANY($1::uuid[])
             AND title ~* 'Honou?rable[[:space:]]+Justice';`,
          [batch]
        );
        titlesCleaned += titleRes.rowCount || 0;

        const statusRes = await client.query(
          `UPDATE judgments
           SET text_status = 'own',
               updated_at = NOW()
           WHERE id = ANY($1::uuid[])
             AND (text_status != 'own' OR text_status IS NULL);`,
          [batch]
        );
        promotedCount += statusRes.rowCount || 0;
      }

      // 2. Classify mislabeled records with their extracted true citations
      let mislabeledUpdated = 0;
      for (let i = 0; i < mislabeledDecisions.length; i += batchSize) {
        const batch = mislabeledDecisions.slice(i, i + batchSize);
        const ids = batch.map((m) => m.id);
        const trueCits = batch.map((m) => m.trueCitation || null);
        const misRes = await client.query(
          `UPDATE judgments AS j
           SET text_status = 'mislabeled',
               text_true_citation = v.true_cit,
               updated_at = NOW()
           FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS true_cit) AS v
           WHERE j.id = v.id;`,
          [ids, trueCits]
        );
        mislabeledUpdated += misRes.rowCount || 0;
      }

      await client.query("COMMIT;");
      console.log(`[Phase 2 Apply] ✔ TRANSACTION COMMITTED SUCCESSFULLY!`);
      console.log(`  - Newly promoted to active 'own': ${promotedCount}`);
      console.log(`  - Titles cleaned: ${titlesCleaned}`);
      console.log(`  - Marked as 'mislabeled' with true citation: ${mislabeledUpdated}`);
      console.log(`  - Backup preserved at: ${backupTableName}`);
    } catch (err) {
      await client.query("ROLLBACK;");
      console.error(`[Phase 2 Apply] ✖ Error during transaction. Rolled back completely.`, err);
      throw err;
    }
  }

  await client.end().catch(() => {});
}

main().catch((err) => {
  console.error("[Phase 2 Error]", err);
  process.exit(1);
});
