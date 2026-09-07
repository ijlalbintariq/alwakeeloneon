const fs = require('fs');

// Files to fix theme colors in
const filesToFix = [
  'client/src/experimental/pages/PreviewAbout.tsx',
  'client/src/experimental/pages/PreviewContact.tsx',
  'client/src/experimental/pages/PreviewFaq.tsx',
];

// Replacement map: Tailwind theme vars → hardcoded Forest Green tokens
const replacements = [
  // Primary color replacements
  [/\bbg-primary\/10\b/g, 'bg-[#105B38]/10'],
  [/\bbg-primary\/20\b/g, 'bg-[#105B38]/20'],
  [/\bbg-primary\/30\b/g, 'bg-[#105B38]/30'],
  [/\bborder-primary\/20\b/g, 'border-[#105B38]/20'],
  [/\bborder-primary\/30\b/g, 'border-[#105B38]/30'],
  [/\bborder-primary\b/g, 'border-[#105B38]'],
  [/\btext-primary-foreground\b/g, 'text-white'],
  [/\btext-primary\b/g, 'text-[#105B38]'],
  [/\bbg-primary\/90\b/g, 'bg-[#105B38]/90'],
  [/\bbg-primary\/95\b/g, 'bg-[#105B38]/95'],
  [/\bbg-primary\b/g, 'bg-[#105B38]'],
  [/\bhover:bg-primary\/90\b/g, 'hover:bg-[#0D4A2E]'],
  [/\bhover:bg-primary\/95\b/g, 'hover:bg-[#0D4A2E]'],
  // Surface / card / text replacements  
  [/\btext-foreground\b/g, 'text-[#0F172A] dark:text-[#F8FAFC]'],
  [/\btext-muted-foreground\b/g, 'text-[#64748B] dark:text-[#94A3B8]'],
  [/\bbg-card\/50\b/g, 'bg-white/50 dark:bg-[#131E2E]/50'],
  [/\bbg-card\/40\b/g, 'bg-white/40 dark:bg-[#131E2E]/40'],
  [/\bbg-card\/75\b/g, 'bg-white/75 dark:bg-[#131E2E]/75'],
  [/\bbg-card\b/g, 'bg-white dark:bg-[#131E2E]'],
  [/\bborder-border\/40\b/g, 'border-[#E2E8F0]/40 dark:border-[#1E2D44]/40'],
  [/\bborder-border\b/g, 'border-[#E2E8F0] dark:border-[#1E2D44]'],
];

filesToFix.forEach(file => {
  let code = fs.readFileSync(file, 'utf-8');
  replacements.forEach(([pattern, replacement]) => {
    code = code.replace(pattern, replacement);
  });
  fs.writeFileSync(file, code);
  console.log(`Fixed theme colors in: ${file}`);
});

console.log("\n--- Now fixing PreviewBlog.tsx ---");

// Fix PreviewBlog: remove image, fix dark mode
let blogCode = fs.readFileSync('client/src/experimental/pages/PreviewBlog.tsx', 'utf-8');

// Replace the image block with a styled category/icon block
blogCode = blogCode.replace(
  `                  <div className="aspect-[16/9] w-full overflow-hidden bg-[#F8FAFC]">
                    <img 
                      src={"/social-preview.png"} 
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>`,
  `                  <div className="px-6 pt-6">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#105B38]/10 dark:bg-[#10B981]/15 border border-[#105B38]/20 dark:border-[#10B981]/30 rounded-full text-[11px] text-[#105B38] dark:text-[#10B981] font-bold uppercase tracking-wider">
                      <BookOpen className="w-3 h-3" />
                      {article.category}
                    </span>
                  </div>`
);

// Fix white containers in dark mode for blog cards
blogCode = blogCode.replace(
  /bg-white rounded-3xl border border-\[#E2E8F0\] overflow-hidden hover:border-\[#A3D4BC\]/g,
  'bg-white dark:bg-[#131E2E] rounded-3xl border border-[#E2E8F0] dark:border-[#1E2D44] overflow-hidden hover:border-[#A3D4BC] dark:hover:border-[#10B981]/40'
);

// Fix white search container
blogCode = blogCode.replace(
  'bg-white border border-[#E2E8F0] p-6 rounded-[2rem] shadow-sm',
  'bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] p-6 rounded-[2rem] shadow-sm'
);

// Fix search input bg
blogCode = blogCode.replace(
  'border-[#E2E8F0] bg-[#F8FAFC] focus:outline-none',
  'border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E] focus:outline-none'
);

// Fix filter button bg
blogCode = blogCode.replace(
  /bg-\[#F1F5F9\] text-\[#64748B\] hover:text-\[#0F172A\]/g,
  "bg-[#F1F5F9] dark:bg-[#1B293E] text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
);

// Fix text colors for dark mode
blogCode = blogCode.replace(
  /text-\[#0F172A\]" style=\{\{ fontFamily/g,
  'text-[#0F172A] dark:text-[#F8FAFC]" style={{ fontFamily'
);

// Fix heading text in cards
blogCode = blogCode.replace(
  'text-xl font-bold text-[#0F172A] group-hover:text-[#105B38]',
  'text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#105B38] dark:group-hover:text-[#10B981]'
);

// Fix summary text
blogCode = blogCode.replace(
  'text-[#475569] text-sm',
  'text-[#475569] dark:text-[#94A3B8] text-sm'
);

// Fix border in card footer
blogCode = blogCode.replace(
  'border-t border-[#E2E8F0]',
  'border-t border-[#E2E8F0] dark:border-[#1E2D44]'
);

// Fix author name
blogCode = blogCode.replace(
  'text-xs font-semibold text-[#0F172A]',
  'text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]'
);

// Fix no results heading
blogCode = blogCode.replace(
  'text-xl font-bold text-[#0F172A]">No articles',
  'text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">No articles'
);

// Remove duplicate category line since we moved it to the top
blogCode = blogCode.replace(
  `                    <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                      <span className="text-[#105B38]">{article.category}</span>
                      <span className="w-1 h-1 rounded-full bg-[#CBD5E1]"></span>
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {article.readTime} min read</span>
                    </div>`,
  `                    <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {article.readTime} min read</span>
                    </div>`
);

fs.writeFileSync('client/src/experimental/pages/PreviewBlog.tsx', blogCode);
console.log("Fixed PreviewBlog.tsx: removed images, added dark mode support");

console.log("\n--- Now fixing Research/Drafting Panel in PreviewLanding.tsx ---");
let landingCode = fs.readFileSync('client/src/experimental/pages/PreviewLanding.tsx', 'utf-8');

// Fix Research Panel - check what it looks like
const researchIdx = landingCode.indexOf('Research Panel');
const draftingIdx = landingCode.indexOf('Drafting Panel');
if (researchIdx > -1) {
  console.log("Found Research Panel at char index: " + researchIdx);
  console.log("Context: " + landingCode.substring(researchIdx - 200, researchIdx + 50));
}
if (draftingIdx > -1) {
  console.log("Found Drafting Panel at char index: " + draftingIdx);
}

