import fetch from "node-fetch";

async function run() {
  console.log("Starting Live API Test...");
  const userMessage = "My client seeks post-arrest bail in a white-collar NAB reference. We rely on the statutory delay ground under Section 497(1) third proviso CrPC, as well as the Supreme Court's equitable jurisdiction.";
  const config = {
    courtLevel: "Supreme Court",
    caseNature: "Criminal",
    proceedingStage: "Post-Arrest Bail",
    selectedJudgeName: ""
  };

  const response = await fetch("http://localhost:3000/api/bench/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userMessage, config, currentScore: 100 })
  });

  if (!response.ok) {
    console.error("HTTP Error", response.status, await response.text());
    return;
  }

  const body = response.body;
  if (!body) return;

  console.log("Stream connected! Reading...");
  body.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6);
        if (dataStr === '[DONE]') {
          console.log("\n\n[DONE] Stream completed.");
          return;
        }
        try {
          const data = JSON.parse(dataStr);
          if (data.status) process.stdout.write(`[STATUS] ${data.status}\n`);
          if (data.text) process.stdout.write(data.text);
          if (data.evaluation) console.log(`\n\n[SCORE EVALUATION RECEIVED]: ${JSON.stringify(data.evaluation)}`);
        } catch(e) {}
      }
    }
  });

  body.on('end', () => {
    process.exit(0);
  });
}
run();
