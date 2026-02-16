
import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";
import { sql } from "drizzle-orm";

export * from "./models/auth";

export const threads = pgTable("threads", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  shareToken: varchar("share_token", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").references(() => threads.id).notNull(),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(), // Changed to varchar
  title: text("title").notNull(),
  content: text("content"),
  summary: text("summary"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookmarks = pgTable("bookmarks", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type", { enum: ["al-wakeelo", "draft", "contract"] }).notNull(),
  category: text("category").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const searchHistory = pgTable("search_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type", { enum: ["judgment", "statute", "chat", "draft", "contract"] }).notNull(),
  query: text("query").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const statutes = pgTable("statutes", {
  id: serial("id").primaryKey(),
  shortTitle: text("short_title").notNull(),
  section: text("section").notNull(),
  description: text("description").notNull(),
  punishment: text("punishment").notNull(),
});

export const caseLaw = pgTable("case_law", {
  id: serial("id").primaryKey(),
  citation: text("citation").notNull(),
  court: text("court").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  keywords: text("keywords").array().notNull(),
});

export const queryCache = pgTable("query_cache", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull(),
  queryHash: text("query_hash").notNull(),
  queryText: text("query_text").notNull(),
  response: text("response").notNull(),
  hitCount: integer("hit_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const usageTracking = pgTable("usage_tracking", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  feature: text("feature", { enum: ["chat", "search-judgments", "search-statutes", "summarize", "brief", "draft", "contract", "contract-drafting"] }).notNull(),
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  estimatedCost: text("estimated_cost").default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const githubKnowledge = pgTable("github_knowledge", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  syncedAt: timestamp("synced_at").defaultNow(),
});

export const statuteDocuments = pgTable("statute_documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  category: text("category").default("general").notNull(),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const adminKnowledge = pgTable("admin_knowledge", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  category: text("category").default("general").notNull(),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Schemas
export const insertThreadSchema = createInsertSchema(threads).omit({ id: true, createdAt: true, updatedAt: true, userId: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, summary: true, userId: true });
export const insertBookmarkSchema = createInsertSchema(bookmarks).omit({ id: true, createdAt: true });
export const insertSearchHistorySchema = createInsertSchema(searchHistory).omit({ id: true, createdAt: true });
export const insertStatuteSchema = createInsertSchema(statutes).omit({ id: true });
export const insertCaseLawSchema = createInsertSchema(caseLaw).omit({ id: true });
export const insertQueryCacheSchema = createInsertSchema(queryCache).omit({ id: true, createdAt: true, hitCount: true });
export const insertUsageTrackingSchema = createInsertSchema(usageTracking).omit({ id: true, createdAt: true });
export const insertGithubKnowledgeSchema = createInsertSchema(githubKnowledge).omit({ id: true, syncedAt: true });
export const insertStatuteDocumentSchema = createInsertSchema(statuteDocuments).omit({ id: true, createdAt: true });
export const insertAdminKnowledgeSchema = createInsertSchema(adminKnowledge).omit({ id: true, createdAt: true });

// Types
export type Thread = typeof threads.$inferSelect;
export type InsertThread = z.infer<typeof insertThreadSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Bookmark = typeof bookmarks.$inferSelect;
export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;
export type Statute = typeof statutes.$inferSelect;
export type InsertStatute = z.infer<typeof insertStatuteSchema>;
export type CaseLaw = typeof caseLaw.$inferSelect;
export type InsertCaseLaw = z.infer<typeof insertCaseLawSchema>;
export type QueryCache = typeof queryCache.$inferSelect;
export type InsertQueryCache = z.infer<typeof insertQueryCacheSchema>;
export type UsageTracking = typeof usageTracking.$inferSelect;
export type InsertUsageTracking = z.infer<typeof insertUsageTrackingSchema>;
export type GithubKnowledge = typeof githubKnowledge.$inferSelect;
export type InsertGithubKnowledge = z.infer<typeof insertGithubKnowledgeSchema>;
export type StatuteDocument = typeof statuteDocuments.$inferSelect;
export type InsertStatuteDocument = z.infer<typeof insertStatuteDocumentSchema>;
export type AdminKnowledge = typeof adminKnowledge.$inferSelect;
export type InsertAdminKnowledge = z.infer<typeof insertAdminKnowledgeSchema>;

export const TIER_LIMITS: Record<string, { monthlyQueries: number; label: string; description: string }> = {
  free: { monthlyQueries: 10, label: "Free", description: "10 AI queries/month" },
  pro: { monthlyQueries: 500, label: "Pro", description: "500 AI queries/month" },
  enterprise: { monthlyQueries: 999999, label: "Enterprise", description: "Unlimited AI queries" },
};

// API Types
export type CreateThreadRequest = {
  title?: string;
  firstMessage: string;
};

export type ChatRequest = {
  message: string;
};
