const fs = require('fs');
let code = fs.readFileSync('client/src/experimental/pages/PreviewDocumentAnalyzer.tsx', 'utf-8');

code = code.replace(
  '{documentText || "No pleading loaded. Paste or upload text on the left."}',
  '{documentText ? renderCleanAnnotatedDocument() : "No pleading loaded. Paste or upload text on the left."}'
);

fs.writeFileSync('client/src/experimental/pages/PreviewDocumentAnalyzer.tsx', code);
console.log("Fixed Side-by-Side view render logic");
