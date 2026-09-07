import { db } from './server/db';
import { sql } from 'drizzle-orm';
async function run() {
  const q = await db.execute(sql`SELECT full_text FROM judgments WHERE citation_string = 'Const. P. 11/2026 (SHC)'`);
  if (q.rows.length) {
    const text = q.rows[0].full_text;
    const regex = /\b(19\d\d|20\d\d)\s+(PLD|SCMR|LHC|SHC|PHC|BHC|IHC|FSC|CLC|PCrLJ|YLR|MLD|CLD|PTD|PLC)\s+(\d+)\b/gi;
    let match;
    let found = 0;
    while ((match = regex.exec(text)) !== null) {
      console.log("Match:", match[0]);
      found++;
    }
    console.log("Found citations:", found);
    
    // Check if there are other citations like '2016 M L D 1021'
    const manualRegex = /2016\s+M\s*L\s*D\s+1021/gi;
    if (manualRegex.test(text)) console.log("Found 2016 MLD 1021 with spaces!");
  } else {
    console.log("No judgment found.");
  }
  process.exit(0);
}
run();
