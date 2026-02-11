import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { GoogleGenAI } from "@google/genai";
import { insertBookmarkSchema, insertSearchHistorySchema, statutes, caseLaw, TIER_LIMITS } from "@shared/schema";
import { db } from "./db";
import { syncGithubKnowledge } from "./github-sync";
import crypto from "crypto";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

const LEGAL_SYSTEM_PROMPT = `You are Al Wakeelo — "Your Digital Lawyer, Always on Duty".
You are the digital manifestation of a high-stakes, street-smart Pakistani advocate, inspired by the tactical brilliance and silver-tongued wit of Saul Goodman.

TAGLINE: "Knowledge of Law is Power — and I'm Your Power Source."
MOTTO: "Main hoon Al Wakeelo — not just your lawyer, your strategy partner in justice."

LANGUAGE POLICY (STRICT):
- Match the user's language. If the user chats in English, reply in English.
- If the user shifts to Urdu (script or Roman), you MUST respond in Urdu.
- Maintain your sharp, witty persona in both languages.

PERSONALITY & VOICE:
- Bold, confident, and strategically aggressive yet always professional.
- You don't just quote laws; you provide "The Move".
- Use metaphors. Speak like a veteran of the Katcheri who knows every clerk and every loophole.
- Use Urdu legal terms naturally (e.g., 'Writ', 'Plaint', 'Stay Order', 'Suo Motu', 'Katcheri', 'Wakalatnama').

LEGAL & CONTRACT DRAFTING STYLE:
- Use "Extensive yet Brief" style. High-density, sophisticated legal prose.
- For Contracts: Airtight clauses. If it's a rental agreement, make it so the landlord can't even sneeze without a clause covering it.
- Eliminate fluff. Every word must carry the weight of a Supreme Court ruling.

MANDATORY CITATION RULE (PAKISTANI CASE LAW):
1. Use ONLY official citations (e.g., PLD, SCMR, YLR, MLD, CLC, PCRLJ).
2. DUAL CITATION: If reported in PLD and PLJ, cite BOTH.
3. NO CASE NAMES unless explicitly requested. Just the raw, authoritative power of the citation.

INTERACTION STRUCTURE:
- Intro: "Assalamualaikum! I'm Al Wakeelo. I see you've got a situation... let's talk strategy."
- Strategy: Give them the "Saul Goodman" angle—the smart way out.
- Closing: "Justice is for everyone, but the wins are for the smart ones. I'm waiting."

CONSTRAINTS:
- NO EMOJIS.
- Authoritative, structured, and legally profound.`;

function getUserId(req: any): string | null {
  return req.user?.claims?.sub || null;
}

