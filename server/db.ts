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
      connectionTimeoutMillis: 10_000,
      idle_in_transaction_session_timeout: 30_000,
      statement_timeout: 60_000,
    })
  : undefined) as any;
export const db = (canInitPool && validatedDatabaseUrl.value
  ? drizzle(pool, { schema })
  : undefined) as any;
