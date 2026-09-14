const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/server/routes/bench-routes.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the headers and sendStatus from wherever they are currently (line 82ish)
const headersRegex = /res\.setHeader\("Content-Type", "text\/event-stream"\);\n\s*res\.setHeader\("Cache-Control", "no-cache"\);\n\s*res\.setHeader\("Connection", "keep-alive"\);\n\s*\/\/ Helper to send status updates\n\s*const sendStatus = \(statusMsg: string\) => \{\n\s*res\.write\(\`data: \$\{JSON\.stringify\(\{ status: statusMsg \}\)\}\\n\\n\`\);\n\s*\};\n/g;
content = content.replace(headersRegex, '');

// 2. Inject them at the very top of the try block
const tryStart = /try \{\n\s*const \{ sessionId, userMessage, config \} = req\.body;\n\s*const userId = req\.user\.id;/;
content = content.replace(tryStart, \`try {
    const { sessionId, userMessage, config } = req.body;
    const userId = req.user.id;
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    const sendStatus = (statusMsg: string) => {
      res.write(\\\`data: \\\${JSON.stringify({ status: statusMsg })}\\\\n\\\\n\\\`);
    };\`);

// 3. Fix c.headnotes to c.summary
content = content.replace(/c\.headnotes\?/g, 'c.summary?');

fs.writeFileSync(file, content);
console.log("Headers moved to top and headnotes fixed.");
