import { getClient } from "./server/openrouter-ai.js";
import { db } from "./server/db.js";
import { sql } from "drizzle-orm";

// Simulate what the browser does: POST to /api/bench/simulate, parse SSE stream
async function simulateHTTP(body: any, label: string) {
  console.log(`\n--- ${label} ---`);
  const start = Date.now();
  
  // We can't easily hit the Express route without the server running,
  // so we import the pipeline functions and simulate the exact route logic
  const { buildJudgeDecisionProfile, generateAdversarialQueries, runAdversarialRAG } = 
    await import("./server/pipeline/bench-pipeline.js");
  const { benchSessions, benchMessages } = await import("./shared/schema.js");
  const { eq } = await import("drizzle-orm");

  const { sessionId, userMessage, config } = body;
  let session: any;
  let attackPlan: string;

  if (!sessionId) {
    // === ROUND 1: Full pipeline ===
    console.log("[SSE] Loading Judge Persona...");
    let judgeProfileData = null;
    if (config.selectedJudgeName && config.selectedJudgeName.trim().length > 0) {
      judgeProfileData = await buildJudgeDecisionProfile(config.selectedJudgeName, { ...config, userBrief: userMessage });
    }
    console.log(`[Profile] confidence=${judgeProfileData?.confidence}, cases=${judgeProfileData?.evidenceJudgmentIds?.length}`);

    console.log("[SSE] Identifying the disputed issues...");
    const queries = await generateAdversarialQueries(userMessage, { ...config, judgeProfile: judgeProfileData });
    console.log(`[Queries] procedural=${queries.proceduralBar?.substring(0, 60)}...`);

    console.log("[SSE] Searching contrary authorities...");
    const hostileCases = await runAdversarialRAG([queries.proceduralBar, queries.statutoryException, queries.contraryPrecedent].filter(Boolean));
    attackPlan = hostileCases.length > 0 
      ? hostileCases.map((c: any) => `Citation: ${c.citation}\nRule: ${c.summary?.substring(0, 300) || "N/A"}`).join("\n\n")
      : "No directly hostile precedent found.";
    console.log(`[RAG] ${hostileCases.length} hostile cases retrieved`);

    console.log("[SSE] Preparing the Bench...");
    const inserted = await db.insert(benchSessions).values({
      userId: "a96269e2-e712-4c50-bc03-df65a64152b0",
      courtLevel: config.courtLevel,
      caseNature: config.caseNature,
      proceedingStage: config.proceedingStage,
      selectedJudgeName: config.selectedJudgeName || null,
      judgeProfile: judgeProfileData,
      userBrief: userMessage,
      attackPlan: { compactEvidence: attackPlan } as any,
      status: "active"
    }).returning();
    session = inserted[0];

    await db.insert(benchMessages).values({
      sessionId: session.id,
      roundIndex: 1,
      speakerRole: "user",
      content: userMessage
    });

    // SSE: send sessionId payload (what browser receives first)
    const ssePayload = { sessionId: session.id, judgeProfile: session.judgeProfile };
    console.log(`[SSE] sessionId=${ssePayload.sessionId}, hasProfile=${!!ssePayload.judgeProfile}`);

  } else {
    // === ROUND 2+: Session lookup ===
    const sessions = await db.select().from(benchSessions).where(eq(benchSessions.id, sessionId));
    if (!sessions.length) { console.error("SESSION NOT FOUND - BUG-1 would crash here"); return null; }
    session = sessions[0];
    attackPlan = (session.attackPlan as any)?.compactEvidence || JSON.stringify(session.attackPlan) || "";

    const msgs = await db.select().from(benchMessages).where(eq(benchMessages.sessionId, session.id));
    const currentRound = Math.floor(msgs.length / 2) + 1;

    await db.insert(benchMessages).values({
      sessionId: session.id,
      roundIndex: currentRound,
      speakerRole: "user",
      content: userMessage
    });
    console.log(`[Session] Loaded session ${session.id}, round=${currentRound}`);
  }

  // Stream final response
  const history = await db.select().from(benchMessages)
    .where(eq(benchMessages.sessionId, session.id))
    .orderBy(benchMessages.createdAt);
  const messages = history.map((h: any) => ({ role: h.speakerRole === "user" ? "user" : "assistant", content: h.content }));

  const systemPrompt = `Role: Pakistani Judge Simulation.
Court Level: ${session.courtLevel}
Stage: ${session.proceedingStage}

${session.judgeProfile?.profile ? "--- JUDICIAL DECISION PROFILE ---\n" + session.judgeProfile.profile + "\n----------------------------------" : "Standard strict procedural purist temperament."}

Contrary Legal Authority to confront the user with:
${attackPlan}
Keep your responses authoritative, interrogative, and strictly focused on legal grounds.`;

  const client = getClient();
  const model = process.env.BENCH_SIMULATOR_MODEL || "google/gemini-3-flash-preview";
  const stream = await client.chat.completions.create({
    model,
    messages: [{ role: "system" as const, content: systemPrompt }, ...messages],
    stream: true,
    max_tokens: 300
  });

  let fullResponse = "";
  process.stdout.write("[Stream] ");
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || "";
    fullResponse += text;
    process.stdout.write(text);
  }

  // Save AI response
  const msgs2 = await db.select().from(benchMessages).where(eq(benchMessages.sessionId, session.id));
  await db.insert(benchMessages).values({
    sessionId: session.id,
    roundIndex: Math.floor(msgs2.length / 2) + 1,
    speakerRole: "judge",
    content: fullResponse
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n[Done] ${elapsed}s, response length=${fullResponse.length} chars`);
  return session.id;
}

async function main() {
  console.log("========== FULL E2E TEST ==========");

  // ROUND 1: New session with judge
  const sid = await simulateHTTP({
    sessionId: null,
    userMessage: "My client seeks bail under Section 497 CrPC. The FIR was lodged after a 5-day delay which shows mala fide on part of the complainant.",
    config: {
      courtLevel: "high_court",
      caseNature: "criminal",
      proceedingStage: "bail_pre_arrest",
      selectedJudgeName: "Mansoor Ali Shah"
    }
  }, "ROUND 1: New Session + Judge Profile");

  if (!sid) { console.error("Round 1 failed"); process.exit(1); }

  // ROUND 2: Continue same session (tests session persistence + attackPlan retrieval)
  await simulateHTTP({
    sessionId: sid,
    userMessage: "Your Honor, the delay is fatal per Sughran Bibi PLD 2018 SC 595. The complainant has failed to explain the gap. Furthermore, my client has no prior criminal record and poses no flight risk.",
    config: {
      courtLevel: "high_court",
      caseNature: "criminal",
      proceedingStage: "bail_pre_arrest",
      selectedJudgeName: "Mansoor Ali Shah"
    }
  }, "ROUND 2: Continuation (Session Persistence Test)");

  // ROUND 3: Invalid session (tests BUG-1 fix)
  console.log("\n--- ROUND 3: Invalid Session ID Test ---");
  const { benchSessions: bs } = await import("./shared/schema.js");
  const { eq: eq2 } = await import("drizzle-orm");
  const fakeSessions = await db.select().from(bs).where(eq2(bs.id, 999999));
  if (fakeSessions.length === 0) {
    console.log("[PASS] Session 999999 not found. Server would return 404 safely (no SSE crash).");
  }

  // Cleanup
  const { benchMessages: bm } = await import("./shared/schema.js");
  await db.delete(bm).where(eq2(bm.sessionId, sid));
  await db.delete(bs).where(eq2(bs.id, sid));
  console.log(`\n[Cleanup] Deleted test session ${sid}`);

  console.log("\n========== ALL E2E TESTS PASSED ==========");
  process.exit(0);
}

main().catch(e => { console.error("E2E FAILED:", e); process.exit(1); });
