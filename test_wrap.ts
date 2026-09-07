import fs from 'fs';

const raw = fs.readFileSync('test_judgment.txt', 'utf-8');

function format(text: string) {
  let t = text.replace(/\r\n/g, '\n');
  const lines = t.split('\n');
  let result = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    result += line;
    
    // Check if we should append a space (join with next line) or a newline (keep break)
    // If line length > 45, it implies it hit the PDF margin and wrapped.
    // If it ends with a period, it might be the end of a paragraph, but sometimes paragraphs wrap right after a period.
    // However, if it's very short (< 45), it's almost certainly a header or the natural end of a paragraph.
    if (line.trim().length > 45) {
      // It's a long line, so it wrapped.
      // BUT if the NEXT line starts with a number (e.g. "2. "), it's a new paragraph.
      const nextLine = lines[i+1] || "";
      if (/^\s*(\d+\.|[A-Z]\.)\s/.test(nextLine)) {
        result += "\n\n";
      } else {
        result += " ";
      }
    } else {
      // Short line, keep the line break.
      result += "\n";
    }
  }
  
  return result.split('\n').map(p => p.trim()).filter(Boolean).join('\n\n');
}

console.log(format(raw).slice(0, 3000));
