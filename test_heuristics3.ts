import fs from 'fs';

const raw = fs.readFileSync('test_judgment.txt', 'utf-8');

function format(text: string) {
  let t = text.replace(/\r\n/g, '\n');
  t = t.replace(/\n\n+/g, '___PARAGRAPH_BREAK___');

  const lines = t.split('\n');
  const result: string[] = [];

  let currentPara = "";
  let lastAppendedOriginalLine = "";

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
      lastAppendedOriginalLine = currentPara;
      continue;
    }

    if (currentPara === "") {
      currentPara = line;
      lastAppendedOriginalLine = line;
      continue;
    }

    const lastChar = lastAppendedOriginalLine.trim().slice(-1);
    const lastWord = lastAppendedOriginalLine.trim().split(' ').pop() || "";
    
    // 1. Lists
    const isList = /^\s*(\d+\.|[A-Z]\.)\s/.test(line);
    // 2. Headings
    const isHeading = /^\s*(JUDGMENT|ORDER|BACKGROUND|FACTS|HELD|DECISION|COURT|CASE DETAILS)\b/i.test(line);
    // 3. Short header detection
    const isShortHeader = lastAppendedOriginalLine.length < 45 && ![':', ',', ' '].includes(lastChar) && !/ (and|or|the|in|of|by|with|for|to)$/i.test(lastAppendedOriginalLine);
    
    // 4. Force paragraph if previous line ends with a period, AND this line starts with a Capital letter or Number
    const sentenceEnded = lastChar === '.' && /^[A-Z0-9]/.test(line.trim());

    if (isList || isHeading || isShortHeader || sentenceEnded) {
      result.push(currentPara.trim());
      currentPara = line;
    } else {
      currentPara += " " + line.trim();
    }
    lastAppendedOriginalLine = line;
  }
  
  if (currentPara) result.push(currentPara.trim());
  
  return result.filter(Boolean).join('\n\n');
}

console.log(format(raw).slice(0, 3000));
