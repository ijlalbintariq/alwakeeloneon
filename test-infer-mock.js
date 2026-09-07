function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function fuzzyMatch(word, target) {
  if (word === target) return true;
  if (word.length < 3 || target.length < 3) return word === target;
  const maxDist = target.length <= 5 ? 1 : target.length <= 8 ? 2 : 3;
  return levenshtein(word, target) <= maxDist;
}

function hasFuzzy(words, target) {
  return words.some((w) => fuzzyMatch(w, target));
}

function hasFuzzyPhrase(text, phrase) {
  const phraseWords = phrase.split(/\s+/);
  if (phraseWords.length === 1) return hasFuzzy(text.split(/\s+/), phraseWords[0]);
  const textWords = text.split(/\s+/);
  for (let i = 0; i <= textWords.length - phraseWords.length; i++) {
    let allMatch = true;
    for (let j = 0; j < phraseWords.length; j++) {
      if (!fuzzyMatch(textWords[i + j], phraseWords[j])) { allMatch = false; break; }
    }
    if (allMatch) return true;
  }
  return false;
}

const CONVERSION_VERBS = ["convert", "change", "turn", "transform", "make", "rewrite", "redo"];
const CONVERSION_PREPS = ["into", "to", "in", "as"];

function extractConversionTarget(prompt) {
  const words = prompt.toLowerCase().split(/\s+/);
  let verbIdx = -1;
  for (let i = 0; i < words.length; i++) {
    if (CONVERSION_VERBS.some((v) => fuzzyMatch(words[i], v))) { verbIdx = i; break; }
  }
  if (verbIdx < 0) return null;
  const fillers = new Set(["this", "it", "the", "an", "a", "that", "my", "our", "above", "draft", "document"]);
  let cursor = verbIdx + 1;
  while (cursor < words.length && fillers.has(words[cursor])) cursor++;
  if (cursor < words.length && CONVERSION_PREPS.some((p) => fuzzyMatch(words[cursor], p))) cursor++;
  while (cursor < words.length && fillers.has(words[cursor])) cursor++;
  const target = words.slice(cursor).join(" ").trim();
  return target || null;
}

const DOC_TYPE_SIGNALS = {
  "civil-suit-plaint": [
    { keywords: ["plaint"], phrases: ["civil suit", "declaration suit", "injunction suit"], weight: 8 },
  ],
};

function infer(prompt) {
  const text = String(prompt || "").toLowerCase().trim();
  if (!text) return null;
  const words = text.split(/\s+/);

  const conversionTarget = extractConversionTarget(text);
  console.log("Extracted Target:", conversionTarget);
  if (conversionTarget) {
    const targetWords = conversionTarget.split(/\s+/);
    let bestType = null;
    let bestScore = 0;
    for (const [docType, signals] of Object.entries(DOC_TYPE_SIGNALS)) {
      let score = 0;
      for (const signal of signals) {
        for (const kw of signal.keywords) {
          if (hasFuzzy(targetWords, kw)) score += signal.weight;
        }
        for (const phrase of signal.phrases) {
          if (hasFuzzyPhrase(conversionTarget, phrase)) score += signal.weight;
        }
      }
      if (score > bestScore) { bestScore = score; bestType = docType; }
    }
    console.log("Best Score:", bestScore, "Best Type:", bestType);
    if (bestType && bestScore >= 5) {
      return bestType;
    }
  }
  return null;
}

console.log(infer("Rewrite the entire document as a Civil Suit for Damages"));
