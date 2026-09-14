const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/server/routes/bench-routes.ts';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const startIndex = lines.findIndex(l => l.includes('// First round: create session and attack plan'));

if (startIndex !== -1) {
  // We need to move the judgeProfileData block up
  const blockStart = lines.findIndex(l => l.includes('let judgeProfileData = null;'));
  if (blockStart !== -1) {
    const blockEnd = blockStart + 3; // The block is 4 lines: let ..., if, judgeProfileData = ..., }
    const extractedBlock = lines.splice(blockStart, 4);
    
    // Insert it right after the comment
    lines.splice(startIndex + 1, 0, ...extractedBlock);
    
    fs.writeFileSync(file, lines.join('\n'));
    console.log("Order fixed in bench-routes.ts");
  }
}
