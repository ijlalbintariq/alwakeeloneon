import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { GoogleGenAI } from "@google/genai";
import { insertBookmarkSchema, insertSearchHistorySchema, statutes, caseLaw } from "@shared/schema";
import { db } from "./db";

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

      const completion = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: firstMessage }] },
        ],
        config: {
          maxOutputTokens: 8192,
          systemInstruction: LEGAL_SYSTEM_PROMPT,
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

      const completion = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: geminiContents,
        config: {
          maxOutputTokens: 8192,
          systemInstruction: LEGAL_SYSTEM_PROMPT,
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

  app.post(api.ai.chat.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
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

      const completion = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: geminiContents,
        config: {
          maxOutputTokens: 8192,
          systemInstruction: systemPrompt,
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
      const { query } = req.body as { query: string };

      const completion = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: query }] }],
        config: {
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          systemInstruction: `You are a Pakistani legal research assistant. Given a query, provide relevant Pakistani court judgments. Return a JSON object with a "judgments" key containing an array of judgment objects. Each object must have: citation (string), court (string), title (string), summary (string), keywords (array of strings), uri (string, can be empty). Only include real, verifiable Pakistani case citations (PLD, SCMR, YLR, MLD, CLC, PCRLJ). If unsure, provide fewer but accurate results.`,
        },
      });

      const responseText = completion.text || '{"judgments":[]}';
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
      const { query } = req.body as { query: string };

      const completion = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: query }] }],
        config: {
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          systemInstruction: `You are a Pakistani legal research assistant. Given a query, provide relevant Pakistani statutes and legal provisions. Return a JSON object with a "statutes" key containing an array of statute objects. Each object must have: shortTitle (string), section (string), description (string), punishment (string), uri (string, can be empty), keywords (array of strings). Focus on Pakistani laws including PPC, CrPC, Constitution, Family Laws, Contract Act, etc.`,
        },
      });

      const responseText = completion.text || '{"statutes":[]}';
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
      const { query, findings } = req.body as { query: string; findings: any[] };

      const completion = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: `Query: ${query}\n\nFindings:\n${JSON.stringify(findings, null, 2)}\n\nPlease provide a comprehensive summary of these findings.` }] },
        ],
        config: {
          maxOutputTokens: 8192,
          systemInstruction: `${LEGAL_SYSTEM_PROMPT}\n\nYou are summarizing legal findings for the user. Provide a concise, authoritative summary of the findings in relation to their query. Be precise and cite relevant provisions.`,
        },
      });

      const summary = completion.text || "Unable to generate summary.";
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
      const { shortTitle, section, description } = req.body as { shortTitle: string; section: string; description: string };

      const completion = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: [
          { role: "user", parts: [{ text: `Generate a detailed legal brief for:\nTitle: ${shortTitle}\nSection: ${section}\nDescription: ${description}` }] },
        ],
        config: {
          maxOutputTokens: 8192,
          systemInstruction: `${LEGAL_SYSTEM_PROMPT}\n\nYou are generating a detailed legal brief about a specific statute or legal provision. Provide comprehensive analysis including: scope, application, relevant case law citations, practical implications, and strategic considerations. Use the "Extensive yet Brief" style.`,
        },
      });

      const brief = completion.text || "Unable to generate brief.";
      res.json({ brief });
    } catch (err) {
      console.error("Error generating brief:", err);
      res.status(500).json({ message: "Failed to generate brief" });
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

  return httpServer;
}
