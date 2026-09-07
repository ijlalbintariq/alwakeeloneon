import fs from 'fs';

const filePath = 'client/src/experimental/AppPreviewRouter.tsx';
let code = fs.readFileSync(filePath, 'utf-8');

if (!code.includes('PreviewBlog')) {
  code = code.replace(
    'const PreviewRefundPolicy = lazy(() => import("./pages/PreviewRefundPolicy"));',
    'const PreviewRefundPolicy = lazy(() => import("./pages/PreviewRefundPolicy"));\nconst PreviewBlog = lazy(() => import("./pages/PreviewBlog"));'
  );

  code = code.replace(
    '<Route path="/preview/faq" component={PreviewFaq} />',
    '<Route path="/preview/faq" component={PreviewFaq} />\n        <Route path="/blog" component={PreviewBlog} />\n        <Route path="/preview/blog" component={PreviewBlog} />'
  );

  fs.writeFileSync(filePath, code);
}
