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
      max: 8,
      min: 1,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      idle_in_transaction_session_timeout: 30_000,
      statement_timeout: 60_000,
    })
  : undefined) as any;

// ── Pool error handler ──
// Neon (PgBouncer) silently kills idle/long-lived connections. Without this
// handler, the 'error' event on the pool is unhandled and crashes Node.js.
// The pool automatically removes the dead client and creates a new one on the
// next query — we just need to prevent the crash.
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
