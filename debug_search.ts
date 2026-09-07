import { MULTIPLE_SPACES_REGEX, STOP_WORDS } from './server/storage';

const safeQuery = "Const. P. 11/2026 (SHC)";
const allTokens = safeQuery
  .toLowerCase()
  .replace(/[^\w\s]/g, ' ')
  .split(MULTIPLE_SPACES_REGEX)
  .map((token) => token.trim())
  .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));

console.log("Tokens:", allTokens);
