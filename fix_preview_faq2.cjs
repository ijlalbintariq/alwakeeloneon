const fs = require('fs');
const prodFaqCode = fs.readFileSync('client/src/pages/faq.tsx', 'utf-8');

// We just replace the default export from FaqPage
let newCode = prodFaqCode.replace('export default function FaqPage() {', 'export default function PreviewFaq() {');

// And we wrap the return of FaqPage in PublicPreviewShell
newCode = newCode.replace(
  /return \(\n\s*<div className="space-y-10 fade-in">/g,
  `return (
    <PublicPreviewShell>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="space-y-10 fade-in">`
);

// Close the PublicPreviewShell at the end of the file
newCode = newCode.replace(
  /    <\/div>\n  \);\n\}/g,
  `    </div>\n  </div>\n</PublicPreviewShell>\n  );\n}`
);

newCode = 'import { PublicPreviewShell } from "@/experimental/components/public/PublicPreviewShell";\n' + newCode;

fs.writeFileSync('client/src/experimental/pages/PreviewFaq.tsx', newCode);
console.log("Fixed PreviewFaq properly");
