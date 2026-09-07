const fs = require('fs');

const logPath = "/Users/macbook/.gemini/antigravity/brain/19c49ae4-1890-4c1e-ba9f-fbe9ddf26d01/.system_generated/logs/transcript_full.jsonl";
const lines = fs.readFileSync(logPath, 'utf-8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  try {
    const obj = JSON.parse(lines[i]);
    if (obj.tool_calls) {
      for (const call of obj.tool_calls) {
        if (call.name === 'replace_file_content' && call.arguments && call.arguments.TargetFile && call.arguments.TargetFile.includes('PreviewLanding.tsx')) {
           fs.writeFileSync(`replacement_${obj.step_index}.tsx`, call.arguments.ReplacementContent);
           console.log(`Dumped replacement from step ${obj.step_index}`);
        }
      }
    }
  } catch (e) {}
}
