import '../server/load-env';
const { classifyQueryIntent } = await import('../server/pipeline/intent-classifier');
const { runRetrieval } = await import('../server/pipeline/retrieval-engine');
const { buildContext } = await import('../server/pipeline/context-builder');

const query = "Ayesha has been married for six years. Her husband has not provided maintenance for over a year and frequently abandons the matrimonial home. What legal remedies are available to her?";
const intent = classifyQueryIntent(query);
const retrieval = await runRetrieval(intent, 'test-user', { caseLaw: 10, statutes: 8, adminDocs: 6 });
const ctx = buildContext(intent, retrieval);

// Measure each section size
for (const s of ctx.sections) {
  const content = s.heading + '\n' + s.lines.join('\n');
  console.log(`${s.id}: ${content.length} chars (~${Math.round(content.length/4)} tokens)`);
}
console.log(`\nTotal context: ${ctx.contextString.length} chars (~${Math.round(ctx.contextString.length/4)} tokens)`);
console.log(`Current budget: 6000 tokens = 24000 chars`);
console.log(`Chars that survive: ${Math.min(24000, ctx.contextString.length)}`);
console.log(`Chars that get CUT: ${Math.max(0, ctx.contextString.length - 24000)}`);

// What sections fit within 24k chars?
let running = 0;
const preambleSize = ctx.contextString.indexOf(ctx.sections[0]?.heading || '');
running += preambleSize;
console.log(`\nPreamble (instructions): ${preambleSize} chars`);
for (const s of ctx.sections) {
  const content = s.heading + '\n' + s.lines.join('\n') + '\n';
  running += content.length;
  const fits = running <= 24000;
  console.log(`  ${fits ? '✅' : '❌'} ${s.id}: cumulative ${running} chars ${fits ? '(fits)' : '(TRUNCATED)'}`);
}

process.exit(0);
