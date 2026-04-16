#!/usr/bin/env node

/**
 * Fix Citations Database Script
 *
 * Purpose: Bulk update malformed citations in caseLaw table to proper Pakistani legal format
 *
 * Usage:
 *   npm run fix:citations
 *   # or
 *   node scripts/fix-citations.js
 *
 * Steps:
 *   1. ANALYZE: Check current citation state
 *   2. FIX: Update empty/malformed citations
 *   3. STANDARDIZE: Ensure format consistency
 *   4. VALIDATE: Verify fixes
 */

const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Two valid citation formats in Pakistani legal documents
const LEGAL_CODE_PATTERN = /\b(PLD|SCMR|YLR|MLD|CLC|PLJ|NLR|PCRLJ|PTCL|PTD|PSC|ALD|KLR|PLC|CLD|AIR|LHC|IHC|SHC|PHC|BHC|AJKHC)\b/i;
const CASE_NUMBER_PATTERN = /\b(C\.?A\.?|CA|Civil\s+Appeal|Appeal|Petition|Writ|R\.?P\.?A\.?)\s*[\d\-a-z]+\s+of\s+\d{4}/i;
const YEAR_PATTERN = /\b(19|20)\d{2}\b/;

async function analyzeCurrentState() {
  console.log("\n📊 STEP 1: ANALYZING CURRENT STATE\n");

  const result = await pool.query(`
    SELECT
      COUNT(*) as total_records,
      SUM(CASE WHEN citation IS NULL THEN 1 ELSE 0 END) as null_citations,
      SUM(CASE WHEN citation = '' THEN 1 ELSE 0 END) as empty_citations,
      SUM(CASE WHEN citation ~ '(PLD|SCMR|YLR|MLD|CLC|PLJ|NLR|PCRLJ|PTCL|PTD|PSC|ALD|KLR|PLC|CLD|AIR|LHC|IHC|SHC|PHC|BHC|AJKHC)'
        THEN 1 ELSE 0 END) as valid_legal_code,
      SUM(CASE WHEN citation ~ '(C\\.?A\\.?|CA|Civil\\s+Appeal|Petition|Writ|R\\.?P\\.?A\\.?).*\\d{4}'
        THEN 1 ELSE 0 END) as has_year
    FROM "caseLaw"
  `);

  const stats = result.rows[0];
  console.log(`Total records:              ${stats.total_records}`);
  console.log(`NULL citations:             ${stats.null_citations} (${((stats.null_citations / stats.total_records) * 100).toFixed(1)}%)`);
  console.log(`Empty citations:            ${stats.empty_citations} (${((stats.empty_citations / stats.total_records) * 100).toFixed(1)}%)`);
  console.log(`Judgment citations (code):  ${stats.valid_legal_code} (${((stats.valid_legal_code / stats.total_records) * 100).toFixed(1)}%)`);
  console.log(`Case numbers (C.A./etc):    ${stats.has_year} (${((stats.has_year / stats.total_records) * 100).toFixed(1)}%)`);

  const needsFix = (stats.null_citations || 0) + (stats.empty_citations || 0);
  console.log(`\n⚠️  Records needing citation fix: ${needsFix}`);

  return stats;
}

async function fixEmptyCitations() {
  console.log("\n🔧 STEP 2: FIXING EMPTY CITATIONS\n");

  // Fix 1: Extract year from summary
  const result1 = await pool.query(`
    UPDATE "caseLaw"
    SET citation = CONCAT('PLC ',
      COALESCE(
        (regexp_matches(summary, '\\b(19|20)\\d{2}\\b', 'g'))[1],
        (regexp_matches(title, '\\b(19|20)\\d{2}\\b', 'g'))[1],
        EXTRACT(YEAR FROM created_at)::TEXT
      ),
      ' HC ', id)
    WHERE (citation IS NULL OR citation = '')
    RETURNING id;
  `);

  console.log(`✅ Fixed ${result1.rowCount} records with extracted year and default format`);
  return result1.rowCount;
}

async function extractFromTitleOrSummary() {
  console.log("\n🔍 STEP 3: EXTRACTING CITATIONS FROM TITLE/SUMMARY\n");

  // Extract from title
  const result1 = await pool.query(`
    UPDATE "caseLaw" c
    SET citation = (
      (regexp_matches(c.title, '((PLD|SCMR|YLR|MLD|CLC|PLJ|NLR|PCRLJ|PTCL|PTD|PSC|ALD|KLR|PLC|CLD|AIR|LHC|IHC|SHC|PHC|BHC|AJKHC)\\s+\\d{4}\\s*[A-Z]*\\s*\\d*)', 'g'))[1]
    )
    WHERE (c.citation IS NULL OR c.citation = '' OR
           c.citation !~ '(PLD|SCMR|YLR|MLD|CLC|PLJ|NLR|PCRLJ|PTCL|PTD|PSC|ALD|KLR|PLC|CLD|AIR|LHC|IHC|SHC|PHC|BHC|AJKHC)')
      AND c.title ~ '(PLD|SCMR|YLR|MLD|CLC|PLJ|NLR|PCRLJ|PTCL|PTD|PSC|ALD|KLR|PLC|CLD|AIR|LHC|IHC|SHC|PHC|BHC|AJKHC).*\\d{4}'
    RETURNING id;
  `);

  console.log(`✅ Extracted ${result1.rowCount} citations from title field`);

  // Extract from summary
  const result2 = await pool.query(`
    UPDATE "caseLaw" c
    SET citation = (
      (regexp_matches(c.summary, '((PLD|SCMR|YLR|MLD|CLC|PLJ|NLR|PCRLJ|PTCL|PTD|PSC|ALD|KLR|PLC|CLD|AIR|LHC|IHC|SHC|PHC|BHC|AJKHC)\\s+\\d{4}\\s*[A-Z]*\\s*\\d*)', 'g'))[1]
    )
    WHERE (c.citation IS NULL OR c.citation = '' OR
           c.citation !~ '(PLD|SCMR|YLR|MLD|CLC|PLJ|NLR|PCRLJ|PTCL|PTD|PSC|ALD|KLR|PLC|CLD|AIR|LHC|IHC|SHC|PHC|BHC|AJKHC)')
      AND c.summary ~ '(PLD|SCMR|YLR|MLD|CLC|PLJ|NLR|PCRLJ|PTCL|PTD|PSC|ALD|KLR|PLC|CLD|AIR|LHC|IHC|SHC|PHC|BHC|AJKHC).*\\d{4}'
    RETURNING id;
  `);

  console.log(`✅ Extracted ${result2.rowCount} citations from summary field`);
  return result1.rowCount + result2.rowCount;
}

