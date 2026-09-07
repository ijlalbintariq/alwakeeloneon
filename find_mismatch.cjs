const fs = require('fs');
const content = fs.readFileSync('server/routes.ts', 'utf8');
const lines = content.split('\n');

let balance = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (const char of line) {
    if (char === '{') balance++;
    if (char === '}') balance--;
  }
  // Let's print the balance every 1000 lines to isolate the block
  if (i % 1000 === 0) {
    console.log(`Line ${i}: balance ${balance}`);
  }
}
console.log(`Final balance: ${balance}`);
