const fs = require('fs');
const filePath = 'client/src/experimental/pages/PreviewBlogDetail.tsx';
let code = fs.readFileSync(filePath, 'utf-8');
code = code.replace(/\\\`/g, '`');
code = code.replace(/\\\$/g, '$');
fs.writeFileSync(filePath, code);
