import fs from "fs";

const logs = JSON.parse(fs.readFileSync("/Users/macbook/Downloads/Alwakeelo/scratch/extracted_chat_logs_2026.json", "utf8"));
console.log("Total logs:", logs.length);
let count = 0;
for (const log of logs) {
  const output = log.outputSnippet || "";
  // Check if output contains typical patterns like 4-digit number followed by caps
  if (/\b(19\d{2}|20\d{2})\s+[A-Z]/.test(output) || /\b[A-Z]+\s+(19\d{2}|20\d{2})\b/.test(output)) {
    console.log(`--- Log ID: ${log.id} (${log.userEmail}) ---`);
    console.log(output.substring(0, 1000));
    count++;
    if (count >= 5) break;
  }
}
process.exit(0);
