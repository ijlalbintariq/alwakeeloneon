const fs = require('fs');
let code = fs.readFileSync('client/src/experimental/pages/PreviewBlogDetail.tsx', 'utf-8');

// Fix white bg for dark mode
code = code.replace(/\bbg-white\b/g, 'bg-white dark:bg-[#131E2E]');

// Fix text colors
code = code.replace(/text-\[#0F172A\]/g, 'text-[#0F172A] dark:text-[#F8FAFC]');
code = code.replace(/text-\[#64748B\]/g, 'text-[#64748B] dark:text-[#94A3B8]');
code = code.replace(/text-\[#334155\]/g, 'text-[#334155] dark:text-[#CBD5E1]');
code = code.replace(/text-\[#475569\]/g, 'text-[#475569] dark:text-[#94A3B8]');

// Fix borders
code = code.replace(/border-\[#E2E8F0\]/g, 'border-[#E2E8F0] dark:border-[#1E2D44]');

// Fix bg colors
code = code.replace(/bg-\[#F8FAFC\]/g, 'bg-[#F8FAFC] dark:bg-[#0B131E]');
code = code.replace(/bg-\[#F1F5F9\]/g, 'bg-[#F1F5F9] dark:bg-[#1B293E]');
code = code.replace(/bg-\[#CBD5E1\]/g, 'bg-[#CBD5E1] dark:bg-[#475569]');

// Fix prose colors for dark mode
code = code.replace(
  'prose-headings:text-[#0F172A]',
  'prose-headings:text-[#0F172A] dark:prose-headings:text-[#F8FAFC]'
);
code = code.replace(
  'prose-strong:text-[#0F172A]',
  'prose-strong:text-[#0F172A] dark:prose-strong:text-[#F8FAFC]'
);
code = code.replace(
  'prose-p:text-[#334155]',
  'prose-p:text-[#334155] dark:prose-p:text-[#CBD5E1]'
);
code = code.replace(
  'prose-li:text-[#334155]',
  'prose-li:text-[#334155] dark:prose-li:text-[#CBD5E1]'
);

fs.writeFileSync('client/src/experimental/pages/PreviewBlogDetail.tsx', code);
console.log("Fixed PreviewBlogDetail dark mode");
