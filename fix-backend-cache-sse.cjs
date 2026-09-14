const fs = require('fs');

// 1. Update bench-pipeline.ts to handle caching
const pipelineFile = '/Users/macbook/Downloads/Alwakeelo/server/pipeline/bench-pipeline.ts';
let pipelineContent = fs.readFileSync(pipelineFile, 'utf8');

// Inject the raw SQL table creation and caching logic into buildJudgeDecisionProfile
const newBuildJudgeFunc = `export async function buildJudgeDecisionProfile(
  judgeName: string,
  config: { courtLevel: string; caseNature: string; proceedingStage: string; userBrief: string }
) {
  if (!dbAvailable || !db) return null;

  try {
    const { judgments, judgeCaseLinks } = await import("../../shared/schema.js");
    const { eq, ilike, desc, and, or, sql } = await import("drizzle-orm");

    // 1. Initialize Cache Table (Raw SQL bypasses migration issues)
    await db.execute(sql.raw(\`
      CREATE TABLE IF NOT EXISTS judge_profiles_cache (
        judge_name TEXT PRIMARY KEY,
        profile_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    \`));

    // 2. Check Cache
    const cacheRes = await db.execute(sql.raw(\`SELECT profile_data FROM judge_profiles_cache WHERE judge_name = '\${judgeName.replace(/'/g, "''")}'\`));
    if (cacheRes.rows.length > 0) {
      console.log(\`[BenchSimulator] Cache HIT for \${judgeName}\`);
      return cacheRes.rows[0].profile_data;
    }
    
    console.log(\`[BenchSimulator] Cache MISS for \${judgeName}. Building decision profile...\`);
    
    // Tier 1: Exact issue
    let cases = await db.select({
      id: judgments.id,
      citation: judgments.citationString,
      title: judgments.title,
      headnotes: judgments.headnotes,
    })
    .from(judgments)
    .innerJoin(judgeCaseLinks, eq(judgments.id, judgeCaseLinks.judgmentId))
    .where(
      and(
        ilike(judgeCaseLinks.judgeName, \`%\${judgeName}%\`),
        or(
          ilike(judgments.headnotes, \`%\${config.caseNature}%\`),
          ilike(judgments.headnotes, \`%\${config.proceedingStage.replace('_', ' ')}%\`)
        )
      )
    )
    .orderBy(desc(judgments.year))
    .limit(10);

    // Tier 2: Fallback
    if (!cases || cases.length < 3) {
      const generalCases = await db.select({
        id: judgments.id,
        citation: judgments.citationString,
        title: judgments.title,
        headnotes: judgments.headnotes,
      })
      .from(judgments)
      .innerJoin(judgeCaseLinks, eq(judgments.id, judgeCaseLinks.judgmentId))
      .where(ilike(judgeCaseLinks.judgeName, \`%\${judgeName}%\`))
      .orderBy(desc(judgments.year))
      .limit(10);
      
      const seen = new Set(cases.map((c: any) => c.id));
      for (const gc of generalCases) {
        if (!seen.has(gc.id)) {
          cases.push(gc);
          seen.add(gc.id);
        }
      }
      cases = cases.slice(0, 10);
    }

    if (!cases || cases.length === 0) {
      return {
        profileVersion: "1.1",
        generatedAt: new Date().toISOString(),
        evidenceJudgmentIds: [],
        confidence: "Low",
        profile: \`No specific prior rulings found for \${judgeName} in the indexed database.\`
      };
    }

    const confidence = cases.length >= 8 ? "High" : cases.length >= 4 ? "Medium" : "Low";
    const evidenceIds = cases.map((c: any) => c.id);
    const contextText = cases.map((c: any) => \`Citation: \${c.citation}\\nTitle: \${c.title}\\nRatio/Headnote: \${c.headnotes || "N/A"}\`).join("\\n\\n");

    const systemPrompt = \`Analyze the following extracted case headnotes and ratios involving Justice \${judgeName}.
Create a "Judicial Decision Profile" focused on observable decision patterns relevant to:
Court: \${config.courtLevel}, Nature: \${config.caseNature}, Stage: \${config.proceedingStage}.

Output the profile in Markdown format containing:
- Commonly relied-on statutes/principles
- Approach to interim relief & procedure
- Evidentiary preferences
- Strict vs liberal interpretation
- Recurring reasoning patterns

Keep it concise and highly professional. DO NOT analyze their psychology, focus on legal observable patterns.\`;

    let profileText = \`**Default Profile (Fallback):** \\nJustice \${judgeName} evaluates cases firmly on procedural compliance and statutory limits.\`;

    if (isOpenRouterAvailable()) {
      const { getClient } = await import("../openrouter-ai.js");
      const client = getClient();
      const model = process.env.BENCH_SIMULATOR_MODEL || "google/gemini-3-flash-preview";

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: \`Here are the cases:\\n\\n\${contextText}\\n\\nUser's Case Context:\\n\${config.userBrief}\` }
        ],
        temperature: 0.1,
        max_tokens: 1500
      });
      
      if (response.choices?.[0]?.message?.content) {
        profileText = response.choices[0].message.content;
      }
    }

    const finalProfile = {
      profileVersion: "1.1",
      generatedAt: new Date().toISOString(),
      evidenceJudgmentIds: evidenceIds,
      confidence,
      profile: profileText
    };

    // 3. Save to Cache
    try {
      await db.execute(sql.raw(\`
        INSERT INTO judge_profiles_cache (judge_name, profile_data) 
        VALUES ('\${judgeName.replace(/'/g, "''")}', '\${JSON.stringify(finalProfile).replace(/'/g, "''")}')
        ON CONFLICT (judge_name) DO UPDATE SET profile_data = EXCLUDED.profile_data, created_at = CURRENT_TIMESTAMP
      \`));
    } catch (e) {
      console.error("[BenchSimulator] Failed to save profile cache", e);
    }

    return finalProfile;
  } catch (error) {
    console.error("[BenchSimulator] Failed to build judge profile:", error);
    return null;
  }
}`;

