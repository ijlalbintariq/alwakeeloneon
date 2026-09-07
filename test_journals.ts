import { storage } from './server/storage';
async function run() {
  const journals = await storage.getLawJournals();
  console.log(journals.map(j => j.code));
  process.exit(0);
}
run();
