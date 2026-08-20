import "./load-env";
import { pool } from "../server/db";

async function verify() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('cause_list_scrape_runs', 'court_cause_lists', 'court_cause_list_items', 'cause_list_trackers', 'diary_entries')
      ORDER BY table_name;
    `);
    console.log("[Verification] Existing target tables:", res.rows.map(r => r.table_name));

    const diaryCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'diary_entries' AND column_name = 'cause_list_item_id';
    `);
    console.log("[Verification] diary_entries cause_list_item_id column:", diaryCols.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

verify();
