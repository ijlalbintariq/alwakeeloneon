const CONVERSION_PATTERN = /\b(convert|transform|turn|rewrite|redraft)\s+(?:this|it|the\s+draft|the\s+entire\s+document)?\s*(?:into|to|as)\s+(?:a|an)?\s*(?:civil|criminal|constitutional|writ|bail|appeal|revision|petition|plaint|suit|application|affidavit|notice|power\s+of\s+attorney|written\s+statement)\b|\bmake\s+(?:this|it|the\s+draft)\s+into\s+(?:a|an)?\s*(?:petition|plaint|suit|application|affidavit|notice|appeal|revision|written\s+statement)\b/i;
const prompt = "Rewrite the entire document as a Civil Suit for Damages";
console.log(CONVERSION_PATTERN.test(prompt));
