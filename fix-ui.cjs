const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/client/src/pages/bench-simulator.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add judge selection state
if (!content.includes('selectedJudgeName: ""')) {
  content = content.replace(
    'proceedingStage: ""',
    'proceedingStage: "",\n    selectedJudgeName: ""'
  );
}

// 2. Expand Court Level options
const courtOptions = `
                    <SelectItem value="supreme_court">Supreme Court</SelectItem>
                    <SelectItem value="high_court">High Court</SelectItem>
                    <SelectItem value="district_sessions">District & Sessions Court</SelectItem>
                    <SelectItem value="special_tribunal_nab">Special Tribunal (NAB)</SelectItem>
                    <SelectItem value="special_tribunal_atc">Anti-Terrorism Court (ATC)</SelectItem>
                    <SelectItem value="banking_court">Banking Court</SelectItem>
                    <SelectItem value="customs_appellate">Customs Appellate Tribunal</SelectItem>`;
content = content.replace(
  /<SelectItem value="Supreme Court">Supreme Court<\/SelectItem>[\s\S]*?<SelectItem value="District & Sessions Court">District & Sessions Court<\/SelectItem>/,
  courtOptions.trim()
);

// 3. Expand Case Nature options
const natureOptions = `
                    <SelectItem value="civil">Civil</SelectItem>
                    <SelectItem value="criminal">Criminal</SelectItem>
                    <SelectItem value="constitutional">Constitutional</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="taxation">Taxation</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="rent">Rent</SelectItem>
                    <SelectItem value="cyber_crime">Cyber Crime</SelectItem>
                    <SelectItem value="quashment">Quashment (482 CrPC)</SelectItem>`;
content = content.replace(
  /<SelectItem value="Civil">Civil<\/SelectItem>[\s\S]*?<SelectItem value="Corporate">Corporate<\/SelectItem>/,
  natureOptions.trim()
);

// 4. Expand Proceeding Stage options
const stageOptions = `
                    <SelectItem value="preliminary_hearing">Preliminary Hearing</SelectItem>
                    <SelectItem value="bail_pre_arrest">Bail (Pre-Arrest)</SelectItem>
                    <SelectItem value="bail_post_arrest">Bail (Post-Arrest)</SelectItem>
                    <SelectItem value="framing_of_issues">Framing of Issues</SelectItem>
                    <SelectItem value="framing_of_charge">Framing of Charge</SelectItem>
                    <SelectItem value="cross_examination">Cross-Examination</SelectItem>
                    <SelectItem value="evidence_recording">Evidence Recording</SelectItem>
                    <SelectItem value="final_arguments">Final Arguments</SelectItem>
                    <SelectItem value="appellate_arguments">Appellate Arguments</SelectItem>`;
content = content.replace(
  /<SelectItem value="Preliminary Hearing">Preliminary Hearing<\/SelectItem>[\s\S]*?<SelectItem value="Final Arguments">Final Arguments<\/SelectItem>/,
  stageOptions.trim()
);

// 5. Add optional Judge Selector below the Proceeding Stage
const judgeSelectorHtml = `
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Specific Judge (Optional)</label>
                <Input 
                  placeholder="e.g. Justice Mansoor Ali Shah" 
                  value={config.selectedJudgeName}
                  onChange={(e) => setConfig({ ...config, selectedJudgeName: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">If provided, the AI will pull their rulings to build a Judicial Decision Profile.</p>
              </div>`;
content = content.replace(
  /<\/Select>\s*<\/div>\s*<Button className="w-full mt-4" onClick=\{handleStartSession\}/,
  judgeSelectorHtml + '\n              <Button className="w-full mt-4" onClick={handleStartSession}'
);

fs.writeFileSync(file, content);
console.log("UI updated.");
