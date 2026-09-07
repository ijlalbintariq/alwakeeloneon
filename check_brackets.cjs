const fs = require('fs');
const content = fs.readFileSync('server/routes.ts', 'utf8');
const lines = content.split('\n');

let tryCount = 0;
let catchCount = 0;
let finallyCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.match(/\btry\s*\{/)) tryCount++;
  if (line.match(/\bcatch\s*\(/) || line.match(/\bcatch\s*\{/)) catchCount++;
  if (line.match(/\bfinally\s*\{/)) finallyCount++;
}

console.log(`try: ${tryCount}, catch: ${catchCount}, finally: ${finallyCount}`);

// Find unmatched braces
let braceCount = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (const char of line) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
  }
}
console.log(`brace diff: ${braceCount}`);

