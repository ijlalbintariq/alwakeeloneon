const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/server/routes/bench-routes.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'res.write(`data: ${JSON.stringify({ sessionId: session.id })}\\n\\n`);',
  'res.write(`data: ${JSON.stringify({ sessionId: session.id, judgeProfile: session.judgeProfile })}\\n\\n`);'
);

fs.writeFileSync(file, content);
console.log("bench-routes SSE payload updated.");
