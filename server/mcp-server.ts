import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";


import { storage } from "./storage";
import { retrieveLegalCaseLaw } from "./legal-retrieval";
import { gatherKnowledgeContextV2 } from "./pipeline/knowledge-pipeline";
import { runRetrieval } from "./pipeline/retrieval-engine";
import { classifyQueryIntent } from "./pipeline/intent-classifier";
import { checkUsageLimit, createSignedUploadSession, logUsageCost, normalizeCourtReadyDraftingText, normalizeDraftingText } from "./routes";
import { PAKISTANI_JUDICIAL_FORMAT_GUIDANCE, CONTRACT_LAW_ADDON } from "./legal-drafting-template";
import { chatWithDeepSeek } from "./deepseek-ai";
import { isOpenRouterAvailable, chatWithOpenRouter } from "./openrouter";
import { AsyncLocalStorage } from "node:async_hooks";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { db } from "./db";
import {
  judgmentSourceUrl, resolveJudgment, assessJudgmentText,
  extractCitations, verifyCitations,
} from "./citation-verify";
import { judgeCaseLinks, citationLinks, caseLaw, judgments, caseFiles, caseNotes, caseClients, caseCompliance, diaryEntries, documents, documentFiles, caseDocuments } from "@shared/schema";
import { eq, inArray, sql, and, gte, lte, desc, ilike, count, countDistinct, asc } from "drizzle-orm";
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
    // 1. Core usage tracking (rate limits)
    if (feature === "chat" || feature === "legal-research") {
      const modelName = feature === "legal-research" ? "mcp-rag-context" : "deepseek-chat";
      await logUsageCost(userId, "chat", modelName, query, outputText, {
        userQuery: query,
        skipQualityLog: true, // We will manually handle output logging below for everything
      });
    } else {
      await storage.logUsage(userId, feature).catch(() => {});
    }

    // 2. Always log to AI Output Log for visibility as requested by admin
    const logModel = feature === "legal-research" ? "mcp-rag-context" : (feature === "chat" ? "deepseek-chat" : `mcp-tool:${feature}`);
    await storage.logOutputQuality({
      userId,
      feature: "chat", // Log as chat so it appears uniformly in the dashboard
      model: logModel,
      inputSnippet: query.slice(0, 500),
      outputSnippet: (outputText || `[Tool Executed Successfully: ${feature}]`).slice(0, 1500),
      outputLength: (outputText || "").length,
      qualityScore: 5,
      qualityFlags: [],
      userQuery: query,
      responseTimeMs: 0
    }).catch(() => {});

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
    description: "Search Pakistani judgments and case law using the exact AlWakeelo hybrid search pipeline (Voyage Law-2, reranker, and court boosts). By default ONLY returns fully verified results: the citation is confirmed to exist in the judgments table AND that judgment's stored text is confirmed to be its own, so citation/title/court/year are authoritative. A hit whose citation is real but whose stored text belongs to a different case is returned with verified=false, textIntegrity='mislabeled', a belongsTo citation, and its title and summary withheld. ASSISTANT INSTRUCTION: Only cite records returned by this tool with verified=true. Never reconstruct, complete, or guess a citation yourself. Never present the title or holdings of a record whose textIntegrity is not 'own'. If droppedUnverified > 0, tell the user some hits were withheld and why.",
    inputSchema: {
      query: z.string().describe("The search query containing legal topics or case details"),
      limit: z.number().optional().default(5).describe("Maximum number of records to return (default 5, max 10)"),
      includeUnverified: z.boolean().optional().default(false).describe("Include index-only hits whose citation does NOT resolve to a real judgment. Default false. These are NOT safe to cite in court filings."),
    },
    outputSchema: {
      version: z.string(),
      source: z.string(),
      retrieval_version: z.string(),
      query: z.string(),
      latencyMs: z.number(),
      verifiedOnly: z.boolean(),
      droppedUnverified: z.number(),
      duplicatesDropped: z.number(),
      note: z.string().optional(),
      judgments: z.array(z.object({
        id: z.string(),
        citation: z.string(),
        court: z.string().optional(),
        title: z.string().optional(),
        summary: z.string().optional(),
        snippet: z.string().optional(),
        decisionYear: z.number().optional(),
        sourceTable: z.string().optional(),
        verified: z.boolean(),
        textIntegrity: z.string().optional(),
        belongsTo: z.string().optional(),
        warning: z.string().optional(),
        pdfUrl: z.string().optional(),
        sourceUrl: z.string().optional(),
      })),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    }
  }, async ({ query, limit, includeUnverified }) => {
    const userId = getAuthenticatedUserId();
    const safeLimit = Math.min(10, Math.max(1, limit));

    // Enforce standard query quota
    await enforceQuota(userId, "search-judgments");

    const t0 = Date.now();
    const result = await retrieveLegalCaseLaw({
      userId,
      query,
      limit: safeLimit,
    });
    const latency = Date.now() - t0;

    await logToolUsage(userId, "search-judgments", query);

    // -------------------------------------------------------------------
    // Resolve result rows to judgment UUIDs.
    //
    // Keyword-path rows (from storage.searchCaseLaw) already carry the
    // judgment UUID as `(row as any).judgmentId`.
    //
    // RAG-path rows (from case_law table) don't — for those, do a single
    // bulk citation lookup using exact normalized match (not LIKE %...%
    // which caused partial collisions returning wrong judgments).
    // -------------------------------------------------------------------
    // case_law rows are LLM-extracted: their citation strings can be
    // malformed or entirely invented, and hasCitationTrust() in
    // legal-retrieval.ts only checks that a citation *looks* like a Pakistani
    // citation (journal code + year). A result is only trustworthy if its
    // citation resolves EXACTLY to a row in the `judgments` table, which is
    // the table that actually holds real full text / PDFs.
    const groundTruth = {
      id: judgments.id,
      citation: judgments.citationString,
      title: judgments.title,
      court: judgments.courtNameSnapshot,
      decisionDate: judgments.decisionDate,
      pdfUrl: judgments.pdfUrl,
      textStatus: judgments.textStatus,
      textTrueCitation: judgments.textTrueCitation,
      // length only: computed server-side, so the body is never transferred
      textLen: sql<number>`length(${judgments.fullText})`,
    };
    type VerifiedRow = {
      id: string;
      citation: string | null;
      title: string | null;
      court: string | null;
      decisionDate: Date | null;
      pdfUrl: string | null;
      textStatus: string | null;
      textTrueCitation: string | null;
      textLen: number | null;
    };
    const verified = new Map<number, VerifiedRow>();

    // (a) Keyword-path rows carry a judgment UUID — confirm the row really
    //     exists and pull its authoritative citation (do not trust the
    //     case_law copy of the citation).
    const uuidByIdx = new Map<number, string>();
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i] as any;
      if (row.judgmentId && typeof row.judgmentId === "string" && row.judgmentId.includes("-")) {
        uuidByIdx.set(i, row.judgmentId);
      }
    }
    if (uuidByIdx.size > 0) {
      const fetched = await db.select(groundTruth)
        .from(judgments)
        .where(inArray(judgments.id, [...new Set(uuidByIdx.values())]));
      const byId = new Map<string, VerifiedRow>(
        (fetched as any[]).map((r) => [String(r.id), r as VerifiedRow] as const),
      );
      for (const [idx, uuid] of uuidByIdx) {
        const hit = byId.get(uuid);
        if (hit) verified.set(idx, hit);
      }
    }

    // (b) Everything else: exact normalized citation match only.
    //     No LIKE %citation% fallback — a substring match (e.g. "2001SCMR198"
    //     matching "2001SCMR1986") silently binds the result to the WRONG
    //     judgment. Unresolved rows are treated as unverified, not guessed at.
    for (let i = 0; i < result.rows.length; i++) {
      if (verified.has(i)) continue;
      const citation = (result.rows[i] as any).citation;
      if (!citation) continue;
      const match = await resolveJudgment(citation, groundTruth);
      if (match) verified.set(i, match as VerifiedRow);
    }

    const allRows = result.rows.map((j: any, i: number) => {
      const v = verified.get(i);
      if (v) {
        // The citation resolves to a real judgment, but that is only half the
        // question. If the judgment's stored body is not its own, then its
        // title and every summary derived from it describe a DIFFERENT case,
        // so none of those fields may be presented as this citation's.
        // A row can also carry no usable body at all - a handful hold only OCR
        // residue such as repeated "CamScanner". Those were labelled 'own'
        // because nothing else shares their text, which is true but useless:
        // there is no judgment to read, so the record is not citable either.
        const hasBody = (v.textLen ?? 0) >= 200;
        const ownText = v.textStatus === "own" && hasBody;
        if (!ownText) {
          const belongsTo = String(v.textTrueCitation || "").trim();
          const integrity = !hasBody ? "missing"
            : v.textStatus === "mislabeled" ? "mislabeled"
            : "unknown";
          const warning = integrity === "missing"
            ? "This citation is real, but no judgment text is stored for it. Its title and summary are withheld. Do not cite it or describe its holdings, and do not reconstruct the judgment from memory."
            : belongsTo
              ? `This citation is real, but the text stored under it is the judgment reported as ${belongsTo}. Its title and summary describe that other case and are withheld here. Do not cite this record's holdings.`
              : "This citation is real, but the text stored under it could not be confirmed to be its own. Its title and summary are withheld. Do not cite this record's holdings.";
          return {
            id: v.id,
            citation: v.citation || String(j.citation || ""),
            court: v.court || undefined,
            decisionYear: v.decisionDate instanceof Date ? v.decisionDate.getFullYear() : undefined,
            sourceTable: "judgments",
            verified: false,
            textIntegrity: integrity,
            belongsTo: integrity === "missing" ? undefined : (belongsTo || undefined),
            warning,
            sourceUrl: judgmentSourceUrl(v.id),
          };
        }
        return {
          // Authoritative values come from the judgments table, NOT from the
          // LLM-extracted case_law row.
          id: v.id,
          citation: v.citation || String(j.citation || ""),
          court: v.court || j.court || undefined,
          title: v.title || j.title || undefined,
          summary: j.summary,
          snippet: (j.summary || "").slice(0, 500),
          decisionYear: v.decisionDate instanceof Date ? v.decisionDate.getFullYear() : j.citationYear,
          sourceTable: "judgments",
          verified: true,
          textIntegrity: "own",
          pdfUrl: v.pdfUrl ?? undefined,
          sourceUrl: judgmentSourceUrl(v.id),
        };
      }
      return {
        id: `caseLaw:${j.id}`,
        citation: String(j.citation || ""),
        court: j.court,
        title: j.title,
        summary: j.summary,
        snippet: (j.summary || "").slice(0, 500),
        decisionYear: j.citationYear,
        sourceTable: "case_law",
        verified: false,
      };
    });

    // Two case_law rows frequently carry the same citation, so the same
    // judgment can resolve twice. Returning it twice wastes a result slot and
    // reads to the model as independent corroboration, which it is not.
    const seenIds = new Set<string>();
    const dedupedRows = allRows.filter((r) => {
      if (seenIds.has(r.id)) return false;
      seenIds.add(r.id);
      return true;
    });
    const duplicatesDropped = allRows.length - dedupedRows.length;

    const keptRows = includeUnverified ? dedupedRows : dedupedRows.filter((r) => r.verified);
    const droppedUnverified = dedupedRows.length - keptRows.length;

    const payload = {
      version: VERSION,
      source: SOURCE,
      retrieval_version: RETRIEVAL_VERSION,
      query,
      latencyMs: latency,
      verifiedOnly: !includeUnverified,
      droppedUnverified,
      duplicatesDropped,
      note: droppedUnverified > 0
        ? `${droppedUnverified} hit(s) were withheld: either the citation could not be matched to a real judgment record, or the judgment's stored text is not its own and so its title and summary describe a different case. Do not cite them. Re-run with includeUnverified=true to inspect them as leads only.`
        : undefined,
      judgments: keptRows,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(payload, null, 2),
        }
      ],
      structuredContent: payload,
    };
  });

  // 2. Search Statutes
  server.registerTool("search_statutes", {
    description: "Search Pakistani statutory provisions and acts using AlWakeelo's taxonomic matching logic.",
    inputSchema: {
      query: z.string().describe("Keywords, section numbers, or act names (e.g. PPC 302)"),
      limit: z.number().optional().default(5).describe("Maximum sections to return (default 5, max 10)"),
    },
    outputSchema: {
      version: z.string(),
      source: z.string(),
      retrieval_version: z.string(),
      query: z.string(),
      latencyMs: z.number(),
      statutes: z.array(z.object({
        shortTitle: z.string().optional(),
        section: z.string().optional(),
        description: z.string().optional(),
        punishment: z.string().optional(),
        statuteDocumentTitle: z.string().optional(),
      })),
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
    // Real intent classification, so "PPC 302" takes the exact section lookup
    // (statuteRef) and topic-mapped Acts instead of only the generic search.
    const dummyIntent = { ...classifyQueryIntent(query), needsCaseLaw: false, needsStatutes: true, needsAdminDocs: false };
    
    const retrievalResult = await runRetrieval(dummyIntent, userId, { statutes: safeLimit });
    const latency = Date.now() - t0;

    // Track usage metrics
    await logToolUsage(userId, "search-statutes", query);

    const payload = {
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
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(payload, null, 2),
        }
      ],
      structuredContent: payload,
    };
  });

  // 3. Get Judgment Detail
  server.registerTool("get_judgment", {
    description: "Retrieve the full text and headnotes of a specific judgment by its unique UUID, citation string, or caseLaw:N ID from search results. When sourceTable is 'case_law', full text may not be available. ASSISTANT INSTRUCTION: Use ONLY the text this tool returns; never supply a judgment body, holding, or quotation from memory. textIntegrity is one of 'own' (safe), 'mislabeled', 'unknown' or 'missing'. If 'textIntegrity' is 'mislabeled', the stored body is a DIFFERENT case - the one named in 'belongsTo' - so do not present it as this citation's judgment; tell the user and offer to fetch 'belongsTo' instead. If 'textIntegrity' is 'unknown', the stored body is not uniquely bound to this citation - say so and do not attribute its contents to the citation. If 'textIntegrity' is 'missing', state that no judgment text is stored. The judgment file is whatever this tool returns and nothing else. Link to a file ONLY via the returned 'pdfUrl' or 'sourceUrl', copied verbatim. If 'pdfUrl' is absent, state that no PDF is stored and offer 'sourceUrl' instead; never construct, guess, or complete a file URL, and never claim a PDF exists. If this tool errors, report that the judgment was not found rather than answering from memory.",
    inputSchema: {
      id: z.string().describe("The judgment UUID, citation string, or caseLaw:N ID from search results"),
    },
    outputSchema: {
      version: z.string(),
      source: z.string(),
      id: z.string(),
      citation: z.string(),
      title: z.string().optional(),
      courtName: z.string().optional(),
      decisionDate: z.string().optional(),
      headnotes: z.string().optional(),
      fullText: z.string().optional(),
      pdfUrl: z.string().optional(),
      sourceUrl: z.string().optional(),
      fileNote: z.string().optional(),
      textIntegrity: z.string().optional(),
      belongsTo: z.string().optional(),
      sharedWith: z.array(z.string()).optional(),
      textWarning: z.string().optional(),
      sourceTable: z.string().optional(),
      dataNote: z.string().optional(),
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

    // -------------------------------------------------------------------
    // Handle caseLaw: prefix — these come from search results where no
    // matching judgment UUID was found. Return the case_law row's metadata
    // honestly instead of fuzzy-matching to a wrong judgment.
    // -------------------------------------------------------------------
    if (targetId.startsWith("caseLaw:")) {
      const caseLawId = Number(targetId.replace("caseLaw:", ""));
      if (!Number.isInteger(caseLawId) || caseLawId <= 0) {
        throw new McpError(ErrorCode.InvalidRequest, `Invalid case law ID: ${targetId}`);
      }
      const [row] = await db.select()
        .from(caseLaw)
        .where(eq(caseLaw.id, caseLawId))
        .limit(1);
      if (!row) {
        throw new McpError(ErrorCode.InvalidRequest, `Case law record not found: ${targetId}`);
      }

      // Try one more time to find the matching judgment via citation
      let judgmentRow: { id: string; citation: string; title: string; headnotes: string | null; fullText: string; courtNameSnapshot: string | null; decisionDate: Date | null; pdfUrl: string | null; textStatus: string | null; textTrueCitation: string | null } | undefined;
      const judgmentSelect = {
        id: judgments.id,
        citation: judgments.citationString,
        title: judgments.title,
        headnotes: judgments.headnotes,
        fullText: judgments.fullText,
        courtNameSnapshot: judgments.courtNameSnapshot,
        decisionDate: judgments.decisionDate,
        pdfUrl: judgments.pdfUrl,
        textStatus: judgments.textStatus,
        textTrueCitation: judgments.textTrueCitation,
      };
      // Exact structured match only (year + journal + page unique index).
      judgmentRow = await resolveJudgment(row.citation, judgmentSelect);
      // NO LIKE fallback: search already decided this row had no exact
      // judgment match. Fuzzy-matching here is what returned a wrong
      // judgment's full text on "verify". Fall through to honest metadata.

      if (judgmentRow) {
        // Found a real judgment — return its full data
        await logToolUsage(userId, "search-judgments", `get_judgment:${judgmentRow.id}`);
        const textCheck = await assessJudgmentText(
          judgmentRow.id, judgmentRow.fullText, judgmentRow.textStatus, judgmentRow.textTrueCitation);
        const payload = {
          version: VERSION,
          source: SOURCE,
          id: judgmentRow.id,
          citation: judgmentRow.citation,
          title: judgmentRow.title,
          courtName: judgmentRow.courtNameSnapshot || row.court || "Pakistani Court",
          decisionDate: judgmentRow.decisionDate instanceof Date
            ? judgmentRow.decisionDate.toISOString().split("T")[0]
            : undefined,
          headnotes: judgmentRow.headnotes ?? undefined,
          fullText: judgmentRow.fullText ?? undefined,
          pdfUrl: judgmentRow.pdfUrl ?? undefined,
          sourceUrl: judgmentSourceUrl(judgmentRow.id),
          ...textCheck,
          fileNote: judgmentRow.pdfUrl ? undefined : "No PDF file is stored for this judgment. The authoritative record is the full text returned here; sourceUrl opens the same judgment on AlWakeelo. Do not claim a PDF exists or invent a download link.",
          sourceTable: "judgments" as const,
        };
        return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
      }

      // No matching judgment — return case_law metadata honestly
      await logToolUsage(userId, "search-judgments", `get_judgment:caseLaw:${caseLawId}`);
      const payload = {
        version: VERSION,
        source: SOURCE,
        id: targetId,
        citation: row.citation,
        title: row.title,
        courtName: row.court || "Pakistani Court",
        headnotes: row.summary || undefined,
        sourceTable: "case_law" as const,
        dataNote: "Full judgment text is not available for this record. The citation, title, court, and summary shown are from the case_law index. Verify citation independently before using in court filings.",
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
    }
    
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
    if (!isUuid) {
      // If it is a numeric ID from case_law table, resolve it to the citation string first
      if (/^\d+$/.test(targetId)) {
        const [caseLawRow] = await db.select({ citation: caseLaw.citation, title: caseLaw.title })
          .from(caseLaw)
          .where(eq(caseLaw.id, Number(targetId)))
          .limit(1);
        if (caseLawRow && caseLawRow.citation) {
          targetId = caseLawRow.citation;
        }
      }

      // Exact structured match (year + journal + page unique index),
      // falling back to exact normalized-string match.
      const resolvedRow: { id: string; title: string } | undefined =
        await resolveJudgment(targetId, { id: judgments.id, title: judgments.title });
      // NO LIKE %citation% fallback: a substring match returns an arbitrary
      // different judgment (wrong page/case). If exact normalized match
      // failed, fail loudly rather than hand back the wrong judgment.
      if (!resolvedRow) {
        throw new McpError(ErrorCode.InvalidRequest, `Judgment with ID or citation '${targetId}' not found (no exact citation match).`);
      }
      targetId = resolvedRow.id;
    }

    const detail = await storage.getJudgmentDetail(targetId);
    if (!detail) {
      throw new McpError(ErrorCode.InvalidRequest, `Judgment not found for ID: ${targetId}`);
    }

    // Track usage
    await logToolUsage(userId, "search-judgments", `get_judgment:${targetId}`);

    const [provenance] = await db.select({
      textStatus: judgments.textStatus,
      textTrueCitation: judgments.textTrueCitation,
    })
      .from(judgments)
      .where(eq(judgments.id, detail.id))
      .limit(1);

    const textCheck = await assessJudgmentText(
      detail.id, detail.fullText, provenance?.textStatus, provenance?.textTrueCitation);

    const payload = {
      version: VERSION,
      source: SOURCE,
      id: detail.id,
      citation: detail.citation,
      title: detail.title,
      courtName: detail.court || "Pakistani Court",
      decisionDate: detail.decisionDate instanceof Date
        ? detail.decisionDate.toISOString().split("T")[0]
        : (detail.decisionDate ?? undefined),
      headnotes: detail.headnotes ?? undefined,
      fullText: detail.fullText ?? undefined,
      pdfUrl: detail.pdfUrl ?? undefined,
      sourceUrl: judgmentSourceUrl(detail.id),
      ...textCheck,
      fileNote: detail.pdfUrl ? undefined : "No PDF file is stored for this judgment. The authoritative record is the full text returned here; sourceUrl opens the same judgment on AlWakeelo. Do not claim a PDF exists or invent a download link.",
      sourceTable: "judgments" as const,
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(payload, null, 2),
        }
      ],
      structuredContent: payload,
    };
  });

  // 4. Legal Research (Full Grounded RAG Pipeline)
  server.registerTool("legal_research", {
    description: "Perform deep, multi-stage legal research across AlWakeelo's full RAG context (intent analysis, Voyage Law-2 embeddings, reranker, citation validation, and parent-child chunk resolution). Returns the grounded text context injected into LLM system prompts, plus a per-citation verification report. ASSISTANT INSTRUCTION: The context is retrieved text and may contain citations that do not exist. Only cite a citation listed in `citations` with verified=true. Never repeat, complete or reconstruct an unverified citation — refer to that material descriptively without a citation, or call search_case_law instead.",
    inputSchema: {
      query: z.string().describe("The legal query, scenario description, or question to research"),
    },
    outputSchema: {
      version: z.string(),
      source: z.string(),
      retrieval_version: z.string(),
      query: z.string(),
      latencyMs: z.number(),
      context: z.string(),
      citations: z.array(z.object({
        citation: z.string(),
        verified: z.boolean(),
        judgmentId: z.string().optional(),
      })),
      unverifiedCitations: z.number(),
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

    // ---------------------------------------------------------------------
    // Citation verification.
    //
    // gatherKnowledgeContextV2 returns free retrieved text. Citations inside
    // it come from LLM-extracted case_law records and can be malformed or
    // invented. Check every citation-shaped token against the judgments
    // table and tell the assistant, inline and structurally, which ones are
    // real — otherwise the model cites whatever it reads in the blob.
    // ---------------------------------------------------------------------
    const rawCitations = extractCitations(contextString).slice(0, 40);
    const verifiedMap = await verifyCitations(rawCitations);
    const citations = rawCitations.map((c) => ({
      citation: c,
      verified: verifiedMap.has(c),
      judgmentId: verifiedMap.get(c),
    }));
    const unverified = citations.filter((c) => !c.verified).map((c) => c.citation);

    const banner = citations.length === 0
      ? "[CITATION VERIFICATION] No citations detected in this context. Do not introduce any citation of your own."
      : unverified.length === 0
        ? `[CITATION VERIFICATION] All ${citations.length} citation(s) in this context were matched to real judgment records and are safe to cite.`
        : `[CITATION VERIFICATION] ${unverified.length} of ${citations.length} citation(s) in this context could NOT be matched to any judgment record and may not exist: ${unverified.join("; ")}. DO NOT cite these. Use the material descriptively without a citation, or verify via search_case_law / get_judgment first.`;

    const payload = {
      version: VERSION,
      source: SOURCE,
      retrieval_version: RETRIEVAL_VERSION,
      query,
      latencyMs: latency,
      context: `${banner}\n\n${contextString}`,
      citations,
      unverifiedCitations: unverified.length,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(payload, null, 2),
        }
      ],
      structuredContent: payload,
    };
  });

  // 5. Search Judges Directory
  server.registerTool("search_judges", {
    description: "Search the Pakistani judges directory to find judges and see their statistics (case counts, courts, active years).",
    inputSchema: {
      search: z.string().optional().describe("Judge name to search for"),
      court: z.string().optional().describe("Filter by court (e.g. SC, LHC, SHC, IHC, PHC, BHC, FSC, or specific name)"),
      limit: z.number().optional().default(10).describe("Max results (default 10, max 50)"),
    },
    outputSchema: {
      version: z.string(),
      source: z.string(),
      total: z.number(),
      judges: z.array(z.object({
        name: z.string(),
        caseCount: z.number(),
        courts: z.array(z.string()),
        earliestYear: z.number().nullable().optional(),
        latestYear: z.number().nullable().optional(),
      })),
    },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
  }, async ({ search, court, limit }) => {
    const userId = getAuthenticatedUserId();
    const safeLimit = Math.min(50, Math.max(1, limit || 10));
    
    let courtFilter = (court || "").trim();
    if (courtFilter === "SC") courtFilter = "Supreme Court";
    else if (courtFilter === "LHC") courtFilter = "Lahore High Court";
    else if (courtFilter === "SHC") courtFilter = "Sindh High Court";
    else if (courtFilter === "IHC") courtFilter = "Islamabad High Court";
    else if (courtFilter === "PHC") courtFilter = "Peshawar High Court";
    else if (courtFilter === "BHC") courtFilter = "Balochistan High Court";
    else if (courtFilter === "FSC") courtFilter = "Federal Shariat Court";

    const conditions = [];
    if (search) conditions.push(ilike(judgeCaseLinks.judgeName, `%${search}%`));
    if (courtFilter && courtFilter !== "ALL") conditions.push(ilike(judgeCaseLinks.courtName, `%${courtFilter}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await db.select({ total: countDistinct(judgeCaseLinks.judgeName) })
      .from(judgeCaseLinks).where(whereClause);
    const total = countResult[0]?.total || 0;

    const rows = await db.select({
      name: judgeCaseLinks.judgeName,
      caseCount: count(judgeCaseLinks.id),
      courts: sql<string[]>`array_agg(DISTINCT ${judgeCaseLinks.courtName})`.as("courts"),
      earliestYear: sql<number>`MIN(${judgeCaseLinks.year})`.as("earliestYear"),
      latestYear: sql<number>`MAX(${judgeCaseLinks.year})`.as("latestYear"),
    })
    .from(judgeCaseLinks)
    .where(whereClause)
    .groupBy(judgeCaseLinks.judgeName)
    .orderBy(desc(count(judgeCaseLinks.id)), asc(judgeCaseLinks.judgeName))
    .limit(safeLimit);

    const payload = {
      version: VERSION,
      source: SOURCE,
      total,
      judges: rows.map((r: any) => ({
        name: r.name,
        caseCount: Number(r.caseCount) || 0,
        courts: r.courts || [],
        earliestYear: r.earliestYear,
        latestYear: r.latestYear,
      })),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  });

  // 6. Get Judge Profile
  server.registerTool("get_judge_profile", {
    description: "Get detailed profile and statistics for a specific Pakistani judge, including their recent landmark cases and judgments.",
    inputSchema: {
      name: z.string().describe("Exact name of the judge (use search_judges to find exact names)"),
    },
    outputSchema: {
      version: z.string(),
      source: z.string(),
      judge: z.object({
        name: z.string(),
        caseCount: z.number(),
        courts: z.array(z.string()),
        earliestYear: z.number().nullable().optional(),
        latestYear: z.number().nullable().optional(),
        recentCases: z.array(z.object({
          id: z.string(),
          citation: z.string(),
          title: z.string(),
          court: z.string().nullable().optional(),
          year: z.number().nullable().optional()
        }))
      })
    },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
  }, async ({ name }) => {
    const userId = getAuthenticatedUserId();

    const judgeStats = await db.select({
      name: judgeCaseLinks.judgeName,
      caseCount: count(judgeCaseLinks.id),
      courts: sql<string[]>`array_agg(DISTINCT ${judgeCaseLinks.courtName})`.as("courts"),
      earliestYear: sql<number>`MIN(${judgeCaseLinks.year})`.as("earliestYear"),
      latestYear: sql<number>`MAX(${judgeCaseLinks.year})`.as("latestYear"),
    })
    .from(judgeCaseLinks)
    .where(eq(judgeCaseLinks.judgeName, name))
    .groupBy(judgeCaseLinks.judgeName);

    if (judgeStats.length === 0) {
      throw new McpError(ErrorCode.InvalidRequest, `Judge not found: ${name}`);
    }

    const recentCases = await db.select({
      id: judgments.id,
      citation: judgments.citationString,
      title: judgments.title,
      court: judgments.courtNameSnapshot,
      year: judgments.year
    })
    .from(judgeCaseLinks)
    .innerJoin(judgments, eq(judgeCaseLinks.judgmentId, judgments.id))
    .where(eq(judgeCaseLinks.judgeName, name))
    .orderBy(desc(judgments.year), desc(judgments.id))
    .limit(10);

    const payload = {
      version: VERSION,
      source: SOURCE,
      judge: {
        name: judgeStats[0].name,
        caseCount: Number(judgeStats[0].caseCount) || 0,
        courts: judgeStats[0].courts || [],
        earliestYear: judgeStats[0].earliestYear,
        latestYear: judgeStats[0].latestYear,
        recentCases: recentCases.map((c: any) => ({
          id: c.id,
          citation: c.citation,
          title: c.title,
          court: c.court,
          year: c.year
        }))
      }
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  });

  // 7. Get Precedent Graph
  server.registerTool("get_precedent_graph", {
    description: "Fetch the citation network for a judgment: the cases it cites and the cases that cite it, with treatment (referred_to, relied_upon, distinguished, overruled). Accepts a judgment UUID or a citation string. Each edge is extracted from the text of its SOURCE judgment, so an edge is only as trustworthy as that judgment's text: edges whose source holds text that is not its own are returned with reliable=false and must not be used to argue precedent. ASSISTANT INSTRUCTION: Only rely on edges with reliable=true. If truncated is true the graph is incomplete - never conclude from it that a judgment was never overruled or distinguished; say the check was partial and offer to raise limit. Never state that one case cited, relied on, distinguished or overruled another on the strength of a reliable=false edge, and never assert a citation relationship this tool did not return.",
    inputSchema: {
      judgment: z.string().describe("The judgment UUID or citation string (e.g. '2013 PLD 793')"),
      limit: z.number().optional().default(50).describe("Maximum edges per direction (default 50, max 100)"),
    },
    outputSchema: {
      version: z.string(),
      source: z.string(),
      judgment: z.object({
        id: z.string(),
        citation: z.string(),
        title: z.string().optional(),
        textIntegrity: z.string().optional(),
      }),
      nodes: z.array(z.object({
        id: z.string(),
        citation: z.string(),
        title: z.string().nullable().optional(),
        year: z.number().nullable().optional(),
        court: z.string().nullable().optional(),
        textIntegrity: z.string().optional(),
      })),
      edges: z.array(z.object({
        source: z.string(),
        target: z.string(),
        treatment: z.string().nullable().optional(),
        reliable: z.boolean(),
        unreliableReason: z.string().optional(),
      })),
      unreliableEdges: z.number(),
      outgoingTotal: z.number(),
      incomingTotal: z.number(),
      truncated: z.boolean(),
      note: z.string().optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
  }, async ({ judgment, limit }) => {
    const userId = getAuthenticatedUserId();
    await enforceQuota(userId, "search-judgments");
    const safeLimit = Math.min(100, Math.max(1, limit));

    const target = String(judgment).trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);

    const rootSelect = {
      id: judgments.id,
      citation: judgments.citationString,
      title: judgments.title,
      textStatus: judgments.textStatus,
    };
    const root = isUuid
      ? (await db.select(rootSelect).from(judgments).where(eq(judgments.id, target)).limit(1))[0]
      : await resolveJudgment(target, rootSelect);

    if (!root) {
      throw new McpError(ErrorCode.InvalidRequest, `Judgment not found for '${target}' (no exact citation match).`);
    }

    await logToolUsage(userId, "search-judgments", `get_precedent_graph:${root.id}`);

    // An edge records "source cites target", and it was extracted from the
    // source judgment's stored text. If that text is not the source's own,
    // the edge really belongs to whichever judgment the text came from, so it
    // cannot be used to argue what THIS case cited.
    const edgeRow = {
      citationType: citationLinks.citationType,
      otherId: judgments.id,
      otherCitation: judgments.citationString,
      otherTitle: judgments.title,
      otherYear: judgments.year,
      otherCourt: judgments.courtNameSnapshot,
      otherStatus: judgments.textStatus,
    };

    // An unordered LIMIT drops edges in physical heap order. "overruled" is
    // 184 of 666,683 links and "distinguished" 1,308, so the tail that decides
    // whether a precedent still stands is exactly the tail an arbitrary cut
    // discards. Order by consequence, and report the totals so a truncated
    // graph can never read as a complete one.
    const byConsequence = sql`case ${citationLinks.citationType}
      when 'overruled' then 0 when 'distinguished' then 1
      when 'relied_upon' then 2 else 3 end`;

    const outgoing = await db.select(edgeRow)
      .from(citationLinks)
      .innerJoin(judgments, eq(judgments.id, citationLinks.targetJudgmentId))
      .where(eq(citationLinks.sourceJudgmentId, root.id))
      .orderBy(byConsequence)
      .limit(safeLimit);

    const incoming = await db.select(edgeRow)
      .from(citationLinks)
      .innerJoin(judgments, eq(judgments.id, citationLinks.sourceJudgmentId))
      .where(eq(citationLinks.targetJudgmentId, root.id))
      .orderBy(byConsequence)
      .limit(safeLimit);

    const [outTotal] = await db.select({ n: count() })
      .from(citationLinks).where(eq(citationLinks.sourceJudgmentId, root.id));
    const [inTotal] = await db.select({ n: count() })
      .from(citationLinks).where(eq(citationLinks.targetJudgmentId, root.id));
    const outgoingTotal = Number(outTotal?.n ?? outgoing.length);
    const incomingTotal = Number(inTotal?.n ?? incoming.length);
    const truncated = outgoingTotal > outgoing.length || incomingTotal > incoming.length;

    const nodes = new Map<string, any>();
    const edges: Array<{ source: string; target: string; treatment: string; reliable: boolean; unreliableReason?: string }> = [];
    const addNode = (r: any) => {
      if (nodes.has(String(r.otherId))) return;
      nodes.set(String(r.otherId), {
        id: String(r.otherId),
        citation: String(r.otherCitation),
        title: r.otherTitle ?? null,
        year: r.otherYear ?? null,
        court: r.otherCourt ?? null,
        textIntegrity: r.otherStatus ?? undefined,
      });
    };

    // Every edge names the root, so the root must be in nodes or the graph
    // references an id that does not exist in it.
    nodes.set(String(root.id), {
      id: String(root.id),
      citation: String(root.citation),
      title: root.title ?? null,
      year: null,
      court: null,
      textIntegrity: root.textStatus ?? undefined,
    });

    const rootTextIsOwn = root.textStatus === "own";
    for (const r of outgoing as any[]) {
      addNode(r);
      edges.push({
        source: String(root.id),
        target: String(r.otherId),
        treatment: String(r.citationType || "referred_to"),
        reliable: rootTextIsOwn,
        unreliableReason: rootTextIsOwn ? undefined
          : "This edge was extracted from text that is not this judgment's own, so it records what a different judgment cited.",
      });
    }
    for (const r of incoming as any[]) {
      addNode(r);
      const sourceOwn = r.otherStatus === "own";
      edges.push({
        source: String(r.otherId),
        target: String(root.id),
        treatment: String(r.citationType || "referred_to"),
        reliable: sourceOwn,
        unreliableReason: sourceOwn ? undefined
          : `The citing judgment ${r.otherCitation} holds text that is not its own, so this citation belongs to a different judgment.`,
      });
    }

    const unreliableEdges = edges.filter((e) => !e.reliable).length;
    const payload = {
      version: VERSION,
      source: SOURCE,
      judgment: {
        id: String(root.id),
        citation: String(root.citation),
        title: root.title ?? undefined,
        textIntegrity: root.textStatus ?? undefined,
      },
      nodes: [...nodes.values()],
      edges,
      unreliableEdges,
      outgoingTotal,
      incomingTotal,
      truncated,
      note: [
        unreliableEdges > 0
          ? `${unreliableEdges} of ${edges.length} edge(s) were extracted from a judgment whose stored text is not its own and are marked reliable=false. Do not use them to argue precedent.`
          : null,
        truncated
          ? `Only ${outgoing.length} of ${outgoingTotal} outgoing and ${incoming.length} of ${incomingTotal} incoming citations are shown, ordered so overruled and distinguished appear first. This graph is INCOMPLETE: do not state that this judgment has never been overruled or distinguished on the strength of it. Raise limit to see more.`
          : null,
      ].filter(Boolean).join(" ") || undefined,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  });

  // 8. Read Court Docket
  server.registerTool("read_court_docket", {
    description: "Read the court docket, agenda, and compliance watch for a specific date or date range.",
    inputSchema: {
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
    },
    outputSchema: {
      version: z.string(),
      source: z.string(),
      diaryEntries: z.array(z.any()),
      complianceDeadlines: z.array(z.any()),
    },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
  }, async ({ startDate, endDate }) => {
    const userId = getAuthenticatedUserId();
    const targetEnd = endDate || startDate;

    const entries = await db.select()
      .from(diaryEntries)
      .where(
        and(
          eq(diaryEntries.userId, userId),
          gte(diaryEntries.date, startDate),
          lte(diaryEntries.date, targetEnd)
        )
      )
      .orderBy(asc(diaryEntries.time));

    const compliance = await db.select()
      .from(caseCompliance)
      .where(
        and(
          gte(caseCompliance.dueDate, new Date(startDate)),
          lte(caseCompliance.dueDate, new Date(targetEnd + "T23:59:59"))
        )
      )
      .orderBy(asc(caseCompliance.dueDate));

    const payload = {
      version: VERSION,
      source: SOURCE,
      diaryEntries: entries,
      complianceDeadlines: compliance
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
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
    outputSchema: {
      version: z.string(),
      source: z.string(),
      latencyMs: z.number(),
      topic: z.string(),
      draft: z.string(),
    },
    annotations: {
      readOnlyHint: false, // saves the draft into the user's documents
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

    // Save draft directly to the documents table so it appears in the Editor and Word Add-in
    await db.insert(documents).values({
      userId,
      title: `Draft: ${topic}`,
      content: formattedText,
      sourceType: "mcp-draft",
      mimeType: "text/plain",
      detectedDomain: "legal",
      detectedDomainLabel: "Legal Draft",
      classificationMethod: "mcp-draft",
    });

    // Pre-wrap draft in a plaintext code block so MCP clients render it with exact alignment & no markdown parsing
    const wrappedDraft = `\`\`\`text\n${formattedText.replace(/^```(?:text|markdown)?\n?/i, "").replace(/\n?```$/i, "")}\n\`\`\``;

    const payload = {
      version: VERSION,
      source: SOURCE,
      latencyMs: latency,
      topic,
      draft: wrappedDraft,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(payload, null, 2),
        }
      ],
      structuredContent: payload,
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
    outputSchema: {
      version: z.string(),
      source: z.string(),
      latencyMs: z.number(),
      contractType: z.string(),
      draft: z.string(),
    },
    annotations: {
      readOnlyHint: false, // saves the draft into the user's documents
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

    // Save draft directly to the documents table so it appears in the Editor and Word Add-in
    await db.insert(documents).values({
      userId,
      title: `Contract: ${contractType}`,
      content: formattedText,
      sourceType: "mcp-draft",
      mimeType: "text/plain",
      detectedDomain: "legal",
      detectedDomainLabel: "Legal Draft",
      classificationMethod: "mcp-draft",
    });

    // Pre-wrap draft in a plaintext code block so MCP clients render it with exact alignment & no markdown parsing
    const wrappedDraft = `\`\`\`text\n${formattedText.replace(/^```(?:text|markdown)?\n?/i, "").replace(/\n?```$/i, "")}\n\`\`\``;

    const payload = {
      version: VERSION,
      source: SOURCE,
      latencyMs: latency,
      contractType,
      draft: wrappedDraft,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(payload, null, 2),
        }
      ],
      structuredContent: payload,
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
    outputSchema: {
      version: z.string(),
      source: z.string(),
      totalResults: z.number(),
      cases: z.array(z.object({
        id: z.number(),
        title: z.string(),
        caseType: z.string(),
        court: z.string().nullable().optional(),
        caseNumber: z.string().nullable().optional(),
        status: z.string(),
        priority: z.string(),
        referenceNo: z.string().nullable().optional(),
        createdAt: z.any().optional(),
      })),
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

    const payload = {
      version: VERSION,
      source: SOURCE,
      totalResults: rows.length,
      cases: rows.map((c: any) => ({
        id: c.id,
        title: c.title,
        caseType: c.caseType,
        court: c.court,
        caseNumber: c.caseNumber,
        status: c.status,
        priority: c.priority,
        referenceNo: c.referenceNo,
        createdAt: c.createdAt,
      })),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  });

  // 8. Get Case Details
  server.registerTool("get_case_details", {
    description: "Get complete details of a specific case file including clients, notes, and compliance checklist items.",
    inputSchema: {
      caseId: z.number().describe("The case file ID"),
    },
    outputSchema: {
      version: z.string(),
      source: z.string(),
      case: z.object({
        id: z.number(),
        title: z.string(),
        caseType: z.string(),
        court: z.string().nullable().optional(),
        caseNumber: z.string().nullable().optional(),
        status: z.string(),
        priority: z.string(),
        referenceNo: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        createdAt: z.any().optional(),
        updatedAt: z.any().optional(),
      }),
      clients: z.array(z.any()),
      notes: z.array(z.any()),
      compliance: z.array(z.any()),
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

    const payload = {
      version: VERSION,
      source: SOURCE,
      case: {
        id: caseFile.id,
        title: caseFile.title,
        caseType: caseFile.caseType,
        court: caseFile.court,
        caseNumber: caseFile.caseNumber,
        status: caseFile.status,
        priority: caseFile.priority,
        referenceNo: caseFile.referenceNo,
        description: caseFile.description,
        createdAt: caseFile.createdAt,
        updatedAt: caseFile.updatedAt,
      },
      clients: clients.map((c: any) => ({ id: c.id, role: c.role, name: c.name, phone: c.phone, cnic: c.cnic })),
      notes: notes.map((n: any) => ({ id: n.id, content: n.content, createdAt: n.createdAt })),
      compliance: compliance.map((c: any) => ({
        id: c.id,
        type: c.type,
        title: c.title,
        dueDate: c.dueDate,
        status: c.status,
        court: c.court,
        judge: c.judge,
      })),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
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
    outputSchema: {
      version: z.string(),
      source: z.string(),
      message: z.string(),
      case: z.object({
        id: z.number(),
        title: z.string(),
        caseType: z.string(),
        court: z.string().nullable().optional(),
        status: z.string(),
      }),
    },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  }, async ({ title, caseType, court, caseNumber, priority, description }) => {
    const userId = getAuthenticatedUserId();

    const [created] = await db.insert(caseFiles).values({
      userId, title, caseType, court, caseNumber, priority, description,
    }).returning();

    const payload = {
      version: VERSION,
      source: SOURCE,
      message: `Case file "${title}" created successfully.`,
      case: { id: created.id, title: created.title, caseType: created.caseType, court: created.court, status: created.status },
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  });

  // 10. Add Case Note
  server.registerTool("add_case_note", {
    description: "Add a progress note, hearing update, or log entry to an existing case file.",
    inputSchema: {
      caseId: z.number().describe("The case file ID to add the note to"),
      content: z.string().describe("The note content (e.g. 'Opponent requested adjournment. Next hearing fixed for arguments.')"),
    },
    outputSchema: {
      version: z.string(),
      source: z.string(),
      message: z.string(),
      note: z.object({
        id: z.number(),
        caseId: z.number(),
        content: z.string(),
        createdAt: z.any().optional(),
      }),
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

    const payload = {
      version: VERSION,
      source: SOURCE,
      message: "Note added successfully.",
      note: { id: note.id, caseId, content: note.content, createdAt: note.createdAt },
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
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
    outputSchema: {
      version: z.string(),
      source: z.string(),
      dateRange: z.object({ from: z.string(), to: z.string() }),
      totalEntries: z.number(),
      entries: z.array(z.object({
        id: z.number(),
        date: z.string(),
        time: z.string().nullable().optional(),
        title: z.string(),
        description: z.string().nullable().optional(),
        caseId: z.number().nullable().optional(),
        priority: z.string(),
        completed: z.boolean().nullable().optional(),
        outcome: z.string().nullable().optional(),
        nextDate: z.string().nullable().optional(),
      })),
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

    const payload = {
      version: VERSION,
      source: SOURCE,
      dateRange: { from: startDate, to: endDate },
      totalEntries: rows.length,
      entries: rows.map((e: any) => ({
        id: e.id,
        date: e.date,
        time: e.time,
        title: e.title,
        description: e.description,
        caseId: e.caseId,
        priority: e.priority,
        completed: e.completed,
        outcome: e.outcome,
        nextDate: e.nextDate,
      })),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
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
    outputSchema: {
      version: z.string(),
      source: z.string(),
      message: z.string(),
      entry: z.object({
        id: z.number(),
        date: z.string(),
        time: z.string().nullable().optional(),
        title: z.string(),
        priority: z.string(),
      }),
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

    const payload = {
      version: VERSION,
      source: SOURCE,
      message: `Diary entry "${title}" scheduled for ${date}.`,
      entry: { id: entry.id, date: entry.date, time: entry.time, title: entry.title, priority: entry.priority },
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
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
    outputSchema: {
      version: z.string(),
      source: z.string(),
      message: z.string(),
      updated: z.object({
        id: z.number(),
        completed: z.boolean().nullable().optional(),
        outcome: z.string().nullable().optional(),
        nextDate: z.string().nullable().optional(),
      }),
      followUpEntry: z.object({
        id: z.number(),
        date: z.string(),
        title: z.string(),
      }).nullable().optional(),
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

    const payload = {
      version: VERSION,
      source: SOURCE,
      message: `Diary entry #${entryId} updated.`,
      updated: { id: updated.id, completed: updated.completed, outcome: updated.outcome, nextDate: updated.nextDate },
      followUpEntry: followUp,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
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
    outputSchema: {
      version: z.string(),
      source: z.string(),
      message: z.string(),
      status: z.string(),
      document: z.object({
        id: z.number(),
        fileName: z.string(),
        label: z.string(),
        mimeType: z.string(),
        sizeBytes: z.number(),
        storedInR2: z.boolean(),
        status: z.string(),
      }),
      case: z.object({ id: z.number(), title: z.string() }),
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
          }).catch((err: any) => console.error(`[MCP Upload Background] Failed to save documentFiles for Doc #${doc.id}:`, err));
          console.log(`[MCP Upload Background] Successfully synced Doc #${doc.id} (${fileName}) to R2.`);
        } else {
          console.warn(`[MCP Upload Background] R2 upload retries exhausted for Doc #${doc.id}. Document saved in DB only.`);
        }
      } catch (err) {
        console.error(`[MCP Upload Background] Error during R2 sync for Doc #${doc.id}:`, err);
      }
    })();

    const payload = {
      version: VERSION,
      source: SOURCE,
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
    };

    // 4. Return instant HTTP response (<200ms) to MCP client
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  });

  // 15. Request Document Upload Link (Zero Token Waste 1-Click Upload)
  server.registerTool("request_document_upload", {
    description: "PRIMARY DOCUMENT TOOL FOR ALL FILES & PDFs: Generates a secure, 1-click signed upload link for the user to upload any document, PDF, scan, or photo to a case file without consuming LLM quota (<30 tokens). ASSISTANT INSTRUCTION: Always present the returned uploadUrl to the user as a clear markdown link: '[Click here to upload document](uploadUrl)'.",
    inputSchema: {
      caseId: z.number().describe("The target case file ID to attach the document to"),
      label: z.string().optional().describe("Document label (e.g. 'FIR Copy', 'Medical Report', 'Power of Attorney')"),
    },
    outputSchema: {
      version: z.string(),
      uploadUrl: z.string(),
    },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  }, async ({ caseId, label }) => {
    const userId = getAuthenticatedUserId();
    try {
      const sessionId = await createSignedUploadSession(userId, caseId, label);
      const uploadUrl = `https://www.alwakeelo.com/upload/session/${sessionId}`;
      const payload = {
        version: VERSION,
        uploadUrl,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
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
