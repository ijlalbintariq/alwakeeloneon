import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const LEGAL_SYSTEM_PROMPT = `You are "Al Wakeel", an expert AI legal assistant.
Your goal is to provide helpful, accurate, and professional legal information.
Always include a disclaimer that you are an AI and this is not professional legal advice.
Be concise, clear, and empathetic.
If a user asks about a specific jurisdiction, ask them to clarify if not provided, but default to general legal principles if unknown.
Format your responses using markdown for readability when appropriate.`;

function getUserId(req: any): string | null {
  return req.user?.claims?.sub || null;
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

      const completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: LEGAL_SYSTEM_PROMPT },
          { role: "user", content: firstMessage },
        ],
        max_completion_tokens: 4096,
      });

      const aiResponse = completion.choices[0].message.content || "I apologize, I could not generate a response.";

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
      const openAiMessages = [
        { role: "system" as const, content: LEGAL_SYSTEM_PROMPT },
        ...history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: openAiMessages,
        max_completion_tokens: 4096,
      });

      const aiResponse = completion.choices[0].message.content || "I apologize, I could not generate a response.";

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

  return httpServer;
}
