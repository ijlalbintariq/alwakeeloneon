import "../server/load-env";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  // 1. Check statute_documents table
  console.log("=== statute_documents table ===");
  try {
    const cols = await db.execute(sql`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'statute_documents' ORDER BY ordinal_position
    `);
    cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    
    const count = await db.execute(sql`SELECT count(*)::integer as total FROM statute_documents`);
    console.log(`  Total rows: ${count.rows[0].total}`);
    
    const sample = await db.execute(sql`SELECT * FROM statute_documents ORDER BY id LIMIT 5`);
    console.log("  Sample rows:");
    sample.rows.forEach(r => console.log(`    id=${r.id} title="${r.title}" status=${r.status}`));
  } catch (e: any) { console.log("  Error:", e.message?.slice(0, 200)); }

  // 2. Check statute_document_files table
  console.log("\n=== statute_document_files table ===");
  try {
    const cols = await db.execute(sql`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'statute_document_files' ORDER BY ordinal_position
    `);
    cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    
    const count = await db.execute(sql`SELECT count(*)::integer as total FROM statute_document_files`);
    console.log(`  Total rows: ${count.rows[0].total}`);
  } catch (e: any) { console.log("  Error:", e.message?.slice(0, 200)); }

  // 3. Check rag_documents — how many are statute-related?
  console.log("\n=== rag_documents breakdown ===");
  try {
    const total = await db.execute(sql`SELECT count(*)::integer as total FROM rag_documents`);
    console.log(`  Total rag_documents: ${total.rows[0].total}`);
    
    const byTitle = await db.execute(sql`
      SELECT title, status, chunk_count 
      FROM rag_documents 
      ORDER BY chunk_count DESC 
      LIMIT 30
    `);
    console.log("  Top 30 by chunk count:");
    byTitle.rows.forEach(r => console.log(`    "${r.title}" status=${r.status} chunks=${r.chunk_count}`));
  } catch (e: any) { console.log("  Error:", e.message?.slice(0, 200)); }

  // 4. Check if rag_chunks metadata contains statute info
  console.log("\n=== rag_chunks metadata sample ===");
  try {
    const sample = await db.execute(sql`
      SELECT id, chunk_index, metadata, left(chunk_text, 120) as text_preview
      FROM rag_chunks 
      WHERE metadata::text ILIKE '%statute%' OR metadata::text ILIKE '%act%'
      LIMIT 10
    `);
    console.log(`  Statute-related chunks found: ${sample.rows.length}`);
    sample.rows.forEach(r => console.log(`    id=${r.id} meta=${JSON.stringify(r.metadata).slice(0, 150)} text="${r.text_preview}"`));
  } catch (e: any) { console.log("  Error:", e.message?.slice(0, 200)); }

  // 5. Count rag_chunks by source type in metadata
  console.log("\n=== rag_chunks by source type ===");
  try {
    const byType = await db.execute(sql`
      SELECT 
        metadata->>'sourceType' as source_type,
        count(*)::integer as cnt
      FROM rag_chunks
      GROUP BY metadata->>'sourceType'
      ORDER BY cnt DESC
      LIMIT 10
    `);
    byType.rows.forEach(r => console.log(`  ${r.source_type || '(null)'}: ${r.cnt} chunks`));
  } catch (e: any) { console.log("  Error:", e.message?.slice(0, 200)); }
}

main().catch(console.error);
