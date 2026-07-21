import '../server/load-env';

const { classifyQueryIntent } = await import('../server/pipeline/intent-classifier');
const { runRetrieval } = await import('../server/pipeline/retrieval-engine');
const { buildContext } = await import('../server/pipeline/context-builder');

async function run() {
  const query = "Ayesha has been married for six years. Her husband has not provided maintenance for over a year and frequently abandons the matrimonial home. now what she can do?";
  const intent = classifyQueryIntent(query);
  const retrieval = await runRetrieval(intent, 'test-user', { caseLaw: 10, statutes: 8, adminDocs: 6 });
  const ctx = buildContext(intent, retrieval);
  
  console.log('=== hasCaseLawCitations:', ctx.hasCaseLawCitations);
  console.log('=== hasStatutes:', ctx.hasStatutes);
  console.log('=== sections:', ctx.sections.map(s => s.id));
  console.log('=== contextString length:', ctx.contextString.length);
  console.log('\n=== FIRST 3000 CHARS OF CONTEXT ===\n');
  console.log(ctx.contextString.slice(0, 3000));
  process.exit(0);
}
run();
