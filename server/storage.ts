import { db } from "./db";
import {
  threads, messages, documents, bookmarks, searchHistory, statutes, caseLaw, githubKnowledge, queryCache, usageTracking, adminKnowledge, statuteDocuments, savedJudgments,
  organizations, orgMembers, orgInvites, orgKnowledge,
  type Thread, type InsertThread,
  type Message, type InsertMessage,
  type Document, type InsertDocument,
  type Bookmark, type InsertBookmark,
  type SearchHistory, type InsertSearchHistory,
  type Statute,
  type CaseLaw, type InsertCaseLaw,
  type GithubKnowledge, type InsertGithubKnowledge,
  type QueryCache, type InsertQueryCache,
  type UsageTracking,
  type AdminKnowledge, type InsertAdminKnowledge,
  type StatuteDocument, type InsertStatuteDocument,
  type SavedJudgment, type InsertSavedJudgment,
  type Organization, type InsertOrganization,
  type OrgMember, type InsertOrgMember,
  type OrgInvite, type InsertOrgInvite,
  type OrgKnowledge, type InsertOrgKnowledge
} from "@shared/schema";
import { users, type User } from "@shared/models/auth";
import { eq, desc, or, ilike, sql, and, lt, gte, count } from "drizzle-orm";

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
  updateDocument(
    id: number,
    userId: string,
    data: Partial<Pick<InsertDocument, "title" | "content">>
  ): Promise<Document | undefined>;
  getAllDocuments(): Promise<Document[]>;
  deleteDocument(id: number, userId: string): Promise<void>;

  createBookmark(bookmark: InsertBookmark & { userId: string }): Promise<Bookmark>;
  getBookmarks(userId: string): Promise<Bookmark[]>;
  deleteBookmark(id: number): Promise<void>;

  addSearchHistory(entry: InsertSearchHistory & { userId: string }): Promise<SearchHistory>;
  getSearchHistory(userId: string): Promise<SearchHistory[]>;

  searchStatutes(query: string, limit?: number): Promise<Statute[]>;
  getAllStatutes(): Promise<Statute[]>;

  searchCaseLaw(query: string, limit?: number): Promise<CaseLaw[]>;
  getAllCaseLaw(): Promise<CaseLaw[]>;
  getCaseLawById(id: number): Promise<CaseLaw | undefined>;
  getCaseLawByCitation(citation: string): Promise<CaseLaw | undefined>;
  getCaseLawCitations(): Promise<string[]>;
  createCaseLaw(entry: InsertCaseLaw): Promise<CaseLaw>;
  updateCaseLaw(id: number, entry: Partial<InsertCaseLaw>): Promise<CaseLaw | undefined>;
  deleteCaseLaw(id: number): Promise<void>;
  deleteAllCaseLaw(): Promise<number>;
  bulkCreateCaseLaw(entries: InsertCaseLaw[]): Promise<CaseLaw[]>;

  getGithubKnowledgeCount(): Promise<number>;
  getAllGithubKnowledge(): Promise<GithubKnowledge[]>;
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
  getAllAdminKnowledge(): Promise<AdminKnowledge[]>;
  deleteAdminKnowledge(id: number): Promise<void>;
  deleteAllAdminKnowledge(): Promise<number>;
  searchAdminKnowledge(query: string, limit?: number): Promise<AdminKnowledge[]>;

  getSavedJudgments(userId: string): Promise<SavedJudgment[]>;
  saveJudgment(entry: InsertSavedJudgment): Promise<SavedJudgment>;
  deleteSavedJudgment(id: number, userId: string): Promise<void>;

  addStatuteDocument(entry: InsertStatuteDocument): Promise<StatuteDocument>;
  getAllStatuteDocuments(): Promise<StatuteDocument[]>;
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

  async deleteDocument(id: number, userId: string): Promise<void> {
    await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
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

  async deleteBookmark(id: number): Promise<void> {
    await db.delete(bookmarks).where(eq(bookmarks.id, id));
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

  async getGithubKnowledgeCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(githubKnowledge);
    return Number(result[0].count);
  }

  async getAllGithubKnowledge(): Promise<GithubKnowledge[]> {
    return await db.select().from(githubKnowledge);
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

    const [userCount] = await db.select({ total: count() }).from(users);
    const [threadCount] = await db.select({ total: count() }).from(threads);
    const [messageCount] = await db.select({ total: count() }).from(messages);
    const [documentCount] = await db.select({ total: count() }).from(documents);
    const githubCount = await this.getGithubKnowledgeCount();
    const [adminKnowledgeCount] = await db.select({ total: count() }).from(adminKnowledge);
    const [cacheCount] = await db.select({ total: count() }).from(queryCache);
    const [usageCount] = await db.select({ total: count() })
      .from(usageTracking)
      .where(gte(usageTracking.createdAt, startOfMonth));

    return {
      totalUsers: userCount?.total || 0,
      totalThreads: threadCount?.total || 0,
      totalMessages: messageCount?.total || 0,
      totalDocuments: documentCount?.total || 0,
      totalKnowledge: githubCount + (adminKnowledgeCount?.total || 0),
      totalCacheEntries: cacheCount?.total || 0,
      totalUsageThisMonth: usageCount?.total || 0,
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

  async getAllAdminKnowledge(): Promise<AdminKnowledge[]> {
    return await db.select().from(adminKnowledge).orderBy(desc(adminKnowledge.createdAt));
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
      .where(ilike(statuteDocuments.title, `%${trimmed}%`))
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

export async function ensureSearchIndexes(): Promise<void> {
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_case_law_citation_trgm ON case_law USING gin (citation gin_trgm_ops)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_case_law_title_trgm ON case_law USING gin (title gin_trgm_ops)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_case_law_court_trgm ON case_law USING gin (court gin_trgm_ops)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_github_knowledge_title_trgm ON github_knowledge USING gin (title gin_trgm_ops)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_statutes_short_title_trgm ON statutes USING gin (short_title gin_trgm_ops)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_statutes_description_trgm ON statutes USING gin (description gin_trgm_ops)`);
    console.log("Search indexes verified/created.");
  } catch (err: any) {
    console.warn("Could not create search indexes:", err?.message || err);
  }
}
