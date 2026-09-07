const fs = require('fs');
const content = fs.readFileSync('server/routes.ts', 'utf8');
const lines = content.split('\n');

let balance = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const oldBalance = balance;
  for (const char of line) {
    if (char === '{') balance++;
    if (char === '}') balance--;
  }
  if (line.includes('app.get(') || line.includes('app.post(') || line.includes('app.put(') || line.includes('app.delete(')) {
     console.log(`Route Start at ${i+1}: ${line.trim()} (balance: ${balance})`);
  }
  if (oldBalance > 0 && balance === 0) {
     console.log(`Balanced at ${i+1}`);
  }
}
