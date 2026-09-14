const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/server/routes/bench-routes.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove generateCounterBrief and inject RAG directly
content = content.replace(
  /const hostileCases = await runAdversarialRAG\(flatQueries\);\n\s*attackPlan = await generateCounterBrief\(hostileCases, userMessage\);/g,
  `const hostileCases = await runAdversarialRAG(flatQueries);
      // COMPRESSION: Skip Attack Plan LLM. Format hostile cases as compact evidence snippets directly.
      attackPlan = hostileCases.length > 0 
        ? hostileCases.map(c => \`Citation: \${c.citation}\\nRule: \${c.headnotes?.substring(0, 300) || "N/A"}\`).join("\\n\\n")
        : "No directly hostile precedent found. Rely on general statutory principles.";`
);

fs.writeFileSync(file, content);
console.log("Pipeline Compressed: generateCounterBrief removed.");
