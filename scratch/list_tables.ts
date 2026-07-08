import "../server/load-env";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Querying database tables and columns...");
  
  // List all tables
  const tablesRes = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  console.log("Tables in database:", tablesRes.rows.map(r => r.table_name));

  // Check columns of statutes, case_law, and any table with 'embedding' or 'chunk' or 'vector' in its name
  for (const row of tablesRes.rows) {
    const tableName = row.table_name;
    const columnsRes = await db.execute(sql`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tableName}
      ORDER BY ordinal_position
    `);
    
    // Check if any column is of type 'vector' or named 'embedding'
    const hasVectorColumn = columnsRes.rows.some(c => 
      c.column_name === 'embedding' || c.data_type === 'USER-DEFINED' || c.udt_name === 'vector'
    );
    
    if (hasVectorColumn) {
      console.log(`\nTable [${tableName}] has vector/embedding columns:`);
      columnsRes.rows.forEach(c => {
        console.log(`  - ${c.column_name}: type=${c.data_type}, udt=${c.udt_name}`);
      });
    }
  }
}

main().catch(console.error);
