const fs = require('fs');

async function extract() {
  const filePath = "transcript_dump.jsonl";
  if (!fs.existsSync(filePath)) return console.log("no dump");
  
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split('\n');
  
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].trim()) continue;
    try {
      const line = lines[i];
      // strip out the line number formatting from view_file: "123: {"
      const match = line.match(/^\d+:\s*(.*)/);
      if (!match) continue;
      const jsonStr = match[1];
      
      const obj = JSON.parse(jsonStr);
      if (obj.tool_calls) {
        for (const call of obj.tool_calls) {
          if (call.name === 'write_to_file' && call.arguments && call.arguments.TargetFile && call.arguments.TargetFile.includes('PreviewLanding.tsx')) {
            fs.writeFileSync('client/src/experimental/pages/PreviewLanding.tsx', call.arguments.CodeContent);
            console.log("SUCCESS: Extracted PreviewLanding.tsx!");
            return;
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }
  console.log("Not found in dump");
}

extract();
