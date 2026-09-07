const fs = require('fs');

const filePath = 'client/src/experimental/pages/PreviewBlog.tsx';
let code = fs.readFileSync(filePath, 'utf-8');

// The file has things like: className={\`px-4 py-2 ... \${...}\`}
// We need to replace {\` with {` and \`} with `} and \${ with ${
code = code.replace(/\{\\\`/g, '{`');
code = code.replace(/\\\`\}/g, '`}');
code = code.replace(/\\\$/g, '$');
code = code.replace(/href=\{\\\`/g, 'href={`');

fs.writeFileSync(filePath, code);
