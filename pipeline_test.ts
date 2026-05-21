import "./server/load-env";

async function runTest(label: string, query: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`TEST: ${label}`);
  console.log(`QUERY: ${query}`);
  console.log("=".repeat(60));

  try {
    const { classifyQueryIntent } = await import("./server/pipeline/intent-classifier");
    const intent = await classifyQueryIntent(query);
    console.log(`INTENT: type=${intent.type} needsStatutes=${intent.needsStatutes} needsCaseLaw=${intent.needsCaseLaw} statuteRef=${JSON.stringify(intent.statuteRef || null)}`);

    const { runRetrieval } = await import("./server/pipeline/retrieval-engine");
    const retrieval = await runRetrieval(intent, "test-user-id", { statutes: 5, caseLaw: 10, docs: 5 }, undefined);
    
    console.log(`STATUTES: ${retrieval.statutes.length}`);
    console.log(`CASE_LAW: ${retrieval.caseLaw.length}`);
    console.log(`TOOL_SEARCH: found=${retrieval.toolSearchResult?.foundCount || 0}`);
    console.log(`TOOL_QUERIES: ${JSON.stringify(retrieval.toolSearchResult?.queriesUsed || [])}`);
    
    if (retrieval.caseLaw.length > 0) {
      console.log(`CASE LAW SAMPLE:`);
      retrieval.caseLaw.slice(0, 5).forEach(c => {
        console.log(`  [${c.sourceType}] ${c.citation} | ${c.court} | score=${(c as any).relevanceScore || 'n/a'}`);
      });
    }

    if (retrieval.statutes.length > 0) {
      console.log(`STATUTES SAMPLE:`);
      retrieval.statutes.slice(0, 3).forEach(s => {
        console.log(`  ${s.shortTitle} § ${s.section}`);
      });
    }

    const { buildContext } = await import("./server/pipeline/context-builder");
    const ctx = buildContext(intent, retrieval).contextString;
    const citPat = /\b(PLD|SCMR|PCrLJ|YLR|MLD|NLR|PLJ|CLC)\s+\d{4}/g;
    const ctxCitations = [...new Set(ctx.match(citPat) || [])];
    console.log(`CONTEXT_CITATIONS (${ctxCitations.length}): ${ctxCitations.slice(0, 10).join(', ')}`);
    
  } catch (e: any) {
    console.log(`ERROR: ${e.message}`);
    console.log(e.stack?.split('\n').slice(0, 3).join('\n'));
  }
}

(async () => {
  await runTest("PPC_302_Qatl", "Explain qatl-i-amd under Section 302 PPC and the case law on proof required for conviction");
  await runTest("Family_Khula", "Grounds and procedure for khula in Pakistani family courts with relevant case law");
  await runTest("CrPC_Bail_497", "Bail under Section 497 CrPC for murder - judicial principles");
  await runTest("Constitution_Art25", "Right to equality Article 25 Constitution of Pakistan with Supreme Court judgments");
  process.exit(0);
})();
