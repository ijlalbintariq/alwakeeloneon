const fs = require('fs');
let code = fs.readFileSync('client/src/experimental/components/PreviewShell.tsx', 'utf-8');

code = code.replace(
  '"flex-1 min-h-0",',
  '"flex-1 min-h-0 flex flex-col",'
);

fs.writeFileSync('client/src/experimental/components/PreviewShell.tsx', code);
console.log("Added flex col to main in PreviewShell");
