import { db } from "./server/db";
import { runRetrieval } from "./server/pipeline/retrieval-engine";
import { buildContext } from "./server/pipeline/context-builder";
import { classifyQueryIntent } from "./server/pipeline/intent-classifier";

async function runTest() {
  const query = "punishment for 302 ppc";
  
  const intent = classifyQueryIntent(query);
  const retrieval = await runRetrieval(intent, "1", { statutes: 3, caseLaw: 5 });
  const context = buildContext(intent, retrieval);
  console.log(context.contextString);
  
  process.exit(0);
}

runTest().catch(console.error);
