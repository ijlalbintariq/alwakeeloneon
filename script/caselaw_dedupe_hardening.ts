import { sql } from "drizzle-orm";
import { db, dbAvailable, dbUnavailableReason, pool } from "../server/db";

type DuplicateStatsRow = {
  total_rows: string | number;
  duplicate_groups: string | number;
  duplicate_rows: string | number;
};

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function toNumber(value: string | number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: T[] } | null)?.rows;
  return Array.isArray(rows) ? rows : [];
}

async function loadDuplicateStats(): Promise<{
  totalRows: number;
  duplicateGroups: number;
  duplicateRows: number;
}> {
  const result = await db.execute(sql.raw(`
    WITH keyed AS (
      SELECT
        COALESCE(
          CASE
            WHEN citation_report IS NOT NULL AND citation_year IS NOT NULL AND citation_page IS NOT NULL
              THEN upper(citation_report) || ':' || citation_year::text || ':' || citation_page::text
            ELSE NULL
          END,
          regexp_replace(lower(coalesce(citation, '')), '[^a-z0-9]+', '', 'g')
        ) AS dedup_key
      FROM case_law
    ),
    grouped AS (
      SELECT dedup_key, count(*) AS grp_count
      FROM keyed
      GROUP BY dedup_key
    )
    SELECT
      (SELECT count(*)::bigint FROM case_law) AS total_rows,
      count(*) FILTER (WHERE grp_count > 1)::bigint AS duplicate_groups,
      COALESCE(sum(grp_count - 1) FILTER (WHERE grp_count > 1), 0)::bigint AS duplicate_rows
    FROM grouped;
  `));
  const rows = getRows<DuplicateStatsRow>(result);
  const row = rows[0];
  return {
    totalRows: toNumber(row?.total_rows),
    duplicateGroups: toNumber(row?.duplicate_groups),
    duplicateRows: toNumber(row?.duplicate_rows),
  };
}

async function main(): Promise<void> {
  const apply = hasFlag("--apply");
  const startedAt = Date.now();

  if (!dbAvailable) {
    throw new Error(`Database unavailable: ${dbUnavailableReason || "unknown reason"}`);
  }

  console.log(`[CaseLaw][dedupe] mode=${apply ? "apply" : "dry-run"}`);

  const before = await loadDuplicateStats();
  console.log(
    `[CaseLaw][dedupe] before total=${before.totalRows.toLocaleString()} duplicate_groups=${before.duplicateGroups.toLocaleString()} duplicate_rows=${before.duplicateRows.toLocaleString()}`,
  );

  if (!apply) {
    console.log("[CaseLaw][dedupe] Dry-run complete. Re-run with --apply to execute dedupe + index hardening.");
    return;
  }

  const backupTable = `case_law_backup_${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
  await db.execute(sql.raw(`CREATE TABLE ${backupTable} AS TABLE case_law;`));
  console.log(`[CaseLaw][dedupe] backup_created=${backupTable}`);

  const dedupeResult = await db.execute(sql.raw(`
    WITH ranked AS (
      SELECT
        id,
        COALESCE(
          CASE
            WHEN citation_report IS NOT NULL AND citation_year IS NOT NULL AND citation_page IS NOT NULL
              THEN upper(citation_report) || ':' || citation_year::text || ':' || citation_page::text
            ELSE NULL
          END,
          regexp_replace(lower(coalesce(citation, '')), '[^a-z0-9]+', '', 'g')
        ) AS dedup_key,
        row_number() OVER (
          PARTITION BY COALESCE(
            CASE
              WHEN citation_report IS NOT NULL AND citation_year IS NOT NULL AND citation_page IS NOT NULL
                THEN upper(citation_report) || ':' || citation_year::text || ':' || citation_page::text
              ELSE NULL
            END,
            regexp_replace(lower(coalesce(citation, '')), '[^a-z0-9]+', '', 'g')
          )
          ORDER BY
            CASE WHEN citation_role = 'primary' THEN 1 ELSE 0 END DESC,
            CASE WHEN source_doc_id IS NOT NULL THEN 1 ELSE 0 END DESC,
            length(coalesce(title, '')) DESC,
            length(coalesce(summary, '')) DESC,
            id DESC
        ) AS rn
      FROM case_law
    ),
    deleted AS (
      DELETE FROM case_law c
      USING ranked r
      WHERE c.id = r.id AND r.rn > 1
      RETURNING 1
    )
    SELECT count(*)::bigint AS deleted_count FROM deleted;
  `));
  const deletedRows = getRows<{ deleted_count: string | number }>(dedupeResult);
  const deletedCount = toNumber(deletedRows[0]?.deleted_count);
  console.log(`[CaseLaw][dedupe] deleted_rows=${deletedCount.toLocaleString()}`);

  // Canonical citation uniqueness by parsed parts.
  await db.execute(sql.raw(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS case_law_uq_parts_idx
    ON case_law ((upper(citation_report)), citation_year, citation_page)
    WHERE citation_report IS NOT NULL AND citation_year IS NOT NULL AND citation_page IS NOT NULL;
  `));

  // Fallback uniqueness for rows lacking normalized citation parts.
  await db.execute(sql.raw(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS case_law_uq_citation_fallback_idx
    ON case_law ((regexp_replace(lower(citation), '[^a-z0-9]+', '', 'g')))
    WHERE citation_report IS NULL OR citation_year IS NULL OR citation_page IS NULL;
  `));

  // Common lookup path for source-linked retrieval.
  await db.execute(sql.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS case_law_source_doc_lookup_idx
    ON case_law (source_type, source_doc_id);
  `));

  const after = await loadDuplicateStats();
  const durationMs = Date.now() - startedAt;
  console.log(
    `[CaseLaw][dedupe] after total=${after.totalRows.toLocaleString()} duplicate_groups=${after.duplicateGroups.toLocaleString()} duplicate_rows=${after.duplicateRows.toLocaleString()}`,
  );
  console.log(`[CaseLaw][dedupe] completed_in_ms=${durationMs}`);
}

main()
  .catch((err) => {
    console.error("[CaseLaw][dedupe] failed:", err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool?.end?.();
    } catch {
      // no-op
    }
  });
