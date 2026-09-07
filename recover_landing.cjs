const fs = require('fs');

function searchLog(logPath) {
  if (!fs.existsSync(logPath)) return false;
  const lines = fs.readFileSync(logPath, 'utf-8').split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i]) continue;
    try {
      const obj = JSON.parse(lines[i]);
      if (obj.tool_calls) {
        for (const call of obj.tool_calls) {
          if (call.name === 'write_to_file' && call.arguments && call.arguments.TargetFile && call.arguments.TargetFile.includes('PreviewLanding.tsx')) {
            fs.writeFileSync('client/src/experimental/pages/PreviewLanding.tsx', call.arguments.CodeContent);
            console.log('SUCCESS: Restored PreviewLanding.tsx from ' + logPath);
            return true;
          }
          if (call.name === 'run_command' && call.arguments && call.arguments.CommandLine && call.arguments.CommandLine.includes('PreviewLanding.tsx')) {
             if (call.arguments.CommandLine.includes('EOF')) {
               const match = call.arguments.CommandLine.match(/cat << ['"]?EOF['"]? > .*PreviewLanding\.tsx\n([\s\S]*?)\nEOF/);
               if (match) {
                 fs.writeFileSync('client/src/experimental/pages/PreviewLanding.tsx', match[1]);
                 console.log('SUCCESS: Restored PreviewLanding.tsx from ' + logPath + ' via cat EOF');
                 return true;
               }
             }
          }
        }
      }
    } catch (e) {}
  }
  return false;
}

const paths = [
  '/Users/macbook/.gemini/antigravity/brain/19c49ae4-1890-4c1e-ba9f-fbe9ddf26d01/.system_generated/logs/transcript_full.jsonl',
  '/Users/macbook/.gemini/antigravity/brain/e96b54c6-d394-49e9-8255-db8ae3a2bc76/.system_generated/logs/transcript_full.jsonl'
];

let restored = false;
for (const p of paths) {
  if (searchLog(p)) {
    restored = true;
    break;
  }
}

if (!restored) console.log("Failed to restore from logs.");
