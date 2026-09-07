const fs = require('fs');
let code = fs.readFileSync('client/src/experimental/pages/PreviewDocumentAnalyzer.tsx', 'utf-8');

code = code.replace(
  'localStorage.setItem("alwakeelo_preview_drafting_prompt", documentText);',
  'localStorage.setItem("alwakeelo_drafting_insert", JSON.stringify({ clause: documentText }));'
);

fs.writeFileSync('client/src/experimental/pages/PreviewDocumentAnalyzer.tsx', code);
console.log("Fixed export to drafting");
