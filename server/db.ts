import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import 'dotenv/config';

const { Pool } = pg;

export const pool = (process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : undefined) as any;
export const db = (process.env.DATABASE_URL
  ? drizzle(pool, { schema })
  : undefined) as any;
