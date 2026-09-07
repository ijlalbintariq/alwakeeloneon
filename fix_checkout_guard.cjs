const fs = require('fs');

const FILE = 'client/src/experimental/pages/PreviewCheckout.tsx';
let code = fs.readFileSync(FILE, 'utf-8');

// 1. Add import for useAuth
if (!code.includes('useAuth')) {
  code = code.replace(
    'import { useToast } from "@/hooks/use-toast";',
    `import { useToast } from "@/hooks/use-toast";\nimport { useAuth } from "@/hooks/use-auth";\nimport { Redirect } from "wouter";`
  );
}

// 2. Add auth check inside the component
const target = `  const { toast } = useToast();
  const [location, navigate] = useLocation();`;
  
const replace = `  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  
  if (!isAuthLoading && !user) {
    return <Redirect to="/preview/auth" />;
  }`;

if (code.includes(target)) {
  code = code.replace(target, replace);
  fs.writeFileSync(FILE, code);
  console.log("Fixed checkout route guarding");
} else {
  console.log("Could not find injection target in PreviewCheckout");
}
