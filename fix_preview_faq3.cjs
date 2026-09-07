const fs = require('fs');
let code = fs.readFileSync('client/src/pages/faq.tsx', 'utf-8');

// replace export default function FaqPage() { with export default function PreviewFaq() {
code = code.replace('export default function FaqPage() {', 'export default function PreviewFaq() {');
// wrap the return of PreviewFaq in PublicPreviewShell
code = code.replace(/return \(\s*<div className="space-y-10 fade-in">/, 'return (\n    <PublicPreviewShell>\n      <div className="max-w-6xl mx-auto px-6 py-12">\n        <div className="space-y-10 fade-in">');

// find the last closing div of FaqPage and insert closing tags
const parts = code.split('export default function PreviewFaq() {');
let pageCode = parts[1];
pageCode = pageCode.replace(/    <\/div>\n  \);\n\}/, '    </div>\n      </div>\n    </PublicPreviewShell>\n  );\n}');

code = parts[0] + 'export default function PreviewFaq() {' + pageCode;

code = 'import { PublicPreviewShell } from "@/experimental/components/public/PublicPreviewShell";\n' + code;

fs.writeFileSync('client/src/experimental/pages/PreviewFaq.tsx', code);
console.log("Fixed PreviewFaq again");
