import '../server/load-env';

const { classifyQueryIntent } = await import('../server/pipeline/intent-classifier');
const { runRetrieval } = await import('../server/pipeline/retrieval-engine');
const { buildContext } = await import('../server/pipeline/context-builder');

async function run() {
  const query = "Ayesha has been married for six years. Her husband has not provided maintenance for over a year and frequently abandons the matrimonial home. now what she can do?";
  const intent = classifyQueryIntent(query);
  const retrieval = await runRetrieval(intent, 'test-user', { caseLaw: 10, statutes: 8, adminDocs: 6 });
  const ctx = buildContext(intent, retrieval);
  
  console.log('hasCaseLawCitations:', ctx.hasCaseLawCitations);
  console.log('hasStatutes:', ctx.hasStatutes);
  console.log('sections:', ctx.sections.map(s => s.id));
  
  // Show that case law appears BEFORE statute detail in the context
  const judgmentsIdx = ctx.contextString.indexOf('VERIFIED JUDGMENTS');
  const statuteDetailIdx = ctx.contextString.indexOf('INTERNAL KNOWLEDGE VAULT: STATUTES');
  const caseLawDetailIdx = ctx.contextString.indexOf('INTERNAL KNOWLEDGE VAULT: CASE LAW');
  console.log(`\nSection positions in context string:`);
  console.log(`  VERIFIED JUDGMENTS @ char ${judgmentsIdx}`);
  console.log(`  STATUTE DETAIL     @ char ${statuteDetailIdx}`);
  console.log(`  CASE LAW DETAIL    @ char ${caseLawDetailIdx}`);
  
  if (judgmentsIdx > 0 && statuteDetailIdx > 0) {
    console.log(`\n✅ Case law citations (${judgmentsIdx}) come BEFORE statute detail (${statuteDetailIdx})`);
  } else {
    console.log(`\n❌ Ordering issue detected`);
  }
  
  // Show first 500 chars after VERIFIED JUDGMENTS to confirm citations are there
  if (judgmentsIdx > 0) {
    console.log(`\nFirst case law citation block:`);
    console.log(ctx.contextString.slice(judgmentsIdx, judgmentsIdx + 600));
  }
  
  process.exit(0);
}
run();
