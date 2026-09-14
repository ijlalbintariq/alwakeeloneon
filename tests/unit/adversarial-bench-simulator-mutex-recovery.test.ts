import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Milestone 1 Adversarial Challenger M1_r2_2: Error Recovery & Mutex Failure Stress Tests", () => {
  // ── 1. Single Caller Transient Failure & Clean Recovery ────────────────────
  describe("Single Caller Transient Failure & Clean Recovery", () => {
    it("verifies transient query rejection (ECONNRESET) leaves benchSchemaEnsured false and resets mutex", async () => {
      const { ensureBenchSimulatorSchema, _resetBenchSimulatorSchemaState } = await import(
        "../../server/storage"
      );
      _resetBenchSimulatorSchemaState();

      let failedQueryCount = 0;
      const transientFailingClient = {
        query: async () => {
          failedQueryCount++;
          const err: any = new Error("read ECONNRESET");
          err.code = "ECONNRESET";
          throw err;
        },
      };

      // Call 1: Must survive connection reset error without unhandled rejection
      await assert.doesNotReject(async () => {
        await ensureBenchSimulatorSchema(transientFailingClient);
      });
      assert.strictEqual(failedQueryCount, 1, "Initial call dispatched failed query");

      // Call 2: Healthy client. If mutex was stuck or benchSchemaEnsured was true,
      // this would either deadlock or skip. It must execute cleanly.
      let healthyQueryCount = 0;
      const healthyClient = {
        query: async (sqlText: string) => {
          healthyQueryCount++;
          assert.ok(
            sqlText.includes("CREATE TABLE IF NOT EXISTS bench_sessions"),
            "Query must contain bench_sessions DDL"
          );
          return { rows: [] };
        },
      };

      await ensureBenchSimulatorSchema(healthyClient);
      assert.strictEqual(
        healthyQueryCount,
        1,
        "Healthy client must successfully execute query after transient failure"
      );

      // Call 3: Subsequent call with healthy client must skip query (benchSchemaEnsured is true)
      await ensureBenchSimulatorSchema(healthyClient);
      assert.strictEqual(
        healthyQueryCount,
        1,
        "Subsequent call must skip query once schema is ensured"
      );
    });

    it("verifies _resetBenchSimulatorSchemaState clears ensured flag and allows re-execution", async () => {
      const { ensureBenchSimulatorSchema, _resetBenchSimulatorSchemaState } = await import(
        "../../server/storage"
      );
      _resetBenchSimulatorSchemaState();

      let queryExecutions = 0;
      const mockClient = {
        query: async () => {
          queryExecutions++;
          return { rows: [] };
        },
      };

      await ensureBenchSimulatorSchema(mockClient);
      assert.strictEqual(queryExecutions, 1);

      await ensureBenchSimulatorSchema(mockClient);
      assert.strictEqual(queryExecutions, 1, "Should be skipped while ensured");

      // Reset state
      _resetBenchSimulatorSchemaState();

      // Now query should run again
      await ensureBenchSimulatorSchema(mockClient);
      assert.strictEqual(queryExecutions, 2, "Should re-execute query after state reset");
    });
  });

  // ── 2. Concurrent Callers During Transient Failure & Mutex Reset ──────────
  describe("Concurrent Callers During Transient Failure & Mutex Poisoning Check", () => {
    it("deduplicates concurrent callers during failure and cleanly unlocks for subsequent retry", async () => {
      const { ensureBenchSimulatorSchema, _resetBenchSimulatorSchemaState } = await import(
        "../../server/storage"
      );
      _resetBenchSimulatorSchemaState();

      let failureQueryCount = 0;
      let activeConcurrentFailureQueries = 0;
      let maxConcurrentFailureQueries = 0;

      const delayedFailingClient = {
        query: async () => {
          failureQueryCount++;
          activeConcurrentFailureQueries++;
          if (activeConcurrentFailureQueries > maxConcurrentFailureQueries) {
            maxConcurrentFailureQueries = activeConcurrentFailureQueries;
          }
          // Simulate network latency before server abruptly drops connection
          await new Promise((resolve) => setTimeout(resolve, 40));
          activeConcurrentFailureQueries--;
          const err: any = new Error("server closed the connection unexpectedly (57P01)");
          err.code = "57P01";
          throw err;
        },
      };

      // Dispatch 5 concurrent callers into the failing client
      const failingPromises = Array.from({ length: 5 }, () =>
        ensureBenchSimulatorSchema(delayedFailingClient)
      );

      // All 5 must resolve cleanly (swallowed/logged as per storage.ts design)
      await assert.doesNotReject(async () => {
        await Promise.all(failingPromises);
      });

      // Proof of single-flight mutex even during failure
      assert.strictEqual(
        failureQueryCount,
        1,
        "Concurrent failing callers must coalesce into exactly 1 query execution"
      );
      assert.strictEqual(
        maxConcurrentFailureQueries,
        1,
        "Max concurrent active queries during failure must be 1"
      );

      // Now dispatch 5 new concurrent callers into a healthy client
      let healthyQueryCount = 0;
      let activeConcurrentHealthyQueries = 0;
      let maxConcurrentHealthyQueries = 0;

      const delayedHealthyClient = {
        query: async () => {
          healthyQueryCount++;
          activeConcurrentHealthyQueries++;
          if (activeConcurrentHealthyQueries > maxConcurrentHealthyQueries) {
            maxConcurrentHealthyQueries = activeConcurrentHealthyQueries;
          }
          await new Promise((resolve) => setTimeout(resolve, 30));
          activeConcurrentHealthyQueries--;
          return { rows: [] };
        },
      };

      const healthyPromises = Array.from({ length: 5 }, () =>
        ensureBenchSimulatorSchema(delayedHealthyClient)
      );

      await Promise.all(healthyPromises);

      // Proof that mutex was cleanly released (not poisoned by prior failure)
      assert.strictEqual(
        healthyQueryCount,
        1,
        "New concurrent callers must coalesce into exactly 1 healthy query after failure recovery"
      );
      assert.strictEqual(
        maxConcurrentHealthyQueries,
        1,
        "Max concurrent active queries during recovery must be 1"
      );

      // Final check: 6th caller should immediately return without querying
      await ensureBenchSimulatorSchema(delayedHealthyClient);
      assert.strictEqual(
        healthyQueryCount,
        1,
        "Post-recovery calls must no-op without running query"
      );
    });
  });

  // ── 3. Cascading Consecutive Transient Failures Before Recovery ───────────
  describe("Cascading Consecutive Transient Failures Before Recovery", () => {
    it("handles multiple sequential transient failures without mutex deadlock", async () => {
      const { ensureBenchSimulatorSchema, _resetBenchSimulatorSchemaState } = await import(
        "../../server/storage"
      );
      _resetBenchSimulatorSchemaState();

      let attempts = 0;
      const flakyClient = {
        query: async () => {
          attempts++;
          if (attempts === 1) throw new Error("ETIMEDOUT: connect timed out");
          if (attempts === 2) throw new Error("ECONNREFUSED 127.0.0.1:5432");
          if (attempts === 3) throw new Error("EHOSTUNREACH");
          // Attempt 4: Success
          return { rows: [] };
        },
      };

      // Attempts 1 to 3 fail sequentially
      await ensureBenchSimulatorSchema(flakyClient);
      assert.strictEqual(attempts, 1, "Attempt 1 failed");

      await ensureBenchSimulatorSchema(flakyClient);
      assert.strictEqual(attempts, 2, "Attempt 2 failed");

      await ensureBenchSimulatorSchema(flakyClient);
      assert.strictEqual(attempts, 3, "Attempt 3 failed");

      // Attempt 4 succeeds
      await ensureBenchSimulatorSchema(flakyClient);
      assert.strictEqual(attempts, 4, "Attempt 4 succeeded");

      // Attempt 5 skips
      await ensureBenchSimulatorSchema(flakyClient);
      assert.strictEqual(attempts, 4, "Attempt 5 skipped because schema is ensured");
    });
  });

  // ── 4. Non-Standard Rejection Types & Synchronous Throws ──────────────────
  describe("Non-Standard Error Payloads & Synchronous Throw Resilience", () => {
    it("handles synchronous throw inside client.query without unhandled promise rejection", async () => {
      const { ensureBenchSimulatorSchema, _resetBenchSimulatorSchemaState } = await import(
        "../../server/storage"
      );
      _resetBenchSimulatorSchemaState();

      const syncThrowingClient = {
        query: () => {
          throw new TypeError("sync socket failure: connection destroyed");
        },
      };

      await assert.doesNotReject(async () => {
        await ensureBenchSimulatorSchema(syncThrowingClient);
      });

      // Confirm mutex recovered and next healthy call works
      let recovered = false;
      const healthyClient = {
        query: async () => {
          recovered = true;
          return { rows: [] };
        },
      };

      await ensureBenchSimulatorSchema(healthyClient);
      assert.strictEqual(recovered, true, "Must recover after synchronous client throw");
    });

    it("handles non-Error rejection payloads (string and raw object) gracefully", async () => {
      const { ensureBenchSimulatorSchema, _resetBenchSimulatorSchemaState } = await import(
        "../../server/storage"
      );
      _resetBenchSimulatorSchemaState();

      const stringRejectClient = {
        query: async () => {
          throw "Database connection dropped abruptly";
        },
      };

      await assert.doesNotReject(async () => {
        await ensureBenchSimulatorSchema(stringRejectClient);
      });

      const objectRejectClient = {
        query: async () => {
          throw { code: "FATAL_CRASH", details: { reason: "OOM killer killed postgres" } };
        },
      };

      await assert.doesNotReject(async () => {
        await ensureBenchSimulatorSchema(objectRejectClient);
      });

      // Confirm healthy recovery
      let recovered = false;
      const healthyClient = {
        query: async () => {
          recovered = true;
          return { rows: [] };
        },
      };

      await ensureBenchSimulatorSchema(healthyClient);
      assert.strictEqual(recovered, true, "Must recover cleanly after non-Error rejections");
    });
  });

  // ── 5. Rapid Randomized Failure/Recovery Stress Cycles ────────────────────
  describe("Rapid Randomized Failure/Recovery Stress Cycles", () => {
    it("executes 25 randomized cycles of transient failures and resets without deadlocks or state leak", async () => {
      const { ensureBenchSimulatorSchema, _resetBenchSimulatorSchemaState } = await import(
        "../../server/storage"
      );

      for (let cycle = 1; cycle <= 25; cycle++) {
        _resetBenchSimulatorSchemaState();

        let failAttempts = 0;
        let successAttempts = 0;

        const dynamicClient = {
          query: async () => {
            // First 2 calls fail, 3rd succeeds
            if (failAttempts < 2) {
              failAttempts++;
              throw new Error(`Transient failure in cycle ${cycle} attempt ${failAttempts}`);
            }
            successAttempts++;
            return { rows: [] };
          },
        };

        // Fire 4 concurrent requests
        await Promise.all([
          ensureBenchSimulatorSchema(dynamicClient),
          ensureBenchSimulatorSchema(dynamicClient),
          ensureBenchSimulatorSchema(dynamicClient),
          ensureBenchSimulatorSchema(dynamicClient),
        ]);

        // In this first wave, the single flight failed
        assert.strictEqual(failAttempts, 1, `Cycle ${cycle}: Wave 1 failed exactly once`);
        assert.strictEqual(successAttempts, 0, `Cycle ${cycle}: Wave 1 had 0 successes`);

        // Second wave: another failing attempt
        await ensureBenchSimulatorSchema(dynamicClient);
        assert.strictEqual(failAttempts, 2, `Cycle ${cycle}: Wave 2 failed second attempt`);

        // Third wave: 4 concurrent requests, should trigger 3rd attempt which succeeds
        await Promise.all([
          ensureBenchSimulatorSchema(dynamicClient),
          ensureBenchSimulatorSchema(dynamicClient),
          ensureBenchSimulatorSchema(dynamicClient),
          ensureBenchSimulatorSchema(dynamicClient),
        ]);

        assert.strictEqual(successAttempts, 1, `Cycle ${cycle}: Wave 3 succeeded exactly once`);

        // Fourth wave: should no-op
        await ensureBenchSimulatorSchema(dynamicClient);
        assert.strictEqual(successAttempts, 1, `Cycle ${cycle}: Wave 4 skipped querying`);
      }
    });
  });
});
