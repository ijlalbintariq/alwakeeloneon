import fs from 'fs';
const routesSource = fs.readFileSync('server/routes.ts', 'utf8');

const levenshteinBody = routesSource.match(/function levenshtein[\s\S]*?return \w+\[\w+\.length\];\n\s*\}/)?.[0] || '';
const fuzzyMatchBody = routesSource.match(/function fuzzyMatch[\s\S]*?return levenshtein\(word, target\) <= maxDist;\n\s*\}/)?.[0] || '';
const hasFuzzyBody = routesSource.match(/function hasFuzzy[\s\S]*?return words\.some\(\(w\) => fuzzyMatch\(w, target\)\);\n\s*\}/)?.[0] || '';
const hasFuzzyPhraseBody = routesSource.match(/function hasFuzzyPhrase[\s\S]*?return false;\n\s*\}/)?.[0] || '';
const extractConversionTargetBody = routesSource.match(/function extractConversionTarget[\s\S]*?return target \|\| null;\n\s*\}/)?.[0] || '';

// Let's just mock them because we know how they work.
// Actually, I can just copy the relevant functions from routes.ts into a test script.
