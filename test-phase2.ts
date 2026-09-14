import "./load-env";
import { runRetrieval } from "./server/pipeline/retrieval-engine";
import { classifyQueryIntent } from "./server/pipeline/intent-classifier";
import { verifyQuotesAgainstSources } from "./server/pipeline/context-builder";

async function testPhase2() {
  const testQuery = "wife claims maintenance after husband marries another woman without permission under muslim family law";
  const intent = classifyQueryIntent(testQuery);
  intent.expandedQuery = testQuery; 
  const retrieval = await runRetrieval(intent, "test-user-123", { caseLaw: 5, statutes: 0, adminDocs: 0 });
  const validSource = String(retrieval.caseLaw[0].row.summary || "");
  const realQuote = validSource.split(/\s+/).slice(0, 15).join(" ");
  const fakeLLMResponse = `
    The Supreme Court laid down the principle:
    > "${realQuote}"
    
    But also noted:
    > "This is a completely hallucinated quote that the AI invented to sound smart and trick the system into passing."
    `;
    
  const sources = retrieval.caseLaw.map(c => ({ 
    contextExcerpt: String(c.row.summary || ""), 
    fullText: String(c.row.fullText || "") 
  }));
  const verification = verifyQuotesAgainstSources(fakeLLMResponse, sources);
  console.log("Verification Output:", JSON.stringify(verification, null, 2));
  process.exit(0);
}
testPhase2().catch(console.error);
