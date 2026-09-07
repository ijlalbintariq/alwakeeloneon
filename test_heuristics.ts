import fs from 'fs';

const raw = fs.readFileSync('test_judgment.txt', 'utf-8');

function format(text: string) {
  let t = text.replace(/\r\n/g, '\n');
  t = t.replace(/\n\n+/g, '___PARAGRAPH_BREAK___');

  const lines = t.split('\n');
  const result: string[] = [];

  let currentPara = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('___PARAGRAPH_BREAK___')) {
      const parts = line.split('___PARAGRAPH_BREAK___');
      currentPara += (currentPara ? " " : "") + parts[0];
      result.push(currentPara.trim());
      for (let j = 1; j < parts.length - 1; j++) {
        result.push(parts[j].trim());
      }
      currentPara = parts[parts.length - 1];
      continue;
    }

    if (currentPara === "") {
      currentPara = line;
      continue;
    }

    const prevLine = currentPara;
    const lastChar = prevLine.trim().slice(-1);
    
    // Heuristics to KEEP the line break (start a new paragraph):
    // 1. Line starts with number/letter list e.g. "2. ", "A. "
    const isList = /^\s*(\d+\.|[A-Z]\.)\s/.test(line);
    // 2. Line is a common heading
    const isHeading = /^\s*(JUDGMENT|ORDER|BACKGROUND|FACTS|HELD|DECISION)\b/i.test(line);
    // 3. Prev line is very short (header/title) and doesn't end with a comma
    // Let's say < 45 chars is a header line IF it's in the first 30 lines? Or just generally.
    const lastRealLine = prevLine.split('\n').pop() || "";
    const isShortHeader = lastRealLine.length < 50 && ![':', ',', ' '].includes(lastChar) && !/ (and|or|the|in|of|by|with|for)$/i.test(lastRealLine);
    
    if (isList || isHeading || isShortHeader) {
      result.push(currentPara.trim());
      currentPara = line;
    } else {
      currentPara += " " + line.trim();
    }
  }
  
  if (currentPara) result.push(currentPara.trim());
  
  return result.filter(Boolean).join('\n\n');
}

console.log(format(raw).slice(0, 3000));
