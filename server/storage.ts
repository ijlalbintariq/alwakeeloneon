import { db } from "./db";
import {
  threads, messages, documents, bookmarks, searchHistory, statutes, caseLaw, githubKnowledge, queryCache, usageTracking, adminKnowledge, statuteDocuments,
  type Thread, type InsertThread,
  type Message, type InsertMessage,
  type Document, type InsertDocument,
  type Bookmark, type InsertBookmark,
  type SearchHistory, type InsertSearchHistory,
  type Statute,
  type CaseLaw,
  type GithubKnowledge, type InsertGithubKnowledge,
  type QueryCache, type InsertQueryCache,
  type UsageTracking,
  type AdminKnowledge, type InsertAdminKnowledge,
  type StatuteDocument, type InsertStatuteDocument
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
  deleteDocument(id: number): Promise<void>;

  createBookmark(bookmark: InsertBookmark & { userId: string }): Promise<Bookmark>;
  getBookmarks(userId: string): Promise<Bookmark[]>;
  deleteBookmark(id: number): Promise<void>;

  addSearchHistory(entry: InsertSearchHistory & { userId: string }): Promise<SearchHistory>;
  getSearchHistory(userId: string): Promise<SearchHistory[]>;

  searchStatutes(query: string): Promise<Statute[]>;
  getAllStatutes(): Promise<Statute[]>;

  searchCaseLaw(query: string): Promise<CaseLaw[]>;
  getAllCaseLaw(): Promise<CaseLaw[]>;

  getGithubKnowledgeCount(): Promise<number>;
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
  updateUserProfile(userId: string, data: { firstName?: string; lastName?: string }): Promise<User | undefined>;

  addAdminKnowledge(entry: InsertAdminKnowledge): Promise<AdminKnowledge>;
  getAllAdminKnowledge(): Promise<AdminKnowledge[]>;
  deleteAdminKnowledge(id: number): Promise<void>;
  searchAdminKnowledge(query: string, limit?: number): Promise<AdminKnowledge[]>;

  addStatuteDocument(entry: InsertStatuteDocument): Promise<StatuteDocument>;
  getAllStatuteDocuments(): Promise<StatuteDocument[]>;
  getStatuteDocument(id: number): Promise<StatuteDocument | undefined>;
  deleteStatuteDocument(id: number): Promise<void>;
  searchStatuteDocuments(query: string, limit?: number): Promise<StatuteDocument[]>;
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

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
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

  async searchStatutes(query: string): Promise<Statute[]> {
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
      );
  }

  async getAllStatutes(): Promise<Statute[]> {
    return await db.select().from(statutes);
  }

  async searchCaseLaw(query: string): Promise<CaseLaw[]> {
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
      );
  }

  async getAllCaseLaw(): Promise<CaseLaw[]> {
    return await db.select().from(caseLaw);
  }

  async getGithubKnowledgeCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(githubKnowledge);
    return Number(result[0].count);
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
    await db.update(usageTracking)
      .set({
        inputTokens,
        outputTokens,
        estimatedCost: estimatedCost.toFixed(6),
      })
      .where(
        and(
          eq(usageTracking.userId, userId),
          eq(usageTracking.feature, feature as any),
          sql`${usageTracking.inputTokens} = 0`
        )
      );
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

    const totalCost = byFeature.reduce((sum, f) => sum + parseFloat(String(f.totalCost) || "0"), 0);
    const totalTokens = byFeature.reduce((sum, f) => sum + (Number(f.totalInputTokens) || 0) + (Number(f.totalOutputTokens) || 0), 0);

    return {
      byFeature: byFeature.map(f => ({
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
    const threadIds = userThreads.map(t => t.id);
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

  async updateUserProfile(userId: string, data: { firstName?: string; lastName?: string }): Promise<User | undefined> {
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
}

export const storage = new DatabaseStorage();
