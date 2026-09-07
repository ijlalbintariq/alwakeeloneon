const fs = require('fs');
const path = 'client/src/experimental/pages/PreviewChat.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import { useToast } from "@/hooks/use-toast";')) {
    content = content.replace(
        'import { useAuth } from "@/hooks/use-auth";', 
        'import { useAuth } from "@/hooks/use-auth";\nimport { useToast } from "@/hooks/use-toast";'
    );
}

if (!content.includes('const { toast } = useToast();')) {
    content = content.replace(
        'export const PreviewChat: React.FC = () => {',
        'export const PreviewChat: React.FC = () => {\n  const { toast } = useToast();'
    );
}

fs.writeFileSync(path, content, 'utf8');