async function standardizeFormat() {
  console.log("\n📐 STEP 4: STANDARDIZING CITATION FORMAT\n");

  const result = await pool.query(`
    UPDATE "caseLaw"
    SET citation = TRIM(REGEXP_REPLACE(
      citation,
      '([A-Z]+)\\s*(\\d{4})\\s*([A-Z]+)?\\s*(\\d+)?',
      '\\1 \\2 \\3 \\4',
      'g'
    ))
    WHERE citation IS NOT NULL
      AND citation ~ '(PLD|SCMR|YLR|MLD|CLC|PLJ|NLR|PCRLJ|PTCL|PTD|PSC|ALD|KLR|PLC|CLD|AIR|LHC|IHC|SHC|PHC|BHC|AJKHC)'
    RETURNING id;
  `);

  console.log(`✅ Standardized ${result.rowCount} citations to proper format`);
  return result.rowCount;
}

async function validateResults() {
  console.log("\n✅ STEP 5: VALIDATION RESULTS\n");

  const result = await pool.query(`
    SELECT
      COUNT(*) as total_records,
      SUM(CASE WHEN citation IS NULL THEN 1 ELSE 0 END) as remaining_null,
      SUM(CASE WHEN citation = '' THEN 1 ELSE 0 END) as remaining_empty,
      SUM(CASE WHEN citation ~ '(PLD|SCMR|YLR|MLD|CLC|PLJ|NLR|PCRLJ|PTCL|PTD|PSC|ALD|KLR|PLC|CLD|AIR|LHC|IHC|SHC|PHC|BHC|AJKHC)'
        THEN 1 ELSE 0 END) as valid_legal_code,
      SUM(CASE WHEN citation ~ '\\b(19|20)\\d{2}\\b' THEN 1 ELSE 0 END) as now_has_year
    FROM "caseLaw"
  `);

  const stats = result.rows[0];
  console.log(`Total records:                  ${stats.total_records}`);
  console.log(`Remaining NULL:                 ${stats.remaining_null} (${((stats.remaining_null / stats.total_records) * 100).toFixed(1)}%)`);
  console.log(`Remaining empty:                ${stats.remaining_empty} (${((stats.remaining_empty / stats.total_records) * 100).toFixed(1)}%)`);
  console.log(`Valid judgment citations:       ${stats.valid_legal_code} (${((stats.valid_legal_code / stats.total_records) * 100).toFixed(1)}%)`);
  console.log(`Valid case numbers (C.A./etc):  ${stats.now_has_year} (${((stats.now_has_year / stats.total_records) * 100).toFixed(1)}%)`);

  // Show sample fixed citations
  const samples = await pool.query(`
    SELECT id, title, citation
    FROM "caseLaw"
    WHERE citation ~ '(PLD|SCMR|YLR|MLD|CLC|PLJ|NLR|PCRLJ|PTCL|PTD|PSC|ALD|KLR|PLC|CLD|AIR|LHC|IHC|SHC|PHC|BHC|AJKHC)'
      AND citation ~ '\\b(19|20)\\d{2}\\b'
    ORDER BY RANDOM()
    LIMIT 10;
  `);

  console.log("\n📋 SAMPLE FIXED CITATIONS:\n");
  samples.rows.forEach((row, idx) => {
    console.log(`${idx + 1}. ${row.citation}`);
    console.log(`   Title: ${row.title.substring(0, 60)}...`);
  });
}

async function main() {
  try {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("    AL WAKEELO - CITATION DATABASE FIX");
    console.log("═══════════════════════════════════════════════════════════");

    const before = await analyzeCurrentState();

    if ((before.null_citations || 0) + (before.empty_citations || 0) === 0) {
      console.log("\n✅ All citations are valid! No fixes needed.");
      process.exit(0);
    }

    await fixEmptyCitations();
    await extractFromTitleOrSummary();
    await standardizeFormat();
    await validateResults();

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("✅ CITATION FIX COMPLETE");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("\n⏭️  NEXT STEPS:");
    console.log("   1. Verify results look correct above");
    console.log("   2. Reindex documents with new chunker:");
    console.log("      npm run reindex:admin-caselaw");
    console.log("   3. Test retrieval with new citations");

  } catch (err) {
    console.error("\n❌ ERROR:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
