import { db } from './server/db';
import { sql } from 'drizzle-orm';
async function run() {
  const q = await db.execute(sql`SELECT citation_string, full_text FROM judgments WHERE full_text ~* '\\b(19\\d\\d|20\\d\\d)\\s+(PLD|SCMR|LHC|SHC|PHC|BHC|IHC|FSC|CLC|PCrLJ|YLR|MLD|CLD|PTD|PLC)\\s+(\\d+)\\b' LIMIT 1`);
  if (q.rows.length) {
    console.log("Found case with citations:", q.rows[0].citation_string);
    const text = q.rows[0].full_text;
    const regex = /\b(19\d\d|20\d\d)\s+(PLD|SCMR|LHC|SHC|PHC|BHC|IHC|FSC|CLC|PCrLJ|YLR|MLD|CLD|PTD|PLC)\s+(\d+)\b/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      console.log("Match:", match[0]);
    }
  } else {
    console.log("No judgment found.");
  }
  process.exit(0);
}
run();
