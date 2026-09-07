import fs from 'fs';

const files = [
  'client/src/experimental/pages/PreviewBlog.tsx',
  'client/src/experimental/pages/PreviewBlogDetail.tsx'
];

files.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let code = fs.readFileSync(filePath, 'utf-8');
    code = code.replace('../../../../shared/blog-data', '@shared/blog-data');
    fs.writeFileSync(filePath, code);
  }
});
