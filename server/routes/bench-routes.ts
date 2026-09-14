import { Router, Request, Response } from "express";
import { isAuthenticated } from "../replit_integrations/auth/replitAuth";
import { db } from "../db";
import { benchSessions, benchMessages } from "../../shared/schema";
import { generateAdversarialQueries, runAdversarialRAG, buildJudgeDecisionProfile, evaluateAdvocateResponse, getStageProceduralDirectives } from "../pipeline/bench-pipeline";
import { getClient } from "../openrouter-ai";
import { eq, desc } from "drizzle-orm";
import { storage } from "../storage";
import { TIER_LIMITS } from "../../shared/schema";

const router = Router();

router.post("/simulate", isAuthenticated, async (req: any, res: Response) => {
  try {
    const { sessionId, userMessage, config, currentScore = 100 } = req.body;
    const userId = req.user.id;

    // --- ENFORCE SUBSCRIPTION TIER & QUOTA ---
    let userTier = process.env.TEST_MODE === '1' ? 'pro' : await storage.getUserTier(userId);
    const tier = userTier === "chamber" ? "chamber" : userTier === "enterprise" ? "enterprise" : userTier === "pro" ? "pro" : userTier === "free" ? "free" : "standard";

    if (tier === "free" || tier === "standard") {
      return res.status(403).json({ error: "Bench Simulator requires a Pro or Chamber subscription. Please upgrade your plan." });
    }

    const limits = TIER_LIMITS[tier] || TIER_LIMITS.standard;
    const usedThisMonth = await storage.getMonthlyUsageCount(userId);
    const actionsCost = !sessionId ? 15 : 2;

    if (process.env.TEST_MODE !== '1' && usedThisMonth + actionsCost > limits.monthlyQueries) {
      return res.status(429).json({ error: `Insufficient AI Actions. The simulator requires ${actionsCost} actions, but you have reached your ${limits.label} plan limit.` });
    }
    // -----------------------------------------

    let session;
    let attackPlan: string;
    let currentRound = 1;

    if (!sessionId) {
      // First round: set SSE headers and create session
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const sendStatus = (statusMsg: string) => {
        res.write(`data: ${JSON.stringify({ status: statusMsg })}\n\n`);
      };

      sendStatus("Loading Judge Persona...");
      let judgeProfileData: any = null;
      let profileText = "";
      if (config.selectedJudgeName?.trim()) {
        const p1 = await buildJudgeDecisionProfile(config.selectedJudgeName, { ...config, userBrief: userMessage });
        if (p1?.profile) {
          profileText += `Presiding Judge (${config.selectedJudgeName}):\n${p1.profile}\n\n`;
          judgeProfileData = p1;
          judgeProfileData.profile = profileText;
        }
      }
      if ((config.benchSize === 'division' || config.benchSize === 'full') && config.selectedJudgeName2?.trim()) {
        const p2 = await buildJudgeDecisionProfile(config.selectedJudgeName2, { ...config, userBrief: userMessage });
        if (p2?.profile) {
          profileText += `Second Judge (${config.selectedJudgeName2}):\n${p2.profile}\n\n`;
          if (judgeProfileData) {
            judgeProfileData.profile = profileText;
            judgeProfileData.evidenceJudgmentIds = [...new Set([...(judgeProfileData.evidenceJudgmentIds || []), ...(p2.evidenceJudgmentIds || [])])];
          } else {
            judgeProfileData = p2;
            judgeProfileData.profile = profileText;
          }
        }
      }
      sendStatus("Identifying the disputed issues...");
      const queries = await generateAdversarialQueries(userMessage, { ...config, judgeProfile: judgeProfileData });
      const flatQueries = [queries.proceduralBar, queries.statutoryException, queries.contraryPrecedent];
      sendStatus("Searching contrary authorities...");
      const hostileCases = await runAdversarialRAG(flatQueries);
      // COMPRESSION: Skip Attack Plan LLM. Format hostile cases as compact evidence snippets directly.
      attackPlan = hostileCases.length > 0 
        ? hostileCases.map(c => `Citation: ${c.citation}\nRule: ${c.summary?.substring(0, 300) || "N/A"}`).join("\n\n")
        : "No directly hostile precedent found. Rely on general statutory principles.";

      sendStatus("Preparing the Bench...");
      const inserted = await db.insert(benchSessions).values({
        userId,
        courtLevel: config.courtLevel,
        caseNature: config.caseNature,
        proceedingStage: config.proceedingStage,
        selectedJudgeName: config.selectedJudgeName || null,
        selectedJudgeName2: config.selectedJudgeName2 || null,
        benchSize: config.benchSize || 'single',
        judgeProfile: judgeProfileData,
        userBrief: userMessage,
        attackPlan: { compactEvidence: attackPlan } as any,
        status: "active"
      }).returning();
      session = inserted[0];

      // Save user message
      await db.insert(benchMessages).values({
        sessionId: session.id,
        roundIndex: 1,
        speakerRole: "user",
        content: userMessage
      });
    } else {
      // Existing session: validate BEFORE setting SSE headers
      const sessions = await db.select().from(benchSessions).where(eq(benchSessions.id, sessionId));
      if (!sessions.length) return res.status(404).json({ error: "Session not found" });
      session = sessions[0];
      if (session.userId !== userId) return res.status(403).json({ error: "Not your session" });
      attackPlan = (session.attackPlan as any)?.compactEvidence || JSON.stringify(session.attackPlan) || "";

      // Now safe to set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Save user message
      const msgs = await db.select().from(benchMessages).where(eq(benchMessages.sessionId, session.id));
      currentRound = Math.floor(msgs.length / 2) + 1;

      if (currentRound > 5) {
        return res.status(400).json({ error: "Session ended. Maximum 5 rounds reached." });
      }

      await db.insert(benchMessages).values({
        sessionId: session.id,
        roundIndex: currentRound,
        speakerRole: "user",
        content: userMessage
      });
    }

    // Now RAG and Stream
    const client = getClient();
    const model = process.env.BENCH_SIMULATOR_MODEL || "google/gemini-3-flash-preview";

    // Send sessionId so the client can keep track of it
    res.write(`data: ${JSON.stringify({ sessionId: session.id, judgeProfile: session.judgeProfile })}\n\n`);

    // Get history
    const history = await db.select().from(benchMessages)
      .where(eq(benchMessages.sessionId, session.id))
      .orderBy(benchMessages.createdAt);
      
    // Map speaker role correctly: user->user, judge/opposing_counsel->assistant
    const messages = history.map((h: any) => ({ 
      role: h.speakerRole === "user" ? "user" : "assistant", 
      content: h.content 
    })) as Array<{role: 'user' | 'assistant', content: string}>;

    const stageDirectives = getStageProceduralDirectives(session.proceedingStage as any);

    const systemPrompt = `Role: Pakistani Judge Simulation.
Court Level: ${session.courtLevel}
Stage: ${session.proceedingStage}
Bench Type: ${session.benchSize === 'division' ? 'Division Bench (2 Judges)' : session.benchSize === 'full' ? 'Full Bench (3+ Judges)' : 'Single Bench (1 Judge)'}
Stage Statutory Framework: ${stageDirectives.statutoryFramework}
Stage Legal Directives:
${stageDirectives.keyDirectives.map((d: string) => `- ${d}`).join("\n")}

The following evidence-derived decision profile describes recurring patterns found in the retrieved judgments for this judge/court.
Use these patterns when evaluating the advocate's arguments, but independently assess the facts and law in this simulation.
Do not fabricate quotations, authorities, or prior rulings.

${session.judgeProfile?.profile ? "--- JUDICIAL DECISION PROFILE ---\n" + session.judgeProfile.profile + "\n----------------------------------" : "Standard strict procedural purist temperament."}

Contrary Legal Authority to confront the user with:
${attackPlan}
Keep your responses authoritative, interrogative, and strictly focused on legal grounds.`;

    const stream = await client.chat.completions.create({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true
    });

    let fullResponse = "";
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    // Save AI message
    await db.insert(benchMessages).values({
      sessionId: session.id,
      roundIndex: currentRound,
      speakerRole: "judge",
      content: fullResponse
    });

    // Deduct AI Actions based on Weighted Cost
    for (let i = 0; i < actionsCost; i++) {
      // 1 log entry = 1 AI Action consumed in the overall budget
      await storage.logUsageCost(userId, "bench-simulator", 100, 100, 0);
    }

    // Trigger an async evaluation of the round to update score
    try {
      const lastQuestion = history.filter((h: any) => h.speakerRole === "judge").pop()?.content || "Opening argument";
      const evalResult = await evaluateAdvocateResponse({
        userArgument: userMessage,
        currentQuestion: lastQuestion,
        expectedDefense: attackPlan,
        courtLevel: session.courtLevel,
        currentScore: currentScore
      });
      res.write(`data: ${JSON.stringify({ evaluation: evalResult })}\n\n`);
    } catch (evalErr) {
      console.error("Evaluation error:", evalErr);
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err: any) {
    console.error("Bench simulation error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
});



router.get("/history", isAuthenticated, async (req: any, res: Response) => {
  try {
    const sessions = await db.select().from(benchSessions)
      .where(eq(benchSessions.userId, req.user.id))
      .orderBy(desc(benchSessions.createdAt))
      .limit(20);
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/history/:id", isAuthenticated, async (req: any, res: Response) => {
  try {
    const session = await db.select().from(benchSessions)
      .where(eq(benchSessions.id, parseInt(req.params.id)));
    if (!session.length || session[0].userId !== req.user.id) {
      return res.status(404).json({ error: "Not found" });
    }
    const messages = await db.select().from(benchMessages)
      .where(eq(benchMessages.sessionId, session[0].id))
      .orderBy(benchMessages.createdAt);
    res.json({ session: session[0], messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
export default router;
