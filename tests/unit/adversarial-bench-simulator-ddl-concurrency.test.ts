import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Milestone 1 Adversarial Challenger M1.2: DDL Migration & Concurrency Stress Test", () => {
  // ── 1. Custom Client & dbAvailable Guard Stress Testing ────────────────────
  describe("Custom Client & dbAvailable Guard Stress Testing", () => {
    it("empirically demonstrates whether ensureBenchSimulatorSchema executes when dbAvailable is false", async () => {
      const { ensureBenchSimulatorSchema, _resetBenchSimulatorSchemaState } = await import("../../server/storage");
      if (_resetBenchSimulatorSchemaState) _resetBenchSimulatorSchemaState();

      const executedQueries: string[] = [];
      const mockClient = {
        query: async (sqlText: string) => {
          executedQueries.push(sqlText);
          return { rows: [] };
        },
      };

      await ensureBenchSimulatorSchema(mockClient);

      console.log(
        `[Remediated Test 1] Queries executed on mockClient when dbAvailable is false: ${executedQueries.length}`
      );
      assert.strictEqual(
        executedQueries.length,
        1,
        "Custom client must be executed exactly once even when dbAvailable is false"
      );
      assert.ok(
        executedQueries[0].includes("CREATE TABLE IF NOT EXISTS bench_sessions"),
        "Executed query must contain bench_sessions DDL"
      );
    });

    it("verifies safe no-op when activePool is null or undefined without uncaught exceptions", async () => {
      const { ensureBenchSimulatorSchema } = await import("../../server/storage");

      await assert.doesNotReject(async () => {
        await ensureBenchSimulatorSchema(null);
      });
      await assert.doesNotReject(async () => {
        await ensureBenchSimulatorSchema(undefined);
      });
    });
  });

  // ── 2. Concurrency Race Conditions & Single-Flight Mutex ─────────────────
  describe("Concurrency Race Conditions & In-Flight Dispatch", () => {
    it("empirically demonstrates single-flight deduplication when multiple callers invoke ensureBenchSimulatorSchema simultaneously", async () => {
      // To test real DDL execution, we simulate an environment where dbAvailable is true
      // We isolate the test using a child process or module mocking to accurately measure dispatched queries
      const { spawnSync } = await import("node:child_process");

      const testScript = `
        process.env.DATABASE_URL = "postgres://dummy:dummy@example.com:5432/db";
        process.env.PGHOST = "example.com";
        const { ensureBenchSimulatorSchema } = await import("./server/storage");
        
        let queryCount = 0;
        let activeConcurrentQueries = 0;
        let maxConcurrentQueries = 0;

        const mockClient = {
          query: async (sql) => {
            queryCount++;
            activeConcurrentQueries++;
            if (activeConcurrentQueries > maxConcurrentQueries) {
              maxConcurrentQueries = activeConcurrentQueries;
            }
            // Simulate 50ms database execution latency
            await new Promise((resolve) => setTimeout(resolve, 50));
            activeConcurrentQueries--;
            return { rows: [] };
          }
        };

        // Fire 10 concurrent requests simultaneously
        await Promise.all(
          Array.from({ length: 10 }, () => ensureBenchSimulatorSchema(mockClient))
        );

        console.log(JSON.stringify({ queryCount, maxConcurrentQueries }));
      `;

      const proc = spawnSync("node", ["--import", "tsx", "-e", testScript], {
        cwd: process.cwd(),
        encoding: "utf8",
      });

      assert.strictEqual(proc.status, 0, `Process failed: ${proc.stderr}`);

      // Extract JSON result from stdout
      const lines = proc.stdout.trim().split("\n");
      const jsonLine = lines.find((l) => l.startsWith("{") && l.endsWith("}"));
      assert.ok(jsonLine, `Could not find JSON output in stdout: ${proc.stdout}`);

      const { queryCount, maxConcurrentQueries } = JSON.parse(jsonLine);
      console.log(
        `[Empirical Test 2] Total queries dispatched: ${queryCount}, Max concurrent: ${maxConcurrentQueries}`
      );

      // EMPIRICAL PROOF OF SINGLE-FLIGHT MUTEX:
      // In the single-flight architecture, exactly 1 query is dispatched and max concurrent is 1.
      assert.strictEqual(
        queryCount,
        1,
        "Concurrent callers must be deduplicated by single-flight mutex to exactly 1 query"
      );
      assert.strictEqual(
        maxConcurrentQueries,
        1,
        "Maximum concurrent active queries must be exactly 1"
      );
    });

    it("verifies idempotency after initial completion (subsequent calls skip queries)", async () => {
      const { spawnSync } = await import("node:child_process");

      const testScript = `
        process.env.DATABASE_URL = "postgres://dummy:dummy@example.com:5432/db";
        process.env.PGHOST = "example.com";
        const { ensureBenchSimulatorSchema } = await import("./server/storage");
        
        let queryCount = 0;
        const mockClient = {
          query: async (sql) => {
            queryCount++;
            return { rows: [] };
          }
        };

        // First call completes
        await ensureBenchSimulatorSchema(mockClient);
        const countAfterFirst = queryCount;

        // Subsequent sequential calls
        await ensureBenchSimulatorSchema(mockClient);
        await ensureBenchSimulatorSchema(mockClient);
        await ensureBenchSimulatorSchema(mockClient);

        console.log(JSON.stringify({ countAfterFirst, totalCount: queryCount }));
      `;

      const proc = spawnSync("node", ["--import", "tsx", "-e", testScript], {
        cwd: process.cwd(),
        encoding: "utf8",
      });

      assert.strictEqual(proc.status, 0, `Process failed: ${proc.stderr}`);
      const lines = proc.stdout.trim().split("\n");
      const jsonLine = lines.find((l) => l.startsWith("{") && l.endsWith("}"));
      assert.ok(jsonLine, "JSON output must exist");

      const { countAfterFirst, totalCount } = JSON.parse(jsonLine);
      assert.strictEqual(countAfterFirst, 1, "First call must execute query");
      assert.strictEqual(totalCount, 1, "Subsequent calls must skip querying once ensured");
    });
  });

  // ── 3. Database Offline & Failure Recovery Stress Testing ─────────────────
  describe("Database Failure & Recovery Stress Testing", () => {
    it("handles connection refusal (ECONNREFUSED) gracefully without crashing process", async () => {
      const { spawnSync } = await import("node:child_process");

      const testScript = `
        process.env.DATABASE_URL = "postgres://dummy:dummy@example.com:5432/db";
        process.env.PGHOST = "example.com";
        const { ensureBenchSimulatorSchema } = await import("./server/storage");
        
        const failingClient = {
          query: async () => {
            const err = new Error("connect ECONNREFUSED 127.0.0.1:5432");
            err.code = "ECONNREFUSED";
            throw err;
          }
        };

        // Should not throw or crash
        await ensureBenchSimulatorSchema(failingClient);
        console.log(JSON.stringify({ survived: true }));
      `;

      const proc = spawnSync("node", ["--import", "tsx", "-e", testScript], {
        cwd: process.cwd(),
        encoding: "utf8",
      });

      assert.strictEqual(proc.status, 0, `Process failed: ${proc.stderr}`);
      assert.ok(proc.stdout.includes('"survived":true'), "Process must survive connection error");
    });

    it("verifies retry capability after transient query failure (benchSchemaEnsured stays false on error)", async () => {
      const { spawnSync } = await import("node:child_process");

      const testScript = `
        process.env.DATABASE_URL = "postgres://dummy:dummy@example.com:5432/db";
        process.env.PGHOST = "example.com";
        const { ensureBenchSimulatorSchema } = await import("./server/storage");
        
        let attempts = 0;
        const flakyClient = {
          query: async () => {
            attempts++;
            if (attempts === 1) {
              throw new Error("deadlock detected on catalog locks");
            }
            return { rows: [] };
          }
        };

        // Attempt 1: Fails
        await ensureBenchSimulatorSchema(flakyClient);
        const attemptsAfterFailure = attempts;

        // Attempt 2: Recovers
        await ensureBenchSimulatorSchema(flakyClient);
        const attemptsAfterRecovery = attempts;

        // Attempt 3: Already ensured, should skip
        await ensureBenchSimulatorSchema(flakyClient);
        const attemptsAfterSuccess = attempts;

        console.log(JSON.stringify({ attemptsAfterFailure, attemptsAfterRecovery, attemptsAfterSuccess }));
      `;

      const proc = spawnSync("node", ["--import", "tsx", "-e", testScript], {
        cwd: process.cwd(),
        encoding: "utf8",
      });

      assert.strictEqual(proc.status, 0, `Process failed: ${proc.stderr}`);
      const lines = proc.stdout.trim().split("\n");
      const jsonLine = lines.find((l) => l.startsWith("{") && l.endsWith("}"));
      assert.ok(jsonLine, "JSON output must exist");

      const { attemptsAfterFailure, attemptsAfterRecovery, attemptsAfterSuccess } = JSON.parse(jsonLine);
      assert.strictEqual(attemptsAfterFailure, 1, "First attempt dispatched and failed");
      assert.strictEqual(attemptsAfterRecovery, 2, "Second attempt dispatched and recovered");
      assert.strictEqual(attemptsAfterSuccess, 2, "Third attempt skipped because recovery succeeded");
    });
  });

  // ── 4. DDL Integrity, Non-Destructiveness & Schema Parity ─────────────────
  describe("DDL Statement Integrity & Non-Destructive Invariants", () => {
    let capturedSql = "";

    it("captures full DDL script and validates exact statement syntax", async () => {
      const { spawnSync } = await import("node:child_process");

      const testScript = `
        process.env.DATABASE_URL = "postgres://dummy:dummy@example.com:5432/db";
        process.env.PGHOST = "example.com";
        const { ensureBenchSimulatorSchema } = await import("./server/storage");
        
        let captured = "";
        const mockClient = {
          query: async (sql) => {
            captured = sql;
            return { rows: [] };
          }
        };

        await ensureBenchSimulatorSchema(mockClient);
        console.log("---CAPTURED_SQL_START---");
        console.log(captured);
        console.log("---CAPTURED_SQL_END---");
      `;

      const proc = spawnSync("node", ["--import", "tsx", "-e", testScript], {
        cwd: process.cwd(),
        encoding: "utf8",
      });

      assert.strictEqual(proc.status, 0, `Process failed: ${proc.stderr}`);
      const match = proc.stdout.match(/---CAPTURED_SQL_START---([\s\S]*?)---CAPTURED_SQL_END---/);
      assert.ok(match, "Must capture SQL output");
      capturedSql = match[1].trim();
      assert.ok(capturedSql.length > 500, "Captured SQL must be non-empty");
    });

    it("strictly verifies that NO destructive SQL statements exist (DROP, TRUNCATE, DELETE)", () => {
      assert.ok(capturedSql.length > 0, "Captured SQL must be populated");

      const destructivePatterns = [
        /\bDROP\s+TABLE\b/i,
        /\bDROP\s+INDEX\b/i,
        /\bDROP\s+COLUMN\b/i,
        /\bTRUNCATE\b/i,
        /\bDELETE\s+FROM\b/i,
      ];

      for (const pattern of destructivePatterns) {
        assert.strictEqual(
          pattern.test(capturedSql),
          false,
          `Captured SQL contains forbidden destructive pattern: ${pattern}`
        );
      }
    });

    it("verifies all table creations and indexes use IF NOT EXISTS", () => {
      assert.ok(capturedSql.includes("CREATE TABLE IF NOT EXISTS bench_sessions"));
      assert.ok(capturedSql.includes("CREATE TABLE IF NOT EXISTS bench_messages"));

      const expectedIndexes = [
        "idx_bench_sessions_user_id",
        "idx_bench_sessions_status",
        "idx_bench_sessions_created_at",
        "idx_bench_messages_session_id",
        "idx_bench_messages_session_round",
        "idx_bench_messages_created_at",
      ];

      for (const idxName of expectedIndexes) {
        assert.ok(
          capturedSql.includes(`CREATE INDEX IF NOT EXISTS ${idxName}`),
          `Missing index: ${idxName}`
        );
      }
    });

    it("verifies all column mutations use ALTER TABLE ... ADD COLUMN IF NOT EXISTS", () => {
      const sessionColumns = [
        "user_id varchar",
        "case_id integer",
        "title text",
        "court_level text",
        "case_nature text",
        "proceeding_stage text",
        "court_name text",
        "judge_persona text",
        "user_brief text",
        "attack_plan jsonb",
        "status text",
        "current_round integer",
        "max_rounds integer",
        "live_score integer",
        "score_breakdown jsonb",
        "post_session_report jsonb",
        "created_at timestamp",
        "updated_at timestamp",
        "completed_at timestamp",
      ];

      for (const col of sessionColumns) {
        assert.ok(
          capturedSql.includes(`ALTER TABLE bench_sessions ADD COLUMN IF NOT EXISTS ${col.split(" ")[0]}`),
          `Missing defensive column migration for bench_sessions: ${col}`
        );
      }

      const messageColumns = [
        "session_id integer",
        "round_index integer",
        "speaker_role text",
        "content text",
        "evaluation jsonb",
        "cited_cases jsonb",
        "metadata jsonb",
        "created_at timestamp",
      ];

      for (const col of messageColumns) {
        assert.ok(
          capturedSql.includes(`ALTER TABLE bench_messages ADD COLUMN IF NOT EXISTS ${col.split(" ")[0]}`),
          `Missing defensive column migration for bench_messages: ${col}`
        );
      }
    });

    it("verifies foreign key constraints and type compatibility", () => {
      // user_id in users is varchar -> must be varchar in bench_sessions
      assert.ok(
        capturedSql.includes("user_id varchar REFERENCES users(id) ON DELETE CASCADE"),
        "Foreign key user_id must reference users(id) with ON DELETE CASCADE and type varchar"
      );

      // case_id in case_files is serial/integer -> must be integer in bench_sessions
      assert.ok(
        capturedSql.includes("case_id integer REFERENCES case_files(id) ON DELETE SET NULL"),
        "Foreign key case_id must reference case_files(id) with ON DELETE SET NULL and type integer"
      );

      // session_id in bench_messages references bench_sessions(id)
      assert.ok(
        capturedSql.includes("session_id integer NOT NULL REFERENCES bench_sessions(id) ON DELETE CASCADE"),
        "Foreign key session_id must reference bench_sessions(id) with ON DELETE CASCADE"
      );
    });
  });
});
