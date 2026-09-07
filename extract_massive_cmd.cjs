const fs = require('fs');

const logPath = "/Users/macbook/.gemini/antigravity/brain/f37e6e06-9d09-471e-9660-570a7fd9dedc/.system_generated/logs/transcript_full.jsonl";
const lines = fs.readFileSync(logPath, 'utf-8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  try {
    const obj = JSON.parse(lines[i]);
    if (obj.tool_calls) {
      for (const call of obj.tool_calls) {
        if (call.name === 'run_command' && call.arguments && call.arguments.CommandLine && call.arguments.CommandLine.length > 10000) {
           fs.writeFileSync('massive_command.txt', call.arguments.CommandLine);
           console.log("Dumped massive command!");
           process.exit(0);
        }
      }
    }
  } catch (e) {}
}
