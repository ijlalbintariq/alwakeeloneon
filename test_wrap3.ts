import fs from 'fs';
const raw = fs.readFileSync('test_judgment.txt', 'utf-8');

function format(text: string) {
  let t = text.replace(/\r\n/g, '\n');
  t = t.replace(/\n\n+/g, '\n__PARAGRAPH__\n');
  const lines = t.split('\n');
  let result = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === '__PARAGRAPH__') {
      result += "\n\n";
      continue;
    }
    result += line;
    
    const nextLine = lines[i+1] || "";
    const isNextLineNewParagraph = /^\s*(\d+\.|[A-Z]\.|[ivx]+\.)\s/.test(nextLine) || /^\s*(JUDGMENT|ORDER|BACKGROUND|FACTS|HELD|DECISION|COURT|CASE DETAILS)\b/i.test(nextLine) || nextLine === '__PARAGRAPH__';

    // 30 characters is the sweet spot for Pakistani judgments.
    // Short header lines (Court names, Appeal numbers) are usually 20-30 chars.
    // Wrapped body text is usually 50-80 chars. 
    // This allows "SADAQAT ALI KHAN, J. Mukhtiar Khan" (34 chars) to wrap properly into the body.
    if (line.trim().length > 29 && !isNextLineNewParagraph) {
      result += " ";
    } else {
      result += "\n";
    }
  }
  
  return result.split('\n').map(p => p.trim()).filter(Boolean).join('\n\n');
}

console.log(format(raw).slice(0, 3000));
