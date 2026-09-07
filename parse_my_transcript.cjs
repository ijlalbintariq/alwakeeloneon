const fs = require('fs');

const logPath = "/Users/macbook/.gemini/antigravity/brain/e96b54c6-d394-49e9-8255-db8ae3a2bc76/.system_generated/logs/transcript_full.jsonl";
const lines = fs.readFileSync(logPath, 'utf-8').split('\n');

let latestCode = null;

for (let i = 0; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  try {
    const obj = JSON.parse(lines[i]);
    if (obj.tool_calls) {
      for (const call of obj.tool_calls) {
        if (call.name === 'run_command' && call.arguments && call.arguments.CommandLine && call.arguments.CommandLine.includes('export default function PreviewLanding')) {
           const match = call.arguments.CommandLine.match(/cat << ['"]?EOF['"]? > .*PreviewLanding\.tsx\n([\s\S]*?)\nEOF/);
           if (match) {
             latestCode = match[1];
           }
        }
        if (call.name === 'write_to_file' && call.arguments && call.arguments.TargetFile && call.arguments.TargetFile.includes('PreviewLanding.tsx')) {
           latestCode = call.arguments.CodeContent;
        }
      }
    }
  } catch (e) {}
}

if (latestCode) {
  fs.writeFileSync('client/src/experimental/pages/PreviewLanding.tsx', latestCode);
  console.log("SUCCESS");
} else {
  console.log("NOT FOUND");
}
