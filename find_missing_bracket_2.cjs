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
  
  if (line.includes('app.get(') || line.includes('app.post(') || line.includes('app.put(') || line.includes('app.delete(')) {
    if (balance !== 1) {
      console.log(`Route starts at line ${i+1} with abnormal balance ${balance}: ${line.trim()}`);
    }
  }
}
console.log(`Final balance: ${balance}`);
