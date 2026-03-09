import type { Express, NextFunction, Request } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { insertBookmarkSchema, insertSearchHistorySchema, statutes, caseLaw, threads, TIER_LIMITS } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db, dbAvailable } from "./db";
import { requireDatabase } from "./middleware/db-guard";
import { syncGithubKnowledge } from "./github-sync";
import { queueAutoExtraction, nlpExtractCases } from "./auto-extract-caselaw";
import crypto from "crypto";
import multer from "multer";
import { isApexAvailable, getApexModelsForTier, chatWithApex, transcribeWithApex, type ApexModel } from "./apex-ai";
import { chatWithOpenRouter, streamWithOpenRouter, isOpenRouterAvailable, getOpenRouterModelName } from "./openrouter";
import { chatWithGroq, streamWithGroq, isGroqAvailable, getGroqModelName, transcribeWithGroq } from "./groq-ai";
import { chatWithDeepSeek, chatWithDeepSeekPro, streamWithDeepSeek, transcribeWithDeepSeek, isDeepSeekAvailable, getDeepSeekModelName, getDeepSeekProModelName } from "./deepseek-ai";
import { getModuleProfile, normalizeModuleType, type ModuleIntent, type ModuleType } from "./ai-module-profiles";
import { banUser, getAuditLogs, getUserBan, getUserBanMap, isUserBanned, logAuditEvent, unbanUser } from "./security-governance";
import { scanUploadedBuffer } from "./file-scan";
import { getSecurityEvents, recordSecurityEvent } from "./security-monitoring";
import { classifyDocumentMetadata, type DocumentMetadata } from "./document-classifier";
import { generateClauseFromPrompt, suggestClauses } from "./retrieval/clause-library";
import { extractTocFromText } from "./retrieval/toc-parser";
import { citationExtractor } from "./services/citation-extractor";
import { buildRagContext, deleteDocumentVectors, ensureIndexedForUserDocuments, indexUserDocument, retrieveForQuery } from "./rag/rag-service";
import { isPdfOcrAvailable } from "./ocr";
import { isCloudPdfOcrAvailable, ocrPdfWithCloud } from "./cloud-ocr";
import { isWhisperCppConfigured, transcribeWithWhisperCpp } from "./whisper-local";
import { deleteR2Object, getR2ObjectBinary, getR2ObjectText, uploadBufferToR2 } from "./r2-storage";
import { getEmailProviderStatus, sendResendTestEmail } from "./email";
import {
  backfillStyleMemoryFromSavedDrafts,
  getOrCreateStyleMemorySettings,
  getStyleMemoryQueueStats,
  ingestStyleSample,
  isStyleMemoryModule,
  recordAcceptedRedlineStyleEvent,
  retrieveStyleContextForGeneration,
  updateStyleMemorySettings,
} from "./style-memory";
import {
  extractDocxTextGuarded,
  extractPdfOcrGuarded,
  extractPdfTextGuarded,
  getExtractionQueueStats,
  isExtractionQueueFullError,
} from "./extraction-guard";


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
  "google/gemini-2.0-flash-001": { input: 0.0001, output: 0.0004 },
};

const INLINE_DB_CONTENT_LIMIT = Math.max(5000, Number(process.env.DB_INLINE_CONTENT_MAX_CHARS || 60000));
const MB = 1024 * 1024;
const DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES = Math.max(5, Number(process.env.DOCUMENT_UPLOAD_MAX_FILE_MB || 75)) * MB;
const DOCUMENT_UPLOAD_MAX_FILES = Math.max(1, Number(process.env.DOCUMENT_UPLOAD_MAX_FILES || 25));
const ADMIN_UPLOAD_MAX_FILE_SIZE_BYTES = Math.max(5, Number(process.env.ADMIN_UPLOAD_MAX_FILE_MB || 75)) * MB;
const ADMIN_UPLOAD_MAX_FILES = Math.max(1, Number(process.env.ADMIN_UPLOAD_MAX_FILES || 200));
const GENERAL_UPLOAD_MAX_FILE_SIZE_BYTES = Math.max(2, Number(process.env.GENERAL_UPLOAD_MAX_FILE_MB || 75)) * MB;
const EXTRACTION_TIMEOUT_MS = Math.max(3000, Number(process.env.EXTRACTION_TIMEOUT_MS || 120000));
const UPLOAD_QUEUE_CONCURRENCY = Math.max(1, Number(process.env.UPLOAD_QUEUE_CONCURRENCY || 2));
const UPLOAD_QUEUE_MAX_PENDING = Math.max(UPLOAD_QUEUE_CONCURRENCY, Number(process.env.UPLOAD_QUEUE_MAX_PENDING || 32));
const CASELAW_AUTO_SYNC_MAX = Math.max(1, Number(process.env.CASELAW_AUTO_SYNC_MAX || 500));
const STYLE_MEMORY_ENABLED = String(process.env.STYLE_MEMORY_ENABLED || "true").toLowerCase() !== "false";
const STYLE_CONTEXT_MIN_CONFIDENCE = Math.max(0, Number(process.env.STYLE_CONTEXT_MIN_CONFIDENCE || 0.56));
const STYLE_PROMPT_TOKEN_BUDGET = Math.max(200, Number(process.env.STYLE_PROMPT_TOKEN_BUDGET || 900));
const KNOWLEDGE_PROMPT_TOKEN_BUDGET = Math.max(400, Number(process.env.KNOWLEDGE_PROMPT_TOKEN_BUDGET || 1800));
const ATTACHMENT_PROMPT_TOKEN_BUDGET = Math.max(500, Number(process.env.ATTACHMENT_PROMPT_TOKEN_BUDGET || 2200));
const ATTACHMENT_FILE_TOKEN_BUDGET = Math.max(150, Number(process.env.ATTACHMENT_FILE_TOKEN_BUDGET || 800));
const LEGAL_DRAFT_DOC_PREFIX = "Legal Draft:";
const CONTRACT_DRAFT_DOC_PREFIX = "Contract Draft:";
const PUBLIC_CHAT_MESSAGE_LIMIT = Math.max(1, Number(process.env.PUBLIC_CHAT_MESSAGE_LIMIT || 10));
const PUBLIC_CHAT_WINDOW_HOURS = Math.max(1, Number(process.env.PUBLIC_CHAT_WINDOW_HOURS || 24));
const PUBLIC_CHAT_MAX_INPUT_CHARS = Math.max(300, Number(process.env.PUBLIC_CHAT_MAX_INPUT_CHARS || 2000));
const PUBLIC_LEAD_MAX_DESCRIPTION_CHARS = Math.max(500, Number(process.env.PUBLIC_LEAD_MAX_DESCRIPTION_CHARS || 6000));
const PUBLIC_LEAD_MAX_CITY_CHARS = Math.max(20, Number(process.env.PUBLIC_LEAD_MAX_CITY_CHARS || 80));
const PUBLIC_LEAD_MAX_CALLBACK_CHARS = Math.max(20, Number(process.env.PUBLIC_LEAD_MAX_CALLBACK_CHARS || 120));
const PUBLIC_CHAT_LIMIT_MESSAGE = "You have reached the free AI consultation limit. For professional legal assistance you can contact our chamber or hire a lawyer.";
const PUBLIC_CHAT_SYSTEM_PROMPT = `You are the AI legal intake assistant for AlWakeelo Law Chamber.

Your responsibilities are:

Understand the user's legal issue.

Provide general legal information.

Ask clarifying questions if needed.

Do not give definitive legal judgments.

Encourage the user to consult a professional lawyer.

Always end responses by suggesting that the user may contact the chamber or hire a lawyer for professional assistance.

Language policy (strict):
- Reply only in English, Urdu script, or Roman Urdu.
- Never reply in Hindi.
- Never use Devanagari script.
- If user writes in Urdu script, reply in Urdu script.
- If user writes in Roman Urdu, reply in Roman Urdu.
- If user writes in English, reply in English.`;
const PUBLIC_CHAT_CLOSING_LINES = {
  english: "For professional legal assistance, you may contact the chamber or hire a lawyer.",
  romanUrdu: "Professional qanooni madad ke liye aap chamber se rabta karein ya lawyer hire karein.",
  urdu: "پیشہ ورانہ قانونی مدد کے لیے آپ چیمبر سے رابطہ کریں یا وکیل ہائر کریں۔",
} as const;
const PUBLIC_CHAT_CASE_NUDGE = {
  english: "This appears to be a legal matter that may require professional legal review. If you would like, you can submit your case details and our chamber can review it.",
  romanUrdu: "Yeh masla professional qanooni review ka mutaliba karta hai. Agar aap chahein to apne case ki tafseel submit karein, hamara chamber is ka review karega.",
  urdu: "یہ معاملہ پیشہ ورانہ قانونی جائزے کا تقاضا کرتا ہے۔ اگر آپ چاہیں تو اپنے کیس کی تفصیل جمع کروائیں، ہمارا چیمبر اس کا جائزہ لے گا۔",
} as const;

let activeUploadRequests = 0;
const pendingUploadResolvers: Array<() => void> = [];

function getVisitorIpAddress(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const firstForwarded = typeof forwardedValue === "string" ? forwardedValue.split(",")[0]?.trim() : "";
  const socketIp = (req.socket?.remoteAddress || "").trim();
  const raw = firstForwarded || socketIp || "unknown";
  return raw.startsWith("::ffff:") ? raw.slice(7) : raw;
}

function sanitizeInputText(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\0/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, Math.max(1, maxLen));
}

function sanitizeTelemetryMetadata(input: unknown): Record<string, string | number | boolean | null> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, string | number | boolean | null> = {};
  const entries = Object.entries(input as Record<string, unknown>).slice(0, 12);
  for (const [rawKey, rawValue] of entries) {
    const key = sanitizeInputText(rawKey, 40).replace(/\s+/g, "_");
    if (!key) continue;
    if (typeof rawValue === "string") {
      out[key] = sanitizeInputText(rawValue, 240);
      continue;
    }
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      out[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "boolean") {
      out[key] = rawValue;
      continue;
    }
    out[key] = rawValue == null ? null : sanitizeInputText(String(rawValue), 240);
  }
  return out;
}

function normalizeSiteBaseUrl(req: Request): string {
  const configured = String(process.env.PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_URL || "").trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0]?.trim();
  const proto = forwardedProto || req.protocol || "https";
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0]?.trim();
  const host = forwardedHost || req.get("host") || "localhost";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text || "");
}

function hasUrduScript(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text || "");
}

function looksLikeRomanizedSouthAsian(text: string): boolean {
  const normalized = (text || "").toLowerCase();
  if (!/[a-z]/.test(normalized)) return false;
  const hints = [
    "agar", "aap", "aapko", "ghatna", "madad", "bataiye", "yad", "rakhein", "zaroorat", "sakta", "kya", "hai", "hain", "nahi", "kyun", "vakil", "wakil", "qanoon", "masla", "mujhe", "mera", "meri",
  ];
  return hints.some((h) => normalized.includes(h));
}

function resolvePublicChatLanguage(input: string): "english" | "romanUrdu" | "urdu" {
  if (hasUrduScript(input)) return "urdu";
  if (looksLikeRomanizedSouthAsian(input)) return "romanUrdu";
  return "english";
}

function ensurePublicChatClosingLine(text: string, language: "english" | "romanUrdu" | "urdu"): string {
  const closingLine = PUBLIC_CHAT_CLOSING_LINES[language];
  const normalized = (text || "").trim();
  if (!normalized) return closingLine;
  const lowered = normalized.toLowerCase();
  if (
    (language === "english" && (lowered.includes("contact the chamber") || lowered.includes("hire a lawyer"))) ||
    (language === "romanUrdu" && (lowered.includes("chamber se rabta") || lowered.includes("lawyer hire"))) ||
    (language === "urdu" && (normalized.includes("چیمبر") || normalized.includes("وکیل")))
  ) {
    return normalized;
  }
  return `${normalized}\n\n${closingLine}`;
}

async function rewritePublicChatOutput(args: {
  content: string;
  targetLanguage: "english" | "romanUrdu" | "urdu";
  provider: "groq" | "openrouter";
}): Promise<string> {
  const languageLabel =
    args.targetLanguage === "romanUrdu"
      ? "Roman Urdu (Latin script Urdu)"
      : args.targetLanguage === "urdu"
        ? "Urdu script"
        : "English";
  const scriptRule =
    args.targetLanguage === "english"
      ? "- Output only in English."
      : args.targetLanguage === "urdu"
        ? "- Output only in Urdu script."
        : "- Output only in Roman Urdu (Latin Urdu), not Hindi transliteration.";
  const rewriteMessages = [
    {
      role: "system" as const,
      content:
        "You are a legal response language normalizer. Rewrite only. Keep legal meaning intact. Strictly avoid Hindi and Devanagari script.",
    },
    {
      role: "user" as const,
      content: `Rewrite the following in ${languageLabel}.\nRules:\n${scriptRule}\n- No Hindi.\n- No Devanagari script.\n- Keep it concise and professional.\n- Output only rewritten text.\n\nText:\n${args.content}`,
    },
  ];
  if (args.provider === "openrouter") {
    const rewritten = await chatWithOpenRouter({
      messages: rewriteMessages,
      model: "deepseek-chat",
      maxTokens: 700,
      temperature: 0.1,
    });
    return rewritten.content || "";
  }
  const rewritten = await chatWithGroq({
    messages: rewriteMessages,
    model: "openai/gpt-oss-120b",
    maxTokens: 700,
    temperature: 0.1,
  });
  return rewritten.content || "";
}

function getPublicChatLanguageFallback(language: "english" | "romanUrdu" | "urdu"): string {
  if (language === "urdu") {
    return "آپ کے سوال کے مطابق جواب اردو میں فراہم کیا جا رہا ہے۔ برائے پیشہ ورانہ قانونی مدد چیمبر سے رابطہ کریں یا وکیل ہائر کریں۔";
  }
  if (language === "romanUrdu") {
    return "Aap ke sawal ke mutabiq jawab Roman Urdu mein diya ja raha hai. Professional qanooni madad ke liye chamber se rabta karein ya lawyer hire karein.";
  }
  return "Your response is being provided in English as requested. For professional legal assistance, please contact the chamber or hire a lawyer.";
}

function getUploadQueueStats() {
  return {
    active: activeUploadRequests,
    queued: pendingUploadResolvers.length,
    concurrency: UPLOAD_QUEUE_CONCURRENCY,
    maxPending: UPLOAD_QUEUE_MAX_PENDING,
  };
}

function normalizeTextForStorage(text: string): string {
  return (text || "").replace(/\0/g, "");
}

function cloneUploadFile(file: Express.Multer.File): Express.Multer.File {
  return {
    ...file,
    buffer: Buffer.from(file.buffer),
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function trimTextToTokenBudget(text: string, maxTokens: number): string {
  const safe = text || "";
  const maxChars = Math.max(200, maxTokens * 4);
  if (safe.length <= maxChars) return safe;
  return `${safe.slice(0, maxChars)}...`;
}

function mapModuleTypeToStyleModule(moduleType: ModuleType): "legal-drafting" | "contract-drafting" | null {
  if (moduleType === "draft") return "legal-drafting";
  if (moduleType === "contract-drafting") return "contract-drafting";
  return null;
}

function shouldApplyStyleForChat(moduleType: ModuleType, moduleIntent?: ModuleIntent): boolean {
  if (moduleType === "draft") {
    if (!moduleIntent) return true;
    return moduleIntent !== "draft.riskScan";
  }
  if (moduleType === "contract-drafting") {
    return moduleIntent === "contract.generateDraft" || moduleIntent === "contract.clauseSuggest" || moduleIntent === "contract.redline";
  }
  return false;
}

function resolveDraftModuleFromDocumentTitle(title: string): "legal-drafting" | "contract-drafting" | null {
  const normalized = (title || "").trim();
  if (normalized.startsWith(LEGAL_DRAFT_DOC_PREFIX)) return "legal-drafting";
  if (normalized.startsWith(CONTRACT_DRAFT_DOC_PREFIX)) return "contract-drafting";
  return null;
}

function estimateCost(model: string, inputText: string, outputText: string): number {
  const rates = COST_PER_1K_TOKENS[model] || COST_PER_1K_TOKENS["gemini-3-flash-preview"];
  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(outputText);
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}

function toApiDocument(doc: any) {
  return {
    ...doc,
    classificationConfidence: Number.isFinite(doc?.classificationConfidence)
      ? Number(doc.classificationConfidence) / 100
      : 0,
  };
}

function parsePagination(req: Request, options?: { defaultLimit?: number; maxLimit?: number }) {
  const defaultLimit = options?.defaultLimit ?? 50;
  const maxLimit = options?.maxLimit ?? 200;
  const limitRaw = Number(req.query.limit);
  const offsetRaw = Number(req.query.offset);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(maxLimit, Math.floor(limitRaw))) : defaultLimit;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;
  return { limit, offset };
}

function toMbText(bytes: number): string {
  return `${Math.round(bytes / MB)}MB`;
}

function sendExtractionBusy(res: any) {
  const queue = getExtractionQueueStats();
  return res.status(503).json({
    message: `Extraction queue is busy (${queue.active} active, ${queue.queued} queued). Retry shortly.`,
    queue,
  });
}

function releaseUploadSlot() {
  activeUploadRequests = Math.max(0, activeUploadRequests - 1);
  while (activeUploadRequests < UPLOAD_QUEUE_CONCURRENCY && pendingUploadResolvers.length > 0) {
    const resume = pendingUploadResolvers.shift();
    if (!resume) continue;
    activeUploadRequests += 1;
    resume();
  }
}

function createUploadQueueMiddleware(label: string) {
  return (req: Request, res: any, next: NextFunction) => {
    const begin = () => {
      let released = false;
      const cleanup = () => {
        if (released) return;
        released = true;
        releaseUploadSlot();
      };
      res.once("finish", cleanup);
      res.once("close", cleanup);
      next();
    };

    if (activeUploadRequests < UPLOAD_QUEUE_CONCURRENCY) {
      activeUploadRequests += 1;
      begin();
      return;
    }

    if (pendingUploadResolvers.length >= UPLOAD_QUEUE_MAX_PENDING) {
      return res.status(503).json({
        message: `Upload queue is full for ${label}. Retry shortly.`,
        queue: getUploadQueueStats(),
      });
    }

    pendingUploadResolvers.push(begin);
  };
}

function compactContentForDb(content: string): { inlineContent: string; wasTruncated: boolean } {
  const normalized = normalizeTextForStorage(content || "");
  if (normalized.length <= INLINE_DB_CONTENT_LIMIT) {
    return { inlineContent: normalized, wasTruncated: false };
  }
  const marker = `\n\n[Content truncated for DB storage at ${INLINE_DB_CONTENT_LIMIT.toLocaleString()} characters; full text stored in R2]`;
  const maxBase = Math.max(0, INLINE_DB_CONTENT_LIMIT - marker.length);
  return {
    inlineContent: `${normalized.slice(0, maxBase)}${marker}`,
    wasTruncated: true,
  };
}

async function uploadExtractedTextToR2(args: {
  text: string;
  fileName: string;
  prefix: string;
  metadata: Record<string, string>;
}): Promise<string | null> {
  const text = normalizeTextForStorage(args.text || "");
  if (!text) return null;
  const base = (args.fileName || "document").replace(/\.[^.]+$/, "");
  const fileName = `${base}.extracted.txt`;
  const r2 = await uploadBufferToR2({
    buffer: Buffer.from(text, "utf-8"),
    fileName,
    contentType: "text/plain; charset=utf-8",
    prefix: args.prefix,
    metadata: {
      ...args.metadata,
      extracted_text: "true",
    },
  });
  return r2?.objectKey || null;
}

async function uploadAdminKnowledgeFileToR2(args: {
  docId: number;
  userId: string;
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  source: string;
  extractedTextKey?: string | null;
}) {
  const r2Upload = await uploadBufferToR2({
    buffer: args.buffer,
    fileName: args.fileName,
    contentType: args.mimeType,
    prefix: `admin-knowledge/${args.userId}`,
    metadata: {
      user_id: args.userId,
      source: args.source,
      admin_knowledge_id: String(args.docId),
    },
  });

  if (!r2Upload) return;

  try {
    await storage.upsertAdminKnowledgeFile({
      adminKnowledgeId: args.docId,
      userId: args.userId,
      provider: r2Upload.provider,
      bucket: r2Upload.bucket,
      objectKey: r2Upload.objectKey,
      extractedTextKey: args.extractedTextKey ?? null,
      originalFilename: args.fileName,
      mimeType: args.mimeType || null,
      sizeBytes: args.sizeBytes ?? null,
      etag: r2Upload.etag,
      publicUrl: r2Upload.publicUrl,
    });
  } catch (r2MetaErr: any) {
    console.warn("[R2] Failed to persist admin knowledge file metadata:", r2MetaErr?.message || r2MetaErr);
  }
}

async function uploadStatuteDocumentFileToR2(args: {
  docId: number;
  userId: string;
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  extractedTextKey?: string | null;
}) {
  const r2Upload = await uploadBufferToR2({
    buffer: args.buffer,
    fileName: args.fileName,
    contentType: args.mimeType,
    prefix: `admin-statute/${args.userId}`,
    metadata: {
      user_id: args.userId,
      source: "admin-statute",
      statute_document_id: String(args.docId),
    },
  });

  if (!r2Upload) return;

  try {
    await storage.upsertStatuteDocumentFile({
      statuteDocumentId: args.docId,
      userId: args.userId,
      provider: r2Upload.provider,
      bucket: r2Upload.bucket,
      objectKey: r2Upload.objectKey,
      extractedTextKey: args.extractedTextKey ?? null,
      originalFilename: args.fileName,
      mimeType: args.mimeType || null,
      sizeBytes: args.sizeBytes ?? null,
      etag: r2Upload.etag,
      publicUrl: r2Upload.publicUrl,
    });
  } catch (r2MetaErr: any) {
    console.warn("[R2] Failed to persist statute document file metadata:", r2MetaErr?.message || r2MetaErr);
  }
}

function buildMessages(systemPrompt: string, contents: Array<{ role: string; parts: Array<{ text: string }> }>): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  return [
    { role: "system", content: systemPrompt },
    ...contents.map(c => ({
      role: (c.role === "model" ? "assistant" : "user") as "user" | "assistant",
      content: c.parts.map(p => p.text).join("\n"),
    })),
  ];
}

const MODEL_TIMEOUT_MS = {
  standardPrimary: 9000,
  standardFallback: 12000,
  turboPrimary: 9000,
  turboFallback: 12000,
  apexPrimary: 12000,
  apexFallback: 15000,
};

type TimeoutProfile = "default" | "search" | "analysis";
type TimeoutConfig = {
  standardPrimary: number;
  standardFallback: number;
  turboPrimary: number;
  turboFallback: number;
};

const MODEL_TIMEOUT_PROFILES: Record<TimeoutProfile, TimeoutConfig> = {
  default: {
    standardPrimary: MODEL_TIMEOUT_MS.standardPrimary,
    standardFallback: MODEL_TIMEOUT_MS.standardFallback,
    turboPrimary: MODEL_TIMEOUT_MS.turboPrimary,
    turboFallback: MODEL_TIMEOUT_MS.turboFallback,
  },
  search: {
    standardPrimary: 7000,
    standardFallback: 9000,
    turboPrimary: 7500,
    turboFallback: 9500,
  },
  analysis: {
    standardPrimary: 11000,
    standardFallback: 14000,
    turboPrimary: 11000,
    turboFallback: 14000,
  },
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function withTimeout<T>(label: string, ms: number, fn: () => Promise<T>): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const timeoutErr = new Error(`${label} timed out after ${ms}ms`);
      (timeoutErr as any).code = "MODEL_TIMEOUT";
      reject(timeoutErr);
    }, ms);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function logModelSwitch(mode: string, fromModel: string, toModel: string, err: unknown) {
  console.log(`[AI Routing][${mode}] Switching ${fromModel} -> ${toModel}. Reason: ${getErrorMessage(err)}`);
}

async function callStandardAI(
  systemPrompt: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  maxTokens: number,
  options?: { timeoutProfile?: TimeoutProfile; temperature?: number },
): Promise<{ text: string; model: string }> {
  const timeoutConfig = MODEL_TIMEOUT_PROFILES[options?.timeoutProfile || "default"] || MODEL_TIMEOUT_PROFILES.default;
  const temperature = Number.isFinite(options?.temperature) ? Number(options?.temperature) : 0.7;
  const messages = buildMessages(systemPrompt, contents);
  const startedAt = Date.now();
  try {
    const result = await withTimeout("Groq", timeoutConfig.standardPrimary, () => chatWithGroq({ messages, maxTokens, temperature }));
    console.log(`[AI Routing][standard] Primary Groq succeeded in ${Date.now() - startedAt}ms`);
    return { text: result.content, model: result.model };
  } catch (groqErr) {
    if (isOpenRouterAvailable()) {
      try {
        logModelSwitch("standard", "Groq", "OpenRouter", groqErr);
        const result = await withTimeout("OpenRouter", timeoutConfig.standardFallback, () => chatWithOpenRouter({ messages, maxTokens, temperature }));
        console.log(`[AI Routing][standard] Fallback OpenRouter succeeded in ${Date.now() - startedAt}ms`);
        return { text: result.content, model: result.model };
      } catch (orErr) {
        console.log("[AI Routing][standard] OpenRouter fallback failed:", getErrorMessage(orErr));
      }
    }
    throw groqErr;
  }
}

