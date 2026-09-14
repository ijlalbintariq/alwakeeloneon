const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/client/src/pages/bench-simulator.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '  const handleStartSession = () => {',
  `  const handleReset = () => {
    if (confirm("Are you sure you want to end this session and reset the simulator?")) {
      setSessionActive(false);
      setSessionId(null);
      setMessages([]);
      setRound(1);
      setScore(100);
    }
  };

  const handleStartSession = () => {`
);

fs.writeFileSync(file, content);
console.log("Reset function added.");
