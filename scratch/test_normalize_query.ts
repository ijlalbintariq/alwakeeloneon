import "../server/load-env";
import { db } from "../server/db";
import { caseLaw, judgments } from "../shared/schema";
import { sql } from "drizzle-orm";

function normalizeCitationForMatch(value: string): string {
  return String(value || "")
    .toUpperCase()
    .replace(/\bP\.?\s*C\.?\s*R\.?\s*L\.?\s*J\b/g, "PCRLJ")
    .replace(/\bSUPREME\s+COURT\b/g, "SC")
    .replace(/\bFEDERAL\s+SHARIAT(?:\s+COURT)?\b/g, "FSC")
    .replace(/\bLAHORE\b/g, "LAH")
    .replace(/\bKARACHI\b/g, "KAR")
    .replace(/\bPESHAWAR\b/g, "PESH")
    .replace(/\bISLAMABAD\b/g, "IHC")
    .replace(/\bSINDH\b/g, "SHC")
    .replace(/\bBALOCHISTAN\b/g, "BHC")
    .replace(/[^A-Z0-9]/g, "");
}

async function run() {
  const testCitations = ["1995 SCMR 1865", "PLD 1966 SC 505", "2017 LHC 1400", "1995 PLC(CS) 941", "2025 LHC 3697"];
  for (const cit of testCitations) {
    const norm = normalizeCitationForMatch(cit);
    console.log(`\nTesting "${cit}" -> normalized: "${norm}"`);
    
    // Check case_law
    const caseLawHits = await db.execute(sql`
      SELECT id, citation FROM case_law 
      WHERE regexp_replace(upper(citation), '[^A-Z0-9]', '', 'g') = ${norm}
      LIMIT 1
    `);
    console.log("case_law hits:", caseLawHits.rows);

    // Check judgments
    const judgmentHits = await db.execute(sql`
      SELECT id, citation_string FROM judgments 
      WHERE regexp_replace(upper(citation_string), '[^A-Z0-9]', '', 'g') = ${norm}
      LIMIT 1
    `);
    console.log("judgments hits:", judgmentHits.rows);
  }
  process.exit(0);
}

run();