const oldProfileFuncMatch = /export async function buildJudgeDecisionProfile\([\s\S]*?\} catch \(error\) \{[\s\S]*?return null;\n  \}\n\}/;
pipelineContent = pipelineContent.replace(oldProfileFuncMatch, newBuildJudgeFunc);
fs.writeFileSync(pipelineFile, pipelineContent);
console.log("bench-pipeline updated with Global Caching.");

// 2. Update bench-routes.ts to send SSE Status Updates
const routesFile = '/Users/macbook/Downloads/Alwakeelo/server/routes/bench-routes.ts';
let routesContent = fs.readFileSync(routesFile, 'utf8');

const sseStartMatch = /res\.setHeader\("Content-Type", "text\/event-stream"\);\n\s*res\.setHeader\("Cache-Control", "no-cache"\);\n\s*res\.setHeader\("Connection", "keep-alive"\);/;
routesContent = routesContent.replace(
  sseStartMatch,
  `res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    
    // Helper to send status updates
    const sendStatus = (statusMsg: string) => {
      res.write(\`data: \${JSON.stringify({ status: statusMsg })}\\n\\n\`);
    };`
);

// Inject status calls
routesContent = routesContent.replace(
  /let judgeProfileData = null;/g,
  `sendStatus("Loading Judge Persona...");\n      let judgeProfileData = null;`
);

routesContent = routesContent.replace(
  /const queries = await generateAdversarialQueries/g,
  `sendStatus("Identifying the disputed issues...");\n      const queries = await generateAdversarialQueries`
);

routesContent = routesContent.replace(
  /const hostileCases = await runAdversarialRAG/g,
  `sendStatus("Searching contrary authorities...");\n      const hostileCases = await runAdversarialRAG`
);

routesContent = routesContent.replace(
  /const inserted = await db\.insert/g,
  `sendStatus("Preparing the Bench...");\n      const inserted = await db.insert`
);

// We must also write the final prompt correctly since we removed counter brief
routesContent = routesContent.replace(
  /Attack Plan Strategy to use: \$\{JSON.stringify\(attackPlan\)\}/g,
  `Contrary Legal Authority to confront the user with:\n\${attackPlan}`
);

fs.writeFileSync(routesFile, routesContent);
console.log("bench-routes updated with SSE Status streaming and compressed prompt logic.");
