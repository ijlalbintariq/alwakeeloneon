const STOP_WORDS = new Set([
  "a","an","the","and","or","but","if","then","else","when","at","by","for",
  "in","of","on","to","from","with","as","is","was","are","were","been",
  "be","have","has","had","do","does","did","it","its","this","that",
  "these","those","i","you","he","she","we","they","me","him","her",
  "us","them","my","your","his","our","their","no","not","so","very",
  "can","will","just","about","into","over","also","than","them","which",
  "what","who","how","all","each","every","both","few","more","most",
  "other","some","such","only","own","same","too","would","could","should",
  "may","might","shall","must","need","must","there","here","where","why",
]);

function meaningfulWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function wordOverlapRatio(quoteText: string, sourceText: string): number {
  const quoteWords = meaningfulWords(quoteText);
  const sourceWords = new Set(meaningfulWords(sourceText));
  console.log("quoteWords:", quoteWords);
  if (quoteWords.length === 0) return 1; 

  const matched = quoteWords.filter((w) => sourceWords.has(w)).length;
  return matched / quoteWords.length;
}

const rawQuote = "JUDGMENT: P L D 2025 Islamabad 388 Before Muhammad Azam Khan, J UMAR AKBAR ALI";
const src = "JUDGMENT: P L D 2025 Islamabad 388 Before Muhammad Azam Khan, J UMAR AKBAR ALI---Petitioner...";
console.log(wordOverlapRatio(rawQuote, src));
