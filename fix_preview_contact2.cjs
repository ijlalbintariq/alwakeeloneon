const fs = require('fs');
let code = fs.readFileSync('client/src/pages/contact.tsx', 'utf-8');

code = code.replace('export default function ContactPage() {', 'export default function PreviewContact() {');

code = code.replace(/return \(\s*<div className="space-y-12 fade-in">/, 'return (\n    <PublicPreviewShell>\n      <div className="max-w-6xl mx-auto px-6 py-12">\n        <div className="space-y-12 fade-in">');

const parts = code.split('export default function PreviewContact() {');
let pageCode = parts[1];
pageCode = pageCode.replace(/    <\/div>\n  \);\n\}/, '    </div>\n      </div>\n    </PublicPreviewShell>\n  );\n}');

code = parts[0] + 'export default function PreviewContact() {' + pageCode;

code = 'import { PublicPreviewShell } from "@/experimental/components/public/PublicPreviewShell";\n' + code;

fs.writeFileSync('client/src/experimental/pages/PreviewContact.tsx', code);
console.log("Fixed PreviewContact again");
