import fs from 'fs';

const raw = fs.readFileSync('test_judgment.txt', 'utf-8');

function format(text: string) {
  let t = text.replace(/\r\n/g, '\n');
  // Consolidate explicit multiple newlines into a standard marker
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

    if (line.trim().length > 35 && !isNextLineNewParagraph) {
      result += " ";
    } else {
      result += "\n";
    }
  }
  
  return result.split('\n').map(p => p.trim()).filter(Boolean).join('\n\n');
}

console.log(format(raw).slice(0, 3000));
