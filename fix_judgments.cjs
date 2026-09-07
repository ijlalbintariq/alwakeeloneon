const fs = require('fs');

let code = fs.readFileSync('client/src/experimental/pages/PreviewJudgments.tsx', 'utf-8');

// Replace the empty state check to first check for searchError
const oldCheck = `              ) : hasSearched && searchResults.length === 0 ? (`;
const newCheck = `              ) : searchError ? (
                <div className="py-16 text-center rounded-2xl bg-red-50 border border-red-100 space-y-2 text-red-600 shadow-xs">
                  <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
                  <p className="text-xs font-bold">Search Failed</p>
                  <p className="text-[11px] opacity-80">{searchError}</p>
                </div>
              ) : hasSearched && searchResults.length === 0 ? (`;

if (code.includes(oldCheck)) {
  code = code.replace(oldCheck, newCheck);
  fs.writeFileSync('client/src/experimental/pages/PreviewJudgments.tsx', code);
  console.log("Fixed missing error state in PreviewJudgments");
} else {
  console.log("Could not find anchor to inject error state");
}
