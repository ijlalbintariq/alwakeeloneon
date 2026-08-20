import "./load-env";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../server/db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log("[Migration] Applying 0007_create_cause_list_tables.sql...");
  const sqlPath = path.resolve(__dirname, "../migrations/0007_create_cause_list_tables.sql");
  const sqlContent = fs.readFileSync(sqlPath, "utf-8");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sqlContent);
    await client.query("COMMIT");
    console.log("[Migration] Successfully applied cause list tables and indexes!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Migration] Failed to apply migration:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
