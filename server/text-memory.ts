/** Count without retaining an array of every word in a long judgment. */
export function countWords(text: string): number {
  const words = /\S+/g;
  let count = 0;
  while (words.exec(text)) count++;
  return count;
}

/** Only scan the excerpt; do not tokenize the rest of a large statute. */
export function firstWords(text: string, maximum: number): string {
  const words = /\S+\s*/g;
  let end = 0;
  for (let i = 0; i < maximum; i++) {
    const match = words.exec(text);
    if (!match) return text;
    end = words.lastIndex;
  }
  return text.slice(0, end) + (words.exec(text) ? "…" : "");
}
