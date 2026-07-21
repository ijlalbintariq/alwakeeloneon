import '../server/load-env';

// Dynamic imports after env is loaded
const { classifyQueryIntent } = await import('../server/pipeline/intent-classifier');
const { runRetrieval } = await import('../server/pipeline/retrieval-engine');

async function run() {
  const query = "my husband beats me physically and abuses me. what can i do against him?";
  console.log(`Query: "${query}"`);
  
  const intent = classifyQueryIntent(query);
  console.log('Intent topics:', intent.topics.map(t => t.id));
  console.log('Expanded Query:', intent.expandedQuery);

  const retrieval = await runRetrieval(intent, "test-user", { caseLaw: 5, statutes: 5, adminDocs: 5 });
  console.log(`Fetched ${retrieval.caseLaw.length} case laws:`);
  for (const c of retrieval.caseLaw) {
    console.log(`- Citation: "${c.row.citation}", Court: "${c.row.court}", Title: "${c.row.title}"`);
  }
  process.exit(0);
}
run();
