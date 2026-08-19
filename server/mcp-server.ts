import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { storage } from "./storage";
import { retrieveLegalCaseLaw } from "./legal-retrieval";
import { gatherKnowledgeContextV2 } from "./pipeline/knowledge-pipeline";
import { runRetrieval } from "./pipeline/retrieval-engine";
import { checkUsageLimit, createSignedUploadSession, logUsageCost, normalizeCourtReadyDraftingText, normalizeDraftingText } from "./routes";
import { PAKISTANI_JUDICIAL_FORMAT_GUIDANCE, CONTRACT_LAW_ADDON } from "./legal-drafting-template";
import { chatWithDeepSeek } from "./deepseek-ai";
import { isOpenRouterAvailable, chatWithOpenRouter } from "./openrouter";
import { AsyncLocalStorage } from "node:async_hooks";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { db } from "./db";
import { caseLaw, judgments, caseFiles, caseNotes, caseClients, caseCompliance, diaryEntries, documents, documentFiles, caseDocuments } from "@shared/schema";
import { eq, inArray, like, sql, and, gte, lte, desc } from "drizzle-orm";
import { uploadBufferToR2, uploadBufferToR2WithRetry } from "./r2-storage";
import path from "node:path";

// Request-scoped storage to track the authenticated user's ID across JSON-RPC calls
export const mcpUserContext = new AsyncLocalStorage<string>();

const VERSION = "1.0";
const SOURCE = "AlWakeelo AI";
const RETRIEVAL_VERSION = "v2";

/**
 * Validates the user's plan limits before tool execution.
 * Reuses the exact same backend checkUsageLimit function.
 */
async function enforceQuota(userId: string, feature: string): Promise<void> {
  let errorMessage = "Quota exceeded or plan invalid.";
  const mockRes = {
    status(code: number) {
      return {
        json(data: any) {
          if (data && data.message) {
            errorMessage = data.message;
          }
        }
      };
    }
  };

  const allowed = await checkUsageLimit(userId, feature, mockRes);
  if (!allowed) {
    throw new McpError(ErrorCode.InvalidRequest, errorMessage);
  }
}

/**
 * Log tool use metrics.
 * Increments query counts for search, and logs token/cost for LLM/RAG generation.
 */
async function logToolUsage(userId: string, feature: string, query: string, outputText = ""): Promise<void> {
  try {
    if (feature === "chat" || feature === "legal-research") {
      // LLM/RAG cost tracking
      await logUsageCost(userId, "chat", "deepseek-chat", query, outputText, {
        userQuery: query,
      });
    } else {
      // Non-LLM feature query logging
      await storage.logUsage(userId, feature).catch(() => {});
    }
  } catch (err) {
    console.error(`[MCP] Failed to log usage metrics for ${feature}:`, err);
  }
}

// Helper to fetch current context user ID
function getAuthenticatedUserId(): string {
  const userId = mcpUserContext.getStore();
  if (!userId) {
    throw new McpError(ErrorCode.InvalidRequest, "Unauthorized: Missing or invalid API key.");
  }
  return userId;
}

/**
 * Gemini-first AI routing for MCP drafting tools.
 * Chain: Gemini 3.0 Flash → Kimi K2.5 → DeepSeek V4 Flash
 * Matches the same routing used by the web app for consistency.
 */
async function callMcpDraftingAI(
  systemPrompt: string,
  userText: string,
  temperature = 0.3,
): Promise<{ content: string; model: string }> {
  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userText },
  ];

  // Primary: Gemini 3.0 Flash via OpenRouter
  if (isOpenRouterAvailable()) {
    try {
      const result = await chatWithOpenRouter({
        messages: messages as any,
        model: "google/gemini-3-flash-preview",
        temperature,
      });
      if (result.content && result.content.trim()) {
        console.log(`[MCP Drafting] Gemini 3.0 Flash succeeded (model=${result.model})`);
        return { content: result.content, model: result.model };
      }
    } catch (geminiErr: any) {
      console.warn(`[MCP Drafting] Gemini 3.0 Flash failed, trying Kimi:`, geminiErr?.message || geminiErr);
    }
  }

  // Fallback 1: Kimi K2.5
  try {
    const { isMoonshotAvailable, chatWithMoonshot } = await import("./moonshot");
    if (isMoonshotAvailable()) {
      const result = await chatWithMoonshot({
        messages: messages as any,
        temperature,
        useInstant: false,
      });
      if (result.content && result.content.trim()) {
        console.log(`[MCP Drafting] Kimi K2.5 fallback succeeded (model=${result.model})`);
        return { content: result.content, model: result.model };
      }
    }
  } catch (kimiErr: any) {
    console.warn(`[MCP Drafting] Kimi K2.5 failed, trying DeepSeek:`, kimiErr?.message || kimiErr);
  }

  // Fallback 2: DeepSeek V4 Flash
  const result = await chatWithDeepSeek({ messages, temperature });
  console.log(`[MCP Drafting] DeepSeek fallback succeeded (model=${result.model})`);
  return { content: result.content, model: result.model };
}

