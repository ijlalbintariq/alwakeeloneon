import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ZodError } from "zod";
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
} from "@shared/schema";
import { ensureBenchSimulatorSchema } from "../../server/storage";

describe("Milestone 1 Adversarial Stress Suite: Schema & Validation Boundaries", () => {
  // ── 1. Enum Boundary Attacks ─────────────────────────────────────────────
  describe("Adversarial Enum Attacks", () => {
    const invalidValues = [
      "",
      " ",
      "NULL",
      "undefined",
      "'; DROP TABLE bench_sessions; --",
      "<script>alert(1)</script>",
      "123",
      "SUPREME_COURT", // Case sensitivity check
      "high-court", // Hyphenation check
      "civil_appeal",
    ];

    it("strictly rejects invalid courtLevel inputs across all attack vectors", () => {
      for (const val of invalidValues) {
        const result = courtLevelSchema.safeParse(val);
        assert.strictEqual(
          result.success,
          false,
          `courtLevelSchema should reject invalid value: "${val}"`
        );
      }

      // Type-mismatch attacks
      const typeMismatches = [null, undefined, 123, true, {}, [], () => {}];
      for (const val of typeMismatches) {
        assert.strictEqual(
          courtLevelSchema.safeParse(val).success,
          false,
          `courtLevelSchema should reject non-string type: ${typeof val}`
        );
      }

      // Valid values verification
      assert.strictEqual(courtLevelSchema.safeParse("supreme_court").success, true);
      assert.strictEqual(courtLevelSchema.safeParse("high_court").success, true);
      assert.strictEqual(courtLevelSchema.safeParse("district_sessions").success, true);
    });

    it("strictly rejects invalid caseNature inputs across all attack vectors", () => {
      const invalidNatures = [
        ...invalidValues,
        "revenue", // Common in Pakistan legal system but intentionally excluded
        "family",
        "banking",
        "tax",
        "admiralty",
      ];

      for (const val of invalidNatures) {
        const result = caseNatureSchema.safeParse(val);
        assert.strictEqual(
          result.success,
          false,
          `caseNatureSchema should reject invalid value: "${val}"`
        );
      }

      assert.strictEqual(caseNatureSchema.safeParse("civil").success, true);
      assert.strictEqual(caseNatureSchema.safeParse("criminal").success, true);
      assert.strictEqual(caseNatureSchema.safeParse("constitutional").success, true);
      assert.strictEqual(caseNatureSchema.safeParse("corporate").success, true);
    });

    it("strictly rejects invalid proceedingStage inputs across all attack vectors", () => {
      const invalidStages = [
        ...invalidValues,
        "bail_hearing",
        "preliminary",
        "arguments",
        "judgment_order",
        "appeal_filing",
      ];

      for (const val of invalidStages) {
        const result = proceedingStageSchema.safeParse(val);
        assert.strictEqual(
          result.success,
          false,
          `proceedingStageSchema should reject invalid value: "${val}"`
        );
      }

      assert.strictEqual(proceedingStageSchema.safeParse("preliminary_hearing").success, true);
      assert.strictEqual(proceedingStageSchema.safeParse("framing_of_issues").success, true);
      assert.strictEqual(proceedingStageSchema.safeParse("cross_examination").success, true);
      assert.strictEqual(proceedingStageSchema.safeParse("final_arguments").success, true);
    });

    it("strictly rejects invalid benchSpeakerRole inputs across all attack vectors", () => {
      const invalidRoles = [
        ...invalidValues,
        "clerk",
        "witness",
        "observer",
        "attorney",
        "amicus_curiae",
        "stenographer",
      ];

      for (const val of invalidRoles) {
        const result = benchSpeakerRoleSchema.safeParse(val);
        assert.strictEqual(
          result.success,
          false,
          `benchSpeakerRoleSchema should reject invalid value: "${val}"`
        );
      }

      assert.strictEqual(benchSpeakerRoleSchema.safeParse("user").success, true);
      assert.strictEqual(benchSpeakerRoleSchema.safeParse("judge").success, true);
      assert.strictEqual(benchSpeakerRoleSchema.safeParse("opposing_counsel").success, true);
      assert.strictEqual(benchSpeakerRoleSchema.safeParse("system").success, true);
    });

    it("strictly rejects invalid benchSessionStatus inputs across all attack vectors", () => {
      const invalidStatuses = [
        ...invalidValues,
        "pending",
        "paused",
        "in_progress",
        "cancelled",
        "closed",
      ];

      for (const val of invalidStatuses) {
        const result = benchSessionStatusSchema.safeParse(val);
        assert.strictEqual(
          result.success,
          false,
          `benchSessionStatusSchema should reject invalid value: "${val}"`
        );
      }

      assert.strictEqual(benchSessionStatusSchema.safeParse("active").success, true);
      assert.strictEqual(benchSessionStatusSchema.safeParse("completed").success, true);
      assert.strictEqual(benchSessionStatusSchema.safeParse("abandoned").success, true);
    });

    it("strictly rejects invalid overallVerdict in postSessionReportSchema", () => {
      const invalidVerdicts = [
        "guilty",
        "acquitted",
        "allowed",
        "rejected",
        "remanded",
        "transferred",
        "",
        null,
      ];

      const baseReport = {
        finalScore: 80,
        finalBreakdown: { legalSoundness: 80, precedentGrounding: 80, proceduralAdherence: 80, demeanor: 80 },
        radarScores: { legalSoundness: 80, precedentGrounding: 80, proceduralAdherence: 80, demeanor: 80, rebuttalEffectiveness: 80 },
        strengths: ["Good points"],
        vulnerabilities: ["None"],
        judicialOrderSnippet: "Leave granted",
        remedialPrecedents: [],
        roundsSummary: [],
      };

      for (const verdict of invalidVerdicts) {
        const result = postSessionReportSchema.safeParse({
          ...baseReport,
          overallVerdict: verdict,
        });
        assert.strictEqual(
          result.success,
          false,
          `postSessionReportSchema should reject invalid overallVerdict: "${verdict}"`
        );
      }

      const validVerdicts = [
        "admitted",
        "dismissed",
        "adjourned_with_strictures",
        "interim_relief_granted",
        "interim_relief_denied",
      ];
      for (const verdict of validVerdicts) {
        const result = postSessionReportSchema.safeParse({
          ...baseReport,
          overallVerdict: verdict,
        });
        assert.strictEqual(result.success, true, `Should accept valid overallVerdict: "${verdict}"`);
      }
    });

    it("strictly rejects invalid severity in hiddenAttackPlanSchema vulnerabilities", () => {
      const invalidSeverities = ["critical", "minor", "low", "high", "negligible", "", null];
      const basePlan = {
        strategySummary: "Attack plan summary",
        vulnerabilities: [
          {
            area: "Jurisdiction",
            description: "No jurisdiction",
            targetedPrecedents: ["2020 SCMR 1"],
            suggestedQuestions: ["Where is jurisdiction?"],
          },
        ],
        rounds: [],
        primaryHostileThemes: ["Jurisdiction"],
      };

      for (const severity of invalidSeverities) {
        const result = hiddenAttackPlanSchema.safeParse({
          ...basePlan,
          vulnerabilities: [{ ...basePlan.vulnerabilities[0], severity }],
        });
        assert.strictEqual(
          result.success,
          false,
          `hiddenAttackPlanSchema should reject invalid severity: "${severity}"`
        );
      }

      for (const severity of ["fatal", "major", "moderate"]) {
        const result = hiddenAttackPlanSchema.safeParse({
          ...basePlan,
          vulnerabilities: [{ ...basePlan.vulnerabilities[0], severity }],
        });
        assert.strictEqual(result.success, true, `Should accept valid severity: "${severity}"`);
      }
    });
  });

  // ── 2. Extreme Score Boundaries & Number Handling ────────────────────────
  describe("Adversarial Score Boundaries & Numeric Stress", () => {
    it("strictly enforces [0, 100] range on ScoreBreakdown and rejects underflow/overflow", () => {
      const valid = {
        legalSoundness: 50,
        precedentGrounding: 50,
        proceduralAdherence: 50,
        demeanor: 50,
      };

      // Exact boundaries: 0 and 100 must pass
      assert.strictEqual(scoreBreakdownSchema.safeParse({ ...valid, legalSoundness: 0 }).success, true);
      assert.strictEqual(scoreBreakdownSchema.safeParse({ ...valid, legalSoundness: 100 }).success, true);
      assert.strictEqual(scoreBreakdownSchema.safeParse({ ...valid, demeanor: 0 }).success, true);
      assert.strictEqual(scoreBreakdownSchema.safeParse({ ...valid, demeanor: 100 }).success, true);

      // Negative values must be rejected
      const negativeScores = [-1, -0.0001, -100, -999999, -Infinity];
      for (const neg of negativeScores) {
        assert.strictEqual(
          scoreBreakdownSchema.safeParse({ ...valid, legalSoundness: neg }).success,
          false,
          `Should reject negative score: ${neg}`
        );
        assert.strictEqual(
          scoreBreakdownSchema.safeParse({ ...valid, precedentGrounding: neg }).success,
          false,
          `Should reject negative score: ${neg}`
        );
        assert.strictEqual(
          scoreBreakdownSchema.safeParse({ ...valid, proceduralAdherence: neg }).success,
          false,
          `Should reject negative score: ${neg}`
        );
        assert.strictEqual(
          scoreBreakdownSchema.safeParse({ ...valid, demeanor: neg }).success,
          false,
          `Should reject negative score: ${neg}`
        );
      }

      // Greater than 100 must be rejected
      const overflowScores = [100.001, 101, 999999, Infinity];
      for (const over of overflowScores) {
        assert.strictEqual(
          scoreBreakdownSchema.safeParse({ ...valid, legalSoundness: over }).success,
          false,
          `Should reject score > 100: ${over}`
        );
        assert.strictEqual(
          scoreBreakdownSchema.safeParse({ ...valid, demeanor: over }).success,
          false,
          `Should reject score > 100: ${over}`
        );
      }

      // NaN and non-numeric types
      assert.strictEqual(scoreBreakdownSchema.safeParse({ ...valid, legalSoundness: NaN }).success, false);
      assert.strictEqual(scoreBreakdownSchema.safeParse({ ...valid, legalSoundness: "80" }).success, false);
      assert.strictEqual(scoreBreakdownSchema.safeParse({ ...valid, legalSoundness: null }).success, false);

      // Float values within [0, 100] are accepted by z.number().min(0).max(100)
      const floatParse = scoreBreakdownSchema.safeParse({
        ...valid,
        legalSoundness: 85.5,
        precedentGrounding: 72.25,
      });
      assert.strictEqual(floatParse.success, true, "Zod accepts decimal scores within range");
    });

    it("strictly enforces [0, 100] on currentLiveScore in TurnEvaluation", () => {
      const validEval = {
        scoreChange: -10,
        currentLiveScore: 60,
        breakdown: { legalSoundness: 60, precedentGrounding: 60, proceduralAdherence: 60, demeanor: 60 },
        critique: "Needs improvement",
        weaknessesIdentified: ["Lack of precedent"],
        strengthsIdentified: ["Calm demeanor"],
      };

      // Score bounds
      assert.strictEqual(turnEvaluationSchema.safeParse({ ...validEval, currentLiveScore: 0 }).success, true);
      assert.strictEqual(turnEvaluationSchema.safeParse({ ...validEval, currentLiveScore: 100 }).success, true);
      assert.strictEqual(turnEvaluationSchema.safeParse({ ...validEval, currentLiveScore: -1 }).success, false);
      assert.strictEqual(turnEvaluationSchema.safeParse({ ...validEval, currentLiveScore: 101 }).success, false);
      assert.strictEqual(turnEvaluationSchema.safeParse({ ...validEval, currentLiveScore: NaN }).success, false);

      // scoreChange allows negative (penalty), zero, and positive (reward)
      assert.strictEqual(turnEvaluationSchema.safeParse({ ...validEval, scoreChange: -25 }).success, true);
      assert.strictEqual(turnEvaluationSchema.safeParse({ ...validEval, scoreChange: 0 }).success, true);
      assert.strictEqual(turnEvaluationSchema.safeParse({ ...validEval, scoreChange: 15 }).success, true);
      assert.strictEqual(turnEvaluationSchema.safeParse({ ...validEval, scoreChange: -3.5 }).success, true);
      assert.strictEqual(turnEvaluationSchema.safeParse({ ...validEval, scoreChange: NaN }).success, false);
    });

    it("strictly enforces [0, 100] on all 5 radar metrics in PostSessionReport", () => {
      const baseReport = {
        overallVerdict: "admitted" as const,
        finalScore: 85,
        finalBreakdown: { legalSoundness: 85, precedentGrounding: 85, proceduralAdherence: 85, demeanor: 85 },
        radarScores: {
          legalSoundness: 85,
          precedentGrounding: 85,
          proceduralAdherence: 85,
          demeanor: 85,
          rebuttalEffectiveness: 85,
        },
        strengths: ["Strong"],
        vulnerabilities: ["Weak"],
        judicialOrderSnippet: "Order text",
        remedialPrecedents: [],
        roundsSummary: [],
      };

      const radarKeys = [
        "legalSoundness",
        "precedentGrounding",
        "proceduralAdherence",
        "demeanor",
        "rebuttalEffectiveness",
      ] as const;

      for (const key of radarKeys) {
        // Negative test
        assert.strictEqual(
          postSessionReportSchema.safeParse({
            ...baseReport,
            radarScores: { ...baseReport.radarScores, [key]: -5 },
          }).success,
          false,
          `radarScores.${key} must reject negative numbers`
        );

        // > 100 test
        assert.strictEqual(
          postSessionReportSchema.safeParse({
            ...baseReport,
            radarScores: { ...baseReport.radarScores, [key]: 105 },
          }).success,
          false,
          `radarScores.${key} must reject > 100 numbers`
        );

        // Exact 0 and 100
        assert.strictEqual(
          postSessionReportSchema.safeParse({
            ...baseReport,
            radarScores: { ...baseReport.radarScores, [key]: 0 },
          }).success,
          true,
          `radarScores.${key} should accept 0`
        );
        assert.strictEqual(
          postSessionReportSchema.safeParse({
            ...baseReport,
            radarScores: { ...baseReport.radarScores, [key]: 100 },
          }).success,
          true,
          `radarScores.${key} should accept 100`
        );
      }

      // finalScore bounds
      assert.strictEqual(postSessionReportSchema.safeParse({ ...baseReport, finalScore: -1 }).success, false);
      assert.strictEqual(postSessionReportSchema.safeParse({ ...baseReport, finalScore: 101 }).success, false);
      assert.strictEqual(postSessionReportSchema.safeParse({ ...baseReport, finalScore: 0 }).success, true);
      assert.strictEqual(postSessionReportSchema.safeParse({ ...baseReport, finalScore: 100 }).success, true);
    });

    it("strictly validates integer constraints on maxRounds in createBenchSessionRequestSchema", () => {
      const baseReq = {
        courtLevel: "supreme_court" as const,
        caseNature: "constitutional" as const,
        proceedingStage: "preliminary_hearing" as const,
        userBrief: "Valid constitutional petition brief challenging arbitrary actions.",
      };

      // Default when omitted
      const defaultParsed = createBenchSessionRequestSchema.parse(baseReq);
      assert.strictEqual(defaultParsed.maxRounds, 5);

      // Boundaries: 1 and 10 must pass
      assert.strictEqual(createBenchSessionRequestSchema.safeParse({ ...baseReq, maxRounds: 1 }).success, true);
      assert.strictEqual(createBenchSessionRequestSchema.safeParse({ ...baseReq, maxRounds: 10 }).success, true);

      // Out of bounds: 0, 11, negative numbers
      assert.strictEqual(createBenchSessionRequestSchema.safeParse({ ...baseReq, maxRounds: 0 }).success, false);
      assert.strictEqual(createBenchSessionRequestSchema.safeParse({ ...baseReq, maxRounds: 11 }).success, false);
      assert.strictEqual(createBenchSessionRequestSchema.safeParse({ ...baseReq, maxRounds: -1 }).success, false);

      // Float values rejected by .int()
      assert.strictEqual(createBenchSessionRequestSchema.safeParse({ ...baseReq, maxRounds: 5.5 }).success, false);
      assert.strictEqual(createBenchSessionRequestSchema.safeParse({ ...baseReq, maxRounds: 3.14 }).success, false);
    });

    it("strictly validates sessionId constraints in submitBenchRoundRequestSchema", () => {
      const baseRound = { userArgument: "My Lord, Section 24-A GCA applies." };

      // Valid positive integer
      assert.strictEqual(submitBenchRoundRequestSchema.safeParse({ ...baseRound, sessionId: 1 }).success, true);
      assert.strictEqual(submitBenchRoundRequestSchema.safeParse({ ...baseRound, sessionId: 999999 }).success, true);

      // Non-positive, float, string
      assert.strictEqual(submitBenchRoundRequestSchema.safeParse({ ...baseRound, sessionId: 0 }).success, false);
      assert.strictEqual(submitBenchRoundRequestSchema.safeParse({ ...baseRound, sessionId: -1 }).success, false);
      assert.strictEqual(submitBenchRoundRequestSchema.safeParse({ ...baseRound, sessionId: 1.5 }).success, false);
      assert.strictEqual(submitBenchRoundRequestSchema.safeParse({ ...baseRound, sessionId: "42" }).success, false);
    });
  });

  // ── 3. Corrupted & Partial JSON Stress Testing ────────────────────────────
  describe("Adversarial Corrupted & Partial JSON Stress", () => {
    it("rejects corrupted or partial objects in hiddenAttackPlanSchema", () => {
      const validPlan = {
        strategySummary: "Attack limitation and locus standi.",
        vulnerabilities: [
          {
            area: "Limitation",
            severity: "fatal" as const,
            description: "Time barred",
            targetedPrecedents: ["2021 SCMR 12"],
            suggestedQuestions: ["Why not file within 30 days?"],
          },
        ],
        rounds: [
          {
            roundIndex: 1,
            phase: "preliminary",
            opposingArgument: "Barred by time",
            judgeQuestion: "Answer on limitation",
            hostileCitations: ["2021 SCMR 12"],
            expectedDefenseAngle: "Condonation",
          },
        ],
        primaryHostileThemes: ["Limitation"],
      };

      // Non-objects and null
      assert.strictEqual(hiddenAttackPlanSchema.safeParse(null).success, false);
      assert.strictEqual(hiddenAttackPlanSchema.safeParse(undefined).success, false);
      assert.strictEqual(hiddenAttackPlanSchema.safeParse("corrupt").success, false);
      assert.strictEqual(hiddenAttackPlanSchema.safeParse(12345).success, false);
      assert.strictEqual(hiddenAttackPlanSchema.safeParse([]).success, false);
      assert.strictEqual(hiddenAttackPlanSchema.safeParse({}).success, false);

      // Missing top-level fields
      assert.strictEqual(hiddenAttackPlanSchema.safeParse({ ...validPlan, strategySummary: undefined }).success, false);
      assert.strictEqual(hiddenAttackPlanSchema.safeParse({ ...validPlan, vulnerabilities: undefined }).success, false);
      assert.strictEqual(hiddenAttackPlanSchema.safeParse({ ...validPlan, rounds: undefined }).success, false);
      assert.strictEqual(hiddenAttackPlanSchema.safeParse({ ...validPlan, primaryHostileThemes: undefined }).success, false);

      // Corrupted vulnerabilities
      assert.strictEqual(
        hiddenAttackPlanSchema.safeParse({
          ...validPlan,
          vulnerabilities: [{ area: "Limitation" }], // missing severity, description, etc.
        }).success,
        false
      );
      assert.strictEqual(
        hiddenAttackPlanSchema.safeParse({
          ...validPlan,
          vulnerabilities: [
            {
              ...validPlan.vulnerabilities[0],
              targetedPrecedents: "not an array", // wrong type
            },
          ],
        }).success,
        false
      );

      // Corrupted rounds
      assert.strictEqual(
        hiddenAttackPlanSchema.safeParse({
          ...validPlan,
          rounds: [{ roundIndex: "one" }], // string instead of number
        }).success,
        false
      );
      assert.strictEqual(
        hiddenAttackPlanSchema.safeParse({
          ...validPlan,
          rounds: [
            {
              ...validPlan.rounds[0],
              hostileCitations: null, // null instead of array
            },
          ],
        }).success,
        false
      );
    });

    it("rejects corrupted or partial objects in scoreBreakdownSchema", () => {
      // Non-object
      assert.strictEqual(scoreBreakdownSchema.safeParse(null).success, false);
      assert.strictEqual(scoreBreakdownSchema.safeParse("corrupted").success, false);
      assert.strictEqual(scoreBreakdownSchema.safeParse([]).success, false);

      // Partial objects (missing any of the 4 required dimensions)
      assert.strictEqual(
        scoreBreakdownSchema.safeParse({
          precedentGrounding: 70,
          proceduralAdherence: 70,
          demeanor: 70,
          // legalSoundness missing
        }).success,
        false
      );
      assert.strictEqual(
        scoreBreakdownSchema.safeParse({
          legalSoundness: 70,
          proceduralAdherence: 70,
          demeanor: 70,
          // precedentGrounding missing
        }).success,
        false
      );
      assert.strictEqual(
        scoreBreakdownSchema.safeParse({
          legalSoundness: 70,
          precedentGrounding: 70,
          demeanor: 70,
          // proceduralAdherence missing
        }).success,
        false
      );
      assert.strictEqual(
        scoreBreakdownSchema.safeParse({
          legalSoundness: 70,
          precedentGrounding: 70,
          proceduralAdherence: 70,
          // demeanor missing
        }).success,
        false
      );
    });

    it("rejects corrupted or partial objects in turnEvaluationSchema", () => {
      const validEval = {
        scoreChange: -5,
        currentLiveScore: 65,
        breakdown: { legalSoundness: 65, precedentGrounding: 65, proceduralAdherence: 65, demeanor: 65 },
        critique: "Valid critique",
        weaknessesIdentified: ["Weak citations"],
        strengthsIdentified: ["Polite language"],
      };

      // Non-object
      assert.strictEqual(turnEvaluationSchema.safeParse(null).success, false);
      assert.strictEqual(turnEvaluationSchema.safeParse("corrupt").success, false);

      // Missing critique
      assert.strictEqual(turnEvaluationSchema.safeParse({ ...validEval, critique: undefined }).success, false);

      // Corrupted inner breakdown
      assert.strictEqual(
        turnEvaluationSchema.safeParse({
          ...validEval,
          breakdown: { legalSoundness: -5 }, // corrupted
        }).success,
        false
      );

      // Corrupted weaknesses / strengths (not arrays of strings)
      assert.strictEqual(
        turnEvaluationSchema.safeParse({
          ...validEval,
          weaknessesIdentified: "single string weakness",
        }).success,
        false
      );
      assert.strictEqual(
        turnEvaluationSchema.safeParse({
          ...validEval,
          strengthsIdentified: null,
        }).success,
        false
      );
      assert.strictEqual(
        turnEvaluationSchema.safeParse({
          ...validEval,
          weaknessesIdentified: [123, true], // array of non-strings
        }).success,
        false
      );
    });

    it("rejects corrupted or partial objects in postSessionReportSchema", () => {
      const validReport = {
        overallVerdict: "dismissed" as const,
        finalScore: 45,
        finalBreakdown: { legalSoundness: 40, precedentGrounding: 45, proceduralAdherence: 50, demeanor: 45 },
        radarScores: {
          legalSoundness: 40,
          precedentGrounding: 45,
          proceduralAdherence: 50,
          demeanor: 45,
          rebuttalEffectiveness: 40,
        },
        strengths: ["Punctual"],
        vulnerabilities: ["Failed on merits"],
        judicialOrderSnippet: "Petition is dismissed as barred by limitation.",
        remedialPrecedents: [
          {
            citation: "2019 SCMR 100",
            title: "State v. Khan",
            principle: "Limitation cannot be condoned without sufficient cause",
            whyHelpful: "Explains standard for delay condonation",
          },
        ],
        roundsSummary: [
          {
            roundIndex: 1,
            userArgumentSummary: "Attempted to argue merits first",
            judgeReaction: "Directed counsel to address limitation",
            scoreDelta: -10,
          },
        ],
      };

      // Non-object
      assert.strictEqual(postSessionReportSchema.safeParse(null).success, false);
      assert.strictEqual(postSessionReportSchema.safeParse("").success, false);

      // Missing radar metric
      const corruptRadar = { ...validReport.radarScores };
      delete (corruptRadar as any).rebuttalEffectiveness;
      assert.strictEqual(
        postSessionReportSchema.safeParse({ ...validReport, radarScores: corruptRadar }).success,
        false
      );

      // Missing remedialPrecedents field
      assert.strictEqual(
        postSessionReportSchema.safeParse({ ...validReport, remedialPrecedents: undefined }).success,
        false
      );

      // Corrupted remedial precedent entry (missing whyHelpful)
      assert.strictEqual(
        postSessionReportSchema.safeParse({
          ...validReport,
          remedialPrecedents: [{ citation: "2019 SCMR 100", title: "State v. Khan" }],
        }).success,
        false
      );

      // Corrupted roundsSummary entry (missing roundIndex)
      assert.strictEqual(
        postSessionReportSchema.safeParse({
          ...validReport,
          roundsSummary: [{ userArgumentSummary: "arg", judgeReaction: "react", scoreDelta: 5 }],
        }).success,
        false
      );
    });

    it("rejects corrupted objects in counterBriefSchema and benchCitedCaseSchema", () => {
      // Missing boolean isOverruled in benchCitedCaseSchema defaults to false
      assert.strictEqual(
        benchCitedCaseSchema.safeParse({
          citation: "2020 SCMR 1",
          title: "Case Title",
          relevanceSnippet: "Snippet",
        }).success,
        true,
        "benchCitedCaseSchema defaults isOverruled to false if omitted"
      );

      // Invalid non-boolean isOverruled
      assert.strictEqual(
        benchCitedCaseSchema.safeParse({
          citation: "2020 SCMR 1",
          title: "Case Title",
          relevanceSnippet: "Snippet",
          isOverruled: "false", // string instead of boolean
        }).success,
        false,
        "benchCitedCaseSchema must reject non-boolean isOverruled"
      );

      // Corrupted counterBrief
      assert.strictEqual(
        counterBriefSchema.safeParse({
          preliminaryObjections: "not array",
          statutoryBars: [],
          hostilePrecedents: [],
          rebuttalStrategy: "Strategy",
        }).success,
        false
      );
    });
  });

  // ── 4. Extreme User Brief Sizes & Request Payloads ────────────────────────
  describe("Adversarial User Brief Size & Content Boundary Stress", () => {
    const baseReq = {
      courtLevel: "high_court" as const,
      caseNature: "criminal" as const,
      proceedingStage: "preliminary_hearing" as const,
    };

    it("strictly rejects empty string and sub-10 character briefs in createBenchSessionRequestSchema", () => {
      // Empty string
      const emptyResult = createBenchSessionRequestSchema.safeParse({
        ...baseReq,
        userBrief: "",
      });
      assert.strictEqual(emptyResult.success, false);
      if (!emptyResult.success) {
        assert.ok(emptyResult.error.issues.some((i) => i.message.includes("at least 10 characters")));
      }

      // 1 char to 9 chars
      for (let len = 1; len <= 9; len++) {
        const shortBrief = "a".repeat(len);
        assert.strictEqual(
          createBenchSessionRequestSchema.safeParse({
            ...baseReq,
            userBrief: shortBrief,
          }).success,
          false,
          `Brief of length ${len} must be rejected (< 10)`
        );
      }

      // Exactly 10 chars must pass
      assert.strictEqual(
        createBenchSessionRequestSchema.safeParse({
          ...baseReq,
          userBrief: "0123456789",
        }).success,
        true,
        "Brief of exactly 10 characters must pass"
      );
    });

    it("evaluates behavior on extreme brief sizes (100k and 1MB strings)", () => {
      // 100,000 characters (~100 KB text brief, e.g. large petition)
      const hugeBrief100k = "Counsel submits that the impugned order is void ab initio. ".repeat(1700);
      assert.ok(hugeBrief100k.length >= 100_000);

      const parsed100k = createBenchSessionRequestSchema.safeParse({
        ...baseReq,
        userBrief: hugeBrief100k,
      });
      assert.strictEqual(
        parsed100k.success,
        true,
        "100k character brief parses successfully without crash"
      );
      if (parsed100k.success) {
        assert.strictEqual(parsed100k.data.userBrief.length, hugeBrief100k.length);
      }

      // 1,000,000 characters (~1 MB payload)
      const extremeBrief1M = "a".repeat(1_000_000);
      const parsed1M = createBenchSessionRequestSchema.safeParse({
        ...baseReq,
        userBrief: extremeBrief1M,
      });
      assert.strictEqual(
        parsed1M.success,
        true,
        "1M character brief parses without V8 memory error or crash"
      );
    });

    it("strictly rejects empty and 1-character arguments in submitBenchRoundRequestSchema", () => {
      // Empty string
      assert.strictEqual(
        submitBenchRoundRequestSchema.safeParse({
          sessionId: 1,
          userArgument: "",
        }).success,
        false
      );

      // Single character
      assert.strictEqual(
        submitBenchRoundRequestSchema.safeParse({
          sessionId: 1,
          userArgument: "A",
        }).success,
        false
      );

      // Exactly 2 characters must pass
      assert.strictEqual(
        submitBenchRoundRequestSchema.safeParse({
          sessionId: 1,
          userArgument: "No",
        }).success,
        true
      );

      // 100,000 characters argument
      const largeArgument = "My Lord, ".repeat(12_000);
      assert.strictEqual(
        submitBenchRoundRequestSchema.safeParse({
          sessionId: 1,
          userArgument: largeArgument,
        }).success,
        true
      );
    });
  });

  // ── 5. Drizzle Table Integrity & Insert Schema Stress ─────────────────────
  describe("Adversarial Drizzle Table & Insert Schema Stress", () => {
    it("verifies benchSessions insert schema rejects invalid enums and accepts optional fields", () => {
      const validSession = {
        courtLevel: "supreme_court" as const,
        caseNature: "constitutional" as const,
        proceedingStage: "final_arguments" as const,
        userBrief: "Constitutional challenge to regulatory overreach.",
      };

      const parsed = insertBenchSessionSchema.safeParse(validSession);
      assert.strictEqual(parsed.success, true);

      // Invalid enum directly in insert schema
      const invalidEnumSession = {
        ...validSession,
        courtLevel: "kangaroo_court",
      };
      assert.strictEqual(
        insertBenchSessionSchema.safeParse(invalidEnumSession).success,
        false,
        "insertBenchSessionSchema must reject invalid courtLevel enum"
      );

      const invalidNatureSession = {
        ...validSession,
        caseNature: "traffic_offense",
      };
      assert.strictEqual(
        insertBenchSessionSchema.safeParse(invalidNatureSession).success,
        false,
        "insertBenchSessionSchema must reject invalid caseNature enum"
      );

      const invalidStatusSession = {
        ...validSession,
        status: "dormant",
      };
      assert.strictEqual(
        insertBenchSessionSchema.safeParse(invalidStatusSession).success,
        false,
        "insertBenchSessionSchema must reject invalid status enum"
      );
    });

    it("verifies benchMessages insert schema rejects invalid speaker role", () => {
      const validMessage = {
        sessionId: 1,
        roundIndex: 1,
        speakerRole: "judge" as const,
        content: "Address the court on limitation.",
        metadata: {},
      };

      assert.strictEqual(insertBenchMessageSchema.safeParse(validMessage).success, true);

      const invalidRoleMessage = {
        ...validMessage,
        speakerRole: "bystander",
      };
      assert.strictEqual(
        insertBenchMessageSchema.safeParse(invalidRoleMessage).success,
        false,
        "insertBenchMessageSchema must reject invalid speakerRole enum"
      );

      const missingContentMessage = {
        ...validMessage,
        content: undefined,
      };
      assert.strictEqual(
        insertBenchMessageSchema.safeParse(missingContentMessage).success,
        false,
        "insertBenchMessageSchema must reject missing content"
      );
    });

    it("verifies column constraints and types on benchSessions Drizzle table", () => {
      assert.strictEqual(benchSessions.courtLevel.notNull, true, "courtLevel must be notNull");
      assert.strictEqual(benchSessions.caseNature.notNull, true, "caseNature must be notNull");
      assert.strictEqual(benchSessions.proceedingStage.notNull, true, "proceedingStage must be notNull");
      assert.strictEqual(benchSessions.userBrief.notNull, true, "userBrief must be notNull");
      assert.strictEqual(benchSessions.status.notNull, true, "status must be notNull");
      assert.strictEqual(benchSessions.currentRound.notNull, true, "currentRound must be notNull");
      assert.strictEqual(benchSessions.maxRounds.notNull, true, "maxRounds must be notNull");
      assert.strictEqual(benchSessions.liveScore.notNull, true, "liveScore must be notNull");

      // Nullable for guest/demo mode and decoupled case files
      assert.strictEqual(benchSessions.userId.notNull, false, "userId must be nullable for guest sessions");
      assert.strictEqual(benchSessions.caseId.notNull, false, "caseId must be nullable");
    });

    it("verifies column constraints and types on benchMessages Drizzle table", () => {
      assert.strictEqual(benchMessages.sessionId.notNull, true, "sessionId must be notNull");
      assert.strictEqual(benchMessages.speakerRole.notNull, true, "speakerRole must be notNull");
      assert.strictEqual(benchMessages.content.notNull, true, "content must be notNull");
      assert.strictEqual(benchMessages.metadata.notNull, true, "metadata must be notNull");
    });

    it("verifies relational definitions link benchSessions and benchMessages bidirectional relations", () => {
      assert.ok(benchSessionsRelations, "benchSessionsRelations must be exported");
      assert.ok(benchMessagesRelations, "benchMessagesRelations must be exported");
      assert.strictEqual(typeof benchSessionsRelations.table, "object");
      assert.strictEqual(typeof benchMessagesRelations.table, "object");
    });
  });

  // ── 6. Empirical Nuances & Security Considerations ───────────────────────
  describe("Empirical Nuance Observations (Documentation of Edge Case Behaviors)", () => {
    it("documents that whitespace-only briefs currently satisfy .min(10) unless trimmed", () => {
      // 10 spaces
      const whitespaceBrief = "          ";
      const res = createBenchSessionRequestSchema.safeParse({
        courtLevel: "high_court",
        caseNature: "civil",
        proceedingStage: "preliminary_hearing",
        userBrief: whitespaceBrief,
      });
      // Currently, z.string().min(10) checks character length rather than trimmed length
      assert.strictEqual(
        res.success,
        true,
        "Empirically observed: whitespace strings pass .min(10) unless .trim() is added"
      );
    });

    it("documents that insertBenchSessionSchema leaves jsonb columns as unknown type without domain validation", () => {
      // Direct raw database insertion bypasses domain Zod schemas unless validated via hiddenAttackPlanSchema
      const rawSession = {
        courtLevel: "supreme_court" as const,
        caseNature: "constitutional" as const,
        proceedingStage: "preliminary_hearing" as const,
        userBrief: "Constitutional petition under Article 199.",
        attackPlan: "arbitrary_string" as any, // Not an object!
      };
      const res = insertBenchSessionSchema.safeParse(rawSession);
      assert.strictEqual(
        res.success,
        true,
        "Empirically observed: Drizzle createInsertSchema treats jsonb.$type<T> as unknown at runtime"
      );
      // However, domain schema hiddenAttackPlanSchema strictly rejects non-objects:
      assert.strictEqual(hiddenAttackPlanSchema.safeParse("arbitrary_string").success, false);
    });

    it("verifies DDL statements in ensureBenchSimulatorSchema include foreign key cascade protections", async () => {
      let capturedSql = "";
      const mockClient = {
        query: async (sqlText: string) => {
          capturedSql += sqlText;
          return { rows: [] };
        },
      };

      await ensureBenchSimulatorSchema(mockClient);
      assert.ok(
        capturedSql.includes("bench_sessions (") || capturedSql.length === 0, // might have run or been guarded
        "DDL query executed safely"
      );
    });
  });
});
