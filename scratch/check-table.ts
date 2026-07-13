import "../server/load-env";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Running manual SQL to create api_keys table...");
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "api_keys" (
        "id" serial PRIMARY KEY,
        "user_id" varchar REFERENCES "users"("id") ON DELETE CASCADE NOT NULL,
        "key_hash" text NOT NULL UNIQUE,
        "name" text DEFAULT 'Default Key' NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "last_used_at" timestamp
      );
    `);
    console.log("Table 'api_keys' created successfully (or already exists).");

    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'api_keys'
      );
    `);
    console.log("Check table exists result:", JSON.stringify(result.rows));
  } catch (err) {
    console.error("Migration execution failed:", err);
  }
}

main().then(() => process.exit(0));
