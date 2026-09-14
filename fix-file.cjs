const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/client/src/pages/bench-simulator.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Find the line index containing `<Input ` after `alert("File attachment...`
let startIndex = -1;
for (let i = 205; i < lines.length; i++) {
  if (lines[i].includes('<Input') && lines[i-1] && lines[i-1].includes('Paperclip')) {
    startIndex = i;
    break;
  }
}

const replacement = `              <Input 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your argument..."
                disabled={isStreaming}
                className="flex-1"
              />
              <Button type="submit" disabled={isStreaming || !inputValue.trim()} className="bg-[#2563EB] hover:bg-[#1D4ED8]">
                <Send size={18} className="mr-2" />
                Submit
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <Dialog open={!sessionActive} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-[425px]" hideClose>
            <DialogHeader>
              <DialogTitle>Configure Simulator</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Court Level</label>
                <Select onValueChange={(val) => setConfig({ ...config, courtLevel: val })}>
                  <SelectTrigger><SelectValue placeholder="Select court..." /></SelectTrigger>
                  <SelectContent className="bg-background dark:bg-[#0F172A] border shadow-xl z-[100] border-solid opacity-100">
                    <SelectItem value="supreme_court">Supreme Court</SelectItem>
                    <SelectItem value="high_court">High Court</SelectItem>
                    <SelectItem value="district_sessions">District & Sessions Court</SelectItem>
                    <SelectItem value="special_tribunal_nab">Special Tribunal (NAB)</SelectItem>
                    <SelectItem value="special_tribunal_atc">Anti-Terrorism Court (ATC)</SelectItem>
                    <SelectItem value="banking_court">Banking Court</SelectItem>
                    <SelectItem value="customs_appellate">Customs Appellate Tribunal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Case Nature</label>
                <Select onValueChange={(val) => setConfig({ ...config, caseNature: val })}>
                  <SelectTrigger><SelectValue placeholder="Select nature..." /></SelectTrigger>
                  <SelectContent className="bg-background dark:bg-[#0F172A] border shadow-xl z-[100] border-solid opacity-100">
                    <SelectItem value="civil">Civil</SelectItem>
                    <SelectItem value="criminal">Criminal</SelectItem>
                    <SelectItem value="constitutional">Constitutional</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="taxation">Taxation</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="rent">Rent</SelectItem>
                    <SelectItem value="cyber_crime">Cyber Crime</SelectItem>
                    <SelectItem value="quashment">Quashment (482 CrPC)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Proceeding Stage</label>
                <Select onValueChange={(val) => setConfig({ ...config, proceedingStage: val })}>
                  <SelectTrigger><SelectValue placeholder="Select stage..." /></SelectTrigger>
                  <SelectContent className="bg-background dark:bg-[#0F172A] border shadow-xl z-[100] border-solid opacity-100">
                    <SelectItem value="preliminary_hearing">Preliminary Hearing</SelectItem>
                    <SelectItem value="bail_pre_arrest">Bail (Pre-Arrest)</SelectItem>
                    <SelectItem value="bail_post_arrest">Bail (Post-Arrest)</SelectItem>
                    <SelectItem value="framing_of_issues">Framing of Issues</SelectItem>
                    <SelectItem value="framing_of_charge">Framing of Charge</SelectItem>
                    <SelectItem value="cross_examination">Cross-Examination</SelectItem>
                    <SelectItem value="evidence_recording">Evidence Recording</SelectItem>
                    <SelectItem value="final_arguments">Final Arguments</SelectItem>
                    <SelectItem value="appellate_arguments">Appellate Arguments</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Specific Judge (Optional)</label>
                <Input 
                  list="judge-suggestions"
                  placeholder="e.g. Justice Mansoor Ali Shah" 
                  value={config.selectedJudgeName}
                  onChange={(e) => setConfig({ ...config, selectedJudgeName: e.target.value })}
                />
                <datalist id="judge-suggestions">
                  {judgeSuggestions.map((judge: string) => (
                    <option key={judge} value={judge} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">If provided, the AI will pull their rulings to build a Judicial Decision Profile.</p>
              </div>
              <Button className="w-full mt-4" onClick={handleStartSession} disabled={!config.courtLevel || !config.caseNature || !config.proceedingStage}>
                Enter the Courtroom
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </PreviewShell>
  );
}`;

if (startIndex !== -1) {
  const newContent = lines.slice(0, startIndex).join('\\n') + '\\n' + replacement;
  fs.writeFileSync(file, newContent);
  console.log("Restored missing lines.");
}
