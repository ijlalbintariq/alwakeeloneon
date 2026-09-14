const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/server/pipeline/bench-pipeline.ts';
let content = fs.readFileSync(file, 'utf8');

const profileFunc = `
export async function buildJudgeDecisionProfile(
  judgeName: string,
  config: { courtLevel: string; caseNature: string; proceedingStage: string; userBrief: string }
) {
  if (!dbAvailable || !db) return null;

  try {
    const { judgments, judgeCaseLinks } = await import("../../shared/schema.js");
    const { eq, ilike, desc } = await import("drizzle-orm");

    console.log(\`[BenchSimulator] Building decision profile for \${judgeName}...\`);
    
    // Tiered Retrieval fallback
    // 1. Fetch 10 most recent cases for this specific judge
    const cases = await db.select({
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
    const evidenceIds = cases.map(c => c.id);
    
    // Build context chunks (Headnotes to save tokens)
    const contextText = cases.map(c => \`Citation: \${c.citation}\\nTitle: \${c.title}\\nRatio/Headnote: \${c.headnotes || "N/A"}\`).join("\\n\\n");

    const systemPrompt = \`Analyze the following extracted case headnotes and ratios authored by Justice \${judgeName}.
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
      const { getClient } = await import("./llm.js");
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
}
`;

if (!content.includes('export async function buildJudgeDecisionProfile')) {
  content = content.replace('export async function generateAttackPlan', profileFunc + '\nexport async function generateAttackPlan');
  fs.writeFileSync(file, content);
  console.log("Judge Decision Profile function injected into pipeline.");
} else {
  console.log("Function already exists.");
}
