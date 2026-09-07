import fs from 'fs';
const raw = fs.readFileSync('test_judgment.txt', 'utf-8');

const regex = /\b(19\d\d|20\d\d)\s+(PLD|SCMR|LHC|SHC|PHC|BHC|IHC|FSC|CLC|PCrLJ|YLR|MLD|CLD|PTD|PLC)\s+(\d+)\b/g;

let match;
const citations = new Set<string>();
while ((match = regex.exec(raw)) !== null) {
  citations.add(match[0]);
}
console.log("Citations found:", Array.from(citations));
