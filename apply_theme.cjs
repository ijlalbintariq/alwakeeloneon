const fs = require('fs');

const filePath = 'client/src/experimental/pages/PreviewLanding.tsx';
let code = fs.readFileSync(filePath, 'utf-8');

const replacements = {
  'bg-background': 'bg-[#F8FAFC]',
  'text-foreground': 'text-[#0F172A]',
  'text-muted-foreground': 'text-[#64748B]',
  'bg-primary': 'bg-[#105B38]',
  'text-primary-foreground': 'text-white',
  'text-primary': 'text-[#105B38]',
  'bg-card': 'bg-white',
  'border-border': 'border-[#E2E8F0]',
  'bg-muted': 'bg-[#F1F5F9]',
  'bg-secondary': 'bg-[#F1F5F9]',
  'text-secondary-foreground': 'text-[#334155]',
  'shadow-primary': 'shadow-[#105B38]',
  'shadow-amber-500': 'shadow-[#105B38]',
  'border-amber-400': 'border-[#105B38]',
  'from-primary': 'from-[#105B38]',
  'via-background': 'via-[#F8FAFC]',
  'to-background': 'to-[#F8FAFC]',
  'hover:text-foreground': 'hover:text-[#105B38]',
  'hover:bg-accent': 'hover:bg-[#F1F5F9]',
  'text-accent-foreground': 'text-[#0F172A]'
};

for (const [find, replace] of Object.entries(replacements)) {
  // Be careful with substring matches like 'bg-primary' also matching 'bg-primary/50' 
  // We can just globally replace since the modifiers like /50 will just append.
  // Actually, standard regex with word boundaries is safer, but hyphenated words in JS \b don't work well.
  const regex = new RegExp(find, 'g');
  code = code.replace(regex, replace);
}

// Add the PublicPreviewShell logic
// Wait, the user wants the exact layout of production. 
// Production layout has its own `<nav>` and `<footer>`.
// We just need to wrap the whole thing in `<div className="preview-theme-scope">` to ensure fonts apply.
if (!code.includes('preview-theme-scope')) {
  code = code.replace('<div className="min-h-screen', '<div className="preview-theme-scope min-h-screen');
}

fs.writeFileSync(filePath, code);
console.log("Theme applied");
