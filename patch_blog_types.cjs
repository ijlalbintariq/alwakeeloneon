const fs = require('fs');

// Patch PreviewBlog.tsx
let blogCode = fs.readFileSync('client/src/experimental/pages/PreviewBlog.tsx', 'utf-8');
blogCode = blogCode.replace(/article\.id/g, 'article.slug');
blogCode = blogCode.replace(/article\.image \|\| "\/social-preview\.png"/g, '"/social-preview.png"');
blogCode = blogCode.replace(/article\.author/g, '"Al Wakeelo Legal"');
fs.writeFileSync('client/src/experimental/pages/PreviewBlog.tsx', blogCode);

// Patch PreviewBlogDetail.tsx
let detailCode = fs.readFileSync('client/src/experimental/pages/PreviewBlogDetail.tsx', 'utf-8');
detailCode = detailCode.replace(/new Date\(article\.date\)/g, 'new Date(article.publishedAt)');
detailCode = detailCode.replace(/article\.author/g, '"Al Wakeelo Legal"');
fs.writeFileSync('client/src/experimental/pages/PreviewBlogDetail.tsx', detailCode);

