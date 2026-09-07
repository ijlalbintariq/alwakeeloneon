import { db } from './server/db';
import { judgments } from './shared/schema';

async function run() {
  const allJ = await db.select({ citation: judgments.citationString, title: judgments.title, page: judgments.page }).from(judgments);
  
  const suspicious = allJ.filter(j => j.page > 50000);
  
  const courts = {};
  for (const s of suspicious) {
    const courtMatch = s.citation.match(/\d+ ([A-Z]+) \d+/);
    if (courtMatch) {
      courts[courtMatch[1]] = (courts[courtMatch[1]] || 0) + 1;
    }
  }
  
  console.log(`Total suspicious (page > 50000): ${suspicious.length}`);
  console.log(courts);
  process.exit(0);
}
run();