export function registerAllTools(server: McpServer) {
  // 1. Search Case Law
  server.registerTool("search_case_law", {
    description: "Search Pakistani judgments and case law using the exact AlWakeelo hybrid search pipeline (Voyage Law-2, reranker, and court boosts).",
    inputSchema: {
      query: z.string().describe("The search query containing legal topics or case details"),
      limit: z.number().optional().default(5).describe("Maximum number of records to return (default 5, max 10)"),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    }
  }, async ({ query, limit }) => {
    const userId = getAuthenticatedUserId();
    const safeLimit = Math.min(10, Math.max(1, limit));

    // Enforce standard query quota
    await enforceQuota(userId, "search-judgments");

    const t0 = Date.now();
    // Call the exact same retrieval pipeline
    const result = await retrieveLegalCaseLaw({
      userId,
      query,
      limit: safeLimit,
    });
    const latency = Date.now() - t0;

    // Track usage metrics
    await logToolUsage(userId, "search-judgments", query);

    // Map case law citations to actual judgments UUIDs in bulk to avoid N+1 query overhead
    const citations = result.rows.map(j => j.citation).filter(Boolean);
    const judgmentMap = new Map<string, string>();
    if (citations.length > 0) {
      const matchingJudgments = await db.select({
        id: judgments.id,
        citation: judgments.citationString
      })
      .from(judgments)
      .where(inArray(judgments.citationString, citations));
      
      for (const row of matchingJudgments) {
        judgmentMap.set(row.citation, row.id);
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            version: VERSION,
            source: SOURCE,
            retrieval_version: RETRIEVAL_VERSION,
            query,
            latencyMs: latency,
            judgments: result.rows.map((j) => ({
              id: judgmentMap.get(j.citation) || String(j.id),
              citation: j.citation,
              court: j.court,
              title: j.title,
              summary: j.summary,
              decisionYear: j.citationYear,
            })),
          }, null, 2),
        }
      ]
    };
  });

  // 2. Search Statutes
  server.registerTool("search_statutes", {
    description: "Search Pakistani statutory provisions and acts using AlWakeelo's taxonomic matching logic.",
    inputSchema: {
      query: z.string().describe("Keywords, section numbers, or act names (e.g. PPC 302)"),
      limit: z.number().optional().default(5).describe("Maximum sections to return (default 5, max 10)"),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    }
  }, async ({ query, limit }) => {
    const userId = getAuthenticatedUserId();
    const safeLimit = Math.min(10, Math.max(1, limit));

    // Enforce statute query quota
    await enforceQuota(userId, "search-statutes");

    const t0 = Date.now();
    // Mimic intent classifier and fetch statutes using targeted taxonomic matching
    const dummyIntent = {
      raw: query,
      normalized: query.toLowerCase(),
      type: "statute" as const,
      topics: [] as any[],
      expandedQuery: query,
      expandedTerms: query.split(/\s+/),
      needsCaseLaw: false,
      needsStatutes: true,
      needsAdminDocs: false,
    };
    
    const retrievalResult = await runRetrieval(dummyIntent, userId, { statutes: safeLimit });
    const latency = Date.now() - t0;

    // Track usage metrics
    await logToolUsage(userId, "search-statutes", query);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            version: VERSION,
            source: SOURCE,
            retrieval_version: RETRIEVAL_VERSION,
            query,
            latencyMs: latency,
            statutes: retrievalResult.statutes.map((s) => ({
              shortTitle: s.shortTitle,
              section: s.section,
              description: s.description,
              punishment: s.punishment,
              statuteDocumentTitle: s.statuteDocumentTitle,
            })),
          }, null, 2),
        }
      ]
    };
  });

  // 3. Get Judgment Detail
  server.registerTool("get_judgment", {
    description: "Retrieve the full text and headnotes of a specific judgment by its unique UUID or numeric ID.",
    inputSchema: {
      id: z.string().describe("The judgment UUID, numeric ID, or citation"),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    }
  }, async ({ id }) => {
    const userId = getAuthenticatedUserId();

    // Enforce quota
    await enforceQuota(userId, "search-judgments");

    let targetId = String(id).trim();
    
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
    if (!isUuid) {
      // If it is a numeric ID from case_law table, resolve it to the citation string first
      if (/^\d+$/.test(targetId)) {
        const [caseLawRow] = await db.select({ citation: caseLaw.citation })
          .from(caseLaw)
          .where(eq(caseLaw.id, Number(targetId)))
          .limit(1);
        if (caseLawRow && caseLawRow.citation) {
          targetId = caseLawRow.citation;
        }
      }

      // Now lookup by citation in judgments table to get the UUID
      let cleanTarget = targetId.toUpperCase();
      const COURT_REPORT_MAP: Record<string, string> = {
        LAHORE: "LHC",
        LAH: "LHC",
        KARACHI: "SHC",
        KAR: "SHC",
        SINDH: "SHC",
        SHC: "SHC",
        PESHAWAR: "PHC",
        PESH: "PHC",
        BALOCHISTAN: "BHC",
        ISLAMABAD: "IHC",
        AJK: "AJKHC",
        AJKHC: "AJKHC",
      };

      for (const [nick, canonical] of Object.entries(COURT_REPORT_MAP)) {
        cleanTarget = cleanTarget.replace(new RegExp(`\\b${nick}\\b`, 'g'), canonical);
      }
      cleanTarget = cleanTarget.replace(/\s+/g, "");

      const [resolvedRow] = await db.select({ id: judgments.id })
        .from(judgments)
        .where(like(sql`upper(replace(${judgments.citationString}, ' ', ''))`, `%${cleanTarget}%`))
        .limit(1);
        
      if (!resolvedRow) {
        throw new McpError(ErrorCode.InvalidRequest, `Judgment with ID or citation '${targetId}' not found.`);
      }
      targetId = resolvedRow.id;
    }

    const detail = await storage.getJudgmentDetail(targetId);
    if (!detail) {
      throw new McpError(ErrorCode.InvalidRequest, `Judgment not found for ID: ${targetId}`);
    }

    // Track usage
    await logToolUsage(userId, "search-judgments", `get_judgment:${targetId}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            version: VERSION,
            source: SOURCE,
            id: detail.id,
            citation: detail.citation,
            title: detail.title,
            courtName: detail.court || "Pakistani Court",
            decisionDate: detail.decisionDate,
            headnotes: detail.headnotes,
            fullText: detail.fullText,
            pdfUrl: detail.pdfUrl,
          }, null, 2),
        }
      ]
    };
  });

  // 4. Legal Research (Full Grounded RAG Pipeline)
  server.registerTool("legal_research", {
    description: "Perform deep, multi-stage legal research across AlWakeelo's full RAG context (intent analysis, Voyage Law-2 embeddings, reranker, citation validation, and parent-child chunk resolution). Returns the exact grounded text context injected into LLM system prompts.",
    inputSchema: {
      query: z.string().describe("The legal query, scenario description, or question to research"),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    }
  }, async ({ query }) => {
    const userId = getAuthenticatedUserId();

    // Legal research calls count as Chat RAG actions
    await enforceQuota(userId, "chat");

    const t0 = Date.now();
    // Execute the exact same 3-stage RAG pipeline
    const contextString = await gatherKnowledgeContextV2(query, userId);
    const latency = Date.now() - t0;

    // Track usage metrics (log token count and costs for AI billing)
    await logToolUsage(userId, "legal-research", query, contextString);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            version: VERSION,
            source: SOURCE,
            retrieval_version: RETRIEVAL_VERSION,
            query,
            latencyMs: latency,
            context: contextString,
          }, null, 2),
        }
      ]
    };
  });

  // 5. Draft Legal Petition
  server.registerTool("draft_petition", {
    description: "Generate a fully formatted, professional, filing-ready legal petition or application for Pakistani courts grounded in actual statutes and case law. ASSISTANT INSTRUCTION: Present the returned 'draft' text verbatim inside a plaintext code block (```text) without adding markdown headers (#), bold tags (**), or altering line alignment.",
    inputSchema: {
      topic: z.string().describe("The legal subject/title (e.g. Ejectment Petition under Rented Premises Act, Bail Application under Sec 497 CrPC)"),
      facts: z.string().describe("The factual background, dates, and details of the case"),
      courtName: z.string().describe("The target court/forum (e.g. Rent Controller Lahore, Sessions Judge Karachi)"),
      petitionerName: z.string().describe("Name of the petitioner/plaintiff"),
      respondentName: z.string().describe("Name of the respondent/defendant"),
      additionalClauses: z.string().optional().describe("Any additional specific grounds or instructions to include"),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    }
  }, async ({ topic, facts, courtName, petitionerName, respondentName, additionalClauses }) => {
    const userId = getAuthenticatedUserId();

    // Enforce "draft" quota limits
    await enforceQuota(userId, "draft");

    // Gather grounded context using our semantic search / case law database
    const searchQuery = `${topic} ${facts}`;
    const searchResult = await retrieveLegalCaseLaw({
      userId,
      query: searchQuery,
      limit: 3,
    });

    const contextStr = searchResult.rows.map((j) => 
      `Citation: ${j.citation}\nCourt: ${j.court}\nTitle: ${j.title}\nSummary: ${j.summary}`
    ).join("\n\n");

    const systemPrompt = `${PAKISTANI_JUDICIAL_FORMAT_GUIDANCE}

CRITICAL: Do NOT use markdown tags or symbols (#, **, __, etc.).

COURT: ${courtName.toUpperCase()}
PETITIONER: ${petitionerName}
RESPONDENT: ${respondentName}
DOCUMENT TYPE: ${topic}

INTERNAL DATABASE REFERENCES:
Use the following verified Pakistani case laws/statutes to support the grounds:
${contextStr}

FACTS TO BASE ON:
${facts}

ADDITIONAL INSTRUCTIONS:
${additionalClauses || "None"}`;
    const userText = `Please draft the petition for "${topic}".`;

    const t0 = Date.now();
    const response = await callMcpDraftingAI(systemPrompt, userText, 0.3);
    const latency = Date.now() - t0;

    let formattedText = response.content;
    try {
      formattedText = normalizeCourtReadyDraftingText(formattedText);
    } catch (e) {
      console.error("[MCP] Normalizer failed:", e);
    }

    // Log usage to the database
    await logToolUsage(userId, "draft", searchQuery, formattedText);

    // Pre-wrap draft in a plaintext code block so MCP clients render it with exact alignment & no markdown parsing
    const wrappedDraft = `\`\`\`text\n${formattedText.replace(/^```(?:text|markdown)?\n?/i, "").replace(/\n?```$/i, "")}\n\`\`\``;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            version: VERSION,
            source: SOURCE,
            latencyMs: latency,
            topic,
            draft: wrappedDraft,
          }, null, 2),
        }
      ]
    };
  });

  // 6. Draft Contract
  server.registerTool("draft_contract", {
    description: "Generate a fully structured, commercially realistic, and legally enforceable contract under Pakistani laws (e.g., Contract Act 1872). ASSISTANT INSTRUCTION: Present the returned 'draft' text verbatim inside a plaintext code block (```text) without adding markdown headers (#), bold tags (**), or altering line alignment.",
    inputSchema: {
      contractType: z.string().describe("Type of contract (e.g. Partnership Deed, Non-Disclosure Agreement, Commercial Lease)"),
      parties: z.string().describe("Details of the contracting parties"),
      terms: z.string().describe("Core terms, duration, financial considerations, and obligations"),
      governingLaw: z.string().optional().default("Pakistan").describe("Governing provincial law or jurisdiction (e.g. Punjab, Sindh)"),
      additionalClauses: z.string().optional().describe("Optional custom terms, dispute resolution, or terminations details"),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    }
  }, async ({ contractType, parties, terms, governingLaw, additionalClauses }) => {
    const userId = getAuthenticatedUserId();

    // Enforce "contract-drafting" quota limits
    await enforceQuota(userId, "contract-drafting");

    const systemPrompt = `You are AL WAKEELO — Your Digital Lawyer, Always on Duty. You are in contract drafting mode. Generate a formal, comprehensive, legally enforceable contract under the Pakistani Contract Act 1872 and other governing laws.
    
    CRITICAL FORMATTING RULES:
    1. Do NOT use markdown code blocks or blockquotes for formatting.
    2. Write a clear title centered at the top (e.g. "PARTNERSHIP DEED" or "LEASE AGREEMENT").
    3. Include a detailed preamble describing the parties, their addresses, and the date.
    4. Structure the agreement into numbered clauses (e.g., Section 1: Definitions, Section 2: Consideration, etc.).
    5. Include default standard boilerplate terms (Dispute Resolution via arbitration under Arbitration Act 1940, Severability, Force Majeure, and Termination).
    6. Include a distinct signatures block for the parties and two witnesses at the bottom.
    ${CONTRACT_LAW_ADDON}
    CONTRACT DETAILS:
    Type: ${contractType}
    Parties: ${parties}
    Terms: ${terms}
    Governing Law: ${governingLaw}
    
    ADDITIONAL CLAUSES:
    ${additionalClauses || "None"}`;
    const userText = `Please draft the contract for "${contractType}".`;

    const t0 = Date.now();
    const response = await callMcpDraftingAI(systemPrompt, userText, 0.3);
    const latency = Date.now() - t0;

    let formattedText = response.content;
    try {
      formattedText = normalizeDraftingText(formattedText);
    } catch (e) {
      console.error("[MCP] Normalizer failed:", e);
    }

    // Log usage to the database
    await logToolUsage(userId, "contract-drafting", contractType, formattedText);

    // Pre-wrap draft in a plaintext code block so MCP clients render it with exact alignment & no markdown parsing
    const wrappedDraft = `\`\`\`text\n${formattedText.replace(/^```(?:text|markdown)?\n?/i, "").replace(/\n?```$/i, "")}\n\`\`\``;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            version: VERSION,
            source: SOURCE,
            latencyMs: latency,
            contractType,
            draft: wrappedDraft,
          }, null, 2),
        }
      ]
    };
  });

  // ── CATEGORY: Case Management & CRM ──────────────────────────────────────

  // 7. List Case Files
  server.registerTool("list_case_files", {
    description: "List the authenticated lawyer's case files. Optionally filter by status (active, pending, closed, archived).",
    inputSchema: {
      status: z.enum(["active", "pending", "closed", "archived"]).optional().describe("Filter by case status"),
      limit: z.number().optional().default(10).describe("Max records to return (default 10, max 25)"),
    },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  }, async ({ status, limit }) => {
    const userId = getAuthenticatedUserId();
    const safeLimit = Math.min(25, Math.max(1, limit));

    const conditions: any[] = [eq(caseFiles.userId, userId)];
    if (status) conditions.push(eq(caseFiles.status, status));

    const rows = await db.select()
      .from(caseFiles)
      .where(and(...conditions))
      .orderBy(desc(caseFiles.updatedAt))
      .limit(safeLimit);

    return {
      content: [{ type: "text", text: JSON.stringify({
        version: VERSION, source: SOURCE,
        totalResults: rows.length,
        cases: rows.map((c: any) => ({
          id: c.id, title: c.title, caseType: c.caseType,
          court: c.court, caseNumber: c.caseNumber,
          status: c.status, priority: c.priority,
          referenceNo: c.referenceNo,
          createdAt: c.createdAt,
        })),
      }, null, 2) }],
    };
  });

  // 8. Get Case Details
  server.registerTool("get_case_details", {
    description: "Get complete details of a specific case file including clients, notes, and compliance checklist items.",
    inputSchema: {
      caseId: z.number().describe("The case file ID"),
    },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  }, async ({ caseId }) => {
    const userId = getAuthenticatedUserId();

    const [caseFile] = await db.select().from(caseFiles)
      .where(and(eq(caseFiles.id, caseId), eq(caseFiles.userId, userId)))
      .limit(1);
    if (!caseFile) throw new McpError(ErrorCode.InvalidRequest, `Case #${caseId} not found or access denied.`);

    const [clients, notes, compliance] = await Promise.all([
      db.select().from(caseClients).where(eq(caseClients.caseId, caseId)),
      db.select().from(caseNotes).where(eq(caseNotes.caseId, caseId)).orderBy(desc(caseNotes.createdAt)),
      db.select().from(caseCompliance).where(eq(caseCompliance.caseId, caseId)).orderBy(desc(caseCompliance.dueDate)),
    ]);

    return {
      content: [{ type: "text", text: JSON.stringify({
        version: VERSION, source: SOURCE,
        case: {
          id: caseFile.id, title: caseFile.title, caseType: caseFile.caseType,
          court: caseFile.court, caseNumber: caseFile.caseNumber,
          status: caseFile.status, priority: caseFile.priority,
          referenceNo: caseFile.referenceNo, description: caseFile.description,
          createdAt: caseFile.createdAt, updatedAt: caseFile.updatedAt,
        },
        clients: clients.map((c: any) => ({ id: c.id, role: c.role, name: c.name, phone: c.phone, cnic: c.cnic })),
        notes: notes.map((n: any) => ({ id: n.id, content: n.content, createdAt: n.createdAt })),
        compliance: compliance.map((c: any) => ({
          id: c.id, type: c.type, title: c.title,
          dueDate: c.dueDate, status: c.status, court: c.court, judge: c.judge,
        })),
      }, null, 2) }],
    };
  });

  // 9. Create Case File
  server.registerTool("create_case_file", {
    description: "Create a new legal case file in the lawyer's case management dashboard.",
    inputSchema: {
      title: z.string().describe("Case title (e.g. Malik Ahmed vs Bilal Khan)"),
      caseType: z.enum(["criminal", "civil", "family", "constitutional", "tax", "corporate", "banking", "labor", "property", "other"]).describe("Type of legal case"),
      court: z.string().optional().describe("Court name (e.g. Rent Controller Lahore)"),
      caseNumber: z.string().optional().describe("Official case/suit number"),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
      description: z.string().optional().describe("Brief case description or background facts"),
    },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  }, async ({ title, caseType, court, caseNumber, priority, description }) => {
    const userId = getAuthenticatedUserId();

    const [created] = await db.insert(caseFiles).values({
      userId, title, caseType, court, caseNumber, priority, description,
    }).returning();

    return {
      content: [{ type: "text", text: JSON.stringify({
        version: VERSION, source: SOURCE,
        message: `Case file "${title}" created successfully.`,
        case: { id: created.id, title: created.title, caseType: created.caseType, court: created.court, status: created.status },
      }, null, 2) }],
    };
  });

  // 10. Add Case Note
  server.registerTool("add_case_note", {
    description: "Add a progress note, hearing update, or log entry to an existing case file.",
    inputSchema: {
      caseId: z.number().describe("The case file ID to add the note to"),
      content: z.string().describe("The note content (e.g. 'Opponent requested adjournment. Next hearing fixed for arguments.')"),
    },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  }, async ({ caseId, content }) => {
    const userId = getAuthenticatedUserId();

    // Verify case ownership
    const [caseFile] = await db.select({ id: caseFiles.id }).from(caseFiles)
      .where(and(eq(caseFiles.id, caseId), eq(caseFiles.userId, userId)))
      .limit(1);
    if (!caseFile) throw new McpError(ErrorCode.InvalidRequest, `Case #${caseId} not found or access denied.`);

    const [note] = await db.insert(caseNotes).values({ caseId, userId, content }).returning();

    return {
      content: [{ type: "text", text: JSON.stringify({
        version: VERSION, source: SOURCE,
        message: "Note added successfully.",
        note: { id: note.id, caseId, content: note.content, createdAt: note.createdAt },
      }, null, 2) }],
    };
  });

  // ── CATEGORY: Court Diary & Hearing Scheduler ────────────────────────────

  // 11. List Diary Entries
  server.registerTool("list_diary_entries", {
    description: "List court hearing dates, trial schedules, and compliance tasks from the lawyer's diary for a given date range.",
    inputSchema: {
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
    },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  }, async ({ startDate, endDate }) => {
    const userId = getAuthenticatedUserId();

    const rows = await db.select().from(diaryEntries)
      .where(and(
        eq(diaryEntries.userId, userId),
        gte(diaryEntries.date, startDate),
        lte(diaryEntries.date, endDate),
      ))
      .orderBy(diaryEntries.date);

    return {
      content: [{ type: "text", text: JSON.stringify({
        version: VERSION, source: SOURCE,
        dateRange: { from: startDate, to: endDate },
        totalEntries: rows.length,
        entries: rows.map((e: any) => ({
          id: e.id, date: e.date, time: e.time,
          title: e.title, description: e.description,
          caseId: e.caseId, priority: e.priority,
          completed: e.completed, outcome: e.outcome, nextDate: e.nextDate,
        })),
      }, null, 2) }],
    };
  });

  // 12. Add Diary Entry
  server.registerTool("add_diary_entry", {
    description: "Schedule a new court hearing, compliance deadline, or task in the lawyer's court diary.",
    inputSchema: {
      date: z.string().describe("Hearing/task date (YYYY-MM-DD)"),
      title: z.string().describe("Title (e.g. Arguments on Bail Application)"),
      time: z.string().optional().describe("Time (e.g. 09:00 AM)"),
      description: z.string().optional().describe("Additional details or notes"),
      caseId: z.number().optional().describe("Link to an existing case file ID"),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
    },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  }, async ({ date, title, time, description, caseId, priority }) => {
    const userId = getAuthenticatedUserId();

    // If caseId provided, verify ownership
    if (caseId) {
      const [caseFile] = await db.select({ id: caseFiles.id }).from(caseFiles)
        .where(and(eq(caseFiles.id, caseId), eq(caseFiles.userId, userId)))
        .limit(1);
      if (!caseFile) throw new McpError(ErrorCode.InvalidRequest, `Case #${caseId} not found or access denied.`);
    }

    const [entry] = await db.insert(diaryEntries).values({
      userId, date, title, time, description, caseId, priority,
    }).returning();

    return {
      content: [{ type: "text", text: JSON.stringify({
        version: VERSION, source: SOURCE,
        message: `Diary entry "${title}" scheduled for ${date}.`,
        entry: { id: entry.id, date: entry.date, time: entry.time, title: entry.title, priority: entry.priority },
      }, null, 2) }],
    };
  });

  // 13. Update Diary Status
  server.registerTool("update_diary_status", {
    description: "Mark a court hearing or diary task as completed, record the outcome, and optionally schedule the next hearing date.",
    inputSchema: {
      entryId: z.number().describe("The diary entry ID"),
      completed: z.boolean().describe("Whether the hearing/task is completed"),
      outcome: z.string().optional().describe("Court outcome (e.g. 'Defendant filed reply. Case adjourned.')"),
      nextDate: z.string().optional().describe("Next hearing date if adjourned (YYYY-MM-DD)"),
    },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  }, async ({ entryId, completed, outcome, nextDate }) => {
    const userId = getAuthenticatedUserId();

    // Verify diary entry ownership
    const [existing] = await db.select().from(diaryEntries)
      .where(and(eq(diaryEntries.id, entryId), eq(diaryEntries.userId, userId)))
      .limit(1);
    if (!existing) throw new McpError(ErrorCode.InvalidRequest, `Diary entry #${entryId} not found or access denied.`);

    const [updated] = await db.update(diaryEntries)
      .set({ completed, outcome, nextDate })
      .where(eq(diaryEntries.id, entryId))
      .returning();

    // If nextDate provided, automatically create a follow-up diary entry
    let followUp = null;
    if (nextDate && existing.title) {
      const [newEntry] = await db.insert(diaryEntries).values({
        userId,
        date: nextDate,
        title: `[Follow-up] ${existing.title}`,
        description: outcome ? `Previous outcome: ${outcome}` : undefined,
        caseId: existing.caseId,
        priority: existing.priority,
      }).returning();
      followUp = { id: newEntry.id, date: newEntry.date, title: newEntry.title };
    }

    return {
      content: [{ type: "text", text: JSON.stringify({
        version: VERSION, source: SOURCE,
        message: `Diary entry #${entryId} updated.`,
        updated: { id: updated.id, completed: updated.completed, outcome: updated.outcome, nextDate: updated.nextDate },
        followUpEntry: followUp,
      }, null, 2) }],
    };
  });

  // ── CATEGORY: Document Upload ─────────────────────────────────────────────

  // 14. Upload Case Document (Inline Snippets & Base64)
  server.registerTool("upload_case_document", {
    description: "Upload small inline text snippets or notes to a case file. NOTE FOR ASSISTANT: For local PDFs, scans, photos, or physical files, call request_document_upload instead to generate a free 1-click upload link (<30 tokens).",
    inputSchema: {
      caseId: z.number().describe("The case file ID to attach the document to"),
      fileName: z.string().describe("Original filename with extension (e.g. 'court_order.pdf', 'evidence_photo.jpg')"),
      fileData: z.string().describe("Base64-encoded file content"),
      label: z.string().optional().describe("Document label (e.g. 'FIR Copy', 'Medical Report', 'Power of Attorney')"),
      mode: z.enum(["base64", "direct"]).optional().default("base64").describe("Upload mode: 'base64' for inline files (<=25MB), 'direct' for presigned URL mode"),
    },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  }, async ({ caseId, fileName, fileData, label, mode }) => {
    const userId = getAuthenticatedUserId();

    // Verify case ownership
    const [caseFile] = await db.select({ id: caseFiles.id, title: caseFiles.title }).from(caseFiles)
      .where(and(eq(caseFiles.id, caseId), eq(caseFiles.userId, userId)))
      .limit(1);
    if (!caseFile) throw new McpError(ErrorCode.InvalidRequest, `Case #${caseId} not found or access denied.`);

    // Decode base64 file
    let buffer: Buffer;
    try {
      buffer = Buffer.from(fileData, "base64");
    } catch {
      throw new McpError(ErrorCode.InvalidRequest, "Invalid base64 file data.");
    }

    if (buffer.length === 0) {
      throw new McpError(ErrorCode.InvalidRequest, "File data is empty.");
    }

    const MAX_BINARY_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB binary payload
    if (buffer.length > MAX_BINARY_SIZE_BYTES) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `File size (${(buffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds 25MB inline limit. Call request_document_upload instead to get a free 1-click upload link.`
      );
    }

    // Determine MIME type from extension
    const ext = path.extname(fileName).toLowerCase();
    const MIME_MAP: Record<string, string> = {
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".tiff": "image/tiff", ".tif": "image/tiff",
      ".txt": "text/plain",
      ".csv": "text/csv",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    const mimeType = MIME_MAP[ext] || "application/octet-stream";

    // Determine source type
    const isImage = mimeType.startsWith("image/");
    const sourceType = isImage ? "image" : "upload";

    // 1. Create a document record in PostgreSQL immediately
    const [doc] = await db.insert(documents).values({
      userId,
      title: label || fileName,
      sourceType,
      mimeType,
      fileExtension: ext,
      detectedDomain: "legal",
      detectedDomainLabel: "Legal Document",
      classificationMethod: "mcp-upload",
    }).returning();

    // 2. Link document to the case file immediately
    await db.insert(caseDocuments).values({
      caseId,
      documentId: doc.id,
      label: label || fileName,
    });

    // 3. Dispatch Cloudflare R2 upload asynchronously in background (non-blocking)
    const uploadPrefix = `case-docs/${userId}`;
    (async () => {
      try {
        const r2Result = await uploadBufferToR2WithRetry({
          buffer,
          fileName,
          contentType: mimeType,
          prefix: uploadPrefix,
        });

        if (r2Result) {
          await db.insert(documentFiles).values({
            documentId: doc.id,
            userId,
            provider: r2Result.provider,
            bucket: r2Result.bucket,
            objectKey: r2Result.objectKey,
            originalFilename: fileName,
            mimeType,
            sizeBytes: buffer.length,
            etag: r2Result.etag,
            publicUrl: r2Result.publicUrl,
          }).catch((err) => console.error(`[MCP Upload Background] Failed to save documentFiles for Doc #${doc.id}:`, err));
          console.log(`[MCP Upload Background] Successfully synced Doc #${doc.id} (${fileName}) to R2.`);
        } else {
          console.warn(`[MCP Upload Background] R2 upload retries exhausted for Doc #${doc.id}. Document saved in DB only.`);
        }
      } catch (err) {
        console.error(`[MCP Upload Background] Error during R2 sync for Doc #${doc.id}:`, err);
      }
    })();

    // 4. Return instant HTTP response (<200ms) to MCP client
    return {
      content: [{ type: "text", text: JSON.stringify({
        version: VERSION, source: SOURCE,
        message: `Document "${fileName}" created and linked to case "${caseFile.title}". Storage sync is in progress.`,
        status: "pending",
        document: {
          id: doc.id,
          fileName,
          label: label || fileName,
          mimeType,
          sizeBytes: buffer.length,
          storedInR2: false,
          status: "pending",
        },
        case: { id: caseFile.id, title: caseFile.title },
      }, null, 2) }],
    };
  });

  // 15. Request Document Upload Link (Zero Token Waste 1-Click Upload)
  server.registerTool("request_document_upload", {
    description: "PRIMARY DOCUMENT TOOL FOR ALL FILES & PDFs: Generates a secure, 1-click signed upload link for the user to upload any document, PDF, scan, or photo to a case file without consuming LLM quota (<30 tokens). ASSISTANT INSTRUCTION: Always present the returned uploadUrl to the user as a clear markdown link: '[Click here to upload document](uploadUrl)'.",
    inputSchema: {
      caseId: z.number().describe("The target case file ID to attach the document to"),
      label: z.string().optional().describe("Document label (e.g. 'FIR Copy', 'Medical Report', 'Power of Attorney')"),
    },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  }, async ({ caseId, label }) => {
    const userId = getAuthenticatedUserId();
    try {
      const sessionId = await createSignedUploadSession(userId, caseId, label);
      const uploadUrl = `https://www.alwakeelo.com/upload/session/${sessionId}`;
      return {
        content: [{ type: "text", text: JSON.stringify({
          version: VERSION,
          uploadUrl,
        }, null, 2) }],
      };
    } catch (err: any) {
      throw new McpError(ErrorCode.InvalidRequest, err?.message || "Failed to create upload session.");
    }
  });
}

// Factory to create a fully configured fresh MCP Server
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "alwakeelo-mcp",
    version: "1.0.0",
  });
  registerAllTools(server);
  return server;
}

// Single default server instance for backward compatibility (e.g. stdio runner)
export const mcpServer = createMcpServer();
