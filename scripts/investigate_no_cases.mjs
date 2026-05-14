import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_OwdlF1C7NDEW@ep-purple-pond-aipaany5-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    // 1. What do the "Reported As" values look like?
    console.log('\n=== 1. "REPORTED AS" VALUE SAMPLES ===');
    const reportedAs = await client.query(`
      SELECT 
        id,
        filename,
        SUBSTRING(content FROM 'Reported\\s+As:\\s*([^\\n]{0,120})') AS reported_as_value
      FROM admin_knowledge 
      WHERE category = 'case-law' 
        AND case_law_process_status = 'no_cases'
        AND content ~* 'Reported\\s+As:'
      ORDER BY id
      LIMIT 30
    `);
    console.table(reportedAs.rows);

    // 2. Categorize the format of "Reported As" values
    console.log('\n=== 2. "REPORTED AS" FORMAT ANALYSIS ===');
    const formatAnalysis = await client.query(`
      WITH reported AS (
        SELECT 
          id,
          SUBSTRING(content FROM 'Reported\\s+As:\\s*([^\\n]{0,120})') AS val
        FROM admin_knowledge 
        WHERE category = 'case-law' 
          AND case_law_process_status = 'no_cases'
          AND content ~* 'Reported\\s+As:'
      )
      SELECT 
        CASE
          WHEN val ~* '^\\d{4}\\s*(PLD|SCMR|YLR|MLD|CLC|PLC|NLR|PSC|PCrLJ|PTD|PTCL)' THEN 'Standard: YYYY REPORT Page'
          WHEN val ~* '^(PLD|SCMR|YLR|MLD|CLC|PLC|NLR|PSC|PCrLJ|PTD|PTCL)\\s*\\d{4}' THEN 'Reversed: REPORT YYYY Page'
          WHEN val ~* '^\\d{4}\\s+P\\s' THEN 'Has year + P-something'
          WHEN val ~* 'P\\.?\\s*L\\.?\\s*D' THEN 'Contains P.L.D (spaced)'
          WHEN val ~* 'S\\.?\\s*C\\.?\\s*M\\.?\\s*R' THEN 'Contains S.C.M.R (spaced)'
          WHEN val ~* 'P\\s+Cr' THEN 'Contains P Cr (spaced)'
          WHEN val ~* 'N\\.?\\s*L\\.?\\s*R' THEN 'Contains N.L.R (spaced)'
          WHEN val ~* 'P\\.?\\s*L\\.?\\s*C' THEN 'Contains P.L.C (spaced)'
          WHEN val ~* 'C\\.?\\s*L\\.?\\s*C' THEN 'Contains C.L.C (spaced)'
          WHEN val ~* 'Y\\.?\\s*L\\.?\\s*R' THEN 'Contains Y.L.R (spaced)'
          WHEN val ~* 'M\\.?\\s*L\\.?\\s*D' THEN 'Contains M.L.D (spaced)'
          WHEN val IS NULL THEN 'NULL match'
          ELSE 'Unknown: ' || LEFT(COALESCE(val, ''), 60)
        END AS format_type,
        COUNT(*) AS docs
      FROM reported
      GROUP BY 1
      ORDER BY docs DESC
    `);
    console.table(formatAnalysis.rows);

    // 3. Show actual "Reported As" values that don't match standard patterns
    console.log('\n=== 3. NON-STANDARD "REPORTED AS" VALUES (first 40) ===');
    const nonStandard = await client.query(`
      SELECT 
        id,
        SUBSTRING(content FROM 'Reported\\s+As:\\s*([^\\n]{0,120})') AS reported_as_value
      FROM admin_knowledge 
      WHERE category = 'case-law' 
        AND case_law_process_status = 'no_cases'
        AND content ~* 'Reported\\s+As:'
        AND NOT (content ~ '\\d{4}\\s*(PLD|SCMR|YLR|MLD|CLC|PLC|NLR|PSC|PCrLJ|PTD|PTCL)\\s*\\d+')
      ORDER BY id
      LIMIT 40
    `);
    for (const row of nonStandard.rows) {
      console.log(`  #${row.id}: "${row.reported_as_value}"`);
    }

    // 4. Docs WITHOUT "Reported As" and no citations - what are they?
    console.log('\n=== 4. DOCS WITHOUT "REPORTED AS" AND NO CITATIONS (sample 10) ===');
    const noReported = await client.query(`
      SELECT 
        id,
        filename,
        LEFT(content, 400) AS content_preview,
        LENGTH(content) AS full_len
      FROM admin_knowledge 
      WHERE category = 'case-law' 
        AND case_law_process_status = 'no_cases'
        AND content IS NOT NULL
        AND NOT (content ~* 'Reported\\s+As:')
      ORDER BY LENGTH(content) DESC
      LIMIT 5
    `);
    for (const row of noReported.rows) {
      console.log(`\n--- Doc #${row.id} (${row.filename}) [${row.full_len} chars] ---`);
      console.log(row.content_preview);
      console.log('---');
    }

    // 5. The actual total across all statuses that report says no_cases (6475)
    console.log('\n=== 5. DIAGNOSTICS RECONCILIATION ===');
    const reconcile = await client.query(`
      WITH base AS (
        SELECT
          ak.id,
          COALESCE(ak.case_law_process_status, 'pending') AS status,
          count(cl.id)::int AS case_rows
        FROM admin_knowledge ak
        LEFT JOIN case_law cl
          ON cl.source_doc_id = ak.id
          AND cl.source_type = 'admin'
        WHERE ak.category = 'case-law'
        GROUP BY ak.id, ak.case_law_process_status
      )
      SELECT
        status,
        count(*) AS total_docs,
        count(*) FILTER (WHERE case_rows = 0) AS no_extract,
        count(*) FILTER (WHERE case_rows > 0) AS has_extract
      FROM base
      WHERE status = 'no_cases'
      GROUP BY status
    `);
    console.table(reconcile.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