async function callTurboAI(
  systemPrompt: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  maxTokens: number,
  options?: { timeoutProfile?: TimeoutProfile; temperature?: number },
): Promise<{ text: string; model: string }> {
  const timeoutConfig = MODEL_TIMEOUT_PROFILES[options?.timeoutProfile || "default"] || MODEL_TIMEOUT_PROFILES.default;
  const temperature = Number.isFinite(options?.temperature) ? Number(options?.temperature) : 0.7;
  const messages = buildMessages(systemPrompt, contents);
  const startedAt = Date.now();
  try {
    const result = await withTimeout("DeepSeek", timeoutConfig.turboPrimary, () => chatWithDeepSeek({ messages, maxTokens, temperature }));
    console.log(`[AI Routing][turbo] Primary DeepSeek succeeded in ${Date.now() - startedAt}ms`);
    return { text: result.content, model: result.model };
  } catch (dsErr) {
    if (isGroqAvailable()) {
      logModelSwitch("turbo", "DeepSeek", "Groq", dsErr);
      const result = await withTimeout("Groq", timeoutConfig.turboFallback, () => chatWithGroq({ messages, maxTokens, temperature }));
      console.log(`[AI Routing][turbo] Fallback Groq succeeded in ${Date.now() - startedAt}ms`);
      return { text: result.content, model: result.model };
    }
    throw dsErr;
  }
}

async function callStandardAISimple(
  systemPrompt: string,
  userText: string,
  maxTokens: number,
  options?: { timeoutProfile?: TimeoutProfile; temperature?: number },
): Promise<{ text: string; model: string }> {
  return callStandardAI(systemPrompt, [{ role: "user", parts: [{ text: userText }] }], maxTokens, options);
}

type ChatRouteMode = "standard" | "turbo";

function normalizeTier(tierRaw: string | undefined | null): "standard" | "pro" | "chamber" | "enterprise" {
  const tier = String(tierRaw || "standard").toLowerCase();
  if (tier === "pro" || tier === "chamber" || tier === "enterprise") return tier;
  if (tier === "free") return "standard";
  return "standard";
}

function getTierPlan(tierRaw: string | undefined | null) {
  const tier = normalizeTier(tierRaw);
  return TIER_LIMITS[tier] || TIER_LIMITS.standard;
}

function isTurboAllowedForTier(tierRaw: string | undefined | null): boolean {
  const tierPlan = getTierPlan(tierRaw);
  return Boolean(tierPlan.modeAccess?.turbo);
}

function isApexAllowedForTier(tierRaw: string | undefined | null): boolean {
  const tierPlan = getTierPlan(tierRaw);
  return Boolean(tierPlan.modeAccess?.apex);
}

function getModeOutputCap(tierRaw: string | undefined | null, mode: "standard" | "turbo" | "apex"): number {
  const tierPlan = getTierPlan(tierRaw);
  const cap = tierPlan.maxOutputTokens?.[mode] || 0;
  return Math.max(0, Number(cap) || 0);
}

function resolveModuleRoute(modePrimary: ChatRouteMode, modeFallback: ChatRouteMode, userTier: string) {
  const turboPermitted = isTurboAllowedForTier(userTier) && isDeepSeekAvailable();
  if (modePrimary === "turbo" && !turboPermitted) {
    return { route: modeFallback, downgraded: true as const };
  }
  return { route: modePrimary, downgraded: false as const };
}

function extractJsonObject(raw: string): string | null {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return cleaned.slice(start, end + 1);
  return null;
}

function ensureAlWakeeloReferencesBlock(content: string): string {
  const refsRegex = /```references\s*([\s\S]*?)```/i;
  const match = content.match(refsRegex);
  if (!match) {
    return `${content.trim()}\n\n\`\`\`references\n{"laws":[],"judgments":[]}\n\`\`\``;
  }
  try {
    JSON.parse(match[1].trim());
    return content;
  } catch {
    return content.replace(refsRegex, "```references\n{\"laws\":[],\"judgments\":[]}\n```");
  }
}

const REFERENCES_BLOCK_REGEX = /```references\s*([\s\S]*?)```/i;

function isDirectModePrompt(text: string): boolean {
  const normalized = (text || "").trim().toLowerCase();
  if (!normalized || normalized.length > 120) return false;
  const directPatterns = [
    /^reply with\b/,
    /^respond with\b/,
    /^answer with\b/,
    /only$/,
    /\bexactly\b/,
    /\bone word\b/,
    /\bjust\b/,
  ];
  return directPatterns.some((rx) => rx.test(normalized));
}

function getDirectModeSystemPrompt(): string {
  return `You are Al Wakeelo.
Follow the latest user instruction exactly.
If the user asks for a strict output format (e.g., "Reply YES only"), output exactly that and nothing else.
Do not add disclaimers, headings, references, or extra explanation unless explicitly requested.`;
}

function extractKeywords(text: string, limit: number = 6): string[] {
  const tokens = (text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3);

  const stop = new Set([
    "pakistan",
    "under",
    "with",
    "from",
    "that",
    "this",
    "their",
    "there",
    "have",
    "will",
    "shall",
    "where",
  ]);

  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (stop.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, limit))
    .map(([token]) => token);
}

type RawLawRef = { name?: string; section?: string; description?: string };
type RawJudgmentRef = { citation?: string; court?: string; description?: string };

function sanitizeReferenceText(value: string, maxLen: number): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

async function verifyReferencesBlock(content: string): Promise<string> {
  const match = content.match(REFERENCES_BLOCK_REGEX);
  if (!match) return ensureAlWakeeloReferencesBlock(content);

  let parsed: { laws?: RawLawRef[]; judgments?: RawJudgmentRef[] } = {};
  try {
    parsed = JSON.parse(match[1].trim() || "{}");
  } catch {
    parsed = {};
  }

  const inputLaws = Array.isArray(parsed.laws) ? parsed.laws.slice(0, 6) : [];
  const inputJudgments = Array.isArray(parsed.judgments) ? parsed.judgments.slice(0, 6) : [];
  const verifiedLaws: Array<{ name: string; section: string; description: string }> = [];
  const verifiedJudgments: Array<{ citation: string; court: string; description: string }> = [];
  const seenLaws = new Set<string>();
  const seenJudgments = new Set<string>();

  for (const law of inputLaws) {
    const name = sanitizeReferenceText(law?.name || "", 180);
    const section = sanitizeReferenceText(law?.section || "", 80);
    const description = sanitizeReferenceText(law?.description || "", 320);
    if (!name && !section) continue;

    const query = `${name} ${section}`.trim();
    const matched = query ? await storage.searchStatutes(query, 3).catch(() => []) : [];
    const primary = matched.length > 0 ? matched[0] : null;
    const normalizedLaw = {
      name: sanitizeReferenceText(primary?.shortTitle || name || "Pakistani Statute", 180),
      section: sanitizeReferenceText(section || primary?.section || "", 80),
      description: sanitizeReferenceText(description || primary?.description || "", 320),
    };
    const lawKey = `${normalizedLaw.name.toLowerCase()}::${normalizedLaw.section.toLowerCase()}`;
    if (seenLaws.has(lawKey)) continue;
    seenLaws.add(lawKey);
    verifiedLaws.push(normalizedLaw);
  }

  for (const judgment of inputJudgments) {
    const citation = sanitizeReferenceText(judgment?.citation || "", 140);
    const court = sanitizeReferenceText(judgment?.court || "", 120);
    const description = sanitizeReferenceText(judgment?.description || "", 320);
    if (!citation) continue;
    const matched = await storage.getCaseLawByCitation(citation).catch(() => undefined);
    const normalizedJudgment = {
      citation: sanitizeReferenceText(matched?.citation || citation, 140),
      court: sanitizeReferenceText(matched?.court || court || "Pakistani Courts", 120),
      description: sanitizeReferenceText(description || matched?.summary || "", 320),
    };
    const judgmentKey = normalizedJudgment.citation.toLowerCase();
    if (seenJudgments.has(judgmentKey)) continue;
    seenJudgments.add(judgmentKey);
    verifiedJudgments.push(normalizedJudgment);
  }

  const normalized = JSON.stringify({
    laws: verifiedLaws.slice(0, 5),
    judgments: verifiedJudgments.slice(0, 5),
  });
  return content.replace(REFERENCES_BLOCK_REGEX, `\`\`\`references\n${normalized}\n\`\`\``);
}

async function applyAlWakeeloSafetyGuardrails(content: string): Promise<string> {
  const withRefs = ensureAlWakeeloReferencesBlock(content);
  const verifiedRefs = await verifyReferencesBlock(withRefs);
  return verifiedRefs;
}

type CitationParts = { year: number; journalCode: string; page: number };

function normalizeCitationToken(token: string): string {
  return String(token || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function parseCitationParts(citation: string, journalCodeMap: Map<string, string>): CitationParts | null {
  const raw = String(citation || "").trim();
  if (!raw) return null;

  const normalized = raw
    .replace(/[()[\],;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length < 3) return null;

  const yearIdx = tokens.findIndex((token) => /^(19|20)\d{2}$/.test(token));
  if (yearIdx < 0) return null;
  const year = Number(tokens[yearIdx]);
  if (!Number.isInteger(year)) return null;

  const journalCandidates = [
    tokens[yearIdx + 1],
    tokens[yearIdx - 1],
    tokens[yearIdx + 2],
    tokens[yearIdx - 2],
  ].filter((token): token is string => typeof token === "string" && token.length > 0);

  let journalCode: string | undefined;
  for (const token of journalCandidates) {
    const mapped = journalCodeMap.get(normalizeCitationToken(token));
    if (mapped) {
      journalCode = mapped;
      break;
    }
  }
  if (!journalCode) return null;

  const tailTokens = tokens.slice(yearIdx + 1);
  const pageToken = [...tailTokens]
    .reverse()
    .find((token) => /^\d{1,5}$/.test(token) && Number(token) > 0);
  if (!pageToken) return null;
  const page = Number(pageToken);
  if (!Number.isInteger(page) || page < 1) return null;

  return { year, journalCode, page };
}

function resolveCourtId(courtRaw: string, courts: Array<{ id: number; code: string; name: string }>): number | null {
  const value = String(courtRaw || "").trim();
  if (!value) return null;
  const upper = value.toUpperCase();
  const direct = courts.find((court) => court.code.toUpperCase() === upper);
  if (direct) return direct.id;

  const byName = courts.find((court) => court.name.toLowerCase() === value.toLowerCase());
  if (byName) return byName.id;

  const fuzzy = courts.find((court) => {
    const courtName = court.name.toLowerCase();
    const query = value.toLowerCase();
    return courtName.includes(query) || query.includes(courtName);
  });
  return fuzzy?.id ?? null;
}

async function loadCaseLawSourceText(
  entry: {
    sourceDocId?: number | null;
    sourceType?: string | null;
    summary?: string | null;
    title?: string | null;
    citation?: string | null;
  },
  userId: string,
): Promise<string> {
  const sourceType = String(entry.sourceType || "").toLowerCase();
  const sourceDocId = Number(entry.sourceDocId || 0);
  let content = "";

  if (sourceDocId > 0 && sourceType === "admin") {
    const doc = await storage.getAdminKnowledgeById(sourceDocId);
    if (doc) {
      content = doc.content || "";
      const fileMeta = await storage.getAdminKnowledgeFile(doc.id);
      if (fileMeta?.extractedTextKey) {
        const fullContent = await getR2ObjectText(fileMeta.extractedTextKey);
        if (fullContent) content = fullContent;
      }
    }
  } else if (sourceDocId > 0 && sourceType === "github") {
    const doc = await storage.getGithubKnowledgeById(sourceDocId);
    if (doc) content = doc.content || "";
  } else if (sourceDocId > 0 && sourceType === "statute") {
    const doc = await storage.getStatuteDocument(sourceDocId);
    if (doc) {
      content = doc.content || "";
      const fileMeta = await storage.getStatuteDocumentFile(doc.id);
      if (fileMeta?.extractedTextKey) {
        const fullContent = await getR2ObjectText(fileMeta.extractedTextKey);
        if (fullContent) content = fullContent;
      }
    }
  } else if (sourceDocId > 0 && sourceType === "user") {
    const doc = await storage.getDocumentById(sourceDocId, userId);
    if (doc) {
      content = doc.content || "";
      const fileMeta = await storage.getDocumentFile(doc.id, userId);
      if (fileMeta?.extractedTextKey) {
        const fullContent = await getR2ObjectText(fileMeta.extractedTextKey);
        if (fullContent) content = fullContent;
      }
    }
  }

  if (!content.trim()) {
    const fallback = [entry.title || "", entry.summary || "", entry.citation || ""].filter(Boolean).join("\n\n");
    content = fallback;
  }
  return content.trim();
}

async function syncCaseLawEntriesToJudgments(
  entries: Array<{
    id: number;
    citation: string;
    court: string;
    title: string;
    summary: string;
    sourceDocId?: number | null;
    sourceType?: string | null;
  }>,
  actorUserId: string,
): Promise<{
  processed: number;
  imported: number;
  existing: number;
  skipped: number;
  failed: number;
  linked: number;
  unresolved: number;
  errors: string[];
}> {
  const journals = await storage.getLawJournals();
  const courts = await storage.getCourtsRef();
  const journalCodeMap = new Map<string, string>(
    journals.map((journal) => [normalizeCitationToken(journal.code), journal.code.toUpperCase()]),
  );
  const journalIdByCode = new Map<string, number>(
    journals.map((journal) => [journal.code.toUpperCase(), journal.id]),
  );

  let processed = 0;
  let imported = 0;
  let existing = 0;
  let skipped = 0;
  let failed = 0;
  let linked = 0;
  let unresolved = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    processed += 1;
    try {
      const parsed = parseCitationParts(entry.citation, journalCodeMap);
      if (!parsed) {
        skipped += 1;
        continue;
      }

      const journalId = journalIdByCode.get(parsed.journalCode);
      if (!journalId) {
        skipped += 1;
        continue;
      }

      const alreadyExists = await storage.searchJudgmentsByCitation({
        year: parsed.year,
        journalCode: parsed.journalCode,
        page: parsed.page,
      });
      if (alreadyExists.length > 0) {
        existing += 1;
        continue;
      }

      const fullText = await loadCaseLawSourceText(entry, actorUserId);
      if (!fullText || fullText.length < 10) {
        skipped += 1;
        continue;
      }

      const courtId = resolveCourtId(entry.court, courts);
      const citationString = `${parsed.year} ${parsed.journalCode} ${parsed.page}`;
      const created = await storage.createJudgment({
        year: parsed.year,
        journalId,
        page: parsed.page,
        citationString,
        title: entry.title || citationString,
        petitioner: null,
        respondent: null,
        courtId: courtId || undefined,
        courtNameSnapshot: entry.court || null,
        decisionDate: null,
        headnotes: entry.summary || null,
        fullText,
        pdfUrl: null,
        isActive: true,
      });

      imported += 1;
      const extraction = await citationExtractor.processJudgment(created.id, fullText);
      linked += extraction.resolved;
      unresolved += extraction.unresolved;
    } catch (err: any) {
      if (String(err?.code || "") === "23505") {
        existing += 1;
        continue;
      }
      failed += 1;
      errors.push(`#${entry.id} ${entry.citation || entry.title}: ${err?.message || "Unknown error"}`);
    }
  }

  return {
    processed,
    imported,
    existing,
    skipped,
    failed,
    linked,
    unresolved,
    errors: errors.slice(0, 50),
  };
}

function startsWithBytes(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }
  return true;
}

function appearsTextLike(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 2048));
  let suspicious = 0;
  for (const byte of sample) {
    const isAllowedControl = byte === 9 || byte === 10 || byte === 13;
    const isAsciiPrintable = byte >= 32 && byte <= 126;
    const isUtf8High = byte >= 128;
    if (!isAllowedControl && !isAsciiPrintable && !isUtf8High) {
      suspicious++;
    }
  }
  return suspicious / sample.length < 0.08;
}

function hasSafeDocumentSignature(file: Express.Multer.File, ext: string): boolean {
  const b = file.buffer;
  if (ext === ".pdf") return startsWithBytes(b, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
  if (ext === ".doc") return startsWithBytes(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // OLE2
  if (ext === ".docx") return startsWithBytes(b, [0x50, 0x4b, 0x03, 0x04]); // ZIP-based OpenXML
  if (ext === ".txt" || ext === ".json" || ext === ".csv") return appearsTextLike(b);
  return false;
}

function hasSafeImageSignature(file: Express.Multer.File): boolean {
  const b = file.buffer;
  const mime = file.mimetype;
  if (mime === "image/jpeg") return startsWithBytes(b, [0xff, 0xd8, 0xff]);
  if (mime === "image/png") return startsWithBytes(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mime === "image/gif") return startsWithBytes(b, [0x47, 0x49, 0x46, 0x38]);
  if (mime === "image/webp") {
    const riff = startsWithBytes(b, [0x52, 0x49, 0x46, 0x46]); // RIFF
    const webp = b.length > 12 && String.fromCharCode(...b.subarray(8, 12)) === "WEBP";
    return riff && webp;
  }
  return false;
}

async function passesMalwareScan(
  file: Express.Multer.File,
): Promise<{ ok: boolean; reason?: string }> {
  const scan = await scanUploadedBuffer(file.buffer, file.originalname || "upload.bin");
  if (scan.allowed) return { ok: true };
  return { ok: false, reason: scan.reason || "File failed malware scan." };
}

function normalizeDraftingText(content: string): string {
  return content
    .replace(/```references[\s\S]*?```/gi, "")
    .replace(/```[a-zA-Z]*\s*/g, "")
    .replace(/```/g, "")
    .trim();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function resolveConfidenceThreshold(envKey: string, fallback: number): number {
  const raw = Number(process.env[envKey]);
  if (!Number.isFinite(raw)) return fallback;
  return clamp01(raw);
}

function estimateClauseSuggestionConfidence(topScore: number, secondScore: number): number {
  const boundedTop = Math.max(0, Math.min(12, topScore));
  const boundedSpread = Math.max(0, Math.min(4, topScore - secondScore));
  return clamp01(0.15 + (boundedTop / 12) * 0.6 + (boundedSpread / 4) * 0.25);
}

function parseClauseSuggestionsFromAi(raw: string, limit: number): Array<{ id: string; title: string; subtitle: string; prompt: string }> {
  try {
    const jsonText = extractJsonObject(raw);
    if (!jsonText) return [];
    const parsed = JSON.parse(jsonText) as { suggestions?: Array<{ title?: string; subtitle?: string; prompt?: string }> };
    const items = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
    return items
      .filter((item) => item && typeof item.title === "string" && typeof item.prompt === "string")
      .slice(0, Math.max(1, Math.min(8, limit)))
      .map((item, idx) => ({
        id: `ai-suggested-${Date.now()}-${idx}`,
        title: String(item.title || "").trim(),
        subtitle: String(item.subtitle || "Recommended for this draft.").trim(),
        prompt: String(item.prompt || "").trim(),
      }))
      .filter((item) => item.title.length > 0 && item.prompt.length > 0);
  } catch {
    return [];
  }
}

function normalizeStrictContractJson(intent: ModuleIntent | undefined, raw: string): { normalized: string; valid: boolean } {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    if (intent === "contract.clauseSuggest") return { normalized: '{"suggestions":[]}', valid: false };
    if (intent === "contract.redline") return { normalized: '{"edits":[]}', valid: false };
    return { normalized: raw, valid: false };
  }

  try {
    const parsed = JSON.parse(jsonText);
    if (intent === "contract.clauseSuggest") {
      const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
      return { normalized: JSON.stringify({ suggestions }), valid: suggestions.length > 0 };
    }
    if (intent === "contract.redline") {
      const edits = Array.isArray(parsed?.edits) ? parsed.edits : [];
      return { normalized: JSON.stringify({ edits }), valid: edits.length > 0 };
    }
    return { normalized: jsonText, valid: true };
  } catch {
    if (intent === "contract.clauseSuggest") return { normalized: '{"suggestions":[]}', valid: false };
    if (intent === "contract.redline") return { normalized: '{"edits":[]}', valid: false };
    return { normalized: raw, valid: false };
  }
}

type RateLimitConfig = { capacity: number; refillPerSec: number };
type RateBucket = { tokens: number; lastRefillMs: number };

const RATE_LIMITS_BY_FEATURE: Record<string, RateLimitConfig> = {
  chat: { capacity: 4, refillPerSec: 1.4 },
  "public-chat": { capacity: 3, refillPerSec: 0.5 },
  "public-funnel": { capacity: 8, refillPerSec: 1.2 },
  "search-judgments": { capacity: 3, refillPerSec: 1.1 },
  "search-statutes": { capacity: 3, refillPerSec: 1.1 },
  summarize: { capacity: 2, refillPerSec: 0.7 },
  brief: { capacity: 2, refillPerSec: 0.6 },
  draft: { capacity: 2, refillPerSec: 0.7 },
  "contract-drafting": { capacity: 2, refillPerSec: 0.7 },
  default: { capacity: 3, refillPerSec: 1.0 },
};

const userRateBuckets = new Map<string, RateBucket>();

function resolveRateLimitConfig(feature: string): RateLimitConfig {
  return RATE_LIMITS_BY_FEATURE[feature] || RATE_LIMITS_BY_FEATURE.default;
}

function checkRateLimit(userId: string, feature: string): boolean {
  const cfg = resolveRateLimitConfig(feature);
  const key = `${userId}:${feature}`;
  const now = Date.now();
  const bucket = userRateBuckets.get(key) || { tokens: cfg.capacity, lastRefillMs: now };
  const elapsedSec = Math.max(0, (now - bucket.lastRefillMs) / 1000);
  const refilled = Math.min(cfg.capacity, bucket.tokens + elapsedSec * cfg.refillPerSec);

  if (refilled < 1) {
    userRateBuckets.set(key, { tokens: refilled, lastRefillMs: now });
    return false;
  }

  userRateBuckets.set(key, { tokens: refilled - 1, lastRefillMs: now });
  return true;
}

setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  const staleKeys: string[] = [];
  for (const [key, bucket] of userRateBuckets.entries()) {
    if (bucket.lastRefillMs < cutoff) staleKeys.push(key);
  }
  for (const key of staleKeys) userRateBuckets.delete(key);
}, 60_000);

function getAlWakeeloIdentity(): string {
  return `You are Al Wakeelo — Pakistan's first AI-powered legal assistant, built by Al Wakeelo. Your tagline is "Your Digital Lawyer, Always on Duty." You are an expert in Pakistani law, specializing in the Constitution of Pakistan 1973, Pakistan Penal Code, Code of Civil Procedure, Code of Criminal Procedure, Family Laws, Contract Act, and all major Pakistani statutes and case law. You serve Pakistani lawyers, law students, and citizens seeking legal guidance. Always be authoritative, precise, and cite real Pakistani legal sources.`;
}

