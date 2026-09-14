const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/server/routes/bench-routes.ts';
let content = fs.readFileSync(file, 'utf8');

// Add the import for buildJudgeDecisionProfile
if (!content.includes('buildJudgeDecisionProfile')) {
  content = content.replace(
    'generateAdversarialQueries, runAdversarialRAG, generateCounterBrief } from "../pipeline/bench-pipeline";',
    'generateAdversarialQueries, runAdversarialRAG, generateCounterBrief, buildJudgeDecisionProfile } from "../pipeline/bench-pipeline";'
  );
}

// Modify the logic block for session creation
const oldCreateBlock = `      const inserted = await db.insert(benchSessions).values({
        userId,
        courtLevel: config.courtLevel,
        caseNature: config.caseNature,
        proceedingStage: config.proceedingStage,
        userBrief: userMessage,
        attackPlan: attackPlan,
        status: "active"
      }).returning();`;

const newCreateBlock = `      let judgeProfileData = null;
      if (config.selectedJudgeName && config.selectedJudgeName.trim().length > 0) {
        judgeProfileData = await buildJudgeDecisionProfile(config.selectedJudgeName, { ...config, userBrief: userMessage });
      }

      const inserted = await db.insert(benchSessions).values({
        userId,
        courtLevel: config.courtLevel,
        caseNature: config.caseNature,
        proceedingStage: config.proceedingStage,
        selectedJudgeName: config.selectedJudgeName || null,
        judgeProfile: judgeProfileData,
        userBrief: userMessage,
        attackPlan: attackPlan,
        status: "active"
      }).returning();`;

if (content.includes(oldCreateBlock)) {
  content = content.replace(oldCreateBlock, newCreateBlock);
  console.log("Updated session creation.");
} else {
  console.log("Session creation block not found exactly as expected. Doing loose regex.");
  content = content.replace(
    /const inserted = await db\.insert\(benchSessions\)\.values\(\{[\s\S]*?status: "active"\s*\}\)\.returning\(\);/,
    newCreateBlock
  );
}

// Modify systemPrompt to inject the profile as Instructional Context (as recommended by ChatGPT)
const oldPrompt = 'const systemPrompt = `You are a strict Pakistani Judge.';
const newPrompt = `const systemPrompt = \`Role: Pakistani Judge Simulation.
Court Level: \${session.courtLevel}
Stage: \${session.proceedingStage}

The following evidence-derived decision profile describes recurring patterns found in the retrieved judgments for this judge/court.
Use these patterns when evaluating the advocate's arguments, but independently assess the facts and law in this simulation.
Do not fabricate quotations, authorities, or prior rulings.

\${session.judgeProfile?.profile ? "--- JUDICIAL DECISION PROFILE ---\\n" + session.judgeProfile.profile + "\\n----------------------------------" : "Standard strict procedural purist temperament."}

Attack Plan Strategy to use: \${JSON.stringify(attackPlan)}
Keep your responses authoritative, interrogative, and strictly focused on legal grounds.\`;`;

content = content.replace(
  /const systemPrompt = `You are a strict Pakistani Judge\.[\s\S]*?Keep your responses authoritative, interrogative, and strictly focused on legal grounds\.`;/,
  newPrompt
);

fs.writeFileSync(file, content);
console.log("bench-routes.ts patched.");
