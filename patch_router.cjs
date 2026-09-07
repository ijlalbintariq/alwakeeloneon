const fs = require('fs');
const path = 'client/src/experimental/AppPreviewRouter.tsx';
let content = fs.readFileSync(path, 'utf8');

const importAuth = `import { useAuth } from "@/hooks/use-auth";\nimport { Switch, Route, Redirect } from "wouter";`;
content = content.replace('import { Switch, Route } from "wouter";', importAuth);

const protectedRouteCode = `
function ProtectedRoute({ path, component: Component }: { path: string, component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background/50 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#105B38]/10 flex items-center justify-center animate-pulse">
            <div className="w-6 h-6 border-2 border-[#105B38] border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground font-medium animate-pulse">Authenticating...</p>
        </div>
      </div>
    );
  }
  
  if (!user) return <Redirect to="/preview/auth" />;
  
  return <Route path={path} component={Component} />;
}

export const AppPreviewRouter: React.FC = () => {`;

content = content.replace('export const AppPreviewRouter: React.FC = () => {', protectedRouteCode);

const privateRoutes = [
    '/preview/dashboard', '/preview/knowledge', '/preview/documents', 
    '/preview/cases', '/preview/diary', '/preview/chat', 
    '/preview/drafting', '/preview/contracts', '/preview/settings', 
    '/preview/history', '/preview/bookmarks', '/preview/organization', 
    '/preview/admin'
];

privateRoutes.forEach(route => {
    const searchString = '<Route path="' + route + '" component={';
    content = content.split(searchString).join('<ProtectedRoute path="' + route + '" component={');
});

fs.writeFileSync(path, content, 'utf8');
