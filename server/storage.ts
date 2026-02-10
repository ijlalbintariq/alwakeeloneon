import { db } from "./db";
import {
  threads, messages, documents, bookmarks, searchHistory, statutes, caseLaw, githubKnowledge,
  type Thread, type InsertThread,
  type Message, type InsertMessage,
  type Document, type InsertDocument,
  type Bookmark, type InsertBookmark,
  type SearchHistory, type InsertSearchHistory,
  type Statute,
  type CaseLaw,
  type GithubKnowledge, type InsertGithubKnowledge
} from "@shared/schema";
import { eq, desc, or, ilike, sql } from "drizzle-orm";

export interface IStorage {
  createThread(thread: InsertThread & { userId: string }): Promise<Thread>;
  getThreads(userId: string): Promise<Thread[]>;
  getThread(id: number): Promise<Thread | undefined>;
  deleteThread(id: number): Promise<void>;

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
}

export const storage = new DatabaseStorage();
