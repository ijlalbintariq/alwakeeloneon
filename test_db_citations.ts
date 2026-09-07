import { storage } from './server/storage.ts';

async function main() {
  const judgment = await storage.getJudgmentDetail('4391d3e1-bee9-448f-a862-6da08b9abce1');
  console.log("Citations Made:", judgment?.citations?.made?.length);
  console.log("Citations Received:", judgment?.citations?.received?.length);
  
  if (judgment?.citations?.received && judgment.citations.received.length > 0) {
    console.log("Sample received:", judgment.citations.received[0]);
  }
  process.exit(0);
}

main().catch(console.error);
