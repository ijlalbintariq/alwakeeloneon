import { db } from "./db";
import {
  threads, messages, documents, bookmarks, searchHistory, statutes, caseLaw, githubKnowledge, queryCache, usageTracking, adminKnowledge, statuteDocuments, savedJudgments,
  organizations, orgMembers, orgInvites, orgKnowledge, lawJournals, courtsRef, judgments, citationLinks, unresolvedCitations, documentFiles, adminKnowledgeFiles, statuteDocumentFiles, visitorSessions, caseLeads, publicFunnelEvents,
  styleMemorySettings, styleMemorySamples, styleMemoryChunks, styleMemoryEvents,
  type Thread, type InsertThread,
  type Message, type InsertMessage,
  type Document, type InsertDocument,
  type DocumentFile, type InsertDocumentFile,
  type Bookmark, type InsertBookmark,
  type SearchHistory, type InsertSearchHistory,
  type Statute,
  type CaseLaw, type InsertCaseLaw,
  type InsertJudgment, type Judgment, type InsertCitationLink, type CitationLink, type InsertUnresolvedCitation,
  type GithubKnowledge, type InsertGithubKnowledge,
  type QueryCache, type InsertQueryCache,
  type UsageTracking,
  type AdminKnowledge, type InsertAdminKnowledge,
  type AdminKnowledgeFile, type InsertAdminKnowledgeFile,
  type StatuteDocument, type InsertStatuteDocument,
  type StatuteDocumentFile, type InsertStatuteDocumentFile,
  type SavedJudgment, type InsertSavedJudgment,
  type VisitorSession, type InsertVisitorSession,
  type CaseLead, type CaseLeadStatus, type InsertCaseLead, type InsertPublicFunnelEvent,
  type Organization, type InsertOrganization,
  type OrgMember, type InsertOrgMember,
  type OrgInvite, type InsertOrgInvite,
  type OrgKnowledge, type InsertOrgKnowledge,
  type StyleMemorySettings, type InsertStyleMemorySettings,
  type StyleMemorySample, type InsertStyleMemorySample
} from "@shared/schema";
import { users, type User } from "@shared/models/auth";
import { eq, desc, or, ilike, sql, and, lt, gte, count, inArray } from "drizzle-orm";

export type DocumentInsights = {
  totalDocuments: number;
  sourceCounts: Array<{ key: string; label: string; count: number }>;
  domainCounts: Array<{ key: string; label: string; count: number }>;
  unclassifiedCount: number;
};

export type PagedResult<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type AdminKnowledgeListItem = Omit<AdminKnowledge, "content">;
export type StatuteDocumentListItem = Omit<StatuteDocument, "content">;

export type VisitorSessionStats = {
  ipAddress: string;
  messageCount: number;
  remaining: number;
  resetAt: Date;
};

export type DocumentMetadataUpdate = {
  id: number;
  sourceType: string;
  mimeType: string | null;
  fileExtension: string | null;
  detectedDomain: string;
  detectedDomainLabel: string;
  classificationMethod: string;
  classificationConfidence: number;
};

export type StyleMemoryModule = "legal-drafting" | "contract-drafting";
export type StyleMemoryScope = "user" | "org" | "user-org";
export type StyleMemoryStrictness = "strict" | "balanced" | "flexible";
export type StyleMemorySourceType = "upload" | "saved-draft" | "accepted-redline";

export type StyleMemorySettingsView = {
  module: StyleMemoryModule;
  enabled: boolean;
  ownershipMode: StyleMemoryScope;
  learningSource: "full-activity";
  coverage: "generation-only";
  strictness: StyleMemoryStrictness;
  lastBackfillAt: Date | null;
};

export type StyleMemorySampleView = {
  id: number;
  module: StyleMemoryModule;
  sourceType: StyleMemorySourceType;
  sourceRef: string | null;
  title: string;
  status: "active" | "deleted";
  createdAt: Date | null;
};

export type StyleMemorySourceCounts = {
  upload: number;
  savedDraft: number;
  acceptedRedline: number;
  total: number;
};

function toStyleMemorySettingsView(row: StyleMemorySettings): StyleMemorySettingsView {
  return {
    module: row.module as StyleMemoryModule,
    enabled: !!row.enabled,
    ownershipMode: row.ownershipMode as StyleMemoryScope,
    learningSource: "full-activity",
    coverage: "generation-only",
    strictness: row.strictness as StyleMemoryStrictness,
    lastBackfillAt: row.lastBackfillAt || null,
  };
}

function toVisitorSessionStats(
  row: VisitorSession | undefined,
  ipAddress: string,
  windowHours: number,
  maxMessages: number,
): VisitorSessionStats {
  const now = new Date();
  const windowMs = Math.max(1, windowHours) * 60 * 60 * 1000;
  const lastMessageAt = row?.lastMessageAt ? new Date(row.lastMessageAt) : null;
  const inWindow = !!lastMessageAt && (now.getTime() - lastMessageAt.getTime() < windowMs);
  const messageCount = inWindow ? Number(row?.messageCount || 0) : 0;
  const remaining = Math.max(0, maxMessages - messageCount);
  const resetAt = inWindow && lastMessageAt
    ? new Date(lastMessageAt.getTime() + windowMs)
    : new Date(now.getTime() + windowMs);

  return {
    ipAddress,
    messageCount,
    remaining,
    resetAt,
  };
}

export type CitationSearchResult = {
  id: string;
  citation: string;
  title: string;
  court: string;
  decisionDate: Date | null;
  pdfUrl: string | null;
};

export type JudgmentCitationLink = {
  id: number;
  citationType: string;
  contextExcerpt: string | null;
  citationText: string;
  linkedJudgmentId: string | null;
  linkedCitation: string | null;
  linkedTitle: string | null;
};

export type JudgmentDetail = {
  id: string;
  year: number;
  page: number;
  journalCode: string;
  journalName: string;
  citation: string;
  title: string;
  petitioner: string | null;
  respondent: string | null;
  court: string;
  decisionDate: Date | null;
  headnotes: string | null;
  fullText: string;
  pdfUrl: string | null;
  citations: {
    made: JudgmentCitationLink[];
    received: JudgmentCitationLink[];
  };
};

export interface IStorage {
  createThread(thread: InsertThread & { userId: string }): Promise<Thread>;
  getThreads(userId: string): Promise<Thread[]>;
  getThread(id: number): Promise<Thread | undefined>;
  deleteThread(id: number): Promise<void>;
  setThreadShareToken(id: number, token: string): Promise<Thread | undefined>;
  getThreadByShareToken(token: string): Promise<Thread | undefined>;

  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(threadId: number): Promise<Message[]>;