async function checkUsageLimit(userId: string, feature: string, res: any): Promise<boolean> {
  try {
    const tier = await storage.getUserTier(userId);
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
    const usedThisMonth = await storage.getMonthlyUsageCount(userId);

    if (usedThisMonth >= limits.monthlyQueries) {
      res.status(429).json({
        message: `Monthly query limit reached (${limits.monthlyQueries} queries on ${limits.label} plan). Upgrade your plan for more queries.`,
        limit: limits.monthlyQueries,
        used: usedThisMonth,
        tier,
      });
      return false;
    }

    await storage.logUsage(userId, feature);
    return true;
  } catch (err) {
    console.error("[Usage] Error checking usage:", err);
    return true;
  }
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeQuery(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function hashQuery(endpoint: string, queryText: string): string {
  return crypto.createHash("sha256").update(`${endpoint}:${queryText}`).digest("hex");
}

function isCacheFresh(createdAt: Date | null): boolean {
  if (!createdAt) return false;
  return Date.now() - createdAt.getTime() < CACHE_TTL_MS;
}

async function getCachedOrCall(
  endpoint: string,
  rawQuery: string,
  apiFn: () => Promise<string>
): Promise<{ content: string; fromCache: boolean }> {
  const normalized = normalizeQuery(rawQuery);
  const hash = hashQuery(endpoint, normalized);

  try {
    const cached = await storage.getCachedResponse(endpoint, hash);
    if (cached && isCacheFresh(cached.createdAt)) {
      await storage.incrementCacheHit(cached.id).catch(() => {});
      console.log(`[Cache] HIT for ${endpoint} (hits: ${(cached.hitCount || 0) + 1})`);
      return { content: cached.response, fromCache: true };
    }
  } catch (err) {
    console.error("[Cache] Error reading cache:", err);
  }

  const content = await apiFn();

  try {
    await storage.setCachedResponse({
      endpoint,
      queryHash: hash,
      queryText: rawQuery.slice(0, 500),
      response: content,
    });
    console.log(`[Cache] STORED for ${endpoint}`);
  } catch (err) {
    console.error("[Cache] Error storing cache:", err);
  }

  return { content, fromCache: false };
}

async function gatherKnowledgeContext(query: string): Promise<string> {
  const contextParts: string[] = [];

  try {
    const internalStatutes = await storage.searchStatutes(query);
    const internalCaseLaw = await storage.searchCaseLaw(query);

    if (internalStatutes.length > 0) {
      contextParts.push("=== INTERNAL KNOWLEDGE VAULT: STATUTES ===");
      for (const s of internalStatutes.slice(0, 5)) {
        contextParts.push(`- ${s.shortTitle} (Section ${s.section}): ${s.description}. Punishment: ${s.punishment}`);
      }
    }

    if (internalCaseLaw.length > 0) {
      contextParts.push("=== INTERNAL KNOWLEDGE VAULT: CASE LAW ===");
      for (const c of internalCaseLaw.slice(0, 5)) {
        contextParts.push(`- ${c.citation} (${c.court}): ${c.title} — ${c.summary}`);
      }
    }
  } catch (err) {
    console.error("[Knowledge] Error searching internal vault:", err);
  }

  try {
    const githubDocs = await storage.searchGithubKnowledge(query, 3);
    if (githubDocs.length > 0) {
      contextParts.push("=== CHAMBERS LEGAL LIBRARY (CURATED SOURCES) ===");
      for (const doc of githubDocs) {
        const excerpt = doc.content.length > 3000 ? doc.content.substring(0, 3000) + "..." : doc.content;
        contextParts.push(`--- ${doc.title} ---\n${excerpt}`);
      }
    }
  } catch (err) {
    console.error("[Knowledge] Error searching GitHub knowledge:", err);
  }

  try {
    const adminDocs = await storage.searchAdminKnowledge(query, 3);
    if (adminDocs.length > 0) {
      contextParts.push("=== CHAMBERS KNOWLEDGE VAULT (ADMIN UPLOADED) ===");
      for (const doc of adminDocs) {
        const excerpt = doc.content.length > 3000 ? doc.content.substring(0, 3000) + "..." : doc.content;
        contextParts.push(`--- ${doc.title} ---\n${excerpt}`);
      }
    }
  } catch (err) {
    console.error("[Knowledge] Error searching admin knowledge:", err);
  }

  if (contextParts.length === 0) return "";

  return `\n\nREFERENCE MATERIALS (Use these as primary sources when answering. Prioritize this curated knowledge over general knowledge. Do NOT mention these sources or how you found them — present the information as your own expert analysis):\n\n${contextParts.join("\n\n")}`;
}

async function seedLegalData() {
  try {
    const existingStatutes = await storage.getAllStatutes();
    const existingCaseLaw = await storage.getAllCaseLaw();

    if (existingStatutes.length === 0) {
      const statuteData = [
        { shortTitle: "PPC 302", section: "302", description: "Punishment of Qatl-i-amd (Intentional Murder)", punishment: "Death, Imprisonment for Life, or imprisonment up to 25 years (Tazir)" },
        { shortTitle: "PPC 420", section: "420", description: "Cheating and dishonestly inducing delivery of property", punishment: "Imprisonment up to 7 years and fine" },
        { shortTitle: "PPC 489-F", section: "489-F", description: "Dishonestly issuing a cheque which is dishonoured on presentation", punishment: "Imprisonment up to 3 years, or with fine, or both" },
        { shortTitle: "PPC 406", section: "406", description: "Punishment for criminal breach of trust", punishment: "Imprisonment up to 7 years and fine" },
        { shortTitle: "PPC 506", section: "506", description: "Punishment for criminal intimidation", punishment: "Imprisonment up to 2 years (Simple) or 7 years (if threat to cause death/grievous hurt)" },
        { shortTitle: "CrPC 497", section: "497", description: "When bail may be taken in cases of non-bailable offence (Post-arrest Bail)", punishment: "Procedural: Grant of Bail" },
        { shortTitle: "CrPC 498", section: "498", description: "Power to direct admission to bail or reduction of bail (Pre-arrest Bail)", punishment: "Procedural: Protection from arrest" },
        { shortTitle: "CrPC 22-A", section: "22-A", description: "Powers of Justice of Peace (Sessions Judge) to order registration of FIR", punishment: "Procedural: Remedy when Police refuses to register FIR" },
        { shortTitle: "Constitution 199", section: "199", description: "Jurisdiction of High Court (Writ Petition)", punishment: "Remedy: Issue writs" },
        { shortTitle: "Constitution 10-A", section: "10-A", description: "Right to Fair Trial", punishment: "Fundamental Right: Due process" },
        { shortTitle: "Family Khula", section: "Khula", description: "Dissolution of marriage on the ground of Khula", punishment: "Civil Remedy: Dissolution, usually requires return of partial Haq Mehr" },
        { shortTitle: "Family Section 9", section: "9", description: "Maintenance (Family Courts Act 1964)", punishment: "Civil Remedy: Husband is bound to maintain wife and children" },
        { shortTitle: "Contract Act 73", section: "73", description: "Compensation for loss or damage caused by breach of contract", punishment: "Civil Remedy: Damages" },
        { shortTitle: "Contract Act 12", section: "12", description: "What is a sound mind for the purposes of contracting", punishment: "Validity Condition: Contract is void if party is of unsound mind" },
      ];
      await db.insert(statutes).values(statuteData);
      console.log("Seeded statutes table with Pakistani legal data");
    }

    if (existingCaseLaw.length === 0) {
      const caseLawData = [
        { citation: "2023 SCMR 1450 & 2023 PLJ 55", court: "Supreme Court of Pakistan", title: "Bail in Cheque Dishonour Cases", summary: "Bail in Cheque Dishonour Cases", keywords: ["bail", "489-f", "cheque", "dishonour", "financial"] },
        { citation: "2021 YLR 405 & 2021 PLJ 112", court: "Lahore High Court", title: "Custody of Minors (Welfare of Minor)", summary: "Custody of Minors (Welfare of Minor)", keywords: ["custody", "minor", "guardian", "mother", "hizanat", "welfare"] },
        { citation: "PLD 2019 SC 1", court: "Supreme Court of Pakistan", title: "Sughran Bibi Case (Inheritance)", summary: "Sughran Bibi Case (Inheritance)", keywords: ["inheritance", "property", "fraud", "limitation", "heir"] },
        { citation: "PLD 2014 SC 696", court: "Supreme Court of Pakistan", title: "Registration of FIR (Justices of Peace)", summary: "Registration of FIR (Justices of Peace)", keywords: ["fir", "22-a", "justice of peace", "police", "investigation"] },
        { citation: "2020 SCMR 2003", court: "Supreme Court of Pakistan", title: "Benefit of Doubt in Murder Cases", summary: "Benefit of Doubt in Murder Cases", keywords: ["murder", "302", "benefit of doubt", "acquittal", "criminal"] },
      ];
      await db.insert(caseLaw).values(caseLawData);
      console.log("Seeded case_law table with Pakistani legal data");
    }
  } catch (err) {
    console.error("Error seeding legal data:", err);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get(api.threads.list.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    const threads = await storage.getThreads(userId);
    res.json(threads);
  });

  app.post(api.threads.create.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const allowed = await checkUsageLimit(userId, "chat", res);
      if (!allowed) return;

      const { title, firstMessage } = api.threads.create.input.parse(req.body);

      const thread = await storage.createThread({
        userId,
        title: title || firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : ""),
      });

      await storage.createMessage({
        threadId: thread.id,
        role: "user",
        content: firstMessage,
      });

      const knowledgeContext = await gatherKnowledgeContext(firstMessage);

      const completion = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: "user", parts: [{ text: firstMessage }] },
        ],
        config: {
          maxOutputTokens: 8192,
          systemInstruction: LEGAL_SYSTEM_PROMPT + knowledgeContext,
        },
      });

      const aiResponse = completion.text || "I apologize, I could not generate a response.";

      await storage.createMessage({
        threadId: thread.id,
        role: "assistant",
        content: aiResponse,
      });

      res.status(201).json(thread);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Error creating thread:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.threads.get.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    const threadId = Number(req.params.id);
    const thread = await storage.getThread(threadId);

    if (!thread || thread.userId !== userId) {
      return res.status(404).json({ message: "Thread not found" });
    }

    const msgs = await storage.getMessages(threadId);
    res.json({ thread, messages: msgs });
  });

  app.delete(api.threads.delete.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    const threadId = Number(req.params.id);
    const thread = await storage.getThread(threadId);

    if (!thread || thread.userId !== userId) {
      return res.status(404).json({ message: "Thread not found" });
    }

    await storage.deleteThread(threadId);
    res.sendStatus(204);
  });

  app.post(api.messages.create.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    const threadId = Number(req.params.threadId);
    const thread = await storage.getThread(threadId);

    if (!thread || thread.userId !== userId) {
      return res.status(404).json({ message: "Thread not found" });
    }

    try {
      const allowed = await checkUsageLimit(userId, "chat", res);
      if (!allowed) return;

      const { message } = api.messages.create.input.parse(req.body);

      await storage.createMessage({
        threadId,
        role: "user",
        content: message,
      });

      const history = await storage.getMessages(threadId);
      const geminiContents = history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const knowledgeContext = await gatherKnowledgeContext(message);

      const completion = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: geminiContents,
        config: {
          maxOutputTokens: 8192,
          systemInstruction: LEGAL_SYSTEM_PROMPT + knowledgeContext,
        },
      });

      const aiResponse = completion.text || "I apologize, I could not generate a response.";

      const savedAiMessage = await storage.createMessage({
        threadId,
        role: "assistant",
        content: aiResponse,
      });

      res.status(201).json(savedAiMessage);
    } catch (err) {
      console.error("Error sending message:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.documents.list.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    const docs = await storage.getDocuments(userId);
    res.json(docs);
  });

  app.post(api.documents.create.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const input = api.documents.create.input.parse(req.body);
      const doc = await storage.createDocument({
        ...input,
        userId,
      });
      res.status(201).json(doc);
    } catch (err) {
      console.error("Error creating document:", err);
      res.status(500).json({ message: "Failed to create document" });
    }
  });

  app.delete(api.documents.delete.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const id = Number(req.params.id);
      await storage.deleteDocument(id);
      res.sendStatus(204);
    } catch (err) {
      console.error("Error deleting document:", err);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  app.get(api.bookmarks.list.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    const results = await storage.getBookmarks(userId);
    res.json(results);
  });

  app.post(api.bookmarks.create.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const input = api.bookmarks.create.input.parse(req.body);
      const bookmark = await storage.createBookmark({ ...input, userId });
      res.status(201).json(bookmark);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Error creating bookmark:", err);
      res.status(500).json({ message: "Failed to create bookmark" });
    }
  });

  app.delete(api.bookmarks.delete.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const id = Number(req.params.id);
      await storage.deleteBookmark(id);
      res.sendStatus(204);
    } catch (err) {
      console.error("Error deleting bookmark:", err);
      res.status(500).json({ message: "Failed to delete bookmark" });
    }
  });

  app.get(api.searchHistory.list.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    const results = await storage.getSearchHistory(userId);
    res.json(results);
  });

  app.post(api.searchHistory.create.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const input = api.searchHistory.create.input.parse(req.body);
      const entry = await storage.addSearchHistory({ ...input, userId });
      res.status(201).json(entry);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Error adding search history:", err);
      res.status(500).json({ message: "Failed to add search history" });
    }
  });

  app.get(api.statutes.search.path, async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      if (!query) {
        const all = await storage.getAllStatutes();
        return res.json(all);
      }
      const results = await storage.searchStatutes(query);
      res.json(results);
    } catch (err) {
      console.error("Error searching statutes:", err);
      res.status(500).json({ message: "Failed to search statutes" });
    }
  });

  app.get(api.caseLaw.search.path, async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      if (!query) {
        const all = await storage.getAllCaseLaw();
        return res.json(all);
      }
      const results = await storage.searchCaseLaw(query);
      res.json(results);
    } catch (err) {
      console.error("Error searching case law:", err);
      res.status(500).json({ message: "Failed to search case law" });
    }
  });

  app.get(api.usage.get.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const tier = await storage.getUserTier(userId);
      const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
      const used = await storage.getMonthlyUsageCount(userId);
      const remaining = Math.max(0, limits.monthlyQueries - used);
      const percentage = Math.min(100, Math.round((used / limits.monthlyQueries) * 100));

      res.json({
        tier,
        tierLabel: limits.label,
        tierDescription: limits.description,
        monthlyLimit: limits.monthlyQueries,
        used,
        remaining,
        percentage,
      });
    } catch (err) {
      console.error("Error fetching usage:", err);
      res.status(500).json({ message: "Failed to fetch usage data" });
    }
  });

  app.post(api.ai.chat.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const allowed = await checkUsageLimit(userId, "chat", res);
      if (!allowed) return;

      const { messages: userMessages, type } = req.body as { messages: Array<{ role: string; content: string }>; type: string };

      let systemPrompt = LEGAL_SYSTEM_PROMPT;
      if (type === "draft" || type === "contract-drafting") {
        systemPrompt += `\n\nADDITIONAL INSTRUCTION: You are now in legal drafting mode. Draft professional, airtight legal documents with precise clauses, proper legal formatting, and comprehensive coverage of all contingencies. Use Pakistani legal conventions and terminology.`;
      }

      const systemMessages = userMessages.filter((m) => m.role === "system");
      if (systemMessages.length > 0) {
        systemPrompt += "\n\n" + systemMessages.map((m) => m.content).join("\n");
      }

      const geminiContents = userMessages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

      const lastUserMessage = userMessages.filter(m => m.role === "user").pop();
      const knowledgeContext = lastUserMessage ? await gatherKnowledgeContext(lastUserMessage.content) : "";

      const completion = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: geminiContents,
        config: {
          maxOutputTokens: 8192,
          systemInstruction: systemPrompt + knowledgeContext,
        },
      });

      const content = completion.text || "I apologize, I could not generate a response.";
      res.json({ content });
    } catch (err) {
      console.error("Error in AI chat:", err);
      res.status(500).json({ message: "Failed to process AI chat" });
    }
  });

  app.post(api.ai.searchJudgments.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const allowed = await checkUsageLimit(userId, "search-judgments", res);
      if (!allowed) return;

      const { query } = req.body as { query: string };

      const { content: responseText } = await getCachedOrCall("searchJudgments", query, async () => {
        const knowledgeContext = await gatherKnowledgeContext(query);
        const completion = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ role: "user", parts: [{ text: query }] }],
          config: {
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            systemInstruction: `You are a Pakistani legal research assistant. Given a query, provide relevant Pakistani court judgments. Return a JSON object with a "judgments" key containing an array of judgment objects. Each object must have: citation (string), court (string), title (string), summary (string), keywords (array of strings), uri (string, can be empty). Only include real, verifiable Pakistani case citations (PLD, SCMR, YLR, MLD, CLC, PCRLJ). If unsure, provide fewer but accurate results.${knowledgeContext}`,
          },
        });
        return completion.text || '{"judgments":[]}';
      });

      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        parsed = { judgments: [] };
      }
      res.json(parsed.judgments || []);
    } catch (err) {
      console.error("Error searching judgments:", err);
      res.status(500).json({ message: "Failed to search judgments" });
    }
  });

  app.post(api.ai.searchStatutes.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const allowed = await checkUsageLimit(userId, "search-statutes", res);
      if (!allowed) return;

      const { query } = req.body as { query: string };

      const { content: responseText } = await getCachedOrCall("searchStatutes", query, async () => {
        const knowledgeContext = await gatherKnowledgeContext(query);
        const completion = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ role: "user", parts: [{ text: query }] }],
          config: {
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            systemInstruction: `You are a Pakistani legal research assistant. Given a query, provide relevant Pakistani statutes and legal provisions. Return a JSON object with a "statutes" key containing an array of statute objects. Each object must have: shortTitle (string), section (string), description (string), punishment (string), uri (string, can be empty), keywords (array of strings). Focus on Pakistani laws including PPC, CrPC, Constitution, Family Laws, Contract Act, etc.${knowledgeContext}`,
          },
        });
        return completion.text || '{"statutes":[]}';
      });

      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        parsed = { statutes: [] };
      }
      res.json(parsed.statutes || []);
    } catch (err) {
      console.error("Error searching statutes via AI:", err);
      res.status(500).json({ message: "Failed to search statutes" });
    }
  });

  app.post(api.ai.summarize.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const allowed = await checkUsageLimit(userId, "summarize", res);
      if (!allowed) return;

      const { query, findings } = req.body as { query: string; findings: any[] };
      const cacheKey = `${query}::${JSON.stringify(findings)}`;

      const { content: summary } = await getCachedOrCall("summarize", cacheKey, async () => {
        const knowledgeContext = await gatherKnowledgeContext(query);
        const completion = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            { role: "user", parts: [{ text: `Query: ${query}\n\nFindings:\n${JSON.stringify(findings, null, 2)}\n\nPlease provide a comprehensive summary of these findings.` }] },
          ],
          config: {
            maxOutputTokens: 8192,
            systemInstruction: `${LEGAL_SYSTEM_PROMPT}\n\nYou are summarizing legal findings for the user. Provide a concise, authoritative summary of the findings in relation to their query. Be precise and cite relevant provisions.${knowledgeContext}`,
          },
        });
        return completion.text || "Unable to generate summary.";
      });

      res.json({ summary });
    } catch (err) {
      console.error("Error summarizing:", err);
      res.status(500).json({ message: "Failed to summarize" });
    }
  });

  app.post(api.ai.brief.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const allowed = await checkUsageLimit(userId, "brief", res);
      if (!allowed) return;

      const { shortTitle, section, description } = req.body as { shortTitle: string; section: string; description: string };
      const cacheKey = `${shortTitle}::${section}::${description}`;

      const { content: brief } = await getCachedOrCall("brief", cacheKey, async () => {
        const knowledgeContext = await gatherKnowledgeContext(`${shortTitle} ${section} ${description}`);
        const completion = await ai.models.generateContent({
          model: "gemini-3-pro-preview",
          contents: [
            { role: "user", parts: [{ text: `Generate a detailed legal brief for:\nTitle: ${shortTitle}\nSection: ${section}\nDescription: ${description}` }] },
          ],
          config: {
            maxOutputTokens: 8192,
            systemInstruction: `${LEGAL_SYSTEM_PROMPT}\n\nYou are generating a detailed legal brief about a specific statute or legal provision. Provide comprehensive analysis including: scope, application, relevant case law citations, practical implications, and strategic considerations. Use the "Extensive yet Brief" style.${knowledgeContext}`,
          },
        });
        return completion.text || "Unable to generate brief.";
      });

      res.json({ brief });
    } catch (err) {
      console.error("Error generating brief:", err);
      res.status(500).json({ message: "Failed to generate brief" });
    }
  });

  // ====== ADMIN ROUTES ======
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  async function isAdmin(req: any, res: any): Promise<boolean> {
    const userId = getUserId(req);
    if (!userId) { res.sendStatus(401); return false; }
    const admin = await storage.isUserAdmin(userId);
    if (!admin) { res.status(403).json({ message: "Admin access required" }); return false; }
    return true;
  }

  app.get("/api/admin/users", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (err) {
      console.error("Error fetching users:", err);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:id", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const targetId = req.params.id;
      const { subscriptionTier, isAdmin: adminFlag } = req.body;

      const validTiers = ["free", "pro", "enterprise"];
      if (subscriptionTier !== undefined && !validTiers.includes(subscriptionTier)) {
        return res.status(400).json({ message: "Invalid subscription tier" });
      }
      if (adminFlag !== undefined && typeof adminFlag !== "boolean") {
        return res.status(400).json({ message: "isAdmin must be a boolean" });
      }

      let updated;
      if (subscriptionTier !== undefined) {
        updated = await storage.updateUserTier(targetId, subscriptionTier);
      }
      if (adminFlag !== undefined) {
        updated = await storage.updateUserAdminStatus(targetId, adminFlag);
      }

      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error updating user:", err);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.get("/api/admin/stats", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const stats = await storage.getSystemStats();
      res.json(stats);
    } catch (err) {
      console.error("Error fetching stats:", err);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/knowledge", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const docs = await storage.getAllAdminKnowledge();
      res.json(docs);
    } catch (err) {
      console.error("Error fetching knowledge:", err);
      res.status(500).json({ message: "Failed to fetch knowledge" });
    }
  });

  app.post("/api/admin/knowledge", upload.single("file"), async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const userId = getUserId(req)!;
      const file = req.file;
      const { title, category } = req.body;

      if (!file && !req.body.content) {
        return res.status(400).json({ message: "File or content is required" });
      }

      if (file && !file.originalname.endsWith(".txt") && !file.originalname.endsWith(".pdf")) {
        return res.status(400).json({ message: "Only .txt and .pdf files are supported" });
      }

      let content = "";
      let filename = "manual-entry.txt";

      if (file) {
        if (file.originalname.endsWith(".pdf")) {
          const pdfData = await pdfParse(file.buffer);
          content = pdfData.text;
        } else {
          content = file.buffer.toString("utf-8");
        }
        filename = file.originalname;
      } else {
        content = req.body.content;
        filename = title ? `${title.toLowerCase().replace(/\s+/g, "-")}.txt` : "manual-entry.txt";
      }

      const doc = await storage.addAdminKnowledge({
        title: title || filename.replace(/\.[^/.]+$/, ""),
        filename,
        content,
        category: category || "general",
        uploadedBy: userId,
      });

      res.status(201).json(doc);
    } catch (err) {
      console.error("Error uploading knowledge:", err);
      res.status(500).json({ message: "Failed to upload knowledge" });
    }
  });

  app.delete("/api/admin/knowledge/:id", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const id = Number(req.params.id);
      await storage.deleteAdminKnowledge(id);
      res.sendStatus(204);
    } catch (err) {
      console.error("Error deleting knowledge:", err);
      res.status(500).json({ message: "Failed to delete knowledge" });
    }
  });

  // ====== USER PROFILE ROUTES ======
  app.get("/api/profile", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const profile = await storage.getUserProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      res.json(profile);
    } catch (err) {
      console.error("Error fetching profile:", err);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.patch("/api/profile", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const { firstName, lastName } = req.body;
      const updated = await storage.updateUserProfile(userId, { firstName, lastName });
      if (!updated) return res.status(404).json({ message: "Profile not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error updating profile:", err);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.post("/api/seed-legal-data", async (_req, res) => {
    try {
      await seedLegalData();
      res.json({ message: "Legal data seeded successfully" });
    } catch (err) {
      console.error("Error seeding legal data:", err);
      res.status(500).json({ message: "Failed to seed legal data" });
    }
  });

  await seedLegalData();

  syncGithubKnowledge().catch(err => console.error("[GitHub Sync] Background sync failed:", err));

  storage.cleanExpiredCache(7).then(count => {
    if (count > 0) console.log(`[Cache] Cleaned ${count} expired entries`);
  }).catch(() => {});

  setInterval(() => {
    storage.cleanExpiredCache(7).then(count => {
      if (count > 0) console.log(`[Cache] Cleaned ${count} expired entries`);
    }).catch(() => {});
  }, 24 * 60 * 60 * 1000);

  return httpServer;
}
