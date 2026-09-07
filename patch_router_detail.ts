import fs from 'fs';

const filePath = 'client/src/experimental/AppPreviewRouter.tsx';
let code = fs.readFileSync(filePath, 'utf-8');

if (!code.includes('PreviewBlogDetail')) {
  code = code.replace(
    'const PreviewBlog = lazy(() => import("./pages/PreviewBlog"));',
    'const PreviewBlog = lazy(() => import("./pages/PreviewBlog"));\nconst PreviewBlogDetail = lazy(() => import("./pages/PreviewBlogDetail"));'
  );

  code = code.replace(
    '<Route path="/preview/blog" component={PreviewBlog} />',
    '<Route path="/preview/blog" component={PreviewBlog} />\n        <Route path="/preview/blog/:slug" component={PreviewBlogDetail} />'
  );

  fs.writeFileSync(filePath, code);
}
