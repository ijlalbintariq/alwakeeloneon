const fs = require('fs');
const path = 'client/src/experimental/AppPreviewRouter.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    'import { PreviewLanding } from "./pages/PreviewLanding";',
    'import PreviewLanding from "./pages/PreviewLanding";'
);
fs.writeFileSync(path, content, 'utf8');
