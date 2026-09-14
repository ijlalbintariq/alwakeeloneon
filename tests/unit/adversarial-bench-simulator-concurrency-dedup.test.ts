import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Milestone 1 Adversarial Challenger M1_r2_1: Concurrency Deduplication Stress Test", () => {
  // Helper to create a latency-simulating mock client
  function createLatencyMockClient(options: { minLatencyMs: number; maxLatencyMs: number }) {
    let queryCount = 0;
    let activeConcurrentQueries = 0;
    let maxConcurrentQueries = 0;
    const executedSqls: string[] = [];

    const client = {
      query: async (sql: string) => {
        queryCount++;
        activeConcurrentQueries++;
        if (activeConcurrentQueries > maxConcurrentQueries) {
          maxConcurrentQueries = activeConcurrentQueries;
        }
        executedSqls.push(sql);

        // Simulate network / database execution latency (25ms - 50ms)
        const latency =
          options.minLatencyMs === options.maxLatencyMs
            ? options.minLatencyMs
            : options.minLatencyMs +
              Math.floor(Math.random() * (options.maxLatencyMs - options.minLatencyMs + 1));
        await new Promise((resolve) => setTimeout(resolve, latency));

        activeConcurrentQueries--;
        return { rows: [] };
      },
    };

    return {
      client,
      getStats: () => ({
        queryCount,
        maxConcurrentQueries,
        activeConcurrentQueries,
        executedSqls,
      }),
    };
  }

  // ── 1. Batch Stress: 10 Concurrent Invocations ───────────────────────────
  describe("Batch Stress: 10 Concurrent Invocations", () => {
    it("deduplicates 10 concurrent invocations with 25-50ms latency to queryCount === 1 and maxConcurrentQueries === 1", async () => {
      const { ensureBenchSimulatorSchema, _resetBenchSimulatorSchemaState } = await import(
        "../../server/storage"
      );
      _resetBenchSimulatorSchemaState();

      const { client, getStats } = createLatencyMockClient({
        minLatencyMs: 25,
        maxLatencyMs: 50,
      });

      // 10 concurrent invocations
      const promises = Array.from({ length: 10 }, () => ensureBenchSimulatorSchema(client));
      await Promise.all(promises);

      const stats = getStats();
      console.log(`[Batch 10] Dispatched: ${stats.queryCount}, Max Concurrent: ${stats.maxConcurrentQueries}`);

      assert.strictEqual(
        stats.queryCount,
        1,
        "Exactly 1 query must be dispatched for 10 concurrent callers"
      );
      assert.strictEqual(
        stats.maxConcurrentQueries,
        1,
        "Maximum active concurrent queries must be exactly 1"
      );
      assert.strictEqual(
        stats.activeConcurrentQueries,
        0,
        "No active queries should remain"
      );
      assert.ok(
        stats.executedSqls[0].includes("CREATE TABLE IF NOT EXISTS bench_sessions"),
        "Executed query must contain bench_sessions DDL"
      );

      // Sequential calls after completion execute 0 queries
      for (let i = 0; i < 5; i++) {
        await ensureBenchSimulatorSchema(client);
      }
      assert.strictEqual(
        getStats().queryCount,
        1,
        "Sequential calls after completion must execute 0 queries (queryCount remains 1)"
      );
    });
  });

  // ── 2. Batch Stress: 20 Concurrent Invocations ───────────────────────────
  describe("Batch Stress: 20 Concurrent Invocations", () => {
    it("deduplicates 20 concurrent invocations with 25-50ms latency to queryCount === 1 and maxConcurrentQueries === 1", async () => {
      const { ensureBenchSimulatorSchema, _resetBenchSimulatorSchemaState } = await import(
        "../../server/storage"
      );
      _resetBenchSimulatorSchemaState();

      const { client, getStats } = createLatencyMockClient({
        minLatencyMs: 25,
        maxLatencyMs: 50,
      });

      // 20 concurrent invocations
      const promises = Array.from({ length: 20 }, () => ensureBenchSimulatorSchema(client));
      await Promise.all(promises);

      const stats = getStats();
      console.log(`[Batch 20] Dispatched: ${stats.queryCount}, Max Concurrent: ${stats.maxConcurrentQueries}`);

      assert.strictEqual(
        stats.queryCount,
        1,
        "Exactly 1 query must be dispatched for 20 concurrent callers"
      );
      assert.strictEqual(
        stats.maxConcurrentQueries,
        1,
        "Maximum active concurrent queries must be exactly 1"
      );
      assert.strictEqual(
        stats.activeConcurrentQueries,
        0,
        "No active queries should remain"
      );

      // Sequential calls after completion execute 0 queries
      for (let i = 0; i < 10; i++) {
        await ensureBenchSimulatorSchema(client);
      }
      assert.strictEqual(
        getStats().queryCount,
        1,
        "Sequential calls after completion must execute 0 queries (queryCount remains 1)"
      );
    });
  });

  // ── 3. Batch Stress: 50 Concurrent Invocations ───────────────────────────
  describe("Batch Stress: 50 Concurrent Invocations", () => {
    it("deduplicates 50 concurrent invocations with 25-50ms latency to queryCount === 1 and maxConcurrentQueries === 1", async () => {
      const { ensureBenchSimulatorSchema, _resetBenchSimulatorSchemaState } = await import(
        "../../server/storage"
      );
      _resetBenchSimulatorSchemaState();

      const { client, getStats } = createLatencyMockClient({
        minLatencyMs: 25,
        maxLatencyMs: 50,
      });

      // 50 concurrent invocations
      const promises = Array.from({ length: 50 }, () => ensureBenchSimulatorSchema(client));
      await Promise.all(promises);

      const stats = getStats();
      console.log(`[Batch 50] Dispatched: ${stats.queryCount}, Max Concurrent: ${stats.maxConcurrentQueries}`);

      assert.strictEqual(
        stats.queryCount,
        1,
        "Exactly 1 query must be dispatched for 50 concurrent callers"
      );
      assert.strictEqual(
        stats.maxConcurrentQueries,
        1,
        "Maximum active concurrent queries must be exactly 1"
      );
      assert.strictEqual(
        stats.activeConcurrentQueries,
        0,
        "No active queries should remain"
      );

      // Sequential calls after completion execute 0 queries
      for (let i = 0; i < 20; i++) {
        await ensureBenchSimulatorSchema(client);
      }
      assert.strictEqual(
        getStats().queryCount,
        1,
        "Sequential calls after completion must execute 0 queries (queryCount remains 1)"
      );
    });
  });

  // ── 4. Staggered Arrival Concurrency During In-Flight Window ───────────────
  describe("Staggered Arrival Concurrency During In-Flight Latency Window", () => {
    it("coalesces staggered callers arriving at intervals throughout an active 50ms query", async () => {
      const { ensureBenchSimulatorSchema, _resetBenchSimulatorSchemaState } = await import(
        "../../server/storage"
      );
      _resetBenchSimulatorSchemaState();

      const { client, getStats } = createLatencyMockClient({
        minLatencyMs: 50,
        maxLatencyMs: 50,
      });

      // Caller 0 starts at t=0ms
      const promise0 = ensureBenchSimulatorSchema(client);

      // Callers arrive at t=5ms, t=10ms, t=15ms, t=20ms, t=25ms, t=30ms, t=35ms
      const staggeredPromises: Promise<void>[] = [promise0];
      for (let delay = 5; delay <= 35; delay += 5) {
        staggeredPromises.push(
          (async () => {
            await new Promise((resolve) => setTimeout(resolve, delay));
            return ensureBenchSimulatorSchema(client);
          })()
        );
      }

      await Promise.all(staggeredPromises);

      const stats = getStats();
      console.log(
        `[Staggered] Dispatched: ${stats.queryCount}, Max Concurrent: ${stats.maxConcurrentQueries}`
      );

      assert.strictEqual(
        stats.queryCount,
        1,
        "All staggered callers arriving during active query must coalesce to exactly 1 query"
      );
      assert.strictEqual(
        stats.maxConcurrentQueries,
        1,
        "Maximum concurrent active queries must be exactly 1"
      );

      // Post-completion calls execute 0 queries
      await ensureBenchSimulatorSchema(client);
      assert.strictEqual(getStats().queryCount, 1, "Subsequent call executes 0 queries");
    });
  });

  // ── 5. Rapid Sequential Burst Post-Completion ─────────────────────────────
  describe("Rapid Sequential Burst Post-Completion", () => {
    it("executes 100 rapid sequential calls post-completion with zero additional queries", async () => {
      const { ensureBenchSimulatorSchema, _resetBenchSimulatorSchemaState } = await import(
        "../../server/storage"
      );
      _resetBenchSimulatorSchemaState();

      const { client, getStats } = createLatencyMockClient({
        minLatencyMs: 25,
        maxLatencyMs: 25,
      });

      // Initial execution
      await ensureBenchSimulatorSchema(client);
      assert.strictEqual(getStats().queryCount, 1);

      // Rapid burst of 100 sequential calls
      for (let i = 0; i < 100; i++) {
        await ensureBenchSimulatorSchema(client);
      }

      assert.strictEqual(
        getStats().queryCount,
        1,
        "100 sequential calls post-completion must produce 0 additional queries"
      );
    });
  });

  // ── 6. State Reset and Multi-Cycle Concurrency Verification ──────────────
  describe("State Reset and Multi-Cycle Concurrency Verification", () => {
    it("verifies clean re-initialization and deduplication across multiple reset cycles", async () => {
      const { ensureBenchSimulatorSchema, _resetBenchSimulatorSchemaState } = await import(
        "../../server/storage"
      );

      for (const concurrency of [10, 20, 50]) {
        _resetBenchSimulatorSchemaState();

        const { client, getStats } = createLatencyMockClient({
          minLatencyMs: 25,
          maxLatencyMs: 40,
        });

        const promises = Array.from({ length: concurrency }, () =>
          ensureBenchSimulatorSchema(client)
        );
        await Promise.all(promises);

        const stats = getStats();
        assert.strictEqual(
          stats.queryCount,
          1,
          `Cycle (${concurrency} callers) must execute exactly 1 query`
        );
        assert.strictEqual(
          stats.maxConcurrentQueries,
          1,
          `Cycle (${concurrency} callers) max concurrent queries must be 1`
        );

        // Subsequent sequential call
        await ensureBenchSimulatorSchema(client);
        assert.strictEqual(
          getStats().queryCount,
          1,
          `Cycle (${concurrency} callers) sequential call must execute 0 queries`
        );
      }
    });
  });
});
