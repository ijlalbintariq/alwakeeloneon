import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateAttackPlan,
  resolveJudgePersona,
  buildAttackPlanPrompt,
  extractJsonFromResponse,
  getDeterministicFallbackAttackPlan,
  retrieveHostileCaseLaw,
  filterOutOverruledCases,
  isKnownOverruled,
  normalizeCitationString,
  KNOWN_OVERRULED_CATALOG,
  OFFLINE_HOSTILE_PRECEDENTS,
  synthesizeCounterBrief,
  evaluateAdvocateResponse,
  generatePostSessionReport,
  generateAdversarialQueries,
  runAdversarialRAG,
  generateCounterBrief,
  type BenchContext,
  type HostilePrecedent,
} from "../../server/pipeline/bench-pipeline";
import {
  hiddenAttackPlanSchema,
  counterBriefSchema,
  turnEvaluationSchema,
  postSessionReportSchema,
  scoreBreakdownSchema,
  type BenchSession,
  type BenchMessage,
  type CaseLaw,
} from "@shared/schema";

describe("Milestone 2: Adversarial Retrieval Pipeline Unit Tests", () => {

  // ── 1. Attack Plan & Persona Generator ─────────────────────────────────────
  describe("generateAttackPlan & Persona Generator", () => {
    it("resolves the correct Judge Persona for each case nature and court level", () => {
      const constitutional = resolveJudgePersona("high_court", "constitutional", "preliminary_hearing");
      assert.strictEqual(constitutional.id, "constitutional_inquisitor");
      assert.ok(constitutional.name.includes("Constitutional"));
      assert.ok(constitutional.demeanorDirectives.length > 0);

      const corporate = resolveJudgePersona("high_court", "corporate", "final_arguments");
      assert.strictEqual(corporate.id, "commercial_textualist");
      assert.ok(corporate.name.includes("Commercial"));

      const criminal = resolveJudgePersona("district_sessions", "criminal", "preliminary_hearing");
      assert.strictEqual(criminal.id, "evidentiary_sceptic");
      assert.ok(criminal.name.includes("Evidentiary"));

      const civilDistrict = resolveJudgePersona("district_sessions", "civil", "framing_of_issues");
      assert.strictEqual(civilDistrict.id, "procedural_purist");
      assert.ok(civilDistrict.name.includes("Procedural"));

      const appellate = resolveJudgePersona("supreme_court", "civil", "final_arguments");
      assert.strictEqual(appellate.id, "appellate_traditionalist");
      assert.ok(appellate.name.includes("Appellate"));
    });

    it("builds court-specific attack prompts with necessary Pakistani legal doctrine", () => {
      const persona = resolveJudgePersona("high_court", "constitutional", "preliminary_hearing");
      const { systemPrompt, userPrompt } = buildAttackPlanPrompt(
        {
          courtLevel: "high_court",
          caseNature: "constitutional",
          proceedingStage: "preliminary_hearing",
          userBrief: "Challenging administrative order under Article 199 without filing statutory appeal.",
        },
        persona
      );

      assert.ok(systemPrompt.includes("Pakistani Legal System"));
      assert.ok(systemPrompt.includes("Article 199"));
      assert.ok(systemPrompt.includes("Limitation Act 1908"));
      assert.ok(userPrompt.includes("Challenging administrative order"));
    });

    it("extractJsonFromResponse cleans markdown code blocks and balanced braces", () => {
      const rawMarkdown = "```json\n{\n  \"strategySummary\": \"Test Strategy\"\n}\n```";
      const cleaned = extractJsonFromResponse(rawMarkdown);
      assert.strictEqual(cleaned, '{\n  "strategySummary": "Test Strategy"\n}');

      const messy = 'Some text before {"a": 1, "b": 2} and after';
      assert.strictEqual(extractJsonFromResponse(messy), '{"a": 1, "b": 2}');
    });

    it("getDeterministicFallbackAttackPlan produces schema-valid plan across case natures", () => {
      const natures = ["constitutional", "criminal", "corporate", "civil"] as const;

      for (const nature of natures) {
        const persona = resolveJudgePersona("high_court", nature, "preliminary_hearing");
        const plan = getDeterministicFallbackAttackPlan(
          {
            courtLevel: "high_court",
            caseNature: nature,
            proceedingStage: "preliminary_hearing",
            userBrief: `Test brief for ${nature} matter.`,
          },
          persona
        );

        const validated = hiddenAttackPlanSchema.safeParse(plan);
        assert.ok(validated.success, `Fallback plan for ${nature} must validate against hiddenAttackPlanSchema: ${JSON.stringify(validated.error)}`);
        assert.strictEqual(plan.rounds.length, 5, "Plan must contain exactly 5 rounds");
        assert.ok(plan.vulnerabilities.length >= 2, "Plan must identify at least 2 procedural vulnerabilities");
        assert.ok(plan.vulnerabilities.some(v => v.severity === "fatal"), "Must identify at least 1 fatal vulnerability");
        assert.ok(plan.primaryHostileThemes.length > 0, "Must contain hostile themes");
        assert.ok(Array.isArray(plan.courtDemeanorDirectives) && plan.courtDemeanorDirectives.length > 0, "Must contain demeanor directives");
      }
    });

    it("generateAttackPlan produces a valid HiddenAttackPlan under offline conditions", async () => {
      const plan = await generateAttackPlan({
        courtLevel: "supreme_court",
        caseNature: "constitutional",
        proceedingStage: "preliminary_hearing",
        userBrief: "The petitioner seeks leave to appeal against the High Court judgment upholding tax assessment without hearing.",
      });

      const validated = hiddenAttackPlanSchema.safeParse(plan);
      assert.ok(validated.success, "generateAttackPlan output must be valid HiddenAttackPlan");
      assert.strictEqual(plan.rounds.length, 5, "Must have 5 rounds");
      assert.ok(plan.strategySummary.length > 0);
      assert.ok(plan.vulnerabilities.length > 0);
    });
  });

  // ── 2. Dual-Layer Overruled Precedent Filter ──────────────────────────────
  describe("Strict Overruled Filter & Catalog Enforcement", () => {
    it("normalizeCitationString handles variations of punctuation and spacing", () => {
      assert.strictEqual(normalizeCitationString("PLD 1955 FC 240"), "pld 1955 fc 240");
      assert.strictEqual(normalizeCitationString("1955  P.L.D. - 240 (F.C.)"), "1955 p l d 240 f c");
      assert.strictEqual(normalizeCitationString("2018 SCMR 595"), "2018 scmr 595");
      assert.strictEqual(normalizeCitationString(""), "");
    });

    it("isKnownOverruled detects landmark overruled precedents across all variations", () => {
      // 1. Maulvi Tamizuddin Khan (PLD 1955 FC 240)
      assert.strictEqual(isKnownOverruled("PLD 1955 FC 240"), true);
      assert.strictEqual(isKnownOverruled("1955 PLD 240 FC"), true);
      assert.strictEqual(isKnownOverruled("PLD 1955 FC 240", "Federation of Pakistan v. Maulvi Tamizuddin Khan"), true);
      assert.strictEqual(isKnownOverruled("Some Unreported Order", "Maulvi Tamizuddin Khan Case"), true);

      // 2. State v. Dosso (PLD 1958 SC 533)
      assert.strictEqual(isKnownOverruled("PLD 1958 SC 533"), true);
      assert.strictEqual(isKnownOverruled("1958 PLD 533 SC"), true);
      assert.strictEqual(isKnownOverruled("PLD 1958 SC 533", "State v. Dosso"), true);

      // 3. Begum Nusrat Bhutto (PLD 1977 SC 657)
      assert.strictEqual(isKnownOverruled("PLD 1977 SC 657"), true);
      assert.strictEqual(isKnownOverruled("PLD 1977 SC 657", "Begum Nusrat Bhutto v. Chief of Army Staff"), true);

      // 4. Zafar Ali Shah (PLD 2000 SC 869)
      assert.strictEqual(isKnownOverruled("PLD 2000 SC 869"), true);
      assert.strictEqual(isKnownOverruled("PLD 2000 SC 869", "Zafar Ali Shah v. Pervez Musharraf"), true);

      // 5. Valid Good Law cases must NOT be flagged as overruled
      assert.strictEqual(isKnownOverruled("PLD 2018 SC 595", "Sughran Bibi v. The State"), false);
      assert.strictEqual(isKnownOverruled("2022 SCMR 1422", "Muhammad Riaz v. The State"), false);
      assert.strictEqual(isKnownOverruled("2013 SCMR 1307", "Liaqat Ali Chughtai v. Federation"), false);
      assert.strictEqual(isKnownOverruled("PLD 1958 SC 437", "Tariq Transport Co."), false);
    });

    it("filterOutOverruledCases cleanly separates overruled candidates from good-law precedents", async () => {
      const candidates = [
        "PLD 1955 FC 240", // Overruled (Tamizuddin Khan)
        "PLD 1958 SC 533", // Overruled (Dosso)
        "PLD 1977 SC 657", // Overruled (Nusrat Bhutto)
        "PLD 2000 SC 869", // Overruled (Zafar Ali Shah)
        "PLD 2018 SC 595", // Valid (Sughran Bibi)
        "2013 SCMR 1307",  // Valid (Liaqat Ali Chughtai)
        "2022 SCMR 1422",  // Valid (Muhammad Riaz)
      ];

      const result = await filterOutOverruledCases(candidates);

      assert.ok(result.overruledCitations.includes("PLD 1955 FC 240"), "Tamizuddin Khan must be in overruledCitations");
      assert.ok(result.overruledCitations.includes("PLD 1958 SC 533"), "Dosso must be in overruledCitations");
      assert.ok(result.overruledCitations.includes("PLD 1977 SC 657"), "Nusrat Bhutto must be in overruledCitations");
      assert.ok(result.overruledCitations.includes("PLD 2000 SC 869"), "Zafar Ali Shah must be in overruledCitations");

      assert.ok(result.cleanCitations.includes("PLD 2018 SC 595"), "Sughran Bibi must be in cleanCitations");
      assert.ok(result.cleanCitations.includes("2013 SCMR 1307"), "Liaqat Ali Chughtai must be in cleanCitations");
      assert.ok(result.cleanCitations.includes("2022 SCMR 1422"), "Muhammad Riaz must be in cleanCitations");

      // Verify no intersection
      for (const clean of result.cleanCitations) {
        assert.ok(!result.overruledCitations.includes(clean), `Clean citation ${clean} must not appear in overruledCitations`);
      }
    });

    it("retrieveHostileCaseLaw NEVER returns overruled cases under any query", async () => {
      // Direct adversarial trap: query specifically mentioning Tamizuddin Khan and dissolution
      const hostileCases = await retrieveHostileCaseLaw("Tamizuddin Khan Governor General assembly dissolution necessity", "supreme_court", 10);

      assert.ok(hostileCases.length > 0, "Must return hostile cases");
      for (const c of hostileCases) {
        assert.strictEqual(c.isOverruled, false, `Case ${c.citation} must have isOverruled === false`);
        assert.ok(!isKnownOverruled(c.citation, c.title), `Case ${c.citation} must NOT match known overruled catalog`);
        assert.ok(!c.citation.toLowerCase().includes("1955 fc 240"), "Must strictly exclude PLD 1955 FC 240");
      }
    });

    it("retrieveHostileCaseLaw accepts array query and respects limit parameter", async () => {
      const queries = ["delay in FIR", "negotiations between parties", "Section 154 CrPC"];
      const cases = await retrieveHostileCaseLaw(queries, "high_court", 3);

      assert.ok(cases.length <= 3, `Returned count (${cases.length}) should not exceed limit 3`);
      assert.ok(cases.length >= 1, "Should return at least 1 case");
      assert.strictEqual(cases.every(c => c.isOverruled === false), true);
    });

    it("runAdversarialRAG compatibility wrapper returns valid CaseLaw array with isOverruled=false", async () => {
      const queries = ["limitation bar Section 3", "laches alternate remedy"];
      const cases = await runAdversarialRAG(queries);

      assert.ok(Array.isArray(cases), "runAdversarialRAG must return an array");
      assert.ok(cases.length > 0, "Must return at least 1 case");
      for (const c of cases) {
        assert.strictEqual(c.isOverruled, false, `Case ${c.citation} must have isOverruled === false`);
        assert.ok(c.citation.length > 0);
        assert.ok(c.title.length > 0);
      }
    });
  });

  // ── 3. Opposing Counsel Counter-Brief Synthesizer ─────────────────────────
  describe("synthesizeCounterBrief", () => {
    it("synthesizes valid CounterBrief matching schema with non-empty preliminary objections and zero overruled cases", async () => {
      const persona = resolveJudgePersona("high_court", "constitutional", "preliminary_hearing");
      const attackPlan = getDeterministicFallbackAttackPlan(
        {
          courtLevel: "high_court",
          caseNature: "constitutional",
          proceedingStage: "preliminary_hearing",
          userBrief: "Challenging departmental transfer under Article 199 without invoking Service Tribunal.",
        },
        persona
      );

      const hostilePrecedents = await retrieveHostileCaseLaw("Article 199 alternate remedy Service Tribunal", "high_court", 3);

      const counterBrief = await synthesizeCounterBrief({
        attackPlan,
        userBrief: "Challenging departmental transfer under Article 199 without invoking Service Tribunal.",
        hostilePrecedents,
      });

      const validated = counterBriefSchema.safeParse(counterBrief);
      assert.ok(validated.success, `CounterBrief must validate against counterBriefSchema: ${JSON.stringify(validated.error)}`);

      assert.ok(counterBrief.preliminaryObjections.length > 0, "Must contain preliminary objections");
      assert.ok(counterBrief.statutoryBars.length > 0, "Must contain statutory bars");
      assert.ok(counterBrief.hostilePrecedents.length > 0, "Must contain hostile precedents");
      assert.ok(counterBrief.rebuttalStrategy.length > 0, "Must contain rebuttal strategy");

      // Verify strict isOverruled: false
      for (const p of counterBrief.hostilePrecedents) {
        assert.strictEqual(p.isOverruled, false, `Precedent ${p.citation} in CounterBrief must have isOverruled === false`);
        assert.ok(!isKnownOverruled(p.citation, p.title), `Precedent ${p.citation} must not be in known overruled catalog`);
      }
    });

    it("synthesizeCounterBrief purges any overruled precedent if accidentally injected", async () => {
      const persona = resolveJudgePersona("high_court", "constitutional", "preliminary_hearing");
      const attackPlan = getDeterministicFallbackAttackPlan(
        {
          courtLevel: "high_court",
          caseNature: "constitutional",
          proceedingStage: "preliminary_hearing",
          userBrief: "Testing exclusion of tamizuddin",
        },
        persona
      );

      // Injected dirty list containing Tamizuddin Khan
      const dirtyPrecedents: HostilePrecedent[] = [
        {
          citation: "PLD 1955 FC 240",
          title: "Federation of Pakistan v. Maulvi Tamizuddin Khan",
          court: "Federal Court",
          isOverruled: true,
          relevanceReason: "Overruled doctrine",
          ratioDecidendi: "Bad law",
        },
        {
          citation: "PLD 2018 SC 595",
          title: "Sughran Bibi v. The State",
          court: "Supreme Court of Pakistan",
          isOverruled: false,
          relevanceReason: "Good law",
          ratioDecidendi: "Delay fatal",
        }
      ];

      const counterBrief = await synthesizeCounterBrief({
        attackPlan,
        userBrief: "Testing dirty precedent purge",
        hostilePrecedents: dirtyPrecedents,
      });

      for (const p of counterBrief.hostilePrecedents) {
        assert.notStrictEqual(p.citation, "PLD 1955 FC 240", "Tamizuddin Khan must be purged from counter brief");
        assert.strictEqual(p.isOverruled, false);
      }
    });
  });

  // ── 4. Real-Time Advocate Response Evaluation Engine ──────────────────────
  describe("evaluateAdvocateResponse", () => {
    it("evaluates advocate response, bounds score delta in [-15, +10], and clamps live score in [0, 100]", async () => {
      const evaluation = await evaluateAdvocateResponse({
        userArgument: "Respectfully submitted, My Lord. Under Article 199(1) of the Constitution, the petitioner has approached this Court because the impugned order is coram non judice, which constitutes an established exception to the alternate remedy rule as held in PLD 1998 SC 388.",
        currentQuestion: "Counsel, why should this Court exercise writ jurisdiction when you have not exhausted your statutory appeal under the Act?",
        expectedDefense: "Argue coram non judice exception to exhaustion rule.",
        courtLevel: "high_court",
        currentScore: 70,
      });

      const validated = turnEvaluationSchema.safeParse(evaluation);
      assert.ok(validated.success, `Evaluation must validate against turnEvaluationSchema: ${JSON.stringify(validated.error)}`);

      assert.ok(evaluation.scoreChange >= -15 && evaluation.scoreChange <= 10, `scoreChange (${evaluation.scoreChange}) must be in [-15, +10]`);
      assert.ok(evaluation.currentLiveScore >= 0 && evaluation.currentLiveScore <= 100, `currentLiveScore (${evaluation.currentLiveScore}) must be in [0, 100]`);

      assert.ok(evaluation.breakdown.legalSoundness >= 0 && evaluation.breakdown.legalSoundness <= 100);
      assert.ok(evaluation.breakdown.precedentGrounding >= 0 && evaluation.breakdown.precedentGrounding <= 100);
      assert.ok(evaluation.breakdown.proceduralAdherence >= 0 && evaluation.breakdown.proceduralAdherence <= 100);
      assert.ok(evaluation.breakdown.demeanor >= 0 && evaluation.breakdown.demeanor <= 100);

      assert.ok(evaluation.critique.length > 0);
      assert.ok(Array.isArray(evaluation.weaknessesIdentified));
      assert.ok(Array.isArray(evaluation.strengthsIdentified));
    });

    it("rewards formal Pakistani court address ('My Lord' / 'Your Lordship') in demeanor score", async () => {
      const politeEval = await evaluateAdvocateResponse({
        userArgument: "With utmost respect, My Lord, the petitioner was prevented by sufficient cause under Section 5 Limitation Act.",
        currentQuestion: "What is your explanation for the delay?",
        expectedDefense: "Explain limitation.",
        courtLevel: "high_court",
        currentScore: 70,
      });

      const rudeEval = await evaluateAdvocateResponse({
        userArgument: "You are wrong. Why are you asking this nonsense? It does not matter at all.",
        currentQuestion: "What is your explanation for the delay?",
        expectedDefense: "Explain limitation.",
        courtLevel: "high_court",
        currentScore: 70,
      });

      assert.ok(
        politeEval.breakdown.demeanor > rudeEval.breakdown.demeanor,
        `Polite demeanor (${politeEval.breakdown.demeanor}) must be higher than combative demeanor (${rudeEval.breakdown.demeanor})`
      );
      assert.ok(rudeEval.scoreChange < 0, "Combative response must receive negative score change");
    });

    it("penalizes cursory and evasive responses (< 25 chars)", async () => {
      const cursoryEval = await evaluateAdvocateResponse({
        userArgument: "No comment.",
        currentQuestion: "Counsel, satisfy this bench on locus standi.",
        expectedDefense: "Demonstrate petitioner is an aggrieved person.",
        courtLevel: "high_court",
        currentScore: 70,
      });

      assert.ok(cursoryEval.scoreChange < 0, "Cursory response must be penalized");
      assert.ok(cursoryEval.weaknessesIdentified.some(w => w.toLowerCase().includes("cursory") || w.toLowerCase().includes("evasive") || w.toLowerCase().includes("lacked")));
    });

    it("properly updates rolling moving average when previous breakdown is provided", async () => {
      const prevBreakdown = {
        legalSoundness: 50,
        precedentGrounding: 50,
        proceduralAdherence: 50,
        demeanor: 50,
        feedback: "Prior round",
      };

      const evalResult = await evaluateAdvocateResponse({
        userArgument: "My Lord, Section 154 CrPC read with PLD 2018 SC 595 mandates immediate FIR registration.",
        currentQuestion: "How do you explain the delay?",
        expectedDefense: "Explain statutory compliance.",
        courtLevel: "high_court",
        currentScore: 50,
        currentBreakdown: prevBreakdown,
      });

      // Because the argument had My Lord, Section, and PLD, turn metrics should be high (>70),
      // so blended result should be strictly greater than previous 50.
      assert.ok(evalResult.breakdown.legalSoundness > 50, "Blended legal soundness should improve from 50");
      assert.ok(evalResult.breakdown.precedentGrounding > 50, "Blended precedent grounding should improve from 50");
    });
  });

  // ── 5. Comprehensive Post-Session Report Generator ────────────────────────
  describe("generatePostSessionReport", () => {
    it("generates schema-valid PostSessionReport from in-memory session and messages", async () => {
      const mockSession: BenchSession = {
        id: 1,
        userId: "user-test",
        caseId: null,
        title: "Constitutional Bench Simulation",
        courtLevel: "high_court",
        caseNature: "constitutional",
        proceedingStage: "preliminary_hearing",
        courtName: "High Court of Sindh",
        judgePersona: "The Constitutional Inquisitor",
        userBrief: "Challenging arbitrary license revocation.",
        attackPlan: null,
        status: "completed",
        currentRound: 3,
        maxRounds: 3,
        liveScore: 82,
        scoreBreakdown: {
          legalSoundness: 85,
          precedentGrounding: 80,
          proceduralAdherence: 80,
          demeanor: 85,
          feedback: "Strong presentation",
        },
        postSessionReport: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMessages: BenchMessage[] = [
        {
          id: 1,
          sessionId: 1,
          roundIndex: 1,
          speakerRole: "judge",
          content: "Counsel, address the maintainability objection first.",
          evaluation: null,
          citedCases: null,
          metadata: null,
          createdAt: new Date(Date.now() - 60000),
        },
        {
          id: 2,
          sessionId: 1,
          roundIndex: 1,
          speakerRole: "user",
          content: "My Lord, the petition is competent as the order is without jurisdiction.",
          evaluation: {
            scoreChange: 4,
            currentLiveScore: 74,
            breakdown: { legalSoundness: 75, precedentGrounding: 70, proceduralAdherence: 75, demeanor: 85 },
            critique: "Well argued.",
            weaknessesIdentified: [],
            strengthsIdentified: ["Addressed jurisdiction"],
          },
          citedCases: null,
          metadata: null,
          createdAt: new Date(Date.now() - 50000),
        },
        {
          id: 3,
          sessionId: 1,
          roundIndex: 2,
          speakerRole: "judge",
          content: "What about the limitation bar?",
          evaluation: null,
          citedCases: null,
          metadata: null,
          createdAt: new Date(Date.now() - 40000),
        },
        {
          id: 4,
          sessionId: 1,
          roundIndex: 2,
          speakerRole: "user",
          content: "Your Lordship, Section 14 Limitation Act applies here.",
          evaluation: {
            scoreChange: 8,
            currentLiveScore: 82,
            breakdown: { legalSoundness: 85, precedentGrounding: 80, proceduralAdherence: 80, demeanor: 85 },
            critique: "Convincing argument on exclusion of time.",
            weaknessesIdentified: [],
            strengthsIdentified: ["Section 14 application"],
          },
          citedCases: null,
          metadata: null,
          createdAt: new Date(Date.now() - 30000),
        }
      ];

      const report = await generatePostSessionReport(mockSession, mockMessages);

      const validated = postSessionReportSchema.safeParse(report);
      assert.ok(validated.success, `PostSessionReport must validate against postSessionReportSchema: ${JSON.stringify(validated.error)}`);

      // Score >= 80 at preliminary hearing should yield "admitted"
      assert.strictEqual(report.overallVerdict, "admitted");
      assert.strictEqual(report.finalScore, 82);

      // Radar scores must all be bounded in [0, 100]
      assert.ok(report.radarScores.legalSoundness >= 0 && report.radarScores.legalSoundness <= 100);
      assert.ok(report.radarScores.precedentGrounding >= 0 && report.radarScores.precedentGrounding <= 100);
      assert.ok(report.radarScores.proceduralAdherence >= 0 && report.radarScores.proceduralAdherence <= 100);
      assert.ok(report.radarScores.demeanor >= 0 && report.radarScores.demeanor <= 100);
      assert.ok(report.radarScores.rebuttalEffectiveness >= 0 && report.radarScores.rebuttalEffectiveness <= 100);

      // Rounds summary matches grouped message rounds
      assert.strictEqual(report.roundsSummary.length, 2);
      assert.strictEqual(report.roundsSummary[0].roundIndex, 1);
      assert.strictEqual(report.roundsSummary[1].roundIndex, 2);

      // Remedial precedents and judicial order
      assert.ok(report.remedialPrecedents.length >= 3);
      assert.ok(report.judicialOrderSnippet.includes("ORDER OF THE BENCH"));
      assert.ok(report.judicialOrderSnippet.includes("ADMITTED"));
    });

    it("maps overallVerdict to 'dismissed' when final score is below 60", async () => {
      const mockLowSession: BenchSession = {
        id: 2,
        userId: "user-test",
        caseId: null,
        title: "Flawed Petition",
        courtLevel: "high_court",
        caseNature: "constitutional",
        proceedingStage: "preliminary_hearing",
        courtName: "Lahore High Court",
        judgePersona: "The Procedural Purist",
        userBrief: "Time-barred suit without condonation.",
        attackPlan: null,
        status: "completed",
        currentRound: 1,
        maxRounds: 1,
        liveScore: 45,
        scoreBreakdown: {
          legalSoundness: 40,
          precedentGrounding: 35,
          proceduralAdherence: 40,
          demeanor: 50,
          feedback: "Incompetent petition",
        },
        postSessionReport: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const report = await generatePostSessionReport(mockLowSession, []);
      assert.strictEqual(report.overallVerdict, "dismissed");
      assert.ok(report.judicialOrderSnippet.includes("DISMISSED in limine"));
    });

    it("maps overallVerdict to 'adjourned_with_strictures' for mid-range score (60-79)", async () => {
      const mockMidSession: BenchSession = {
        id: 3,
        userId: "user-test",
        caseId: null,
        title: "Mediocre Petition",
        courtLevel: "high_court",
        caseNature: "civil",
        proceedingStage: "preliminary_hearing",
        courtName: "Islamabad High Court",
        judgePersona: "The Procedural Purist",
        userBrief: "Partition suit with defective verification.",
        attackPlan: null,
        status: "completed",
        currentRound: 1,
        maxRounds: 1,
        liveScore: 68,
        scoreBreakdown: {
          legalSoundness: 65,
          precedentGrounding: 60,
          proceduralAdherence: 70,
          demeanor: 75,
        },
        postSessionReport: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const report = await generatePostSessionReport(mockMidSession, []);
      assert.strictEqual(report.overallVerdict, "adjourned_with_strictures");
      assert.ok(report.judicialOrderSnippet.includes("ADJOURNED"));
    });
  });

  // ── 6. Backwards-Compatible Legacy Wrappers ───────────────────────────────
  describe("Backwards-Compatible Legacy Wrappers", () => {
    it("generateAdversarialQueries returns valid AdversarialQueries object", async () => {
      const context: BenchContext = {
        courtLevel: "High Court",
        caseNature: "Criminal",
        proceedingStage: "Bail",
      };

      const queries = await generateAdversarialQueries(
        "Delay in FIR was due to private settlement negotiations.",
        context
      );

      assert.ok(queries.proceduralBar.length > 0, "proceduralBar query must not be empty");
      assert.ok(queries.statutoryException.length > 0, "statutoryException query must not be empty");
      assert.ok(queries.contraryPrecedent.length > 0, "contraryPrecedent query must not be empty");
    });

    it("generateCounterBrief generates legacy compatible counter brief", async () => {
      const mockCases: CaseLaw[] = [
        {
          id: 1,
          citation: "PLD 2018 SC 595",
          citationYear: 2018,
          citationReport: "PLD",
          citationPage: "595",
          citationRole: "primary",
          court: "Supreme Court of Pakistan",
          title: "Sughran Bibi v. The State",
          summary: "Delay in FIR is fatal to prosecution.",
          keywords: ["delay", "fir"],
          sourceDocId: null,
          sourceType: "judgment",
          sourceFilename: null,
          documentClassification: "case_law",
          fallbackExtraction: false,
          statuteReferences: [],
          authorityScore: 100,
          isOverruled: false,
        }
      ];

      const brief = await generateCounterBrief(mockCases, "FIR delay was excused by compromise.");

      assert.ok(Array.isArray(brief.fatal_points), "brief must contain fatal_points array");
      assert.ok(Array.isArray(brief.hostile_citations), "brief must contain hostile_citations array");
      assert.ok(brief.fatal_points.length > 0);
      assert.ok(brief.hostile_citations.includes("PLD 2018 SC 595"));
    });
  });
});
