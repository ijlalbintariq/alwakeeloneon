
import { pgTable, text, serial, integer, boolean, timestamp, varchar, uuid, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
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
  sourceType: text("source_type").default("other").notNull(),
  mimeType: text("mime_type"),
  fileExtension: text("file_extension"),
  detectedDomain: text("detected_domain").default("other").notNull(),
  detectedDomainLabel: text("detected_domain_label").default("Other").notNull(),
  classificationMethod: text("classification_method").default("fallback").notNull(),
  classificationConfidence: integer("classification_confidence").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentFiles = pgTable("document_files", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => documents.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  provider: text("provider").notNull().default("r2"),
  bucket: text("bucket").notNull(),
  objectKey: text("object_key").notNull(),
  extractedTextKey: text("extracted_text_key"),
  originalFilename: text("original_filename"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  etag: text("etag"),
  publicUrl: text("public_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const visitorSessions = pgTable(
  "visitor_sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ipAddress: text("ip_address").notNull(),
    messageCount: integer("message_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  },
  (table) => ({
    ipAddressUnique: uniqueIndex("visitor_sessions_ip_address_unique").on(table.ipAddress),
  }),
);

export const caseLeads = pgTable("case_leads", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  caseType: text("case_type").notNull(),
  caseDescription: text("case_description").notNull(),
  city: text("city").default("").notNull(),
  urgency: text("urgency", { enum: ["low", "normal", "high", "urgent"] }).default("normal").notNull(),
  preferredCallbackTime: text("preferred_callback_time"),
  consentToContact: boolean("consent_to_contact").default(false).notNull(),
  ipAddress: text("ip_address").notNull(),
  status: text("status", { enum: ["open", "completed"] }).notNull().default("open"),
  statusUpdatedAt: timestamp("status_updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const publicFunnelEvents = pgTable("public_funnel_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type", {
    enum: ["widget_open", "message_sent", "lead_form_open", "lead_submitted", "contact_click"],
  }).notNull(),
  sessionId: text("session_id"),
  ipAddress: text("ip_address").notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  citationYear: integer("citation_year"),
  citationReport: text("citation_report"),
  citationPage: integer("citation_page"),
  citationRole: text("citation_role", { enum: ["primary", "cited"] }).notNull().default("cited"),
  court: text("court").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  keywords: text("keywords").array().notNull(),
  sourceDocId: integer("source_doc_id"),
  sourceType: text("source_type"),
  sourceFilename: text("source_filename"),
  documentClassification: text("document_classification", { enum: ["case_law", "statute_document", "legal_analysis", "contract", "procedure_guide", "other"] }).notNull().default("case_law"),
  fallbackExtraction: boolean("fallback_extraction").notNull().default(false),
  statuteReferences: text("statute_references").array().notNull(),
});

export const lawJournals = pgTable(
  "law_journals",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    codeUnique: uniqueIndex("law_journals_code_unique").on(table.code),
  }),
);

export const courtsRef = pgTable(
  "courts_ref",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    level: text("level").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    codeUnique: uniqueIndex("courts_ref_code_unique").on(table.code),
  }),
);

export const judgments = pgTable(
  "judgments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    year: integer("year").notNull(),
    journalId: integer("journal_id").references(() => lawJournals.id).notNull(),
    page: integer("page").notNull(),
    citationString: text("citation_string").notNull(),
    title: text("title").notNull(),
    petitioner: text("petitioner"),
    respondent: text("respondent"),
    courtId: integer("court_id").references(() => courtsRef.id),
    courtNameSnapshot: text("court_name_snapshot"),
    decisionDate: timestamp("decision_date"),
    headnotes: text("headnotes"),
    fullText: text("full_text").notNull(),
    pdfUrl: text("pdf_url"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    uniqueCitationParts: uniqueIndex("judgments_year_journal_page_unique").on(table.year, table.journalId, table.page),
  }),
);

