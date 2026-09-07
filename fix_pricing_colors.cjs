const fs = require('fs');
let code = fs.readFileSync('client/src/experimental/pages/PreviewLanding.tsx', 'utf-8');

// Fix the pricing section bg-card (line 1050)
code = code.replace(
  'section id="pricing" className="py-20 md:py-28 px-6 bg-card"',
  'section id="pricing" className="py-20 md:py-28 px-6 bg-[#F1F5F9] dark:bg-[#0B131E]"'
);

// Fix the billing cycle toggle container
code = code.replace(
  'inline-flex items-center rounded-xl border border-border bg-background p-1.5 gap-1',
  'inline-flex items-center rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] p-1.5 gap-1'
);

// Fix the inactive cycle button text
code = code.replace(
  ': "text-foreground hover:text-foreground"',
  ': "text-[#334155] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-white"'
);

// Fix pricing subtitle text
code = code.replace(
  '"text-muted-foreground mt-4 max-w-xl mx-auto"',
  '"text-[#64748B] dark:text-[#94A3B8] mt-4 max-w-xl mx-auto"'
);

// Fix the highlighted card gradient (Pro card) - the dark bg makes it black in light mode
code = code.replace(
  '"bg-gradient-to-b from-[#105B38]/10 to-[#1e293b] border-2 border-[#105B38]/30 shadow-xl shadow-[#105B38]/10"',
  '"bg-gradient-to-b from-[#105B38]/10 to-[#EBF5F0] dark:from-[#105B38]/10 dark:to-[#1e293b] border-2 border-[#105B38]/30 shadow-xl shadow-[#105B38]/10"'
);

// Fix non-highlighted card colors
code = code.replace(
  '"bg-card border border-border hover:border-border"',
  '"bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#A3D4BC] dark:hover:border-[#105B38]/40"'
);

// Fix badge text for non-highlighted
code = code.replace(
  'plan.highlighted ? "text-[#105B38]" : "text-muted-foreground"',
  'plan.highlighted ? "text-[#105B38] dark:text-[#10B981]" : "text-[#64748B] dark:text-[#94A3B8]"'
);

// Fix plan title
code = code.replace(
  '"text-2xl font-bold text-foreground mb-1"',
  '"text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-1"'
);

// Fix cycle pricing muted text (appears twice)
code = code.replace(
  /text-\[10px\] text-muted-foreground mb-1/g,
  'text-[10px] text-[#64748B] dark:text-[#94A3B8] mb-1'
);

// Fix subtitle muted text
code = code.replace(
  '"text-xs text-muted-foreground mb-5"',
  '"text-xs text-[#64748B] dark:text-[#94A3B8] mb-5"'
);

// Fix feature list text
code = code.replace(
  '"flex items-start gap-2 text-xs text-foreground leading-relaxed"',
  '"flex items-start gap-2 text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed"'
);

// Fix CTA button borders for non-highlighted (enterprise + free buttons)
code = code.replace(
  /w-full py-3 border border-border text-foreground rounded-xl text-xs font-black uppercase tracking-widest hover:border-\[#105B38\] hover:text-\[#105B38\] transition-all flex items-center justify-center/g,
  'w-full py-3 border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] rounded-xl text-xs font-black uppercase tracking-widest hover:border-[#105B38] hover:text-[#105B38] dark:hover:border-[#10B981] dark:hover:text-[#10B981] transition-all flex items-center justify-center'
);

// Fix the non-highlighted plan button
code = code.replace(
  '"border border-border text-foreground hover:border-[#105B38] hover:text-[#105B38]"',
  '"border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] hover:border-[#105B38] hover:text-[#105B38] dark:hover:border-[#10B981] dark:hover:text-[#10B981]"'
);

// Fix chamber expansion box
code = code.replace(
  'rounded-2xl border border-border bg-card p-5',
  'rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] p-5'
);

// Fix chamber expansion text
code = code.replace(
  '"grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-foreground"',
  '"grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[#334155] dark:text-[#CBD5E1]"'
);

// Fix the AI action counting note at the bottom of chamber expansion
code = code.replace(
  '"mt-3 text-[11px] text-muted-foreground"',
  '"mt-3 text-[11px] text-[#64748B] dark:text-[#94A3B8]"'
);

fs.writeFileSync('client/src/experimental/pages/PreviewLanding.tsx', code);
console.log("Fixed all pricing section colors for light/dark theme");
