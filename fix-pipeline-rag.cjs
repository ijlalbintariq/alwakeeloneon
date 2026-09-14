const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/server/pipeline/bench-pipeline.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Rewrite buildJudgeDecisionProfile for Multi-tier retrieval
const oldProfileFuncMatch = /export async function buildJudgeDecisionProfile\([\s\S]*?\} catch \(error\) \{[\s\S]*?return null;\n  \}\n\}/;

const newProfileFunc = `export async function buildJudgeDecisionProfile(
  judgeName: string,
  config: { courtLevel: string; caseNature: string; proceedingStage: string; userBrief: string }
) {
  if (!dbAvailable || !db) return null;

  try {
    const { judgments, judgeCaseLinks } = await import("../../shared/schema.js");
    const { eq, ilike, desc, and, or } = await import("drizzle-orm");

    console.log(\`[BenchSimulator] Building decision profile for \${judgeName}...\`);
    
    // Multi-Tier Retrieval (Issue + Judge)
    // Tier 1: Exact issue (matches court level or case nature keywords in headnotes/title)
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

    // Tier 2: Fallback to general jurisprudence if < 3 cases found
    if (!cases || cases.length < 3) {
      console.log(\`[BenchSimulator] Tier 1 sparse (\${cases?.length || 0} cases). Falling back to Tier 2 (General Jurisprudence)...\`);
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
      
      // Merge unique
      const seen = new Set(cases.map(c => c.id));
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
        profileVersion: "1.0",
        generatedAt: new Date().toISOString(),
        evidenceJudgmentIds: [],
        confidence: "Low",
        profile: \`No specific prior rulings found for \${judgeName} in the indexed database.\`
      };
    }

    const confidence = cases.length >= 8 ? "High" : cases.length >= 4 ? "Medium" : "Low";
    const evidenceIds = cases.map((c: any) => c.id);
    
    // Build context chunks (Headnotes to save tokens)
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

    return {
      profileVersion: "1.0",
      generatedAt: new Date().toISOString(),
      evidenceJudgmentIds: evidenceIds,
      confidence,
      profile: profileText
    };
  } catch (error) {
    console.error("[BenchSimulator] Failed to build judge profile:", error);
    return null;
  }
}`;

if (oldProfileFuncMatch.test(content)) {
  content = content.replace(oldProfileFuncMatch, newProfileFunc);
} else {
  console.log("Could not find buildJudgeDecisionProfile to replace!");
}

// 2. Inject Judge Profile into generateAdversarialQueries
const advQueriesRegex = /export async function generateAdversarialQueries\(\s*userArgument: string,\s*context: BenchContext\s*\): Promise<AdversarialQueries> \{[\s\S]*?const systemPrompt = `You are a strict Judge and Opposing Counsel in a Pakistani court simulator\.[\s\S]*?Stage: \$\{context\.proceedingStage\}/;

const newAdvQueriesStart = `export async function generateAdversarialQueries(
  userArgument: string,
  context: BenchContext & { judgeProfile?: any }
): Promise<AdversarialQueries> {
  if (isOpenRouterAvailable()) {
    try {
      const client = getClient();
      const model = process.env.BENCH_SIMULATOR_MODEL || "google/gemini-3-flash-preview";

      const profileInjection = context.judgeProfile?.profile 
        ? \`\\nAdopt this Judicial Decision Profile when searching for vulnerabilities:\\n\${context.judgeProfile.profile}\\n\` 
        : "";

      const systemPrompt = \`You are a strict Judge and Opposing Counsel in a Pakistani court simulator.
Generate adversarial search queries to attack the user's argument.\${profileInjection}
Context:
Court Level: \${context.courtLevel}
Case Nature: \${context.caseNature}
Stage: \${context.proceedingStage}`;

if (advQueriesRegex.test(content)) {
  content = content.replace(advQueriesRegex, newAdvQueriesStart);
} else {
  console.log("Could not find generateAdversarialQueries to replace!");
}

fs.writeFileSync(file, content);
console.log("bench-pipeline updated with multi-tier RAG and query injection.");
