const fs = require('fs');

const data = fs.readFileSync('candidate_2.txt', 'utf-8').split('\n')[0];
try {
  const obj = JSON.parse(data);
  // obj.content contains the view_file output!
  let content = obj.content;
  
  // It has line numbers like "1: ..."
  // Let's strip the prefix!
  const lines = content.split('\n');
  const cleanLines = [];
  let isCode = false;
  
  for (const line of lines) {
    if (line.match(/^\d+:\s/)) {
      isCode = true;
      cleanLines.push(line.replace(/^\d+:\s/, ''));
    } else if (isCode) {
      // If we are past the code section, maybe we should stop or keep going if it's multiline
      // Wait, view_file format is "1: <original_line>"
      // Some original lines might not have prefix if they are somehow split? No, they all have prefixes.
      // But let's just use regex to clean it safely.
    }
  }
  
  fs.writeFileSync('PreviewLanding_Recovered_Audit.tsx', cleanLines.join('\n'));
  console.log("Extracted successfully!");
} catch(e) {
  console.log("Error parsing JSON", e);
}
