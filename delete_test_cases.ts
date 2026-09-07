import { db } from './server/db';
import { caseFiles, caseCompliance } from './shared/schema';

async function run() {
  try {
    console.log("Deleting case compliance records (to avoid foreign key errors)...");
    await db.delete(caseCompliance);
    console.log("Deleting case files...");
    const result = await db.delete(caseFiles);
    console.log("Successfully wiped test cases.");
    process.exit(0);
  } catch (error) {
    console.error("Error wiping test cases:", error);
    process.exit(1);
  }
}

run();
