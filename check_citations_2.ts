import { db } from './server/db';
import { judgments } from './shared/schema';
import { ilike } from 'drizzle-orm';

async function run() {
  const allJ = await db.select({ citation: judgments.citationString, title: judgments.title, id: judgments.id }).from(judgments).where(ilike(judgments.citationString, '% SHC %'));
  
  const suspicious = allJ.filter(j => {
    const match = j.citation.match(/\d+ SHC (\d+)/);
    if (match) {
      const num = parseInt(match[1]);
      return num > 50000; // Very large page numbers/IDs
    }
    return false;
  });
  
  console.log(`Total SHC citations: ${allJ.length}`);
  console.log(`Suspicious (number > 50000): ${suspicious.length}`);
  console.log(suspicious.slice(0, 5));
  process.exit(0);
}
run();
