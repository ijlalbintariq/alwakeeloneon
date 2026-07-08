import "../server/load-env";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  // 1. Find ALL columns with 'vector' type or 'embedding' in name across ALL tables
  const vectorCols = await db.execute(sql`
    SELECT table_name, column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (udt_name = 'vector' OR column_name ILIKE '%embed%' OR data_type = 'USER-DEFINED')
    ORDER BY table_name, column_name
  `);
  console.log("=== ALL vector/embedding columns in database ===");
  vectorCols.rows.forEach(r => console.log(`  ${r.table_name}.${r.column_name} → type=${r.data_type}, udt=${r.udt_name}`));

  // 2. Check judgments table columns
  console.log("\n=== JUDGMENTS table columns ===");
  const judgCols = await db.execute(sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'judgments'
    ORDER BY ordinal_position
  `);
  judgCols.rows.forEach(r => console.log(`  ${r.column_name}: type=${r.data_type}, udt=${r.udt_name}`));

  // 3. Check statutes table columns
  console.log("\n=== STATUTES table columns ===");
  const statCols = await db.execute(sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'statutes'
    ORDER BY ordinal_position
  `);
  statCols.rows.forEach(r => console.log(`  ${r.column_name}: type=${r.data_type}, udt=${r.udt_name}`));

  // 4. Check rag_chunks table
  console.log("\n=== RAG_CHUNKS table columns ===");
  const ragCols = await db.execute(sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rag_chunks'
    ORDER BY ordinal_position
  `);
  ragCols.rows.forEach(r => console.log(`  ${r.column_name}: type=${r.data_type}, udt=${r.udt_name}`));

  // 5. Count rag_chunks with embeddings
  try {
    const ragCount = await db.execute(sql`SELECT count(*)::integer as total FROM rag_chunks`);
    console.log("\nTotal rag_chunks:", ragCount.rows[0].total);
    const ragEmbedCount = await db.execute(sql`SELECT count(*)::integer as with_embed FROM rag_chunks WHERE embedding IS NOT NULL`);
    console.log("rag_chunks with embedding:", ragEmbedCount.rows[0].with_embed);
  } catch (e: any) { console.log("rag_chunks error:", e.message); }

  // 6. Check style_memory_chunks
  try {
    const smCount = await db.execute(sql`SELECT count(*)::integer as total FROM style_memory_chunks`);
    console.log("\nTotal style_memory_chunks:", smCount.rows[0].total);
  } catch (e: any) { console.log("style_memory_chunks error:", e.message); }

  // 7. Check for any other tables with 'embed' or 'vector' in the name
  const embedTables = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name ILIKE '%embed%' OR table_name ILIKE '%vector%')
  `);
  console.log("\n=== Tables with 'embed' or 'vector' in name ===");
  embedTables.rows.forEach(r => console.log(`  ${r.table_name}`));

  // 8. Check all indexes that mention 'vector' or 'cosine' or 'ivfflat'
  const vecIndexes = await db.execute(sql`
    SELECT indexname, tablename, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND (indexdef ILIKE '%vector%' OR indexdef ILIKE '%cosine%' OR indexdef ILIKE '%ivfflat%')
  `);
  console.log("\n=== Vector indexes ===");
  vecIndexes.rows.forEach(r => console.log(`  ${r.tablename}.${r.indexname}: ${r.indexdef}`));

  // 9. Check rag_documents to see what's indexed
  try {
    const ragDocs = await db.execute(sql`
      SELECT id, title, status, chunk_count 
      FROM rag_documents 
      ORDER BY id DESC 
      LIMIT 20
    `);
    console.log("\n=== Recent RAG documents ===");
    ragDocs.rows.forEach(r => console.log(`  id=${r.id} title="${r.title}" status=${r.status} chunks=${r.chunk_count}`));
  } catch (e: any) { console.log("rag_documents error:", e.message); }
}

main().catch(console.error);
