const fs = require('fs');
const path = 'client/src/experimental/pages/PreviewDocumentAnalyzer.tsx';
let content = fs.readFileSync(path, 'utf8');

const queryBlock = `  const { data: serverChecklists } = useQuery<any>({
    queryKey: ["/api/document-analyzer/checklists"],
    queryFn: async () => {
      const res = await fetch("/api/document-analyzer/checklists", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load statutory checklists");
      return res.json();
    },
    staleTime: Infinity,
  });`;

content = content.replace(queryBlock, '');
content = content.replace('  const activeChecklist = useMemo<StatutoryCheckItem[]>(() => {', `  const { data: serverChecklists } = useQuery<any>({
    queryKey: ["/api/document-analyzer/checklists"],
    queryFn: async () => {
      const res = await fetch("/api/document-analyzer/checklists", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load statutory checklists");
      return res.json();
    },
    staleTime: Infinity,
  });

  const activeChecklist = useMemo<StatutoryCheckItem[]>(() => {`);

fs.writeFileSync(path, content, 'utf8');
