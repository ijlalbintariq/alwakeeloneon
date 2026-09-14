const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/server/pipeline/bench-pipeline.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'const { getClient } = await import("./llm.js");',
  'const { getClient } = await import("../openrouter-ai");'
);

fs.writeFileSync(file, content);
console.log("Fixed llm import.");
