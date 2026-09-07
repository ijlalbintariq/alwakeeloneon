const fs = require('fs');
const path = require('path');

const DIR = 'client/src/experimental/pages';

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];
  
  if (!content.includes('isLoading') && !content.includes('isSearching') && content.includes('useQuery')) {
    issues.push('Missing loading state handling for query');
  }
  if (!content.includes('Toast') && !content.includes('toast(') && content.includes('catch (')) {
    issues.push('Missing error toast in catch block');
  }
  if (!content.includes('length === 0') && !content.includes('length > 0') && !content.includes('No results') && content.includes('.map(')) {
    issues.push('Possible missing empty state handling for mapped array');
  }
  if (content.includes('localStorage.setItem') || content.includes('localStorage.getItem')) {
    issues.push('Still using localStorage instead of DB (Mock State)');
  }
  return issues;
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.tsx'));
const results = {};
for (const f of files) {
  const issues = scanFile(path.join(DIR, f));
  if (issues.length > 0) results[f] = issues;
}
console.log(JSON.stringify(results, null, 2));
