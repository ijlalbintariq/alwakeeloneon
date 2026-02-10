
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth } from "./replit_integrations/auth";
import { OpenAI } from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const LEGAL_SYSTEM_PROMPT = `
You are "Al Wakeel", an expert AI legal assistant.
Your goal is to provide helpful, accurate, and professional legal information.
Always include a disclaimer that you are an AI and this is not professional legal advice.
Be concise, clear, and empathetic.
If a user asks about a specific jurisdiction, ask them to clarify if not provided, but default to general legal principles if unknown.
`;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Authentication
  await setupAuth(app);

  // === THREADS ===
  app.get(api.threads.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const threads = await storage.getThreads(userId);
    res.json(threads);
  });

  app.post(api.threads.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { title, firstMessage } = api.threads.create.input.parse(req.body);
      const userId = (req.user as any).id;

      // Create thread
      const thread = await storage.createThread({
        userId,
        title: title || firstMessage.slice(0, 50) + "...",
      });

      // Save user message
      await storage.createMessage({
        threadId: thread.id,
        role: "user",
        content: firstMessage,
      });

      // Generate AI response
      const completion = await openai.chat.completions.create({
        model: "gpt-5.1", // Using Replit AI Integration model
        messages: [
          { role: "system", content: LEGAL_SYSTEM_PROMPT },
          { role: "user", content: firstMessage },
        ],
      });

      const aiResponse = completion.choices[0].message.content || "I apologize, I could not generate a response.";

      // Save AI message
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const threadId = Number(req.params.id);
    const thread = await storage.getThread(threadId);
    const userId = (req.user as any).id;

    if (!thread || thread.userId !== userId) {
      return res.status(404).json({ message: "Thread not found" });
    }

    const messages = await storage.getMessages(threadId);
    res.json({ thread, messages });
  });

  app.delete(api.threads.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const threadId = Number(req.params.id);
    const thread = await storage.getThread(threadId);
    const userId = (req.user as any).id;

    if (!thread || thread.userId !== userId) {
      return res.status(404).json({ message: "Thread not found" });
    }

    await storage.deleteThread(threadId);
    res.sendStatus(204);
  });

  // === MESSAGES (CHAT) ===
  app.post(api.messages.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const threadId = Number(req.params.threadId);
    const thread = await storage.getThread(threadId);
    const userId = (req.user as any).id;

    if (!thread || thread.userId !== userId) {
      return res.status(404).json({ message: "Thread not found" });
    }

    try {
      const { message } = api.messages.create.input.parse(req.body);

      // Save user message
      await storage.createMessage({
        threadId,
        role: "user",
        content: message,
      });

      // Get conversation history for context
      const history = await storage.getMessages(threadId);
      const openAiMessages = [
        { role: "system" as const, content: LEGAL_SYSTEM_PROMPT },
        ...history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      // Generate AI response
      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: openAiMessages,
      });

      const aiResponse = completion.choices[0].message.content || "I apologize, I could not generate a response.";

      // Save AI message
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

  // === DOCUMENTS ===
  app.get(api.documents.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const docs = await storage.getDocuments(userId);
    res.json(docs);
  });

  app.post(api.documents.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
        const input = api.documents.create.input.parse(req.body);
        const userId = (req.user as any).id;
        const doc = await storage.createDocument({
            ...input,
            userId
        });
        res.status(201).json(doc);
    } catch(err) {
        res.status(500).json({ message: "Failed to create document"});
    }
  });

  return httpServer;
}
