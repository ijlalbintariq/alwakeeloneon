/**
 * Check which critical statutes exist in the vector store
 */
import pg from "pg";
const { Pool } = pg;

const CRITICAL_STATUTES = [
  "Constitution",
  "Criminal Procedure",
  "CrPC",
  "Penal Code",
  "PPC",
  "Specific Relief",
  "Dissolution of Muslim",
  "Civil Procedure",
  "CPC",
  "Family Courts",
  "Qanun-e-Shahadat",
  "Anti-Terrorism",
  "Contract Act",
  "Narcotics",
  "West Pakistan",
  "Limitation Act",
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // 1. How many total statute documents exist?
  const totalRes = await pool.query(`
    SELECT COUNT(DISTINCT d.title) as doc_count, COUNT(*) as chunk_count
    FROM rag_chunks c
    JOIN rag_documents d ON d.id = c.rag_document_id
    WHERE c.user_id = 'global-admin-statute'
  `);
  console.log(`Total statute documents: ${totalRes.rows[0].doc_count} docs, ${totalRes.rows[0].chunk_count} chunks\n`);

  // 2. Check each critical statute
  console.log("CRITICAL STATUTE COVERAGE CHECK:");
  console.log("═".repeat(80));
  
  for (const keyword of CRITICAL_STATUTES) {
    const res = await pool.query(`
      SELECT DISTINCT d.title, COUNT(*) as chunks
      FROM rag_chunks c
      JOIN rag_documents d ON d.id = c.rag_document_id
      WHERE c.user_id = 'global-admin-statute'
        AND d.title ILIKE $1
      GROUP BY d.title
      ORDER BY chunks DESC
      LIMIT 5
    `, [`%${keyword}%`]);
    
    if (res.rows.length > 0) {
      console.log(`✅ "${keyword}" — ${res.rows.length} document(s):`);
      for (const r of res.rows) {
        console.log(`    • ${r.title} (${r.chunks} chunks)`);
      }
    } else {
      console.log(`❌ "${keyword}" — NOT FOUND in vector store`);
    }
  }

  // 3. Check what's in the source_documents table but NOT indexed
  console.log("\n\nMISSING STATUTES (in source_documents but not in rag_chunks):");
  console.log("═".repeat(80));
  
  const missingRes = await pool.query(`
    SELECT sd.id, sd.title, sd.status
    FROM source_documents sd
    WHERE sd.category = 'statute'
      AND sd.id NOT IN (
        SELECT DISTINCT c.source_document_id 
        FROM rag_chunks c 
        WHERE c.user_id = 'global-admin-statute' AND c.source_document_id IS NOT NULL
      )
      AND (
        sd.title ILIKE '%constitution%' OR
        sd.title ILIKE '%criminal procedure%' OR
        sd.title ILIKE '%crpc%' OR
        sd.title ILIKE '%penal code%' OR
        sd.title ILIKE '%specific relief%' OR
        sd.title ILIKE '%dissolution%' OR
        sd.title ILIKE '%civil procedure%' OR
        sd.title ILIKE '%family court%' OR
        sd.title ILIKE '%qanun%' OR
        sd.title ILIKE '%limitation%'
      )
    ORDER BY sd.title
    LIMIT 30
  `);
  
  if (missingRes.rows.length > 0) {
    for (const r of missingRes.rows) {
      console.log(`  📄 [${r.status}] id=${r.id} "${r.title}"`);
    }
  } else {
    console.log("  No matching source_documents found.");
  }

  // 4. Check total source_documents statutes vs indexed
  const statsRes = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM source_documents WHERE category = 'statute') as total_statutes,
      (SELECT COUNT(DISTINCT source_document_id) FROM rag_chunks WHERE user_id = 'global-admin-statute' AND source_document_id IS NOT NULL) as indexed_statutes
  `);
  console.log(`\n\nINDEXING COVERAGE:`);
  console.log(`  Source documents (statute): ${statsRes.rows[0].total_statutes}`);
  console.log(`  Indexed in vector store: ${statsRes.rows[0].indexed_statutes}`);
  console.log(`  Gap: ${statsRes.rows[0].total_statutes - statsRes.rows[0].indexed_statutes} statutes not yet indexed`);

  await pool.end();
  process.exit(0);
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });
