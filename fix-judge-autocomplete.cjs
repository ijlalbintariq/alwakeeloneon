const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/client/src/pages/bench-simulator.tsx';
let content = fs.readFileSync(file, 'utf8');

const hookStr = `  const { data: judgeSuggestions = [] } = useQuery({
    queryKey: ["/api/judges/directory", config.selectedJudgeName],
    queryFn: async () => {
      if (!config.selectedJudgeName || config.selectedJudgeName.length < 2) return [];
      const res = await fetch(\`/api/judges/directory?q=\${encodeURIComponent(config.selectedJudgeName)}\`);
      if (!res.ok) return [];
      return res.json();
    }
  });`;

if (!content.includes('queryKey: ["/api/judges/directory"')) {
  content = content.replace(
    '  const scrollRef = useRef<HTMLDivElement>(null);',
    '  const scrollRef = useRef<HTMLDivElement>(null);\n\n' + hookStr
  );
}

const inputReplacement = `<Input 
                  list="judge-suggestions"
                  placeholder="e.g. Justice Mansoor Ali Shah" 
                  value={config.selectedJudgeName}
                  onChange={(e) => setConfig({ ...config, selectedJudgeName: e.target.value })}
                />
                <datalist id="judge-suggestions">
                  {judgeSuggestions.map((judge: string) => (
                    <option key={judge} value={judge} />
                  ))}
                </datalist>`;

content = content.replace(
  /<Input[\s\S]*?onChange=\{\(e\) => setConfig\(\{ \.\.\.config, selectedJudgeName: e\.target\.value \}\)\}\n\s*\/>/,
  inputReplacement
);

fs.writeFileSync(file, content);
console.log("Judge Autocomplete UI added.");
