import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import 'dotenv/config';
import { validateDatabaseUrl, validatePgHost } from "./env-config";

const { Pool } = pg;
const validatedDatabaseUrl = validateDatabaseUrl(process.env.DATABASE_URL);
const validatedPgHost = validatePgHost(process.env.PGHOST);

if (!validatedDatabaseUrl.ok || !validatedPgHost.ok) {
  const reasons = [validatedDatabaseUrl.reason, validatedPgHost.reason].filter(Boolean).join(" ");
  console.error(`[Config] Database configuration invalid. ${reasons}`);
}

const canInitPool = validatedDatabaseUrl.ok && validatedPgHost.ok;

export const pool = (canInitPool && validatedDatabaseUrl.value
  ? new Pool({ connectionString: validatedDatabaseUrl.value })
  : undefined) as any;
export const db = (canInitPool && validatedDatabaseUrl.value
  ? drizzle(pool, { schema })
  : undefined) as any;