export const citationLinks = pgTable(
  "citation_links",
  {
    id: serial("id").primaryKey(),
    sourceJudgmentId: uuid("source_judgment_id").references(() => judgments.id).notNull(),
    targetJudgmentId: uuid("target_judgment_id").references(() => judgments.id).notNull(),
    citationType: text("citation_type").notNull(),
    contextExcerpt: text("context_excerpt"),
    citationText: text("citation_text").notNull(),
    startOffset: integer("start_offset"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    uniqueCitationLink: uniqueIndex("citation_links_unique").on(
      table.sourceJudgmentId,
      table.targetJudgmentId,
      table.citationType,
      table.citationText,
    ),
  }),
);

export const unresolvedCitations = pgTable("unresolved_citations", {
  id: serial("id").primaryKey(),
  sourceJudgmentId: uuid("source_judgment_id").references(() => judgments.id).notNull(),
  rawCitation: text("raw_citation").notNull(),
  year: integer("year"),
  journalCode: text("journal_code"),
  page: integer("page"),
  contextExcerpt: text("context_excerpt"),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
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

export const statuteDocumentFiles = pgTable("statute_document_files", {
  id: serial("id").primaryKey(),
  statuteDocumentId: integer("statute_document_id").references(() => statuteDocuments.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  provider: text("provider").notNull().default("r2"),
  bucket: text("bucket").notNull(),
  objectKey: text("object_key").notNull(),
  extractedTextKey: text("extracted_text_key"),
  originalFilename: text("original_filename"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  etag: text("etag"),
  publicUrl: text("public_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const savedJudgments = pgTable("saved_judgments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  citation: text("citation").notNull(),
  court: text("court").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  keywords: text("keywords").array(),
  uri: text("uri"),
  source: text("source"),
  aiAnalysis: text("ai_analysis"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orgMembers = pgTable("org_members", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").references(() => organizations.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: text("role", { enum: ["owner", "admin", "member"] }).notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const orgInvites = pgTable("org_invites", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").references(() => organizations.id).notNull(),
  email: text("email").notNull(),
  invitedBy: varchar("invited_by").references(() => users.id).notNull(),
  status: text("status", { enum: ["pending", "accepted", "declined"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orgKnowledge = pgTable("org_knowledge", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").references(() => organizations.id).notNull(),
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
  caseLawProcessStatus: text("case_law_process_status").notNull().default("pending"),
  caseLawProcessAttempts: integer("case_law_process_attempts").notNull().default(0),
  caseLawProcessLastAt: timestamp("case_law_process_last_at"),
  caseLawProcessLastError: text("case_law_process_last_error"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const adminKnowledgeFiles = pgTable("admin_knowledge_files", {
  id: serial("id").primaryKey(),
  adminKnowledgeId: integer("admin_knowledge_id").references(() => adminKnowledge.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  provider: text("provider").notNull().default("r2"),
  bucket: text("bucket").notNull(),
  objectKey: text("object_key").notNull(),
  extractedTextKey: text("extracted_text_key"),
  originalFilename: text("original_filename"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  etag: text("etag"),
  publicUrl: text("public_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const styleMemorySettings = pgTable("style_memory_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  orgId: integer("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  module: text("module", { enum: ["legal-drafting", "contract-drafting"] }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  ownershipMode: text("ownership_mode", { enum: ["user", "org", "user-org"] }).notNull().default("user-org"),
  learningSource: text("learning_source", { enum: ["full-activity"] }).notNull().default("full-activity"),
  coverage: text("coverage", { enum: ["generation-only"] }).notNull().default("generation-only"),
  strictness: text("strictness", { enum: ["strict", "balanced", "flexible"] }).notNull().default("balanced"),
  lastBackfillAt: timestamp("last_backfill_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const styleMemorySamples = pgTable("style_memory_samples", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  orgId: integer("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  module: text("module", { enum: ["legal-drafting", "contract-drafting"] }).notNull(),
  sourceType: text("source_type", { enum: ["upload", "saved-draft", "accepted-redline"] }).notNull(),
  sourceRef: text("source_ref"),
  title: text("title").notNull(),
  rawText: text("raw_text").notNull(),
  textHash: text("text_hash").notNull(),
  status: text("status", { enum: ["active", "deleted"] }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const styleMemoryChunks = pgTable("style_memory_chunks", {
  id: serial("id").primaryKey(),
  sampleId: integer("sample_id").references(() => styleMemorySamples.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  orgId: integer("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  module: text("module", { enum: ["legal-drafting", "contract-drafting"] }).notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  tokenCount: integer("token_count").notNull(),
  // Stored as pgvector in SQL bootstrap; declared as text here for TS typing compatibility.
  embedding: text("embedding").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const styleMemoryEvents = pgTable("style_memory_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  module: text("module", { enum: ["legal-drafting", "contract-drafting"] }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  orgId: integer("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

// Schemas
export const insertThreadSchema = createInsertSchema(threads).omit({ id: true, createdAt: true, updatedAt: true, userId: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, summary: true, userId: true });
export const insertDocumentFileSchema = createInsertSchema(documentFiles).omit({ id: true, createdAt: true });
export const insertVisitorSessionSchema = createInsertSchema(visitorSessions).omit({ id: true, createdAt: true, lastMessageAt: true });
export const insertCaseLeadSchema = createInsertSchema(caseLeads).omit({ id: true, createdAt: true, status: true, statusUpdatedAt: true });
export const insertPublicFunnelEventSchema = createInsertSchema(publicFunnelEvents).omit({ id: true, createdAt: true, ipAddress: true });
export const insertBookmarkSchema = createInsertSchema(bookmarks).omit({ id: true, createdAt: true });
export const insertSearchHistorySchema = createInsertSchema(searchHistory).omit({ id: true, createdAt: true });
export const insertStatuteSchema = createInsertSchema(statutes).omit({ id: true });
export const insertCaseLawSchema = createInsertSchema(caseLaw).omit({ id: true });
export const insertLawJournalSchema = createInsertSchema(lawJournals).omit({ id: true, createdAt: true });
export const insertCourtRefSchema = createInsertSchema(courtsRef).omit({ id: true, createdAt: true });
export const insertJudgmentSchema = createInsertSchema(judgments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCitationLinkSchema = createInsertSchema(citationLinks).omit({ id: true, createdAt: true });
export const insertUnresolvedCitationSchema = createInsertSchema(unresolvedCitations).omit({ id: true, createdAt: true });
export const insertQueryCacheSchema = createInsertSchema(queryCache).omit({ id: true, createdAt: true, hitCount: true });
export const insertUsageTrackingSchema = createInsertSchema(usageTracking).omit({ id: true, createdAt: true });
export const insertGithubKnowledgeSchema = createInsertSchema(githubKnowledge).omit({ id: true, syncedAt: true });
export const insertStatuteDocumentSchema = createInsertSchema(statuteDocuments).omit({ id: true, createdAt: true });
export const insertStatuteDocumentFileSchema = createInsertSchema(statuteDocumentFiles).omit({ id: true, createdAt: true });
export const insertSavedJudgmentSchema = createInsertSchema(savedJudgments).omit({ id: true, createdAt: true });
export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true });
export const insertOrgMemberSchema = createInsertSchema(orgMembers).omit({ id: true, joinedAt: true });
export const insertOrgInviteSchema = createInsertSchema(orgInvites).omit({ id: true, createdAt: true, status: true });
export const insertOrgKnowledgeSchema = createInsertSchema(orgKnowledge).omit({ id: true, createdAt: true });
export const insertAdminKnowledgeSchema = createInsertSchema(adminKnowledge).omit({ id: true, createdAt: true });
export const insertAdminKnowledgeFileSchema = createInsertSchema(adminKnowledgeFiles).omit({ id: true, createdAt: true });
export const insertStyleMemorySettingsSchema = createInsertSchema(styleMemorySettings).omit({ id: true, createdAt: true, updatedAt: true, lastBackfillAt: true });
export const insertStyleMemorySampleSchema = createInsertSchema(styleMemorySamples).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStyleMemoryChunkSchema = createInsertSchema(styleMemoryChunks).omit({ id: true, createdAt: true });
export const insertStyleMemoryEventSchema = createInsertSchema(styleMemoryEvents).omit({ id: true, createdAt: true });

// Types
export type Thread = typeof threads.$inferSelect;
export type InsertThread = z.infer<typeof insertThreadSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type DocumentFile = typeof documentFiles.$inferSelect;
export type InsertDocumentFile = z.infer<typeof insertDocumentFileSchema>;
export type VisitorSession = typeof visitorSessions.$inferSelect;
export type InsertVisitorSession = z.infer<typeof insertVisitorSessionSchema>;
export const caseLeadStatusSchema = z.enum(["open", "completed"]);
export type CaseLeadStatus = z.infer<typeof caseLeadStatusSchema>;
export type CaseLead = typeof caseLeads.$inferSelect;
export type InsertCaseLead = z.infer<typeof insertCaseLeadSchema>;
export type PublicFunnelEvent = typeof publicFunnelEvents.$inferSelect;
export type InsertPublicFunnelEvent = z.infer<typeof insertPublicFunnelEventSchema>;
export type Bookmark = typeof bookmarks.$inferSelect;
export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;
export type Statute = typeof statutes.$inferSelect;
export type InsertStatute = z.infer<typeof insertStatuteSchema>;
export type CaseLaw = typeof caseLaw.$inferSelect;
export type InsertCaseLaw = z.infer<typeof insertCaseLawSchema>;
export type LawJournal = typeof lawJournals.$inferSelect;
export type InsertLawJournal = z.infer<typeof insertLawJournalSchema>;
export type CourtRef = typeof courtsRef.$inferSelect;
export type InsertCourtRef = z.infer<typeof insertCourtRefSchema>;
export type Judgment = typeof judgments.$inferSelect;
export type InsertJudgment = z.infer<typeof insertJudgmentSchema>;
export type CitationLink = typeof citationLinks.$inferSelect;
export type InsertCitationLink = z.infer<typeof insertCitationLinkSchema>;
export type UnresolvedCitation = typeof unresolvedCitations.$inferSelect;
export type InsertUnresolvedCitation = z.infer<typeof insertUnresolvedCitationSchema>;
export type QueryCache = typeof queryCache.$inferSelect;
export type InsertQueryCache = z.infer<typeof insertQueryCacheSchema>;
export type UsageTracking = typeof usageTracking.$inferSelect;
export type InsertUsageTracking = z.infer<typeof insertUsageTrackingSchema>;
export type GithubKnowledge = typeof githubKnowledge.$inferSelect;
export type InsertGithubKnowledge = z.infer<typeof insertGithubKnowledgeSchema>;
export type StatuteDocument = typeof statuteDocuments.$inferSelect;
export type InsertStatuteDocument = z.infer<typeof insertStatuteDocumentSchema>;
export type StatuteDocumentFile = typeof statuteDocumentFiles.$inferSelect;
export type InsertStatuteDocumentFile = z.infer<typeof insertStatuteDocumentFileSchema>;
export type SavedJudgment = typeof savedJudgments.$inferSelect;
export type InsertSavedJudgment = z.infer<typeof insertSavedJudgmentSchema>;
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type OrgMember = typeof orgMembers.$inferSelect;
export type InsertOrgMember = z.infer<typeof insertOrgMemberSchema>;
export type OrgInvite = typeof orgInvites.$inferSelect;
export type InsertOrgInvite = z.infer<typeof insertOrgInviteSchema>;
export type OrgKnowledge = typeof orgKnowledge.$inferSelect;
export type InsertOrgKnowledge = z.infer<typeof insertOrgKnowledgeSchema>;
export type AdminKnowledge = typeof adminKnowledge.$inferSelect;
export type InsertAdminKnowledge = z.infer<typeof insertAdminKnowledgeSchema>;
export type AdminKnowledgeFile = typeof adminKnowledgeFiles.$inferSelect;
export type InsertAdminKnowledgeFile = z.infer<typeof insertAdminKnowledgeFileSchema>;
export type StyleMemorySettings = typeof styleMemorySettings.$inferSelect;
export type InsertStyleMemorySettings = z.infer<typeof insertStyleMemorySettingsSchema>;
export type StyleMemorySample = typeof styleMemorySamples.$inferSelect;
export type InsertStyleMemorySample = z.infer<typeof insertStyleMemorySampleSchema>;
export type StyleMemoryChunk = typeof styleMemoryChunks.$inferSelect;
export type InsertStyleMemoryChunk = z.infer<typeof insertStyleMemoryChunkSchema>;
export type StyleMemoryEvent = typeof styleMemoryEvents.$inferSelect;
export type InsertStyleMemoryEvent = z.infer<typeof insertStyleMemoryEventSchema>;

export type TierPlanConfig = {
  monthlyQueries: number;
  label: string;
  description: string;
  pricePkr: number;
  includedUsers: number | "custom";
  pooled: boolean;
  modeAccess: {
    standard: boolean;
    turbo: boolean;
    apex: boolean;
  };
  maxOutputTokens: {
    standard: number;
    turbo: number;
    apex: number;
  };
  apexMonthlyCap: number;
  uploadLimitPerMonth: number | "custom";
  ocrPagesPerDay: number | "custom";
  maxFileSizeMb: number;
};

export const TIER_LIMITS: Record<string, TierPlanConfig> = {
  free: {
    monthlyQueries: 12,
    label: "Free",
    description: "10 AI chats + 1 legal draft + 1 contract draft/month",
    pricePkr: 0,
    includedUsers: 1,
    pooled: false,
    modeAccess: { standard: true, turbo: false, apex: false },
    maxOutputTokens: { standard: 2000, turbo: 0, apex: 0 },
    apexMonthlyCap: 0,
    uploadLimitPerMonth: 100,
    ocrPagesPerDay: 50,
    maxFileSizeMb: 75,
  },
  standard: {
    monthlyQueries: 120,
    label: "Standard",
    description: "120 AI actions/month",
    pricePkr: 500,
    includedUsers: 1,
    pooled: false,
    modeAccess: { standard: true, turbo: false, apex: false },
    maxOutputTokens: { standard: 2500, turbo: 0, apex: 0 },
    apexMonthlyCap: 0,
    uploadLimitPerMonth: 100,
    ocrPagesPerDay: 50,
    maxFileSizeMb: 75,
  },
  pro: {
    monthlyQueries: 350,
    label: "Pro",
    description: "350 AI actions/month",
    pricePkr: 1000,
    includedUsers: 1,
    pooled: false,
    modeAccess: { standard: true, turbo: true, apex: false },
    maxOutputTokens: { standard: 3000, turbo: 3500, apex: 0 },
    apexMonthlyCap: 0,
    uploadLimitPerMonth: 300,
    ocrPagesPerDay: 150,
    maxFileSizeMb: 75,
  },
  chamber: {
    monthlyQueries: 1200,
    label: "Chamber",
    description: "1,200 AI actions/month (pooled)",
    pricePkr: 3000,
    includedUsers: 3,
    pooled: true,
    modeAccess: { standard: true, turbo: true, apex: true },
    maxOutputTokens: { standard: 3500, turbo: 4000, apex: 3500 },
    apexMonthlyCap: 180,
    uploadLimitPerMonth: 1200,
    ocrPagesPerDay: 600,
    maxFileSizeMb: 75,
  },
  enterprise: {
    monthlyQueries: 30000,
    label: "Enterprise",
    description: "Custom fair-use limit (default 30,000 AI actions/month)",
    pricePkr: 50000,
    includedUsers: "custom",
    pooled: true,
    modeAccess: { standard: true, turbo: true, apex: true },
    maxOutputTokens: { standard: 4000, turbo: 4096, apex: 4096 },
    apexMonthlyCap: 4500,
    uploadLimitPerMonth: "custom",
    ocrPagesPerDay: "custom",
    maxFileSizeMb: 75,
  },
};

// API Types
export type CreateThreadRequest = {
  title?: string;
  firstMessage: string;
};

export type ChatRequest = {
  message: string;
};
