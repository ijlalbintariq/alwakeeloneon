import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { validateDatabaseUrl, validatePgHost } from "./env-config";

const { Pool } = pg;
const validatedDatabaseUrl = validateDatabaseUrl(process.env.DATABASE_URL);
const validatedPgHost = validatePgHost(process.env.PGHOST);
const canInitPool = validatedDatabaseUrl.ok && validatedPgHost.ok;
const reasons = [validatedDatabaseUrl.reason, validatedPgHost.reason].filter(Boolean);

export const dbAvailable = canInitPool && !!validatedDatabaseUrl.value;
export const dbUnavailableReason = dbAvailable ? null : (reasons.join(" ") || "Database configuration is missing.");

if (!dbAvailable) {
  console.error(`[Config] Database configuration invalid. ${dbUnavailableReason}`);
}

export const pool = (canInitPool && validatedDatabaseUrl.value
  ? new Pool({
      connectionString: validatedDatabaseUrl.value,
      // Retrieval fans out several searches per chat turn. At max 8 a single
      // turn could occupy the whole pool and queue everyone else behind it.
      max: Math.max(4, Number(process.env.PG_POOL_MAX || 16)),
      min: 1,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 30_000,
      idle_in_transaction_session_timeout: 30_000,
      // A retrieval query the pipeline already gave up on has no value. 60s of
      // server-side work for a result nobody reads is pure pool contention.
      statement_timeout: Math.max(5_000, Number(process.env.PG_STATEMENT_TIMEOUT_MS || 20_000)),
    })
  : undefined) as any;

// ── Pool error handler ──
// Neon (PgBouncer) silently kills idle/long-lived connections. Without this
// handler, the 'error' event on the pool is unhandled and crashes Node.js.
// The pool automatically removes the dead client and creates a new one on the
// next query — we just need to prevent the crash.
// pgvector search depth. Defaults to 40, but similaritySearch asks for up to 96
// candidates, so the index returned fewer rows than requested. Applied by
// similaritySearch on the connection it checks out — a pool "connect" listener
// cannot await, so its SET raced the first real query on the same client.
export const RAG_HNSW_EF_SEARCH = Math.max(40, Number(process.env.RAG_HNSW_EF_SEARCH || 150));

if (pool) {
  pool.on("error", (err: Error, client: any) => {
    const useCount = client?._poolUseCount ?? "?";
    console.error(
      `[Pool] Unexpected client error (poolUseCount=${useCount}):`,
      err.message || err,
    );
    // No process.exit — let the pool self-heal by discarding this client.
  });
}

export const db = (canInitPool && validatedDatabaseUrl.value
  ? drizzle(pool, { schema })
  : undefined) as any;
