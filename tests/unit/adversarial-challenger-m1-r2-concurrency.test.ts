import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  ensureBenchSimulatorSchema,
  _resetBenchSimulatorSchemaState,
} from "../../server/storage";

describe("Milestone 1 Iteration 2 Challenger: Concurrency Deduplication & Single-Flight Mutex", () => {
  beforeEach(() => {
    _resetBenchSimulatorSchemaState();
  });

  // ── 1. Mandatory Scaling Stress Tests (10, 20, 50 Concurrent Invocations) ───
  describe("Concurrency Deduplication Under Simulated Network Latency", () => {
    it("deduplicates 10 concurrent invocations with 30ms latency to exactly 1 query", async () => {
      let queryCount = 0;
      let activeQueries = 0;
      let maxConcurrentQueries = 0;
      const capturedSql: string[] = [];

      const mockClient = {
        query: async (sqlText: string) => {
          queryCount++;
          activeQueries++;
          if (activeQueries > maxConcurrentQueries) {
            maxConcurrentQueries = activeQueries;
          }
          capturedSql.push(sqlText);
          // Simulate 30ms network / execution latency
          await new Promise((resolve) => setTimeout(resolve, 30));
          activeQueries--;
          return { rows: [] };
        },
      };

      const concurrency = 10;
      const promises = Array.from({ length: concurrency }, () =>
        ensureBenchSimulatorSchema(mockClient)
      );

      const results = await Promise.all(promises);

      // Assertions
      assert.strictEqual(results.length, 10, "All 10 callers must resolve");
      assert.strictEqual(
        queryCount,
        1,
        `Expected exactly 1 query dispatched for 10 concurrent callers, got ${queryCount}`
      );
      assert.strictEqual(
        maxConcurrentQueries,
        1,
        `Expected maxConcurrentQueries to be 1, got ${maxConcurrentQueries}`
      );
      assert.strictEqual(
        activeQueries,
        0,
        "All active query counts must return to 0"
      );

      // Verify sequential calls after completion execute 0 queries
      await ensureBenchSimulatorSchema(mockClient);
      await ensureBenchSimulatorSchema(mockClient);
      await ensureBenchSimulatorSchema(mockClient);
      await ensureBenchSimulatorSchema(mockClient);
      await ensureBenchSimulatorSchema(mockClient);

      assert.strictEqual(
        queryCount,
        1,
        "Sequential calls after completion must execute 0 additional queries"
      );
    });

    it("deduplicates 20 concurrent invocations with 40ms latency to exactly 1 query", async () => {
      let queryCount = 0;
      let activeQueries = 0;
      let maxConcurrentQueries = 0;

      const mockClient = {
        query: async (sqlText: string) => {
          queryCount++;
          activeQueries++;
          if (activeQueries > maxConcurrentQueries) {
            maxConcurrentQueries = activeQueries;
          }
          // Simulate 40ms network latency
          await new Promise((resolve) => setTimeout(resolve, 40));
          activeQueries--;
          return { rows: [] };
        },
      };

      const concurrency = 20;
      const promises = Array.from({ length: concurrency }, () =>
        ensureBenchSimulatorSchema(mockClient)
      );

      const results = await Promise.all(promises);

      assert.strictEqual(results.length, 20, "All 20 callers must resolve");
      assert.strictEqual(
        queryCount,
        1,
        `Expected exactly 1 query dispatched for 20 concurrent callers, got ${queryCount}`
      );
      assert.strictEqual(
        maxConcurrentQueries,
        1,
        `Expected maxConcurrentQueries to be 1, got ${maxConcurrentQueries}`
      );

      // Verify 10 subsequent sequential calls execute 0 additional queries
      for (let i = 0; i < 10; i++) {
        await ensureBenchSimulatorSchema(mockClient);
      }
      assert.strictEqual(
        queryCount,
        1,
        "10 sequential calls after completion must execute 0 additional queries"
      );
    });

    it("deduplicates 50 concurrent invocations with 50ms latency to exactly 1 query", async () => {
      let queryCount = 0;
      let activeQueries = 0;
      let maxConcurrentQueries = 0;

      const mockClient = {
        query: async (sqlText: string) => {
          queryCount++;
          activeQueries++;
          if (activeQueries > maxConcurrentQueries) {
            maxConcurrentQueries = activeQueries;
          }
          // Simulate 50ms network latency
          await new Promise((resolve) => setTimeout(resolve, 50));
          activeQueries--;
          return { rows: [] };
        },
      };

      const concurrency = 50;
      const promises = Array.from({ length: concurrency }, () =>
        ensureBenchSimulatorSchema(mockClient)
      );

      const results = await Promise.all(promises);

      assert.strictEqual(results.length, 50, "All 50 callers must resolve");
      assert.strictEqual(
        queryCount,
        1,
        `Expected exactly 1 query dispatched for 50 concurrent callers, got ${queryCount}`
      );
      assert.strictEqual(
        maxConcurrentQueries,
        1,
        `Expected maxConcurrentQueries to be 1, got ${maxConcurrentQueries}`
      );

      // Verify 20 subsequent sequential calls execute 0 additional queries
      for (let i = 0; i < 20; i++) {
        await ensureBenchSimulatorSchema(mockClient);
      }
      assert.strictEqual(
        queryCount,
        1,
        "20 sequential calls after completion must execute 0 additional queries"
      );
    });
  });

  // ── 2. Adversarial Staggered & Jittered Arrivals ───────────────────────────
  describe("Adversarial Jittered Arrivals During In-Flight Execution", () => {
    it("handles 50 callers arriving with staggered random micro-delays (0-25ms) while 50ms query is in-flight", async () => {
      let queryCount = 0;
      let activeQueries = 0;
      let maxConcurrentQueries = 0;

      const mockClient = {
        query: async (sqlText: string) => {
          queryCount++;
          activeQueries++;
          if (activeQueries > maxConcurrentQueries) {
            maxConcurrentQueries = activeQueries;
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
          activeQueries--;
          return { rows: [] };
        },
      };

      // Stagger 50 callers over 0ms to 25ms, all arriving before the 50ms query resolves
      const promises = Array.from({ length: 50 }, async (_, idx) => {
        const staggerDelay = (idx % 10) * 2.5; // 0ms to 22.5ms
        if (staggerDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, staggerDelay));
        }
        return ensureBenchSimulatorSchema(mockClient);
      });

      await Promise.all(promises);

      assert.strictEqual(
        queryCount,
        1,
        `Staggered callers must all join in-flight promise; queryCount must be 1, got ${queryCount}`
      );
      assert.strictEqual(
        maxConcurrentQueries,
        1,
        `maxConcurrentQueries must remain 1 under jittered arrivals, got ${maxConcurrentQueries}`
      );

      // Sequential verification
      await ensureBenchSimulatorSchema(mockClient);
      assert.strictEqual(queryCount, 1);
    });
  });

  // ── 3. Mutex Recovery & Resilience After Error ─────────────────────────────
  describe("Single-Flight Mutex Error Resilience & Retry", () => {
    it("resets mutex on query rejection and allows subsequent retry to succeed", async () => {
      let attempts = 0;
      const failingClient = {
        query: async () => {
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 20));
          throw new Error("Simulated PostgreSQL connection timeout or deadlock");
        },
      };

      // Fire 10 concurrent calls on failing client
      const failPromises = Array.from({ length: 10 }, () =>
        ensureBenchSimulatorSchema(failingClient)
      );

      // In ensureBenchSimulatorSchema, errors are caught and logged, not rethrown
      await Promise.all(failPromises);

      assert.strictEqual(
        attempts,
        1,
        "Failing in-flight query must be executed exactly once among 10 concurrent callers"
      );

      // Because the first query failed, benchSchemaEnsured must NOT be set to true
      // and benchSchemaEnsuringPromise must have been reset to null in finally.
      // Now a subsequent healthy client should be able to execute and succeed!
      let healthyQueryCount = 0;
      const healthyClient = {
        query: async () => {
          healthyQueryCount++;
          await new Promise((resolve) => setTimeout(resolve, 20));
          return { rows: [] };
        },
      };

      await ensureBenchSimulatorSchema(healthyClient);
      assert.strictEqual(
        healthyQueryCount,
        1,
        "Healthy retry must execute 1 query following previous failure"
      );

      // Now that healthy execution succeeded, subsequent calls should skip
      await ensureBenchSimulatorSchema(healthyClient);
      assert.strictEqual(
        healthyQueryCount,
        1,
        "Post-recovery calls must be idempotent and execute 0 queries"
      );
    });
  });

  // ── 4. DDL Structural Completeness ─────────────────────────────────────────
  describe("DDL Structural Validation", () => {
    it("verifies the single executed DDL query creates both tables and all indexes with IF NOT EXISTS", async () => {
      let capturedSql = "";
      const mockClient = {
        query: async (sqlText: string) => {
          capturedSql = sqlText;
          return { rows: [] };
        },
      };

      await ensureBenchSimulatorSchema(mockClient);

      assert.ok(
        capturedSql.includes("CREATE TABLE IF NOT EXISTS bench_sessions"),
        "DDL must create bench_sessions idempotently"
      );
      assert.ok(
        capturedSql.includes("CREATE TABLE IF NOT EXISTS bench_messages"),
        "DDL must create bench_messages idempotently"
      );
      assert.ok(
        capturedSql.includes("idx_bench_sessions_user_id"),
        "DDL must create idx_bench_sessions_user_id"
      );
      assert.ok(
        capturedSql.includes("idx_bench_messages_session_id"),
        "DDL must create idx_bench_messages_session_id"
      );
      assert.ok(
        capturedSql.includes("ALTER TABLE bench_sessions ADD COLUMN IF NOT EXISTS"),
        "DDL must contain migration columns for bench_sessions"
      );
      assert.ok(
        capturedSql.includes("ALTER TABLE bench_messages ADD COLUMN IF NOT EXISTS"),
        "DDL must contain migration columns for bench_messages"
      );
    });
  });
});