  createDocument(doc: InsertDocument & { userId: string }): Promise<Document>;
  getDocuments(userId: string): Promise<Document[]>;
  getDocumentById(id: number, userId: string): Promise<Document | undefined>;
  updateDocument(
    id: number,
    userId: string,
    data: Partial<Pick<InsertDocument, "title" | "content">>
  ): Promise<Document | undefined>;
  getAllDocuments(): Promise<Document[]>;
  getDocumentInsights(userId: string): Promise<DocumentInsights>;
  getDocumentsNeedingMetadata(userId: string, limit: number): Promise<Document[]>;
  backfillDocumentMetadata(userId: string, updates: DocumentMetadataUpdate[]): Promise<number>;
  deleteDocument(id: number, userId: string): Promise<void>;
  deleteAllDocuments(userId: string): Promise<number>;
  upsertDocumentFile(entry: InsertDocumentFile): Promise<DocumentFile>;
  getDocumentFile(documentId: number, userId: string): Promise<DocumentFile | undefined>;
  getDocumentFilesByUser(userId: string): Promise<DocumentFile[]>;
  deleteDocumentFile(documentId: number, userId: string): Promise<void>;
  getVisitorSessionStats(ipAddress: string, windowHours: number, maxMessages: number): Promise<VisitorSessionStats>;
  incrementVisitorSession(ipAddress: string, windowHours: number, maxMessages: number): Promise<VisitorSessionStats>;
  logPublicFunnelEvent(entry: InsertPublicFunnelEvent & { ipAddress: string }): Promise<void>;
  createCaseLead(entry: InsertCaseLead): Promise<CaseLead>;
  getCaseLeadsPage(limit: number, offset: number, query?: string): Promise<PagedResult<CaseLead>>;
  getCaseLeadById(id: string): Promise<CaseLead | undefined>;
  updateCaseLeadStatus(id: string, status: CaseLeadStatus): Promise<CaseLead | undefined>;
  deleteCaseLead(id: string): Promise<void>;
  getStyleMemorySettings(userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<StyleMemorySettingsView | null>;
  upsertStyleMemorySettings(args: {
    userId: string;
    module: StyleMemoryModule;
    orgId?: number | null;
    enabled?: boolean;
    ownershipMode?: StyleMemoryScope;
    strictness?: StyleMemoryStrictness;
  }): Promise<StyleMemorySettingsView>;
  touchStyleMemoryBackfill(userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<void>;
  getStyleMemorySourceCounts(userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<StyleMemorySourceCounts>;
  getStyleMemorySampleByHash(userId: string, module: StyleMemoryModule, textHash: string, orgId?: number | null): Promise<StyleMemorySample | undefined>;
  addStyleMemorySample(entry: InsertStyleMemorySample): Promise<StyleMemorySample>;
  listStyleMemorySamples(
    userId: string,
    module: StyleMemoryModule,
    limit: number,
    offset: number,
    orgId?: number | null,
  ): Promise<PagedResult<StyleMemorySampleView>>;
  deleteStyleMemorySample(id: number, userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<number>;
  deleteStyleMemoryChunksBySample(sampleId: number, userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<number>;
  addStyleMemoryChunk(args: {
    sampleId: number;
    userId: string;
    module: StyleMemoryModule;
    orgId?: number | null;
    chunkIndex: number;
    content: string;
    tokenCount: number;
    embedding: string;
  }): Promise<void>;
  logStyleMemoryEvent(args: {
    eventType: string;
    userId: string;
    module: StyleMemoryModule;
    orgId?: number | null;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  upsertAdminKnowledgeFile(entry: InsertAdminKnowledgeFile): Promise<AdminKnowledgeFile>;
  getAdminKnowledgeFile(adminKnowledgeId: number): Promise<AdminKnowledgeFile | undefined>;
  getAdminKnowledgeFiles(): Promise<AdminKnowledgeFile[]>;
  deleteAdminKnowledgeFile(adminKnowledgeId: number): Promise<void>;
  upsertStatuteDocumentFile(entry: InsertStatuteDocumentFile): Promise<StatuteDocumentFile>;
  getStatuteDocumentFile(statuteDocumentId: number): Promise<StatuteDocumentFile | undefined>;
  getStatuteDocumentFiles(): Promise<StatuteDocumentFile[]>;
  deleteStatuteDocumentFile(statuteDocumentId: number): Promise<void>;

  createBookmark(bookmark: InsertBookmark & { userId: string }): Promise<Bookmark>;
  getBookmarks(userId: string): Promise<Bookmark[]>;
  deleteBookmark(id: number, userId: string): Promise<void>;

  addSearchHistory(entry: InsertSearchHistory & { userId: string }): Promise<SearchHistory>;
  getSearchHistory(userId: string): Promise<SearchHistory[]>;

  searchStatutes(query: string, limit?: number): Promise<Statute[]>;
  getAllStatutes(): Promise<Statute[]>;

  searchCaseLaw(query: string, limit?: number): Promise<CaseLaw[]>;
  getAllCaseLaw(): Promise<CaseLaw[]>;
  getCaseLawPage(limit: number, offset: number): Promise<PagedResult<CaseLaw>>;
  getCaseLawById(id: number): Promise<CaseLaw | undefined>;
  getCaseLawByCitation(citation: string): Promise<CaseLaw | undefined>;
  getCaseLawCitations(): Promise<string[]>;
  createCaseLaw(entry: InsertCaseLaw): Promise<CaseLaw>;
  updateCaseLaw(id: number, entry: Partial<InsertCaseLaw>): Promise<CaseLaw | undefined>;
  deleteCaseLaw(id: number): Promise<void>;
  deleteAllCaseLaw(): Promise<number>;
  bulkCreateCaseLaw(entries: InsertCaseLaw[]): Promise<CaseLaw[]>;
  getLawJournals(): Promise<Array<{ id: number; code: string; name: string }>>;
  getCourtsRef(): Promise<Array<{ id: number; code: string; name: string; level: string }>>;
  searchJudgmentsByCitation(params: { year: number; journalCode: string; page: number; court?: string }): Promise<CitationSearchResult[]>;
  getJudgmentDetail(id: string): Promise<JudgmentDetail | undefined>;
  createJudgment(entry: InsertJudgment): Promise<Judgment>;
  createCitationLinks(entries: InsertCitationLink[]): Promise<number>;
  createUnresolvedCitations(entries: InsertUnresolvedCitation[]): Promise<number>;

  getGithubKnowledgeCount(): Promise<number>;
  getAllGithubKnowledge(): Promise<GithubKnowledge[]>;
  getGithubKnowledgeById(id: number): Promise<GithubKnowledge | undefined>;
  upsertGithubKnowledge(items: InsertGithubKnowledge[]): Promise<void>;
  searchGithubKnowledge(query: string, limit?: number): Promise<GithubKnowledge[]>;

  getCachedResponse(endpoint: string, queryHash: string): Promise<QueryCache | undefined>;
  setCachedResponse(entry: InsertQueryCache): Promise<QueryCache>;
  incrementCacheHit(id: number): Promise<void>;
  cleanExpiredCache(maxAgeDays?: number): Promise<number>;

  logUsage(userId: string, feature: string): Promise<UsageTracking>;
  logUsageCost(userId: string, feature: string, inputTokens: number, outputTokens: number, estimatedCost: number): Promise<void>;
  getMonthlyUsageCount(userId: string): Promise<number>;
  getUserTier(userId: string): Promise<string>;
  getCostAnalytics(): Promise<{ byFeature: Array<{ feature: string; totalQueries: number; totalInputTokens: number; totalOutputTokens: number; totalCost: string }>; totalCost: string; totalTokens: number }>;

  getAllUsers(): Promise<User[]>;
  deleteUser(userId: string): Promise<void>;
  updateUserTier(userId: string, tier: string): Promise<User | undefined>;
  updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<User | undefined>;
  isUserAdmin(userId: string): Promise<boolean>;
  hasAnyAdmin(): Promise<boolean>;
  getSystemStats(): Promise<{ totalUsers: number; totalThreads: number; totalMessages: number; totalDocuments: number; totalKnowledge: number; totalCacheEntries: number; totalUsageThisMonth: number }>;
  getUserProfile(userId: string): Promise<User | undefined>;
  updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; profileImageUrl?: string | null }): Promise<User | undefined>;

  addAdminKnowledge(entry: InsertAdminKnowledge): Promise<AdminKnowledge>;
  getAdminKnowledgeById(id: number): Promise<AdminKnowledge | undefined>;
  getAllAdminKnowledge(): Promise<AdminKnowledge[]>;
  getAdminKnowledgePage(limit: number, offset: number): Promise<PagedResult<AdminKnowledgeListItem>>;
  deleteAdminKnowledge(id: number): Promise<void>;
  deleteAllAdminKnowledge(): Promise<number>;
  searchAdminKnowledge(query: string, limit?: number): Promise<AdminKnowledge[]>;

  getSavedJudgments(userId: string): Promise<SavedJudgment[]>;
  saveJudgment(entry: InsertSavedJudgment): Promise<SavedJudgment>;
  deleteSavedJudgment(id: number, userId: string): Promise<void>;

  addStatuteDocument(entry: InsertStatuteDocument): Promise<StatuteDocument>;
  getAllStatuteDocuments(): Promise<StatuteDocument[]>;
  getStatuteDocumentsPage(limit: number, offset: number): Promise<PagedResult<StatuteDocumentListItem>>;
  getStatuteDocument(id: number): Promise<StatuteDocument | undefined>;
  deleteStatuteDocument(id: number): Promise<void>;
  deleteAllStatuteDocuments(): Promise<number>;
  searchStatuteDocuments(query: string, limit?: number): Promise<StatuteDocument[]>;

  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganization(id: number): Promise<Organization | undefined>;
  getUserOrganization(userId: string): Promise<Organization | undefined>;
  addOrgMember(member: InsertOrgMember): Promise<OrgMember>;
  getOrgMembers(orgId: number): Promise<(OrgMember & { email: string | null; firstName: string | null; lastName: string | null })[]>;
  removeOrgMember(orgId: number, userId: string): Promise<void>;
  isOrgMember(orgId: number, userId: string): Promise<boolean>;
  createOrgInvite(invite: InsertOrgInvite): Promise<OrgInvite>;
  getOrgInvites(orgId: number): Promise<OrgInvite[]>;
  getPendingInvitesForUser(email: string): Promise<(OrgInvite & { orgName: string })[]>;
  acceptOrgInvite(inviteId: number, userId: string): Promise<void>;
  declineOrgInvite(inviteId: number): Promise<void>;
  deleteOrganization(id: number): Promise<void>;

  addOrgKnowledge(entry: InsertOrgKnowledge): Promise<OrgKnowledge>;
  getOrgKnowledge(orgId: number): Promise<OrgKnowledge[]>;
  deleteOrgKnowledge(id: number): Promise<void>;
  searchOrgKnowledge(orgId: number, query: string, limit?: number): Promise<OrgKnowledge[]>;
}

export class DatabaseStorage implements IStorage {
  async createThread(insertThread: InsertThread & { userId: string }): Promise<Thread> {
    const [thread] = await db.insert(threads).values(insertThread).returning();
    return thread;
  }

  async getThreads(userId: string): Promise<Thread[]> {
    return await db.select()
      .from(threads)
      .where(eq(threads.userId, userId))
      .orderBy(desc(threads.createdAt));
  }

  async getThread(id: number): Promise<Thread | undefined> {
    const [thread] = await db.select().from(threads).where(eq(threads.id, id));
    return thread;
  }

  async deleteThread(id: number): Promise<void> {
    await db.delete(messages).where(eq(messages.threadId, id));
    await db.delete(threads).where(eq(threads.id, id));
  }

  async setThreadShareToken(id: number, token: string): Promise<Thread | undefined> {
    const [thread] = await db.update(threads).set({ shareToken: token }).where(eq(threads.id, id)).returning();
    return thread;
  }

  async getThreadByShareToken(token: string): Promise<Thread | undefined> {
    const [thread] = await db.select().from(threads).where(eq(threads.shareToken, token));
    return thread;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(insertMessage).returning();
    return message;
  }

  async getMessages(threadId: number): Promise<Message[]> {
    return await db.select()
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(messages.createdAt);
  }

  async createDocument(insertDoc: InsertDocument & { userId: string }): Promise<Document> {
    const [doc] = await db.insert(documents).values(insertDoc).returning();
    return doc;
  }

  async getDocuments(userId: string): Promise<Document[]> {
    return await db.select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt));
  }

  async getDocumentById(id: number, userId: string): Promise<Document | undefined> {
    const [doc] = await db.select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
      .limit(1);
    return doc;
  }

  async updateDocument(
    id: number,
    userId: string,
    data: Partial<Pick<InsertDocument, "title" | "content">>
  ): Promise<Document | undefined> {
    const updateData: Partial<Pick<InsertDocument, "title" | "content">> = {};
    if (typeof data.title === "string") updateData.title = data.title;
    if (typeof data.content === "string" || data.content === null) updateData.content = data.content;
    if (Object.keys(updateData).length === 0) return undefined;

    const [doc] = await db
      .update(documents)
      .set(updateData)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
      .returning();
    return doc;
  }

  async getAllDocuments(): Promise<Document[]> {
    return await db.select().from(documents);
  }

  async getDocumentInsights(userId: string): Promise<DocumentInsights> {
    const totalResult = await db.select({ total: count() }).from(documents).where(eq(documents.userId, userId));
    const totalDocuments = totalResult[0]?.total || 0;

    const sourceRows = await db.select({
      key: documents.sourceType,
      count: count(),
    })
      .from(documents)
      .where(eq(documents.userId, userId))
      .groupBy(documents.sourceType);

    const domainRows = await db.select({
      key: documents.detectedDomain,
      label: documents.detectedDomainLabel,
      count: count(),
    })
      .from(documents)
      .where(eq(documents.userId, userId))
      .groupBy(documents.detectedDomain, documents.detectedDomainLabel);

    const unclassifiedResult = await db.select({ total: count() })
      .from(documents)
      .where(and(
        eq(documents.userId, userId),
        or(
          sql`${documents.fileExtension} IS NULL`,
          sql`${documents.fileExtension} = ''`,
          sql`${documents.classificationMethod} IS NULL`,
          sql`${documents.classificationMethod} = ''`
        ),
      ));
    const unclassifiedCount = unclassifiedResult[0]?.total || 0;

    return {
      totalDocuments,
      sourceCounts: sourceRows
        .map((row: { key: string | null; count: number }) => {
          const key = (row.key || "other").toLowerCase();
          const label = key === "docx" ? "DOCX" : key.toUpperCase();
          return { key, label, count: row.count };
        })
        .sort((a: { count: number }, b: { count: number }) => b.count - a.count),
      domainCounts: domainRows
        .map((row: { key: string | null; label: string | null; count: number }) => ({
          key: row.key || "other",
          label: row.label || "Other",
          count: row.count,
        }))
        .sort((a: { count: number }, b: { count: number }) => b.count - a.count),
      unclassifiedCount,
    };
  }

  async getDocumentsNeedingMetadata(userId: string, limit: number): Promise<Document[]> {
    return await db.select()
      .from(documents)
      .where(and(
        eq(documents.userId, userId),
        or(
          sql`${documents.fileExtension} IS NULL`,
          sql`${documents.fileExtension} = ''`,
          sql`${documents.classificationMethod} IS NULL`,
          sql`${documents.classificationMethod} = ''`
        ),
      ))
      .orderBy(desc(documents.createdAt))
      .limit(limit);
  }

  async backfillDocumentMetadata(userId: string, updates: DocumentMetadataUpdate[]): Promise<number> {
    let updated = 0;
    for (const item of updates) {
      const [row] = await db
        .update(documents)
        .set({
          sourceType: item.sourceType,
          mimeType: item.mimeType,
          fileExtension: item.fileExtension,
          detectedDomain: item.detectedDomain,
          detectedDomainLabel: item.detectedDomainLabel,
          classificationMethod: item.classificationMethod,
          classificationConfidence: item.classificationConfidence,
        })
        .where(and(eq(documents.id, item.id), eq(documents.userId, userId)))
        .returning({ id: documents.id });
      if (row) updated += 1;
    }
    return updated;
  }

  async deleteDocument(id: number, userId: string): Promise<void> {
    await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
  }

  async deleteAllDocuments(userId: string): Promise<number> {
    const all = await db.select({ id: documents.id }).from(documents).where(eq(documents.userId, userId));
    if (all.length === 0) return 0;
    await db.delete(documents).where(eq(documents.userId, userId));
    return all.length;
  }

  async upsertDocumentFile(entry: InsertDocumentFile): Promise<DocumentFile> {
    const [record] = await db
      .insert(documentFiles)
      .values(entry)
      .onConflictDoUpdate({
        target: documentFiles.documentId,
        set: {
          userId: entry.userId,
          provider: entry.provider,
          bucket: entry.bucket,
          objectKey: entry.objectKey,
          extractedTextKey: entry.extractedTextKey ?? null,
          originalFilename: entry.originalFilename ?? null,
          mimeType: entry.mimeType ?? null,
          sizeBytes: entry.sizeBytes ?? null,
          etag: entry.etag ?? null,
          publicUrl: entry.publicUrl ?? null,
          createdAt: new Date(),
        },
      })
      .returning();
    return record;
  }

  async getDocumentFile(documentId: number, userId: string): Promise<DocumentFile | undefined> {
    const [record] = await db
      .select()
      .from(documentFiles)
      .where(and(eq(documentFiles.documentId, documentId), eq(documentFiles.userId, userId)))
      .limit(1);
    return record;
  }

  async getDocumentFilesByUser(userId: string): Promise<DocumentFile[]> {
    return await db
      .select()
      .from(documentFiles)
      .where(eq(documentFiles.userId, userId));
  }

  async deleteDocumentFile(documentId: number, userId: string): Promise<void> {
    await db
      .delete(documentFiles)
      .where(and(eq(documentFiles.documentId, documentId), eq(documentFiles.userId, userId)));
  }

  async getVisitorSessionStats(ipAddress: string, windowHours: number, maxMessages: number): Promise<VisitorSessionStats> {
    const normalizedIp = String(ipAddress || "").trim() || "unknown";
    const [row] = await db
      .select()
      .from(visitorSessions)
      .where(eq(visitorSessions.ipAddress, normalizedIp))
      .limit(1);
    return toVisitorSessionStats(row, normalizedIp, windowHours, maxMessages);
  }

  async incrementVisitorSession(ipAddress: string, windowHours: number, maxMessages: number): Promise<VisitorSessionStats> {
    const normalizedIp = String(ipAddress || "").trim() || "unknown";
    const now = new Date();
    const [existing] = await db
      .select()
      .from(visitorSessions)
      .where(eq(visitorSessions.ipAddress, normalizedIp))
      .limit(1);
    const stats = toVisitorSessionStats(existing, normalizedIp, windowHours, maxMessages);
    const nextCount = Math.max(1, Math.min(maxMessages, stats.messageCount + 1));

    if (existing) {
      const [updated] = await db
        .update(visitorSessions)
        .set({
          messageCount: nextCount,
          createdAt: stats.messageCount === 0 ? now : existing.createdAt,
          lastMessageAt: now,
        })
        .where(eq(visitorSessions.id, existing.id))
        .returning();
      return toVisitorSessionStats(updated, normalizedIp, windowHours, maxMessages);
    }

    const [inserted] = await db
      .insert(visitorSessions)
      .values({
        ipAddress: normalizedIp,
        messageCount: nextCount,
        createdAt: now,
        lastMessageAt: now,
      })
      .returning();
    return toVisitorSessionStats(inserted, normalizedIp, windowHours, maxMessages);
  }

  async logPublicFunnelEvent(entry: InsertPublicFunnelEvent & { ipAddress: string }): Promise<void> {
    await db.insert(publicFunnelEvents).values({
      eventType: entry.eventType,
      sessionId: entry.sessionId || null,
      ipAddress: entry.ipAddress,
      metadata: entry.metadata || {},
    });
  }

  async createCaseLead(entry: InsertCaseLead): Promise<CaseLead> {
    const [lead] = await db.insert(caseLeads).values(entry).returning();
    return lead;
  }

  async getCaseLeadsPage(limit: number, offset: number, query?: string): Promise<PagedResult<CaseLead>> {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const q = String(query || "").trim();
    const pattern = `%${q}%`;
    const whereClause = q
      ? or(
        ilike(caseLeads.name, pattern),
        ilike(caseLeads.phone, pattern),
        ilike(caseLeads.email, pattern),
        ilike(caseLeads.caseType, pattern),
        ilike(caseLeads.city, pattern),
        ilike(caseLeads.urgency, pattern),
        ilike(caseLeads.caseDescription, pattern),
        ilike(caseLeads.ipAddress, pattern),
        ilike(caseLeads.status, pattern),
      )
      : undefined;

    const [totalRow] = whereClause
      ? await db.select({ total: count() }).from(caseLeads).where(whereClause)
      : await db.select({ total: count() }).from(caseLeads);
    const total = Number(totalRow?.total || 0);

    const items = whereClause
      ? await db.select().from(caseLeads).where(whereClause).orderBy(desc(caseLeads.createdAt)).limit(safeLimit).offset(safeOffset)
      : await db.select().from(caseLeads).orderBy(desc(caseLeads.createdAt)).limit(safeLimit).offset(safeOffset);

    return {
      items,
      total,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + items.length < total,
    };
  }

  async getCaseLeadById(id: string): Promise<CaseLead | undefined> {
    const [lead] = await db.select().from(caseLeads).where(eq(caseLeads.id, id)).limit(1);
    return lead;
  }

  async updateCaseLeadStatus(id: string, status: CaseLeadStatus): Promise<CaseLead | undefined> {
    const [lead] = await db
      .update(caseLeads)
      .set({
        status,
        statusUpdatedAt: new Date(),
      })
      .where(eq(caseLeads.id, id))
      .returning();
    return lead;
  }

  async deleteCaseLead(id: string): Promise<void> {
    await db.delete(caseLeads).where(eq(caseLeads.id, id));
  }

  async getStyleMemorySettings(userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<StyleMemorySettingsView | null> {
    const [row] = await db
      .select()
      .from(styleMemorySettings)
      .where(
        and(
          eq(styleMemorySettings.userId, userId),
          eq(styleMemorySettings.module, module),
          orgId == null ? sql`${styleMemorySettings.orgId} IS NULL` : eq(styleMemorySettings.orgId, orgId),
        ),
      )
      .limit(1);
    return row ? toStyleMemorySettingsView(row) : null;
  }

  async upsertStyleMemorySettings(args: {
    userId: string;
    module: StyleMemoryModule;
    orgId?: number | null;
    enabled?: boolean;
    ownershipMode?: StyleMemoryScope;
    strictness?: StyleMemoryStrictness;
  }): Promise<StyleMemorySettingsView> {
    const existing = await this.getStyleMemorySettings(args.userId, args.module, args.orgId);
    const nextEnabled = args.enabled ?? existing?.enabled ?? true;
    const nextOwnershipMode = args.ownershipMode ?? existing?.ownershipMode ?? "user-org";
    const nextStrictness = args.strictness ?? existing?.strictness ?? "balanced";

    if (existing) {
      const [updated] = await db
        .update(styleMemorySettings)
        .set({
          enabled: nextEnabled,
          ownershipMode: nextOwnershipMode,
          strictness: nextStrictness,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(styleMemorySettings.userId, args.userId),
            eq(styleMemorySettings.module, args.module),
            args.orgId == null ? sql`${styleMemorySettings.orgId} IS NULL` : eq(styleMemorySettings.orgId, args.orgId),
          ),
        )
        .returning();
      return toStyleMemorySettingsView(updated);
    }

    const [inserted] = await db
      .insert(styleMemorySettings)
      .values({
        userId: args.userId,
        orgId: args.orgId ?? null,
        module: args.module,
        enabled: nextEnabled,
        ownershipMode: nextOwnershipMode,
        strictness: nextStrictness,
        learningSource: "full-activity",
        coverage: "generation-only",
      })
      .returning();
    return toStyleMemorySettingsView(inserted);
  }

  async touchStyleMemoryBackfill(userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<void> {
    const existing = await this.getStyleMemorySettings(userId, module, orgId);
    if (!existing) {
      await db.insert(styleMemorySettings).values({
        userId,
        orgId: orgId ?? null,
        module,
        enabled: true,
        ownershipMode: "user-org",
        learningSource: "full-activity",
        coverage: "generation-only",
        strictness: "balanced",
        lastBackfillAt: new Date(),
      });
      return;
    }

    await db
      .update(styleMemorySettings)
      .set({ lastBackfillAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(styleMemorySettings.userId, userId),
          eq(styleMemorySettings.module, module),
          orgId == null ? sql`${styleMemorySettings.orgId} IS NULL` : eq(styleMemorySettings.orgId, orgId),
        ),
      );
  }

  async getStyleMemorySourceCounts(userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<StyleMemorySourceCounts> {
    const rows = await db
      .select({
        sourceType: styleMemorySamples.sourceType,
        total: count(),
      })
      .from(styleMemorySamples)
      .where(
        and(
          eq(styleMemorySamples.userId, userId),
          eq(styleMemorySamples.module, module),
          eq(styleMemorySamples.status, "active"),
          orgId == null ? sql`${styleMemorySamples.orgId} IS NULL` : eq(styleMemorySamples.orgId, orgId),
        ),
      )
      .groupBy(styleMemorySamples.sourceType);

    let upload = 0;
    let savedDraft = 0;
    let acceptedRedline = 0;
    for (const row of rows) {
      if (row.sourceType === "upload") upload = Number(row.total || 0);
      if (row.sourceType === "saved-draft") savedDraft = Number(row.total || 0);
      if (row.sourceType === "accepted-redline") acceptedRedline = Number(row.total || 0);
    }

    return {
      upload,
      savedDraft,
      acceptedRedline,
      total: upload + savedDraft + acceptedRedline,
    };
  }

  async getStyleMemorySampleByHash(
    userId: string,
    module: StyleMemoryModule,
    textHash: string,
    orgId?: number | null,
  ): Promise<StyleMemorySample | undefined> {
    const [row] = await db
      .select()
      .from(styleMemorySamples)
      .where(
        and(
          eq(styleMemorySamples.userId, userId),
          eq(styleMemorySamples.module, module),
          eq(styleMemorySamples.textHash, textHash),
          orgId == null ? sql`${styleMemorySamples.orgId} IS NULL` : eq(styleMemorySamples.orgId, orgId),
        ),
      )
      .limit(1);
    return row;
  }

  async addStyleMemorySample(entry: InsertStyleMemorySample): Promise<StyleMemorySample> {
    const [row] = await db.insert(styleMemorySamples).values(entry).returning();
    return row;
  }

  async listStyleMemorySamples(
    userId: string,
    module: StyleMemoryModule,
    limit: number,
    offset: number,
    orgId?: number | null,
  ): Promise<PagedResult<StyleMemorySampleView>> {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const baseWhere = and(
      eq(styleMemorySamples.userId, userId),
      eq(styleMemorySamples.module, module),
      eq(styleMemorySamples.status, "active"),
      orgId == null ? sql`${styleMemorySamples.orgId} IS NULL` : eq(styleMemorySamples.orgId, orgId),
    );
    const [totalRow] = await db.select({ total: count() }).from(styleMemorySamples).where(baseWhere);
    const total = Number(totalRow?.total || 0);
    const rows = await db
      .select({
        id: styleMemorySamples.id,
        module: styleMemorySamples.module,
        sourceType: styleMemorySamples.sourceType,
        sourceRef: styleMemorySamples.sourceRef,
        title: styleMemorySamples.title,
        status: styleMemorySamples.status,
        createdAt: styleMemorySamples.createdAt,
      })
      .from(styleMemorySamples)
      .where(baseWhere)
      .orderBy(desc(styleMemorySamples.createdAt))
      .limit(safeLimit)
      .offset(safeOffset);

    return {
      items: rows.map((row: {
        id: number;
        module: string;
        sourceType: string;
        sourceRef: string | null;
        title: string;
        status: string;
        createdAt: Date | null;
      }) => ({
        id: row.id,
        module: row.module as StyleMemoryModule,
        sourceType: row.sourceType as StyleMemorySourceType,
        sourceRef: row.sourceRef,
        title: row.title,
        status: row.status as "active" | "deleted",
        createdAt: row.createdAt || null,
      })),
      total,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + rows.length < total,
    };
  }

  async deleteStyleMemorySample(id: number, userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<number> {
    const removed = await db
      .delete(styleMemorySamples)
      .where(
        and(
          eq(styleMemorySamples.id, id),
          eq(styleMemorySamples.userId, userId),
          eq(styleMemorySamples.module, module),
          orgId == null ? sql`${styleMemorySamples.orgId} IS NULL` : eq(styleMemorySamples.orgId, orgId),
        ),
      )
      .returning({ id: styleMemorySamples.id });
    return removed.length;
  }

  async deleteStyleMemoryChunksBySample(sampleId: number, userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<number> {
    const removed = await db
      .delete(styleMemoryChunks)
      .where(
        and(
          eq(styleMemoryChunks.sampleId, sampleId),
          eq(styleMemoryChunks.userId, userId),
          eq(styleMemoryChunks.module, module),
          orgId == null ? sql`${styleMemoryChunks.orgId} IS NULL` : eq(styleMemoryChunks.orgId, orgId),
        ),
      )
      .returning({ id: styleMemoryChunks.id });
    return removed.length;
  }

  async addStyleMemoryChunk(args: {
    sampleId: number;
    userId: string;
    module: StyleMemoryModule;
    orgId?: number | null;
    chunkIndex: number;
    content: string;
    tokenCount: number;
    embedding: string;
  }): Promise<void> {
    await db.insert(styleMemoryChunks).values({
      sampleId: args.sampleId,
      userId: args.userId,
      orgId: args.orgId ?? null,
      module: args.module,
      chunkIndex: args.chunkIndex,
      content: args.content,
      tokenCount: args.tokenCount,
      embedding: args.embedding,
    });
  }

  async logStyleMemoryEvent(args: {
    eventType: string;
    userId: string;
    module: StyleMemoryModule;
    orgId?: number | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await db.insert(styleMemoryEvents).values({
      eventType: args.eventType,
      userId: args.userId,
      orgId: args.orgId ?? null,
      module: args.module,
      metadata: args.metadata || {},
    });
  }

  async upsertAdminKnowledgeFile(entry: InsertAdminKnowledgeFile): Promise<AdminKnowledgeFile> {
    const [record] = await db
      .insert(adminKnowledgeFiles)
      .values(entry)
      .onConflictDoUpdate({
        target: adminKnowledgeFiles.adminKnowledgeId,
        set: {
          userId: entry.userId,
          provider: entry.provider,
          bucket: entry.bucket,
          objectKey: entry.objectKey,
          extractedTextKey: entry.extractedTextKey ?? null,
          originalFilename: entry.originalFilename ?? null,
          mimeType: entry.mimeType ?? null,
          sizeBytes: entry.sizeBytes ?? null,
          etag: entry.etag ?? null,
          publicUrl: entry.publicUrl ?? null,
          createdAt: new Date(),
        },
      })
      .returning();
    return record;
  }

  async getAdminKnowledgeFile(adminKnowledgeId: number): Promise<AdminKnowledgeFile | undefined> {
    const [record] = await db
      .select()
      .from(adminKnowledgeFiles)
      .where(eq(adminKnowledgeFiles.adminKnowledgeId, adminKnowledgeId))
      .limit(1);
    return record;
  }

  async getAdminKnowledgeFiles(): Promise<AdminKnowledgeFile[]> {
    return await db.select().from(adminKnowledgeFiles);
  }

  async deleteAdminKnowledgeFile(adminKnowledgeId: number): Promise<void> {
    await db.delete(adminKnowledgeFiles).where(eq(adminKnowledgeFiles.adminKnowledgeId, adminKnowledgeId));
  }

  async upsertStatuteDocumentFile(entry: InsertStatuteDocumentFile): Promise<StatuteDocumentFile> {
    const [record] = await db
      .insert(statuteDocumentFiles)
      .values(entry)
      .onConflictDoUpdate({
        target: statuteDocumentFiles.statuteDocumentId,
        set: {
          userId: entry.userId,
          provider: entry.provider,
          bucket: entry.bucket,
          objectKey: entry.objectKey,
          extractedTextKey: entry.extractedTextKey ?? null,
          originalFilename: entry.originalFilename ?? null,
          mimeType: entry.mimeType ?? null,
          sizeBytes: entry.sizeBytes ?? null,
          etag: entry.etag ?? null,
          publicUrl: entry.publicUrl ?? null,
          createdAt: new Date(),
        },
      })
      .returning();
    return record;
  }

  async getStatuteDocumentFile(statuteDocumentId: number): Promise<StatuteDocumentFile | undefined> {
    const [record] = await db
      .select()
      .from(statuteDocumentFiles)
      .where(eq(statuteDocumentFiles.statuteDocumentId, statuteDocumentId))
      .limit(1);
    return record;
  }

  async getStatuteDocumentFiles(): Promise<StatuteDocumentFile[]> {
    return await db.select().from(statuteDocumentFiles);
  }

  async deleteStatuteDocumentFile(statuteDocumentId: number): Promise<void> {
    await db.delete(statuteDocumentFiles).where(eq(statuteDocumentFiles.statuteDocumentId, statuteDocumentId));
  }

  async createBookmark(insertBookmark: InsertBookmark & { userId: string }): Promise<Bookmark> {
    const [bookmark] = await db.insert(bookmarks).values(insertBookmark).returning();
    return bookmark;
  }

  async getBookmarks(userId: string): Promise<Bookmark[]> {
    return await db.select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt));
  }

  async deleteBookmark(id: number, userId: string): Promise<void> {
    await db.delete(bookmarks).where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));
  }

  async addSearchHistory(entry: InsertSearchHistory & { userId: string }): Promise<SearchHistory> {
    const [record] = await db.insert(searchHistory).values(entry).returning();
    return record;
  }

  async getSearchHistory(userId: string): Promise<SearchHistory[]> {
    return await db.select()
      .from(searchHistory)
      .where(eq(searchHistory.userId, userId))
      .orderBy(desc(searchHistory.createdAt));
  }

  async searchStatutes(query: string, limit: number = 10): Promise<Statute[]> {
    const pattern = `%${query}%`;
    return await db.select()
      .from(statutes)
      .where(
        or(
          ilike(statutes.shortTitle, pattern),
          ilike(statutes.section, pattern),
          ilike(statutes.description, pattern),
          ilike(statutes.punishment, pattern)
        )
      )
      .limit(limit);
  }

  async getAllStatutes(): Promise<Statute[]> {
    return await db.select().from(statutes);
  }

  async searchCaseLaw(query: string, limit: number = 10): Promise<CaseLaw[]> {
    const pattern = `%${query}%`;
    return await db.select()
      .from(caseLaw)
      .where(
        or(
          ilike(caseLaw.citation, pattern),
          ilike(caseLaw.court, pattern),
          ilike(caseLaw.title, pattern),
          ilike(caseLaw.summary, pattern)
        )
      )
      .limit(limit);
  }

  async getAllCaseLaw(): Promise<CaseLaw[]> {
    return await db.select().from(caseLaw);
  }

  async getCaseLawPage(limit: number, offset: number): Promise<PagedResult<CaseLaw>> {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const [totalRow] = await db.select({ total: count() }).from(caseLaw);
    const total = Number(totalRow?.total || 0);
    const items = await db.select()
      .from(caseLaw)
      .orderBy(desc(caseLaw.id))
      .limit(safeLimit)
      .offset(safeOffset);
    return {
      items,
      total,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + items.length < total,
    };
  }

  async getCaseLawById(id: number): Promise<CaseLaw | undefined> {
    const [row] = await db.select().from(caseLaw).where(eq(caseLaw.id, id));
    return row;
  }

  async getCaseLawByCitation(citation: string): Promise<CaseLaw | undefined> {
    const [row] = await db.select().from(caseLaw).where(ilike(caseLaw.citation, `%${citation}%`)).limit(1);
    return row;
  }

  async getCaseLawCitations(): Promise<string[]> {
    const rows = await db.select({ citation: caseLaw.citation }).from(caseLaw);
    return rows.map((r: { citation: string }) => r.citation.toLowerCase().trim());
  }

  async createCaseLaw(entry: InsertCaseLaw): Promise<CaseLaw> {
    const [created] = await db.insert(caseLaw).values(entry).returning();
    return created;
  }

  async updateCaseLaw(id: number, entry: Partial<InsertCaseLaw>): Promise<CaseLaw | undefined> {
    const [updated] = await db.update(caseLaw).set(entry).where(eq(caseLaw.id, id)).returning();
    return updated;
  }

  async deleteCaseLaw(id: number): Promise<void> {
    await db.delete(caseLaw).where(eq(caseLaw.id, id));
  }

  async deleteAllCaseLaw(): Promise<number> {
    const all = await db.select({ id: caseLaw.id }).from(caseLaw);
    if (all.length === 0) return 0;
    await db.delete(caseLaw);
    return all.length;
  }

  async bulkCreateCaseLaw(entries: InsertCaseLaw[]): Promise<CaseLaw[]> {
    if (entries.length === 0) return [];
    const BATCH_SIZE = 500;
    const results: CaseLaw[] = [];
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const inserted = await db.insert(caseLaw).values(batch).returning();
      results.push(...inserted);
    }
    return results;
  }

  async getLawJournals(): Promise<Array<{ id: number; code: string; name: string }>> {
    return await db.select({
      id: lawJournals.id,
      code: lawJournals.code,
      name: lawJournals.name,
    })
      .from(lawJournals)
      .where(eq(lawJournals.isActive, true))
      .orderBy(lawJournals.code);
  }

  async getCourtsRef(): Promise<Array<{ id: number; code: string; name: string; level: string }>> {
    return await db.select({
      id: courtsRef.id,
      code: courtsRef.code,
      name: courtsRef.name,
      level: courtsRef.level,
    })
      .from(courtsRef)
      .where(eq(courtsRef.isActive, true))
      .orderBy(courtsRef.name);
  }

  async searchJudgmentsByCitation(params: { year: number; journalCode: string; page: number; court?: string }): Promise<CitationSearchResult[]> {
    const conditions = [
      eq(judgments.year, params.year),
      eq(judgments.page, params.page),
      eq(judgments.isActive, true),
      sql`lower(${lawJournals.code}) = lower(${params.journalCode})`,
    ];

    if (params.court && params.court.trim()) {
      const courtPattern = `%${params.court.trim()}%`;
      conditions.push(or(
        ilike(courtsRef.name, courtPattern),
        ilike(judgments.courtNameSnapshot, courtPattern),
      )!);
    }

    const rows = await db.select({
      id: judgments.id,
      citation: judgments.citationString,
      title: judgments.title,
      courtName: courtsRef.name,
      courtSnapshot: judgments.courtNameSnapshot,
      decisionDate: judgments.decisionDate,
      pdfUrl: judgments.pdfUrl,
    })
      .from(judgments)
      .innerJoin(lawJournals, eq(judgments.journalId, lawJournals.id))
      .leftJoin(courtsRef, eq(judgments.courtId, courtsRef.id))
      .where(and(...conditions))
      .orderBy(desc(judgments.decisionDate));

    return rows.map((row: typeof rows[number]) => ({
      id: row.id,
      citation: row.citation,
      title: row.title,
      court: row.courtName || row.courtSnapshot || "",
      decisionDate: row.decisionDate,
      pdfUrl: row.pdfUrl,
    }));
  }

  async getJudgmentDetail(id: string): Promise<JudgmentDetail | undefined> {
    const [row] = await db.select({
      id: judgments.id,
      year: judgments.year,
      page: judgments.page,
      journalCode: lawJournals.code,
      journalName: lawJournals.name,
      citation: judgments.citationString,
      title: judgments.title,
      petitioner: judgments.petitioner,
      respondent: judgments.respondent,
      courtName: courtsRef.name,
      courtSnapshot: judgments.courtNameSnapshot,
      decisionDate: judgments.decisionDate,
      headnotes: judgments.headnotes,
      fullText: judgments.fullText,
      pdfUrl: judgments.pdfUrl,
    })
      .from(judgments)
      .innerJoin(lawJournals, eq(judgments.journalId, lawJournals.id))
      .leftJoin(courtsRef, eq(judgments.courtId, courtsRef.id))
      .where(eq(judgments.id, id))
      .limit(1);

    if (!row) return undefined;

    const madeBase = await db.select({
      id: citationLinks.id,
      citationType: citationLinks.citationType,
      contextExcerpt: citationLinks.contextExcerpt,
      citationText: citationLinks.citationText,
      linkedJudgmentId: citationLinks.targetJudgmentId,
    })
      .from(citationLinks)
      .where(eq(citationLinks.sourceJudgmentId, id))
      .orderBy(desc(citationLinks.createdAt));

    const receivedBase = await db.select({
      id: citationLinks.id,
      citationType: citationLinks.citationType,
      contextExcerpt: citationLinks.contextExcerpt,
      citationText: citationLinks.citationText,
      linkedJudgmentId: citationLinks.sourceJudgmentId,
    })
      .from(citationLinks)
      .where(eq(citationLinks.targetJudgmentId, id))
      .orderBy(desc(citationLinks.createdAt));

    const linkedIds = Array.from(
      new Set(
        [...madeBase, ...receivedBase]
          .map((item) => item.linkedJudgmentId)
          .filter((item): item is string => typeof item === "string" && item.length > 0),
      ),
    );

    const linkedJudgments: Array<{ id: string; citation: string; title: string }> = linkedIds.length > 0
      ? await db.select({
        id: judgments.id,
        citation: judgments.citationString,
        title: judgments.title,
      })
        .from(judgments)
        .where(inArray(judgments.id, linkedIds))
      : [];
    const linkedMap = new Map<string, { id: string; citation: string; title: string }>(
      linkedJudgments.map((j: { id: string; citation: string; title: string }) => [j.id, j]),
    );

    const made = madeBase.map((item: typeof madeBase[number]) => {
      const linked = item.linkedJudgmentId ? linkedMap.get(item.linkedJudgmentId) : undefined;
      return {
        id: item.id,
        citationType: item.citationType,
        contextExcerpt: item.contextExcerpt,
        citationText: item.citationText,
        linkedJudgmentId: item.linkedJudgmentId,
        linkedCitation: linked?.citation || null,
        linkedTitle: linked?.title || null,
      };
    });

    const received = receivedBase.map((item: typeof receivedBase[number]) => {
      const linked = item.linkedJudgmentId ? linkedMap.get(item.linkedJudgmentId) : undefined;
      return {
        id: item.id,
        citationType: item.citationType,
        contextExcerpt: item.contextExcerpt,
        citationText: item.citationText,
        linkedJudgmentId: item.linkedJudgmentId,
        linkedCitation: linked?.citation || null,
        linkedTitle: linked?.title || null,
      };
    });

    return {
      id: row.id,
      year: row.year,
      page: row.page,
      journalCode: row.journalCode,
      journalName: row.journalName,
      citation: row.citation,
      title: row.title,
      petitioner: row.petitioner,
      respondent: row.respondent,
      court: row.courtName || row.courtSnapshot || "",
      decisionDate: row.decisionDate,
      headnotes: row.headnotes,
      fullText: row.fullText,
      pdfUrl: row.pdfUrl,
      citations: { made, received },
    };
  }

  async createJudgment(entry: InsertJudgment): Promise<Judgment> {
    const [created] = await db.insert(judgments).values(entry).returning();
    return created;
  }

  async createCitationLinks(entries: InsertCitationLink[]): Promise<number> {
    if (entries.length === 0) return 0;
    const inserted = await db.insert(citationLinks).values(entries).returning({ id: citationLinks.id });
    return inserted.length;
  }

  async createUnresolvedCitations(entries: InsertUnresolvedCitation[]): Promise<number> {
    if (entries.length === 0) return 0;
    const inserted = await db.insert(unresolvedCitations).values(entries).returning({ id: unresolvedCitations.id });
    return inserted.length;
  }

  async getGithubKnowledgeCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(githubKnowledge);
    return Number(result[0].count);
  }

  async getAllGithubKnowledge(): Promise<GithubKnowledge[]> {
    return await db.select().from(githubKnowledge);
  }

  async getGithubKnowledgeById(id: number): Promise<GithubKnowledge | undefined> {
    const [doc] = await db.select().from(githubKnowledge).where(eq(githubKnowledge.id, id)).limit(1);
    return doc;
  }

  async upsertGithubKnowledge(items: InsertGithubKnowledge[]): Promise<void> {
    for (const item of items) {
      const existing = await db.select().from(githubKnowledge).where(eq(githubKnowledge.filename, item.filename));
      if (existing.length > 0) {
        await db.update(githubKnowledge)
          .set({ content: item.content, title: item.title, syncedAt: new Date() })
          .where(eq(githubKnowledge.filename, item.filename));
      } else {
        await db.insert(githubKnowledge).values(item);
      }
    }
  }

  async searchGithubKnowledge(query: string, limit: number = 5): Promise<GithubKnowledge[]> {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return [];

    const conditions = words.map(word => 
      or(
        ilike(githubKnowledge.title, `%${word}%`),
        ilike(githubKnowledge.content, `%${word}%`)
      )
    );

    return await db.select()
      .from(githubKnowledge)
      .where(or(...conditions))
      .limit(limit);
  }

  async getCachedResponse(endpoint: string, queryHash: string): Promise<QueryCache | undefined> {
    const [cached] = await db.select()
      .from(queryCache)
      .where(and(eq(queryCache.endpoint, endpoint), eq(queryCache.queryHash, queryHash)))
      .orderBy(desc(queryCache.createdAt))
      .limit(1);
    return cached;
  }

  async setCachedResponse(entry: InsertQueryCache): Promise<QueryCache> {
    await db.delete(queryCache)
      .where(and(eq(queryCache.endpoint, entry.endpoint), eq(queryCache.queryHash, entry.queryHash)));
    const [cached] = await db.insert(queryCache).values(entry).returning();
    return cached;
  }

  async incrementCacheHit(id: number): Promise<void> {
    await db.update(queryCache)
      .set({ hitCount: sql`${queryCache.hitCount} + 1` })
      .where(eq(queryCache.id, id));
  }

  async cleanExpiredCache(maxAgeDays: number = 7): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    const deleted = await db.delete(queryCache)
      .where(lt(queryCache.createdAt, cutoff))
      .returning();
    return deleted.length;
  }

  async logUsage(userId: string, feature: string): Promise<UsageTracking> {
    const [entry] = await db.insert(usageTracking)
      .values({ userId, feature } as any)
      .returning();
    return entry;
  }

  async logUsageCost(userId: string, feature: string, inputTokens: number, outputTokens: number, estimatedCost: number): Promise<void> {
    await db.insert(usageTracking).values({
      userId,
      feature: feature as any,
      inputTokens,
      outputTokens,
      estimatedCost: estimatedCost.toFixed(6),
    });
  }

  async getCostAnalytics(): Promise<{ byFeature: Array<{ feature: string; totalQueries: number; totalInputTokens: number; totalOutputTokens: number; totalCost: string }>; totalCost: string; totalTokens: number }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const byFeature = await db.select({
      feature: usageTracking.feature,
      totalQueries: count(),
      totalInputTokens: sql<number>`COALESCE(SUM(${usageTracking.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`COALESCE(SUM(${usageTracking.outputTokens}), 0)`,
      totalCost: sql<string>`COALESCE(SUM(CAST(${usageTracking.estimatedCost} AS DECIMAL)), 0)`,
    })
      .from(usageTracking)
      .where(gte(usageTracking.createdAt, startOfMonth))
      .groupBy(usageTracking.feature);

    const totalCost = byFeature.reduce((sum: number, f: any) => sum + parseFloat(String(f.totalCost) || "0"), 0);
    const totalTokens = byFeature.reduce((sum: number, f: any) => sum + (Number(f.totalInputTokens) || 0) + (Number(f.totalOutputTokens) || 0), 0);

    return {
      byFeature: byFeature.map((f: any) => ({
        feature: f.feature,
        totalQueries: f.totalQueries,
        totalInputTokens: Number(f.totalInputTokens) || 0,
        totalOutputTokens: Number(f.totalOutputTokens) || 0,
        totalCost: parseFloat(String(f.totalCost) || "0").toFixed(4),
      })),
      totalCost: totalCost.toFixed(4),
      totalTokens,
    };
  }

  async getMonthlyUsageCount(userId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [result] = await db.select({ total: count() })
      .from(usageTracking)
      .where(and(
        eq(usageTracking.userId, userId),
        gte(usageTracking.createdAt, startOfMonth)
      ));
    return result?.total || 0;
  }

  async getUserTier(userId: string): Promise<string> {
    const [user] = await db.select({ tier: users.subscriptionTier })
      .from(users)
      .where(eq(users.id, userId));
    return user?.tier || "free";
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async deleteUser(userId: string): Promise<void> {
    const userThreads = await db.select({ id: threads.id }).from(threads).where(eq(threads.userId, userId));
    const threadIds = userThreads.map((t: { id: number }) => t.id);
    if (threadIds.length > 0) {
      for (const tid of threadIds) {
        await db.delete(messages).where(eq(messages.threadId, tid));
      }
      await db.delete(threads).where(eq(threads.userId, userId));
    }
    await db.delete(documents).where(eq(documents.userId, userId));
    await db.delete(bookmarks).where(eq(bookmarks.userId, userId));
    await db.delete(searchHistory).where(eq(searchHistory.userId, userId));
    await db.delete(usageTracking).where(eq(usageTracking.userId, userId));
    await db.update(adminKnowledge).set({ uploadedBy: null }).where(eq(adminKnowledge.uploadedBy, userId));
    await db.delete(users).where(eq(users.id, userId));
  }

  async updateUserTier(userId: string, tier: string): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ subscriptionTier: tier, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ isAdmin, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async isUserAdmin(userId: string): Promise<boolean> {
    const [user] = await db.select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, userId));
    return user?.isAdmin || false;
  }

  async hasAnyAdmin(): Promise<boolean> {
    const [result] = await db.select({ total: count() })
      .from(users)
      .where(eq(users.isAdmin, true));
    return (result?.total || 0) > 0;
  }

  async getSystemStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const safeCount = async (table: unknown, label: string): Promise<number> => {
      try {
        const [row] = await db.select({ total: count() }).from(table as any);
        return Number(row?.total || 0);
      } catch (err: any) {
        if (String(err?.code || "") === "42P01") {
          console.warn(`[Stats] Missing relation for ${label}; defaulting count to 0.`);
          return 0;
        }
        throw err;
      }
    };

    const safeGithubCount = async (): Promise<number> => {
      try {
        return await this.getGithubKnowledgeCount();
      } catch (err: any) {
        if (String(err?.code || "") === "42P01") {
          console.warn("[Stats] Missing relation for github_knowledge; defaulting count to 0.");
          return 0;
        }
        throw err;
      }
    };

    const totalUsers = await safeCount(users, "users");
    const totalThreads = await safeCount(threads, "threads");
    const totalMessages = await safeCount(messages, "messages");
    const totalDocuments = await safeCount(documents, "documents");
    const totalGithubKnowledge = await safeGithubCount();
    const totalAdminKnowledge = await safeCount(adminKnowledge, "admin_knowledge");
    const totalCaseLaw = await safeCount(caseLaw, "case_law");
    const totalStatuteDocuments = await safeCount(statuteDocuments, "statute_documents");
    const totalCitationJudgments = await safeCount(judgments, "judgments");
    const totalCacheEntries = await safeCount(queryCache, "query_cache");
    const [usageCount] = await db.select({ total: count() })
      .from(usageTracking)
      .where(gte(usageTracking.createdAt, startOfMonth));

    const totalKnowledge =
      totalGithubKnowledge +
      totalAdminKnowledge +
      totalCaseLaw +
      totalStatuteDocuments +
      totalCitationJudgments;

    return {
      totalUsers,
      totalThreads,
      totalMessages,
      totalDocuments,
      totalKnowledge,
      totalCacheEntries,
      totalUsageThisMonth: usageCount?.total || 0,
      knowledgeBreakdown: {
        github: totalGithubKnowledge,
        adminKnowledge: totalAdminKnowledge,
        caseLaw: totalCaseLaw,
        statuteDocuments: totalStatuteDocuments,
        citationJudgments: totalCitationJudgments,
      },
    };
  }

  async getUserProfile(userId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user;
  }

  async updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; profileImageUrl?: string | null }): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async addAdminKnowledge(entry: InsertAdminKnowledge): Promise<AdminKnowledge> {
    const [doc] = await db.insert(adminKnowledge).values(entry).returning();
    return doc;
  }

  async getAdminKnowledgeById(id: number): Promise<AdminKnowledge | undefined> {
    const [doc] = await db.select().from(adminKnowledge).where(eq(adminKnowledge.id, id)).limit(1);
    return doc;
  }

  async getAllAdminKnowledge(): Promise<AdminKnowledge[]> {
    return await db.select().from(adminKnowledge).orderBy(desc(adminKnowledge.createdAt));
  }

  async getAdminKnowledgePage(limit: number, offset: number): Promise<PagedResult<AdminKnowledgeListItem>> {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const [totalRow] = await db.select({ total: count() }).from(adminKnowledge);
    const total = Number(totalRow?.total || 0);
    const items = await db.select({
      id: adminKnowledge.id,
      title: adminKnowledge.title,
      filename: adminKnowledge.filename,
      category: adminKnowledge.category,
      uploadedBy: adminKnowledge.uploadedBy,
      createdAt: adminKnowledge.createdAt,
    })
      .from(adminKnowledge)
      .orderBy(desc(adminKnowledge.createdAt))
      .limit(safeLimit)
      .offset(safeOffset);
    return {
      items,
      total,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + items.length < total,
    };
  }

  async deleteAdminKnowledge(id: number): Promise<void> {
    await db.delete(adminKnowledge).where(eq(adminKnowledge.id, id));
  }

  async deleteAllAdminKnowledge(): Promise<number> {
    const all = await db.select({ id: adminKnowledge.id }).from(adminKnowledge);
    if (all.length === 0) return 0;
    await db.delete(adminKnowledge);
    return all.length;
  }

  async searchAdminKnowledge(query: string, limit: number = 5): Promise<AdminKnowledge[]> {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return [];

    const conditions = words.map(word =>
      or(
        ilike(adminKnowledge.title, `%${word}%`),
        ilike(adminKnowledge.content, `%${word}%`)
      )
    );

    return await db.select()
      .from(adminKnowledge)
      .where(or(...conditions))
      .limit(limit);
  }

  async getSavedJudgments(userId: string): Promise<SavedJudgment[]> {
    return await db.select()
      .from(savedJudgments)
      .where(eq(savedJudgments.userId, userId))
      .orderBy(desc(savedJudgments.createdAt));
  }

  async saveJudgment(entry: InsertSavedJudgment): Promise<SavedJudgment> {
    const [saved] = await db.insert(savedJudgments).values(entry).returning();
    return saved;
  }

  async deleteSavedJudgment(id: number, userId: string): Promise<void> {
    await db.delete(savedJudgments).where(and(eq(savedJudgments.id, id), eq(savedJudgments.userId, userId)));
  }

  async addStatuteDocument(entry: InsertStatuteDocument): Promise<StatuteDocument> {
    const [doc] = await db.insert(statuteDocuments).values(entry).returning();
    return doc;
  }

  async getAllStatuteDocuments(): Promise<StatuteDocument[]> {
    return await db.select().from(statuteDocuments).orderBy(desc(statuteDocuments.createdAt));
  }

  async getStatuteDocumentsPage(limit: number, offset: number): Promise<PagedResult<StatuteDocumentListItem>> {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const [totalRow] = await db.select({ total: count() }).from(statuteDocuments);
    const total = Number(totalRow?.total || 0);
    const items = await db.select({
      id: statuteDocuments.id,
      title: statuteDocuments.title,
      filename: statuteDocuments.filename,
      category: statuteDocuments.category,
      uploadedBy: statuteDocuments.uploadedBy,
      createdAt: statuteDocuments.createdAt,
    })
      .from(statuteDocuments)
      .orderBy(desc(statuteDocuments.createdAt))
      .limit(safeLimit)
      .offset(safeOffset);
    return {
      items,
      total,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + items.length < total,
    };
  }

  async getStatuteDocument(id: number): Promise<StatuteDocument | undefined> {
    const [doc] = await db.select().from(statuteDocuments).where(eq(statuteDocuments.id, id));
    return doc;
  }

  async deleteStatuteDocument(id: number): Promise<void> {
    await db.delete(statuteDocuments).where(eq(statuteDocuments.id, id));
  }

  async deleteAllStatuteDocuments(): Promise<number> {
    const all = await db.select({ id: statuteDocuments.id }).from(statuteDocuments);
    if (all.length === 0) return 0;
    await db.delete(statuteDocuments);
    return all.length;
  }

  async searchStatuteDocuments(query: string, limit: number = 20): Promise<StatuteDocument[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    return await db.select({
      id: statuteDocuments.id,
      title: statuteDocuments.title,
      filename: statuteDocuments.filename,
      content: statuteDocuments.content,
      category: statuteDocuments.category,
      uploadedBy: statuteDocuments.uploadedBy,
      createdAt: statuteDocuments.createdAt,
    })
      .from(statuteDocuments)
      .where(
        or(
          ilike(statuteDocuments.title, `%${trimmed}%`),
          ilike(statuteDocuments.content, `%${trimmed}%`),
          ilike(statuteDocuments.filename, `%${trimmed}%`),
          ilike(statuteDocuments.category, `%${trimmed}%`)
        )
      )
      .orderBy(statuteDocuments.title)
      .limit(limit);
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [created] = await db.insert(organizations).values(org).returning();
    await db.insert(orgMembers).values({ orgId: created.id, userId: org.ownerId, role: "owner" });
    return created;
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async getUserOrganization(userId: string): Promise<Organization | undefined> {
    const membership = await db.select({ orgId: orgMembers.orgId })
      .from(orgMembers)
      .where(eq(orgMembers.userId, userId))
      .limit(1);
    if (membership.length === 0) return undefined;
    return this.getOrganization(membership[0].orgId);
  }

  async addOrgMember(member: InsertOrgMember): Promise<OrgMember> {
    const [created] = await db.insert(orgMembers).values(member).returning();
    return created;
  }

  async getOrgMembers(orgId: number): Promise<(OrgMember & { email: string | null; firstName: string | null; lastName: string | null })[]> {
    const rows = await db.select({
      id: orgMembers.id,
      orgId: orgMembers.orgId,
      userId: orgMembers.userId,
      role: orgMembers.role,
      joinedAt: orgMembers.joinedAt,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
      .from(orgMembers)
      .innerJoin(users, eq(orgMembers.userId, users.id))
      .where(eq(orgMembers.orgId, orgId));
    return rows;
  }

  async removeOrgMember(orgId: number, userId: string): Promise<void> {
    await db.delete(orgMembers).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
  }

  async isOrgMember(orgId: number, userId: string): Promise<boolean> {
    const [row] = await db.select({ id: orgMembers.id })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
    return !!row;
  }

  async createOrgInvite(invite: InsertOrgInvite): Promise<OrgInvite> {
    const [created] = await db.insert(orgInvites).values(invite).returning();
    return created;
  }

  async getOrgInvites(orgId: number): Promise<OrgInvite[]> {
    return await db.select().from(orgInvites)
      .where(eq(orgInvites.orgId, orgId))
      .orderBy(desc(orgInvites.createdAt));
  }

  async getPendingInvitesForUser(email: string): Promise<(OrgInvite & { orgName: string })[]> {
    const rows = await db.select({
      id: orgInvites.id,
      orgId: orgInvites.orgId,
      email: orgInvites.email,
      invitedBy: orgInvites.invitedBy,
      status: orgInvites.status,
      createdAt: orgInvites.createdAt,
      orgName: organizations.name,
    })
      .from(orgInvites)
      .innerJoin(organizations, eq(orgInvites.orgId, organizations.id))
      .where(and(eq(orgInvites.email, email.toLowerCase()), eq(orgInvites.status, "pending")));
    return rows;
  }

  async acceptOrgInvite(inviteId: number, userId: string): Promise<void> {
    const [invite] = await db.select().from(orgInvites).where(eq(orgInvites.id, inviteId));
    if (!invite) return;
    await db.update(orgInvites).set({ status: "accepted" }).where(eq(orgInvites.id, inviteId));
    const existing = await this.isOrgMember(invite.orgId, userId);
    if (!existing) {
      await db.insert(orgMembers).values({ orgId: invite.orgId, userId, role: "member" });
    }
  }

  async declineOrgInvite(inviteId: number): Promise<void> {
    await db.update(orgInvites).set({ status: "declined" }).where(eq(orgInvites.id, inviteId));
  }

  async deleteOrganization(id: number): Promise<void> {
    await db.delete(orgKnowledge).where(eq(orgKnowledge.orgId, id));
    await db.delete(orgInvites).where(eq(orgInvites.orgId, id));
    await db.delete(orgMembers).where(eq(orgMembers.orgId, id));
    await db.delete(organizations).where(eq(organizations.id, id));
  }

  async addOrgKnowledge(entry: InsertOrgKnowledge): Promise<OrgKnowledge> {
    const [doc] = await db.insert(orgKnowledge).values(entry).returning();
    return doc;
  }

  async getOrgKnowledge(orgId: number): Promise<OrgKnowledge[]> {
    return await db.select().from(orgKnowledge)
      .where(eq(orgKnowledge.orgId, orgId))
      .orderBy(desc(orgKnowledge.createdAt));
  }

  async deleteOrgKnowledge(id: number): Promise<void> {
    await db.delete(orgKnowledge).where(eq(orgKnowledge.id, id));
  }

  async searchOrgKnowledge(orgId: number, query: string, limit: number = 5): Promise<OrgKnowledge[]> {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return [];

    const conditions = words.map(word =>
      or(
        ilike(orgKnowledge.title, `%${word}%`),
        ilike(orgKnowledge.content, `%${word}%`)
      )
    );

    return await db.select()
      .from(orgKnowledge)
      .where(and(eq(orgKnowledge.orgId, orgId), or(...conditions)))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();

const JOURNAL_SEED_DATA: Array<{ code: string; name: string }> = [
  { code: "PLD", name: "Pakistan Law Decisions" },
  { code: "SCMR", name: "Supreme Court Monthly Review" },
  { code: "PLJ", name: "Pakistan Law Journal" },
  { code: "MLD", name: "Monthly Law Digest" },
  { code: "CLC", name: "Civil Law Cases" },
  { code: "YLR", name: "Yearly Law Reporter" },
  { code: "CLD", name: "Corporate Law Decisions" },
  { code: "PTD", name: "Pakistan Tax Decisions" },
];

const COURT_SEED_DATA: Array<{ code: string; name: string; level: string }> = [
  { code: "SC", name: "Supreme Court of Pakistan", level: "supreme" },
  { code: "IHC", name: "Islamabad High Court", level: "high" },
  { code: "LHC", name: "Lahore High Court", level: "high" },
  { code: "SHC", name: "Sindh High Court", level: "high" },
  { code: "PHC", name: "Peshawar High Court", level: "high" },
  { code: "BHC", name: "Balochistan High Court", level: "high" },
  { code: "FSC", name: "Federal Shariat Court", level: "federal" },
];

async function ensureCitationReferenceSeedData(): Promise<void> {
  for (const journal of JOURNAL_SEED_DATA) {
    try {
      await db.insert(lawJournals)
        .values({ code: journal.code, name: journal.name, isActive: true })
        .onConflictDoNothing({ target: lawJournals.code });
    } catch (err: any) {
      console.warn(`[Seed] Could not ensure journal ${journal.code}:`, err?.message || err);
    }
  }

  for (const court of COURT_SEED_DATA) {
    try {
      await db.insert(courtsRef)
        .values({ code: court.code, name: court.name, level: court.level, isActive: true })
        .onConflictDoNothing({ target: courtsRef.code });
    } catch (err: any) {
      console.warn(`[Seed] Could not ensure court ${court.code}:`, err?.message || err);
    }
  }
}

export async function ensureSearchIndexes(): Promise<void> {
  const indexStatements = [
    { label: "pgcrypto_extension", stmt: sql`CREATE EXTENSION IF NOT EXISTS pgcrypto` },
    { label: "pg_trgm_extension", stmt: sql`CREATE EXTENSION IF NOT EXISTS pg_trgm` },
    {
      label: "saved_judgments_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS saved_judgments (
          id serial PRIMARY KEY,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          citation text NOT NULL,
          court text NOT NULL,
          title text NOT NULL,
          summary text NOT NULL,
          keywords text[],
          uri text,
          source text,
          ai_analysis text,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "organizations_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS organizations (
          id serial PRIMARY KEY,
          name text NOT NULL,
          description text,
          owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "org_members_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS org_members (
          id serial PRIMARY KEY,
          org_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role text NOT NULL DEFAULT 'member',
          joined_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "org_invites_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS org_invites (
          id serial PRIMARY KEY,
          org_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          email text NOT NULL,
          invited_by varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status text NOT NULL DEFAULT 'pending',
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "org_knowledge_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS org_knowledge (
          id serial PRIMARY KEY,
          org_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          title text NOT NULL,
          filename text NOT NULL,
          content text NOT NULL,
          category text NOT NULL DEFAULT 'general',
          uploaded_by varchar REFERENCES users(id),
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "law_journals_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS law_journals (
          id serial PRIMARY KEY,
          code text NOT NULL,
          name text NOT NULL,
          is_active boolean NOT NULL DEFAULT true,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "courts_ref_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS courts_ref (
          id serial PRIMARY KEY,
          code text NOT NULL,
          name text NOT NULL,
          level text NOT NULL,
          is_active boolean NOT NULL DEFAULT true,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "judgments_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS judgments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          year integer NOT NULL,
          journal_id integer NOT NULL REFERENCES law_journals(id),
          page integer NOT NULL,
          citation_string text NOT NULL,
          title text NOT NULL,
          petitioner text,
          respondent text,
          court_id integer REFERENCES courts_ref(id),
          court_name_snapshot text,
          decision_date timestamp,
          headnotes text,
          full_text text NOT NULL,
          pdf_url text,
          is_active boolean NOT NULL DEFAULT true,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "citation_links_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS citation_links (
          id serial PRIMARY KEY,
          source_judgment_id uuid NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
          target_judgment_id uuid NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
          citation_type text NOT NULL,
          context_excerpt text,
          citation_text text NOT NULL,
          start_offset integer,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "unresolved_citations_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS unresolved_citations (
          id serial PRIMARY KEY,
          source_judgment_id uuid NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
          raw_citation text NOT NULL,
          year integer,
          journal_code text,
          page integer,
          context_excerpt text,
          status text NOT NULL DEFAULT 'pending',
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "document_files_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS document_files (
          id serial PRIMARY KEY,
          document_id integer NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider text NOT NULL DEFAULT 'r2',
          bucket text NOT NULL,
          object_key text NOT NULL,
          extracted_text_key text,
          original_filename text,
          mime_type text,
          size_bytes integer,
          etag text,
          public_url text,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "visitor_sessions_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS visitor_sessions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          ip_address text NOT NULL,
          message_count integer NOT NULL DEFAULT 0,
          created_at timestamp NOT NULL DEFAULT now(),
          last_message_at timestamp NOT NULL DEFAULT now()
        )
      `,
    },
    {
      label: "case_leads_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS case_leads (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL,
          phone text NOT NULL,
          email text NOT NULL,
          case_type text NOT NULL,
          case_description text NOT NULL,
          city text NOT NULL DEFAULT '',
          urgency text NOT NULL DEFAULT 'normal',
          preferred_callback_time text,
          consent_to_contact boolean NOT NULL DEFAULT false,
          ip_address text NOT NULL,
          status text NOT NULL DEFAULT 'open',
          status_updated_at timestamp NOT NULL DEFAULT now(),
          created_at timestamp NOT NULL DEFAULT now()
        )
      `,
    },
    {
      label: "public_funnel_events_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS public_funnel_events (
          id serial PRIMARY KEY,
          event_type text NOT NULL,
          session_id text,
          ip_address text NOT NULL,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `,
    },
    {
      label: "admin_knowledge_files_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS admin_knowledge_files (
          id serial PRIMARY KEY,
          admin_knowledge_id integer NOT NULL REFERENCES admin_knowledge(id) ON DELETE CASCADE,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider text NOT NULL DEFAULT 'r2',
          bucket text NOT NULL,
          object_key text NOT NULL,
          extracted_text_key text,
          original_filename text,
          mime_type text,
          size_bytes integer,
          etag text,
          public_url text,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "statute_document_files_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS statute_document_files (
          id serial PRIMARY KEY,
          statute_document_id integer NOT NULL REFERENCES statute_documents(id) ON DELETE CASCADE,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider text NOT NULL DEFAULT 'r2',
          bucket text NOT NULL,
          object_key text NOT NULL,
          extracted_text_key text,
          original_filename text,
          mime_type text,
          size_bytes integer,
          etag text,
          public_url text,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    { label: "vector_extension", stmt: sql`CREATE EXTENSION IF NOT EXISTS vector` },
    {
      label: "style_memory_settings_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS style_memory_settings (
          id serial PRIMARY KEY,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          org_id integer REFERENCES organizations(id) ON DELETE CASCADE,
          module text NOT NULL,
          enabled boolean NOT NULL DEFAULT true,
          ownership_mode text NOT NULL DEFAULT 'user-org',
          learning_source text NOT NULL DEFAULT 'full-activity',
          coverage text NOT NULL DEFAULT 'generation-only',
          strictness text NOT NULL DEFAULT 'balanced',
          last_backfill_at timestamp,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "style_memory_samples_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS style_memory_samples (
          id serial PRIMARY KEY,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          org_id integer REFERENCES organizations(id) ON DELETE CASCADE,
          module text NOT NULL,
          source_type text NOT NULL,
          source_ref text,
          title text NOT NULL,
          raw_text text NOT NULL,
          text_hash text NOT NULL,
          status text NOT NULL DEFAULT 'active',
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "style_memory_chunks_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS style_memory_chunks (
          id serial PRIMARY KEY,
          sample_id integer NOT NULL REFERENCES style_memory_samples(id) ON DELETE CASCADE,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          org_id integer REFERENCES organizations(id) ON DELETE CASCADE,
          module text NOT NULL,
          chunk_index integer NOT NULL,
          content text NOT NULL,
          token_count integer NOT NULL,
          embedding vector(384) NOT NULL,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "style_memory_events_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS style_memory_events (
          id serial PRIMARY KEY,
          event_type text NOT NULL,
          module text NOT NULL,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          org_id integer REFERENCES organizations(id) ON DELETE CASCADE,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    { label: "idx_threads_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads (user_id)` },
    { label: "idx_messages_thread_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages (thread_id)` },
    { label: "idx_documents_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents (user_id)` },
    { label: "idx_bookmarks_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks (user_id)` },
    { label: "idx_search_history_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history (user_id)` },
    { label: "idx_usage_tracking_user_created", stmt: sql`CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_created ON usage_tracking (user_id, created_at)` },
    { label: "idx_saved_judgments_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_saved_judgments_user_id ON saved_judgments (user_id)` },
    { label: "idx_query_cache_endpoint_hash", stmt: sql`CREATE INDEX IF NOT EXISTS idx_query_cache_endpoint_hash ON query_cache (endpoint, query_hash)` },
    { label: "idx_case_law_citation_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_law_citation_trgm ON case_law USING gin (citation gin_trgm_ops)` },
    { label: "idx_case_law_title_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_law_title_trgm ON case_law USING gin (title gin_trgm_ops)` },
    { label: "idx_case_law_court_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_law_court_trgm ON case_law USING gin (court gin_trgm_ops)` },
    { label: "idx_github_knowledge_title_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_github_knowledge_title_trgm ON github_knowledge USING gin (title gin_trgm_ops)` },
    { label: "idx_statutes_short_title_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_statutes_short_title_trgm ON statutes USING gin (short_title gin_trgm_ops)` },
    { label: "idx_statutes_description_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_statutes_description_trgm ON statutes USING gin (description gin_trgm_ops)` },
    { label: "idx_statute_documents_title_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_statute_documents_title_trgm ON statute_documents USING gin (title gin_trgm_ops)` },
    { label: "idx_statute_documents_content_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_statute_documents_content_trgm ON statute_documents USING gin (content gin_trgm_ops)` },
    { label: "idx_law_journals_code", stmt: sql`CREATE INDEX IF NOT EXISTS idx_law_journals_code ON law_journals (code)` },
    { label: "idx_courts_ref_code", stmt: sql`CREATE INDEX IF NOT EXISTS idx_courts_ref_code ON courts_ref (code)` },
    { label: "law_journals_code_unique", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS law_journals_code_unique ON law_journals (code)` },
    { label: "courts_ref_code_unique", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS courts_ref_code_unique ON courts_ref (code)` },
    { label: "idx_judgments_citation_parts", stmt: sql`CREATE INDEX IF NOT EXISTS idx_judgments_citation_parts ON judgments (year, journal_id, page)` },
    { label: "judgments_year_journal_page_unique", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS judgments_year_journal_page_unique ON judgments (year, journal_id, page)` },
    { label: "idx_judgments_citation_string_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_judgments_citation_string_trgm ON judgments USING gin (citation_string gin_trgm_ops)` },
    { label: "idx_judgments_full_text_tsv", stmt: sql`CREATE INDEX IF NOT EXISTS idx_judgments_full_text_tsv ON judgments USING gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(headnotes,'') || ' ' || coalesce(full_text,'')))` },
    { label: "idx_citation_links_source", stmt: sql`CREATE INDEX IF NOT EXISTS idx_citation_links_source ON citation_links (source_judgment_id)` },
    { label: "idx_citation_links_target", stmt: sql`CREATE INDEX IF NOT EXISTS idx_citation_links_target ON citation_links (target_judgment_id)` },
    { label: "citation_links_unique", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS citation_links_unique ON citation_links (source_judgment_id, target_judgment_id, citation_type, citation_text)` },
    { label: "idx_unresolved_citations_status", stmt: sql`CREATE INDEX IF NOT EXISTS idx_unresolved_citations_status ON unresolved_citations (status)` },
    { label: "idx_document_files_document_id", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_document_files_document_id ON document_files (document_id)` },
    { label: "idx_document_files_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_document_files_user_id ON document_files (user_id)` },
    { label: "visitor_sessions_ip_address_unique", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS visitor_sessions_ip_address_unique ON visitor_sessions (ip_address)` },
    { label: "idx_visitor_sessions_last_message_at", stmt: sql`CREATE INDEX IF NOT EXISTS idx_visitor_sessions_last_message_at ON visitor_sessions (last_message_at)` },
    { label: "idx_case_leads_created_at", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_leads_created_at ON case_leads (created_at)` },
    { label: "idx_case_leads_case_type", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_leads_case_type ON case_leads (case_type)` },
    { label: "idx_case_leads_city", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_leads_city ON case_leads (city)` },
    { label: "idx_case_leads_urgency", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_leads_urgency ON case_leads (urgency)` },
    { label: "idx_case_leads_status", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_leads_status ON case_leads (status)` },
    { label: "idx_public_funnel_events_created_at", stmt: sql`CREATE INDEX IF NOT EXISTS idx_public_funnel_events_created_at ON public_funnel_events (created_at)` },
    { label: "idx_public_funnel_events_event_type", stmt: sql`CREATE INDEX IF NOT EXISTS idx_public_funnel_events_event_type ON public_funnel_events (event_type)` },
    { label: "idx_public_funnel_events_ip", stmt: sql`CREATE INDEX IF NOT EXISTS idx_public_funnel_events_ip ON public_funnel_events (ip_address)` },
    { label: "alter_case_leads_status", stmt: sql`ALTER TABLE case_leads ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'` },
    { label: "alter_case_leads_status_updated_at", stmt: sql`ALTER TABLE case_leads ADD COLUMN IF NOT EXISTS status_updated_at timestamp NOT NULL DEFAULT now()` },
    { label: "alter_case_leads_city", stmt: sql`ALTER TABLE case_leads ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT ''` },
    { label: "alter_case_leads_urgency", stmt: sql`ALTER TABLE case_leads ADD COLUMN IF NOT EXISTS urgency text NOT NULL DEFAULT 'normal'` },
    { label: "alter_case_leads_preferred_callback_time", stmt: sql`ALTER TABLE case_leads ADD COLUMN IF NOT EXISTS preferred_callback_time text` },
    { label: "alter_case_leads_consent_to_contact", stmt: sql`ALTER TABLE case_leads ADD COLUMN IF NOT EXISTS consent_to_contact boolean NOT NULL DEFAULT false` },
    { label: "alter_document_files_extracted_text_key", stmt: sql`ALTER TABLE document_files ADD COLUMN IF NOT EXISTS extracted_text_key text` },
    { label: "alter_admin_knowledge_files_extracted_text_key", stmt: sql`ALTER TABLE admin_knowledge_files ADD COLUMN IF NOT EXISTS extracted_text_key text` },
    { label: "alter_statute_document_files_extracted_text_key", stmt: sql`ALTER TABLE statute_document_files ADD COLUMN IF NOT EXISTS extracted_text_key text` },
    { label: "idx_admin_knowledge_files_doc_id", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_knowledge_files_doc_id ON admin_knowledge_files (admin_knowledge_id)` },
    { label: "idx_admin_knowledge_files_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_admin_knowledge_files_user_id ON admin_knowledge_files (user_id)` },
    { label: "idx_statute_document_files_doc_id", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_statute_document_files_doc_id ON statute_document_files (statute_document_id)` },
    { label: "idx_statute_document_files_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_statute_document_files_user_id ON statute_document_files (user_id)` },
    { label: "idx_style_memory_settings_scope", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_style_memory_settings_scope ON style_memory_settings (user_id, coalesce(org_id, 0), module)` },
    { label: "idx_style_memory_samples_hash", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_style_memory_samples_hash ON style_memory_samples (module, user_id, coalesce(org_id, 0), text_hash)` },
    { label: "idx_style_memory_samples_scope", stmt: sql`CREATE INDEX IF NOT EXISTS idx_style_memory_samples_scope ON style_memory_samples (module, user_id, org_id, status, source_type, created_at)` },
    { label: "idx_style_memory_chunks_scope", stmt: sql`CREATE INDEX IF NOT EXISTS idx_style_memory_chunks_scope ON style_memory_chunks (module, user_id, org_id, sample_id)` },
    { label: "idx_style_memory_chunks_tsv", stmt: sql`CREATE INDEX IF NOT EXISTS idx_style_memory_chunks_tsv ON style_memory_chunks USING gin (to_tsvector('simple', content))` },
    { label: "idx_style_memory_chunks_unique", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_style_memory_chunks_unique ON style_memory_chunks (sample_id, chunk_index)` },
    { label: "idx_style_memory_events_scope", stmt: sql`CREATE INDEX IF NOT EXISTS idx_style_memory_events_scope ON style_memory_events (module, user_id, org_id, created_at)` },
    { label: "alter_style_memory_chunks_embedding_vector", stmt: sql`ALTER TABLE style_memory_chunks ALTER COLUMN embedding TYPE vector(384) USING embedding::vector` },
    { label: "alter_style_memory_settings_last_backfill", stmt: sql`ALTER TABLE style_memory_settings ADD COLUMN IF NOT EXISTS last_backfill_at timestamp` },
    { label: "alter_style_memory_settings_updated_at", stmt: sql`ALTER TABLE style_memory_settings ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()` },
  ];

  for (const { label, stmt } of indexStatements) {
    try {
      await db.execute(stmt);
    } catch (err: any) {
      console.warn(`[Indexes] Could not ensure ${label}:`, err?.message || err);
    }
  }
  try {
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_style_memory_chunks_embedding_cosine ON style_memory_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`,
    );
  } catch (err: any) {
    console.warn("[Indexes] Could not ensure idx_style_memory_chunks_embedding_cosine:", err?.message || err);
  }
  try {
    const { ensureRagSchema } = await import("./rag/vector-store");
    await ensureRagSchema();
  } catch (err: any) {
    console.warn("[RAG] Could not ensure RAG schema:", err?.message || err);
  }
  await ensureCitationReferenceSeedData();
  console.log("Search indexes verification complete.");
}
