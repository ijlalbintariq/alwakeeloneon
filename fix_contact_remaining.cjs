const fs = require('fs');
let code = fs.readFileSync('client/src/experimental/pages/PreviewContact.tsx', 'utf-8');

// Fix hover:text-primary → hover:text-[#105B38]
code = code.replace(/hover:text-primary\b/g, 'hover:text-[#105B38] dark:hover:text-[#10B981]');

// Fix focus:border-primary/50 → focus:border-[#105B38]/50
code = code.replace(/focus:border-primary\/50/g, 'focus:border-[#105B38]/50');

// Fix bg-background
code = code.replace(/\bbg-background\b/g, 'bg-[#F8FAFC] dark:bg-[#0B131E]');

// Fix bg-card/65
code = code.replace(/\bbg-card\/65\b/g, 'bg-white/65 dark:bg-[#131E2E]/65');

// Fix border-emerald that should be Forest Green
code = code.replace(/border-emerald-500\/25/g, 'border-[#105B38]/25');
code = code.replace(/bg-emerald-500\/5/g, 'bg-[#105B38]/5');
code = code.replace(/text-emerald-400/g, 'text-[#105B38] dark:text-[#10B981]');

fs.writeFileSync('client/src/experimental/pages/PreviewContact.tsx', code);
console.log("Fixed PreviewContact remaining theme vars");
