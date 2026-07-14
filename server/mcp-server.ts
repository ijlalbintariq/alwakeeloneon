import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { storage } from "./storage";
import { retrieveLegalCaseLaw } from "./legal-retrieval";
import { gatherKnowledgeContextV2 } from "./pipeline/knowledge-pipeline";
import { runRetrieval } from "./pipeline/retrieval-engine";
import { checkUsageLimit, logUsageCost, normalizeCourtReadyDraftingText, normalizeDraftingText } from "./routes";
import { chatWithDeepSeek } from "./deepseek-ai";
import { AsyncLocalStorage } from "node:async_hooks";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

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
              id: j.id,
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
    description: "Retrieve the full text and headnotes of a specific judgment by its unique UUID.",
    inputSchema: {
      id: z.string().describe("The judgment UUID"),
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

    const detail = await storage.getJudgmentDetail(id);
    if (!detail) {
      throw new McpError(ErrorCode.InvalidRequest, `Judgment not found for ID: ${id}`);
    }

    // Track usage
    await logToolUsage(userId, "search-judgments", `get_judgment:${id}`);

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
            courtName: detail.courtName || detail.courtSnapshot || "Pakistani Court",
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
    description: "Generate a fully formatted, professional, filing-ready legal petition or application for Pakistani courts grounded in actual statutes and case law.",
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

    const systemPrompt = `You are AL WAKEELO — Your Digital Lawyer, Always on Duty. You are in legal drafting mode. Generate a formal, professional, airtight legal petition or application that is filing-ready under the Code of Civil Procedure (CPC) 1908 and applicable Pakistani statutes.
    
    CRITICAL FORMATTING RULES:
    1. Do NOT use markdown tags or symbols (#, **, __, etc.).
    2. Write a clear Court Heading block at the top, centered, e.g., "IN THE COURT OF THE ${courtName.toUpperCase()}".
    3. Include the Parties Block clearly outlining:
       ${petitionerName} ... Petitioner
       VERSUS
       ${respondentName} ... Respondent
    4. Write numbered paragraphs stating the facts, cause of action, jurisdiction, and court fee calculations.
    5. Valuation/Court Fee: State that the court fee is affixed per the Court Fees Act 1870.
    6. Include a distinct "PRAYER" section at the end.
    7. Include a "VERIFICATION" block stating the truth of the contents.
    8. List of Documents: Append a numbered List of Documents section after the verification block.
    9. Memo of Address: Include address for service at the bottom.
    
    GROUNDING CONTEXT:
    Use the following verified Pakistani case laws/statutes to support the grounds:
    ${contextStr}
    
    FACTS TO BASE ON:
    ${facts}
    
    ADDITIONAL INSTRUCTIONS:
    ${additionalClauses || "None"}`;

    const userText = `Please draft the petition for "${topic}".`;

    const t0 = Date.now();
    const response = await chatWithDeepSeek({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText }
      ],
      temperature: 0.3,
    });
    const latency = Date.now() - t0;

    let formattedText = response.content;
    try {
      formattedText = normalizeCourtReadyDraftingText(formattedText);
    } catch (e) {
      console.error("[MCP] Normalizer failed:", e);
    }

    // Log usage to the database
    await logToolUsage(userId, "draft", searchQuery, formattedText);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            version: VERSION,
            source: SOURCE,
            latencyMs: latency,
            topic,
            draft: formattedText,
          }, null, 2),
        }
      ]
    };
  });

  // 6. Draft Contract
  server.registerTool("draft_contract", {
    description: "Generate a fully structured, commercially realistic, and legally enforceable contract under Pakistani laws (e.g., Contract Act 1872).",
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
    
    CONTRACT DETAILS:
    Type: ${contractType}
    Parties: ${parties}
    Terms: ${terms}
    Governing Law: ${governingLaw}
    
    ADDITIONAL CLAUSES:
    ${additionalClauses || "None"}`;

    const userText = `Please draft the contract for "${contractType}".`;

    const t0 = Date.now();
    const response = await chatWithDeepSeek({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText }
      ],
      temperature: 0.3,
    });
    const latency = Date.now() - t0;

    let formattedText = response.content;
    try {
      formattedText = normalizeDraftingText(formattedText);
    } catch (e) {
      console.error("[MCP] Normalizer failed:", e);
    }

    // Log usage to the database
    await logToolUsage(userId, "contract-drafting", contractType, formattedText);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            version: VERSION,
            source: SOURCE,
            latencyMs: latency,
            contractType,
            draft: formattedText,
          }, null, 2),
        }
      ]
    };
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
