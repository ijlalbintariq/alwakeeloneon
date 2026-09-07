const fs = require('fs');
const lines = fs.readFileSync('transcript_dump.jsonl', 'utf-8').split('\n');
let found = false;
for (let i = lines.length - 1; i >= 0; i--) {
  if (!lines[i].trim()) continue;
  try {
    const obj = JSON.parse(lines[i]);
    if (obj.tool_calls) {
      for (const call of obj.tool_calls) {
        if (call.name === 'write_to_file' && call.arguments && call.arguments.TargetFile && call.arguments.TargetFile.includes('PreviewLanding.tsx')) {
          fs.writeFileSync('client/src/experimental/pages/PreviewLanding.tsx', call.arguments.CodeContent);
          console.log('SUCCESS: Restored PreviewLanding.tsx from write_to_file!');
          found = true;
          process.exit(0);
        }
        if (call.name === 'run_command' && call.arguments && call.arguments.CommandLine && call.arguments.CommandLine.includes('PreviewLanding.tsx')) {
           if (call.arguments.CommandLine.includes('EOF')) {
             const match = call.arguments.CommandLine.match(/cat << ['"]?EOF['"]? > .*PreviewLanding\.tsx\n([\s\S]*?)\nEOF/);
             if (match) {
               fs.writeFileSync('client/src/experimental/pages/PreviewLanding.tsx', match[1]);
               console.log('SUCCESS: Restored PreviewLanding.tsx from run_command cat EOF!');
               found = true;
               process.exit(0);
             }
           }
        }
      }
    }
  } catch (e) {}
}
if (!found) console.log('Not found in dump');
