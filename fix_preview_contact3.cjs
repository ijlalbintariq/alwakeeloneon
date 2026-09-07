const fs = require('fs');
let code = fs.readFileSync('client/src/pages/contact.tsx', 'utf-8');

// Replace export
code = code.replace('export default function ContactPage() {', 'export default function PreviewContact() {');

// We know ContactPage returns a div.
code = code.replace(
  'return (\n    <div className="space-y-12 fade-in">',
  'return (\n    <PublicPreviewShell>\n      <div className="max-w-6xl mx-auto px-6 py-12">\n        <div className="space-y-12 fade-in">'
);

// We need to replace the VERY LAST </div> ); }
const lastIndex = code.lastIndexOf('    </div>\n  );\n}');
if (lastIndex !== -1) {
  code = code.substring(0, lastIndex) + '    </div>\n      </div>\n    </PublicPreviewShell>\n  );\n}';
}

code = 'import { PublicPreviewShell } from "@/experimental/components/public/PublicPreviewShell";\n' + code;

fs.writeFileSync('client/src/experimental/pages/PreviewContact.tsx', code);
console.log("Fixed PreviewContact definitively");
