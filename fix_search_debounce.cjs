const fs = require('fs');

const FILE = 'client/src/experimental/pages/PreviewJudgments.tsx';
let code = fs.readFileSync(FILE, 'utf-8');

const target1 = `  const handleExecuteTwoTierSearch = async (
    overrideQuery?: string,
    overrideJournal?: string,
    overrideCourt?: string,
    page: number = 1
  ) => {`;
const replace1 = `  const handleExecuteTwoTierSearch = async (
    overrideQuery?: string,
    overrideJournal?: string,
    overrideCourt?: string,
    page: number = 1
  ) => {
    if (isSearching || isLoadingMore) return;`;

const target2 = `  const handlePinpointSearch = async (params: {
    year: string;
    journal: string;
    page: string;
  }) => {`;
const replace2 = `  const handlePinpointSearch = async (params: {
    year: string;
    journal: string;
    page: string;
  }) => {
    if (isSearching) return;`;

if (code.includes(target1) || code.includes(target2)) {
  code = code.replace(target1, replace1).replace(target2, replace2);
  fs.writeFileSync(FILE, code);
  console.log("Fixed debouncing in PreviewJudgments");
} else {
  console.log("Could not find targets in PreviewJudgments");
}
