import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import 'dotenv/config';
import { validateDatabaseUrl } from "./env-config";

const { Pool } = pg;
const validatedDatabaseUrl = validateDatabaseUrl(process.env.DATABASE_URL);

if (!validatedDatabaseUrl.ok) {
  throw new Error(`[Config] ${validatedDatabaseUrl.reason}`);
}

export const pool = (validatedDatabaseUrl.value
  ? new Pool({ connectionString: validatedDatabaseUrl.value })
  : undefined) as any;
export const db = (validatedDatabaseUrl.value
  ? drizzle(pool, { schema })
  : undefined) as any;
