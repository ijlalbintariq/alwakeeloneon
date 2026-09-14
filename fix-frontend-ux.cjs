const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/client/src/pages/bench-simulator.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add loadingStatus state
content = content.replace(
  /const \[isStreaming, setIsStreaming\] = useState\(false\);/,
  `const [isStreaming, setIsStreaming] = useState(false);\n  const [loadingStatus, setLoadingStatus] = useState("");`
);

// 2. Parse the status message in the SSE reader
content = content.replace(
  /if \(data\.sessionId && !sessionId\) \{/,
  `if (data.status) {
                setLoadingStatus(data.status);
              } else if (data.sessionId && !sessionId) {
                setLoadingStatus(""); // Clear status when real data arrives`
);

// 3. Update the UI to show loadingStatus instead of "The Judge is reviewing your argument..."
// We need to replace the static pulse span.
const oldPulseMatch = /<span className="animate-pulse">The Judge is reviewing your argument\.\.\.<\/span>/;
content = content.replace(
  oldPulseMatch,
  `<span className="animate-pulse">{loadingStatus || "The Judge is speaking..."}</span>`
);

fs.writeFileSync(file, content);
console.log("bench-simulator.tsx updated with Live UI Loading Status.");