function getLegalSystemPrompt(): string {
  const currentDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `You are Al Wakeelo — "Your Digital Lawyer, Always on Duty".
You are the digital manifestation of a high-stakes, street-smart Pakistani advocate, inspired by the tactical brilliance and silver-tongued wit of Saul Goodman.

CURRENT DATE: ${currentDate}

TAGLINE: "Knowledge of Law is Power — and I'm Your Power Source."
MOTTO: "Main hoon Al Wakeelo — not just your lawyer, your strategy partner in justice."

LANGUAGE POLICY (STRICT):
- Match the user's language. If the user chats in English, reply in English.
- If the user writes in Urdu script, you MUST respond in Urdu script.
- If the user writes in Roman Urdu, respond in Roman Urdu.
- Otherwise, respond in English.
- Maintain your sharp, witty persona in both languages.
- Do NOT use Hindi.
- Do NOT use Devanagari script.

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
    if (!checkRateLimit(userId, feature)) {
      res.status(429).json({ message: "Too many requests. Please wait a moment before trying again." });
      return false;
    }

    const isAdmin = await storage.isUserAdmin(userId);
    if (isAdmin) {
      return true;
    }

    const tier = normalizeTier(await storage.getUserTier(userId));
    const limits = getTierPlan(tier);
    const usedThisMonth = await storage.getMonthlyUsageCount(userId);

    if (usedThisMonth >= limits.monthlyQueries) {
      res.status(429).json({
        message: `Monthly AI action limit reached (${limits.monthlyQueries} on ${limits.label} plan). Upgrade your plan for higher limits.`,
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

async function gatherKnowledgeContext(query: string, userId?: string): Promise<string> {
  const contextParts: string[] = [];

  const promises: Promise<any>[] = [
    storage.searchStatutes(query, KNOWLEDGE_STATUTES_LIMIT),
    storage.searchCaseLaw(query, KNOWLEDGE_CASELAW_LIMIT),
    storage.searchGithubKnowledge(query, KNOWLEDGE_SOURCES_PER_TIER),
    storage.searchAdminKnowledge(query, KNOWLEDGE_SOURCES_PER_TIER),
  ];
  if (userId) {
    promises.push(storage.getDocuments(userId));
  }

  const [statutesResult, caseLawResult, githubResult, adminResult, userDocsResult] = await Promise.allSettled(promises);

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

  if (userDocsResult && userDocsResult.status === "fulfilled" && userDocsResult.value.length > 0) {
    const queryLower = query.toLowerCase();
    const relevant = userDocsResult.value
      .filter((d: any) => d.content && (
        d.title?.toLowerCase().includes(queryLower) ||
        d.content.toLowerCase().includes(queryLower) ||
        queryLower.split(/\s+/).some((w: string) => w.length > 3 && (d.title?.toLowerCase().includes(w) || d.content.toLowerCase().includes(w)))
      ))
      .slice(0, 2);
    if (relevant.length > 0) {
      contextParts.push("=== USER'S CASE DOCUMENTS ===");
      for (const doc of relevant) {
        const excerpt = doc.content.length > KNOWLEDGE_EXCERPT_LIMIT ? doc.content.substring(0, KNOWLEDGE_EXCERPT_LIMIT) + "..." : doc.content;
        contextParts.push(`--- ${doc.title} ---\n${excerpt}`);
      }
    }
  }

  if (userId) {
    try {
      const userOrg = await storage.getUserOrganization(userId);
      if (userOrg) {
        const orgDocs = await storage.searchOrgKnowledge(userOrg.id, query, 3);
        if (orgDocs.length > 0) {
          contextParts.push(`=== ORGANIZATION KNOWLEDGE BASE (${userOrg.name}) ===`);
          for (const doc of orgDocs) {
            const excerpt = doc.content.length > KNOWLEDGE_EXCERPT_LIMIT ? doc.content.substring(0, KNOWLEDGE_EXCERPT_LIMIT) + "..." : doc.content;
            contextParts.push(`--- ${doc.title} ---\n${excerpt}`);
          }
        }
      }
    } catch (e) {}
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
  const extractionGuards = getExtractionQueueStats();
  console.log(
    `[Extraction Guards] concurrency=${extractionGuards.concurrency} maxPending=${extractionGuards.maxPending} worker=${extractionGuards.workerEnabled}`,
  );
  const uploadGuards = getUploadQueueStats();
  console.log(
    `[Upload Guards] concurrency=${uploadGuards.concurrency} maxPending=${uploadGuards.maxPending} documentFileMax=${toMbText(DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES)} adminFileMax=${toMbText(ADMIN_UPLOAD_MAX_FILE_SIZE_BYTES)}`,
  );
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/robots.txt", (req, res) => {
    const base = normalizeSiteBaseUrl(req);
    res.type("text/plain").send(`User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);
  });

  app.get("/sitemap.xml", (req, res) => {
    const base = normalizeSiteBaseUrl(req);
    const urls = ["/", "/auth", "/privacy", "/terms", "/install"];
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map((path) => (
        `  <url><loc>${base}${path}</loc><changefreq>${path === "/" ? "weekly" : "monthly"}</changefreq><priority>${path === "/" ? "1.0" : "0.6"}</priority></url>`
      )).join("\n") +
      `\n</urlset>\n`;
    res.type("application/xml").send(body);
  });

  app.use("/api", (req, res, next) => {
    if (!dbAvailable && req.path === "/auth/google/status") {
      return next();
    }
    return requireDatabase(req, res, next);
  });

  app.use("/api", async (req, res, next) => {
    const userId = getUserId(req);
    if (!userId) return next();
    if (req.path.startsWith("/auth/logout")) return next();

    const banned = await isUserBanned(userId).catch(() => false);
    if (!banned) return next();
    recordSecurityEvent("auth_anomaly", `banned-api-access:${userId}`, {
      path: req.path,
      method: req.method,
    });

    return res.status(403).json({ message: "Your account is suspended. Please contact support." });
  });

  app.get("/api/public/platform-metrics", async (_req, res) => {
    try {
      const stats = await storage.getSystemStats();
      res.set("Cache-Control", "public, max-age=15");
      return res.json({
        legalDocuments: Number(stats.totalKnowledge || 0),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Error fetching public platform metrics:", err);
      return res.status(500).json({ message: "Failed to fetch platform metrics." });
    }
  });

  app.post(api.publicChat.send.path, async (req, res) => {
    try {
      const visitorIp = getVisitorIpAddress(req);
      if (!checkRateLimit(`public:${visitorIp}`, "public-chat")) {
        return res.status(429).json({
          message: "Too many requests. Please wait a moment before trying again.",
        });
      }

      const message = sanitizeInputText(req.body?.message, PUBLIC_CHAT_MAX_INPUT_CHARS);
      if (!message || message.length < 2) {
        return res.status(400).json({ message: "Message is required." });
      }

      const stats = await storage.getVisitorSessionStats(
        visitorIp,
        PUBLIC_CHAT_WINDOW_HOURS,
        PUBLIC_CHAT_MESSAGE_LIMIT,
      );
      if (stats.messageCount >= PUBLIC_CHAT_MESSAGE_LIMIT) {
        return res.status(429).json({
          limitReached: true,
          message: PUBLIC_CHAT_LIMIT_MESSAGE,
          remaining: 0,
          limit: PUBLIC_CHAT_MESSAGE_LIMIT,
          resetAt: stats.resetAt.toISOString(),
          actions: ["Contact Chamber", "Submit Case"],
        });
      }

      const aiMessages = [
        { role: "system" as const, content: PUBLIC_CHAT_SYSTEM_PROMPT },
        { role: "user" as const, content: message },
      ];
      const preferredLanguage = resolvePublicChatLanguage(message);

      let provider: "groq" | "openrouter" = "groq";
      let model = "openai/gpt-oss-120b";
      let aiReply = "";
      try {
        const primary = await chatWithGroq({
          messages: aiMessages,
          model: "openai/gpt-oss-120b",
          maxTokens: 900,
          temperature: 0.4,
        });
        aiReply = primary.content;
        model = primary.model || model;
      } catch (groqErr) {
        if (!isOpenRouterAvailable()) {
          throw groqErr;
        }
        const fallback = await chatWithOpenRouter({
          messages: aiMessages,
          model: "deepseek-chat",
          maxTokens: 900,
          temperature: 0.4,
        });
        provider = "openrouter";
        model = fallback.model || "deepseek-chat";
        aiReply = fallback.content;
      }

      let normalizedReply = sanitizeInputText(aiReply, 6000);
      const needsLanguageRewrite =
        hasDevanagari(normalizedReply) ||
        (preferredLanguage === "english" && (hasUrduScript(normalizedReply) || looksLikeRomanizedSouthAsian(normalizedReply))) ||
        (preferredLanguage === "urdu" && !hasUrduScript(normalizedReply)) ||
        (preferredLanguage === "romanUrdu" && (hasUrduScript(normalizedReply) || !looksLikeRomanizedSouthAsian(normalizedReply)));
      if (needsLanguageRewrite) {
        try {
          normalizedReply = sanitizeInputText(
            await rewritePublicChatOutput({
              content: normalizedReply,
              targetLanguage: preferredLanguage,
              provider,
            }),
            6000,
          );
        } catch (rewriteErr) {
          console.warn("[Public Chat] Language rewrite failed:", getErrorMessage(rewriteErr));
        }
      }
      const stillInvalid =
        !normalizedReply ||
        hasDevanagari(normalizedReply) ||
        (preferredLanguage === "english" && (hasUrduScript(normalizedReply) || looksLikeRomanizedSouthAsian(normalizedReply))) ||
        (preferredLanguage === "urdu" && !hasUrduScript(normalizedReply)) ||
        (preferredLanguage === "romanUrdu" && (hasUrduScript(normalizedReply) || !looksLikeRomanizedSouthAsian(normalizedReply)));
      if (stillInvalid) {
        normalizedReply = getPublicChatLanguageFallback(preferredLanguage);
      }

      const updated = await storage.incrementVisitorSession(
        visitorIp,
        PUBLIC_CHAT_WINDOW_HOURS,
        PUBLIC_CHAT_MESSAGE_LIMIT,
      );

      const shouldPromptCaseSubmission = updated.messageCount >= 7 && updated.messageCount <= 8;
      let safeReply = ensurePublicChatClosingLine(normalizedReply, preferredLanguage);
      if (shouldPromptCaseSubmission && !safeReply.toLowerCase().includes("submit your case")) {
        safeReply += `\n\n${PUBLIC_CHAT_CASE_NUDGE[preferredLanguage]}`;
      }

      res.json({
        limitReached: false,
        reply: safeReply,
        messageCount: updated.messageCount,
        remaining: updated.remaining,
        limit: PUBLIC_CHAT_MESSAGE_LIMIT,
        resetAt: updated.resetAt.toISOString(),
        showCaseIntake: shouldPromptCaseSubmission,
        provider,
        model,
      });
    } catch (err) {
      console.error("Error in public chat:", err);
      res.status(503).json({ message: "Public AI assistant is currently unavailable. Please try again shortly." });
    }
  });

  app.post(api.publicChat.event.path, async (req, res) => {
    try {
      const visitorIp = getVisitorIpAddress(req);
      if (!checkRateLimit(`public-event:${visitorIp}`, "public-funnel")) {
        return res.status(429).json({ message: "Too many events. Slow down." });
      }

      const parsed = api.publicChat.event.input.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid event payload." });
      }

      await storage.logPublicFunnelEvent({
        eventType: parsed.data.eventType,
        sessionId: parsed.data.sessionId,
        ipAddress: visitorIp,
        metadata: sanitizeTelemetryMetadata(parsed.data.metadata),
      });

      return res.status(201).json({ ok: true });
    } catch (err) {
      console.error("Error logging public funnel event:", err);
      return res.status(500).json({ message: "Failed to log event." });
    }
  });

  app.post(api.publicChat.submitCase.path, async (req, res) => {
    try {
      const visitorIp = getVisitorIpAddress(req);
      const name = sanitizeInputText(req.body?.name, 120);
      const phone = sanitizeInputText(req.body?.phone, 40);
      const email = sanitizeInputText(req.body?.email, 160).toLowerCase();
      const caseType = sanitizeInputText(req.body?.caseType, 120);
      const caseDescription = sanitizeInputText(req.body?.caseDescription, PUBLIC_LEAD_MAX_DESCRIPTION_CHARS);
      const city = sanitizeInputText(req.body?.city, PUBLIC_LEAD_MAX_CITY_CHARS);
      const urgencyRaw = sanitizeInputText(req.body?.urgency, 20).toLowerCase();
      const preferredCallbackTime = sanitizeInputText(req.body?.preferredCallbackTime, PUBLIC_LEAD_MAX_CALLBACK_CHARS);
      const consentToContact = req.body?.consentToContact === true || req.body?.consentToContact === "true";
      const urgency = (["low", "normal", "high", "urgent"].includes(urgencyRaw) ? urgencyRaw : "normal") as "low" | "normal" | "high" | "urgent";

      if (!name || !phone || !email || !caseType || !caseDescription || !city) {
        return res.status(400).json({ message: "All fields are required." });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Invalid email address." });
      }
      if (!/^[0-9+()\-.\s]{6,40}$/.test(phone)) {
        return res.status(400).json({ message: "Invalid phone number." });
      }
      if (caseDescription.length < 20) {
        return res.status(400).json({ message: "Case description is too short." });
      }
      if (!consentToContact) {
        return res.status(400).json({ message: "Consent is required before submitting your case." });
      }

      const created = await storage.createCaseLead({
        name,
        phone,
        email,
        caseType,
        caseDescription,
        city,
        urgency,
        preferredCallbackTime: preferredCallbackTime || null,
        consentToContact,
        ipAddress: visitorIp,
      });
      await storage.logPublicFunnelEvent({
        eventType: "lead_submitted",
        sessionId: sanitizeInputText(req.body?.sessionId, 120) || null,
        ipAddress: visitorIp,
        metadata: sanitizeTelemetryMetadata({
          caseType,
          urgency,
          city,
        }),
      });

      res.status(201).json({
        message: "Your case has been submitted successfully. Our chamber may contact you soon.",
        lead: created,
      });
    } catch (err) {
      console.error("Error submitting public case lead:", err);
      res.status(500).json({ message: "Failed to submit your case." });
    }
  });

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

      const knowledgeContext = await gatherKnowledgeContext(firstMessage, userId);
      const systemPromptFull = getLegalSystemPrompt() + knowledgeContext;

      let usedModel = "";
      const { content: aiResponse, fromCache } = await getCachedOrCall("chat", firstMessage, async () => {
        const result = await callStandardAISimple(systemPromptFull, firstMessage, TOKEN_LIMITS.chat);
        usedModel = result.model;
        return result.text;
      });
      const safeAiResponse = await applyAlWakeeloSafetyGuardrails(aiResponse).catch(() => ensureAlWakeeloReferencesBlock(aiResponse));

      if (!fromCache) {
        await logUsageCost(userId, "chat", usedModel || getOpenRouterModelName(), systemPromptFull + firstMessage, safeAiResponse);
      }

      await storage.createMessage({
        threadId: thread.id,
        role: "assistant",
        content: safeAiResponse,
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

  app.post("/api/threads/save-for-share", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const { title, messages: msgs } = req.body as { title: string; messages: Array<{ role: string; content: string }> };
      if (!Array.isArray(msgs) || msgs.length < 2) {
        return res.status(400).json({ message: "At least 2 messages required" });
      }
      const validRoles = ["user", "assistant"];
      const validMsgs = msgs.filter(m => validRoles.includes(m.role) && typeof m.content === "string" && m.content.length > 0);
      if (validMsgs.length < 2) {
        return res.status(400).json({ message: "Invalid message format" });
      }
      const thread = await storage.createThread({
        userId,
        title: title || msgs[0]?.content?.slice(0, 80) || "Al Wakeelo Conversation",
      });
      for (const m of validMsgs) {
        await storage.createMessage({
          threadId: thread.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        });
      }
      res.status(201).json(thread);
    } catch (err) {
      console.error("Error saving thread for share:", err);
      res.status(500).json({ message: "Failed to save conversation" });
    }
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

      const knowledgeContext = await gatherKnowledgeContext(message, userId);
      const systemPromptFull = getLegalSystemPrompt() + knowledgeContext;

      const result = await callStandardAI(systemPromptFull, geminiContents, TOKEN_LIMITS.chat);

      const aiResponse = await applyAlWakeeloSafetyGuardrails(result.text).catch(() => ensureAlWakeeloReferencesBlock(result.text));
      const inputText = systemPromptFull + history.map(m => m.content).join(" ");
      await logUsageCost(userId, "chat", result.model, inputText, aiResponse);

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
    res.json(docs.map(toApiDocument));
  });

  app.get("/api/documents/insights", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const insights = await storage.getDocumentInsights(userId);
      res.json(insights);
    } catch (err) {
      console.error("Error fetching document insights:", err);
      res.status(500).json({ message: "Failed to fetch document insights" });
    }
  });

  app.post("/api/documents/backfill-metadata", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const limitRaw = Number(req.body?.limit);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 50) : 50;
      const pending = await storage.getDocumentsNeedingMetadata(userId, limit);
      const updates: Array<DocumentMetadata & { id: number }> = [];
      let failed = 0;

      for (const doc of pending) {
        try {
          const metadata = await classifyDocumentMetadata({
            title: doc.title || `document-${doc.id}`,
            filename: doc.title || `document-${doc.id}.txt`,
            content: doc.content || "",
            mimeType: doc.mimeType,
          });
          updates.push({ id: doc.id, ...metadata });
        } catch {
          failed += 1;
        }
      }

      const updated = updates.length > 0
        ? await storage.backfillDocumentMetadata(
          userId,
          updates.map((item) => ({
            ...item,
            classificationConfidence: item.classificationConfidence,
          })),
        )
        : 0;

      const insights = await storage.getDocumentInsights(userId);
      res.json({
        processed: pending.length,
        updated,
        failed,
        remainingUnclassified: insights.unclassifiedCount,
      });
    } catch (err) {
      console.error("Error backfilling document metadata:", err);
      res.status(500).json({ message: "Failed to backfill document metadata" });
    }
  });

  const guardedUploadQueue = createUploadQueueMiddleware("upload-processing");

  const styleMemoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES,
      files: Math.max(1, Math.min(20, DOCUMENT_UPLOAD_MAX_FILES)),
    },
  });

  app.get("/api/style-memory/settings", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      if (!STYLE_MEMORY_ENABLED) {
        return res.status(503).json({ message: "Style memory is disabled" });
      }
      const moduleRaw = String(req.query.module || "");
      if (!isStyleMemoryModule(moduleRaw)) {
        return res.status(400).json({ message: "Invalid module. Use legal-drafting or contract-drafting." });
      }
      const scopeRaw = String(req.query.scope || "user").toLowerCase();
      const useOrgScope = scopeRaw === "org";
      let orgId: number | null = null;
      if (useOrgScope) {
        const org = await storage.getUserOrganization(userId);
        if (!org) return res.status(400).json({ message: "Organization scope requested but user has no organization." });
        orgId = org.id;
      }
      const settings = await getOrCreateStyleMemorySettings(userId, moduleRaw, orgId);
      res.json(settings);
    } catch (err: any) {
      console.error("Error fetching style-memory settings:", err);
      res.status(500).json({ message: err?.message || "Failed to fetch style-memory settings" });
    }
  });

  app.put("/api/style-memory/settings", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      if (!STYLE_MEMORY_ENABLED) {
        return res.status(503).json({ message: "Style memory is disabled" });
      }
      const parsed = z.object({
        module: z.enum(["legal-drafting", "contract-drafting"]),
        scope: z.enum(["user", "org"]).optional(),
        enabled: z.boolean().optional(),
        ownershipMode: z.enum(["user", "org", "user-org"]).optional(),
        strictness: z.enum(["strict", "balanced", "flexible"]).optional(),
      }).parse(req.body || {});
      let orgId: number | null = null;
      if ((parsed.scope || "user") === "org" || parsed.ownershipMode === "org" || parsed.ownershipMode === "user-org") {
        const org = await storage.getUserOrganization(userId);
        if (!org) return res.status(400).json({ message: "Organization scope requested but user has no organization." });
        orgId = org.id;
      }
      const settings = await updateStyleMemorySettings({
        userId,
        module: parsed.module,
        orgId,
        enabled: parsed.enabled,
        ownershipMode: parsed.ownershipMode,
        strictness: parsed.strictness,
      });
      res.json(settings);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid payload" });
      }
      console.error("Error updating style-memory settings:", err);
      res.status(500).json({ message: err?.message || "Failed to update style-memory settings" });
    }
  });

  app.get("/api/style-memory/samples", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      if (!STYLE_MEMORY_ENABLED) {
        return res.status(503).json({ message: "Style memory is disabled" });
      }
      const moduleRaw = String(req.query.module || "");
      if (!isStyleMemoryModule(moduleRaw)) {
        return res.status(400).json({ message: "Invalid module. Use legal-drafting or contract-drafting." });
      }
      const scopeRaw = String(req.query.scope || "user").toLowerCase();
      const useOrgScope = scopeRaw === "org";
      const { limit, offset } = parsePagination(req, { defaultLimit: 20, maxLimit: 200 });
      let orgId: number | null = null;
      if (useOrgScope) {
        const org = await storage.getUserOrganization(userId);
        if (!org) return res.status(400).json({ message: "Organization scope requested but user has no organization." });
        orgId = org.id;
      }
      const page = await storage.listStyleMemorySamples(userId, moduleRaw, limit, offset, orgId);
      res.json(page);
    } catch (err: any) {
      console.error("Error listing style-memory samples:", err);
      res.status(500).json({ message: err?.message || "Failed to list style-memory samples" });
    }
  });

  app.post("/api/style-memory/samples/upload", guardedUploadQueue, styleMemoryUpload.array("files", 20), async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      if (!STYLE_MEMORY_ENABLED) {
        return res.status(503).json({ message: "Style memory is disabled" });
      }
      const moduleRaw = String(req.body?.module || "");
      if (!isStyleMemoryModule(moduleRaw)) {
        return res.status(400).json({ message: "Invalid module. Use legal-drafting or contract-drafting." });
      }
      const scopeRaw = String(req.body?.scope || "user").toLowerCase();
      const useOrgScope = scopeRaw === "org";
      let orgId: number | null = null;
      if (useOrgScope) {
        const org = await storage.getUserOrganization(userId);
        if (!org) return res.status(400).json({ message: "Organization scope requested but user has no organization." });
        orgId = org.id;
      }

      const files = (req.files as Express.Multer.File[] | undefined) || [];
      if (files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const accepted: Array<{ file: string; sampleId: number | null; indexedChunks: number; deduped: boolean }> = [];
      const rejected: Array<{ file: string; reason: string }> = [];

      for (const file of files) {
        const stableFile = cloneUploadFile(file);
        const original = file.originalname || "style-sample.txt";
        const ext = original.includes(".")
          ? original.substring(original.lastIndexOf(".")).toLowerCase()
          : "";
        const allowedExt = [".txt", ".pdf", ".docx"];
        if (!allowedExt.includes(ext)) {
          rejected.push({ file: original, reason: "unsupported format (allowed: .txt, .pdf, .docx)" });
          continue;
        }
        if (!hasSafeDocumentSignature(file, ext)) {
          rejected.push({ file: original, reason: "file signature mismatch" });
          continue;
        }
        const malwareCheck = await passesMalwareScan(file);
        if (!malwareCheck.ok) {
          rejected.push({ file: original, reason: malwareCheck.reason || "malware detected" });
          continue;
        }

        let text = "";
        try {
          if (ext === ".pdf") {
            text = await extractPdfTextSafe(stableFile.buffer, "style-memory-upload");
            if (!text) {
              text = await extractPdfTextWithOcrFallback(stableFile, "style-memory-upload");
            }
          } else if (ext === ".docx") {
            text = await extractDocxTextSafe(stableFile.buffer, "style-memory-upload");
          } else {
            text = stripNullBytes(stableFile.buffer.toString("utf-8"));
          }
        } catch (extractErr: any) {
          if (isExtractionQueueFullError(extractErr)) return sendExtractionBusy(res);
          rejected.push({ file: original, reason: extractErr?.message || "text extraction failed" });
          continue;
        }

        const result = await ingestStyleSample({
          userId,
          module: moduleRaw,
          orgId,
          sourceType: "upload",
          sourceRef: `upload:${original}`,
          title: original,
          rawText: text,
        });
        if (!result.accepted) {
          rejected.push({ file: original, reason: result.reason || "not accepted" });
          continue;
        }
        accepted.push({
          file: original,
          sampleId: result.sampleId,
          indexedChunks: result.indexedChunks,
          deduped: result.deduped,
        });
      }

      res.status(201).json({
        accepted: accepted.length,
        rejected: rejected.length,
        indexed: accepted.reduce((sum, item) => sum + (item.indexedChunks || 0), 0),
        files: accepted,
        errors: rejected,
        queue: getStyleMemoryQueueStats(),
      });
    } catch (err: any) {
      if (isExtractionQueueFullError(err)) return sendExtractionBusy(res);
      console.error("Error uploading style-memory samples:", err);
      res.status(500).json({ message: err?.message || "Failed to upload style-memory samples" });
    }
  });

  app.delete("/api/style-memory/samples/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      if (!STYLE_MEMORY_ENABLED) {
        return res.status(503).json({ message: "Style memory is disabled" });
      }
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ message: "Invalid sample id" });
      }
      const moduleRaw = String(req.query.module || "");
      if (!isStyleMemoryModule(moduleRaw)) {
        return res.status(400).json({ message: "Invalid module. Use legal-drafting or contract-drafting." });
      }
      const scopeRaw = String(req.query.scope || "user").toLowerCase();
      const useOrgScope = scopeRaw === "org";
      let orgId: number | null = null;
      if (useOrgScope) {
        const org = await storage.getUserOrganization(userId);
        if (!org) return res.status(400).json({ message: "Organization scope requested but user has no organization." });
        orgId = org.id;
      }

      const removed = await storage.deleteStyleMemorySample(id, userId, moduleRaw, orgId);
      if (removed === 0) return res.status(404).json({ message: "Style sample not found" });
      res.json({ deleted: removed });
    } catch (err: any) {
      console.error("Error deleting style-memory sample:", err);
      res.status(500).json({ message: err?.message || "Failed to delete style-memory sample" });
    }
  });

  app.post("/api/style-memory/events/accepted-redline", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      if (!STYLE_MEMORY_ENABLED) {
        return res.status(503).json({ message: "Style memory is disabled" });
      }
      const parsed = z.object({
        module: z.enum(["legal-drafting", "contract-drafting"]),
        draftId: z.union([z.number().int().positive(), z.string().min(1)]),
        acceptedText: z.string().min(10),
        beforeText: z.string().optional(),
        scope: z.enum(["user", "org"]).optional(),
      }).parse(req.body || {});
      let orgId: number | null = null;
      if ((parsed.scope || "user") === "org") {
        const org = await storage.getUserOrganization(userId);
        if (!org) return res.status(400).json({ message: "Organization scope requested but user has no organization." });
        orgId = org.id;
      }
      const result = await recordAcceptedRedlineStyleEvent({
        userId,
        module: parsed.module,
        orgId,
        draftId: parsed.draftId,
        acceptedText: parsed.acceptedText,
        beforeText: parsed.beforeText,
      });
      res.status(201).json({
        accepted: result.accepted,
        deduped: result.deduped,
        indexedChunks: result.indexedChunks,
        sampleId: result.sampleId,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid payload" });
      }
      console.error("Error recording style-memory redline event:", err);
      res.status(500).json({ message: err?.message || "Failed to record accepted redline" });
    }
  });

  app.post("/api/style-memory/backfill", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      if (!STYLE_MEMORY_ENABLED) {
        return res.status(503).json({ message: "Style memory is disabled" });
      }
      const parsed = z.object({
        module: z.enum(["legal-drafting", "contract-drafting"]),
        scope: z.enum(["user", "org"]).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      }).parse(req.body || {});
      let orgId: number | null = null;
      if ((parsed.scope || "user") === "org") {
        const org = await storage.getUserOrganization(userId);
        if (!org) return res.status(400).json({ message: "Organization scope requested but user has no organization." });
        orgId = org.id;
      }
      const result = await backfillStyleMemoryFromSavedDrafts({
        userId,
        module: parsed.module,
        orgId,
        limit: parsed.limit ?? 50,
      });
      res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid payload" });
      }
      console.error("Error backfilling style-memory:", err);
      res.status(500).json({ message: err?.message || "Failed to backfill style memory" });
    }
  });

  const documentUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES,
      files: DOCUMENT_UPLOAD_MAX_FILES,
    },
  });

  app.post(api.documents.create.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const input = api.documents.create.input.parse(req.body);
      if (input.content) {
        input.content = stripNullBytes(input.content);
      }
      const metadata = await classifyDocumentMetadata({
        title: input.title,
        filename: input.title,
        content: input.content || "",
      });
      const doc = await storage.createDocument({
        ...input,
        userId,
        ...metadata,
      });
      if (STYLE_MEMORY_ENABLED && typeof doc.content === "string" && doc.content.trim()) {
        const styleModule = resolveDraftModuleFromDocumentTitle(doc.title || "");
        if (styleModule) {
          ingestStyleSample({
            userId,
            module: styleModule,
            sourceType: "saved-draft",
            sourceRef: `document:${doc.id}`,
            title: doc.title || `Draft ${doc.id}`,
            rawText: doc.content,
          }).catch((styleErr) => {
            console.warn("[StyleMemory] Could not ingest created draft:", getErrorMessage(styleErr));
          });
        }
      }
      res.status(201).json(toApiDocument(doc));
    } catch (err) {
      console.error("Error creating document:", err);
      res.status(500).json({ message: "Failed to create document" });
    }
  });

  app.post("/api/documents/upload", guardedUploadQueue, documentUpload.array("files", 25), async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const files = (req.files as Express.Multer.File[] | undefined) || [];
      if (files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const uploaded: any[] = [];
      const errors: string[] = [];

      for (const file of files) {
        const stableFile = cloneUploadFile(file);
        const original = file.originalname || "uploaded-document.txt";
        const ext = original.includes(".")
          ? original.substring(original.lastIndexOf(".")).toLowerCase()
          : "";

        if (file.size > DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES) {
          errors.push(`${original}: exceeds max file size (${toMbText(DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES)})`);
          continue;
        }

        if (![".txt", ".json", ".csv", ".pdf", ".doc", ".docx"].includes(ext)) {
          errors.push(`${original}: unsupported format (use .txt, .json, .csv, .pdf, or .docx)`);
          continue;
        }

        if (!hasSafeDocumentSignature(file, ext)) {
          recordSecurityEvent("upload_signature_failure", `user-doc:${userId}`, {
            filename: original,
            ext,
            mimetype: file.mimetype,
          });
          errors.push(`${original}: file signature does not match declared format`);
          continue;
        }
        const malwareCheck = await passesMalwareScan(file);
        if (!malwareCheck.ok) {
          recordSecurityEvent("malware_detected", `user-doc:${userId}`, {
            filename: original,
            ext,
            reason: malwareCheck.reason || null,
          });
          errors.push(`${original}: ${malwareCheck.reason || "malware detected"}`);
          continue;
        }

        let content = "";
        const r2Upload = await uploadBufferToR2({
          buffer: stableFile.buffer,
          fileName: original,
          contentType: file.mimetype,
          prefix: `documents/${userId}`,
          metadata: {
            user_id: userId,
            source: "knowledge-vault",
          },
        });

        if (ext === ".pdf") {
          try {
            content = await extractPdfTextSafe(stableFile.buffer, "documents-upload");
          } catch (pdfErr: any) {
            if (isExtractionQueueFullError(pdfErr)) return sendExtractionBusy(res);
            console.error(`[Documents Upload] PDF parse error for ${original}:`, pdfErr?.message || pdfErr);
            content = "";
          }
          if (!content) {
            try {
              content = await extractPdfTextWithOcrFallback(stableFile, "documents-upload");
            } catch (ocrErr) {
              if (isExtractionQueueFullError(ocrErr)) return sendExtractionBusy(res);
              throw ocrErr;
            }
          }
          if (!content) {
            errors.push(`${original}: could not extract text (file may be scanned/image PDF)`);
            continue;
          }
        } else if (ext === ".doc" || ext === ".docx") {
          try {
            content = await extractDocxTextSafe(stableFile.buffer, "documents-upload");
          } catch (docErr: any) {
            if (isExtractionQueueFullError(docErr)) return sendExtractionBusy(res);
            console.error(`[Documents Upload] DOCX parse error for ${original}:`, docErr?.message || docErr);
            content = "";
          }
          if (!content) {
            errors.push(`${original}: could not extract text from document`);
            continue;
          }
        } else {
          content = stripNullBytes(stableFile.buffer.toString("utf-8").trim());
          if (!content) {
            errors.push(`${original}: document is empty`);
            continue;
          }
        }

        const customTitle = typeof req.body?.title === "string" ? req.body.title.trim() : "";
        const title = files.length === 1 && customTitle ? customTitle : original;
        const metadata = await classifyDocumentMetadata({
          title,
          filename: original,
          content,
          mimeType: file.mimetype,
        });
        const compacted = compactContentForDb(content);
        const extractedTextKey = compacted.wasTruncated
          ? await uploadExtractedTextToR2({
            text: content,
            fileName: original,
            prefix: `documents-text/${userId}`,
            metadata: {
              user_id: userId,
              source: "knowledge-vault-extracted",
            },
          })
          : null;
        const dbContent = compacted.wasTruncated && extractedTextKey && !!r2Upload ? compacted.inlineContent : content;
        const doc = await storage.createDocument({ userId, title, content: dbContent, ...metadata });
        if (r2Upload) {
          try {
            await storage.upsertDocumentFile({
              documentId: doc.id,
              userId,
              provider: r2Upload.provider,
              bucket: r2Upload.bucket,
              objectKey: r2Upload.objectKey,
              extractedTextKey,
              originalFilename: original,
              mimeType: file.mimetype || null,
              sizeBytes: file.size,
              etag: r2Upload.etag,
              publicUrl: r2Upload.publicUrl,
            });
          } catch (r2MetaErr: any) {
            console.warn("[R2] Failed to persist document file metadata:", r2MetaErr?.message || r2MetaErr);
          }
        }
        uploaded.push(toApiDocument(doc));
      }

      if (uploaded.length === 0) {
        return res.status(400).json({ message: errors[0] || "No valid files uploaded", uploaded: 0, failed: errors.length, errors });
      }

      res.status(201).json({
        uploaded: uploaded.length,
        failed: errors.length,
        documents: uploaded,
        errors,
      });
    } catch (err) {
      if (isExtractionQueueFullError(err)) return sendExtractionBusy(res);
      console.error("Error uploading user documents:", err);
      res.status(500).json({ message: "Failed to upload documents" });
    }
  });

  app.put(api.documents.update.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid document id" });
      }

      const input = api.documents.update.input.parse(req.body);
      if (input.content) {
        input.content = stripNullBytes(input.content);
      }
      if (typeof input.title !== "string" && typeof input.content !== "string") {
        return res.status(400).json({ message: "Nothing to update" });
      }

      const title = typeof input.title === "string" ? input.title : undefined;
      const content = typeof input.content === "string" ? input.content : undefined;
      const updated = await storage.updateDocument(id, userId, { title, content });
      if (!updated) {
        return res.status(404).json({ message: "Document not found" });
      }
      if (STYLE_MEMORY_ENABLED && typeof updated.content === "string" && updated.content.trim()) {
        const styleModule = resolveDraftModuleFromDocumentTitle(updated.title || "");
        if (styleModule) {
          ingestStyleSample({
            userId,
            module: styleModule,
            sourceType: "saved-draft",
            sourceRef: `document:${updated.id}`,
            title: updated.title || `Draft ${updated.id}`,
            rawText: updated.content,
          }).catch((styleErr) => {
            console.warn("[StyleMemory] Could not ingest updated draft:", getErrorMessage(styleErr));
          });
        }
      }
      res.json(toApiDocument(updated));
    } catch (err) {
      console.error("Error updating document:", err);
      res.status(500).json({ message: "Failed to update document" });
    }
  });

  app.delete(api.documents.delete.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const id = Number(req.params.id);
      const docFile = await storage.getDocumentFile(id, userId);
      if (docFile?.provider === "r2") {
        const keys = [docFile.objectKey, docFile.extractedTextKey].filter((k): k is string => !!k);
        await Promise.allSettled(keys.map((key) => deleteR2Object(key)));
      }
      await storage.deleteDocument(id, userId);
      res.sendStatus(204);
    } catch (err) {
      console.error("Error deleting document:", err);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  app.delete(api.documents.list.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const docFiles = await storage.getDocumentFilesByUser(userId);
      const deleted = await storage.deleteAllDocuments(userId);
      await Promise.allSettled(
        docFiles
          .filter((item) => item.provider === "r2")
          .flatMap((item) => [item.objectKey, item.extractedTextKey].filter((k): k is string => !!k))
          .map((key) => deleteR2Object(key)),
      );
      res.json({ deleted });
    } catch (err) {
      console.error("Error deleting all documents:", err);
      res.status(500).json({ message: "Failed to delete all documents" });
    }
  });

  app.post("/api/rag/index-document", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);

    try {
      const parsed = z.object({ documentId: z.number().int().positive() }).parse(req.body);
      const indexed = await indexUserDocument(userId, parsed.documentId);
      res.json({ ok: true, ...indexed });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid payload" });
      }
      console.error("Error indexing RAG document:", err);
      res.status(500).json({ message: err?.message || "Failed to index document for RAG" });
    }
  });

  app.post("/api/rag/ask", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);

    try {
      const allowed = await checkUsageLimit(userId, "chat", res);
      if (!allowed) return;

      const parsed = z.object({
        query: z.string().min(3),
        documentIds: z.array(z.number().int().positive()).optional(),
      }).parse(req.body);

      let retrieval = await retrieveForQuery({
        userId,
        query: parsed.query,
        documentIds: parsed.documentIds,
        topK: Number(process.env.RAG_TOP_K || 5),
      });
      let lazyIndexSummary: {
        candidates: number;
        alreadyIndexed: number;
        attempted: number;
        indexedNow: number;
        failed: number;
      } | null = null;

      if (retrieval.matches.length === 0) {
        lazyIndexSummary = await ensureIndexedForUserDocuments({
          userId,
          sourceDocumentIds: parsed.documentIds,
          maxToIndex: Number(process.env.RAG_LAZY_INDEX_MAX_DOCS || 3),
        });
        if (lazyIndexSummary.indexedNow > 0) {
          retrieval = await retrieveForQuery({
            userId,
            query: parsed.query,
            documentIds: parsed.documentIds,
            topK: Number(process.env.RAG_TOP_K || 5),
          });
        }
      }

      const strictContext = String(process.env.RAG_FORCE_CONTEXT || "true").toLowerCase() !== "false";
      if (retrieval.matches.length === 0) {
        return res.json({
          answer: "I cannot answer reliably from the uploaded materials. Please upload a more relevant document or refine your question.",
          confidence: "low",
          citations: [],
          retrieval: {
            topK: Number(process.env.RAG_TOP_K || 5),
            matched: retrieval.matches.length,
            threshold: Number(process.env.RAG_MIN_SCORE || 0.5),
            lazyIndex: lazyIndexSummary,
          },
          model: { provider: "none", name: "none" },
        });
      }

      const ragContext = buildRagContext(retrieval.matches);
      const systemPrompt = `${getLegalSystemPrompt()}

RAG POLICY (STRICT):
- Answer only using the provided retrieved context.
- If context is insufficient, explicitly state what is missing.
- Do not invent facts, citations, statutes, or case holdings.
- Keep answer concise, legally structured, and practical for Pakistani legal practice.
- Provide supportable claims only.`;

      const userPrompt = `User question:\n${parsed.query}\n\nRetrieved context:\n${ragContext}\n\nReturn a clear answer grounded only in this context.`;
      const result = await callStandardAISimple(systemPrompt, userPrompt, TOKEN_LIMITS.chat, { timeoutProfile: "search", temperature: 0.2 });
      await logUsageCost(userId, "chat", result.model, systemPrompt + userPrompt, result.text);
      const lowConfidenceContext = strictContext && retrieval.confidence === "low";
      const answerText = lowConfidenceContext
        ? `Retrieved context confidence is low. Please verify key points against source text.\n\n${result.text}`
        : result.text;

      const citations = retrieval.matches.slice(0, 5).map((m) => ({
        documentId: m.ragDocumentId,
        sourceDocumentId: m.sourceDocumentId,
        title: m.title,
        chunkIndex: m.chunkIndex,
        score: Number(m.score.toFixed(4)),
        quote: m.chunkText.slice(0, 240),
      }));

      const provider = result.model === getGroqModelName() ? "groq" : "openrouter";
      res.json({
        answer: answerText,
        confidence: retrieval.confidence,
        citations,
        retrieval: {
          topK: Number(process.env.RAG_TOP_K || 5),
          matched: retrieval.matches.length,
          threshold: Number(process.env.RAG_MIN_SCORE || 0.5),
          lazyIndex: lazyIndexSummary,
        },
        model: { provider, name: result.model },
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid payload" });
      }
      console.error("Error in RAG ask:", err);
      res.status(500).json({ message: err?.message || "Failed to answer using RAG" });
    }
  });

  app.delete("/api/rag/documents/:documentId/vectors", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const documentId = Number(req.params.documentId);
      if (!Number.isInteger(documentId) || documentId < 1) {
        return res.status(400).json({ message: "Invalid document id" });
      }
      const deleted = await deleteDocumentVectors(documentId);
      const actorUserId = getUserId(req);
      await logAuditEvent("admin.rag.deleteVectors", actorUserId, null, { documentId, deletedChunks: deleted });
      res.json({ ok: true, deletedChunks: deleted });
    } catch (err) {
      console.error("Error deleting RAG vectors:", err);
      res.status(500).json({ message: "Failed to delete vectors for document" });
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
      await storage.deleteBookmark(id, userId);
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
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
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
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
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

  app.get("/api/statute-documents/:id/file", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) return res.status(400).json({ message: "Invalid document ID" });
      const fileMeta = await storage.getStatuteDocumentFile(id);
      if (!fileMeta) return res.status(404).json({ message: "File not found" });

      if (fileMeta.provider === "r2" && fileMeta.objectKey) {
        const binary = await getR2ObjectBinary(fileMeta.objectKey);
        if (!binary) return res.status(404).json({ message: "File not found" });
        const contentType = binary.contentType || fileMeta.mimeType || "application/octet-stream";
        const safeFilename = (fileMeta.originalFilename || `statute-${id}`).replace(/[^a-zA-Z0-9._-]+/g, "_");
        // Allow same-origin PDF embedding for in-app statute viewer mode.
        res.setHeader("X-Frame-Options", "SAMEORIGIN");
        res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
        res.setHeader("Cache-Control", "private, max-age=3600");
        return res.send(binary.buffer);
      }

      if (fileMeta.publicUrl) {
        return res.redirect(fileMeta.publicUrl);
      }

      return res.status(404).json({ message: "File not found" });
    } catch (err) {
      console.error("Error fetching statute file:", err);
      res.status(500).json({ message: "Failed to fetch statute file" });
    }
  });

  app.get("/api/statute-documents/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) return res.status(400).json({ message: "Invalid document ID" });
      const doc = await storage.getStatuteDocument(id);
      if (!doc) return res.status(404).json({ message: "Document not found" });
      const fileMeta = await storage.getStatuteDocumentFile(id);
      const fullContent = fileMeta?.extractedTextKey ? await getR2ObjectText(fileMeta.extractedTextKey) : null;
      const lowerName = (fileMeta?.originalFilename || doc.filename || "").toLowerCase();
      const mime = (fileMeta?.mimeType || "").toLowerCase();
      const isPdf = mime.includes("pdf") || lowerName.endsWith(".pdf");
      res.json({
        ...doc,
        content: fullContent || doc.content,
        file: fileMeta
          ? {
              available: true,
              mimeType: fileMeta.mimeType || null,
              originalFilename: fileMeta.originalFilename || null,
              isPdf,
              viewUrl: `/api/statute-documents/${id}/file`,
            }
          : {
              available: false,
              mimeType: null,
              originalFilename: null,
              isPdf: false,
              viewUrl: null,
            },
      });
    } catch (err) {
      console.error("Error fetching statute document:", err);
      res.status(500).json({ message: "Failed to fetch statute document" });
    }
  });

  app.get(api.caseLaw.search.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const query = ((req.query.q as string) || "").trim();
      if (!query) return res.json([]);
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 25;
      const results = await storage.searchCaseLaw(query, limit);
      res.json(results);
    } catch (err) {
      console.error("Error searching case law:", err);
      res.status(500).json({ message: "Failed to search case law" });
    }
  });

  app.get("/api/case-law/lookup", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const citation = (req.query.citation as string) || "";
      if (!citation) return res.status(400).json({ message: "Citation required" });
      const entry = await storage.getCaseLawByCitation(citation);
      if (!entry) return res.json({ found: false });
      res.json({
        found: true,
        id: entry.id,
        citation: entry.citation,
        court: entry.court,
        title: entry.title,
        summary: entry.summary,
        hasSource: !!(entry.sourceDocId && entry.sourceType),
        sourceType: entry.sourceType,
        sourceFilename: entry.sourceFilename,
      });
    } catch (err) {
      console.error("Error looking up case law:", err);
      res.status(500).json({ message: "Failed to lookup case law" });
    }
  });

  app.get("/api/case-law/:id/source", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const entry = await storage.getCaseLawById(id);
      if (!entry) return res.status(404).json({ found: false, message: "Case law entry not found" });
      if (!entry.sourceDocId || !entry.sourceType) {
        return res.json({ found: false, message: "No source document linked to this case law entry" });
      }

      let title = "";
      let content = "";
      let filename = "";

      if (entry.sourceType === "github") {
        const doc = await storage.getGithubKnowledgeById(entry.sourceDocId);
        if (doc) { title = doc.title; content = doc.content; filename = doc.filename; }
      } else if (entry.sourceType === "admin") {
        const doc = await storage.getAdminKnowledgeById(entry.sourceDocId);
        if (doc) {
          title = doc.title;
          content = doc.content;
          filename = doc.filename;
          const fileMeta = await storage.getAdminKnowledgeFile(doc.id);
          if (fileMeta?.extractedTextKey) {
            const fullContent = await getR2ObjectText(fileMeta.extractedTextKey);
            if (fullContent) content = fullContent;
          }
        }
      } else if (entry.sourceType === "statute") {
        const doc = await storage.getStatuteDocument(entry.sourceDocId);
        if (doc) {
          title = doc.title;
          content = doc.content;
          filename = doc.filename;
          const fileMeta = await storage.getStatuteDocumentFile(doc.id);
          if (fileMeta?.extractedTextKey) {
            const fullContent = await getR2ObjectText(fileMeta.extractedTextKey);
            if (fullContent) content = fullContent;
          }
        }
      } else if (entry.sourceType === "user") {
        const doc = await storage.getDocumentById(entry.sourceDocId, userId);
        if (doc) {
          title = doc.title || "";
          content = doc.content || "";
          filename = doc.title || "";
          const fileMeta = await storage.getDocumentFile(doc.id, userId);
          if (fileMeta?.extractedTextKey) {
            const fullContent = await getR2ObjectText(fileMeta.extractedTextKey);
            if (fullContent) content = fullContent;
          }
        }
      }

      if (!content) {
        return res.json({ found: false, message: "Source document no longer available" });
      }

      res.json({
        found: true,
        title,
        content,
        filename,
        sourceType: entry.sourceType,
        citation: entry.citation,
      });
    } catch (err) {
      console.error("Error fetching case law source:", err);
      res.status(500).json({ message: "Failed to fetch source document" });
    }
  });

  app.get("/api/journals", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const journals = await storage.getLawJournals();
      res.json(journals);
    } catch (err) {
      console.error("Error fetching journals:", err);
      res.status(500).json({ message: "Failed to fetch journals" });
    }
  });

  app.get("/api/citation-search", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const year = Number(req.query.year);
      const journalCode = String(req.query.journal || "").trim();
      const page = Number(req.query.page);
      const court = String(req.query.court || "").trim();
      const currentYear = new Date().getFullYear();

      if (!Number.isInteger(year) || year < 1947 || year > currentYear + 1) {
        return res.status(400).json({ message: `Year must be between 1947 and ${currentYear + 1}` });
      }
      if (!journalCode) {
        return res.status(400).json({ message: "Journal code is required" });
      }
      if (!Number.isInteger(page) || page < 1) {
        return res.status(400).json({ message: "Page must be a positive integer" });
      }

      const journals = await storage.getLawJournals();
      const exists = journals.some((j) => j.code.toLowerCase() === journalCode.toLowerCase());
      if (!exists) {
        return res.status(400).json({ message: `Unknown journal code: ${journalCode}` });
      }

      const matches = await storage.searchJudgmentsByCitation({
        year,
        journalCode,
        page,
        court: court || undefined,
      });

      res.json(matches);
    } catch (err) {
      console.error("Error in citation search:", err);
      res.status(500).json({ message: "Failed to search by citation" });
    }
  });

  app.get("/api/judgments/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const id = String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ message: "Judgment id is required" });
      const judgment = await storage.getJudgmentDetail(id);
      if (!judgment) return res.status(404).json({ message: "Judgment not found" });
      res.json(judgment);
    } catch (err) {
      console.error("Error fetching judgment detail:", err);
      res.status(500).json({ message: "Failed to fetch judgment details" });
    }
  });

  app.post("/api/judgments", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const currentYear = new Date().getFullYear();
      const parsed = z.object({
        year: z.number().int().min(1947).max(currentYear + 1),
        journalCode: z.string().min(1),
        page: z.number().int().min(1),
        title: z.string().min(1),
        petitioner: z.string().optional(),
        respondent: z.string().optional(),
        courtCode: z.string().optional(),
        courtName: z.string().optional(),
        decisionDate: z.string().datetime().optional(),
        headnotes: z.string().optional(),
        fullText: z.string().min(1),
        pdfUrl: z.string().url().optional(),
      }).parse(req.body);

      const journals = await storage.getLawJournals();
      const journal = journals.find((j) => j.code.toLowerCase() === parsed.journalCode.toLowerCase());
      if (!journal) {
        return res.status(400).json({ message: `Unknown journal code: ${parsed.journalCode}` });
      }

      const courts = await storage.getCourtsRef();
      const courtByCode = parsed.courtCode
        ? courts.find((c) => c.code.toLowerCase() === parsed.courtCode!.toLowerCase())
        : undefined;
      const courtByName = parsed.courtName
        ? courts.find((c) => c.name.toLowerCase() === parsed.courtName!.toLowerCase())
        : undefined;
      const court = courtByCode || courtByName;

      const citationString = `${parsed.year} ${journal.code.toUpperCase()} ${parsed.page}`;
      const created = await storage.createJudgment({
        year: parsed.year,
        journalId: journal.id,
        page: parsed.page,
        citationString,
        title: parsed.title,
        petitioner: parsed.petitioner || null,
        respondent: parsed.respondent || null,
        courtId: court?.id,
        courtNameSnapshot: parsed.courtName || court?.name || null,
        decisionDate: parsed.decisionDate ? new Date(parsed.decisionDate) : null,
        headnotes: parsed.headnotes || null,
        fullText: parsed.fullText,
        pdfUrl: parsed.pdfUrl || null,
      });

      const extraction = await citationExtractor.processJudgment(created.id, parsed.fullText);
      const actorUserId = getUserId(req);
      await logAuditEvent("admin.judgment.create", actorUserId, null, {
        judgmentId: created.id,
        citation: created.citationString,
        extraction,
      });

      res.status(201).json({
        judgmentId: created.id,
        citation: created.citationString,
        extraction,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid judgment payload" });
      }
      if (String(err?.code || "") === "23505") {
        return res.status(409).json({ message: "A judgment with the same year, journal, and page already exists" });
      }
      console.error("Error creating judgment:", err);
      res.status(500).json({ message: "Failed to create judgment" });
    }
  });

  app.get(api.usage.get.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const tier = normalizeTier(await storage.getUserTier(userId));
      const limits = getTierPlan(tier);
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

  app.post("/api/retrieval/clauses/suggest", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const { query, draftText, contractType, limit } = req.body as {
        query?: string;
        draftText?: string;
        contractType?: string;
        limit?: number;
      };
      const safeLimit = Number.isFinite(limit) ? Number(limit) : 4;
      const retrievalSuggestions = suggestClauses({
        query: query || "",
        draftText: draftText || "",
        contractType: contractType || "",
        limit: safeLimit,
      });
      const suggestions = retrievalSuggestions.map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        prompt: item.prompt,
      }));

      const topScore = retrievalSuggestions[0]?.score || 0;
      const secondScore = retrievalSuggestions[1]?.score || 0;
      const retrievalConfidence = estimateClauseSuggestionConfidence(topScore, secondScore);
      const aiFallbackThreshold = resolveConfidenceThreshold("RETRIEVAL_CLAUSE_SUGGEST_AI_THRESHOLD", 0.55);
      const shouldAiFallback = retrievalConfidence < aiFallbackThreshold;
      const canUseAiFallback = isGroqAvailable() || isOpenRouterAvailable();

      if (shouldAiFallback && canUseAiFallback) {
        const allowed = await checkUsageLimit(userId, "draft", res);
        if (!allowed) return;

        const sysInstruction = `You are a Pakistani legal drafting assistant.
Suggest missing or weak contract clauses for the provided draft context.
Return ONLY valid JSON in this exact format:
{"suggestions":[{"title":"...","subtitle":"...","prompt":"..."}]}
Rules:
- Return up to ${Math.max(1, Math.min(8, safeLimit))} suggestions.
- Each subtitle must be concise (max 12 words).
- Each prompt must be directly usable to draft a clause under Pakistani law.
- No markdown, no explanations, no extra keys.`;
        const userInput = `Contract Type: ${contractType || "Not provided"}
Query: ${query || "Not provided"}
Draft Excerpt:
${(draftText || "").slice(0, 8000) || "[No draft text provided]"}`;
        try {
          const aiResult = await callStandardAISimple(sysInstruction, userInput, 1200, { timeoutProfile: "analysis", temperature: 0.3 });
          await logUsageCost(userId, "draft", aiResult.model, sysInstruction + userInput, aiResult.text);
          const aiSuggestions = parseClauseSuggestionsFromAi(aiResult.text, safeLimit);
          if (aiSuggestions.length > 0) {
            return res.json({
              suggestions: aiSuggestions,
              method: "ai-fallback",
              retrievalConfidence,
              confidence: Math.max(retrievalConfidence, 0.7),
            });
          }
        } catch (aiErr) {
          console.warn("[Retrieval Clauses] AI fallback for suggestions failed:", getErrorMessage(aiErr));
        }
      }

      res.json({ suggestions, method: "retrieval", confidence: retrievalConfidence });
    } catch (err) {
      console.error("Error suggesting clauses:", err);
      res.status(500).json({ message: "Failed to suggest clauses" });
    }
  });

  app.post("/api/retrieval/clauses/generate", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const { prompt, draftText, jurisdiction, module } = req.body as {
        prompt?: string;
        draftText?: string;
        jurisdiction?: string;
        module?: string;
      };
      const safePrompt = (prompt || "").trim();
      if (!safePrompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      let styleMemoryMeta: {
        applied: boolean;
        module: "legal-drafting" | "contract-drafting" | null;
        scopeUsed: "user" | "org" | "user-org";
        chunksUsed: number;
        confidence: number;
      } | null = null;
      let styleContext = "";
      const styleModule = isStyleMemoryModule(String(module || "")) ? (module as "legal-drafting" | "contract-drafting") : null;
      if (STYLE_MEMORY_ENABLED && styleModule) {
        try {
          const userOrg = await storage.getUserOrganization(userId).catch(() => undefined);
          const retrieved = await retrieveStyleContextForGeneration({
            userId,
            module: styleModule,
            orgId: userOrg?.id ?? null,
            userPrompt: safePrompt,
            draftText: draftText || "",
          });
          styleMemoryMeta = {
            applied: false,
            module: styleModule,
            scopeUsed: retrieved.result.scopeUsed,
            chunksUsed: retrieved.result.chunks.length,
            confidence: retrieved.result.confidence,
          };
          if (retrieved.result.applied && retrieved.result.confidence >= STYLE_CONTEXT_MIN_CONFIDENCE) {
            styleContext = trimTextToTokenBudget(retrieved.result.contextText, STYLE_PROMPT_TOKEN_BUDGET);
            styleMemoryMeta.applied = true;
          }
        } catch (styleErr) {
          console.warn("[StyleMemory] Could not retrieve clause style context:", getErrorMessage(styleErr));
        }
      }

      const generated = generateClauseFromPrompt({
        prompt: safePrompt,
        draftText: draftText || "",
        jurisdiction: jurisdiction || "Lahore",
      });

      const aiFallbackThreshold = resolveConfidenceThreshold("RETRIEVAL_CLAUSE_GENERATE_AI_THRESHOLD", 0.58);
      const shouldAiFallback = generated.method === "fallback" || generated.confidence < aiFallbackThreshold;
      const shouldStyleRewrite = !!styleContext && generated.method === "retrieval";
      const canUseAiFallback = isGroqAvailable() || isOpenRouterAvailable();

      if ((shouldAiFallback || shouldStyleRewrite) && canUseAiFallback) {
        const allowed = await checkUsageLimit(userId, "draft", res);
        if (!allowed) return;

        const sysInstruction = shouldStyleRewrite
          ? `You are a Pakistani legal drafting assistant.
Rewrite the provided clause in the user's drafting style while preserving legal meaning and enforceability.
Return only clause text. No markdown. No bullet list. No JSON.`
          : `You are a Pakistani legal drafting assistant.
Draft one enforceable contract clause based on the instruction and draft context.
Return only clause text. No markdown. No bullet list. No JSON.`;
        const userInput = `${shouldStyleRewrite ? `Base Clause:\n${generated.clause}\n\n` : ""}Instruction: ${safePrompt}
Jurisdiction: ${jurisdiction || "Lahore"}
Current Draft Excerpt:
${(draftText || "").slice(0, 12000) || "[No draft text provided]"}${styleContext ? `\n\nPersonal Style Memory:\n${styleContext}` : ""}`;
        try {
          const aiResult = await callStandardAISimple(sysInstruction, userInput, 1400, { timeoutProfile: "analysis", temperature: 0.3 });
          await logUsageCost(userId, "draft", aiResult.model, sysInstruction + userInput, aiResult.text);
          const clauseText = normalizeDraftingText(aiResult.text);
          if (clauseText) {
            return res.json({
              clause: clauseText,
              sourceId: shouldStyleRewrite ? generated.sourceId : "ai-fallback",
              confidence: Math.max(generated.confidence, 0.72),
              retrievalConfidence: generated.confidence,
              method: shouldStyleRewrite ? "style-rewrite" : "ai-fallback",
              styleMemory: styleMemoryMeta || undefined,
            });
          }
        } catch (aiErr) {
          console.warn("[Retrieval Clauses] AI fallback for generation failed:", getErrorMessage(aiErr));
        }
      }

      res.json({ ...generated, styleMemory: styleMemoryMeta || undefined });
    } catch (err) {
      console.error("Error generating retrieval clause:", err);
      res.status(500).json({ message: "Failed to generate clause" });
    }
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: GENERAL_UPLOAD_MAX_FILE_SIZE_BYTES,
      files: ADMIN_UPLOAD_MAX_FILES,
    },
  });

  app.post("/api/ai/transcribe", guardedUploadQueue, upload.single("audio"), async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "No audio file provided" });

      const allowedAudio = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a", "audio/webm", "audio/ogg", "audio/mp3"];
      if (!allowedAudio.some(t => file.mimetype.startsWith("audio/") || allowedAudio.includes(file.mimetype))) {
        return res.status(400).json({ message: "Unsupported audio format. Use MP3, WAV, M4A, or WebM." });
      }
      const transcribeMalwareCheck = await passesMalwareScan(file);
      if (!transcribeMalwareCheck.ok) {
        recordSecurityEvent("malware_detected", `audio-upload:${userId}`, {
          filename: file.originalname,
          reason: transcribeMalwareCheck.reason || null,
        });
        return res.status(400).json({ message: transcribeMalwareCheck.reason || "Malware detected in audio file." });
      }

      const requestedModeRaw = String(req.body?.mode || "standard").trim().toLowerCase();
      const requestedMode: "standard" | "turbo" | ApexModel =
        requestedModeRaw === "turbo"
          ? "turbo"
          : (requestedModeRaw === "apex" || requestedModeRaw === "apex-pro" || requestedModeRaw === "apex-agent")
            ? (requestedModeRaw as ApexModel)
            : "standard";
      const userTier = await storage.getUserTier(userId);
      const canUseTurboMode = isTurboAllowedForTier(userTier);
      const canUseApexMode = isApexAllowedForTier(userTier);
      if (requestedMode === "turbo" && !canUseTurboMode) {
        return res.status(403).json({ message: "Turbo transcription requires Pro, Chamber, or Enterprise." });
      }
      if ((requestedMode === "apex" || requestedMode === "apex-pro" || requestedMode === "apex-agent") && !canUseApexMode) {
        return res.status(403).json({ message: "Apex transcription requires Chamber or Enterprise." });
      }

      const resolveAudioFormat = (mimeType: string, filename: string): "wav" | "mp3" | "m4a" | "webm" | "ogg" => {
        const type = (mimeType || "").toLowerCase();
        const ext = filename.toLowerCase();
        if (type.includes("wav") || ext.endsWith(".wav")) return "wav";
        if (type.includes("webm") || ext.endsWith(".webm")) return "webm";
        if (type.includes("ogg") || ext.endsWith(".ogg")) return "ogg";
        if (type.includes("m4a") || type.includes("mp4") || ext.endsWith(".m4a") || ext.endsWith(".mp4")) return "m4a";
        return "mp3";
      };

      const commonPrompt =
        "Transcribe this audio accurately. Return only the transcription text. If the audio is in Urdu or another language, transcribe it in that language.";
      const audioFormat = resolveAudioFormat(file.mimetype, file.originalname);
      const base64Audio = file.buffer.toString("base64");

      let transcription = "";
      let provider = "groq";
      let model = "whisper-large-v3-turbo";
      let fallbackUsed = false;
      let fallbackFrom: "deepseek" | "apex" | null = null;
      let localFallbackUsed = false;

      const tryGroqFallback = async (source: "deepseek" | "apex") => {
        if (!isGroqAvailable()) return false;
        try {
          const fallback = await transcribeWithGroq({
            audioBuffer: file.buffer,
            filename: file.originalname,
            mimeType: file.mimetype,
            model: "whisper-large-v3-turbo",
            prompt: commonPrompt,
          });
          const text = (fallback.text || "").trim();
          if (!text) return false;
          transcription = text;
          provider = "groq";
          model = fallback.model || "whisper-large-v3-turbo";
          fallbackUsed = true;
          fallbackFrom = source;
          return true;
        } catch (fallbackErr) {
          console.warn(
            `[Transcription] Groq fallback failed after ${source} failure:`,
            getErrorMessage(fallbackErr),
          );
          return false;
        }
      };

      const tryWhisperCppFallback = async (source: "deepseek" | "apex" | "groq") => {
        if (!isWhisperCppConfigured()) return false;
        try {
          const localResult = await transcribeWithWhisperCpp({
            audioBuffer: file.buffer,
            filename: file.originalname,
          });
          const text = (localResult.text || "").trim();
          if (!text) return false;
          transcription = text;
          provider = "local";
          model = localResult.model || "whisper.cpp";
          localFallbackUsed = true;
          if (source === "deepseek" || source === "apex") {
            fallbackUsed = true;
            fallbackFrom = source;
          }
          return true;
        } catch (localErr) {
          console.warn(
            `[Transcription] whisper.cpp fallback failed after ${source} path failure:`,
            getErrorMessage(localErr),
          );
          return false;
        }
      };

      if (requestedMode === "turbo") {
        if (isDeepSeekAvailable()) {
          try {
            const result = await transcribeWithDeepSeek({
              audioBase64: base64Audio,
              audioFormat,
              prompt: commonPrompt,
            });
            transcription = (result.content || "").trim();
            provider = "deepseek";
            model = result.model || "deepseek-chat";
          } catch (deepseekErr) {
            console.warn("[Transcription] DeepSeek transcription failed:", getErrorMessage(deepseekErr));
          }
        } else {
          console.warn("[Transcription] DeepSeek not configured for turbo mode; trying Groq fallback.");
        }

        if (!transcription.trim()) {
          const fallbackOk = await tryGroqFallback("deepseek");
          if (!fallbackOk) {
            const localOk = await tryWhisperCppFallback("deepseek");
            if (!localOk) {
              return res.status(503).json({
                message: isDeepSeekAvailable()
                  ? "Turbo transcription failed and no fallback is available."
                  : "Turbo transcription is unavailable because DeepSeek is not configured and no fallback is available.",
              });
            }
          }
        }
      } else if (requestedMode === "apex" || requestedMode === "apex-pro" || requestedMode === "apex-agent") {
        if (isApexAvailable()) {
          try {
            const result = await transcribeWithApex({
              model: requestedMode,
              audioBase64: base64Audio,
              audioFormat,
              prompt: commonPrompt,
            });
            transcription = (result.content || "").trim();
            provider = "apex";
            model = result.model || requestedMode;
          } catch (apexErr) {
            console.warn("[Transcription] Apex transcription failed:", getErrorMessage(apexErr));
          }
        } else {
          console.warn("[Transcription] Apex/Kimi not configured for apex mode; trying Groq fallback.");
        }

        if (!transcription.trim()) {
          const fallbackOk = await tryGroqFallback("apex");
          if (!fallbackOk) {
            const localOk = await tryWhisperCppFallback("apex");
            if (!localOk) {
              return res.status(503).json({
                message: isApexAvailable()
                  ? "Apex transcription failed and no fallback is available."
                  : "Apex transcription is unavailable because Kimi is not configured and no fallback is available.",
              });
            }
          }
        }
      } else {
        if (isGroqAvailable()) {
          try {
            const result = await transcribeWithGroq({
              audioBuffer: file.buffer,
              filename: file.originalname,
              mimeType: file.mimetype,
              model: "whisper-large-v3-turbo",
              prompt: commonPrompt,
            });
            transcription = (result.text || "").trim();
            provider = "groq";
            model = result.model || "whisper-large-v3-turbo";
          } catch (groqErr) {
            console.warn("[Transcription] Groq standard transcription failed:", getErrorMessage(groqErr));
          }
        }
        if (!transcription.trim()) {
          const localOk = await tryWhisperCppFallback("groq");
          if (!localOk) {
            return res.status(503).json({
              message:
                "Standard transcription is unavailable because Groq failed/unconfigured and whisper.cpp fallback is unavailable.",
            });
          }
        }
      }

      if (!transcription.trim()) {
        return res.status(400).json({ message: "Could not transcribe audio. The audio may be too short or unclear." });
      }

      res.json({
        transcription: transcription.trim(),
        provider,
        model,
        mode: requestedMode,
        fallbackUsed,
        fallbackFrom,
        localFallbackUsed,
      });
    } catch (err) {
      console.error("Error transcribing audio:", err);
      res.status(500).json({ message: "Failed to transcribe audio" });
    }
  });

  app.post(api.ai.chat.path, guardedUploadQueue, upload.array("attachments", 5), async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const allowed = await checkUsageLimit(userId, "chat", res);
      if (!allowed) return;

      let body = req.body;
      if (typeof body.messages === "string") {
        try {
          body = { ...body, messages: JSON.parse(body.messages) };
        } catch {
          return res.status(400).json({ message: "Invalid messages payload" });
        }
      }
      const {
        messages: userMessages,
        type,
        moduleIntent: moduleIntentRaw,
      } = body as { messages: Array<{ role: string; content: string }>; type?: string; moduleIntent?: string };
      const moduleType: ModuleType = normalizeModuleType(type);
      const moduleProfile = getModuleProfile(type);
      const moduleIntent = typeof moduleIntentRaw === "string" ? (moduleIntentRaw as ModuleIntent) : undefined;
      const requestedStream = body.stream === true || body.stream === "true";
      const useStream = requestedStream && moduleProfile.modelStrategy.stream;

      const files = req.files as Express.Multer.File[] | undefined;
      let attachmentContext = "";
      let extractedAttachmentCount = 0;
      const failedAttachments: string[] = [];
      const allowedMimes = ["text/plain", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      if (files && files.length > 0) {
        const invalidFiles = files.filter(f => !allowedMimes.includes(f.mimetype));
        if (invalidFiles.length > 0) {
          return res.status(400).json({ message: `Unsupported file type. Only TXT, PDF, and DOCX files are allowed. Rejected: ${invalidFiles.map(f => f.originalname).join(", ")}` });
        }
        for (const file of files) {
          const ext = file.originalname.includes(".")
            ? file.originalname.substring(file.originalname.lastIndexOf(".")).toLowerCase()
            : "";
          const signatureExt =
            file.mimetype === "application/pdf"
              ? ".pdf"
              : file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                ? ".docx"
                : ".txt";
          if ((ext && ![".txt", ".pdf", ".docx"].includes(ext)) || !hasSafeDocumentSignature(file, signatureExt)) {
            recordSecurityEvent("upload_signature_failure", `chat-attachment:${userId}`, {
              filename: file.originalname,
              ext,
              mimetype: file.mimetype,
            });
            return res.status(400).json({ message: `Unsafe or invalid attachment detected: ${file.originalname}` });
          }
          const malwareCheck = await passesMalwareScan(file);
          if (!malwareCheck.ok) {
            recordSecurityEvent("malware_detected", `chat-attachment:${userId}`, {
              filename: file.originalname,
              reason: malwareCheck.reason || null,
            });
            return res.status(400).json({ message: `${file.originalname}: ${malwareCheck.reason || "malware detected"}` });
          }
          try {
            let extractedText = "";
            if (file.mimetype === "text/plain") {
              extractedText = stripNullBytes(file.buffer.toString("utf-8"));
            } else if (file.mimetype === "application/pdf") {
              let parsedText = await extractPdfTextSafe(file.buffer, "chat-attachment");
              if (!parsedText.trim()) {
                parsedText = await extractPdfTextWithOcrFallback(file, "chat-attachment");
              }
              extractedText = stripNullBytes(parsedText);
            } else if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
              const parsedText = await extractDocxTextSafe(file.buffer, "chat-attachment");
              extractedText = stripNullBytes(parsedText);
            }

            if (!extractedText.trim()) {
              failedAttachments.push(file.originalname);
              continue;
            }

            const boundedFileText = trimTextToTokenBudget(extractedText, ATTACHMENT_FILE_TOKEN_BUDGET);
            const label = file.mimetype === "application/pdf"
              ? "Attached PDF"
              : file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                ? "Attached Document"
                : "Attached File";
            attachmentContext += `\n\n--- ${label}: ${file.originalname} ---\n${boundedFileText}\n--- End ---`;
            extractedAttachmentCount += 1;
          } catch (fileErr) {
            if (isExtractionQueueFullError(fileErr)) {
              return sendExtractionBusy(res);
            }
            console.error(`Error extracting text from ${file.originalname}:`, fileErr);
            failedAttachments.push(file.originalname);
          }
        }

        if (extractedAttachmentCount === 0) {
          return res.status(400).json({
            message: `Could not extract readable text from uploaded attachment(s): ${failedAttachments.join(", ")}. Upload searchable PDF/TXT/DOCX or enable OCR dependencies for scanned PDFs.`,
          });
        }
      }

      const userTier = await storage.getUserTier(userId);

      const lastUserMessage = userMessages.filter(m => m.role === "user").pop();
      const directMode = Boolean(
        lastUserMessage &&
        moduleType === "al-wakeelo" &&
        !attachmentContext &&
        isDirectModePrompt(lastUserMessage.content),
      );
      let systemPrompt = directMode
        ? getDirectModeSystemPrompt()
        : `${getLegalSystemPrompt()}\n\nMODULE PROFILE: ${moduleProfile.label}\n${moduleProfile.systemPromptAddon}`;

      const systemMessages = userMessages.filter((m) => m.role === "system");
      if (!directMode && systemMessages.length > 0) {
        systemPrompt += "\n\n" + systemMessages.map((m) => m.content).join("\n");
      }

      const geminiContents = userMessages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

      const knowledgeContext = (!directMode && lastUserMessage)
        ? (
          extractedAttachmentCount > 0
            ? ""
            : await gatherKnowledgeContext(lastUserMessage.content, userId)
        )
        : "";
      if (attachmentContext) {
        const boundedAttachmentContext = trimTextToTokenBudget(attachmentContext, ATTACHMENT_PROMPT_TOKEN_BUDGET);
        systemPrompt += `\n\nATTACHMENT MODE (STRICT):
- Prioritize attached document content over general chamber knowledge.
- Answer from attached documents first.
- If the answer is not present in attachments, explicitly say it is not found in the provided files.
- Do not ignore attached files.

ATTACHED DOCUMENTS FROM USER:
The user has attached the following documents for your reference. Analyze them carefully and use them to inform your response.${boundedAttachmentContext}`;
        if (failedAttachments.length > 0) {
          systemPrompt += `\n\nAttachment processing note: Some files could not be read and were excluded: ${failedAttachments.join(", ")}.`;
        }
      }
      const styleModule = mapModuleTypeToStyleModule(moduleType);
      const styleEligible = STYLE_MEMORY_ENABLED && !directMode && !!lastUserMessage && !!styleModule && shouldApplyStyleForChat(moduleType, moduleIntent);
      let styleContext = "";
      let styleMemoryMeta: {
        applied: boolean;
        module: "legal-drafting" | "contract-drafting" | null;
        scopeUsed: "user" | "org" | "user-org";
        chunksUsed: number;
        confidence: number;
      } | null = styleEligible
        ? {
          applied: false,
          module: styleModule!,
          scopeUsed: "user-org",
          chunksUsed: 0,
          confidence: 0,
        }
        : null;

      if (styleEligible && styleModule) {
        try {
          const userOrg = await storage.getUserOrganization(userId).catch(() => undefined);
          const styleRetrieved = await retrieveStyleContextForGeneration({
            userId,
            module: styleModule,
            orgId: userOrg?.id ?? null,
            userPrompt: lastUserMessage!.content,
            draftText: userMessages
              .filter((m) => m.role === "user")
              .map((m) => m.content)
              .join("\n\n")
              .slice(0, 8000),
          });
          if (styleMemoryMeta) {
            styleMemoryMeta.scopeUsed = styleRetrieved.result.scopeUsed;
            styleMemoryMeta.confidence = styleRetrieved.result.confidence;
            styleMemoryMeta.chunksUsed = styleRetrieved.result.chunks.length;
          }
          if (styleRetrieved.result.applied && styleRetrieved.result.confidence >= STYLE_CONTEXT_MIN_CONFIDENCE) {
            styleContext = trimTextToTokenBudget(styleRetrieved.result.contextText, STYLE_PROMPT_TOKEN_BUDGET);
            if (styleMemoryMeta) {
              styleMemoryMeta.applied = true;
            }
          }
        } catch (styleErr) {
          console.warn("[StyleMemory] Retrieval failed for chat route:", getErrorMessage(styleErr));
        }
      }
      const { route: selectedRoute, downgraded } = resolveModuleRoute(
        moduleProfile.modelStrategy.primary,
        moduleProfile.modelStrategy.fallback,
        userTier,
      );
      let usedModel = selectedRoute === "turbo" ? getDeepSeekModelName() : getGroqModelName();
      const featureKey = moduleProfile.modelStrategy.tokenLimitKey;
      const featureTokenLimit = TOKEN_LIMITS[featureKey] || TOKEN_LIMITS.chat;
      const planModeCap = getModeOutputCap(userTier, selectedRoute);
      const tokenLimit = directMode
        ? 128
        : Math.min(featureTokenLimit, planModeCap > 0 ? planModeCap : featureTokenLimit);
      const timeoutProfile: TimeoutProfile = directMode ? "search" : "default";
      const temperature = directMode ? 0 : 0.7;
      const knowledgeTokensBudget = styleContext
        ? Math.max(300, KNOWLEDGE_PROMPT_TOKEN_BUDGET - estimateTokens(styleContext))
        : KNOWLEDGE_PROMPT_TOKEN_BUDGET;
      const boundedKnowledgeContext = trimTextToTokenBudget(knowledgeContext, knowledgeTokensBudget);
      const systemPromptFull = systemPrompt + boundedKnowledgeContext + (styleContext ? `\n\nPERSONAL STYLE MEMORY (generation-only):\n${styleContext}` : "");
      const routingPath: string[] = [`profile:${moduleType}`, `route:${selectedRoute}`];
      if (downgraded) routingPath.push("policy-fallback:true");
      if (directMode) routingPath.push("direct-mode:true");

      const cacheRaw = lastUserMessage ? lastUserMessage.content : JSON.stringify(userMessages);
      const styleCacheTag = styleContext ? hashQuery("style-context", styleContext).slice(0, 12) : "none";
      const cacheKey = `${cacheRaw}::type=${featureKey}::intent=${moduleIntent || "none"}::profile=${moduleType}::route=${selectedRoute}::direct=${directMode ? "1" : "0"}::style=${styleCacheTag}`;
      const normalized = normalizeQuery(cacheKey);
      const hash = hashQuery("ai-chat", normalized);

      try {
        const cached = await storage.getCachedResponse("ai-chat", hash);
        if (cached && isCacheFresh(cached.createdAt)) {
          await storage.incrementCacheHit(cached.id).catch(() => {});
          const cachedContent = moduleType === "al-wakeelo" && !directMode
            ? await applyAlWakeeloSafetyGuardrails(cached.response).catch(() => ensureAlWakeeloReferencesBlock(cached.response))
            : cached.response;
          return res.json({
            content: cachedContent,
            model: usedModel,
            fromCache: true,
            moduleProfile: moduleProfile.id,
            routingPath,
            styleMemory: styleMemoryMeta || undefined,
          });
        }
      } catch {}

      if (useStream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        let fullContent = "";
        try {
          const streamMessages = buildMessages(systemPromptFull, geminiContents);
          if (selectedRoute === "turbo") {
            usedModel = getDeepSeekModelName();
            for await (const text of streamWithDeepSeek({ messages: streamMessages, maxTokens: tokenLimit, temperature })) {
              fullContent += text;
              res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
          } else {
            usedModel = getGroqModelName();
            for await (const text of streamWithGroq({ messages: streamMessages, maxTokens: tokenLimit, temperature })) {
              fullContent += text;
              res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
          }
        } catch (streamErr: any) {
          if (selectedRoute === "turbo" && isGroqAvailable()) {
            console.log("[AI Chat] DeepSeek stream failed, falling back to Groq:", streamErr?.message || streamErr);
            try {
              const fallbackMessages = buildMessages(systemPromptFull, geminiContents);
              usedModel = getGroqModelName();
              res.write(`data: ${JSON.stringify({ reset: true })}\n\n`);
              fullContent = "";
              for await (const text of streamWithGroq({ messages: fallbackMessages, maxTokens: tokenLimit, temperature })) {
                fullContent += text;
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
              }
            } catch (groqFallbackErr: any) {
              console.error("[AI Chat] Groq fallback also failed:", groqFallbackErr?.message || groqFallbackErr);
              res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
              res.end();
              return;
            }
          } else if (selectedRoute === "standard" && isOpenRouterAvailable()) {
            console.log("[AI Chat] Groq stream failed, falling back to OpenRouter:", streamErr?.message || streamErr);
            try {
              const fallbackMessages = buildMessages(systemPromptFull, geminiContents);
              usedModel = getOpenRouterModelName();
              res.write(`data: ${JSON.stringify({ reset: true })}\n\n`);
              fullContent = "";
              for await (const text of streamWithOpenRouter({ messages: fallbackMessages, maxTokens: tokenLimit, temperature })) {
                fullContent += text;
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
              }
            } catch (orFallbackErr: any) {
              console.error("[AI Chat] OpenRouter fallback also failed:", orFallbackErr?.message || orFallbackErr);
              res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
              res.end();
              return;
            }
          } else {
            console.error("[AI Chat] Stream error:", streamErr?.message || streamErr);
            res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
            res.end();
            return;
          }
        }

        if (moduleType === "al-wakeelo" && !directMode) {
          const adjusted = await applyAlWakeeloSafetyGuardrails(fullContent).catch(() => ensureAlWakeeloReferencesBlock(fullContent));
          if (adjusted !== fullContent) {
            fullContent = adjusted;
            res.write(`data: ${JSON.stringify({ reset: true })}\n\n`);
            res.write(`data: ${JSON.stringify({ text: adjusted })}\n\n`);
          }
        }

        routingPath.push(`model:${usedModel}`);
        res.write(
          `data: ${JSON.stringify({ done: true, model: usedModel, moduleProfile: moduleProfile.id, routingPath, styleMemory: styleMemoryMeta || undefined })}\n\n`,
        );
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

      const aiCall = selectedRoute === "turbo" ? callTurboAI : callStandardAI;
      const result = await aiCall(systemPromptFull, geminiContents, tokenLimit, { timeoutProfile, temperature });
      usedModel = result.model;
      routingPath.push(`model:${usedModel}`);
      let completion = result.text;

      if (moduleType === "al-wakeelo" && !directMode) {
        completion = await applyAlWakeeloSafetyGuardrails(completion).catch(() => ensureAlWakeeloReferencesBlock(completion));
      }
      if (moduleType === "draft" && moduleIntent?.startsWith("draft.")) {
        completion = normalizeDraftingText(completion);
      }
      if (moduleType === "contract-drafting" && moduleIntent === "contract.generateDraft") {
        completion = normalizeDraftingText(completion);
      }
      if (moduleType === "contract-drafting" && (moduleIntent === "contract.clauseSuggest" || moduleIntent === "contract.redline")) {
        let normalizedContractJson = normalizeStrictContractJson(moduleIntent, completion);
        if (!normalizedContractJson.valid) {
          const repairPrompt =
            moduleIntent === "contract.clauseSuggest"
              ? `Repair the response into STRICT JSON format: {"suggestions":[{"title":"...","subtitle":"...","prompt":"..."}]}. Return ONLY JSON.\n\nOriginal output:\n${completion}`
              : `Repair the response into STRICT JSON format: {"edits":[{"title":"...","rationale":"...","originalSnippet":"...","suggestedText":"..."}]}. Return ONLY JSON.\n\nOriginal output:\n${completion}`;
          const repairResult = await aiCall(systemPromptFull, [{ role: "user", parts: [{ text: repairPrompt }] }], tokenLimit, { timeoutProfile: "analysis", temperature: 0.2 });
          usedModel = repairResult.model;
          routingPath.push(`repair:${usedModel}`);
          normalizedContractJson = normalizeStrictContractJson(moduleIntent, repairResult.text);
        }
        completion = normalizedContractJson.normalized;
      }

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

      res.json({
        content: completion,
        model: usedModel,
        moduleProfile: moduleProfile.id,
        routingPath,
        styleMemory: styleMemoryMeta || undefined,
      });
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
      const safeQuery = (query || "").trim();
      if (!safeQuery) {
        return res.status(400).json({ message: "Query is required" });
      }

      const results = await storage.searchCaseLaw(safeQuery, 20);
      const verified = results.map((j) => ({
        citation: j.citation,
        court: j.court,
        title: j.title,
        summary: j.summary,
        keywords: extractKeywords(`${j.title} ${j.summary}`, 8),
        uri: ((j as unknown as { uri?: string }).uri) || "",
      }));

      // Keep this endpoint citation-safe: return only DB-verified judgments.
      res.json(verified);
    } catch (err: any) {
      console.error("Error searching judgments:", err?.message || err, err?.stack);
      res.status(500).json({ message: "Failed to search judgments", error: err?.message || "Unknown error" });
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

        const aiResult = await callStandardAISimple(sysInstruction, userInput, 6144, { timeoutProfile: "analysis", temperature: 0.3 });
        await logUsageCost(userId, "judgment-summary", aiResult.model, sysInstruction + userInput, aiResult.text);
        return aiResult.text;
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
      const safeQuery = (query || "").trim();
      if (!safeQuery) {
        return res.status(400).json({ message: "Query is required" });
      }

      const statutesResults = await storage.searchStatutes(safeQuery, 20);
      const verified = statutesResults.map((s) => ({
        shortTitle: s.shortTitle,
        section: s.section,
        description: s.description,
        punishment: s.punishment,
        uri: ((s as unknown as { uri?: string }).uri) || "",
        keywords: extractKeywords(`${s.shortTitle} ${s.section} ${s.description}`, 8),
      }));

      // Return only statute data verifiable from the database.
      res.json(verified);
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

      const { content: summary, fromCache } = await getCachedOrCall("summarize", cacheKey, async () => {
        const knowledgeContext = await gatherKnowledgeContext(query);
        const sysInstruction = `${getLegalSystemPrompt()}\n\nYou are summarizing legal findings for the user. Provide a concise, authoritative summary of the findings in relation to their query. Be precise and cite relevant provisions.${knowledgeContext}`;
        const userInput = `Query: ${query}\n\nFindings:\n${JSON.stringify(findings, null, 2)}\n\nPlease provide a comprehensive summary of these findings.`;
        const result = await callStandardAISimple(sysInstruction, userInput, TOKEN_LIMITS.summarize, { timeoutProfile: "analysis", temperature: 0.3 });
        await logUsageCost(userId, "summarize", result.model, sysInstruction + userInput, result.text);
        return result.text;
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

      let briefModel = getOpenRouterModelName();
      const { content: brief, fromCache } = await getCachedOrCall("brief", cacheKey, async () => {
        const knowledgeContext = await gatherKnowledgeContext(`${shortTitle} ${section} ${description}`);
        const sysInstruction = `${getLegalSystemPrompt()}\n\nYou are generating a detailed legal brief about a specific statute or legal provision. Provide comprehensive analysis including: scope, application, relevant case law citations, practical implications, and strategic considerations. Use the "Extensive yet Brief" style.${knowledgeContext}`;
        const userInput = `Generate a detailed legal brief for:\nTitle: ${shortTitle}\nSection: ${section}\nDescription: ${description}`;
        const result = await callStandardAISimple(sysInstruction, userInput, TOKEN_LIMITS.brief, { timeoutProfile: "analysis", temperature: 0.3 });
        briefModel = result.model;
        await logUsageCost(userId, "brief", briefModel, sysInstruction + userInput, result.text);
        return result.text;
      });

      res.json({ brief });
    } catch (err) {
      console.error("Error generating brief:", err);
      res.status(500).json({ message: "Failed to generate brief" });
    }
  });

  app.post("/api/ai/draft-risk-analysis", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);

    try {
      const allowed = await checkUsageLimit(userId, "draft", res);
      if (!allowed) return;

      const { title, content } = req.body as { title?: string; content?: string };
      const draftText = (content || "").trim();
      if (!draftText) {
        return res.json({ risks: [] });
      }

      const draftTitle = (title || "Untitled Draft").trim();
      const cacheKey = `${draftTitle}\n\n${draftText.slice(0, 14000)}`;

      const { content: responseText, fromCache } = await getCachedOrCall("draft-risk-analysis", cacheKey, async () => {
        const knowledgeContext = await gatherKnowledgeContext(`${draftTitle}\n${draftText.slice(0, 2000)}`, userId);
        const sysInstruction = `${getLegalSystemPrompt()}

You are a legal drafting risk scanner for Pakistani legal documents.

TASK:
Analyze the user's draft and identify drafting, enforceability, compliance, ambiguity, and dispute-risk issues.

OUTPUT FORMAT (STRICT):
Return ONLY valid JSON with this exact shape:
{
  "risks": [
    {
      "id": "short-stable-id",
      "title": "Short risk title",
      "detail": "1-2 sentence practical explanation of risk",
      "severity": "warning" | "danger",
      "prompt": "A direct instruction to generate a corrective clause"
    }
  ]
}

RULES:
- Return 0 to 8 risks.
- Use "danger" only for high-impact issues (enforceability/invalidity/major litigation exposure).
- Use "warning" for medium/low risks.
- Keep each detail concise and specific to the draft text.
- If no material risks are found, return {"risks":[]}.
- Do not include markdown, code fences, or extra keys.${knowledgeContext}`;

        const userInput = `Draft Title: ${draftTitle}\n\nDraft Content:\n${draftText.slice(0, 14000)}`;
        const result = await callStandardAISimple(sysInstruction, userInput, TOKEN_LIMITS.draft, { timeoutProfile: "analysis", temperature: 0.25 });
        await logUsageCost(userId, "draft", result.model, sysInstruction + userInput, result.text);
        return result.text;
      });

      let parsed: any = null;
      const cleaned = responseText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start >= 0 && end > start) {
          try {
            parsed = JSON.parse(cleaned.slice(start, end + 1));
          } catch {
            parsed = null;
          }
        }
      }

      const rawRisks = Array.isArray(parsed?.risks) ? parsed.risks : [];
      const risks = rawRisks
        .slice(0, 8)
        .map((risk: any, idx: number) => {
          const severity = risk?.severity === "danger" ? "danger" : "warning";
          const titleText = typeof risk?.title === "string" && risk.title.trim()
            ? risk.title.trim()
            : `Risk ${idx + 1}`;
          const detailText = typeof risk?.detail === "string" && risk.detail.trim()
            ? risk.detail.trim()
            : "Potential drafting issue detected in this document.";
          const promptText = typeof risk?.prompt === "string" && risk.prompt.trim()
            ? risk.prompt.trim()
            : `Draft a corrective clause to resolve: ${titleText}.`;
          const idText = typeof risk?.id === "string" && risk.id.trim()
            ? risk.id.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 48)
            : `risk-${idx + 1}`;
          return {
            id: idText || `risk-${idx + 1}`,
            title: titleText,
            detail: detailText,
            severity,
            prompt: promptText,
          };
        });

      res.json({ risks, fromCache });
    } catch (err) {
      console.error("Error generating draft risk analysis:", err);
      res.status(500).json({ message: "Failed to analyze drafting risks" });
    }
  });

  // ====== ADMIN ROUTES ======

  function stripNullBytes(text: string): string {
    return text.replace(/\x00/g, "");
  }

  async function extractPdfTextSafe(sourceBuffer: Buffer, context: string = "pdf-parse"): Promise<string> {
    const text = await extractPdfTextGuarded(sourceBuffer, {
      timeoutMs: EXTRACTION_TIMEOUT_MS,
      context,
    });
    return stripNullBytes(text);
  }

  async function extractDocxTextSafe(sourceBuffer: Buffer, context: string = "docx-parse"): Promise<string> {
    const text = await extractDocxTextGuarded(sourceBuffer, {
      timeoutMs: EXTRACTION_TIMEOUT_MS,
      context,
    });
    return stripNullBytes(text);
  }

  async function extractPdfTextWithOcrFallback(
    file: Express.Multer.File,
    context: string,
  ): Promise<string> {
    const requestedLanguage = process.env.TESSERACT_OCR_LANG || process.env.TESSERACT_LANG || "eng+urd";

    const localOcrAvailable = await isPdfOcrAvailable();
    if (localOcrAvailable) {
      try {
        const result = await extractPdfOcrGuarded(file.buffer, {
          maxPages: Number(process.env.PDF_OCR_MAX_PAGES || 8),
          dpi: Number(process.env.PDF_OCR_DPI || 220),
          language: requestedLanguage,
          timeoutMs: Number(process.env.PDF_OCR_TIMEOUT_MS || 120000),
          context,
        });
        const text = stripNullBytes((result.text || "").trim());
        if (text) {
          console.log(
            `[OCR][${context}] Extracted ${text.length} chars from ${file.originalname} using ${result.pageCount} page(s), language ${result.language}.`,
          );
          return text;
        }
      } catch (err) {
        if (isExtractionQueueFullError(err)) {
          throw err;
        }
        console.warn(`[OCR][${context}] Local OCR failed for ${file.originalname}: ${getErrorMessage(err)}`);
      }
    }

    if (!isCloudPdfOcrAvailable()) {
      return "";
    }

    try {
      const cloudResult = await ocrPdfWithCloud(file.buffer, {
        filename: file.originalname,
        language: requestedLanguage,
        timeoutMs: Number(process.env.CLOUD_OCR_TIMEOUT_MS || process.env.PDF_OCR_TIMEOUT_MS || 120000),
      });
      const text = stripNullBytes((cloudResult.text || "").trim());
      if (text) {
        console.log(
          `[OCR][${context}] Cloud OCR extracted ${text.length} chars from ${file.originalname} using ${cloudResult.pageCount} page(s), language ${cloudResult.language}.`,
        );
      }
      return text;
    } catch (err) {
      console.warn(`[OCR][${context}] Cloud OCR failed for ${file.originalname}: ${getErrorMessage(err)}`);
      return "";
    }
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
      if (process.env.NODE_ENV === "production") {
        const configuredSetupKey = process.env.ADMIN_SETUP_KEY?.trim();
        if (!configuredSetupKey) {
          return res.status(503).json({
            message: "Admin setup is disabled in production. Set ADMIN_SETUP_KEY to enable bootstrap.",
          });
        }

        const providedSetupKeyHeader = req.get("x-admin-setup-key");
        const providedSetupKeyBody = typeof req.body?.setupKey === "string" ? req.body.setupKey : "";
        const providedSetupKey = (providedSetupKeyHeader || providedSetupKeyBody).trim();
        if (!providedSetupKey || providedSetupKey !== configuredSetupKey) {
          return res.status(403).json({ message: "Invalid admin setup key" });
        }
      }

      const hasAdmin = await storage.hasAnyAdmin();
      if (hasAdmin) {
        return res.status(403).json({ message: "An admin already exists. Use the admin panel to manage admins." });
      }
      const userId = getUserId(req);
      if (!userId) return res.sendStatus(401);
      const updated = await storage.updateUserAdminStatus(userId, true);
      if (!updated) return res.status(404).json({ message: "User not found" });
      await logAuditEvent("admin.bootstrap", userId, userId, { method: "setup-endpoint" });
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
      const banMap = await getUserBanMap(allUsers.map((u) => u.id)).catch(
        () => ({} as Record<string, { reason?: string | null; bannedBy?: string | null; createdAt?: string }>),
      );
      const usersWithFlags = allUsers.map((u) => {
        const ban = banMap[u.id];
        return {
          ...u,
          isBanned: !!ban,
          banReason: ban?.reason || null,
          bannedBy: ban?.bannedBy || null,
          bannedAt: ban?.createdAt || null,
        };
      });
      res.json(usersWithFlags);
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

      const validTiers = ["standard", "pro", "chamber", "enterprise"];
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
      await logAuditEvent("admin.user.update", currentUserId, targetId, {
        subscriptionTier: subscriptionTier ?? undefined,
        isAdmin: adminFlag ?? undefined,
      });
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
      if (subscriptionTier && ["standard", "pro", "chamber", "enterprise"].includes(subscriptionTier)) {
        await storage.updateUserTier(user.id, subscriptionTier);
      }
      if (makeAdmin === true) {
        await storage.updateUserAdminStatus(user.id, true);
      }
      await logAuditEvent("admin.user.create", getUserId(req), user.id, {
        email,
        subscriptionTier: subscriptionTier || "standard",
        isAdmin: makeAdmin === true,
      });
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
      await logAuditEvent("admin.user.delete", currentUserId, targetId, {});
      res.json({ message: "User deleted successfully" });
    } catch (err) {
      console.error("Error deleting user:", err);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.get("/api/admin/users/:id/ban", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const targetId = req.params.id;
      const ban = await getUserBan(targetId);
      if (!ban) return res.json({ isBanned: false });
      res.json({
        isBanned: true,
        reason: ban.reason || null,
        bannedBy: ban.bannedBy || null,
        bannedAt: ban.createdAt,
      });
    } catch (err) {
      console.error("Error fetching user ban status:", err);
      res.status(500).json({ message: "Failed to fetch user ban status" });
    }
  });

  app.post("/api/admin/users/:id/ban", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
      const targetId = req.params.id;
      if (!actorUserId) return res.sendStatus(401);
      if (!targetId) return res.status(400).json({ message: "User id is required" });
      if (targetId === actorUserId) {
        return res.status(400).json({ message: "You cannot suspend your own account" });
      }

      const targetUser = await storage.getUserProfile(targetId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });

      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      await banUser(targetId, actorUserId, reason || undefined);
      await logAuditEvent("admin.user.ban", actorUserId, targetId, { reason: reason || null });
      res.json({ message: "User suspended successfully" });
    } catch (err) {
      console.error("Error suspending user:", err);
      res.status(500).json({ message: "Failed to suspend user" });
    }
  });

  app.delete("/api/admin/users/:id/ban", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
      const targetId = req.params.id;
      if (!targetId) return res.status(400).json({ message: "User id is required" });

      await unbanUser(targetId);
      await logAuditEvent("admin.user.unban", actorUserId, targetId, {});
      res.json({ message: "User reactivated successfully" });
    } catch (err) {
      console.error("Error reactivating user:", err);
      res.status(500).json({ message: "Failed to reactivate user" });
    }
  });

  app.get("/api/admin/audit-logs", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 200;
      const logs = await getAuditLogs(limit);
      res.json(logs);
    } catch (err) {
      console.error("Error fetching audit logs:", err);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/admin/security-events", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 200;
      res.json(getSecurityEvents(limit));
    } catch (err) {
      console.error("Error fetching security events:", err);
      res.status(500).json({ message: "Failed to fetch security events" });
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

  app.get("/api/admin/seo/status", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const siteBase = normalizeSiteBaseUrl(req);
      const parsedBase = new URL(siteBase);
      const hostname = parsedBase.hostname.toLowerCase();
      const isHttps = parsedBase.protocol === "https:";
      const isCustomDomain = !hostname.endsWith("onrender.com");

      const probe = async (url: string): Promise<{ ok: boolean; status: number; body: string; error?: string }> => {
        try {
          const response = await fetch(url, {
            method: "GET",
            redirect: "follow",
            signal: AbortSignal.timeout(7000),
          });
          const body = await response.text();
          return { ok: response.ok, status: response.status, body };
        } catch (err) {
          return {
            ok: false,
            status: 0,
            body: "",
            error: getErrorMessage(err),
          };
        }
      };

      const robotsUrl = `${siteBase}/robots.txt`;
      const sitemapUrl = `${siteBase}/sitemap.xml`;
      const homeUrl = `${siteBase}/`;

      const [robotsProbe, sitemapProbe, homeProbe] = await Promise.all([
        probe(robotsUrl),
        probe(sitemapUrl),
        probe(homeUrl),
      ]);

      const robotsText = robotsProbe.body || "";
      const sitemapText = sitemapProbe.body || "";
      const homeHtml = homeProbe.body || "";

      const sitemapMentionedInRobots = /sitemap:\s*https?:\/\/\S+/i.test(robotsText);
      const sitemapLooksValid = sitemapProbe.ok && /<urlset[\s>]/i.test(sitemapText);
      const noindexOnHome = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(homeHtml);
      const canonicalMatch = homeHtml.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
      const canonicalUrl = canonicalMatch?.[1] || null;
      let canonicalHost = "";
      if (canonicalUrl) {
        try {
          canonicalHost = new URL(canonicalUrl).hostname.toLowerCase();
        } catch {
          canonicalHost = "";
        }
      }

      const checks = [
        {
          key: "https",
          label: "HTTPS enabled",
          ok: isHttps,
          detail: siteBase,
        },
        {
          key: "custom-domain",
          label: "Custom domain active",
          ok: isCustomDomain,
          detail: hostname,
        },
        {
          key: "robots",
          label: "robots.txt reachable",
          ok: robotsProbe.ok,
          detail: robotsProbe.ok ? `HTTP ${robotsProbe.status}` : (robotsProbe.error || `HTTP ${robotsProbe.status}`),
        },
        {
          key: "robots-sitemap",
          label: "robots includes sitemap",
          ok: robotsProbe.ok && sitemapMentionedInRobots,
          detail: sitemapMentionedInRobots ? "Sitemap directive found" : "Sitemap directive missing",
        },
        {
          key: "sitemap",
          label: "sitemap.xml valid",
          ok: sitemapLooksValid,
          detail: sitemapProbe.ok ? `HTTP ${sitemapProbe.status}` : (sitemapProbe.error || `HTTP ${sitemapProbe.status}`),
        },
        {
          key: "home-indexable",
          label: "Homepage indexable",
          ok: homeProbe.ok && !noindexOnHome,
          detail: noindexOnHome ? "noindex detected on homepage" : `HTTP ${homeProbe.status}`,
        },
        {
          key: "canonical",
          label: "Canonical points to active domain",
          ok: !!canonicalUrl && canonicalHost === hostname,
          detail: canonicalUrl || "Canonical tag not found",
        },
      ];

      const failed = checks.filter((c) => !c.ok).map((c) => c.label);

      return res.json({
        siteBase,
        generatedAt: new Date().toISOString(),
        healthyChecks: checks.filter((c) => c.ok).length,
        totalChecks: checks.length,
        checks,
        urls: {
          home: homeUrl,
          robots: robotsUrl,
          sitemap: sitemapUrl,
        },
        recommendations: failed,
      });
    } catch (err) {
      console.error("Error fetching SEO status:", err);
      return res.status(500).json({ message: "Failed to fetch SEO status" });
    }
  });

  app.get("/api/admin/extraction-queue", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      res.json({
        extraction: getExtractionQueueStats(),
        uploads: getUploadQueueStats(),
      });
    } catch (err) {
      console.error("Error fetching extraction queue stats:", err);
      res.status(500).json({ message: "Failed to fetch extraction queue stats" });
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

  app.get("/api/admin/email/status", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      res.json(getEmailProviderStatus());
    } catch (err) {
      console.error("Error fetching email provider status:", err);
      res.status(500).json({ message: "Failed to fetch email provider status" });
    }
  });

  app.post("/api/admin/email/test", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
      if (!actorUserId) return res.status(401).json({ message: "Unauthorized" });

      const providedTo = sanitizeInputText(req.body?.to, 160).toLowerCase();
      const actor = await storage.getUserProfile(actorUserId);
      const to = providedTo || String(actor?.email || "").toLowerCase();
      if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return res.status(400).json({ message: "A valid recipient email is required." });
      }

      const sendResult = await sendResendTestEmail(to);
      if (!sendResult.ok) {
        return res.status(503).json({
          message: sendResult.error || "Email provider is unavailable.",
          status: getEmailProviderStatus(),
        });
      }

      await logAuditEvent("admin.email.test", actorUserId, null, {
        to,
        provider: sendResult.provider,
        messageId: sendResult.messageId || null,
      });

      res.json({
        sent: true,
        to,
        provider: sendResult.provider,
        messageId: sendResult.messageId || null,
        status: getEmailProviderStatus(),
      });
    } catch (err) {
      console.error("Error sending admin test email:", err);
      res.status(500).json({ message: "Failed to send test email" });
    }
  });

  app.get("/api/admin/client-leads", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const { limit, offset } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
      const query = sanitizeInputText(req.query.q, 200);
      const page = await storage.getCaseLeadsPage(limit, offset, query || undefined);
      res.json(page);
    } catch (err) {
      console.error("Error fetching client leads:", err);
      res.status(500).json({ message: "Failed to fetch client leads" });
    }
  });

  app.get("/api/admin/client-leads/:id", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const id = String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ message: "Lead id is required" });
      const lead = await storage.getCaseLeadById(id);
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      res.json(lead);
    } catch (err) {
      console.error("Error fetching client lead:", err);
      res.status(500).json({ message: "Failed to fetch client lead" });
    }
  });

  app.patch("/api/admin/client-leads/:id", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const id = String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ message: "Lead id is required" });
      const parsed = api.admin.clientLeads.update.input.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      const actorUserId = getUserId(req);
      const existing = await storage.getCaseLeadById(id);
      if (!existing) return res.status(404).json({ message: "Lead not found" });

      const targetStatus = parsed.data.status;
      if (existing.status === targetStatus) {
        return res.json(existing);
      }

      const updated = await storage.updateCaseLeadStatus(id, targetStatus);
      if (!updated) return res.status(500).json({ message: "Failed to update lead status" });

      await logAuditEvent("admin.clientLead.status", actorUserId, null, {
        leadId: id,
        fromStatus: existing.status,
        toStatus: updated.status,
        email: existing.email,
        caseType: existing.caseType,
      });

      res.json(updated);
    } catch (err) {
      console.error("Error updating client lead status:", err);
      res.status(500).json({ message: "Failed to update client lead status" });
    }
  });

  app.delete("/api/admin/client-leads/:id", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const id = String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ message: "Lead id is required" });
      const actorUserId = getUserId(req);
      const existing = await storage.getCaseLeadById(id);
      if (!existing) return res.status(404).json({ message: "Lead not found" });
      await storage.deleteCaseLead(id);
      await logAuditEvent("admin.clientLead.delete", actorUserId, null, {
        leadId: id,
        email: existing.email,
        caseType: existing.caseType,
      });
      res.json({ deleted: true });
    } catch (err) {
      console.error("Error deleting client lead:", err);
      res.status(500).json({ message: "Failed to delete client lead" });
    }
  });

  app.get("/api/admin/knowledge", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const { limit, offset } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
      const page = await storage.getAdminKnowledgePage(limit, offset);
      res.json(page);
    } catch (err) {
      console.error("Error fetching knowledge:", err);
      res.status(500).json({ message: "Failed to fetch knowledge" });
    }
  });

  app.post("/api/admin/knowledge", guardedUploadQueue, upload.array("files", Math.min(2000, ADMIN_UPLOAD_MAX_FILES)), async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const userId = getUserId(req)!;
      const files = req.files as Express.Multer.File[] | undefined;
      const { title, category } = req.body;

      if ((!files || files.length === 0) && !req.body.content) {
        return res.status(400).json({ message: "File(s) or content is required" });
      }

      const allowedExts = [".txt", ".json", ".csv", ".pdf", ".doc", ".docx"];
      const results: any[] = [];
      const errors: string[] = [];

      if (files && files.length > 0) {
        for (const file of files) {
          const stableFile = cloneUploadFile(file);
          const ext = file.originalname.substring(file.originalname.lastIndexOf(".")).toLowerCase();
          if (file.size > ADMIN_UPLOAD_MAX_FILE_SIZE_BYTES) {
            errors.push(`${file.originalname}: exceeds max file size (${toMbText(ADMIN_UPLOAD_MAX_FILE_SIZE_BYTES)})`);
            continue;
          }
          if (!allowedExts.includes(ext)) {
            errors.push(`${file.originalname}: unsupported format (use .txt, .json, .csv, .pdf, or .docx)`);
            continue;
          }
          if (!hasSafeDocumentSignature(file, ext)) {
            recordSecurityEvent("upload_signature_failure", `admin-knowledge:${userId}`, {
              filename: file.originalname,
              ext,
              mimetype: file.mimetype,
            });
            errors.push(`${file.originalname}: file signature does not match declared format`);
            continue;
          }
          const malwareCheck = await passesMalwareScan(file);
          if (!malwareCheck.ok) {
            recordSecurityEvent("malware_detected", `admin-knowledge:${userId}`, {
              filename: file.originalname,
              reason: malwareCheck.reason || null,
            });
            errors.push(`${file.originalname}: ${malwareCheck.reason || "malware detected"}`);
            continue;
          }

          let content = "";
          if (ext === ".pdf") {
            try {
              content = await extractPdfTextSafe(stableFile.buffer, "admin-knowledge-upload");
              console.log(`[Knowledge Upload] Extracted ${content.length} chars from ${file.originalname}`);
            } catch (pdfErr: any) {
              if (isExtractionQueueFullError(pdfErr)) return sendExtractionBusy(res);
              console.error(`[Knowledge Upload] PDF parse error for ${file.originalname}:`, pdfErr?.message || pdfErr);
              content = "";
            }
            if (!content) {
              try {
                content = await extractPdfTextWithOcrFallback(stableFile, "admin-knowledge-upload");
              } catch (ocrErr) {
                if (isExtractionQueueFullError(ocrErr)) return sendExtractionBusy(res);
                throw ocrErr;
              }
            }
            if (!content) {
              errors.push(`${file.originalname}: could not extract text (may be scanned/image PDF)`);
              continue;
            }
          } else if (ext === ".doc" || ext === ".docx") {
            try {
              content = await extractDocxTextSafe(stableFile.buffer, "admin-knowledge-upload");
              console.log(`[Knowledge Upload] Extracted ${content.length} chars from ${file.originalname}`);
            } catch (docErr: any) {
              if (isExtractionQueueFullError(docErr)) return sendExtractionBusy(res);
              console.error(`[Knowledge Upload] DOCX parse error for ${file.originalname}:`, docErr?.message || docErr);
              content = "";
            }
            if (!content) {
              errors.push(`${file.originalname}: could not extract text from document`);
              continue;
            }
          } else {
            content = stripNullBytes(stableFile.buffer.toString("utf-8"));
          }

          const docTitle = title && files.length === 1
            ? title
            : file.originalname.replace(/\.[^/.]+$/, "");

          const compacted = compactContentForDb(content);
          const extractedTextKey = compacted.wasTruncated
            ? await uploadExtractedTextToR2({
              text: content,
              fileName: file.originalname,
              prefix: `admin-knowledge-text/${userId}`,
              metadata: {
                user_id: userId,
                source: "admin-knowledge-extracted",
              },
            })
            : null;
          const persistedContent = compacted.wasTruncated && extractedTextKey ? compacted.inlineContent : content;
          const doc = await storage.addAdminKnowledge({
            title: docTitle,
            filename: file.originalname,
            content: persistedContent,
            category: category || "general",
            uploadedBy: userId,
          });
          await uploadAdminKnowledgeFileToR2({
            docId: doc.id,
            userId,
            buffer: stableFile.buffer,
            fileName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            source: "admin-knowledge",
            extractedTextKey,
          });
          results.push(doc);
          await logAuditEvent("admin.knowledge.upload", userId, null, {
            docId: doc.id,
            filename: file.originalname,
            category: category || "general",
          });
          if (content.length > 200) {
            queueAutoExtraction(content, `admin-knowledge:${file.originalname}`, {
              sourceDocId: doc.id,
              sourceType: "admin",
              sourceFilename: file.originalname,
            });
          }
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
        await logAuditEvent("admin.knowledge.upload", userId, null, {
          docId: doc.id,
          filename,
          category: category || "general",
          manual: true,
        });
        if (content.length > 200) {
          queueAutoExtraction(content, `admin-knowledge:${filename}`, {
            sourceDocId: doc.id,
            sourceType: "admin",
            sourceFilename: filename,
          });
        }
      }

      if (results.length === 0) {
        return res.status(400).json({
          message: errors[0] || "No valid files were uploaded",
          uploaded: 0,
          errors,
        });
      }

      res.status(201).json({
        uploaded: results.length,
        errors: errors.length > 0 ? errors : undefined,
        documents: results,
      });
    } catch (err) {
      if (isExtractionQueueFullError(err)) return sendExtractionBusy(res);
      console.error("Error uploading knowledge:", err);
      res.status(500).json({ message: "Failed to upload knowledge" });
    }
  });

  app.delete("/api/admin/knowledge/:id", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
      const id = Number(req.params.id);
      const fileMeta = await storage.getAdminKnowledgeFile(id);
      if (fileMeta?.provider === "r2") {
        const keys = [fileMeta.objectKey, fileMeta.extractedTextKey].filter((k): k is string => !!k);
        await Promise.allSettled(keys.map((key) => deleteR2Object(key)));
      }
      await storage.deleteAdminKnowledge(id);
      await logAuditEvent("admin.knowledge.delete", actorUserId, null, { id });
      res.sendStatus(204);
    } catch (err) {
      console.error("Error deleting knowledge:", err);
      res.status(500).json({ message: "Failed to delete knowledge" });
    }
  });

  app.delete("/api/admin/knowledge", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
      const fileMetas = await storage.getAdminKnowledgeFiles();
      const count = await storage.deleteAllAdminKnowledge();
      await Promise.allSettled(
        fileMetas
          .filter((item) => item.provider === "r2")
          .flatMap((item) => [item.objectKey, item.extractedTextKey].filter((k): k is string => !!k))
          .map((key) => deleteR2Object(key)),
      );
      await logAuditEvent("admin.knowledge.deleteAll", actorUserId, null, { count });
      res.json({ deleted: count });
    } catch (err) {
      console.error("Error deleting all knowledge:", err);
      res.status(500).json({ message: "Failed to delete all knowledge documents" });
    }
  });

  // ====== ADMIN CASE LAW MANAGEMENT ======
  app.get("/api/admin/case-law", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const { limit, offset } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
      const page = await storage.getCaseLawPage(limit, offset);
      res.json(page);
    } catch (err) {
      console.error("Error fetching case law:", err);
      res.status(500).json({ message: "Failed to fetch case law" });
    }
  });

  app.post("/api/admin/case-law", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
      const { citation, court, title, summary, keywords } = req.body;
      if (!citation || !court || !title || !summary) {
        return res.status(400).json({ message: "Citation, court, title, and summary are required" });
      }
      const keywordsArr = Array.isArray(keywords) ? keywords : (typeof keywords === "string" ? keywords.split(",").map((k: string) => k.trim()).filter(Boolean) : []);
      const created = await storage.createCaseLaw({ citation, court, title, summary, keywords: keywordsArr });
      const citationSync = await syncCaseLawEntriesToJudgments([created], actorUserId || "");
      await logAuditEvent("admin.caseLaw.create", actorUserId, null, { id: created.id, citation: created.citation });
      res.status(201).json({
        ...created,
        citationSync,
      });
    } catch (err) {
      console.error("Error creating case law:", err);
      res.status(500).json({ message: "Failed to create case law" });
    }
  });

  app.put("/api/admin/case-law/:id", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
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
      await logAuditEvent("admin.caseLaw.update", actorUserId, null, { id, citation: updated.citation });
      res.json(updated);
    } catch (err) {
      console.error("Error updating case law:", err);
      res.status(500).json({ message: "Failed to update case law" });
    }
  });

  app.delete("/api/admin/case-law/:id", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
      const id = Number(req.params.id);
      await storage.deleteCaseLaw(id);
      await logAuditEvent("admin.caseLaw.delete", actorUserId, null, { id });
      res.sendStatus(204);
    } catch (err) {
      console.error("Error deleting case law:", err);
      res.status(500).json({ message: "Failed to delete case law" });
    }
  });

  app.delete("/api/admin/case-law", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
      const count = await storage.deleteAllCaseLaw();
      await logAuditEvent("admin.caseLaw.deleteAll", actorUserId, null, { count });
      res.json({ deleted: count });
    } catch (err) {
      console.error("Error deleting all case law:", err);
      res.status(500).json({ message: "Failed to delete all case law" });
    }
  });

  app.post("/api/admin/case-law/bulk", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
      const { entries, sourceDocId, sourceFilename } = req.body as {
        entries: Array<{ citation: string; court: string; title: string; summary: string; keywords: string | string[] }>;
        sourceDocId?: number;
        sourceFilename?: string;
      };
      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ message: "Entries array is required" });
      }
      const errors: string[] = [];
      const valid: Array<{ citation: string; court: string; title: string; summary: string; keywords: string[]; sourceDocId?: number; sourceType?: string; sourceFilename?: string }> = [];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (!e.citation || !e.title) {
          errors.push(`Row ${i + 1}: Missing required fields (citation and title)`);
          continue;
        }
        const kw = Array.isArray(e.keywords) ? e.keywords : (typeof e.keywords === "string" ? e.keywords.split(",").map((k: string) => k.trim()).filter(Boolean) : []);
        const entry: any = { citation: e.citation.trim(), court: (e.court || "").trim(), title: e.title.trim(), summary: (e.summary || "").trim(), keywords: kw };
        if (sourceDocId) {
          entry.sourceDocId = sourceDocId;
          entry.sourceType = "admin";
          entry.sourceFilename = sourceFilename || "";
        }
        valid.push(entry);
      }
      const created = valid.length > 0 ? await storage.bulkCreateCaseLaw(valid) : [];
      let citationSync: {
        processed: number;
        imported: number;
        existing: number;
        skipped: number;
        failed: number;
        linked: number;
        unresolved: number;
        errors: string[];
      } | undefined;
      if (created.length > 0 && actorUserId) {
        const syncBatch = created.slice(0, CASELAW_AUTO_SYNC_MAX);
        citationSync = await syncCaseLawEntriesToJudgments(syncBatch, actorUserId);
      }
      await logAuditEvent("admin.caseLaw.bulkCreate", actorUserId, null, { inserted: created.length, errors: errors.length, sourceDocId: sourceDocId || null });
      res.status(201).json({
        inserted: created.length,
        errors,
        citationSync,
        citationSyncLimited: created.length > CASELAW_AUTO_SYNC_MAX,
      });
    } catch (err) {
      console.error("Error bulk creating case law:", err);
      res.status(500).json({ message: "Failed to bulk create case law" });
    }
  });

  app.post("/api/admin/case-law/sync-to-judgments", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
      const payload = (req.body || {}) as { caseLawIds?: number[]; limit?: number };
      const requestedIds = Array.isArray(payload.caseLawIds)
        ? payload.caseLawIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
        : [];
      const limit = Math.max(1, Math.min(5000, Number(payload.limit) || 1000));

      let entries: Array<{
        id: number;
        citation: string;
        court: string;
        title: string;
        summary: string;
        sourceDocId?: number | null;
        sourceType?: string | null;
      }> = [];

      if (requestedIds.length > 0) {
        const resolved = await Promise.all(requestedIds.map((id) => storage.getCaseLawById(id)));
        entries = resolved.filter((entry): entry is NonNullable<typeof entry> => !!entry);
      } else {
        const all = await storage.getAllCaseLaw();
        entries = [...all].sort((a, b) => b.id - a.id).slice(0, limit);
      }

      const syncResult = await syncCaseLawEntriesToJudgments(entries, actorUserId || "");
      await logAuditEvent("admin.caseLaw.syncToJudgments", actorUserId, null, {
        requested: requestedIds.length > 0 ? requestedIds.length : limit,
        ...syncResult,
      });
      res.json(syncResult);
    } catch (err) {
      console.error("Error syncing case law to judgments:", err);
      res.status(500).json({ message: "Failed to sync case law to citation database" });
    }
  });

  app.post("/api/admin/case-law/auto-extract", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const { extractFromAllExistingSources } = await import("./auto-extract-caselaw");
      extractFromAllExistingSources();
      res.json({ message: "Auto-extraction started in the background. New case law entries will appear shortly." });
    } catch (err) {
      console.error("Error starting auto-extraction:", err);
      res.status(500).json({ message: "Failed to start auto-extraction" });
    }
  });

  app.post("/api/admin/case-law/extract", guardedUploadQueue, upload.single("file"), async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      if (file.size > ADMIN_UPLOAD_MAX_FILE_SIZE_BYTES) {
        return res.status(413).json({ message: `File exceeds max size (${toMbText(ADMIN_UPLOAD_MAX_FILE_SIZE_BYTES)})` });
      }
      const stableFile = cloneUploadFile(file);

      const ext = file.originalname.split(".").pop()?.toLowerCase();
      const extWithDot = ext ? `.${ext}` : "";
      const signatureExt = extWithDot === ".text" ? ".txt" : extWithDot;
      if (![".pdf", ".doc", ".docx", ".txt", ".text", ".json", ".csv"].includes(extWithDot)) {
        return res.status(400).json({ message: "Supported formats: PDF, DOC, DOCX, TXT, JSON, CSV" });
      }
      if (!hasSafeDocumentSignature(file, signatureExt === ".text" ? ".txt" : signatureExt)) {
        recordSecurityEvent("upload_signature_failure", "admin-case-law-extract", {
          filename: file.originalname,
          ext: extWithDot,
          mimetype: file.mimetype,
        });
        return res.status(400).json({ message: "File signature does not match declared format" });
      }
      const extractMalwareCheck = await passesMalwareScan(file);
      if (!extractMalwareCheck.ok) {
        recordSecurityEvent("malware_detected", "admin-case-law-extract", {
          filename: file.originalname,
          reason: extractMalwareCheck.reason || null,
        });
        return res.status(400).json({ message: extractMalwareCheck.reason || "Malware detected in uploaded file." });
      }
      let content = "";

      if (ext === "pdf") {
        try {
          content = await extractPdfTextSafe(stableFile.buffer, "admin-case-law-extract");
        } catch (pdfErr: any) {
          if (isExtractionQueueFullError(pdfErr)) return sendExtractionBusy(res);
          console.error("[Case Law Extract] PDF parse error:", pdfErr?.message);
          content = "";
        }
        if (!content) {
          try {
            content = await extractPdfTextWithOcrFallback(stableFile, "admin-case-law-extract");
          } catch (ocrErr) {
            if (isExtractionQueueFullError(ocrErr)) return sendExtractionBusy(res);
            throw ocrErr;
          }
        }
        if (!content) {
          return res.status(400).json({ message: "Failed to extract text from PDF file. Upload searchable PDF or enable OCR dependencies." });
        }
      } else if (ext === "doc" || ext === "docx") {
        try {
          content = await extractDocxTextSafe(stableFile.buffer, "admin-case-law-extract");
        } catch (docErr: any) {
          if (isExtractionQueueFullError(docErr)) return sendExtractionBusy(res);
          console.error("[Case Law Extract] Word doc parse error:", docErr?.message);
          return res.status(400).json({ message: "Failed to parse Word document. Try uploading as TXT instead." });
        }
        if (!content) {
          return res.status(400).json({ message: "Could not extract text from Word document." });
        }
      } else if (ext === "txt" || ext === "text") {
        content = stripNullBytes(stableFile.buffer.toString("utf-8").trim());
      } else if (ext === "json") {
        const rawJson = stableFile.buffer.toString("utf-8").trim();
        try {
          const parsed = JSON.parse(rawJson);
          const entries = Array.isArray(parsed) ? parsed : (parsed.cases || parsed.entries || parsed.data || parsed.judgments || parsed.results || [parsed]);
          const getCitation = (c: any) => c.citation || c.case_citation || c.ref || c.reference || c.case_no || c.case_number || "";
          const getTitle = (c: any) => c.title || c.case_title || c.case_name || c.name || c.parties || "";
          if (Array.isArray(entries) && entries.length > 0 && (getCitation(entries[0]) || getTitle(entries[0]))) {
            const mapped = entries.filter((c: any) => getCitation(c) || getTitle(c)).map((c: any) => ({
              citation: String(getCitation(c)),
              court: String(c.court || c.court_name || c.forum || ""),
              title: String(getTitle(c)),
              summary: String(c.summary || c.description || c.abstract || c.holding || c.head_note || c.headnote || ""),
              keywords: Array.isArray(c.keywords) ? c.keywords : (typeof c.keywords === "string" ? c.keywords.split(",").map((k: string) => k.trim()).filter(Boolean) : (Array.isArray(c.tags) ? c.tags : [])),
            }));
            if (mapped.length > 0) {
              const uid = getUserId(req)!;
              let jsonDocId: number | null = null;
              try {
                const docTitle = file.originalname.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Uploaded Case Law Document";
                const compacted = compactContentForDb(rawJson);
                const extractedTextKey = compacted.wasTruncated
                  ? await uploadExtractedTextToR2({
                    text: rawJson,
                    fileName: file.originalname,
                    prefix: `admin-knowledge-text/${uid}`,
                    metadata: {
                      user_id: uid,
                      source: "admin-case-law-extracted",
                    },
                  })
                  : null;
                const persistedContent = compacted.wasTruncated && extractedTextKey ? compacted.inlineContent : rawJson;
                const savedDoc = await storage.addAdminKnowledge({ title: docTitle, filename: file.originalname, content: persistedContent, category: "case-law", uploadedBy: uid });
                jsonDocId = savedDoc.id;
                await uploadAdminKnowledgeFileToR2({
                  docId: savedDoc.id,
                  userId: uid,
                  buffer: stableFile.buffer,
                  fileName: file.originalname,
                  mimeType: file.mimetype,
                  sizeBytes: file.size,
                  source: "admin-case-law-extract",
                  extractedTextKey,
                });
                console.log(`[Case Law Extract] Saved JSON document as admin_knowledge id=${jsonDocId}`);
              } catch (saveErr) {
                console.error("[Case Law Extract] Failed to save JSON document:", saveErr);
              }
              return res.json({
                extracted: mapped.length,
                truncated: false,
                originalLength: rawJson.length,
                cases: mapped,
                savedDocId: jsonDocId,
                savedFilename: file.originalname,
              });
            }
          }
          content = JSON.stringify(parsed, null, 1);
        } catch {
          content = stripNullBytes(rawJson);
        }
      } else if (ext === "csv") {
        const rawCsv = stableFile.buffer.toString("utf-8").trim();
        const lines = rawCsv.split(/\r?\n/);
        if (lines.length > 1) {
          const header = lines[0].toLowerCase();
          if (header.includes("citation") && header.includes("title")) {
            const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/^"|"$/g, ""));
            const citIdx = headers.indexOf("citation");
            const courtIdx = headers.indexOf("court");
            const titleIdx = headers.indexOf("title");
            const sumIdx = headers.indexOf("summary");
            const kwIdx = headers.indexOf("keywords");
            const entries = [];
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
              if (cols[citIdx] && cols[titleIdx]) {
                entries.push({
                  citation: cols[citIdx] || "",
                  court: courtIdx >= 0 ? cols[courtIdx] || "" : "",
                  title: cols[titleIdx] || "",
                  summary: sumIdx >= 0 ? cols[sumIdx] || "" : "",
                  keywords: kwIdx >= 0 && cols[kwIdx] ? cols[kwIdx].split(";").map((k: string) => k.trim()).filter(Boolean) : [],
                });
              }
            }
            if (entries.length > 0) {
              const uid = getUserId(req)!;
              let csvDocId: number | null = null;
              try {
                const docTitle = file.originalname.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Uploaded Case Law Document";
                const compacted = compactContentForDb(rawCsv);
                const extractedTextKey = compacted.wasTruncated
                  ? await uploadExtractedTextToR2({
                    text: rawCsv,
                    fileName: file.originalname,
                    prefix: `admin-knowledge-text/${uid}`,
                    metadata: {
                      user_id: uid,
                      source: "admin-case-law-extracted",
                    },
                  })
                  : null;
                const persistedContent = compacted.wasTruncated && extractedTextKey ? compacted.inlineContent : rawCsv;
                const savedDoc = await storage.addAdminKnowledge({ title: docTitle, filename: file.originalname, content: persistedContent, category: "case-law", uploadedBy: uid });
                csvDocId = savedDoc.id;
                await uploadAdminKnowledgeFileToR2({
                  docId: savedDoc.id,
                  userId: uid,
                  buffer: stableFile.buffer,
                  fileName: file.originalname,
                  mimeType: file.mimetype,
                  sizeBytes: file.size,
                  source: "admin-case-law-extract",
                  extractedTextKey,
                });
                console.log(`[Case Law Extract] Saved CSV document as admin_knowledge id=${csvDocId}`);
              } catch (saveErr) {
                console.error("[Case Law Extract] Failed to save CSV document:", saveErr);
              }
              return res.json({ extracted: entries.length, truncated: false, originalLength: rawCsv.length, cases: entries, savedDocId: csvDocId, savedFilename: file.originalname });
            }
          }
        }
        content = rawCsv;
      } else {
        return res.status(400).json({ message: "Supported formats: PDF, DOC, DOCX, TXT, JSON, CSV" });
      }

      if (!content || content.length < 10) {
        return res.status(400).json({ message: "Document appears empty or too short to extract case law from." });
      }

      const userId = getUserId(req)!;
      let savedDocId: number | null = null;
      let savedFilename = file.originalname;
      try {
        const docTitle = file.originalname.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Uploaded Case Law Document";
        const compacted = compactContentForDb(content);
        const extractedTextKey = compacted.wasTruncated
          ? await uploadExtractedTextToR2({
            text: content,
            fileName: file.originalname,
            prefix: `admin-knowledge-text/${userId}`,
            metadata: {
              user_id: userId,
              source: "admin-case-law-extracted",
            },
          })
          : null;
        const persistedContent = compacted.wasTruncated && extractedTextKey ? compacted.inlineContent : content;
        const savedDoc = await storage.addAdminKnowledge({
          title: docTitle,
          filename: file.originalname,
          content: persistedContent,
          category: "case-law",
          uploadedBy: userId,
        });
        savedDocId = savedDoc.id;
        await uploadAdminKnowledgeFileToR2({
          docId: savedDoc.id,
          userId,
          buffer: stableFile.buffer,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          source: "admin-case-law-extract",
          extractedTextKey,
        });
        console.log(`[Case Law Extract] Saved document as admin_knowledge id=${savedDocId}: "${docTitle}"`);
        queueAutoExtraction(content, `admin-knowledge:${file.originalname}`, {
          sourceDocId: savedDocId,
          sourceType: "admin",
          sourceFilename: file.originalname,
        });
        await logAuditEvent("admin.caseLaw.extract", userId, null, {
          filename: file.originalname,
          savedDocId,
          extractedLength: content.length,
        });
      } catch (saveErr) {
        console.error("[Case Law Extract] Failed to save document to knowledge base:", saveErr);
      }

      const extracted = nlpExtractCases(content);
      const validCases = extracted.filter(c => c.citation && c.title);

      res.json({
        extracted: validCases.length,
        truncated: false,
        originalLength: content.length,
        cases: validCases,
        savedDocId,
        savedFilename,
      });
    } catch (err) {
      if (isExtractionQueueFullError(err)) return sendExtractionBusy(res);
      console.error("Error extracting case law:", err);
      res.status(500).json({ message: "Failed to extract case law from document" });
    }
  });

  // ====== ADMIN STATUTE DOCUMENTS ======
  app.get("/api/admin/statute-documents", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const { limit, offset } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
      const page = await storage.getStatuteDocumentsPage(limit, offset);
      res.json(page);
    } catch (err) {
      console.error("Error fetching statute documents:", err);
      res.status(500).json({ message: "Failed to fetch statute documents" });
    }
  });

  app.post("/api/admin/statute-documents", guardedUploadQueue, upload.array("files", Math.min(500, ADMIN_UPLOAD_MAX_FILES)), async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const userId = getUserId(req)!;
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const results = [];
      const errors: string[] = [];
      for (const file of files) {
        const stableFile = cloneUploadFile(file);
        let content = "";
        const ext = file.originalname.split(".").pop()?.toLowerCase();
        const extWithDot = ext ? `.${ext}` : "";

        if (file.size > ADMIN_UPLOAD_MAX_FILE_SIZE_BYTES) {
          errors.push(`${file.originalname}: exceeds max file size (${toMbText(ADMIN_UPLOAD_MAX_FILE_SIZE_BYTES)})`);
          continue;
        }

        if (![".txt", ".json", ".csv", ".pdf"].includes(extWithDot)) {
          errors.push(`${file.originalname}: unsupported format (use .txt, .json, .csv, .pdf)`);
          continue;
        }
        if (!hasSafeDocumentSignature(file, extWithDot)) {
          recordSecurityEvent("upload_signature_failure", `admin-statute:${userId}`, {
            filename: file.originalname,
            ext: extWithDot,
            mimetype: file.mimetype,
          });
          errors.push(`${file.originalname}: file signature does not match declared format`);
          continue;
        }
        const statuteMalwareCheck = await passesMalwareScan(file);
        if (!statuteMalwareCheck.ok) {
          recordSecurityEvent("malware_detected", `admin-statute:${userId}`, {
            filename: file.originalname,
            reason: statuteMalwareCheck.reason || null,
          });
          errors.push(`${file.originalname}: ${statuteMalwareCheck.reason || "malware detected"}`);
          continue;
        }

        if (ext === "pdf") {
          try {
            content = await extractPdfTextSafe(stableFile.buffer, "admin-statute-upload");
            console.log(`[Statute Upload] Extracted ${content.length} chars from ${file.originalname}`);
          } catch (pdfErr: any) {
            if (isExtractionQueueFullError(pdfErr)) return sendExtractionBusy(res);
            console.error(`[Statute Upload] PDF parse error for ${file.originalname}:`, pdfErr?.message || pdfErr);
            content = "";
          }
          if (!content) {
            try {
              content = await extractPdfTextWithOcrFallback(stableFile, "admin-statute-upload");
            } catch (ocrErr) {
              if (isExtractionQueueFullError(ocrErr)) return sendExtractionBusy(res);
              throw ocrErr;
            }
          }
          if (!content) {
            errors.push(`${file.originalname}: could not extract text from PDF`);
            continue;
          }
        } else {
          content = stripNullBytes(stableFile.buffer.toString("utf-8"));
        }

        if (!content.trim()) {
          errors.push(`${file.originalname}: document is empty`);
          continue;
        }

        const title = file.originalname
          .replace(/\.[^.]+$/, "")
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (c: string) => c.toUpperCase())
          .trim();

        const category = (req.body.category as string) || "general";

        const compacted = compactContentForDb(content);
        const extractedTextKey = compacted.wasTruncated
          ? await uploadExtractedTextToR2({
            text: content,
            fileName: file.originalname,
            prefix: `admin-statute-text/${userId}`,
            metadata: {
              user_id: userId,
              source: "admin-statute-extracted",
            },
          })
          : null;
        const persistedContent = compacted.wasTruncated && extractedTextKey ? compacted.inlineContent : content;
        const doc = await storage.addStatuteDocument({
          title,
          filename: file.originalname,
          content: persistedContent,
          category,
          uploadedBy: userId,
        });
        await uploadStatuteDocumentFileToR2({
          docId: doc.id,
          userId,
          buffer: stableFile.buffer,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          extractedTextKey,
        });
        results.push(doc);
        await logAuditEvent("admin.statuteDocs.upload", userId, null, {
          docId: doc.id,
          filename: file.originalname,
          category,
        });
        if (content.length > 200) {
          queueAutoExtraction(content, `statute:${file.originalname}`, {
            sourceDocId: doc.id,
            sourceType: "statute",
            sourceFilename: file.originalname,
          });
        }
      }

      if (results.length === 0) {
        return res.status(400).json({
          message: errors[0] || "No valid statute documents were uploaded",
          count: 0,
          failed: errors.length,
          errors,
        });
      }

      res.json({
        message: `${results.length} statute document(s) uploaded successfully`,
        count: results.length,
        failed: errors.length,
        errors,
      });
    } catch (err) {
      if (isExtractionQueueFullError(err)) return sendExtractionBusy(res);
      console.error("Error uploading statute documents:", err);
      res.status(500).json({ message: "Failed to upload statute documents" });
    }
  });

  app.delete("/api/admin/statute-documents/:id", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
      const id = Number(req.params.id);
      const fileMeta = await storage.getStatuteDocumentFile(id);
      if (fileMeta?.provider === "r2") {
        const keys = [fileMeta.objectKey, fileMeta.extractedTextKey].filter((k): k is string => !!k);
        await Promise.allSettled(keys.map((key) => deleteR2Object(key)));
      }
      await storage.deleteStatuteDocument(id);
      await logAuditEvent("admin.statuteDocs.delete", actorUserId, null, { id });
      res.sendStatus(204);
    } catch (err) {
      console.error("Error deleting statute document:", err);
      res.status(500).json({ message: "Failed to delete statute document" });
    }
  });

  app.delete("/api/admin/statute-documents", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
      const fileMetas = await storage.getStatuteDocumentFiles();
      const count = await storage.deleteAllStatuteDocuments();
      await Promise.allSettled(
        fileMetas
          .filter((item) => item.provider === "r2")
          .flatMap((item) => [item.objectKey, item.extractedTextKey].filter((k): k is string => !!k))
          .map((key) => deleteR2Object(key)),
      );
      await logAuditEvent("admin.statuteDocs.deleteAll", actorUserId, null, { count });
      res.json({ deleted: count });
    } catch (err) {
      console.error("Error deleting all statute documents:", err);
      res.status(500).json({ message: "Failed to delete all statute documents" });
    }
  });

  // ====== STATUTE TABLE OF CONTENTS (Rule-Based) ======
  app.post("/api/statute-documents/:id/toc", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const id = Number(req.params.id);
      const doc = await storage.getStatuteDocument(id);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const toc = extractTocFromText(doc.content || "");
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

  app.post("/api/profile/avatar", guardedUploadQueue, upload.single("avatar"), async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);

    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "Avatar file is required" });

      const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
      if (!allowedTypes.has(file.mimetype)) {
        return res.status(400).json({ message: "Unsupported image format. Use JPG, PNG, WEBP, or GIF." });
      }
      if (!hasSafeImageSignature(file)) {
        recordSecurityEvent("upload_signature_failure", `avatar:${userId}`, {
          filename: file.originalname,
          mimetype: file.mimetype,
        });
        return res.status(400).json({ message: "Image signature does not match declared format." });
      }
      const avatarMalwareCheck = await passesMalwareScan(file);
      if (!avatarMalwareCheck.ok) {
        recordSecurityEvent("malware_detected", `avatar:${userId}`, {
          filename: file.originalname,
          reason: avatarMalwareCheck.reason || null,
        });
        return res.status(400).json({ message: avatarMalwareCheck.reason || "Malware detected in uploaded image." });
      }

      const maxSizeBytes = 2 * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        return res.status(400).json({ message: "Image too large. Maximum size is 2MB." });
      }

      const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      const updated = await storage.updateUserProfile(userId, { profileImageUrl: dataUrl });
      if (!updated) return res.status(404).json({ message: "Profile not found" });

      res.json({ profileImageUrl: updated.profileImageUrl });
    } catch (err) {
      console.error("Error uploading avatar:", err);
      res.status(500).json({ message: "Failed to upload profile image" });
    }
  });

  app.delete("/api/profile/avatar", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);

    try {
      const updated = await storage.updateUserProfile(userId, { profileImageUrl: null });
      if (!updated) return res.status(404).json({ message: "Profile not found" });
      res.json({ profileImageUrl: null });
    } catch (err) {
      console.error("Error removing avatar:", err);
      res.status(500).json({ message: "Failed to remove profile image" });
    }
  });

  app.post("/api/seed-legal-data", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      await seedLegalData();
      res.json({ message: "Legal data seeded successfully" });
    } catch (err) {
      console.error("Error seeding legal data:", err);
      res.status(500).json({ message: "Failed to seed legal data" });
    }
  });

  if (dbAvailable) {
    await seedLegalData();
    syncGithubKnowledge().catch(err => console.error("[GitHub Sync] Background sync failed:", err));
  } else {
    console.warn("[Startup] Skipping legal data seed and GitHub sync because DB is unavailable.");
  }

  app.get("/api/saved-judgments", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const saved = await storage.getSavedJudgments(userId);
      res.json(saved);
    } catch (err) {
      console.error("Error fetching saved judgments:", err);
      res.status(500).json({ message: "Failed to fetch saved judgments" });
    }
  });

  app.post("/api/saved-judgments", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const { citation, court, title, summary, keywords, uri, source, aiAnalysis } = req.body;
      if (!citation || !title || !summary) {
        return res.status(400).json({ message: "Citation, title, and summary are required" });
      }
      const existing = await storage.getSavedJudgments(userId);
      const alreadySaved = existing.find(j => j.citation === citation && j.title === title);
      if (alreadySaved) {
        return res.status(200).json(alreadySaved);
      }
      const saved = await storage.saveJudgment({
        userId,
        citation,
        court: court || "",
        title,
        summary,
        keywords: keywords || null,
        uri: uri || null,
        source: source || null,
        aiAnalysis: aiAnalysis || null,
      });
      res.status(201).json(saved);
    } catch (err) {
      console.error("Error saving judgment:", err);
      res.status(500).json({ message: "Failed to save judgment" });
    }
  });

  app.delete("/api/saved-judgments/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      await storage.deleteSavedJudgment(Number(req.params.id), userId);
      res.sendStatus(204);
    } catch (err) {
      console.error("Error deleting saved judgment:", err);
      res.status(500).json({ message: "Failed to delete saved judgment" });
    }
  });

  app.get("/api/statute-lookup", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const name = (req.query.name as string) || "";
      const section = (req.query.section as string) || "";
      const searchTerm = `${name} ${section}`.trim();
      if (!searchTerm) return res.json({ found: false });

      const statuteResults = await storage.searchStatutes(searchTerm, 5);
      if (statuteResults.length > 0) {
        return res.json({
          found: true,
          statutes: statuteResults.map(s => ({
            shortTitle: s.shortTitle,
            section: s.section,
            description: s.description,
            punishment: s.punishment,
          })),
        });
      }

      const docResults = await storage.searchStatuteDocuments(searchTerm, 3);
      if (docResults.length > 0) {
        return res.json({
          found: true,
          documents: docResults.map(d => ({
            id: d.id,
            title: d.title,
            content: d.content.substring(0, 5000),
            category: d.category,
          })),
        });
      }

      const ghResults = await storage.searchGithubKnowledge(searchTerm, 2);
      if (ghResults.length > 0) {
        return res.json({
          found: true,
          knowledgeVault: ghResults.map(g => ({
            title: g.title,
            content: g.content.substring(0, 5000),
          })),
        });
      }

      res.json({ found: false });
    } catch (err) {
      console.error("Error in statute lookup:", err);
      res.status(500).json({ message: "Failed to look up statute" });
    }
  });

  app.post("/api/ai/document-chat", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const allowed = await checkUsageLimit(userId, "chat", res);
      if (!allowed) return;

      const { documentType, documentTitle, documentContent, messages } = req.body as {
        documentType: string;
        documentTitle: string;
        documentContent: string;
        messages: Array<{ role: string; content: string }>;
      };

      if (!documentTitle || !messages || messages.length === 0) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const docLabel = documentType === "judgment" ? "court judgment" : "statute/legal document";
      const systemPrompt = `You are Al Wakeelo, a Pakistani legal assistant AI. You are helping the user understand a specific ${docLabel}.

Document Title: ${documentTitle}

Document Content (excerpt):
${(documentContent || "").slice(0, 6000)}

Instructions:
- Answer questions specifically about this document
- Cite specific sections, articles, or clauses when relevant
- Provide clear, professional legal analysis
- If the user asks about something not covered in the document, mention that and provide general legal guidance
- Use proper Pakistani legal terminology
- Format responses with clear headings and bullet points when helpful`;

      const chatHistory = messages.slice(-10).map(m => ({
        role: m.role === "user" ? "user" as const : "model" as const,
        parts: [{ text: m.content }],
      }));

      const result = await callStandardAI(systemPrompt, chatHistory, 4096, { timeoutProfile: "analysis", temperature: 0.3 });

      const aiResponse = result.text;
      const inputText = systemPrompt + messages.map(m => m.content).join("\n");
      await logUsageCost(userId, "chat", result.model, inputText, aiResponse);

      res.json({ content: aiResponse });
    } catch (err: any) {
      console.error("Error in document chat:", err);
      if (err?.status === 429 || err?.message?.includes("429")) {
        return res.status(429).json({ message: "Rate limit exceeded" });
      }
      res.status(500).json({ message: "Failed to generate response" });
    }
  });

  // ========== APEX AI MODEL ROUTES ==========

  app.get("/api/apex/models", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const tier = normalizeTier(await storage.getUserTier(userId));
    const available = isApexAvailable();
    const models = available ? getApexModelsForTier(tier) : [];
    res.json({ available, models, tier });
  });

  app.post("/api/apex/chat", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const tier = normalizeTier(await storage.getUserTier(userId));
    const tierPlan = getTierPlan(tier);

    if (!isApexAvailable()) {
      return res.status(503).json({ message: "Apex AI is not configured" });
    }

    const { model, message, threadId, systemContext } = req.body;
    if (!model || !message) {
      return res.status(400).json({ message: "Model and message are required" });
    }

    const allowedModels = getApexModelsForTier(tier);
    if (!allowedModels.find(m => m.id === model)) {
      return res.status(403).json({ message: `Your ${tier} plan does not include access to this model` });
    }

    const allowed = await checkUsageLimit(userId, "chat", res);
    if (!allowed) return;

    const apexMonthlyCap = Math.max(0, Number(tierPlan.apexMonthlyCap || 0));
    const apexUsedThisMonth = await storage.getMonthlyUsageCountByFeature(userId, "chat-apex");
    if (apexMonthlyCap > 0 && apexUsedThisMonth >= apexMonthlyCap) {
      return res.status(429).json({
        message: `Apex monthly cap reached (${apexMonthlyCap}/${apexMonthlyCap}) on ${tierPlan.label} plan. Use Standard/Turbo or upgrade.`,
        cap: apexMonthlyCap,
        used: apexUsedThisMonth,
      });
    }

    const apexRequestCap = Math.max(256, getModeOutputCap(tier, "apex") || 1800);

    try {
      let systemPrompt = getLegalSystemPrompt();
      if (systemContext) {
        systemPrompt += `\n\n${systemContext}`;
      }

      const knowledgeContext = await gatherKnowledgeContext(message, userId);
      systemPrompt += knowledgeContext;

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt },
      ];

      if (threadId) {
        const threadMessages = await storage.getMessages(threadId);
        const recentMessages = threadMessages.slice(-10);
        for (const tm of recentMessages) {
          messages.push({ role: tm.role as "user" | "assistant", content: tm.content });
        }
      }

      messages.push({ role: "user", content: message });

      let responseContent = "";
      let responseReasoning: string | undefined;
      let responseModel = "";

      try {
        // Apex mode primary routing: try all available Kimi models for this tier.
        const kimiModelsOrdered = [
          model as ApexModel,
          ...allowedModels.map((m) => m.id).filter((id) => id !== model),
        ] as ApexModel[];

        const seen = new Set<ApexModel>();
        const primaryCandidates = kimiModelsOrdered.filter((m) => {
          if (seen.has(m)) return false;
          seen.add(m);
          return true;
        });

        let lastKimiError: unknown;
        let primarySucceeded = false;
        const apexStartedAt = Date.now();

        for (let i = 0; i < primaryCandidates.length; i++) {
          const kimi = primaryCandidates[i];
          try {
            const result = await withTimeout(
              `Kimi(${kimi})`,
              MODEL_TIMEOUT_MS.apexPrimary,
              () => chatWithApex({
                model: kimi,
                messages,
                maxTokens: apexRequestCap,
              }),
            );
            responseContent = result.content;
            responseReasoning = result.reasoning;
            responseModel = result.model;
            primarySucceeded = true;
            console.log(`[AI Routing][apex] Primary Kimi(${kimi}) succeeded in ${Date.now() - apexStartedAt}ms`);
            break;
          } catch (kimiErr) {
            lastKimiError = kimiErr;
            const nextKimi = primaryCandidates[i + 1];
            if (nextKimi) {
              logModelSwitch("apex", `Kimi(${kimi})`, `Kimi(${nextKimi})`, kimiErr);
            }
          }
        }

        if (!primarySucceeded) {
          if (isDeepSeekAvailable()) {
            logModelSwitch("apex", "Kimi", "DeepSeek Pro", lastKimiError);
            const dsResult = await withTimeout(
              "DeepSeek Pro",
              MODEL_TIMEOUT_MS.apexFallback,
              () => chatWithDeepSeekPro({ messages, maxTokens: apexRequestCap }),
            );
            responseContent = dsResult.content;
            responseReasoning = undefined;
            responseModel = dsResult.model;
            console.log(`[AI Routing][apex] Fallback DeepSeek Pro succeeded in ${Date.now() - apexStartedAt}ms`);
          } else {
            throw lastKimiError || new Error("All Kimi models failed and DeepSeek Pro fallback is unavailable.");
          }
        }
      } catch (apexErr: any) {
        throw apexErr;
      }

      const actualModel = responseModel;
      const safeResponseContent = await applyAlWakeeloSafetyGuardrails(responseContent).catch(() => ensureAlWakeeloReferencesBlock(responseContent));
      const inputText = messages.map(m => m.content).join("\n");
      await logUsageCost(userId, "chat-apex", actualModel, inputText, safeResponseContent);

      res.json({
        content: safeResponseContent,
        reasoning: responseReasoning,
        model: responseModel,
      });
    } catch (err: any) {
      console.error("Error in Apex chat:", err);
      if (err?.status === 429 || err?.message?.includes("429")) {
        return res.status(429).json({ message: "Rate limit exceeded. Please try again shortly." });
      }
      res.status(500).json({ message: err.message || "Failed to generate response" });
    }
  });

  // ========== ORGANIZATION / TEAM ROUTES ==========

  app.get("/api/org", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const org = await storage.getUserOrganization(userId);
    res.json(org || null);
  });

  app.post("/api/org", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserProfile(userId);
    if (!user || (normalizeTier(user.subscriptionTier) !== "pro" && normalizeTier(user.subscriptionTier) !== "chamber" && normalizeTier(user.subscriptionTier) !== "enterprise" && !user.isAdmin)) {
      return res.status(403).json({ message: "Only Pro, Chamber, and Enterprise users can create organizations" });
    }
    const existing = await storage.getUserOrganization(userId);
    if (existing) return res.status(400).json({ message: "You already belong to an organization" });
    const { name, description } = req.body;
    if (!name || typeof name !== "string") return res.status(400).json({ message: "Organization name is required" });
    const org = await storage.createOrganization({ name, description: description || null, ownerId: userId });
    res.json(org);
  });

  app.delete("/api/org/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const orgId = parseInt(String(req.params.id));
    const org = await storage.getOrganization(orgId);
    if (!org || org.ownerId !== userId) return res.status(403).json({ message: "Only the organization owner can delete it" });
    await storage.deleteOrganization(orgId);
    res.json({ message: "Organization deleted" });
  });

  app.get("/api/org/:id/members", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const orgId = parseInt(String(req.params.id));
    const isMember = await storage.isOrgMember(orgId, userId);
    if (!isMember) return res.status(403).json({ message: "Not a member of this organization" });
    const members = await storage.getOrgMembers(orgId);
    res.json(members);
  });

  app.post("/api/org/:id/invite", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const orgId = parseInt(String(req.params.id));
    const org = await storage.getOrganization(orgId);
    if (!org) return res.status(404).json({ message: "Organization not found" });
    if (org.ownerId !== userId) return res.status(403).json({ message: "Only the owner can invite members" });
    const { email } = req.body;
    if (!email || typeof email !== "string") return res.status(400).json({ message: "Email is required" });
    const invite = await storage.createOrgInvite({ orgId, email: email.toLowerCase(), invitedBy: userId });
    res.json(invite);
  });

  app.get("/api/org/:id/invites", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const orgId = parseInt(String(req.params.id));
    const org = await storage.getOrganization(orgId);
    if (!org || org.ownerId !== userId) return res.status(403).json({ message: "Only the owner can view invites" });
    const invites = await storage.getOrgInvites(orgId);
    res.json(invites);
  });

  app.delete("/api/org/:orgId/members/:memberId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const orgId = parseInt(String(req.params.orgId));
    const memberId = req.params.memberId;
    const org = await storage.getOrganization(orgId);
    if (!org || org.ownerId !== userId) return res.status(403).json({ message: "Only the owner can remove members" });
    if (memberId === userId) return res.status(400).json({ message: "Cannot remove yourself as owner" });
    await storage.removeOrgMember(orgId, memberId);
    res.json({ message: "Member removed" });
  });

  app.get("/api/org/invites/pending", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const userProfile = await storage.getUserProfile(userId);
    if (!userProfile) return res.status(401).json({ message: "Unauthorized" });
    const invites = await storage.getPendingInvitesForUser(userProfile.email || "");
    res.json(invites);
  });

  app.post("/api/org/invites/:id/accept", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const userProfile = await storage.getUserProfile(userId);
    if (!userProfile) return res.status(401).json({ message: "Unauthorized" });
    const inviteId = parseInt(String(req.params.id));
    const pendingInvites = await storage.getPendingInvitesForUser(userProfile.email || "");
    const invite = pendingInvites.find((i: any) => i.id === inviteId);
    if (!invite) return res.status(403).json({ message: "This invite does not belong to you" });
    const existingOrg = await storage.getUserOrganization(userId);
    if (existingOrg) return res.status(400).json({ message: "You already belong to an organization" });
    await storage.acceptOrgInvite(inviteId, userId);
    res.json({ message: "Invite accepted" });
  });

  app.post("/api/org/invites/:id/decline", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const userProfile = await storage.getUserProfile(userId);
    if (!userProfile) return res.status(401).json({ message: "Unauthorized" });
    const inviteId = parseInt(String(req.params.id));
    const pendingInvites = await storage.getPendingInvitesForUser(userProfile.email || "");
    const invite = pendingInvites.find((i: any) => i.id === inviteId);
    if (!invite) return res.status(403).json({ message: "This invite does not belong to you" });
    await storage.declineOrgInvite(inviteId);
    res.json({ message: "Invite declined" });
  });

  // ========== ORG KNOWLEDGE ROUTES ==========

  app.get("/api/org/:id/knowledge", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const orgId = parseInt(String(req.params.id));
    const isMember = await storage.isOrgMember(orgId, userId);
    if (!isMember) return res.status(403).json({ message: "Not a member" });
    const docs = await storage.getOrgKnowledge(orgId);
    res.json(docs);
  });

  const orgKnowledgeUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES,
      files: DOCUMENT_UPLOAD_MAX_FILES,
    },
  });

  app.post("/api/org/:id/knowledge", guardedUploadQueue, orgKnowledgeUpload.single("file"), async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const orgId = parseInt(String(req.params.id));
    const isMember = await storage.isOrgMember(orgId, userId);
    if (!isMember) return res.status(403).json({ message: "Not a member" });

    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });
    if (file.size > DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES) {
      return res.status(413).json({ message: `File exceeds max size (${toMbText(DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES)})` });
    }

    let content = "";
    const filename = file.originalname.toLowerCase();

    try {
      if (filename.endsWith(".txt")) {
        if (!hasSafeDocumentSignature(file, ".txt")) {
          recordSecurityEvent("upload_signature_failure", `org-knowledge:${orgId}`, {
            filename: file.originalname,
            ext: ".txt",
            mimetype: file.mimetype,
          });
          return res.status(400).json({ message: "File signature does not match .txt format." });
        }
        content = file.buffer.toString("utf-8");
      } else if (filename.endsWith(".pdf")) {
        if (!hasSafeDocumentSignature(file, ".pdf")) {
          recordSecurityEvent("upload_signature_failure", `org-knowledge:${orgId}`, {
            filename: file.originalname,
            ext: ".pdf",
            mimetype: file.mimetype,
          });
          return res.status(400).json({ message: "File signature does not match .pdf format." });
        }
        content = await extractPdfTextSafe(file.buffer, "org-knowledge-upload");
        if (!content.trim()) {
          content = await extractPdfTextWithOcrFallback(file, "org-knowledge-upload");
        }
      } else if (filename.endsWith(".docx")) {
        if (!hasSafeDocumentSignature(file, ".docx")) {
          recordSecurityEvent("upload_signature_failure", `org-knowledge:${orgId}`, {
            filename: file.originalname,
            ext: ".docx",
            mimetype: file.mimetype,
          });
          return res.status(400).json({ message: "File signature does not match .docx format." });
        }
        content = await extractDocxTextSafe(file.buffer, "org-knowledge-upload");
      } else {
        return res.status(400).json({ message: "Unsupported file type. Use TXT, PDF, or DOCX." });
      }

      const orgMalwareCheck = await passesMalwareScan(file);
      if (!orgMalwareCheck.ok) {
        recordSecurityEvent("malware_detected", `org-knowledge:${orgId}`, {
          filename: file.originalname,
          reason: orgMalwareCheck.reason || null,
        });
        return res.status(400).json({ message: orgMalwareCheck.reason || "Malware detected in uploaded file." });
      }
    } catch (err: any) {
      if (isExtractionQueueFullError(err)) {
        return sendExtractionBusy(res);
      }
      return res.status(500).json({ message: "Failed to extract text from file" });
    }

    const title = req.body.title || file.originalname;
    const category = req.body.category || "general";

    const doc = await storage.addOrgKnowledge({
      orgId,
      title,
      filename: file.originalname,
      content,
      category,
      uploadedBy: userId,
    });

    res.json(doc);
  });

  app.delete("/api/org/:orgId/knowledge/:docId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const orgId = parseInt(String(req.params.orgId));
    const docId = parseInt(req.params.docId);
    const org = await storage.getOrganization(orgId);
    if (!org) return res.status(404).json({ message: "Organization not found" });
    if (org.ownerId !== userId) return res.status(403).json({ message: "Only the organization owner can delete knowledge documents" });
    await storage.deleteOrgKnowledge(docId);
    res.json({ message: "Knowledge document deleted" });
  });

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
