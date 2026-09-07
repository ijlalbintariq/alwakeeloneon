const fs = require('fs');

let content = fs.readFileSync('test_grep.txt', 'utf-8');
content = content.replace(/^"CommandLine":"cat << 'EOF' > client\/src\/experimental\/pages\/PreviewLanding.tsx\\n/, '');
content = content.replace(/\\nEOF"$/, '');
// Unescape the newlines and quotes
content = content.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

fs.writeFileSync('client/src/experimental/pages/PreviewLanding.tsx', content);
console.log("RESTORED!");
