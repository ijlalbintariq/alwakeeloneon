const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/client/src/pages/bench-simulator.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('const [judgeProfile, setJudgeProfile]')) {
  content = content.replace(
    'const [score, setScore] = useState(100);',
    'const [score, setScore] = useState(100);\n  const [judgeProfile, setJudgeProfile] = useState<any>(null);'
  );
}

content = content.replace(
  'setSessionId(data.sessionId);',
  'setSessionId(data.sessionId);\n                if (data.judgeProfile) setJudgeProfile(data.judgeProfile);'
);

const newHUDStr = `<Button variant="outline" size="sm" onClick={() => alert("Session History modal coming soon.")} className="flex gap-2">`;
const profileHUDStr = `{judgeProfile && (
              <div 
                className="hidden lg:flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full border border-primary/20 cursor-help"
                title={\`Confidence: \${judgeProfile.confidence} - Based on \${judgeProfile.evidenceJudgmentIds?.length || 0} retrieved judgments.\`}
              >
                <span>Judge Basis: {judgeProfile.confidence}</span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => alert("Session History modal coming soon.")} className="flex gap-2">`;

if (!content.includes('Judge Basis:')) {
  content = content.replace(newHUDStr, profileHUDStr);
  fs.writeFileSync(file, content);
  console.log("Profile HUD added.");
} else {
  console.log("HUD already modified.");
}
