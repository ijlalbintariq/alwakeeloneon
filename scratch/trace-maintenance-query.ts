import '../server/load-env';

const { classifyQueryIntent } = await import('../server/pipeline/intent-classifier');
const { runRetrieval } = await import('../server/pipeline/retrieval-engine');

async function run() {
  const query = "Ayesha has been married for six years. Her husband has not provided maintenance for over a year and frequently abandons the matrimonial home. now what she can do?";
  console.log(`Query: "${query}"`);
  
  const intent = classifyQueryIntent(query);
  console.log('Intent type:', intent.type);
  console.log('Topics:', intent.topics.map(t => `${t.id} (${t.label})`));
  console.log('Expanded query:', intent.expandedQuery);
  console.log('Normalized:', intent.normalized);
  console.log('needsCaseLaw:', intent.needsCaseLaw);
  console.log('needsStatutes:', intent.needsStatutes);
  console.log('needsAdminDocs:', intent.needsAdminDocs);

  console.log('\n--- Running full retrieval ---');
  const t0 = Date.now();
  const result = await runRetrieval(intent, 'test-user', { caseLaw: 10, statutes: 8, adminDocs: 3 });
  console.log(`Retrieval completed in ${Date.now() - t0}ms`);
  
  console.log(`\nCase Law: ${result.caseLaw.length} results`);
  for (const cl of result.caseLaw) {
    console.log(`  - [${cl.row.citation}] "${cl.row.title}" (score=${cl.relevanceScore}, court=${cl.row.court}, sourceType=${cl.row.sourceType})`);
  }
  
  console.log(`\nStatutes: ${result.statutes.length} results`);
  for (const s of result.statutes) {
    console.log(`  - "${s.shortTitle}" §${s.section} (score=${s.relevanceScore})`);
  }
  
  console.log(`\nAdmin Docs: ${result.adminDocs.length} results`);
  for (const d of result.adminDocs) {
    console.log(`  - "${d.title}" (score=${d.relevanceScore})`);
  }
  
  console.log('\nDiagnostics:', JSON.stringify(result.diagnostics, null, 2));
  process.exit(0);
}
run();
