import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { GoogleGenAI } from "@google/genai";
import { insertBookmarkSchema, insertSearchHistorySchema, statutes, caseLaw, threads, TIER_LIMITS } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { syncGithubKnowledge } from "./github-sync";
import crypto from "crypto";
import multer from "multer";
import { extractText } from "unpdf";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

const TOKEN_LIMITS = {
  chat: 4096,
  "search-judgments": 2048,
  "search-statutes": 2048,
  summarize: 3072,
  brief: 6144,
  draft: 4096,
  "contract-drafting": 4096,
};

const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  "gemini-3-flash-preview": { input: 0.00015, output: 0.0006 },
  "gemini-3-pro-preview": { input: 0.00125, output: 0.005 },
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateCost(model: string, inputText: string, outputText: string): number {
  const rates = COST_PER_1K_TOKENS[model] || COST_PER_1K_TOKENS["gemini-3-flash-preview"];
  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(outputText);
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}

const userLastRequest = new Map<string, number>();
const RATE_LIMIT_MS = 2000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const last = userLastRequest.get(userId);
  if (last && now - last < RATE_LIMIT_MS) {
    return false;
  }
  userLastRequest.set(userId, now);
  return true;
}

setInterval(() => {
  const cutoff = Date.now() - 60000;
  const keysToDelete: string[] = [];
  userLastRequest.forEach((val, key) => {
    if (val < cutoff) keysToDelete.push(key);
  });
  keysToDelete.forEach(key => userLastRequest.delete(key));
}, 60000);

function getLegalSystemPrompt(): string {
  const currentDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `You are Al Wakeelo — "Your Digital Lawyer, Always on Duty".
You are the digital manifestation of a high-stakes, street-smart Pakistani advocate, inspired by the tactical brilliance and silver-tongued wit of Saul Goodman.

CURRENT DATE: ${currentDate}

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

MANDATORY RESPONSE STRUCTURE:
Always structure your responses using these markdown sections (use ### headings). Include ALL relevant sections:

### Legal Context
Brief overview of the legal issue. Identify the area of law, applicable jurisdiction, and key legal questions involved.

### Statutory Framework and Legal Provisions
Cite specific sections of relevant Pakistani statutes with their full names in bold. Format each statute reference as:
**[Statute Name, Year]** — Section X: Brief description of what the section provides.
Examples: **[Pakistan Penal Code, 1860]**, **[Code of Civil Procedure, 1908]**, **[Income Tax Ordinance, 2001]**

### Leading Case Law and Judicial Precedents
Cite relevant Pakistani court judgments with proper citations. For each case:
- **Citation** (e.g., PLD 2024 Supreme Court 123, 2025 SCMR 456, 2024 YLR 789)
- **Court Name** and **Decision Date** (approximate if needed)
- **Legal Principle Established**: What the court held
- **Practitioner Application**: How this applies to the user's situation
Use ONLY official citations: PLD, SCMR, YLR, MLD, CLC, PCRLJ, PLJ.
DUAL CITATION: If reported in PLD and PLJ, cite BOTH.

### Practical Legal Strategy and Case Preparation
Provide actionable litigation strategy including:
- **Cause of Action**: What legal basis supports the claim
- **Evidence Requirements**: What documents/witnesses are needed
- **Procedural Pathway**: Step-by-step process (numbered list)
- **Limitation Period**: Applicable time limits for filing
- **Estimated Timeline**: Realistic timeframe expectations

For simple questions, you may omit sections that are not applicable, but always include at least Legal Context and one other section.

STRUCTURED REFERENCES (MANDATORY):
At the VERY END of every response, you MUST include a structured references block in the following exact format. This block will be parsed by the system to create clickable reference cards for the user.

\`\`\`references
{"laws":[{"name":"Full Statute Name, Year","section":"Section X","description":"One-sentence description of what this law/section provides"}],"judgments":[{"citation":"PLD 2024 Supreme Court 123","court":"Supreme Court of Pakistan","description":"One-sentence summary of the legal principle established"}]}
\`\`\`

Rules for the references block:
- Include ALL statutes and judgments you referenced in your response
- Each law must have name, section (can be empty string if general reference), and description
- Each judgment must have citation, court, and description
- Use proper JSON format inside the code block
- Include 1-5 most relevant laws and 1-5 most relevant judgments
- If no relevant laws or judgments, use empty arrays: {"laws":[],"judgments":[]}
- This block MUST be the last thing in every response, after all other content

CONSTRAINTS:
- NO EMOJIS.
- Authoritative, structured, and legally profound.
- Always mention the current date when citing recent judgments.
- Prioritize the most recent case law available.

RESPONSE LENGTH POLICY:
- Keep each section concise and to the point. High-density, actionable legal analysis.
- For simple questions: 2-3 sections, each brief.
- For complex analysis: all sections, each focused.
- Avoid repetition, filler, or restating the question. Every sentence must add value.
- Only elaborate when the user explicitly asks for more detail.`;
}

function getUserId(req: any): string | null {
  return req.session?.userId || null;
}

async function checkUsageLimit(userId: string, feature: string, res: any): Promise<boolean> {
  try {
    if (!checkRateLimit(userId)) {
      res.status(429).json({ message: "Too many requests. Please wait a moment before trying again." });
      return false;
    }

    const isAdmin = await storage.isUserAdmin(userId);
    if (isAdmin) {
      return true;
    }

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

    return true;
  } catch (err) {
    console.error("[Usage] Error checking usage:", err);
    return true;
  }
}

