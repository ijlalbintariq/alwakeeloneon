const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/client/src/pages/bench-simulator.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update imports
content = content.replace(
  'import { Bot, User, Scale, Shield } from "lucide-react";',
  'import { Bot, User, Scale, Shield, Paperclip, RotateCcw, History as HistoryIcon } from "lucide-react";'
);

// 2. Add handleReset function
if (!content.includes('const handleReset')) {
  content = content.replace(
    '  const handleStartSession = async () => {',
    `  const handleReset = () => {
    if (confirm("Are you sure you want to end this session and reset the simulator?")) {
      setSessionActive(false);
      setSessionId(null);
      setMessages([]);
      setRound(1);
      setScore(100);
    }
  };

  const handleStartSession = async () => {`
  );
}

// 3. Update HUD
content = content.replace(
  /<div className="flex justify-between items-center bg-card p-4 rounded-xl shadow-sm mb-4">([\s\S]*?)<\/div>\s*<\/div>\s*\)/,
  `<div className="flex justify-between items-center bg-card p-4 rounded-xl shadow-sm mb-4">
          <div className="flex items-center gap-2">
            <Scale className="text-primary" />
            <h1 className="text-xl font-bold hidden sm:block">The Bench</h1>
            <span className="text-sm text-muted-foreground hidden md:inline-block">
              ({config.courtLevel} - {config.caseNature})
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="text-center hidden sm:block">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Round</div>
              <div className="text-xl font-bold">{round}/5</div>
            </div>
            <div className="text-center mr-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Live Score</div>
              <div className={\`text-xl font-bold \${score > 80 ? "text-green-600" : score > 60 ? "text-yellow-600" : "text-red-600"}\`}>
                {score}/100
              </div>
            </div>
            
            <Button variant="outline" size="sm" onClick={() => alert("Session History modal coming soon.")} className="flex gap-2">
              <HistoryIcon size={16} />
              <span className="hidden lg:inline">History</span>
            </Button>
            
            <Button variant="destructive" size="sm" onClick={handleReset} className="flex gap-2">
              <RotateCcw size={16} />
              <span className="hidden lg:inline">Reset</span>
            </Button>
          </div>
        </div>
      )`
);

// 4. Update Chat Bubbles
content = content.replace(
  /bg-primary text-primary-foreground/g,
  'bg-[#2563EB] text-white shadow-sm'
);

// 5. Update Chat Input
content = content.replace(
  /<form onSubmit=\{\(e\) => \{ e\.preventDefault\(\); sendMessage\(\); \}\} className="flex gap-2">([\s\S]*?)<\/form>/,
  `<form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2 items-center">
              <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => alert("File attachment analysis for the simulator will be available soon.")}>
                <Paperclip size={20} className="text-muted-foreground" />
              </Button>
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Address the bench or attach a document..."
                className="flex-1"
                disabled={isStreaming}
              />
              <Button type="submit" disabled={isStreaming || !inputValue.trim()}>
                Argue
              </Button>
            </form>`
);

fs.writeFileSync(file, content);
console.log("Updates applied successfully.");
