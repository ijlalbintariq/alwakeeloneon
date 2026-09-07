import fs from 'fs';
const raw = fs.readFileSync('test_judgment.txt', 'utf-8');
const lines = raw.split('\n');
const lens = lines.map(l => l.trim().length).filter(l => l > 10);
console.log("Avg length:", lens.reduce((a, b) => a + b, 0) / lens.length);
console.log("Max length:", Math.max(...lens));
console.log("Min length:", Math.min(...lens));
const sorted = [...lens].sort((a,b) => a-b);
console.log("Median length:", sorted[Math.floor(sorted.length/2)]);
