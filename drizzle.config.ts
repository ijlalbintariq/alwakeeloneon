import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // These live tables are created in code (server/rag/vector-store.ts, boot DDL),
  // not declared in shared/schema.ts. Without this filter `npm run db:push`
  // treats them as unknown and can offer to drop them: rag_chunks alone is
  // 38 GB of embeddings that take days to regenerate.
  schemaFilter: ["public"],
  tablesFilter: ["*", "!rag_documents", "!rag_chunks", "!audit_logs", "!judge_profiles_cache", "!user_bans"],
});
