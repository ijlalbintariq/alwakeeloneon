import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableName } from "drizzle-orm";
import {
  benchSessions,
  benchMessages,
  benchSessionsRelations,
  benchMessagesRelations,
  insertBenchSessionSchema,
  insertBenchMessageSchema,
  createBenchSessionRequestSchema,
  submitBenchRoundRequestSchema,
  courtLevelSchema,
  caseNatureSchema,
  proceedingStageSchema,
  benchSpeakerRoleSchema,
  benchSessionStatusSchema,
  scoreBreakdownSchema,
  benchCitedCaseSchema,
  turnEvaluationSchema,
  hiddenAttackPlanSchema,
  postSessionReportSchema,
  counterBriefSchema,
  type CourtLevel,
  type CaseNature,
  type ProceedingStage,
  type BenchSpeakerRole,
  type BenchSessionStatus,
  type ScoreBreakdown,
  type BenchCitedCase,
  type TurnEvaluation,
  type HiddenAttackPlan,
  type PostSessionReport,
  type CounterBrief,
} from "@shared/schema";
import { ensureBenchSimulatorSchema, _resetBenchSimulatorSchemaState } from "../../server/storage";

describe("Milestone 1: Bench Simulator Schema & Types", () => {
  describe("Table Definitions & Columns", () => {
    it("defines benchSessions table with expected columns and properties", () => {
      assert.ok(benchSessions, "benchSessions table should be defined");
      assert.strictEqual(getTableName(benchSessions), "bench_sessions");

      const cols = benchSessions;
      assert.ok(cols.id, "id column must exist");
      assert.ok(cols.userId, "userId column must exist");
      assert.ok(cols.caseId, "caseId column must exist");
      assert.ok(cols.title, "title column must exist");
      assert.ok(cols.courtLevel, "courtLevel column must exist");
      assert.ok(cols.caseNature, "caseNature column must exist");
      assert.ok(cols.proceedingStage, "proceedingStage column must exist");
      assert.ok(cols.courtName, "courtName column must exist");
      assert.ok(cols.judgePersona, "judgePersona column must exist");
      assert.ok(cols.userBrief, "userBrief column must exist");
      assert.ok(cols.attackPlan, "attackPlan column must exist");
      assert.ok(cols.status, "status column must exist");
      assert.ok(cols.currentRound, "currentRound column must exist");
      assert.ok(cols.maxRounds, "maxRounds column must exist");
      assert.ok(cols.liveScore, "liveScore column must exist");
      assert.ok(cols.scoreBreakdown, "scoreBreakdown column must exist");
      assert.ok(cols.postSessionReport, "postSessionReport column must exist");
      assert.ok(cols.createdAt, "createdAt column must exist");
      assert.ok(cols.updatedAt, "updatedAt column must exist");
      assert.ok(cols.completedAt, "completedAt column must exist");
    });

    it("defines benchMessages table with expected columns and properties", () => {
      assert.ok(benchMessages, "benchMessages table should be defined");
      assert.strictEqual(getTableName(benchMessages), "bench_messages");

      const cols = benchMessages;
      assert.ok(cols.id, "id column must exist");
      assert.ok(cols.sessionId, "sessionId column must exist");
      assert.ok(cols.roundIndex, "roundIndex column must exist");
      assert.ok(cols.speakerRole, "speakerRole column must exist");
      assert.ok(cols.content, "content column must exist");
      assert.ok(cols.evaluation, "evaluation column must exist");
      assert.ok(cols.citedCases, "citedCases column must exist");
      assert.ok(cols.metadata, "metadata column must exist");
      assert.ok(cols.createdAt, "createdAt column must exist");
    });

    it("registers relations for benchSessions and benchMessages", () => {
      assert.ok(benchSessionsRelations, "benchSessionsRelations must be exported");
      assert.ok(benchMessagesRelations, "benchMessagesRelations must be exported");
    });
  });

  describe("Zod Enum Validations", () => {
    it("validates CourtLevel enum values", () => {
      const valid: CourtLevel[] = ["supreme_court", "high_court", "district_sessions"];
      for (const level of valid) {
        assert.strictEqual(courtLevelSchema.parse(level), level);
      }
      assert.throws(() => courtLevelSchema.parse("invalid_court"));
    });

    it("validates CaseNature enum values", () => {
      const valid: CaseNature[] = ["civil", "criminal", "constitutional", "corporate"];
      for (const nature of valid) {
        assert.strictEqual(caseNatureSchema.parse(nature), nature);
      }
      assert.throws(() => caseNatureSchema.parse("traffic"));
    });

    it("validates ProceedingStage enum values", () => {
      const valid: ProceedingStage[] = [
        "preliminary_hearing",
        "framing_of_issues",
        "cross_examination",
        "final_arguments",
      ];
      for (const stage of valid) {
        assert.strictEqual(proceedingStageSchema.parse(stage), stage);
      }
      assert.throws(() => proceedingStageSchema.parse("mediation"));
    });

    it("validates BenchSpeakerRole enum values", () => {
      const valid: BenchSpeakerRole[] = ["user", "judge", "opposing_counsel", "system"];
      for (const role of valid) {
        assert.strictEqual(benchSpeakerRoleSchema.parse(role), role);
      }
      assert.throws(() => benchSpeakerRoleSchema.parse("bystander"));
    });

    it("validates BenchSessionStatus enum values", () => {
      const valid: BenchSessionStatus[] = ["active", "completed", "abandoned"];
      for (const status of valid) {
        assert.strictEqual(benchSessionStatusSchema.parse(status), status);
      }
      assert.throws(() => benchSessionStatusSchema.parse("pending"));
    });
  });

  describe("Domain & API Schemas", () => {
    it("validates ScoreBreakdown schema within 0-100 boundaries", () => {
      const validBreakdown: ScoreBreakdown = {
        legalSoundness: 85,
        precedentGrounding: 70,
        proceduralAdherence: 90,
        demeanor: 80,
        feedback: "Strong statutory citations",
      };
      const parsed = scoreBreakdownSchema.parse(validBreakdown);
      assert.strictEqual(parsed.legalSoundness, 85);

      assert.throws(() =>
        scoreBreakdownSchema.parse({
          ...validBreakdown,
          legalSoundness: 105,
        })
      );
      assert.throws(() =>
        scoreBreakdownSchema.parse({
          ...validBreakdown,
          demeanor: -5,
        })
      );
    });

    it("validates BenchCitedCase schema", () => {
      const validCase: BenchCitedCase = {
        citation: "PLD 2020 SC 1",
        title: "Federal Government v. Justice Qazi Faez Isa",
        court: "Supreme Court of Pakistan",
        year: 2020,
        isOverruled: false,
        relevanceSnippet: "Detailed standard on judicial independence and constitutional petitions.",
      };
      const parsed = benchCitedCaseSchema.parse(validCase);
      assert.strictEqual(parsed.citation, "PLD 2020 SC 1");
      assert.strictEqual(parsed.isOverruled, false);
    });

    it("validates TurnEvaluation schema", () => {
      const evaluation: TurnEvaluation = {
        scoreChange: -5,
        currentLiveScore: 65,
        breakdown: {
          legalSoundness: 60,
          precedentGrounding: 60,
          proceduralAdherence: 70,
          demeanor: 70,
        },
        critique: "Failed to address Section 497 CrPC proviso 1.",
        weaknessesIdentified: ["Did not distinguish precedent cited by opposing counsel"],
        strengthsIdentified: ["Maintained respectful courtroom demeanor"],
        suggestedRebuttal: "Rely on PLD 1995 SC 34 regarding statutory bail grounds.",
      };
      const parsed = turnEvaluationSchema.parse(evaluation);
      assert.strictEqual(parsed.scoreChange, -5);
      assert.strictEqual(parsed.currentLiveScore, 65);
    });

    it("validates HiddenAttackPlan schema", () => {
      const plan: HiddenAttackPlan = {
        strategySummary: "Attack locus standi and statutory limitation period.",
        vulnerabilities: [
          {
            area: "Limitation",
            severity: "fatal",
            description: "Appeal filed 45 days past 30-day statutory window without condonation application.",
            targetedPrecedents: ["2018 SCMR 1234"],
            suggestedQuestions: ["How does counsel overcome the jurisdictional bar of Section 3 Limitation Act?"],
          },
        ],
        rounds: [
          {
            roundIndex: 1,
            phase: "preliminary_objection",
            opposingArgument: "The petition is barred by limitation on the face of the record.",
            judgeQuestion: "Counsel, before going into merits, answer the preliminary objection on limitation.",
            hostileCitations: ["2018 SCMR 1234"],
            expectedDefenseAngle: "Section 5 condonation ground or continuous wrong doctrine.",
          },
        ],
        primaryHostileThemes: ["Jurisdictional bar", "Laches"],
      };
      const parsed = hiddenAttackPlanSchema.parse(plan);
      assert.strictEqual(parsed.vulnerabilities.length, 1);
      assert.strictEqual(parsed.vulnerabilities[0].severity, "fatal");
    });

    it("validates PostSessionReport schema", () => {
      const report: PostSessionReport = {
        overallVerdict: "admitted",
        finalScore: 82,
        finalBreakdown: {
          legalSoundness: 85,
          precedentGrounding: 80,
          proceduralAdherence: 85,
          demeanor: 80,
        },
        radarScores: {
          legalSoundness: 85,
          precedentGrounding: 80,
          proceduralAdherence: 85,
          demeanor: 80,
          rebuttalEffectiveness: 78,
        },
        strengths: ["Strong reliance on constitutional precedents", "Clear prayer articulation"],
        vulnerabilities: ["Hesitant on interim injunctive relief test"],
        judicialOrderSnippet: "Leave to appeal is granted to examine the interpretation of Section 9...",
        remedialPrecedents: [
          {
            citation: "2021 SCMR 990",
            title: "Rehman v. State",
            principle: "Principles governing admission of constitutional petitions",
            whyHelpful: "Establishes prima facie case threshold",
          },
        ],
        roundsSummary: [
          {
            roundIndex: 1,
            userArgumentSummary: "Argued maintainability under Article 199(1)(a)(i)",
            judgeReaction: "Skeptical but requested supporting authorities",
            scoreDelta: 5,
          },
        ],
      };
      const parsed = postSessionReportSchema.parse(report);
      assert.strictEqual(parsed.overallVerdict, "admitted");
      assert.strictEqual(parsed.finalScore, 82);
    });

    it("validates CounterBrief schema", () => {
      const counterBrief: CounterBrief = {
        preliminaryObjections: ["Lack of locus standi", "Non-joinder of necessary parties"],
        statutoryBars: ["Bar under Section 11 CPC (Res Judicata)"],
        hostilePrecedents: [
          {
            citation: "PLD 2015 SC 301",
            title: "Mst. Sakina Bibi v. Federation",
            court: "Supreme Court of Pakistan",
            year: 2015,
            isOverruled: false,
            relevanceSnippet: "Directly bars writ jurisdiction when alternative remedy is unexhausted.",
            ratioDecidendi: "Alternative remedy rule is jurisdictional in revenue assessment challenges.",
          },
        ],
        rebuttalStrategy: "Push user into admitting alternative appellate remedy exists under Section 131.",
      };
      const parsed = counterBriefSchema.parse(counterBrief);
      assert.strictEqual(parsed.preliminaryObjections.length, 2);
      assert.strictEqual(parsed.hostilePrecedents[0].isOverruled, false);
    });

    it("validates createBenchSessionRequestSchema and rejects inadequate briefs", () => {
      const validRequest = {
        courtLevel: "supreme_court" as const,
        caseNature: "constitutional" as const,
        proceedingStage: "preliminary_hearing" as const,
        userBrief: "Constitutional petition challenging arbitrary license suspension under Article 199.",
        judgePersona: "Strict textualist, procedural purist",
        maxRounds: 5,
      };
      const parsed = createBenchSessionRequestSchema.parse(validRequest);
      assert.strictEqual(parsed.maxRounds, 5);
      assert.strictEqual(parsed.courtLevel, "supreme_court");

      // Too short brief (less than 10 chars)
      assert.throws(() =>
        createBenchSessionRequestSchema.parse({
          ...validRequest,
          userBrief: "Short",
        })
      );

      // Invalid courtLevel
      assert.throws(() =>
        createBenchSessionRequestSchema.parse({
          ...validRequest,
          courtLevel: "invalid",
        })
      );
    });

    it("validates submitBenchRoundRequestSchema", () => {
      const validRound = {
        sessionId: 42,
        userArgument: "My Lord, Section 24-A of the General Clauses Act mandates recorded reasons.",
      };
      const parsed = submitBenchRoundRequestSchema.parse(validRound);
      assert.strictEqual(parsed.sessionId, 42);

      // Empty argument
      assert.throws(() =>
        submitBenchRoundRequestSchema.parse({
          sessionId: 42,
          userArgument: "",
        })
      );

      // Non-positive sessionId
      assert.throws(() =>
        submitBenchRoundRequestSchema.parse({
          sessionId: -1,
          userArgument: "Valid argument text",
        })
      );
    });

    it("validates insert schemas omit autogenerated fields", () => {
      const sessionInput = {
        courtLevel: "high_court" as const,
        caseNature: "criminal" as const,
        proceedingStage: "preliminary_hearing" as const,
        userBrief: "Bail after arrest in FIR No. 12/2026 under section 302/34 PPC.",
        status: "active" as const,
        currentRound: 1,
        maxRounds: 5,
        liveScore: 70,
      };
      const parsedSession = insertBenchSessionSchema.parse(sessionInput);
      assert.strictEqual(parsedSession.courtLevel, "high_court");

      const messageInput = {
        sessionId: 10,
        roundIndex: 1,
        speakerRole: "judge" as const,
        content: "What is your explanation for the recovery memo discrepancies?",
        metadata: {},
      };
      const parsedMessage = insertBenchMessageSchema.parse(messageInput);
      assert.strictEqual(parsedMessage.speakerRole, "judge");
    });
  });

  describe("Runtime DDL Helper Function", () => {
    it("exports ensureBenchSimulatorSchema and executes safely without database connection", async () => {
      assert.strictEqual(typeof ensureBenchSimulatorSchema, "function");
      // Calling without DB available should safely no-op without uncaught exception
      await assert.doesNotReject(async () => {
        await ensureBenchSimulatorSchema();
      });
    });

    it("executes mock client queries idempotently", async () => {
      _resetBenchSimulatorSchemaState();
      const executedQueries: string[] = [];
      const mockClient = {
        query: async (sqlText: string) => {
          executedQueries.push(sqlText);
          return { rows: [] };
        },
      };

      // 1. Initial call executes query against mock client exactly once
      await ensureBenchSimulatorSchema(mockClient);
      assert.strictEqual(executedQueries.length, 1, "mockClient.query must be executed once");

      // 2. Query text matching CREATE TABLE IF NOT EXISTS bench_sessions and bench_messages
      const ddl = executedQueries[0];
      assert.ok(
        ddl.includes("CREATE TABLE IF NOT EXISTS bench_sessions"),
        "Executed query must contain CREATE TABLE IF NOT EXISTS bench_sessions"
      );
      assert.ok(
        ddl.includes("CREATE TABLE IF NOT EXISTS bench_messages"),
        "Executed query must contain CREATE TABLE IF NOT EXISTS bench_messages"
      );

      // 3. Sequential idempotency: second call does not re-query
      await ensureBenchSimulatorSchema(mockClient);
      assert.strictEqual(executedQueries.length, 1, "Second call must not re-query");

      // 4. Concurrency: concurrent calls coalesce into 1 query execution
      await Promise.all([
        ensureBenchSimulatorSchema(mockClient),
        ensureBenchSimulatorSchema(mockClient),
      ]);
      assert.strictEqual(
        executedQueries.length,
        1,
        "Concurrent calls coalesce into 1 query execution"
      );
    });

    it("coalesces concurrent in-flight invocations into 1 query execution", async () => {
      _resetBenchSimulatorSchemaState();
      const concurrentQueries: string[] = [];
      const concurrentMockClient = {
        query: async (sqlText: string) => {
          await new Promise((resolve) => setTimeout(resolve, 25));
          concurrentQueries.push(sqlText);
          return { rows: [] };
        },
      };

      await Promise.all([
        ensureBenchSimulatorSchema(concurrentMockClient),
        ensureBenchSimulatorSchema(concurrentMockClient),
        ensureBenchSimulatorSchema(concurrentMockClient),
      ]);

      assert.strictEqual(
        concurrentQueries.length,
        1,
        "Concurrent in-flight calls coalesce into 1 query execution"
      );
    });
  });
});
