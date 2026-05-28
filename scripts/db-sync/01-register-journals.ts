/**
 * Phase 1 — Register missing journal codes into Neon law_journals table.
 * Run BEFORE the main sync script.
 */
import "../../server/load-env";
import { db } from "../../server/db";
import { lawJournals } from "../../shared/schema";
import { sql } from "drizzle-orm";

const MISSING_JOURNALS = [
  { code: "PLC(CS)",  name: "Pakistan Labour Cases (Civil Service)" },
  { code: "YLRN",    name: "Yearly Law Reporter Notes" },
  { code: "PCRLJN",  name: "Pakistan Criminal Law Journal Notes" },
  { code: "CLCN",    name: "Civil Law Cases Notes" },
  { code: "PLC(CS)N",name: "Pakistan Labour Cases (Civil Service) Notes" },
  { code: "GBLR",    name: "Gilgit-Baltistan Law Reports" },
  { code: "PLCN",    name: "Pakistan Labour Cases Notes" },
];

async function main() {
  console.log("=== Phase 1: Registering Missing Journals ===\n");

  // Load existing journals
  const existing = await db.select().from(lawJournals);
  const existingCodes = new Set(existing.map((j) => j.code));
  console.log(`Existing journals: ${existing.map((j) => j.code).join(", ")}\n`);

  let inserted = 0;
  let skipped = 0;

  for (const j of MISSING_JOURNALS) {
    if (existingCodes.has(j.code)) {
      console.log(`  ⏭️  SKIP   "${j.code}" — already exists`);
      skipped++;
    } else {
      await db.insert(lawJournals).values({ code: j.code, name: j.name, isActive: true });
      console.log(`  ✅ INSERT "${j.code}" — ${j.name}`);
      inserted++;
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);

  // Print final journal list with IDs
  const final = await db.select().from(lawJournals);
  console.log("\n=== All Journals in Neon ===");
  final.forEach((j) => console.log(`  id=${j.id}  code="${j.code}"  name="${j.name}"`));
}

main().catch(console.error).finally(() => process.exit(0));
