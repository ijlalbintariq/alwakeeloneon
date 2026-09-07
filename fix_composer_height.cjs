const fs = require('fs');
let code = fs.readFileSync('client/src/experimental/components/chat/ChatComposer.tsx', 'utf-8');

// Remove disclaimer
code = code.replace(
  /\s*\{\/\* Footer Disclaimer \*\/\}\s*<p className="text-xs text-center text-\[\#64748B\]">\s*Authentic citations.*?<\/p>/s,
  ''
);

// Reduce space-y-3 to space-y-2
code = code.replace(
  '<div className="max-w-4xl mx-auto space-y-3">',
  '<div className="max-w-4xl mx-auto space-y-2">'
);

fs.writeFileSync('client/src/experimental/components/chat/ChatComposer.tsx', code);
console.log("Reduced ChatComposer height");