async function logUsageCost(userId: string, feature: string, model: string, inputText: string, outputText: string) {
  try {
    const inputTokens = estimateTokens(inputText);
    const outputTokens = estimateTokens(outputText);
    const cost = estimateCost(model, inputText, outputText);
    await storage.logUsageCost(userId, feature, inputTokens, outputTokens, cost);
  } catch (err) {
    console.error("[Cost] Error logging cost:", err);
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

const KNOWLEDGE_EXCERPT_LIMIT = 1500;
const KNOWLEDGE_SOURCES_PER_TIER = 2;
const KNOWLEDGE_STATUTES_LIMIT = 3;
const KNOWLEDGE_CASELAW_LIMIT = 3;

async function gatherKnowledgeContext(query: string): Promise<string> {
  const contextParts: string[] = [];

  const [statutesResult, caseLawResult, githubResult, adminResult] = await Promise.allSettled([
    storage.searchStatutes(query),
    storage.searchCaseLaw(query),
    storage.searchGithubKnowledge(query, KNOWLEDGE_SOURCES_PER_TIER),
    storage.searchAdminKnowledge(query, KNOWLEDGE_SOURCES_PER_TIER),
  ]);

  if (statutesResult.status === "fulfilled" && statutesResult.value.length > 0) {
    contextParts.push("=== INTERNAL KNOWLEDGE VAULT: STATUTES ===");
    for (const s of statutesResult.value.slice(0, KNOWLEDGE_STATUTES_LIMIT)) {
      contextParts.push(`- ${s.shortTitle} (Section ${s.section}): ${s.description}. Punishment: ${s.punishment}`);
    }
  }

  if (caseLawResult.status === "fulfilled" && caseLawResult.value.length > 0) {
    contextParts.push("=== INTERNAL KNOWLEDGE VAULT: CASE LAW ===");
    for (const c of caseLawResult.value.slice(0, KNOWLEDGE_CASELAW_LIMIT)) {
      contextParts.push(`- ${c.citation} (${c.court}): ${c.title} — ${c.summary}`);
    }
  }

  if (githubResult.status === "fulfilled" && githubResult.value.length > 0) {
    contextParts.push("=== CHAMBERS LEGAL LIBRARY (CURATED SOURCES) ===");
    for (const doc of githubResult.value) {
      const excerpt = doc.content.length > KNOWLEDGE_EXCERPT_LIMIT ? doc.content.substring(0, KNOWLEDGE_EXCERPT_LIMIT) + "..." : doc.content;
      contextParts.push(`--- ${doc.title} ---\n${excerpt}`);
    }
  }

  if (adminResult.status === "fulfilled" && adminResult.value.length > 0) {
    contextParts.push("=== CHAMBERS KNOWLEDGE VAULT (ADMIN UPLOADED) ===");
    for (const doc of adminResult.value) {
      const excerpt = doc.content.length > KNOWLEDGE_EXCERPT_LIMIT ? doc.content.substring(0, KNOWLEDGE_EXCERPT_LIMIT) + "..." : doc.content;
      contextParts.push(`--- ${doc.title} ---\n${excerpt}`);
    }
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
      const model = "gemini-3-flash-preview";
      const systemPromptFull = getLegalSystemPrompt() + knowledgeContext;

      const { content: aiResponse, fromCache } = await getCachedOrCall("chat", firstMessage, async () => {
        const completion = await ai.models.generateContent({
          model,
          contents: [
            { role: "user", parts: [{ text: firstMessage }] },
          ],
          config: {
            maxOutputTokens: TOKEN_LIMITS.chat,
            systemInstruction: systemPromptFull,
          },
        });
        return completion.text || "I apologize, I could not generate a response.";
      });

      if (!fromCache) {
        await logUsageCost(userId, "chat", model, systemPromptFull + firstMessage, aiResponse);
      }

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

  app.post("/api/threads/:id/share", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    const threadId = Number(req.params.id);
    const thread = await storage.getThread(threadId);
    if (!thread || thread.userId !== userId) {
      return res.status(404).json({ message: "Thread not found" });
    }
    if (thread.shareToken) {
      return res.json({ shareToken: thread.shareToken, shareUrl: `/share/${thread.shareToken}` });
    }
    const token = crypto.randomBytes(16).toString("hex");
    const updated = await storage.setThreadShareToken(threadId, token);
    if (!updated) {
      return res.status(500).json({ message: "Failed to generate share link" });
    }
    res.json({ shareToken: token, shareUrl: `/share/${token}` });
  });

  app.delete("/api/threads/:id/share", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    const threadId = Number(req.params.id);
    const thread = await storage.getThread(threadId);
    if (!thread || thread.userId !== userId) {
      return res.status(404).json({ message: "Thread not found" });
    }
    await db.update(threads).set({ shareToken: null }).where(eq(threads.id, threadId));
    res.sendStatus(204);
  });

  app.get("/api/shared/:token", async (req, res) => {
    const { token } = req.params;
    if (!token) return res.status(400).json({ message: "Invalid share token" });
    const thread = await storage.getThreadByShareToken(token);
    if (!thread) {
      return res.status(404).json({ message: "Shared conversation not found" });
    }
    const msgs = await storage.getMessages(thread.id);
    const user = await storage.getUserProfile(thread.userId);
    res.json({
      title: thread.title,
      createdAt: thread.createdAt,
      messages: msgs.map(m => ({ role: m.role, content: m.content, createdAt: m.createdAt })),
      sharedBy: user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "Al Wakeelo User",
    });
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
      const model = "gemini-3-flash-preview";
      const systemPromptFull = getLegalSystemPrompt() + knowledgeContext;

      const completion = await ai.models.generateContent({
        model,
        contents: geminiContents,
        config: {
          maxOutputTokens: TOKEN_LIMITS.chat,
          systemInstruction: systemPromptFull,
        },
      });

      const aiResponse = completion.text || "I apologize, I could not generate a response.";
      const inputText = systemPromptFull + history.map(m => m.content).join(" ");
      await logUsageCost(userId, "chat", model, inputText, aiResponse);

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
      if (input.content) {
        input.content = stripNullBytes(input.content);
      }
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

  app.get("/api/statute-documents/search", async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      if (!query) return res.json([]);
      const results = await storage.searchStatuteDocuments(query);
      res.json(results.map(r => ({ id: r.id, title: r.title, category: r.category, filename: r.filename })));
    } catch (err) {
      console.error("Error searching statute documents:", err);
      res.status(500).json({ message: "Failed to search statute documents" });
    }
  });

  app.get("/api/statute-documents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid document ID" });
      const doc = await storage.getStatuteDocument(id);
      if (!doc) return res.status(404).json({ message: "Document not found" });
      res.json(doc);
    } catch (err) {
      console.error("Error fetching statute document:", err);
      res.status(500).json({ message: "Failed to fetch statute document" });
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

      const { messages: userMessages, type, turbo, stream: useStream } = req.body as { messages: Array<{ role: string; content: string }>; type: string; turbo?: boolean; stream?: boolean };

      const userTier = await storage.getUserTier(userId);
      const canUseTurbo = turbo && (userTier === "pro" || userTier === "enterprise");

      let systemPrompt = getLegalSystemPrompt();
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
      let usedModel = canUseTurbo ? "gemini-3-pro-preview" : "gemini-3-flash-preview";
      const featureKey = (type === "draft" || type === "contract-drafting") ? type : "chat";
      const tokenLimit = TOKEN_LIMITS[featureKey as keyof typeof TOKEN_LIMITS] || TOKEN_LIMITS.chat;
      const systemPromptFull = systemPrompt + knowledgeContext;

      const cacheRaw = lastUserMessage ? lastUserMessage.content : JSON.stringify(userMessages);
      const cacheKey = `${cacheRaw}::type=${featureKey}::turbo=${!!canUseTurbo}`;
      const normalized = normalizeQuery(cacheKey);
      const hash = hashQuery("ai-chat", normalized);

      try {
        const cached = await storage.getCachedResponse("ai-chat", hash);
        if (cached && isCacheFresh(cached.createdAt)) {
          await storage.incrementCacheHit(cached.id).catch(() => {});
          return res.json({ content: cached.response, model: usedModel, fromCache: true });
        }
      } catch {}

      if (useStream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        let fullContent = "";
        try {
          const streamResponse = await ai.models.generateContentStream({
            model: usedModel,
            contents: geminiContents,
            config: {
              maxOutputTokens: tokenLimit,
              systemInstruction: systemPromptFull,
            },
          });

          for await (const chunk of streamResponse) {
            const text = chunk.text || "";
            if (text) {
              fullContent += text;
              res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
          }
        } catch (turboErr: any) {
          if (canUseTurbo && (turboErr?.status === 429 || turboErr?.message?.includes("quota") || turboErr?.message?.includes("rate"))) {
            console.log("[AI Chat] Pro model quota exceeded, falling back to flash model (stream)");
            usedModel = "gemini-3-flash-preview";
            fullContent = "";
            const fallbackStream = await ai.models.generateContentStream({
              model: usedModel,
              contents: geminiContents,
              config: {
                maxOutputTokens: tokenLimit,
                systemInstruction: systemPromptFull,
              },
            });
            for await (const chunk of fallbackStream) {
              const text = chunk.text || "";
              if (text) {
                fullContent += text;
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
              }
            }
          } else {
            res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
            res.end();
            return;
          }
        }

        res.write(`data: ${JSON.stringify({ done: true, model: usedModel })}\n\n`);
        res.end();

        if (fullContent) {
          const inputText = systemPromptFull + userMessages.map(m => m.content).join(" ");
          await logUsageCost(userId, featureKey, usedModel, inputText, fullContent);
          try {
            await storage.setCachedResponse({
              endpoint: "ai-chat",
              queryHash: hash,
              queryText: cacheKey.slice(0, 500),
              response: fullContent,
            });
          } catch {}
        }
        return;
      }

      const completion = await (async () => {
        try {
          const result = await ai.models.generateContent({
            model: usedModel,
            contents: geminiContents,
            config: {
              maxOutputTokens: tokenLimit,
              systemInstruction: systemPromptFull,
            },
          });
          return result.text || "I apologize, I could not generate a response.";
        } catch (turboErr: any) {
          if (canUseTurbo && (turboErr?.status === 429 || turboErr?.message?.includes("quota") || turboErr?.message?.includes("rate"))) {
            console.log("[AI Chat] Pro model quota exceeded, falling back to flash model");
            usedModel = "gemini-3-flash-preview";
            const fallback = await ai.models.generateContent({
              model: usedModel,
              contents: geminiContents,
              config: {
                maxOutputTokens: tokenLimit,
                systemInstruction: systemPromptFull,
              },
            });
            return fallback.text || "I apologize, I could not generate a response.";
          }
          throw turboErr;
        }
      })();

      const inputText = systemPromptFull + userMessages.map(m => m.content).join(" ");
      await logUsageCost(userId, featureKey, usedModel, inputText, completion);
      try {
        await storage.setCachedResponse({
          endpoint: "ai-chat",
          queryHash: hash,
          queryText: cacheKey.slice(0, 500),
          response: completion,
        });
      } catch {}

      res.json({ content: completion, model: usedModel });
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

      const model = "gemini-3-flash-preview";
      const { content: responseText, fromCache } = await getCachedOrCall("searchJudgments", query, async () => {
        const knowledgeContext = await gatherKnowledgeContext(query);
        const sysInstruction = `You are a Pakistani legal research assistant. Given a query, provide relevant Pakistani court judgments. Return a JSON object with a "judgments" key containing an array of judgment objects. Each object must have: citation (string), court (string), title (string), summary (string), keywords (array of strings), uri (string, can be empty). Only include real, verifiable Pakistani case citations (PLD, SCMR, YLR, MLD, CLC, PCRLJ). If unsure, provide fewer but accurate results.${knowledgeContext}`;
        const completion = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: query }] }],
          config: {
            maxOutputTokens: TOKEN_LIMITS["search-judgments"],
            responseMimeType: "application/json",
            systemInstruction: sysInstruction,
          },
        });
        const result = completion.text || '{"judgments":[]}';
        await logUsageCost(userId, "search-judgments", model, sysInstruction + query, result);
        return result;
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

  app.post(api.ai.judgmentSummary.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const allowed = await checkUsageLimit(userId, "summarize", res);
      if (!allowed) return;

      const { citation, title, court, summary: briefSummary } = req.body as {
        citation: string;
        title: string;
        court?: string;
        summary?: string;
      };

      if (!citation && !title) {
        return res.status(400).json({ message: "Citation or title is required" });
      }

      const searchTerm = citation || title;
      const knowledgeContext = await gatherKnowledgeContext(searchTerm);

      let fullText = "";
      try {
        const normalize = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();
        const citationNorm = citation ? normalize(citation) : "";
        const stopWords = new Set(["the", "and", "for", "with", "from", "this", "that", "case", "state", "versus", "pakistan", "government", "court", "high", "supreme", "lahore", "karachi", "islamabad", "peshawar", "quetta"]);
        const titleWords = title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3 && !stopWords.has(w));

        const validateMatch = (_content: string, docTitle: string): boolean => {
          const docTitleNorm = normalize(docTitle);
          if (citationNorm.length >= 6 && docTitleNorm.includes(citationNorm)) {
            return true;
          }
          const citationParts = citation ? citation.match(/\b(PLD|SCMR|YLR|MLD|CLC|PCRLJ|PLJ)\s*\d{4}/i) : null;
          if (citationParts) {
            const reportPattern = normalize(citationParts[0]);
            if (docTitleNorm.includes(reportPattern)) {
              return true;
            }
          }
          if (titleWords.length >= 3) {
            const docTitleLower = docTitle.toLowerCase();
            const matchCount = titleWords.filter((w: string) => docTitleLower.includes(w)).length;
            return matchCount >= Math.ceil(titleWords.length * 0.8);
          }
          return false;
        };

        const ghResults = await storage.searchGithubKnowledge(searchTerm);
        for (const doc of ghResults) {
          if (validateMatch(doc.content, doc.title)) {
            fullText = doc.content;
            break;
          }
        }
        if (!fullText) {
          const adminResults = await storage.searchAdminKnowledge(searchTerm);
          for (const doc of adminResults) {
            if (validateMatch(doc.content, doc.title)) {
              fullText = doc.content;
              break;
            }
          }
        }
      } catch {}

      const hasSourceText = !!fullText;
      const model = "gemini-3-flash-preview";
      const uniqueKey = `${citation}::${title}::${court || ""}`;
      const cacheKey = `judgment-summary-v3::${uniqueKey}`;
      const { content: aiSummary, fromCache } = await getCachedOrCall("judgment-summary", cacheKey, async () => {
        const contextInfo = briefSummary ? `\nBrief Summary: ${briefSummary}` : "";
        const courtInfo = court ? `\nCourt: ${court}` : "";

        let sysInstruction: string;
        let userInput: string;

        if (hasSourceText) {
          sysInstruction = `You are Al Wakeelo, a Pakistani legal research assistant. Today's date is ${new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })}.

You have been provided with the ACTUAL FULL TEXT of a Pakistani court judgment from our verified Knowledge Vault. Your task is to analyze THIS SPECIFIC JUDGMENT based EXCLUSIVELY on the text provided below.

CRITICAL RULES:
- Base your entire analysis ONLY on the judgment text provided below
- Do NOT invent, assume, or fabricate ANY details not present in the text
- Do NOT confuse this case with any other case
- If something is not mentioned in the provided text, say "Not mentioned in the judgment text"

Provide a detailed analysis using this structure:

### Case Overview
- Citation, court, bench composition, date (ONLY from the text)

### Facts of the Case
- Facts as stated in the judgment text

### Legal Issues
- Issues as framed by the court in the text

### Arguments Presented
- Arguments as recorded in the judgment

### Court's Analysis & Reasoning
- The court's actual reasoning from the text, statutory provisions applied, precedents cited BY the court

### Judgment & Order
- The actual order/decision as stated in the text

### Key Legal Principles
- Ratio decidendi as established in this judgment

### Practical Implications
- What practitioners should note from this specific ruling

NO EMOJIS. Be precise. Only state what the judgment text actually says.`;

          userInput = `Analyze this judgment based EXCLUSIVELY on the full text provided:\n\nCitation: ${citation}${courtInfo}\nTitle: ${title}${contextInfo}\n\n===== FULL JUDGMENT TEXT (VERIFIED SOURCE) =====\n${fullText!.substring(0, 10000)}\n===== END OF JUDGMENT TEXT =====`;
        } else {
          sysInstruction = `You are Al Wakeelo, a Pakistani legal research assistant. Today's date is ${new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })}.

IMPORTANT: You do NOT have the actual text of this judgment. You only have the citation and title. You must be COMPLETELY HONEST about this limitation.

YOUR TASK: Provide a legal context analysis around the TOPIC of this judgment. Do NOT fabricate or invent specific case facts, parties, arguments, or court reasoning that you do not actually know.

WHAT YOU MUST DO:
1. Start with a clear disclaimer that this is a general legal analysis based on the topic/citation, NOT an analysis of the actual judgment text
2. Explain the relevant area of Pakistani law that this judgment relates to
3. Discuss the applicable statutory provisions
4. Mention well-known landmark judgments in this area of law (only ones you are confident about)
5. Explain general legal principles that courts typically apply in such matters

WHAT YOU MUST NOT DO:
- Do NOT invent specific facts of this case
- Do NOT fabricate party names, dates, or arguments
- Do NOT make up what the court held or ordered
- Do NOT pretend you have read this judgment
- Do NOT mix in details from unrelated cases or different areas of law (e.g., do NOT reference family law cases when analyzing criminal law matters, do NOT reference murder cases when analyzing civil matters)
- STAY STRICTLY within the relevant area of law indicated by the citation and title

Use this structure:

### Disclaimer
- State clearly: "Full judgment text is not available in our Knowledge Vault. The following is a general legal analysis of the topic area this judgment relates to, based on established Pakistani law."

### Relevant Area of Law
- Identify the specific area of Pakistani law (criminal, civil, constitutional, family, etc.)
- Explain the legal framework applicable to this specific topic ONLY

### Applicable Statutory Provisions
- List the specific statutes and sections relevant to THIS topic only
- Brief explanation of each provision

### Established Legal Principles
- General principles Pakistani courts have established in THIS specific area of law
- Only cite landmark cases you are genuinely confident about and that are directly relevant to this topic

### General Legal Position
- What is the settled legal position on this topic in Pakistani law
- Any notable developments or trends

NO EMOJIS. Be honest about what you know and don't know. NEVER cross-reference unrelated areas of law.`;

          userInput = `Provide a general legal analysis around the TOPIC of this judgment. Remember: you do NOT have the actual judgment text, so do NOT fabricate case-specific details. Stay strictly within the relevant area of law.\n\nCitation: ${citation}${courtInfo}\nTitle: ${title}${contextInfo}`;
        }

        const completion = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: userInput }] }],
          config: {
            maxOutputTokens: 6144,
            systemInstruction: sysInstruction,
          },
        });
        const result = completion.text || "Unable to generate judgment summary.";
        await logUsageCost(userId, "judgment-summary", model, sysInstruction + userInput, result);
        return result;
      });

      res.json({
        summary: aiSummary,
        fullText: fullText || null,
        source: hasSourceText ? "knowledge_vault" : null,
        verified: hasSourceText,
      });
    } catch (err) {
      console.error("Error generating judgment summary:", err);
      res.status(500).json({ message: "Failed to generate judgment summary" });
    }
  });

  app.post(api.ai.searchStatutes.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const allowed = await checkUsageLimit(userId, "search-statutes", res);
      if (!allowed) return;

      const { query } = req.body as { query: string };

      const model = "gemini-3-flash-preview";
      const { content: responseText, fromCache } = await getCachedOrCall("searchStatutes", query, async () => {
        const knowledgeContext = await gatherKnowledgeContext(query);
        const sysInstruction = `You are a Pakistani legal research assistant. Given a query, provide relevant Pakistani statutes and legal provisions. Return a JSON object with a "statutes" key containing an array of statute objects. Each object must have: shortTitle (string), section (string), description (string), punishment (string), uri (string, can be empty), keywords (array of strings). Focus on Pakistani laws including PPC, CrPC, Constitution, Family Laws, Contract Act, etc.${knowledgeContext}`;
        const completion = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: query }] }],
          config: {
            maxOutputTokens: TOKEN_LIMITS["search-statutes"],
            responseMimeType: "application/json",
            systemInstruction: sysInstruction,
          },
        });
        const result = completion.text || '{"statutes":[]}';
        await logUsageCost(userId, "search-statutes", model, sysInstruction + query, result);
        return result;
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

      const model = "gemini-3-flash-preview";
      const { content: summary, fromCache } = await getCachedOrCall("summarize", cacheKey, async () => {
        const knowledgeContext = await gatherKnowledgeContext(query);
        const sysInstruction = `${getLegalSystemPrompt()}\n\nYou are summarizing legal findings for the user. Provide a concise, authoritative summary of the findings in relation to their query. Be precise and cite relevant provisions.${knowledgeContext}`;
        const userInput = `Query: ${query}\n\nFindings:\n${JSON.stringify(findings, null, 2)}\n\nPlease provide a comprehensive summary of these findings.`;
        const completion = await ai.models.generateContent({
          model,
          contents: [
            { role: "user", parts: [{ text: userInput }] },
          ],
          config: {
            maxOutputTokens: TOKEN_LIMITS.summarize,
            systemInstruction: sysInstruction,
          },
        });
        const result = completion.text || "Unable to generate summary.";
        await logUsageCost(userId, "summarize", model, sysInstruction + userInput, result);
        return result;
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

      let briefModel = "gemini-3-pro-preview";
      const { content: brief, fromCache } = await getCachedOrCall("brief", cacheKey, async () => {
        const knowledgeContext = await gatherKnowledgeContext(`${shortTitle} ${section} ${description}`);
        const sysInstruction = `${getLegalSystemPrompt()}\n\nYou are generating a detailed legal brief about a specific statute or legal provision. Provide comprehensive analysis including: scope, application, relevant case law citations, practical implications, and strategic considerations. Use the "Extensive yet Brief" style.${knowledgeContext}`;
        const userInput = `Generate a detailed legal brief for:\nTitle: ${shortTitle}\nSection: ${section}\nDescription: ${description}`;
        try {
          const completion = await ai.models.generateContent({
            model: briefModel,
            contents: [
              { role: "user", parts: [{ text: userInput }] },
            ],
            config: {
              maxOutputTokens: TOKEN_LIMITS.brief,
              systemInstruction: sysInstruction,
            },
          });
          const result = completion.text || "Unable to generate brief.";
          await logUsageCost(userId, "brief", briefModel, sysInstruction + userInput, result);
          return result;
        } catch (proErr: any) {
          if (proErr?.status === 429 || proErr?.message?.includes("quota") || proErr?.message?.includes("rate")) {
            console.log("[Brief] Pro model quota exceeded, falling back to flash model");
            briefModel = "gemini-3-flash-preview";
            const fallback = await ai.models.generateContent({
              model: briefModel,
              contents: [
                { role: "user", parts: [{ text: userInput }] },
              ],
              config: {
                maxOutputTokens: TOKEN_LIMITS.brief,
                systemInstruction: sysInstruction,
              },
            });
            const result = fallback.text || "Unable to generate brief.";
            await logUsageCost(userId, "brief", briefModel, sysInstruction + userInput, result);
            return result;
          }
          throw proErr;
        }
      });

      res.json({ brief });
    } catch (err) {
      console.error("Error generating brief:", err);
      res.status(500).json({ message: "Failed to generate brief" });
    }
  });

  // ====== ADMIN ROUTES ======
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

  function stripNullBytes(text: string): string {
    return text.replace(/\x00/g, "");
  }

  async function isAdmin(req: any, res: any): Promise<boolean> {
    const userId = getUserId(req);
    if (!userId) { res.sendStatus(401); return false; }
    const admin = await storage.isUserAdmin(userId);
    if (!admin) { res.status(403).json({ message: "Admin access required" }); return false; }
    return true;
  }

  app.get("/api/admin/check", async (_req, res) => {
    try {
      const hasAdmin = await storage.hasAnyAdmin();
      res.json({ hasAdmin });
    } catch (err) {
      console.error("Error checking admin status:", err);
      res.status(500).json({ message: "Failed to check admin status" });
    }
  });

  app.post("/api/admin/setup", async (req, res) => {
    try {
      const hasAdmin = await storage.hasAnyAdmin();
      if (hasAdmin) {
        return res.status(403).json({ message: "An admin already exists. Use the admin panel to manage admins." });
      }
      const userId = getUserId(req);
      if (!userId) return res.sendStatus(401);
      const updated = await storage.updateUserAdminStatus(userId, true);
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json({ message: "You are now the admin", user: updated });
    } catch (err) {
      console.error("Error in admin setup:", err);
      res.status(500).json({ message: "Failed to set up admin" });
    }
  });

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
      const currentUserId = getUserId(req);
      const targetId = req.params.id;
      const { subscriptionTier, isAdmin: adminFlag } = req.body;

      const validTiers = ["free", "pro", "enterprise"];
      if (subscriptionTier !== undefined && !validTiers.includes(subscriptionTier)) {
        return res.status(400).json({ message: "Invalid subscription tier" });
      }
      if (adminFlag !== undefined && typeof adminFlag !== "boolean") {
        return res.status(400).json({ message: "isAdmin must be a boolean" });
      }
      if (adminFlag === false && targetId === currentUserId) {
        return res.status(400).json({ message: "You cannot remove your own admin access" });
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

  app.post("/api/admin/users", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const { email, password, firstName, lastName, subscriptionTier, isAdmin: makeAdmin } = req.body;
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ message: "Email, password, first name, and last name are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const existing = await authStorage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "A user with this email already exists" });
      }
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await authStorage.upsertUser({
        email,
        firstName,
        lastName,
        passwordHash,
        authProvider: "email",
      });
      if (subscriptionTier && ["free", "pro", "enterprise"].includes(subscriptionTier)) {
        await storage.updateUserTier(user.id, subscriptionTier);
      }
      if (makeAdmin === true) {
        await storage.updateUserAdminStatus(user.id, true);
      }
      res.status(201).json({ message: "User created successfully", user });
    } catch (err) {
      console.error("Error creating user:", err);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const currentUserId = getUserId(req);
      const targetId = req.params.id;
      if (targetId === currentUserId) {
        return res.status(400).json({ message: "You cannot delete your own account" });
      }
      await storage.deleteUser(targetId);
      res.json({ message: "User deleted successfully" });
    } catch (err) {
      console.error("Error deleting user:", err);
      res.status(500).json({ message: "Failed to delete user" });
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

  app.get("/api/admin/cost-analytics", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const analytics = await storage.getCostAnalytics();
      res.json(analytics);
    } catch (err) {
      console.error("Error fetching cost analytics:", err);
      res.status(500).json({ message: "Failed to fetch cost analytics" });
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

  app.post("/api/admin/knowledge", upload.array("files", 500), async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const userId = getUserId(req)!;
      const files = req.files as Express.Multer.File[] | undefined;
      const { title, category } = req.body;

      if ((!files || files.length === 0) && !req.body.content) {
        return res.status(400).json({ message: "File(s) or content is required" });
      }

      const allowedExts = [".txt", ".json", ".csv", ".pdf"];
      const results: any[] = [];
      const errors: string[] = [];

      if (files && files.length > 0) {
        for (const file of files) {
          const ext = file.originalname.substring(file.originalname.lastIndexOf(".")).toLowerCase();
          if (!allowedExts.includes(ext)) {
            errors.push(`${file.originalname}: unsupported format (use .txt, .json, .csv, or .pdf)`);
            continue;
          }

          let content = "";
          if (ext === ".pdf") {
            try {
              const uint8 = new Uint8Array(file.buffer.buffer, file.buffer.byteOffset, file.buffer.byteLength);
              const pdfResult = await extractText(uint8, { mergePages: true });
              content = stripNullBytes((pdfResult.text || "").trim());
              console.log(`[Knowledge Upload] Extracted ${content.length} chars from ${file.originalname}`);
            } catch (pdfErr: any) {
              console.error(`[Knowledge Upload] PDF parse error for ${file.originalname}:`, pdfErr?.message || pdfErr);
              content = "";
            }
            if (!content) {
              errors.push(`${file.originalname}: could not extract text (may be scanned/image PDF)`);
              continue;
            }
          } else {
            content = stripNullBytes(file.buffer.toString("utf-8"));
          }

          const docTitle = title && files.length === 1
            ? title
            : file.originalname.replace(/\.[^/.]+$/, "");

          const doc = await storage.addAdminKnowledge({
            title: docTitle,
            filename: file.originalname,
            content,
            category: category || "general",
            uploadedBy: userId,
          });
          results.push(doc);
        }
      } else {
        const content = req.body.content;
        const filename = title ? `${title.toLowerCase().replace(/\s+/g, "-")}.txt` : "manual-entry.txt";
        const doc = await storage.addAdminKnowledge({
          title: title || "Manual Entry",
          filename,
          content,
          category: category || "general",
          uploadedBy: userId,
        });
        results.push(doc);
      }

      res.status(201).json({
        uploaded: results.length,
        errors: errors.length > 0 ? errors : undefined,
        documents: results,
      });
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

  // ====== ADMIN CASE LAW MANAGEMENT ======
  app.get("/api/admin/case-law", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const all = await storage.getAllCaseLaw();
      res.json(all);
    } catch (err) {
      console.error("Error fetching case law:", err);
      res.status(500).json({ message: "Failed to fetch case law" });
    }
  });

  app.post("/api/admin/case-law", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const { citation, court, title, summary, keywords } = req.body;
      if (!citation || !court || !title || !summary) {
        return res.status(400).json({ message: "Citation, court, title, and summary are required" });
      }
      const keywordsArr = Array.isArray(keywords) ? keywords : (typeof keywords === "string" ? keywords.split(",").map((k: string) => k.trim()).filter(Boolean) : []);
      const created = await storage.createCaseLaw({ citation, court, title, summary, keywords: keywordsArr });
      res.status(201).json(created);
    } catch (err) {
      console.error("Error creating case law:", err);
      res.status(500).json({ message: "Failed to create case law" });
    }
  });

  app.put("/api/admin/case-law/:id", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const id = Number(req.params.id);
      const { citation, court, title, summary, keywords } = req.body;
      const updateData: any = {};
      if (citation !== undefined) updateData.citation = citation;
      if (court !== undefined) updateData.court = court;
      if (title !== undefined) updateData.title = title;
      if (summary !== undefined) updateData.summary = summary;
      if (keywords !== undefined) {
        updateData.keywords = Array.isArray(keywords) ? keywords : keywords.split(",").map((k: string) => k.trim()).filter(Boolean);
      }
      const updated = await storage.updateCaseLaw(id, updateData);
      if (!updated) return res.status(404).json({ message: "Case law not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error updating case law:", err);
      res.status(500).json({ message: "Failed to update case law" });
    }
  });

  app.delete("/api/admin/case-law/:id", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const id = Number(req.params.id);
      await storage.deleteCaseLaw(id);
      res.sendStatus(204);
    } catch (err) {
      console.error("Error deleting case law:", err);
      res.status(500).json({ message: "Failed to delete case law" });
    }
  });

  app.post("/api/admin/case-law/bulk", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const { entries } = req.body as { entries: Array<{ citation: string; court: string; title: string; summary: string; keywords: string | string[] }> };
      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ message: "Entries array is required" });
      }
      const errors: string[] = [];
      const valid: Array<{ citation: string; court: string; title: string; summary: string; keywords: string[] }> = [];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (!e.citation || !e.court || !e.title || !e.summary) {
          errors.push(`Row ${i + 1}: Missing required fields (citation, court, title, summary)`);
          continue;
        }
        const kw = Array.isArray(e.keywords) ? e.keywords : (typeof e.keywords === "string" ? e.keywords.split(",").map((k: string) => k.trim()).filter(Boolean) : []);
        valid.push({ citation: e.citation.trim(), court: e.court.trim(), title: e.title.trim(), summary: e.summary.trim(), keywords: kw });
      }
      const created = valid.length > 0 ? await storage.bulkCreateCaseLaw(valid) : [];
      res.status(201).json({ inserted: created.length, errors, entries: created });
    } catch (err) {
      console.error("Error bulk creating case law:", err);
      res.status(500).json({ message: "Failed to bulk create case law" });
    }
  });

  app.post("/api/admin/case-law/extract", upload.single("file"), async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const ext = file.originalname.split(".").pop()?.toLowerCase();
      let content = "";

      if (ext === "pdf") {
        try {
          const uint8 = new Uint8Array(file.buffer.buffer, file.buffer.byteOffset, file.buffer.byteLength);
          const pdfResult = await extractText(uint8, { mergePages: true });
          content = stripNullBytes((pdfResult.text || "").trim());
        } catch (pdfErr: any) {
          console.error("[Case Law Extract] PDF parse error:", pdfErr?.message);
          return res.status(400).json({ message: "Failed to parse PDF file. Try uploading as TXT instead." });
        }
      } else if (ext === "txt" || ext === "text") {
        content = stripNullBytes(file.buffer.toString("utf-8").trim());
      } else {
        return res.status(400).json({ message: "Supported formats: PDF, TXT" });
      }

      if (!content || content.length < 50) {
        return res.status(400).json({ message: "Document appears empty or too short to extract case law from." });
      }

      const maxChars = 120000;
      const truncated = content.length > maxChars;
      const textForAI = truncated ? content.substring(0, maxChars) : content;

      const extractionPrompt = `You are a Pakistani legal research expert. Analyze the following legal document text and extract ALL individual court cases/judgments found in it.

For EACH case you find, extract:
1. citation - The official case citation (e.g., "PLD 2024 Supreme Court 123", "2023 SCMR 456", "2024 YLR 789"). Use official law report abbreviations: PLD, SCMR, YLR, MLD, CLC, PCRLJ, PLJ.
2. court - The court name (e.g., "Supreme Court of Pakistan", "Lahore High Court", "Sindh High Court")
3. title - The case title/name (e.g., "State vs Muhammad Ahmed", "Sughran Bibi vs Government of Punjab")
4. summary - A concise 1-3 sentence summary of the legal principle established or the key holding
5. keywords - An array of 3-8 relevant legal keywords

CRITICAL RULES:
- Extract EVERY distinct case/judgment you can identify in the text
- If you cannot determine a field with certainty, use your best professional judgment based on context
- For citations, use the exact format found in the text
- Do NOT invent or fabricate cases — only extract what is actually present in the document
- If the document contains commentary or analysis alongside cases, focus on extracting the actual cases referenced

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{"cases":[{"citation":"...","court":"...","title":"...","summary":"...","keywords":["..."]}]}

If no cases can be identified, respond with: {"cases":[]}`;

      const completion = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: textForAI }] }],
        config: {
          maxOutputTokens: 8192,
          systemInstruction: extractionPrompt,
          temperature: 0.1,
        },
      });

      const responseText = (completion.text || "").trim();
      let jsonText = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      let parsed: { cases: Array<{ citation: string; court: string; title: string; summary: string; keywords: string[] }> };
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        console.error("[Case Law Extract] Failed to parse AI response:", responseText.substring(0, 500));
        return res.status(500).json({ message: "AI could not extract structured case law from this document. Try a clearer or shorter document." });
      }

      if (!parsed.cases || !Array.isArray(parsed.cases)) {
        return res.status(500).json({ message: "AI response was not in the expected format. Please try again." });
      }

      const validCases = parsed.cases.filter(c => c.citation && c.title);

      res.json({
        extracted: validCases.length,
        truncated,
        originalLength: content.length,
        cases: validCases,
      });
    } catch (err) {
      console.error("Error extracting case law:", err);
      res.status(500).json({ message: "Failed to extract case law from document" });
    }
  });

  // ====== ADMIN STATUTE DOCUMENTS ======
  app.get("/api/admin/statute-documents", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const docs = await storage.getAllStatuteDocuments();
      res.json(docs);
    } catch (err) {
      console.error("Error fetching statute documents:", err);
      res.status(500).json({ message: "Failed to fetch statute documents" });
    }
  });

  app.post("/api/admin/statute-documents", upload.array("files", 500), async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const userId = getUserId(req)!;
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const results = [];
      for (const file of files) {
        let content = "";
        const ext = file.originalname.split(".").pop()?.toLowerCase();

        if (ext === "pdf") {
          try {
            const uint8 = new Uint8Array(file.buffer.buffer, file.buffer.byteOffset, file.buffer.byteLength);
            const pdfResult = await extractText(uint8, { mergePages: true });
            content = stripNullBytes((pdfResult.text || "").trim());
            console.log(`[Statute Upload] Extracted ${content.length} chars from ${file.originalname}`);
          } catch (pdfErr: any) {
            console.error(`[Statute Upload] PDF parse error for ${file.originalname}:`, pdfErr?.message || pdfErr);
            content = "";
          }
          if (!content) {
            content = `[Could not extract text from "${file.originalname}". The file may be a scanned image PDF or an unsupported format. Please upload a text-based PDF or a .txt file instead.]`;
          }
        } else if (ext === "doc" || ext === "docx") {
          content = `[.${ext} files are not supported. Please convert "${file.originalname}" to PDF or .txt format and re-upload.]`;
        } else {
          content = stripNullBytes(file.buffer.toString("utf-8"));
        }

        if (!content.trim()) continue;

        const title = file.originalname
          .replace(/\.[^.]+$/, "")
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (c: string) => c.toUpperCase())
          .trim();

        const category = (req.body.category as string) || "general";

        const doc = await storage.addStatuteDocument({
          title,
          filename: file.originalname,
          content,
          category,
          uploadedBy: userId,
        });
        results.push(doc);
      }

      res.json({ message: `${results.length} statute document(s) uploaded successfully`, count: results.length });
    } catch (err) {
      console.error("Error uploading statute documents:", err);
      res.status(500).json({ message: "Failed to upload statute documents" });
    }
  });

  app.delete("/api/admin/statute-documents/:id", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const id = Number(req.params.id);
      await storage.deleteStatuteDocument(id);
      res.sendStatus(204);
    } catch (err) {
      console.error("Error deleting statute document:", err);
      res.status(500).json({ message: "Failed to delete statute document" });
    }
  });

  // ====== STATUTE TABLE OF CONTENTS (AI) ======
  app.post("/api/statute-documents/:id/toc", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const allowed = await checkUsageLimit(userId, "chat", res);
      if (!allowed) return;

      const id = Number(req.params.id);
      const doc = await storage.getStatuteDocument(id);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const contentExcerpt = doc.content.slice(0, 50000);
      const tocPrompt = `Analyze this legal document and extract its hierarchical table of contents as a JSON array. Each item has: "title" (short name like "PART I - INTRODUCTORY" or "Chapter 1 - Fundamental Rights"), and optionally "children" (sub-sections). Only include major structural divisions: Parts, Chapters, Schedules, Articles groupings. Use SHORT titles (max 60 chars each). Do NOT include individual article numbers. Return ONLY a valid JSON array - no markdown, no code blocks, no explanation.\n\nDocument Title: ${doc.title}\n\nDocument Content:\n${contentExcerpt}`;

      const model = "gemini-3-flash-preview";
      const { content, fromCache } = await getCachedOrCall("toc-extract", `toc-${id}`, async () => {
        const completion = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: tocPrompt }] }],
          config: {
            maxOutputTokens: 8192,
            systemInstruction: "You are a document structure analyzer. Extract the table of contents from legal documents. Return ONLY a valid JSON array. No markdown code blocks, no explanation text. Keep titles concise (max 60 chars). Ensure the JSON is complete and properly closed.",
          },
        });
        return completion.text || "[]";
      });

      if (!fromCache) {
        await logUsageCost(userId, "chat", model, tocPrompt, content);
      }

      let toc: any[] = [];
      try {
        let cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        try {
          toc = JSON.parse(cleaned);
        } catch {
          const openBrackets = (cleaned.match(/\[/g) || []).length;
          const closeBrackets = (cleaned.match(/\]/g) || []).length;
          const openBraces = (cleaned.match(/\{/g) || []).length;
          const closeBraces = (cleaned.match(/\}/g) || []).length;
          let fixed = cleaned.replace(/,\s*([}\]])/g, "$1");
          const lastValid = Math.max(fixed.lastIndexOf("}"), fixed.lastIndexOf("]"));
          if (lastValid > 0) fixed = fixed.slice(0, lastValid + 1);
          for (let i = 0; i < openBraces - closeBraces; i++) fixed += "}";
          for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += "]";
          try {
            toc = JSON.parse(fixed);
            console.log(`[TOC] Recovered truncated JSON (${toc.length} items)`);
          } catch {
            console.error("[TOC] Could not parse AI response, raw:", content.slice(0, 200));
            toc = [];
          }
        }
      } catch {
        toc = [];
      }

      res.json({ toc });
    } catch (err) {
      console.error("Error extracting TOC:", err);
      res.status(500).json({ message: "Failed to extract table of contents" });
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
