const fs = require('fs');

const filePath = 'client/src/experimental/AppPreviewRouter.tsx';
let code = fs.readFileSync(filePath, 'utf-8');

if (!code.includes('McpPublicLandingPage')) {
  // Add import
  code = code.replace(
    'const PreviewBlog = lazy(() => import("./pages/PreviewBlog"));',
    'const PreviewBlog = lazy(() => import("./pages/PreviewBlog"));\nconst McpPublicLandingPage = lazy(() => import("@/pages/mcp-public-landing"));'
  );

  // Add route
  code = code.replace(
    '<Route path="/preview/faq" component={PreviewFaq} />',
    '<Route path="/preview/faq" component={PreviewFaq} />\n        <Route path="/preview/mcp" component={McpPublicLandingPage} />'
  );

  fs.writeFileSync(filePath, code);
}
