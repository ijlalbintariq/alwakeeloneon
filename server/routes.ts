import type { Express, NextFunction, Request } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import {
  insertBookmarkSchema,
  insertSearchHistorySchema,
  statutes,
  caseLaw,
  judgments,
  courtsRef,
  threads,
  documents,
  adminKnowledge,
  adminKnowledgeFiles,
  TIER_LIMITS,
  type CaseLaw,
} from "@shared/schema";
import { and, count, desc, eq, ilike, lt, sql, like, or } from "drizzle-orm";
import { db, dbAvailable, pool } from "./db";
import { requireDatabase } from "./middleware/db-guard";
import {
  assignCitationRolesToCases,
  nlpExtractCases,
  queueAutoExtraction,
  reindexCaseLawFromAllExistingSources,
  type CaseLawRoleReindexProgress,
} from "./auto-extract-caselaw";
import crypto from "crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import multer from "multer";
import { isApexAvailable, getApexModelsForTier, chatWithApex, transcribeWithApex, chatWithApexAgent, type ApexModel, type ApexAgentResponse } from "./apex-ai";
// DEPRECATED: Groq integration removed - using DeepSeek only (2026-04-16)
// import { chatWithGroq, streamWithGroq, isGroqAvailable, getGroqModelName, transcribeWithGroq } from "./groq-ai";
import { chatWithDeepSeek, chatWithDeepSeekPro, streamWithDeepSeek, transcribeWithDeepSeek, isDeepSeekAvailable, getDeepSeekProModelName, runToolJudgmentSearch, repairReferencesJson } from "./deepseek-ai";
import { runToolJudgmentSearchOR, isOpenRouterAvailable } from "./openrouter-ai";
import {
  isAiRouterV2Enabled,
  raceToDeadline,
  streamWithFallback,
  callWithFallback,
  DEFAULT_STANDARD_CHAIN,
  DEFAULT_TURBO_CHAIN,
} from "./ai-router";
import { getModuleProfile, normalizeModuleType, type ModuleIntent, type ModuleType } from "./ai-module-profiles";
import { banUser, getAuditLogs, getUserBan, getUserBanMap, isUserBanned, logAuditEvent, unbanUser } from "./security-governance";
import { scanUploadedBuffer } from "./file-scan";
import { getSecurityEvents, recordSecurityEvent } from "./security-monitoring";
import { classifyDocumentMetadata, type DocumentMetadata } from "./document-classifier";
import { generateClauseFromPrompt, suggestClauses } from "./retrieval/clause-library";
import { extractTocFromText } from "./retrieval/toc-parser";
import { citationExtractor } from "./services/citation-extractor";
import { gatherKnowledgeContextV2, type ConversationTurn } from "./pipeline/knowledge-pipeline";
import { detectQueryComplexity, isFollowUpQuestion, type QueryComplexity } from "./pipeline/intent-classifier";
import {
  GLOBAL_ADMIN_KNOWLEDGE_RAG_USER_ID,
  GLOBAL_CASELAW_RAG_USER_ID,
  GLOBAL_STATUTE_RAG_USER_ID,
  GLOBAL_JUDGMENTS_RAG_USER_ID,
  buildRagContext,
  deleteDocumentVectors,
  ensureIndexedForGlobalAdminSources,
  indexAdminKnowledgeDocument,
  indexAdminStatuteDocument,
  ensureIndexedForUserDocuments,
  indexAdminCaseLawDocument,
  indexJudgmentDocument,
  indexUserDocument,
  retrieveForQuery,
} from "./rag/rag-service";
import { isPdfOcrAvailable } from "./ocr";
import { isCloudPdfOcrAvailable, ocrPdfWithCloud } from "./cloud-ocr";
import { isWhisperCppConfigured, transcribeWithWhisperCpp } from "./whisper-local";
import { deleteR2Object, getR2ObjectBinary, getR2ObjectText, uploadBufferToR2 } from "./r2-storage";
import { getEmailProviderStatus, sendResendTestEmail } from "./email";
import { verifyCaptchaToken } from "./captcha";
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
  draft: 8192,
  "contract-drafting": 4096,
};

// Citation strictness policy: controls how aggressively citations are filtered
type CitationPolicy = {
  strict: boolean; // true: require primary + linked source; false: allow DB-backed primary or cited
  allowProseModification: boolean; // true: delete prose lines containing removed citations; false: preserve prose
};

const DEFAULT_CITATION_POLICY: CitationPolicy = {
  strict: false,
  allowProseModification: false, // Non-strict mode: preserve prose integrity
};

const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  "gemini-3-flash-preview": { input: 0.00015, output: 0.0006 },
  "gemini-3-pro-preview": { input: 0.00125, output: 0.005 },
  "google/gemini-2.0-flash-001": { input: 0.0001, output: 0.0004 },
};

const INLINE_DB_CONTENT_LIMIT = Math.max(5000, Number(process.env.DB_INLINE_CONTENT_MAX_CHARS || 60000));
const MB = 1024 * 1024;
const UPLOAD_STORAGE_MODE = String(process.env.UPLOAD_STORAGE_MODE || "memory").trim().toLowerCase();
const USE_DISK_UPLOAD_STORAGE = UPLOAD_STORAGE_MODE === "disk";
const UPLOAD_TEMP_DIR = String(process.env.UPLOAD_TEMP_DIR || os.tmpdir()).trim() || os.tmpdir();
const DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES = Math.max(5, Number(process.env.DOCUMENT_UPLOAD_MAX_FILE_MB || 75)) * MB;
const DOCUMENT_UPLOAD_MAX_FILES = Math.max(1, Number(process.env.DOCUMENT_UPLOAD_MAX_FILES || 25));
const ADMIN_UPLOAD_MAX_FILE_SIZE_BYTES = Math.max(5, Number(process.env.ADMIN_UPLOAD_MAX_FILE_MB || 75)) * MB;
const ADMIN_UPLOAD_MAX_FILES = Math.max(1, Number(process.env.ADMIN_UPLOAD_MAX_FILES || 200));
const GENERAL_UPLOAD_MAX_FILE_SIZE_BYTES = Math.max(2, Number(process.env.GENERAL_UPLOAD_MAX_FILE_MB || 75)) * MB;
const EXTRACTION_TIMEOUT_MS = Math.max(3000, Number(process.env.EXTRACTION_TIMEOUT_MS || 120000));
const UPLOAD_QUEUE_CONCURRENCY = Math.max(1, Number(process.env.UPLOAD_QUEUE_CONCURRENCY || 2));
const UPLOAD_QUEUE_MAX_PENDING = Math.max(UPLOAD_QUEUE_CONCURRENCY, Number(process.env.UPLOAD_QUEUE_MAX_PENDING || 32));
const CASELAW_AUTO_SYNC_MAX = Math.max(1, Number(process.env.CASELAW_AUTO_SYNC_MAX || 5000));
const CASELAW_AUTO_SYNC_ON_UPLOAD = (() => {
  const raw = String(process.env.CASELAW_AUTO_SYNC_ON_UPLOAD || "false").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
})();
const CASELAW_AUTO_PROCESS_PENDING_ON_UPLOAD = (() => {
  const raw = String(process.env.CASELAW_AUTO_PROCESS_PENDING_ON_UPLOAD || "true").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
})();
const CASELAW_AUTO_FULL_SYNC_ON_UPLOAD = (() => {
  const raw = String(process.env.CASELAW_AUTO_FULL_SYNC_ON_UPLOAD || "true").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
})();
const CASELAW_PENDING_MAX_ATTEMPTS = Math.max(1, Number(process.env.CASELAW_PENDING_MAX_ATTEMPTS || 3));
const CASELAW_PENDING_PROCESSING_STALE_MINUTES = Math.max(5, Number(process.env.CASELAW_PENDING_PROCESSING_STALE_MINUTES || 60));
const STYLE_MEMORY_ENABLED = String(process.env.STYLE_MEMORY_ENABLED || "true").toLowerCase() !== "false";
const STYLE_CONTEXT_MIN_CONFIDENCE = Math.max(0, Number(process.env.STYLE_CONTEXT_MIN_CONFIDENCE || 0.56));
const STYLE_PROMPT_TOKEN_BUDGET = Math.max(200, Number(process.env.STYLE_PROMPT_TOKEN_BUDGET || 900));
const KNOWLEDGE_PROMPT_TOKEN_BUDGET = Math.max(400, Number(process.env.KNOWLEDGE_PROMPT_TOKEN_BUDGET || 3800));
const ATTACHMENT_PROMPT_TOKEN_BUDGET = Math.max(500, Number(process.env.ATTACHMENT_PROMPT_TOKEN_BUDGET || 2200));
const ATTACHMENT_FILE_TOKEN_BUDGET = Math.max(150, Number(process.env.ATTACHMENT_FILE_TOKEN_BUDGET || 800));
const CASELAW_RAG_INDEX_DOC_TIMEOUT_MS = Math.max(5000, Number(process.env.CASELAW_RAG_INDEX_DOC_TIMEOUT_MS || 45000));
const ADMIN_UPLOAD_AUTO_INDEX = (() => {
  const raw = String(process.env.ADMIN_UPLOAD_AUTO_INDEX || "false").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
})();
const LEGAL_DRAFT_DOC_PREFIX = "Legal Draft:";
const CONTRACT_DRAFT_DOC_PREFIX = "Contract Draft:";
const PUBLIC_CHAT_MESSAGE_LIMIT = Math.max(1, Number(process.env.PUBLIC_CHAT_MESSAGE_LIMIT || 10));
const PUBLIC_CHAT_WINDOW_HOURS = Math.max(1, Number(process.env.PUBLIC_CHAT_WINDOW_HOURS || 24));
const PUBLIC_CHAT_MAX_INPUT_CHARS = Math.max(300, Number(process.env.PUBLIC_CHAT_MAX_INPUT_CHARS || 2000));
const PUBLIC_LEAD_MAX_DESCRIPTION_CHARS = Math.max(500, Number(process.env.PUBLIC_LEAD_MAX_DESCRIPTION_CHARS || 6000));
const PUBLIC_LEAD_MAX_CITY_CHARS = Math.max(20, Number(process.env.PUBLIC_LEAD_MAX_CITY_CHARS || 80));
const PUBLIC_LEAD_MAX_CALLBACK_CHARS = Math.max(20, Number(process.env.PUBLIC_LEAD_MAX_CALLBACK_CHARS || 120));
const PUBLIC_CHAT_LIMIT_MESSAGE = "You have reached the free AI consultation limit. For professional legal assistance you can contact our chamber or hire a lawyer.";
const PAKISTAN_LAW_ONLY_POLICY = `PAKISTAN LAW ONLY POLICY (ABSOLUTE):
- Restrict all legal analysis, drafting, citations, and recommendations to Pakistani law only.
- Disallowed Indian statutes (never cite as authority): IPC, Indian Penal Code, CrPC 1973, Constitution of India, Indian Evidence Act.
- Indian judgments (SCC, AIR) are PERMITTED as persuasive authority where relevant — cite them freely.
- If a user asks for Indian statutory law, briefly decline and reframe under the Pakistani equivalent.
- Prefer Pakistani authorities such as PPC, Cr.P.C. 1898, C.P.C. 1908, Constitution of Islamic Republic of Pakistan 1973.
- Treat these as Pakistani citation/report families: PLD, SCMR, YLR, MLD, CLC, CLD, PLC (Pakistan Labour Cases), PLJ, PCRLJ/P Cr. L J, PTD, NLR, and neutral citations (LHC/IHC/SHC/PHC/BHC/AJKHC).
- IDENTITY/TRUTHFULNESS: Never claim a specific underlying AI vendor, model family, or architecture (for example “OpenAI GPT-4”) unless the exact provider/model is explicitly supplied by runtime metadata in this session.
- If asked “which model are you built on?”, respond neutrally: “I am Al Wakeelo. Model routing can vary by mode and deployment configuration.”`;
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
- If user writes in English, reply in English.

${PAKISTAN_LAW_ONLY_POLICY}`;
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
let adminUploadIndexDisabledLogged = false;
let caseLawAutoSyncDisabledLogged = false;

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

function stripNullBytes(text: string): string {
  return String(text || "").replace(/\x00/g, "");
}

function withPakistanLawOnlyPolicy(systemPrompt: string): string {
  const base = String(systemPrompt || "").trim();
  if (!base) return PAKISTAN_LAW_ONLY_POLICY;
  if (base.includes("PAKISTAN LAW ONLY POLICY (ABSOLUTE):")) return base;
  return `${base}\n\n${PAKISTAN_LAW_ONLY_POLICY}`;
}

const BROKEN_LEGAL_TERMS: Array<[RegExp, string]> = [
  [/\bCr\s+iminal\b/g, "Criminal"],
  [/\bcr\s+iminal\b/g, "criminal"],
  [/\bMand\s+ates\b/g, "Mandates"],
  [/\bmand\s+ates\b/g, "mandates"],
  [/\bEmp\s+owers\b/g, "Empowers"],
  [/\bemp\s+owers\b/g, "empowers"],
  [/\bfrivol\s+ous\b/gi, "frivolous"],
  [/\bvex\s+at\s+ious\b/gi, "vexatious"],
  [/\bqu\s+ash\b/gi, "quash"],
  [/\bcert\s+ior\s+ari\b/gi, "certiorari"],
  [/\bcogn\s+izable\b/gi, "cognizable"],
  [/\bPenal\s+ises\b/g, "Penalises"],
  [/\bpenal\s+ises\b/g, "penalises"],
  [/\bcomplain\s+ant\b/gi, "complainant"],
  [/\bdef\s+amation\b/gi, "defamation"],
  [/\bfac\s+ie\b/gi, "facie"],
  [/\bCon\s+stitution\b/g, "Constitution"],
  [/\bcon\s+stitution\b/g, "constitution"],
  [/\brestr\s+ain\b/gi, "restrain"],
  [/\bprec\s+ed\s+ents\b/gi, "precedents"],
  [/\bPRE\s+CED\s+ENTS\b/g, "PRECEDENTS"],
  [/\bcompl\s+aint\b/gi, "complaint"],
  [/\binvest\s+igation\b/gi, "investigation"],
  [/\bProv\s+isions\b/gi, "Provisions"],
  [/\bSTAT\s+UT\s+ORY\b/g, "STATUTORY"],
  [/\bSTAT\s+UTE\b/g, "STATUTE"],
  [/\bJud\s+icial\b/gi, "Judicial"],
  [/\bPR\s+ACT\s+ICAL\b/g, "PRACTICAL"],
  [/\bCASE\s+LAW\b/g, "CASE LAW"],
  [/\bLEGAL\s+CONT\s+EXT\b/g, "LEGAL CONTEXT"],
  [/\bPRE\s+PAR\s+ATION\b/g, "PREPARATION"],
  [/\bLE\s+AD\s+ING\b/g, "LEADING"],
  [/\bKnowl\s+edge\b/gi, "Knowledge"],
  [/\bInfor\s+mation\b/gi, "Information"],
  [/\bProced\s+ure\b/gi, "Procedure"],
  [/\bProsec\s+ution\b/gi, "Prosecution"],
  [/\bexe\s+cution\b/gi, "execution"],
  [/\bjur\s+isdiction\b/gi, "jurisdiction"],
  [/\bConst\s+itutional\b/gi, "Constitutional"],
  [/\bReg\s+ulations\b/gi, "Regulations"],
  [/\bAmend\s+ments\b/gi, "Amendments"],
  [/\bOrd\s+inance\b/gi, "Ordinance"],
  [/\bLeg\s+islation\b/gi, "Legislation"],
  [/\bSup\s+reme\b/gi, "Supreme"],
  [/\bHigh\s+Court\s+s\b/gi, "High Courts"],
];

function repairBrokenTokens(text: string): string {
  if (!text) return "";
  let out = text;
  out = out.replace(/\b((?:18|19|20)\d)\s+(\d)\b/g, "$1$2");
  for (const [pattern, replacement] of BROKEN_LEGAL_TERMS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function stripCitationPlaceholderArtifacts(text: string): string {
  if (!text) return "";
  // Protect the ```references JSON block from prose-cleanup regexes.
  // The `[\s*\]` and `\{\s*\}` rules below indiscriminately strip empty arrays
  // and empty objects — which is correct for prose artifacts but corrupts
  // valid JSON like `"judgments":[]` -> `"judgments":` (the broken-JSON bug).
  const REFS_RE = /```references\s*[\s\S]*?```/i;
  const refsMatch = String(text).match(REFS_RE);
  const refsBlock = refsMatch ? refsMatch[0] : "";
  const proseOnly = refsBlock ? String(text).replace(REFS_RE, "") : String(text);

  const cleanedProse = repairBrokenTokens(proseOnly
    .replace(/\[\s*CASE CITATION REQUIRED\s*\]/gi, "")
    .replace(/\[\s*Pakistani case citation required\s*\]/gi, "")
    .replace(/\[\s*\]/g, "")
    .replace(/\*{2,}\s*\*{2,}/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\{\s*\}/g, "")
    .replace(/—\s*(?=[.,;:\n]|$)/g, "")
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .replace(/\s+;/g, ";")
    .replace(/\s+:/g, ":")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n"))
    .trim();

  return refsBlock ? `${cleanedProse}\n\n${refsBlock}` : cleanedProse;
}

function shouldAutoIndexAdminUploads(): boolean {
  if (ADMIN_UPLOAD_AUTO_INDEX) return true;
  if (!adminUploadIndexDisabledLogged) {
    adminUploadIndexDisabledLogged = true;
    console.log("[RAG] Admin upload auto-index is disabled. Upload now, then use Admin > Global RAG Indexing > Start.");
  }
  return false;
}

function shouldAutoSyncCaseLawUploads(): boolean {
  if (CASELAW_AUTO_SYNC_ON_UPLOAD) return true;
  if (!caseLawAutoSyncDisabledLogged) {
    caseLawAutoSyncDisabledLogged = true;
    console.log("[Case Law Sync] Auto sync on upload is disabled. Upload now, then run Admin > Case Law > Sync to Judgments manually.");
  }
  return false;
}

function enforcePakistanLawOnlyOutput(text: string): string {
  if (!text) return "";
  const scoped = String(text)
    .replace(/\bsection\s+(\d+[A-Za-z-]*)\s+of\s+ipc\b/gi, "Section $1 PPC")
    .replace(/\bIndian Penal Code(?:,\s*1860)?\b/gi, "Pakistan Penal Code, 1860")
    .replace(/\bIPC\b/gi, "PPC")
    .replace(/\bCode of Criminal Procedure,\s*1973\b/gi, "Code of Criminal Procedure, 1898")
    .replace(/\bCrPC\s*1973\b/gi, "Cr.P.C. 1898")
    .replace(/\bConstitution of India\b/gi, "Constitution of Islamic Republic of Pakistan, 1973")
    .replace(/\bIndian Evidence Act(?:,\s*1872)?\b/gi, "Qanun-e-Shahadat Order, 1984")
    .replace(/\bSupreme Court of India\b/gi, "Supreme Court of Pakistan")
    .replace(/\bIndian High Court\b/gi, "Pakistani High Court")
    // SCC and AIR citations allowed — not removed
  return stripCitationPlaceholderArtifacts(scoped);
}

function buildApexModeSystemPrompt(
  baseSystemPrompt: string,
  model: ApexModel,
  moduleType: ModuleType,
  hasAttachments: boolean,
): string {
  const shared = `APEX MODE POLICY (STRICT):
- Do not use live web search tools in this mode.
- Use only user prompt, conversation history, attached files (if any), and internal knowledge context provided by the app.
- Never claim to have searched external websites in this mode.
- If a legal citation is not present in available internal context, state it as unavailable instead of fabricating.`;

  const apexInstant = `APEX PROFILE (KIMI-K2.5-INSTANT):
 - Primary goal: fast, polished legal output with clear structure.
 - Keep reasoning concise and practical while preserving legal accuracy.
 - Prioritize court-ready language and clean formatting when drafting is requested.
 - Return final answers directly without exposing internal chain-of-thought.`;

  const apexAgentDraftGuard = moduleType === "draft" || moduleType === "contract-drafting"
    ? `- Drafting request detected: preserve requested drafting format and output only the final draft unless user explicitly asks for analysis sections.`
    : `- For advisory chat, structure response in this order:
  1) Objective
  2) Findings from internal context
  3) Legal analysis
  4) Recommendation
  5) Internal citation check (only citations grounded in provided internal context).`;

  const apexProThinking = `APEX PRO PROFILE (KIMI-K2-THINKING, NON-WEB):
 - Primary goal: deeper legal reasoning grounded in app-provided internal context.
 - Do not rely on internet or external assumptions.
 - Prefer evidence-grounded statements tied to internal context.
 ${apexAgentDraftGuard}
 - If attachments are present, treat them as highest-priority source material.`;

  const profile = model === "apex-agent" ? apexProThinking : apexInstant;
  return `${baseSystemPrompt}\n\n${shared}\n\n${profile}${hasAttachments ? "\n\nAttachment priority: enabled." : ""}`;
}

function normalizeSiteBaseUrl(req: Request): string {
  const configured = String(process.env.PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0]?.trim() || req.protocol || "https";
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0]?.trim();
  const host = forwardedHost || req.get("host") || "localhost";
  return `${forwardedProto}://${host}`.replace(/\/+$/, "");
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
  // UPDATED: Using DeepSeek instead of Groq (Groq deprecated 2026-04-16)
  const rewritten = await chatWithDeepSeek({
    messages: rewriteMessages,
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
  const sourceBuffer = getUploadBufferOrThrow(file);
  return {
    ...file,
    buffer: Buffer.from(sourceBuffer),
  };
}

function getUploadBufferOrThrow(file: Express.Multer.File): Buffer {
  const existing = (file as any).buffer;
  if (Buffer.isBuffer(existing)) return existing;
  const filePath = typeof (file as any).path === "string" ? (file as any).path.trim() : "";
  if (!filePath) {
    throw new Error(`Upload buffer is unavailable for ${file.originalname || "upload.bin"}`);
  }
  const loaded = fs.readFileSync(filePath);
  (file as any).buffer = loaded;
  return loaded;
}

function createUploadStorage(prefix: string): multer.StorageEngine {
  if (!USE_DISK_UPLOAD_STORAGE) return multer.memoryStorage();
  const safePrefix = sanitizeInputText(prefix, 40).replace(/[^a-z0-9-_]/gi, "-").toLowerCase() || "upload";
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_TEMP_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase().slice(0, 12);
      cb(null, `${safePrefix}-${Date.now()}-${crypto.randomUUID()}${ext}`);
    },
  });
}

function getRequestUploadFiles(req: Request): Express.Multer.File[] {
  const files: Express.Multer.File[] = [];
  const single = (req as any).file;
  if (single) files.push(single as Express.Multer.File);
  const many = (req as any).files;
  if (Array.isArray(many)) {
    files.push(...(many as Express.Multer.File[]));
  } else if (many && typeof many === "object") {
    for (const value of Object.values(many as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        files.push(...(value as Express.Multer.File[]));
      }
    }
  }
  return files;
}

function cleanupDiskUploadFilesAfterResponse(req: Request, res: any, next: NextFunction) {
  if (!USE_DISK_UPLOAD_STORAGE) return next();
  const uploadedFiles = getRequestUploadFiles(req);
  if (uploadedFiles.length === 0) return next();
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    for (const file of uploadedFiles) {
      const filePath = typeof (file as any).path === "string" ? (file as any).path : "";
      if (!filePath) continue;
      fs.unlink(filePath, () => {});
    }
  };
  res.once("finish", cleanup);
  res.once("close", cleanup);
  next();
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

function runInBackground(label: string, task: () => Promise<void>) {
  setImmediate(() => {
    void task().catch((err: any) => {
      console.warn(`[Background Task] ${label} failed:`, err?.message || err);
    });
  });
}

let interactiveChatRequestsInFlight = 0;
const BACKGROUND_CHAT_PRIORITY_PAUSE_MS = Math.max(
  50,
  Number(process.env.BACKGROUND_CHAT_PRIORITY_PAUSE_MS || 120),
);

function beginInteractiveChatRequest(): () => void {
  interactiveChatRequestsInFlight += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    interactiveChatRequestsInFlight = Math.max(0, interactiveChatRequestsInFlight - 1);
  };
}

async function pauseBackgroundForInteractiveChat(): Promise<void> {
  while (interactiveChatRequestsInFlight > 0) {
    await new Promise((resolve) => setTimeout(resolve, BACKGROUND_CHAT_PRIORITY_PAUSE_MS));
  }
}

type CaseLawReindexJobState = {
  running: boolean;
  shouldStop: boolean;
  batchSize: number;
  nextOffset: number;
  totalDocuments: number;
  totalProcessed: number;
  totalIndexed: number;
  totalFailed: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError: string | null;
};

type CaseLawCitationRoleReindexJobState = {
  running: boolean;
  shouldStop: boolean;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError: string | null;
  progress: CaseLawRoleReindexProgress | null;
};

type ReindexBatchResult = {
  processed: number;
  indexed: number;
  failed: number;
  failures: Array<{ sourceId: number; reason: string }>;
  nextOffset: number;
  nextCursorId: number | null;
  remaining: number;
  totalDocuments: number;
  hasMore: boolean;
};

type ReindexBatchProgress = {
  totalDocuments: number;
  processed: number;
  indexed: number;
  failed: number;
  nextOffset: number;
  nextCursorId: number | null;
};

type ReindexBatchHooks = {
  onMeta?: (meta: { totalDocuments: number }) => void;
  onProgress?: (progress: ReindexBatchProgress) => void;
};

type GlobalAdminRagReindexMode = "full" | "incremental";

type ReindexBatchOptions = {
  mode?: GlobalAdminRagReindexMode;
  nextCursorId?: number | null;
};

type CaseLawBadIndexSourceKind = "admin" | "github" | "statute" | "user" | "all";

type CaseLawBadIndexTarget = {
  sourceType: Exclude<CaseLawBadIndexSourceKind, "all">;
  sourceDocId: number;
  sourceFilename: string;
  totalRows: number;
  primaryRows: number;
  citedRows: number;
  uniqueKeys: number;
  duplicateRows: number;
};

type CaseLawBadIndexDuplicateStats = {
  totalRows: number;
  duplicateGroups: number;
  duplicateRows: number;
};

type CaseLawBadIndexReextractJobState = {
  running: boolean;
  shouldStop: boolean;
  sourceKind: Exclude<CaseLawBadIndexSourceKind, "all"> | "all";
  minRows: number;
  limit: number;
  maxCitations: number;
  totalTargets: number;
  processedTargets: number;
  reindexedTargets: number;
  skippedNoSource: number;
  skippedNoExtract: number;
  replacedRows: number;
  insertedRows: number;
  activeTarget: {
    sourceType: Exclude<CaseLawBadIndexSourceKind, "all">;
    sourceDocId: number;
    sourceFilename: string;
  } | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError: string | null;
};

type CaseLawSyncToJudgmentsJobState = {
  running: boolean;
  shouldStop: boolean;
  batchSize: number;
  nextCursorId: number | null;
  processed: number;
  imported: number;
  existing: number;
  skipped: number;
  failed: number;
  linked: number;
  unresolved: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError: string | null;
  activeRange: { fromId: number; toId: number } | null;
  errors: string[];
};

type CaseLawProcessPendingFilesJobState = {
  running: boolean;
  shouldStop: boolean;
  batchSize: number;
  loops: number;
  processed: number;
  extractedDocuments: number;
  insertedRows: number;
  failed: number;
  skippedNoText: number;
  skippedNoCases: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError: string | null;
  activeDocId: number | null;
  activeFilename: string | null;
  errors: string[];
};

type GlobalAdminRagSourceKey = "case-law" | "statute-docs" | "knowledge-vault";

type GlobalAdminRagSourceState = {
  key: GlobalAdminRagSourceKey;
  label: string;
  nextOffset: number;
  nextCursorId: number | null;
  totalDocuments: number;
  processed: number;
  indexed: number;
  failed: number;
  done: boolean;
  lastError: string | null;
};

type GlobalAdminRagReindexJobState = {
  running: boolean;
  shouldStop: boolean;
  mode: GlobalAdminRagReindexMode;
  batchSize: number;
  activeSourceIndex: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError: string | null;
  sources: Record<GlobalAdminRagSourceKey, GlobalAdminRagSourceState>;
};

const GLOBAL_ADMIN_RAG_SOURCE_ORDER: GlobalAdminRagSourceKey[] = [
  "case-law",
  "statute-docs",
  "knowledge-vault",
];

const ADMIN_CASELAW_CATEGORY_SQL = "replace(replace(replace(lower(coalesce(category, '')), '-', ''), ' ', ''), '_', '')";

function createGlobalAdminRagSourceState(key: GlobalAdminRagSourceKey): GlobalAdminRagSourceState {
  const labelByKey: Record<GlobalAdminRagSourceKey, string> = {
    "case-law": "Case Law",
    "statute-docs": "Statute Library",
    "knowledge-vault": "Admin Knowledge Vault",
  };
  return {
    key,
    label: labelByKey[key],
    nextOffset: 0,
    nextCursorId: null,
    totalDocuments: 0,
    processed: 0,
    indexed: 0,
    failed: 0,
    done: false,
    lastError: null,
  };
}

function createGlobalAdminRagReindexJobState(): GlobalAdminRagReindexJobState {
  return {
    running: false,
    shouldStop: false,
    mode: "full",
    batchSize: 50,
    activeSourceIndex: 0,
    startedAt: null,
    finishedAt: null,
    lastError: null,
    sources: {
      "case-law": createGlobalAdminRagSourceState("case-law"),
      "statute-docs": createGlobalAdminRagSourceState("statute-docs"),
      "knowledge-vault": createGlobalAdminRagSourceState("knowledge-vault"),
    },
  };
}

const caseLawReindexJob: CaseLawReindexJobState = {
  running: false,
  shouldStop: false,
  batchSize: 300,
  nextOffset: 0,
  totalDocuments: 0,
  totalProcessed: 0,
  totalIndexed: 0,
  totalFailed: 0,
  startedAt: null,
  finishedAt: null,
  lastError: null,
};

const caseLawCitationRoleReindexJob: CaseLawCitationRoleReindexJobState = {
  running: false,
  shouldStop: false,
  startedAt: null,
  finishedAt: null,
  lastError: null,
  progress: null,
};

const CASELAW_BAD_INDEX_SOURCE_OPTIONS: CaseLawBadIndexSourceKind[] = ["admin", "github", "statute", "user", "all"];

const caseLawBadIndexReextractJob: CaseLawBadIndexReextractJobState = {
  running: false,
  shouldStop: false,
  sourceKind: "admin",
  minRows: 20,
  limit: 100,
  maxCitations: 40,
  totalTargets: 0,
  processedTargets: 0,
  reindexedTargets: 0,
  skippedNoSource: 0,
  skippedNoExtract: 0,
  replacedRows: 0,
  insertedRows: 0,
  activeTarget: null,
  startedAt: null,
  finishedAt: null,
  lastError: null,
};

const caseLawSyncToJudgmentsJob: CaseLawSyncToJudgmentsJobState = {
  running: false,
  shouldStop: false,
  batchSize: 1500,
  nextCursorId: null,
  processed: 0,
  imported: 0,
  existing: 0,
  skipped: 0,
  failed: 0,
  linked: 0,
  unresolved: 0,
  startedAt: null,
  finishedAt: null,
  lastError: null,
  activeRange: null,
  errors: [],
};

const caseLawProcessPendingFilesJob: CaseLawProcessPendingFilesJobState = {
  running: false,
  shouldStop: false,
  batchSize: 200,
  loops: 0,
  processed: 0,
  extractedDocuments: 0,
  insertedRows: 0,
  failed: 0,
  skippedNoText: 0,
  skippedNoCases: 0,
  startedAt: null,
  finishedAt: null,
  lastError: null,
  activeDocId: null,
  activeFilename: null,
  errors: [],
};

const globalAdminRagReindexJob: GlobalAdminRagReindexJobState = createGlobalAdminRagReindexJobState();

const judgementsRagReindexJob = {
  running: false,
  shouldStop: false,
  batchSize: 100,
  processed: 0,
  indexed: 0,
  failed: 0,
  totalEstimate: 0,
  startedAt: null as Date | null,
  finishedAt: null as Date | null,
  lastError: null as string | null,
  lastCursorId: null as string | null,
};

function snapshotCaseLawReindexJob() {
  return {
    ...caseLawReindexJob,
    startedAt: caseLawReindexJob.startedAt ? caseLawReindexJob.startedAt.toISOString() : null,
    finishedAt: caseLawReindexJob.finishedAt ? caseLawReindexJob.finishedAt.toISOString() : null,
  };
}

function snapshotCaseLawCitationRoleReindexJob() {
  return {
    running: caseLawCitationRoleReindexJob.running,
    shouldStop: caseLawCitationRoleReindexJob.shouldStop,
    startedAt: caseLawCitationRoleReindexJob.startedAt ? caseLawCitationRoleReindexJob.startedAt.toISOString() : null,
    finishedAt: caseLawCitationRoleReindexJob.finishedAt ? caseLawCitationRoleReindexJob.finishedAt.toISOString() : null,
    lastError: caseLawCitationRoleReindexJob.lastError,
    progress: caseLawCitationRoleReindexJob.progress,
  };
}

function snapshotCaseLawBadIndexReextractJob() {
  return {
    ...caseLawBadIndexReextractJob,
    startedAt: caseLawBadIndexReextractJob.startedAt ? caseLawBadIndexReextractJob.startedAt.toISOString() : null,
    finishedAt: caseLawBadIndexReextractJob.finishedAt ? caseLawBadIndexReextractJob.finishedAt.toISOString() : null,
  };
}

function snapshotCaseLawSyncToJudgmentsJob() {
  return {
    ...caseLawSyncToJudgmentsJob,
    startedAt: caseLawSyncToJudgmentsJob.startedAt ? caseLawSyncToJudgmentsJob.startedAt.toISOString() : null,
    finishedAt: caseLawSyncToJudgmentsJob.finishedAt ? caseLawSyncToJudgmentsJob.finishedAt.toISOString() : null,
  };
}

function snapshotCaseLawProcessPendingFilesJob() {
  return {
    ...caseLawProcessPendingFilesJob,
    startedAt: caseLawProcessPendingFilesJob.startedAt ? caseLawProcessPendingFilesJob.startedAt.toISOString() : null,
    finishedAt: caseLawProcessPendingFilesJob.finishedAt ? caseLawProcessPendingFilesJob.finishedAt.toISOString() : null,
  };
}

function pushCappedJobError(target: string[], message: string, cap: number = 160) {
  if (!message) return;
  if (target.length >= cap) return;
  target.push(message);
}

function toCaseLawBadIndexInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function normalizeCaseLawBadIndexSourceKind(value: unknown): CaseLawBadIndexSourceKind {
  const normalized = String(value || "admin").trim().toLowerCase();
  return CASELAW_BAD_INDEX_SOURCE_OPTIONS.includes(normalized as CaseLawBadIndexSourceKind)
    ? (normalized as CaseLawBadIndexSourceKind)
    : "admin";
}

function getDbRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: T[] } | null)?.rows;
  return Array.isArray(rows) ? rows : [];
}

function normalizeCaseLawCitationReportToken(token: string): string {
  return String(token || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

const CASELAW_BAD_INDEX_REPORT_CODES = new Set([
  "PLD", "SCMR", "YLR", "MLD", "CLC", "PCRLJ", "PLJ", "PLC", "NLR",
  "PSC", "ALD", "KLR", "PTD", "PTCL", "PLS", "GBLR", "CLD", "TAX", "SLR",
]);

function extractKnownCaseLawReport(raw: string): string | null {
  const direct = normalizeCaseLawCitationReportToken(raw);
  if (CASELAW_BAD_INDEX_REPORT_CODES.has(direct)) return direct;

  const tokens = String(raw || "")
    .split(/\s+/g)
    .map((token) => normalizeCaseLawCitationReportToken(token))
    .filter(Boolean);
  if (tokens.length === 0) return null;

  for (let len = tokens.length; len >= 1; len -= 1) {
    for (let start = 0; start + len <= tokens.length; start += 1) {
      const candidate = tokens.slice(start, start + len).join("");
      if (CASELAW_BAD_INDEX_REPORT_CODES.has(candidate)) return candidate;
    }
  }
  return null;
}

function parseCaseLawCitationParts(citation: string): { year: number; report: string; page: number } | null {
  const raw = String(citation || "").trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/[()[\],;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const yearFirst =
    normalized.match(/\b((?:19|20)\d{2})\s+([A-Za-z][A-Za-z0-9.]{0,12}(?:\s+[A-Za-z][A-Za-z0-9.]{0,12}){0,4})\s+(\d{1,6})\b/i);
  if (yearFirst) {
    const year = Number(yearFirst[1]);
    const report = extractKnownCaseLawReport(yearFirst[2]) || normalizeCaseLawCitationReportToken(yearFirst[2]);
    const page = Number(yearFirst[3]);
    if (Number.isInteger(year) && Number.isInteger(page) && page > 0 && report) {
      return { year, report, page };
    }
  }

  const reportFirst =
    normalized.match(/\b([A-Za-z][A-Za-z0-9.]{0,12}(?:\s+[A-Za-z][A-Za-z0-9.]{0,12}){0,4})\s+((?:19|20)\d{2})\s+(\d{1,6})\b/i);
  if (!reportFirst) return null;
  const report = extractKnownCaseLawReport(reportFirst[1]) || normalizeCaseLawCitationReportToken(reportFirst[1]);
  const year = Number(reportFirst[2]);
  const page = Number(reportFirst[3]);
  if (!Number.isInteger(year) || !Number.isInteger(page) || page < 1 || !report) return null;
  return { year, report, page };
}

function normalizeCaseLawCitationText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCaseLawDedupKey(entry: {
  citation: string;
  citationYear?: number | null;
  citationReport?: string | null;
  citationPage?: number | null;
}): string {
  const report = normalizeCaseLawCitationReportToken(String(entry.citationReport || ""));
  const year = Number(entry.citationYear);
  const page = Number(entry.citationPage);
  if (report && Number.isInteger(year) && Number.isInteger(page) && page > 0) {
    return `parts:${report}:${year}:${page}`;
  }
  const parsed = parseCaseLawCitationParts(String(entry.citation || ""));
  if (parsed) {
    return `parts:${parsed.report}:${parsed.year}:${parsed.page}`;
  }
  return `citation:${normalizeCaseLawCitationText(String(entry.citation || ""))}`;
}

type NormalizedExtractedCase = {
  citation: string;
  citationRole: "primary" | "cited";
  court: string;
  title: string;
  summary: string;
  keywords: string[];
};

function normalizeExtractedCaseRow(row: NormalizedExtractedCase): NormalizedExtractedCase | null {
  const citation = String(row.citation || "").trim();
  const title = String(row.title || "").trim();
  if (!citation || !title) return null;
  return {
    citation,
    citationRole: row.citationRole === "primary" ? "primary" : "cited",
    court: String(row.court || "").trim(),
    title,
    summary: String(row.summary || "").trim() || `Case cited as ${citation}`,
    keywords: Array.isArray(row.keywords)
      ? row.keywords.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 25)
      : [],
  };
}

function capExtractedCaseRows(rows: NormalizedExtractedCase[], maxTotal: number): NormalizedExtractedCase[] {
  const safeMax = Math.max(1, maxTotal);
  const deduped: NormalizedExtractedCase[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const normalized = normalizeExtractedCaseRow(row);
    if (!normalized) continue;
    const key = buildCaseLawDedupKey({ citation: normalized.citation });
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
  }

  if (deduped.length === 0) return [];

  let primaryIndex = deduped.findIndex((row) => row.citationRole === "primary");
  if (primaryIndex < 0) {
    deduped[0].citationRole = "primary";
    primaryIndex = 0;
  }

  const primary = deduped[primaryIndex];
  const others = deduped
    .filter((_row, index) => index !== primaryIndex)
    .map((row) => ({ ...row, citationRole: "cited" as const }));

  return [primary, ...others.slice(0, Math.max(0, safeMax - 1))];
}

async function getCaseLawDuplicateStats(): Promise<CaseLawBadIndexDuplicateStats> {
  const result = await db.execute(sql.raw(`
    WITH keyed AS (
      SELECT
        COALESCE(
          CASE
            WHEN citation_report IS NOT NULL AND citation_year IS NOT NULL AND citation_page IS NOT NULL
              THEN upper(citation_report) || ':' || citation_year::text || ':' || citation_page::text
            ELSE NULL
          END,
          regexp_replace(lower(coalesce(citation, '')), '[^a-z0-9]+', '', 'g')
        ) AS dedup_key
      FROM case_law
    ),
    grouped AS (
      SELECT dedup_key, count(*) AS grp_count
      FROM keyed
      GROUP BY dedup_key
    )
    SELECT
      (SELECT count(*)::bigint FROM case_law) AS total_rows,
      count(*) FILTER (WHERE grp_count > 1)::bigint AS duplicate_groups,
      COALESCE(sum(grp_count - 1) FILTER (WHERE grp_count > 1), 0)::bigint AS duplicate_rows
    FROM grouped;
  `));
  const rows = getDbRows<{
    total_rows: string | number;
    duplicate_groups: string | number;
    duplicate_rows: string | number;
  }>(result);
  const row = rows[0];
  return {
    totalRows: toCaseLawBadIndexInt(row?.total_rows, 0),
    duplicateGroups: toCaseLawBadIndexInt(row?.duplicate_groups, 0),
    duplicateRows: toCaseLawBadIndexInt(row?.duplicate_rows, 0),
  };
}

async function loadCaseLawBadIndexTargets(
  sourceKind: CaseLawBadIndexSourceKind,
  minRows: number,
  limit: number,
): Promise<CaseLawBadIndexTarget[]> {
  const sourceFilterClause = sourceKind === "all" ? sql`` : sql`AND source_type = ${sourceKind}`;

  const result = await db.execute(sql`
    WITH grouped AS (
      SELECT
        source_type,
        source_doc_id,
        min(coalesce(source_filename, '')) AS source_filename,
        count(*)::int AS total_rows,
        count(*) FILTER (WHERE citation_role = 'primary')::int AS primary_rows,
        count(*) FILTER (WHERE citation_role = 'cited')::int AS cited_rows,
        count(
          DISTINCT COALESCE(
            CASE
              WHEN citation_report IS NOT NULL AND citation_year IS NOT NULL AND citation_page IS NOT NULL
                THEN upper(citation_report) || ':' || citation_year::text || ':' || citation_page::text
              ELSE NULL
            END,
            regexp_replace(lower(coalesce(citation, '')), '[^a-z0-9]+', '', 'g')
          )
        )::int AS unique_keys
      FROM case_law
      WHERE source_doc_id IS NOT NULL
        AND source_type IS NOT NULL
        ${sourceFilterClause}
      GROUP BY source_type, source_doc_id
      HAVING count(*) >= ${minRows}
    )
    SELECT
      source_type,
      source_doc_id,
      source_filename,
      total_rows,
      primary_rows,
      cited_rows,
      unique_keys,
      (total_rows - unique_keys)::int AS duplicate_rows
    FROM grouped
    ORDER BY duplicate_rows DESC, cited_rows DESC, total_rows DESC
    LIMIT ${limit};
  `);

  const rows = getDbRows<{
    source_type: string;
    source_doc_id: string | number;
    source_filename: string | null;
    total_rows: string | number;
    primary_rows: string | number;
    cited_rows: string | number;
    unique_keys: string | number;
    duplicate_rows: string | number;
  }>(result);

  return rows
    .map((row) => ({
      sourceType: String(row.source_type || "") as Exclude<CaseLawBadIndexSourceKind, "all">,
      sourceDocId: toCaseLawBadIndexInt(row.source_doc_id, 0),
      sourceFilename: String(row.source_filename || "").trim(),
      totalRows: toCaseLawBadIndexInt(row.total_rows, 0),
      primaryRows: toCaseLawBadIndexInt(row.primary_rows, 0),
      citedRows: toCaseLawBadIndexInt(row.cited_rows, 0),
      uniqueKeys: toCaseLawBadIndexInt(row.unique_keys, 0),
      duplicateRows: toCaseLawBadIndexInt(row.duplicate_rows, 0),
    }))
    .filter((row) =>
      ["admin", "github", "statute", "user"].includes(row.sourceType)
      && Number.isInteger(row.sourceDocId)
      && row.sourceDocId > 0,
    );
}

async function loadCaseLawBadIndexSourceContent(
  sourceType: Exclude<CaseLawBadIndexSourceKind, "all">,
  sourceDocId: number,
): Promise<{ content: string; filename: string } | null> {
  if (sourceType === "admin") {
    const doc = await storage.getAdminKnowledgeById(sourceDocId);
    if (!doc) return null;
    return {
      content: String(doc.content || ""),
      filename: String(doc.filename || `admin-${sourceDocId}.md`),
    };
  }
  if (sourceType === "github") {
    const doc = await storage.getGithubKnowledgeById(sourceDocId);
    if (!doc) return null;
    return {
      content: String(doc.content || ""),
      filename: String(doc.filename || `github-${sourceDocId}.md`),
    };
  }
  if (sourceType === "statute") {
    const doc = await storage.getStatuteDocument(sourceDocId);
    if (!doc) return null;
    return {
      content: String(doc.content || ""),
      filename: String(doc.filename || `statute-${sourceDocId}.md`),
    };
  }

  const [doc] = await db.select({
    title: documents.title,
    content: documents.content,
  })
    .from(documents)
    .where(eq(documents.id, sourceDocId))
    .limit(1);

  if (!doc) return null;
  return {
    content: String(doc.content || ""),
    filename: String(doc.title || `user-${sourceDocId}`),
  };
}

async function reextractCaseLawForSourceTarget(
  target: CaseLawBadIndexTarget,
  maxCitations: number,
): Promise<{ replaced: number; inserted: number; skipped: "none" | "no-source" | "no-extract" }> {
  const source = await loadCaseLawBadIndexSourceContent(target.sourceType, target.sourceDocId);
  if (!source || !source.content || source.content.trim().length < 200) {
    return { replaced: 0, inserted: 0, skipped: "no-source" };
  }

  const extractedRaw = nlpExtractCases(source.content, { sourceFilename: source.filename }) as NormalizedExtractedCase[];
  const roleAware = assignCitationRolesToCases(source.content, extractedRaw, {
    sourceFilename: source.filename,
  }) as NormalizedExtractedCase[];
  const extracted = capExtractedCaseRows(roleAware, maxCitations);
  if (extracted.length === 0) {
    return { replaced: 0, inserted: 0, skipped: "no-extract" };
  }

  const deleted = await db.delete(caseLaw)
    .where(and(eq(caseLaw.sourceDocId, target.sourceDocId), eq(caseLaw.sourceType, target.sourceType)))
    .returning({ id: caseLaw.id });

  const inserted = await storage.bulkCreateCaseLaw(extracted.map((row) => ({
    citation: row.citation,
    citationRole: row.citationRole,
    court: row.court,
    title: row.title,
    summary: row.summary,
    keywords: row.keywords,
    sourceDocId: target.sourceDocId,
    sourceType: target.sourceType,
    sourceFilename: source.filename,
  })));

  return {
    replaced: deleted.length,
    inserted: inserted.length,
    skipped: "none",
  };
}

function snapshotGlobalAdminRagReindexJob() {
  const sourceStates = Object.values(globalAdminRagReindexJob.sources);
  const aggregate = sourceStates.reduce(
    (acc, source) => {
      acc.totalDocuments += source.totalDocuments;
      acc.processed += source.processed;
      acc.indexed += source.indexed;
      acc.failed += source.failed;
      return acc;
    },
    { totalDocuments: 0, processed: 0, indexed: 0, failed: 0 },
  );

  return {
    running: globalAdminRagReindexJob.running,
    shouldStop: globalAdminRagReindexJob.shouldStop,
    mode: globalAdminRagReindexJob.mode,
    batchSize: globalAdminRagReindexJob.batchSize,
    activeSource: GLOBAL_ADMIN_RAG_SOURCE_ORDER[globalAdminRagReindexJob.activeSourceIndex] || null,
    activeSourceLabel: GLOBAL_ADMIN_RAG_SOURCE_ORDER[globalAdminRagReindexJob.activeSourceIndex]
      ? globalAdminRagReindexJob.sources[GLOBAL_ADMIN_RAG_SOURCE_ORDER[globalAdminRagReindexJob.activeSourceIndex]].label
      : null,
    startedAt: globalAdminRagReindexJob.startedAt ? globalAdminRagReindexJob.startedAt.toISOString() : null,
    finishedAt: globalAdminRagReindexJob.finishedAt ? globalAdminRagReindexJob.finishedAt.toISOString() : null,
    lastError: globalAdminRagReindexJob.lastError,
    aggregate,
    sources: GLOBAL_ADMIN_RAG_SOURCE_ORDER.map((key) => ({ ...globalAdminRagReindexJob.sources[key] })),
  };
}

function normalizeAdminKnowledgeCategory(value: string | null | undefined): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isAdminKnowledgeCaseLawCategory(value: string | null | undefined): boolean {
  return normalizeAdminKnowledgeCategory(value) === "caselaw";
}

async function withOperationTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutLabel: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutLabel)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function reindexCaseLawBatch(
  limit: number,
  offset: number,
  hooks?: ReindexBatchHooks,
  options?: ReindexBatchOptions,
): Promise<ReindexBatchResult> {
  if (!dbAvailable || !pool) {
    throw new Error("Database unavailable");
  }

  const mode: GlobalAdminRagReindexMode = options?.mode === "incremental" ? "incremental" : "full";
  const currentCursorId = Math.max(0, Number(options?.nextCursorId || 0));
  let rows: Array<{ id: number }> = [];
  let totalDocuments = 0;

  if (mode === "incremental") {
    const rowsResult = await pool.query(
      `
      SELECT ak.id
      FROM admin_knowledge ak
      WHERE ${ADMIN_CASELAW_CATEGORY_SQL} = 'caselaw'
        AND ak.id > $2
        AND NOT EXISTS (
          SELECT 1
          FROM rag_documents rd
          WHERE rd.user_id = $1
            AND rd.source_document_id = ak.id
            AND rd.status = 'indexed'
            AND rd.chunk_count > 0
        )
      ORDER BY ak.id ASC
      LIMIT $3
      `,
      [GLOBAL_CASELAW_RAG_USER_ID, currentCursorId, limit],
    );
    rows = (rowsResult.rows || []) as Array<{ id: number }>;
    const totalRow = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM admin_knowledge ak
      WHERE ${ADMIN_CASELAW_CATEGORY_SQL} = 'caselaw'
        AND ak.id > $2
        AND NOT EXISTS (
          SELECT 1
          FROM rag_documents rd
          WHERE rd.user_id = $1
            AND rd.source_document_id = ak.id
            AND rd.status = 'indexed'
            AND rd.chunk_count > 0
        )
      `,
      [GLOBAL_CASELAW_RAG_USER_ID, currentCursorId],
    );
    totalDocuments = Number(totalRow.rows?.[0]?.total || 0);
  } else {
    const rowsResult = await pool.query(
      `
      SELECT id
      FROM admin_knowledge
      WHERE ${ADMIN_CASELAW_CATEGORY_SQL} = 'caselaw'
      ORDER BY id ASC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset],
    );
    rows = (rowsResult.rows || []) as Array<{ id: number }>;
    const totalRow = await pool.query(
      `SELECT COUNT(*)::int AS total FROM admin_knowledge WHERE ${ADMIN_CASELAW_CATEGORY_SQL} = 'caselaw'`,
    );
    totalDocuments = Number(totalRow.rows?.[0]?.total || 0);
  }
  hooks?.onMeta?.({ totalDocuments });

  let processed = 0;
  let indexed = 0;
  let failed = 0;
  let nextCursorId = mode === "incremental" ? currentCursorId : null;
  const failures: Array<{ sourceId: number; reason: string }> = [];

  for (const row of rows) {
    const adminKnowledgeId = Number((row as any).id);
    if (!Number.isInteger(adminKnowledgeId) || adminKnowledgeId < 1) continue;
    if (mode === "incremental") nextCursorId = adminKnowledgeId;
    try {
      const result = await withOperationTimeout(
        indexAdminCaseLawDocument(adminKnowledgeId),
        CASELAW_RAG_INDEX_DOC_TIMEOUT_MS,
        `Index timeout after ${CASELAW_RAG_INDEX_DOC_TIMEOUT_MS}ms`,
      );
      if (result.chunks > 0) {
        indexed += 1;
      } else {
        failed += 1;
        if (failures.length < 20) {
          failures.push({ sourceId: adminKnowledgeId, reason: "No chunks generated" });
        }
      }
    } catch (err: any) {
      failed += 1;
      if (failures.length < 20) {
        failures.push({
          sourceId: adminKnowledgeId,
          reason: sanitizeInputText(err?.message || "Indexing failed", 300),
        });
      }
    }
    processed += 1;
    hooks?.onProgress?.({
      totalDocuments,
      processed,
      indexed,
      failed,
      nextOffset: mode === "full" ? offset + processed : 0,
      nextCursorId,
    });
  }

  const nextOffset = mode === "full" ? offset + processed : 0;
  const remaining = mode === "full"
    ? Math.max(0, totalDocuments - nextOffset)
    : Math.max(0, totalDocuments - processed);
  return {
    processed,
    indexed,
    failed,
    failures,
    nextOffset,
    nextCursorId,
    remaining,
    totalDocuments,
    hasMore: remaining > 0,
  };
}

async function reindexStatuteBatch(
  limit: number,
  offset: number,
  hooks?: ReindexBatchHooks,
  options?: ReindexBatchOptions,
): Promise<ReindexBatchResult> {
  if (!dbAvailable || !pool) {
    throw new Error("Database unavailable");
  }

  const mode: GlobalAdminRagReindexMode = options?.mode === "incremental" ? "incremental" : "full";
  const currentCursorId = Math.max(0, Number(options?.nextCursorId || 0));
  let rows: Array<{ id: number }> = [];
  let totalDocuments = 0;

  if (mode === "incremental") {
    const rowsResult = await pool.query(
      `
      SELECT sd.id
      FROM statute_documents sd
      WHERE sd.id > $2
        AND NOT EXISTS (
          SELECT 1
          FROM rag_documents rd
          WHERE rd.user_id = $1
            AND rd.source_document_id = sd.id
            AND rd.status = 'indexed'
            AND rd.chunk_count > 0
        )
      ORDER BY sd.id ASC
      LIMIT $3
      `,
      [GLOBAL_STATUTE_RAG_USER_ID, currentCursorId, limit],
    );
    rows = (rowsResult.rows || []) as Array<{ id: number }>;
    const totalRow = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM statute_documents sd
      WHERE sd.id > $2
        AND NOT EXISTS (
          SELECT 1
          FROM rag_documents rd
          WHERE rd.user_id = $1
            AND rd.source_document_id = sd.id
            AND rd.status = 'indexed'
            AND rd.chunk_count > 0
        )
      `,
      [GLOBAL_STATUTE_RAG_USER_ID, currentCursorId],
    );
    totalDocuments = Number(totalRow.rows?.[0]?.total || 0);
  } else {
    const rowsResult = await pool.query(
      `
      SELECT id
      FROM statute_documents
      ORDER BY id ASC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset],
    );
    rows = (rowsResult.rows || []) as Array<{ id: number }>;
    const totalRow = await pool.query(
      `SELECT COUNT(*)::int AS total FROM statute_documents`,
    );
    totalDocuments = Number(totalRow.rows?.[0]?.total || 0);
  }
  hooks?.onMeta?.({ totalDocuments });

  let processed = 0;
  let indexed = 0;
  let failed = 0;
  let nextCursorId = mode === "incremental" ? currentCursorId : null;
  const failures: Array<{ sourceId: number; reason: string }> = [];

  for (const row of rows) {
    const statuteDocumentId = Number((row as any).id);
    if (!Number.isInteger(statuteDocumentId) || statuteDocumentId < 1) continue;
    if (mode === "incremental") nextCursorId = statuteDocumentId;
    try {
      const result = await withOperationTimeout(
        indexAdminStatuteDocument(statuteDocumentId),
        CASELAW_RAG_INDEX_DOC_TIMEOUT_MS,
        `Index timeout after ${CASELAW_RAG_INDEX_DOC_TIMEOUT_MS}ms`,
      );
      if (result.chunks > 0) {
        indexed += 1;
      } else {
        failed += 1;
        if (failures.length < 20) {
          failures.push({ sourceId: statuteDocumentId, reason: "No chunks generated" });
        }
      }
    } catch (err: any) {
      failed += 1;
      if (failures.length < 20) {
        failures.push({
          sourceId: statuteDocumentId,
          reason: sanitizeInputText(err?.message || "Indexing failed", 300),
        });
      }
    }
    processed += 1;
    hooks?.onProgress?.({
      totalDocuments,
      processed,
      indexed,
      failed,
      nextOffset: mode === "full" ? offset + processed : 0,
      nextCursorId,
    });
  }

  const nextOffset = mode === "full" ? offset + processed : 0;
  const remaining = mode === "full"
    ? Math.max(0, totalDocuments - nextOffset)
    : Math.max(0, totalDocuments - processed);
  return {
    processed,
    indexed,
    failed,
    failures,
    nextOffset,
    nextCursorId,
    remaining,
    totalDocuments,
    hasMore: remaining > 0,
  };
}

async function reindexAdminKnowledgeBatch(
  limit: number,
  offset: number,
  hooks?: ReindexBatchHooks,
  options?: ReindexBatchOptions,
): Promise<ReindexBatchResult> {
  if (!dbAvailable || !pool) {
    throw new Error("Database unavailable");
  }

  const mode: GlobalAdminRagReindexMode = options?.mode === "incremental" ? "incremental" : "full";
  const currentCursorId = Math.max(0, Number(options?.nextCursorId || 0));
  let rows: Array<{ id: number }> = [];
  let totalDocuments = 0;

  if (mode === "incremental") {
    const rowsResult = await pool.query(
      `
      SELECT ak.id
      FROM admin_knowledge ak
      WHERE ${ADMIN_CASELAW_CATEGORY_SQL} <> 'caselaw'
        AND ak.id > $2
        AND NOT EXISTS (
          SELECT 1
          FROM rag_documents rd
          WHERE rd.user_id = $1
            AND rd.source_document_id = ak.id
            AND rd.status = 'indexed'
            AND rd.chunk_count > 0
        )
      ORDER BY ak.id ASC
      LIMIT $3
      `,
      [GLOBAL_ADMIN_KNOWLEDGE_RAG_USER_ID, currentCursorId, limit],
    );
    rows = (rowsResult.rows || []) as Array<{ id: number }>;
    const totalRow = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM admin_knowledge ak
      WHERE ${ADMIN_CASELAW_CATEGORY_SQL} <> 'caselaw'
        AND ak.id > $2
        AND NOT EXISTS (
          SELECT 1
          FROM rag_documents rd
          WHERE rd.user_id = $1
            AND rd.source_document_id = ak.id
            AND rd.status = 'indexed'
            AND rd.chunk_count > 0
        )
      `,
      [GLOBAL_ADMIN_KNOWLEDGE_RAG_USER_ID, currentCursorId],
    );
    totalDocuments = Number(totalRow.rows?.[0]?.total || 0);
  } else {
    const rowsResult = await pool.query(
      `
      SELECT id
      FROM admin_knowledge
      WHERE ${ADMIN_CASELAW_CATEGORY_SQL} <> 'caselaw'
      ORDER BY id ASC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset],
    );
    rows = (rowsResult.rows || []) as Array<{ id: number }>;
    const totalRow = await pool.query(
      `SELECT COUNT(*)::int AS total FROM admin_knowledge WHERE ${ADMIN_CASELAW_CATEGORY_SQL} <> 'caselaw'`,
    );
    totalDocuments = Number(totalRow.rows?.[0]?.total || 0);
  }
  hooks?.onMeta?.({ totalDocuments });

  let processed = 0;
  let indexed = 0;
  let failed = 0;
  let nextCursorId = mode === "incremental" ? currentCursorId : null;
  const failures: Array<{ sourceId: number; reason: string }> = [];

  for (const row of rows) {
    const adminKnowledgeId = Number((row as any).id);
    if (!Number.isInteger(adminKnowledgeId) || adminKnowledgeId < 1) continue;
    if (mode === "incremental") nextCursorId = adminKnowledgeId;
    try {
      const result = await withOperationTimeout(
        indexAdminKnowledgeDocument(adminKnowledgeId),
        CASELAW_RAG_INDEX_DOC_TIMEOUT_MS,
        `Index timeout after ${CASELAW_RAG_INDEX_DOC_TIMEOUT_MS}ms`,
      );
      if (result.chunks > 0) {
        indexed += 1;
      } else {
        failed += 1;
        if (failures.length < 20) {
          failures.push({ sourceId: adminKnowledgeId, reason: "No chunks generated" });
        }
      }
    } catch (err: any) {
      failed += 1;
      if (failures.length < 20) {
        failures.push({
          sourceId: adminKnowledgeId,
          reason: sanitizeInputText(err?.message || "Indexing failed", 300),
        });
      }
    }
    processed += 1;
    hooks?.onProgress?.({
      totalDocuments,
      processed,
      indexed,
      failed,
      nextOffset: mode === "full" ? offset + processed : 0,
      nextCursorId,
    });
  }

  const nextOffset = mode === "full" ? offset + processed : 0;
  const remaining = mode === "full"
    ? Math.max(0, totalDocuments - nextOffset)
    : Math.max(0, totalDocuments - processed);
  return {
    processed,
    indexed,
    failed,
    failures,
    nextOffset,
    nextCursorId,
    remaining,
    totalDocuments,
    hasMore: remaining > 0,
  };
}

// Reindex a batch of judgments from the judgments table into RAG vector store.
// Uses cursor-based pagination on UUID (alphabetically ordered).
async function reindexJudgmentsBatch(
  batchSize: number,
  cursorId: string | null,
  onProgress?: (processed: number, indexed: number, failed: number) => void,
): Promise<{ processed: number; indexed: number; failed: number; nextCursorId: string | null; hasMore: boolean }> {
  if (!dbAvailable || !pool) throw new Error("Database unavailable");

  const limit = Math.max(1, Math.min(500, batchSize));

  const rows = await db
    .select({ id: judgments.id })
    .from(judgments)
    .where(
      and(
        eq(judgments.isActive, true),
        cursorId ? sql`${judgments.id}::text > ${cursorId}` : sql`1=1`,
      ),
    )
    .orderBy(sql`${judgments.id}::text ASC`)
    .limit(limit);

  let processed = 0;
  let indexed = 0;
  let failed = 0;
  let nextCursorId: string | null = null;

  for (const row of rows) {
    const judgmentId = String(row.id);
    nextCursorId = judgmentId;
    try {
      const result = await withOperationTimeout(
        indexJudgmentDocument(judgmentId),
        CASELAW_RAG_INDEX_DOC_TIMEOUT_MS,
        `Judgment index timeout after ${CASELAW_RAG_INDEX_DOC_TIMEOUT_MS}ms`,
      );
      if (result.chunks > 0) indexed += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      console.warn(`[Judgments RAG] Failed to index ${judgmentId}: ${getErrorMessage(err)}`);
    }
    processed += 1;
    onProgress?.(processed, indexed, failed);
  }

  return { processed, indexed, failed, nextCursorId, hasMore: rows.length === limit };
}

function maybeIndexAdminCaseLawInBackground(args: { adminKnowledgeId: number; category?: string | null }) {
  if (!shouldAutoIndexAdminUploads()) return;
  const isCaseLaw = isAdminKnowledgeCaseLawCategory(args.category);
  const label = isCaseLaw ? "case-law" : "knowledge";
  runInBackground(`rag-admin-${label}:${args.adminKnowledgeId}`, async () => {
    try {
      if (isCaseLaw) {
        await indexAdminCaseLawDocument(args.adminKnowledgeId);
      } else {
        await indexAdminKnowledgeDocument(args.adminKnowledgeId);
      }
    } catch (err: any) {
      console.warn(
        `[RAG] Could not index admin ${label} ${args.adminKnowledgeId}:`,
        sanitizeInputText(err?.message || "unknown", 220),
      );
    }
  });
}

function maybeIndexStatuteDocumentInBackground(args: { statuteDocumentId: number }) {
  if (!shouldAutoIndexAdminUploads()) return;
  runInBackground(`rag-admin-statute:${args.statuteDocumentId}`, async () => {
    try {
      await indexAdminStatuteDocument(args.statuteDocumentId);
    } catch (err: any) {
      console.warn(
        `[RAG] Could not index statute document ${args.statuteDocumentId}:`,
        sanitizeInputText(err?.message || "unknown", 220),
      );
    }
  });
}

function buildMessages(systemPrompt: string, contents: Array<{ role: string; parts: Array<{ text: string }> }>): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const scopedSystemPrompt = withPakistanLawOnlyPolicy(systemPrompt);
  return [
    { role: "system", content: scopedSystemPrompt },
    ...contents.map(c => ({
      role: (c.role === "model" ? "assistant" : "user") as "user" | "assistant",
      content: c.parts.map(p => p.text).join("\n"),
    })),
  ];
}

const MODEL_TIMEOUT_MS = {
  standardPrimary: 30000,
  turboPrimary: 30000,
  apexPrimary: 30000,
};

type TimeoutProfile = "default" | "search" | "analysis";
type TimeoutConfig = {
  standardPrimary: number;
  turboPrimary: number;
};

const MODEL_TIMEOUT_PROFILES: Record<TimeoutProfile, TimeoutConfig> = {
  default: {
    standardPrimary: MODEL_TIMEOUT_MS.standardPrimary,
    turboPrimary: MODEL_TIMEOUT_MS.turboPrimary,
  },
  search: {
    standardPrimary: 30000,
    turboPrimary: 30000,
  },
  analysis: {
    standardPrimary: 90000, // Legal drafting with DeepSeek R1 reasoning can take 45-80s for 1000+ word pleadings
    turboPrimary: 45000,
  },
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function isEmptyModelOutput(value: string): boolean {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return true;
  if (/^no response generated\.?$/i.test(normalized)) return true;
  if (/^no response generated\.?\s*```references\b/i.test(normalized)) return true;
  return false;
}

function assertNonEmptyModelOutput(provider: string, value: string): string {
  const text = String(value || "").trim();
  if (!isEmptyModelOutput(text)) return text;
  const err = new Error(`${provider} returned empty model output`);
  (err as any).code = "EMPTY_MODEL_OUTPUT";
  throw err;
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
  // UPDATED: Using DeepSeek instead of Groq (Groq deprecated 2026-04-16)
  const result = await withTimeout("DeepSeek", timeoutConfig.standardPrimary, () => chatWithDeepSeek({ messages, maxTokens, temperature }));
  const safeText = assertNonEmptyModelOutput("DeepSeek", result.content);
  console.log(`[AI Routing][standard] Primary DeepSeek succeeded in ${Date.now() - startedAt}ms`);
  return { text: enforcePakistanLawOnlyOutput(safeText), model: result.model };
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
  const result = await withTimeout("DeepSeek R1", timeoutConfig.turboPrimary, () =>
    chatWithDeepSeekPro({ messages, maxTokens, temperature }),
  );
  const safeText = assertNonEmptyModelOutput("DeepSeek R1", result.content);
  console.log(`[AI Routing][turbo] Primary DeepSeek R1 succeeded in ${Date.now() - startedAt}ms`);
  return { text: enforcePakistanLawOnlyOutput(safeText), model: result.model };
}

async function callStandardAISimple(
  systemPrompt: string,
  userText: string,
  maxTokens: number,
  options?: { timeoutProfile?: TimeoutProfile; temperature?: number },
): Promise<{ text: string; model: string }> {
  return callStandardAI(systemPrompt, [{ role: "user", parts: [{ text: userText }] }], maxTokens, options);
}

// Addon for system prompt emphasizing citation from injected verified cases via judgment search database
const VERIFIED_JUDGMENTS_CITATION_ADDON = `

=== CASE LAW RETRIEVAL: JUDGMENT SEARCH DATABASE ===
These verified cases come from Al Wakeelo's Judgment Search database (searchable by users at /judgment-search).
The "VERIFIED JUDGMENTS FROM INTERNAL DATABASE" section below contains ONLY real, verified case law
from our internal Pakistani legal database. These are the ONLY citations you should use.

MANDATORY JUDGMENT SEARCH ROUTING RULES (NON-NEGOTIABLE):

RULE J1 — ALWAYS MENTION JUDGMENT SEARCH:
When responding to ANY query about case law, legal precedent, or judicial decisions, you MUST mention
the Judgment Search database at least once. Users must know they can search /judgment-search independently.

RULE J2 — NO CASES FOUND:
If the VERIFIED JUDGMENTS section is empty or has zero results for a case law query:
Write EXACTLY: "No relevant judgments found in our internal database for this query.
However, you can search our Judgment Search database (/judgment-search) with keywords like '[relevant statute/case type]'
to find cases across our full legal database."
Then proceed with statutory/conceptual explanation if helpful.

RULE J3 — LIMITED RESULTS (1-2 cases):
If only 1-2 cases are available but the user is asking about case law broadly:
After citing available cases, MUST add: "For more comprehensive case law on this topic,
I recommend searching our Judgment Search database (/judgment-search) with keywords like '[statute/concept]'."

RULE J4 — COMPLETE RESULTS (3+ cases):
If 3+ verified cases are available and fully address the query:
You MAY mention Judgment Search as optional: "For additional case law beyond what I've cited,
you can also explore our Judgment Search database (/judgment-search)."

RULE J5 — SPECIFIC CASE REQUESTS:
If user asks about a specific case that is NOT in the VERIFIED JUDGMENTS section:
Write: "I don't have that specific case in my database. You can search for '[case citation]'
in our Judgment Search database at /judgment-search."
NEVER invent or hallucinate the case to avoid mentioning the search feature.

CRITICAL CITATION RULES:
- Cite ONLY from the section below
- Never cite cases from your training data that are not in the section below
- Do NOT hallucinate or invent citations
- Copy citations verbatim from the database section below

Format all citations as: **[CITATION]** — brief explanation
Example: **[PLD 2020 SC 456]** — Supreme Court held that bail cancellation requires proof of supervening circumstances...
`;

// Removed: callStandardAIWithTools function (tool-calling disabled)
// Removed: chatWithDeepSeekTools call (using RAG-injected cases instead)

async function callLegalDraftingAI(
  systemPrompt: string,
  userText: string,
  maxTokens: number,
  options?: { timeoutProfile?: TimeoutProfile; temperature?: number },
): Promise<{ text: string; model: string }> {
  const timeoutConfig = MODEL_TIMEOUT_PROFILES[options?.timeoutProfile || "default"] || MODEL_TIMEOUT_PROFILES.default;
  const temperature = Number.isFinite(options?.temperature) ? Number(options?.temperature) : 0.7;
  const messages = buildMessages(systemPrompt, [{ role: "user", parts: [{ text: userText }] }]);
  const startedAt = Date.now();
  if (!isDeepSeekAvailable()) {
    throw new Error("Legal drafting requires DeepSeek R1. Configure DEEPSEEK_API_KEY.");
  }

  try {
    const result = await withTimeout("DeepSeek", timeoutConfig.standardPrimary, () =>
      chatWithDeepSeekPro({ messages, maxTokens, temperature }),
    );
    const safeText = assertNonEmptyModelOutput("DeepSeek R1", result.content);
    console.log(`[AI Routing][legal-drafting] DeepSeek R1 succeeded in ${Date.now() - startedAt}ms`);
    return { text: enforcePakistanLawOnlyOutput(safeText), model: result.model };
  } catch (primaryErr: any) {
    // If R1 reasoner times out or fails, retry once with faster deepseek-chat model
    const errCode = primaryErr?.code || "";
    const isTimeout = errCode === "MODEL_TIMEOUT" || primaryErr?.message?.includes("timed out");
    const isEmpty = errCode === "EMPTY_MODEL_OUTPUT";
    if (isTimeout || isEmpty) {
      console.warn(`[AI Routing][legal-drafting] DeepSeek R1 ${isTimeout ? "timed out" : "empty output"} after ${Date.now() - startedAt}ms — retrying with deepseek-chat`);
      const retryStarted = Date.now();
      try {
        const fallbackResult = await withTimeout("DeepSeek-Chat-Fallback", 60000, () =>
          chatWithDeepSeek({ messages, maxTokens, temperature: Math.min(temperature + 0.05, 0.7) }),
        );
        const fallbackText = assertNonEmptyModelOutput("DeepSeek Chat", fallbackResult.content);
        console.log(`[AI Routing][legal-drafting] DeepSeek Chat fallback succeeded in ${Date.now() - retryStarted}ms`);
        return { text: enforcePakistanLawOnlyOutput(fallbackText), model: fallbackResult.model };
      } catch (fallbackErr) {
        console.error(`[AI Routing][legal-drafting] DeepSeek Chat fallback also failed:`, getErrorMessage(fallbackErr));
        throw primaryErr; // Re-throw the original error for better error messages
      }
    }
    throw primaryErr;
  }
}

async function callApexAIPrimary(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  preferredModel: ApexModel | null,
  allowedModels: ApexModel[],
  maxTokens: number,
): Promise<{ text: string; reasoning?: string; model: string }> {
  if (!isApexAvailable()) {
    throw new Error("Apex AI is not configured");
  }
  if (allowedModels.length === 0) {
    throw new Error("No Apex models are available for this tier");
  }

  const primaryModel = preferredModel && allowedModels.includes(preferredModel) ? preferredModel : allowedModels[0];
  let responseContent = "";
  let responseReasoning: string | undefined;
  let responseModel = "";
  const apexStartedAt = Date.now();
  const result = await withTimeout(
    `Kimi(${primaryModel})`,
    MODEL_TIMEOUT_MS.apexPrimary,
    () => chatWithApex({
      model: primaryModel,
      messages,
      maxTokens,
    }),
  );
  responseContent = assertNonEmptyModelOutput(`Kimi(${primaryModel})`, result.content);
  responseReasoning = result.reasoning;
  responseModel = result.model;
  console.log(`[AI Routing][apex] Primary Kimi(${primaryModel}) succeeded in ${Date.now() - apexStartedAt}ms`);

  return {
    text: enforcePakistanLawOnlyOutput(responseContent),
    reasoning: responseReasoning,
    model: responseModel,
  };
}

type ChatRouteMode = "standard" | "turbo";
type BillingCycle = "monthly" | "quarterly" | "yearly";

function normalizeTier(tierRaw: string | undefined | null): "free" | "standard" | "pro" | "chamber" | "enterprise" {
  const tier = String(tierRaw || "free").toLowerCase();
  if (tier === "free" || tier === "pro" || tier === "chamber" || tier === "enterprise") return tier;
  return "standard";
}

function normalizeBillingCycle(cycleRaw: string | undefined | null): BillingCycle {
  const cycle = String(cycleRaw || "monthly").toLowerCase();
  if (cycle === "quarterly" || cycle === "yearly") return cycle;
  return "monthly";
}

function getBillingCycleMonths(cycle: BillingCycle): number {
  if (cycle === "quarterly") return 3;
  if (cycle === "yearly") return 12;
  return 1;
}

function getSubscriptionWindow(cycle: BillingCycle, startAt = new Date()): { startAt: Date; endAt: Date } {
  const months = getBillingCycleMonths(cycle);
  const cycleStart = new Date(startAt);
  const cycleEnd = new Date(cycleStart);
  cycleEnd.setMonth(cycleEnd.getMonth() + months);
  return { startAt: cycleStart, endAt: cycleEnd };
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

const FREE_TIER_CHAT_BUCKET_FEATURES = ["chat", "search-judgments", "search-statutes", "summarize", "brief", "chat-apex"] as const;

function resolveFreeTierLimit(featureRaw: string): {
  limitKey: "chat" | "draft" | "contract-drafting";
  label: string;
  monthlyLimit: number;
  features: string[];
} {
  const feature = String(featureRaw || "chat").toLowerCase();
  if (feature === "draft") {
    return {
      limitKey: "draft",
      label: "legal draft",
      monthlyLimit: 1,
      features: ["draft"],
    };
  }
  if (feature === "contract-drafting") {
    return {
      limitKey: "contract-drafting",
      label: "contract draft",
      monthlyLimit: 1,
      features: ["contract-drafting"],
    };
  }
  return {
    limitKey: "chat",
    label: "AI chat",
    monthlyLimit: 10,
    features: [...FREE_TIER_CHAT_BUCKET_FEATURES],
  };
}

function resolveModuleRoute(modePrimary: ChatRouteMode, userTier: string): {
  route: ChatRouteMode;
  blocked?: { status: 403 | 503; message: string };
} {
  const turboPermitted = isTurboAllowedForTier(userTier) && isDeepSeekAvailable();
  if (modePrimary === "turbo") {
    if (!isTurboAllowedForTier(userTier)) {
      return {
        route: modePrimary,
        blocked: { status: 403, message: "Turbo mode is not included in your current subscription tier." },
      };
    }
    if (!isDeepSeekAvailable()) {
      return {
        route: modePrimary,
        blocked: { status: 503, message: "Turbo mode is currently unavailable because DeepSeek is not configured." },
      };
    }
  }
  return { route: modePrimary };
}

function extractJsonObject(raw: string): string | null {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return cleaned.slice(start, end + 1);
  return null;
}

function normalizeReferencesPayload(payload: unknown): { laws: unknown[]; judgments: unknown[] } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { laws: [], judgments: [] };
  }
  const obj = payload as { laws?: unknown; judgments?: unknown };
  return {
    laws: Array.isArray(obj.laws) ? obj.laws : [],
    judgments: Array.isArray(obj.judgments) ? obj.judgments : [],
  };
}

function parseLooseReferencesJsonAtEnd(content: string): { laws: unknown[]; judgments: unknown[] } | null {
  // Strip trailing code-fence closing backticks before matching (AI sometimes wraps JSON in ```...```)
  const tail = String(content || "").slice(-4000).replace(/`{1,3}\s*$/, "").trimEnd();
  // Try laws-first then judgments-first ordering
  const patterns = [
    /\{\s*"laws"\s*:\s*\[[\s\S]*?\]\s*,\s*"judgments"\s*:\s*\[[\s\S]*?\]\s*\}\s*$/i,
    /\{\s*"judgments"\s*:\s*\[[\s\S]*?\]\s*,\s*"laws"\s*:\s*\[[\s\S]*?\]\s*\}\s*$/i,
  ];
  for (const pat of patterns) {
    const match = tail.match(pat);
    if (!match) continue;
    try {
      const parsed = JSON.parse(match[0]);
      return normalizeReferencesPayload(parsed);
    } catch {
      continue;
    }
  }
  return null;
}

function stripTrailingReferencesArtifacts(content: string): string {
  let body = String(content || "").trimEnd();
  let prev = "";
  const patterns: RegExp[] = [
    /\n?\s*\{\s*"laws"\s*:\s*\[[\s\S]*?\]\s*,\s*"judgments"\s*:\s*\[[\s\S]*?\]\s*\}\s*$/i,
    /\n?\s*\{\s*"judgments"\s*:\s*\[[\s\S]*?\]\s*,\s*"laws"\s*:\s*\[[\s\S]*?\]\s*\}\s*$/i,
    /\n?\s*\{\s*"laws"\s*:\s*[^,\}\n]*\s*,\s*"judgments"\s*:\s*[^\}\n]*\s*\}\s*$/i,
    /\n?\s*\{\s*"judgments"\s*:\s*[^,\}\n]*\s*,\s*"laws"\s*:\s*[^\}\n]*\s*\}\s*$/i,
    // Catch malformed JSON artifacts like {"laws","judgments"} or incomplete refs (with or without colons)
    /\n?\s*\{\s*"laws"\s*[:;,]?\s*[,:]?\s*"judgments"\s*[:;,]?\s*\}\s*$/i,
    /\n?\s*\{\s*"judgments"\s*[:;,]?\s*[,:]?\s*"laws"\s*[:;,]?\s*\}\s*$/i,
  ];
  while (body !== prev) {
    prev = body;
    for (const pattern of patterns) {
      body = body.replace(pattern, "").trimEnd();
    }
  }
  return body;
}

function renderSingleReferencesBlock(content: string, payload: unknown): string {
  const safePayload = normalizeReferencesPayload(payload);
  const normalizedJson = JSON.stringify(safePayload);

  // Remove any existing fenced references block(s) first (canonical and generic fences).
  let body = String(content || "").replace(/```references\s*[\s\S]*?```/gi, "").trimEnd();
  // Also strip generic ```json or ``` fences that the AI sometimes wraps the refs block in.
  body = body.replace(/```(?:json)?\s*\{\s*"(?:laws|judgments)"[\s\S]*?\}\s*```/gi, "").trimEnd();
  body = stripTrailingReferencesArtifacts(body);

  if (!body) return `\`\`\`references\n${normalizedJson}\n\`\`\``;
  return `${body}\n\n\`\`\`references\n${normalizedJson}\n\`\`\``;
}

function ensureAlWakeeloReferencesBlock(content: string): string {
  const refsRegex = /```references\s*([\s\S]*?)```/i;
  const match = content.match(refsRegex);
  let payload: unknown = { laws: [], judgments: [] };

  if (!match) {
    // Also strip generic ```json or ``` code fences that wrap the refs JSON before parsing
    const stripped = String(content || "").replace(/```(?:json)?\s*([\s\S]*?)```\s*$/i, (_, inner) => inner.trimEnd());
    const loosePayload = parseLooseReferencesJsonAtEnd(stripped);
    if (loosePayload) payload = loosePayload;
    return renderSingleReferencesBlock(stripped.trim(), payload);
  }

  try {
    payload = JSON.parse(match[1].trim());
  } catch {
    payload = { laws: [], judgments: [] };
  }
  return renderSingleReferencesBlock(content, payload);
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

function userPromptHasPakistaniCitationHint(text: string): boolean {
  const input = String(text || "");
  if (!input.trim()) return false;
  const candidates = extractCaseCitationCandidates(input);
  if (candidates.length === 0) return false;
  return candidates.some((candidate) => {
    if (parseCaseLawCitationParts(candidate)) return true;
    return /\b(?:19|20)\d{2}\s+(?:PLD|SCMR|YLR|MLD|CLC|CLD|PLC|PLJ|PCRLJ|P\s*Cr\.?\s*L\.?\s*J|PTD|NLR|LHC|IHC|SHC|PHC|BHC|AJKHC)\s+\d{1,6}\b/i.test(candidate);
  });
}

function suppressWrongIndianJurisdictionForPakCitation(responseText: string, _userPrompt: string): string {
  // Disabled — passthrough
  return String(responseText || "");
}

type RawLawRef = { name?: string; section?: string; description?: string };
type RawJudgmentRef = { citation?: string; court?: string; description?: string };

function sanitizeReferenceText(value: string, maxLen: number): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function hasLinkedPrimaryCaseLawSource(
  entry: Pick<CaseLaw, "citationRole" | "sourceDocId" | "sourceType">,
): boolean {
  const role = String(entry.citationRole || "").toLowerCase();
  if (role !== "primary") return false;
  const sourceDocId = Number(entry.sourceDocId || 0);
  if (!Number.isInteger(sourceDocId) || sourceDocId <= 0) return false;
  const sourceType = String(entry.sourceType || "").toLowerCase();
  // Include "judgment" — citations resolved from the judgments table have sourceType:"judgment"
  // and no sourceDocId, but are real verified DB records, not hallucinations.
  if (sourceType === "judgment") return true;
  // Document-backed: require a valid sourceDocId for these types
  return sourceType === "admin" || sourceType === "user" || sourceType === "statute";
}

async function verifyReferencesBlock(
  content: string,
  policy?: CitationPolicy,
  trustedCitations?: Iterable<string>,
  trustedTitles?: Array<{ title: string; citation: string }>,
): Promise<string> {
  const effectivePolicy = policy || DEFAULT_CITATION_POLICY;
  const match = content.match(REFERENCES_BLOCK_REGEX);
  const proseBody = content.replace(REFERENCES_BLOCK_REGEX, "");

  // JSON-failure-proof strategy: NEVER depend on the model's inline JSON.
  // We always rebuild the references block server-side from the prose.
  // The model's JSON (when valid) is used only as a description-enrichment hint.
  let modelParsed: { laws?: RawLawRef[]; judgments?: RawJudgmentRef[] } = { laws: [], judgments: [] };
  if (match) {
    try {
      const candidate = JSON.parse(match[1].trim() || "{}");
      modelParsed = {
        laws: Array.isArray(candidate.laws) ? candidate.laws : [],
        judgments: Array.isArray(candidate.judgments) ? candidate.judgments : [],
      };
    } catch {
      // Malformed JSON — try one repair attempt for description hints, but never block on it.
      const repaired = await repairReferencesJson(match[1].trim()).catch(() => null);
      if (repaired) {
        modelParsed = {
          laws: Array.isArray(repaired.laws) ? (repaired.laws as RawLawRef[]) : [],
          judgments: Array.isArray(repaired.judgments) ? (repaired.judgments as RawJudgmentRef[]) : [],
        };
        console.log(`[verifyReferencesBlock] AI repair succeeded: laws=${modelParsed.laws!.length} judgments=${modelParsed.judgments!.length}`);
      } else {
        console.log("[verifyReferencesBlock] Model JSON malformed — rebuilding from prose");
      }
    }
  }

  // Build prose-extracted judgment list (always, regardless of model JSON state).
  const proseJudgmentRefs: RawJudgmentRef[] = [];
  {
    const seen = new Set<string>();
    for (const c of extractCaseCitationCandidates(proseBody)) {
      const key = c.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      proseJudgmentRefs.push({ citation: c, court: "Pakistani Courts", description: "" });
      if (proseJudgmentRefs.length >= 12) break;
    }

    // Title -> citation recovery: model often writes case names like
    // "Sohail Iqbal vs State" instead of formal citations. The trusted-pool
    // titles let us map those back to the verified DB citation, so the user
    // gets a clickable card for every pool case the model referenced by name.
    if (trustedTitles && trustedTitles.length > 0) {
      const normalizeTitle = (s: string) =>
        String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
      const proseLower = normalizeTitle(proseBody);
      for (const { title, citation } of trustedTitles) {
        if (proseJudgmentRefs.length >= 12) break;
        const titleKey = normalizeTitle(title);
        // Skip very short titles (would false-positive on common words)
        if (!titleKey || titleKey.length < 12) continue;
        if (!proseLower.includes(titleKey)) continue;
        const citeKey = String(citation).toLowerCase().replace(/\s+/g, " ").trim();
        if (!citeKey || seen.has(citeKey)) continue;
        seen.add(citeKey);
        proseJudgmentRefs.push({ citation, court: "Pakistani Courts", description: "" });
      }
    }
  }

  // Build prose-extracted law list (always).
  const proseLawRefs: RawLawRef[] = [];
  {
    const seen = new Set<string>();
    for (const m of extractStatuteMentions(proseBody)) {
      const name = m.statuteName || "";
      const section = m.sectionLabel || (m.section ? `Section ${m.section}` : "");
      const key = `${name.toLowerCase()}::${section.toLowerCase()}`;
      if (!name || seen.has(key)) continue;
      seen.add(key);
      proseLawRefs.push({ name, section, description: "" });
      if (proseLawRefs.length >= 12) break;
    }
  }

  // Merge: prose entries are authoritative; model JSON enriches descriptions when citation matches.
  const judgmentDescByKey = new Map<string, string>();
  for (const j of modelParsed.judgments || []) {
    const cit = sanitizeReferenceText(j?.citation || "", 140);
    const desc = sanitizeReferenceText(j?.description || "", 320);
    if (cit && desc) judgmentDescByKey.set(cit.toLowerCase().replace(/\s+/g, " ").trim(), desc);
  }
  const lawDescByKey = new Map<string, string>();
  for (const l of modelParsed.laws || []) {
    const name = sanitizeReferenceText(l?.name || "", 180);
    const section = sanitizeReferenceText(l?.section || "", 80);
    const desc = sanitizeReferenceText(l?.description || "", 320);
    if (name && desc) lawDescByKey.set(`${name.toLowerCase()}::${section.toLowerCase()}`, desc);
  }

  // Enrich prose entries with model descriptions where available.
  for (const j of proseJudgmentRefs) {
    const k = String(j.citation).toLowerCase().replace(/\s+/g, " ").trim();
    const d = judgmentDescByKey.get(k);
    if (d) j.description = d;
  }
  for (const l of proseLawRefs) {
    const k = `${String(l.name).toLowerCase()}::${String(l.section || "").toLowerCase()}`;
    const d = lawDescByKey.get(k);
    if (d) l.description = d;
  }

  // Add model entries that prose missed (e.g. citation styles regex doesn't catch).
  const proseJudgmentKeys = new Set(
    proseJudgmentRefs.map((j) => String(j.citation).toLowerCase().replace(/\s+/g, " ").trim()),
  );
  for (const j of modelParsed.judgments || []) {
    const cit = sanitizeReferenceText(j?.citation || "", 140);
    if (!cit) continue;
    const k = cit.toLowerCase().replace(/\s+/g, " ").trim();
    if (proseJudgmentKeys.has(k)) continue;
    proseJudgmentKeys.add(k);
    proseJudgmentRefs.push({
      citation: cit,
      court: sanitizeReferenceText(j?.court || "Pakistani Courts", 120),
      description: sanitizeReferenceText(j?.description || "", 320),
    });
    if (proseJudgmentRefs.length >= 12) break;
  }
  const proseLawKeys = new Set(
    proseLawRefs.map((l) => `${String(l.name).toLowerCase()}::${String(l.section || "").toLowerCase()}`),
  );
  for (const l of modelParsed.laws || []) {
    const name = sanitizeReferenceText(l?.name || "", 180);
    const section = sanitizeReferenceText(l?.section || "", 80);
    if (!name && !section) continue;
    const k = `${name.toLowerCase()}::${section.toLowerCase()}`;
    if (proseLawKeys.has(k)) continue;
    proseLawKeys.add(k);
    proseLawRefs.push({ name, section, description: sanitizeReferenceText(l?.description || "", 320) });
    if (proseLawRefs.length >= 12) break;
  }

  const parsed: { laws?: RawLawRef[]; judgments?: RawJudgmentRef[] } = {
    laws: proseLawRefs,
    judgments: proseJudgmentRefs,
  };

  const inputLaws = Array.isArray(parsed.laws) ? parsed.laws.slice(0, 12) : [];
  const inputJudgments = Array.isArray(parsed.judgments) ? parsed.judgments.slice(0, 12) : [];
  const verifiedLaws: Array<{ name: string; section: string; description: string }> = [];
  const verifiedJudgments: Array<{ citation: string; court: string; description: string }> = [];
  const seenLaws = new Set<string>();
  const seenJudgments = new Set<string>();
  const lawRows = await Promise.all(
    inputLaws.map(async (law) => {
      const name = sanitizeReferenceText(law?.name || "", 180);
      const section = sanitizeReferenceText(law?.section || "", 80);
      const description = sanitizeReferenceText(law?.description || "", 320);
      if (!name && !section) return null;
      const query = `${name} ${section}`.trim();
      const matched = query ? await storage.searchStatutes(query, 3).catch(() => []) : [];
      const primary = matched.length > 0 ? matched[0] : null;
      return {
        name: sanitizeReferenceText(primary?.shortTitle || name || "Pakistani Statute", 180),
        section: sanitizeReferenceText(section || primary?.section || "", 80),
        description: sanitizeReferenceText(description || primary?.description || "", 320),
      };
    }),
  );
  for (const normalizedLaw of lawRows) {
    if (!normalizedLaw) continue;
    const lawKey = `${normalizedLaw.name.toLowerCase()}::${normalizedLaw.section.toLowerCase()}`;
    if (seenLaws.has(lawKey)) continue;
    seenLaws.add(lawKey);
    verifiedLaws.push(normalizedLaw);
  }

  // Build the normalized trusted-pool keys once (citations from upstream
  // tool-search hits — already verified to exist in the DB).
  const trustedPoolKeys = new Set<string>();
  if (trustedCitations) {
    for (const c of trustedCitations) {
      const k = normalizeCitationForMatch(String(c || ""));
      if (k) trustedPoolKeys.add(k);
    }
  }
  const poolMode = trustedPoolKeys.size > 0 && effectivePolicy.strict;

  const judgmentRows = await Promise.all(
    inputJudgments.map(async (judgment) => {
      const citation = sanitizeReferenceText(judgment?.citation || "", 140);
      const court = sanitizeReferenceText(judgment?.court || "", 120);
      const description = sanitizeReferenceText(judgment?.description || "", 320);
      if (!citation) return null;

      // Trusted-pool fast path: citation is in the tool-search pool. Real by
      // construction; bypass the strict resolver (which false-negatives on
      // formatting variants).
      const citationKey = normalizeCitationForMatch(citation);
      if (citationKey && trustedPoolKeys.has(citationKey)) {
        return {
          citation: sanitizeReferenceText(citation, 140),
          court: sanitizeReferenceText(court || "Pakistani Courts", 120),
          description: sanitizeReferenceText(description, 320),
        };
      }

      // Pool mode: in strict mode with a non-empty pool, off-pool citations
      // are rejected without a DB call. The pool IS the canonical set for
      // this query.
      if (poolMode) return null;

      if (!effectivePolicy.strict) {
        // Non-strict mode: trust the AI-provided citation data.
        return {
          citation: sanitizeReferenceText(citation, 140),
          court: sanitizeReferenceText(court || "Pakistani Courts", 120),
          description: sanitizeReferenceText(description, 320),
        };
      }

      // Strict mode + empty pool: full DB verification + linked primary source
      const matched = await resolveCaseCitationFromInternalDb(citation, {
        requirePrimary: true,
        requireLinkedSource: true,
      }).catch(() => null);
      const isDbVerified = Boolean(matched && isCaseLawRowCitationTrusted(matched));
      if (!isDbVerified || !matched || !hasLinkedPrimaryCaseLawSource(matched)) return null;
      return {
        citation: sanitizeReferenceText(matched.citation, 140),
        court: sanitizeReferenceText(matched.court || court || "Pakistani Courts", 120),
        description: sanitizeReferenceText(description || matched.summary || "", 320),
      };
    }),
  );
  for (const normalizedJudgment of judgmentRows) {
    if (!normalizedJudgment) continue;
    const judgmentKey = normalizedJudgment.citation.toLowerCase();
    if (seenJudgments.has(judgmentKey)) continue;
    seenJudgments.add(judgmentKey);
    verifiedJudgments.push(normalizedJudgment);
  }

  const normalized = JSON.stringify({
    laws: verifiedLaws.slice(0, 10),
    judgments: verifiedJudgments.slice(0, 10),
  });
  return renderSingleReferencesBlock(content, JSON.parse(normalized));
}

async function applyAlWakeeloSafetyGuardrails(
  content: string,
  policy?: CitationPolicy,
  trustedCitations?: Iterable<string>,
  trustedTitles?: Array<{ title: string; citation: string }>,
): Promise<string> {
  const withRefs = ensureAlWakeeloReferencesBlock(content);
  const verifiedRefs = await verifyReferencesBlock(withRefs, policy, trustedCitations, trustedTitles);
  return verifiedRefs;
}

type CitationParts = { year: number; journalCode: string; page: number };
type CaseLawCitationQueryParts = { year: number; report: string; page: number };
type ExtractedCaseDraftRow = {
  citation: string;
  citationRole?: "primary" | "cited" | string;
  court?: string;
  title: string;
  summary?: string;
  keywords?: string[] | string;
};
const CASELAW_REPORT_CODES = new Set([
  "PLD", "SCMR", "YLR", "MLD", "CLC", "PCRLJ", "PLJ", "PLC", "NLR",
  "PSC", "ALD", "KLR", "PTD", "PTCL", "PLS", "GBLR", "CLD", "TAX", "SLR",
  "AIR",
  "LHC", "IHC", "SHC", "PHC", "BHC", "AJKHC",
]);
const NEUTRAL_COURT_REPORT_CODES = new Set(["LHC", "IHC", "SHC", "PHC", "BHC", "AJKHC"]);
const NEUTRAL_COURT_NAME_BY_REPORT: Record<string, string> = {
  LHC: "Lahore High Court",
  IHC: "Islamabad High Court",
  SHC: "Sindh High Court",
  PHC: "Peshawar High Court",
  BHC: "Balochistan High Court",
  AJKHC: "High Court of Azad Jammu and Kashmir",
};

function buildFlexibleReportPattern(code: string): string {
  const letters = String(code || "").replace(/[^A-Za-z]/g, "").split("");
  return letters.map((ch) => `${ch}\\.?`).join("\\s*");
}

function deriveNeutralPrimaryCitationFromFilename(sourceFilename?: string | null): CaseLawCitationQueryParts | null {
  const rawName = String(sourceFilename || "").trim();
  if (!rawName) return null;
  const baseName = rawName.replace(/\.[^.]+$/g, "").trim();
  if (!baseName) return null;
  const parsed = parseCaseLawCitationQuery(baseName);
  if (!parsed) return null;
  const report = normalizeCitationToken(String(parsed.report || ""));
  if (!NEUTRAL_COURT_REPORT_CODES.has(report)) return null;
  return {
    year: Number(parsed.year),
    report,
    page: Number(parsed.page),
  };
}

function ensureFilenameNeutralPrimaryCaseRow(
  extractedCases: ExtractedCaseDraftRow[],
  sourceFilename?: string | null,
): ExtractedCaseDraftRow[] {
  const neutral = deriveNeutralPrimaryCitationFromFilename(sourceFilename);
  if (!neutral) return Array.isArray(extractedCases) ? extractedCases : [];

  const canonical = `${neutral.year}${neutral.report}${neutral.page}`;
  const rows = Array.isArray(extractedCases)
    ? extractedCases.map((row) => ({
      ...row,
      citation: String(row?.citation || "").trim(),
      title: String(row?.title || "").trim(),
      summary: String(row?.summary || "").trim(),
      court: String(row?.court || "").trim(),
      keywords: Array.isArray(row?.keywords)
        ? row.keywords
        : (typeof row?.keywords === "string"
          ? row.keywords.split(",").map((item) => String(item || "").trim()).filter(Boolean)
          : []),
    }))
    : [];

  let targetIndex = rows.findIndex((row) => caseCitationMatches(canonical, String(row.citation || "")));
  if (targetIndex >= 0) {
    rows[targetIndex].citation = canonical;
    if (!rows[targetIndex].court) {
      rows[targetIndex].court = NEUTRAL_COURT_NAME_BY_REPORT[neutral.report] || "";
    }
  } else {
    rows.unshift({
      citation: canonical,
      citationRole: "primary",
      court: NEUTRAL_COURT_NAME_BY_REPORT[neutral.report] || "",
      title: `Case reported at ${canonical}`,
      summary: `Case cited as ${canonical}`,
      keywords: ["Pakistani law", "case law", neutral.report],
    });
    targetIndex = 0;
  }

  for (const row of rows) {
    row.citationRole = "cited";
  }
  if (targetIndex >= 0 && targetIndex < rows.length) {
    rows[targetIndex].citationRole = "primary";
  }
  return rows;
}

const CASELAW_REPORT_FLEX_PATTERN = Array.from(CASELAW_REPORT_CODES)
  .map((code) => buildFlexibleReportPattern(code))
  .join("|");

function normalizeCitationToken(token: string): string {
  return String(token || "")
    .replace(/\bP\.?\s*Cr\.?\s*L\.?\s*J\b/gi, "PCRLJ")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function resolveCaseLawReportToken(raw: string): string | null {
  const direct = normalizeCitationToken(raw);
  if (CASELAW_REPORT_CODES.has(direct)) return direct;

  const tokens = String(raw || "")
    .split(/\s+/g)
    .map((token) => normalizeCitationToken(token))
    .filter(Boolean);
  if (tokens.length === 0) return null;

  for (let len = tokens.length; len >= 1; len -= 1) {
    for (let start = 0; start + len <= tokens.length; start += 1) {
      const candidate = tokens.slice(start, start + len).join("");
      if (CASELAW_REPORT_CODES.has(candidate)) return candidate;
    }
  }
  return null;
}

function parseCitationParts(citation: string, journalCodeMap: Map<string, string>): CitationParts | null {
  const raw = String(citation || "").trim();
  if (!raw) return null;

  const normalized = raw
    .replace(/[()[\],;:_/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const compactNeutral = normalized.match(/\b((?:19|20)\d{2})(LHC|IHC|SHC|PHC|BHC|AJKHC)(\d{1,6})\b/i);
  if (compactNeutral) {
    const year = Number(compactNeutral[1]);
    const page = Number(compactNeutral[3]);
    const mapped = journalCodeMap.get(normalizeCitationToken(compactNeutral[2]));
    if (mapped && Number.isInteger(year) && Number.isInteger(page) && page > 0) {
      return { year, journalCode: mapped, page };
    }
  }
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length < 3) return null;

  const yearIdx = tokens.findIndex((token) => /^(19|20)\d{2}$/.test(token));
  if (yearIdx < 0) return null;
  const year = Number(tokens[yearIdx]);
  if (!Number.isInteger(year)) return null;

  const pageIdx = tokens
    .map((token, idx) => ({ token, idx }))
    .filter(({ token, idx }) => idx > yearIdx && /^\d{1,5}$/.test(token) && Number(token) > 0)
    .map(({ idx }) => idx)
    .pop();
  if (!Number.isInteger(pageIdx) || pageIdx === undefined) return null;

  const page = Number(tokens[pageIdx]);
  if (!Number.isInteger(page) || page < 1) return null;

  const phraseCandidates: string[] = [];
  const yearTail = tokens.slice(yearIdx + 1, pageIdx);
  if (yearTail.length > 0) {
    phraseCandidates.push(yearTail.join(" "));
  }
  phraseCandidates.push(
    tokens[yearIdx + 1],
    tokens[yearIdx + 2],
    tokens[yearIdx - 1],
    tokens[yearIdx - 2],
  );

  let journalCode: string | undefined;
  for (const phrase of phraseCandidates) {
    if (!phrase || typeof phrase !== "string") continue;
    const direct = journalCodeMap.get(normalizeCitationToken(phrase));
    if (direct) {
      journalCode = direct;
      break;
    }
    const resolved = resolveCaseLawReportToken(phrase);
    const mapped = resolved ? journalCodeMap.get(resolved) : undefined;
    if (mapped) {
      journalCode = mapped;
      break;
    }
  }
  if (!journalCode) return null;

  return { year, journalCode, page };
}

function parseCaseLawCitationQuery(query: string): CaseLawCitationQueryParts | null {
  const raw = String(query || "").trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/[()[\],;:_/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const compactNeutral = normalized.match(/\b((?:19|20)\d{2})(LHC|IHC|SHC|PHC|BHC|AJKHC)(\d{1,6})\b/i);
  if (compactNeutral) {
    const year = Number(compactNeutral[1]);
    const report = normalizeCitationToken(compactNeutral[2]);
    const page = Number(compactNeutral[3]);
    if (Number.isInteger(year) && Number.isInteger(page) && page > 0 && report) {
      return { year, report, page };
    }
  }

  const yearFirst =
    normalized.match(/\b((?:19|20)\d{2})\s+([A-Za-z][A-Za-z0-9.]{0,12}(?:\s+[A-Za-z][A-Za-z0-9.]{0,12}){0,4})\s+(\d{1,6})\b/i);
  if (yearFirst) {
    const year = Number(yearFirst[1]);
    const page = Number(yearFirst[3]);
    const report = resolveCaseLawReportToken(yearFirst[2]) || normalizeCitationToken(yearFirst[2]);
    if (Number.isInteger(year) && Number.isInteger(page) && page > 0 && report) {
      return { year, report, page };
    }
  }

  const reportFirst =
    normalized.match(
      /\b([A-Za-z][A-Za-z0-9.]{0,12}(?:\s+[A-Za-z][A-Za-z0-9.]{0,12}){0,4})\s+((?:19|20)\d{2})(?:\s+(?:SC|Lah\.?|Lahore|Kar\.?|Karachi|Pesh\.?|Peshawar|Islamabad|Sindh|Balochistan|FSC|Federal\s+Shariat(?:\s+Court)?|Supreme\s+Court))?\s+(\d{1,6})\b/i,
    );
  if (!reportFirst) return null;
  const report = resolveCaseLawReportToken(reportFirst[1]) || normalizeCitationToken(reportFirst[1]);
  const year = Number(reportFirst[2]);
  const page = Number(reportFirst[3]);
  if (!Number.isInteger(year) || !Number.isInteger(page) || page < 1 || !report) return null;
  return { year, report, page };
}

function isTrustedCaseLawCitationParts(parts: CaseLawCitationQueryParts | null | undefined): parts is CaseLawCitationQueryParts {
  if (!parts) return false;
  const year = Number(parts.year);
  const page = Number(parts.page);
  const report = normalizeCitationToken(String(parts.report || ""));
  const currentYear = new Date().getFullYear();
  if (!CASELAW_REPORT_CODES.has(report)) return false;
  if (!Number.isInteger(year) || year < 1947 || year > currentYear + 1) return false;
  if (!Number.isInteger(page) || page < 1 || page > 200000) return false;
  return true;
}

function getTrustedCaseLawCitationPartsFromRow(entry: Pick<CaseLaw, "citation" | "citationYear" | "citationReport" | "citationPage">): CaseLawCitationQueryParts | null {
  const report = normalizeCitationToken(String(entry.citationReport || ""));
  const year = Number(entry.citationYear);
  const page = Number(entry.citationPage);
  const fromFields = report && Number.isInteger(year) && Number.isInteger(page) && page > 0
    ? { year, report, page }
    : null;
  if (isTrustedCaseLawCitationParts(fromFields)) return fromFields;
  const fromCitation = parseCaseLawCitationQuery(String(entry.citation || ""));
  if (isTrustedCaseLawCitationParts(fromCitation)) return fromCitation;
  return null;
}

function isCaseLawRowCitationTrusted(entry: Pick<CaseLaw, "citation" | "citationYear" | "citationReport" | "citationPage">): boolean {
  return Boolean(getTrustedCaseLawCitationPartsFromRow(entry));
}

function caseLawSearchRowKey(entry: CaseLaw): string {
  const citationKey = normalizeCitationForMatch(String(entry.citation || ""));
  if (citationKey) return `c:${citationKey}`;
  const report = normalizeCitationToken(String(entry.citationReport || ""));
  const year = Number(entry.citationYear);
  const page = Number(entry.citationPage);
  if (report && Number.isInteger(year) && Number.isInteger(page) && page > 0) {
    return `p:${report}:${year}:${page}`;
  }
  return `id:${entry.id}`;
}

function scoreCaseLawTextMatch(entry: CaseLaw, query: string): number {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return 0;
  const title = String(entry.title || "").toLowerCase();
  const summary = String(entry.summary || "").toLowerCase();
  const citation = String(entry.citation || "").toLowerCase();
  const court = String(entry.court || "").toLowerCase();

  let score = 0;
  if (title.includes(q)) score += 5;
  if (summary.includes(q)) score += 4;
  if (citation.includes(q)) score += 4;
  if (court.includes(q)) score += 1;

  const tokens = q.split(/\s+/g).filter((token) => token.length >= 3);
  for (const token of tokens.slice(0, 8)) {
    if (title.includes(token)) score += 1.5;
    if (summary.includes(token)) score += 1.2;
    if (citation.includes(token)) score += 1.2;
  }
  return score;
}

function buildSearchTokens(query: string, minLength: number = 3): string[] {
  return String(query || "")
    .toLowerCase()
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= minLength)
    .slice(0, 12);
}

function scoreSourceTextMatch(sourceText: string, query: string): number {
  const text = String(sourceText || "").toLowerCase();
  const q = String(query || "").trim().toLowerCase();
  if (!text || !q) return 0;

  let score = 0;
  if (text.includes(q)) score += 14;
  const tokens = buildSearchTokens(q, 3);
  for (const token of tokens) {
    if (!token) continue;
    if (text.includes(token)) score += 2.2;
  }
  return score;
}

function isLikelyDerivedCitationEntry(entry: CaseLaw): boolean {
  const title = String(entry.title || "").trim().toLowerCase();
  const summary = String(entry.summary || "").trim().toLowerCase();
  const keywordString = Array.isArray(entry.keywords) ? entry.keywords.join(" ").toLowerCase() : "";

  if (title.startsWith("case reported at ")) return true;
  if (summary.startsWith("case cited as ")) return true;
  if (title.startsWith("reference may be made to ")) return true;
  if (title.includes(" case no") && title.length < 140 && /reported at/i.test(title)) return true;
  if (keywordString.includes("pakistani law") && keywordString.includes("case law") && title.startsWith("case reported at")) {
    return true;
  }
  return false;
}

function collapseCaseRowsBySource(rows: CaseLaw[]): CaseLaw[] {
  const out: CaseLaw[] = [];
  const seenSource = new Set<string>();
  const seenFallback = new Set<string>();
  for (const row of rows) {
    const sourceType = String(row.sourceType || "").toLowerCase();
    const sourceDocId = Number(row.sourceDocId || 0);
    if (sourceType && Number.isInteger(sourceDocId) && sourceDocId > 0) {
      const sourceKey = `${sourceType}:${sourceDocId}`;
      if (seenSource.has(sourceKey)) continue;
      seenSource.add(sourceKey);
      out.push(row);
      continue;
    }
    const fallbackKey = caseLawSearchRowKey(row);
    if (seenFallback.has(fallbackKey)) continue;
    seenFallback.add(fallbackKey);
    out.push(row);
  }
  return out;
}

function filterToTrustedCaseLawRows(rows: CaseLaw[]): CaseLaw[] {
  return rows.filter((row) => isCaseLawRowCitationTrusted(row));
}

function filterToPrimaryCaseLawRows(rows: CaseLaw[]): CaseLaw[] {
  return rows.filter((row) => String(row.citationRole || "").toLowerCase() === "primary");
}

function filterCaseLawByStructuredFields(
  rows: CaseLaw[],
  options: {
    year?: number;
    report?: string;
    page?: number;
    court?: string;
  },
): CaseLaw[] {
  const year = Number.isInteger(Number(options.year)) ? Number(options.year) : undefined;
  const page = Number.isInteger(Number(options.page)) ? Number(options.page) : undefined;
  const report = normalizeCitationToken(String(options.report || "").trim());
  const court = String(options.court || "").trim().toLowerCase();

  return rows.filter((row) => {
    if (year && Number(row.citationYear) !== year) return false;
    if (page && Number(row.citationPage) !== page) return false;
    if (report && normalizeCitationToken(String(row.citationReport || "")) !== report) return false;
    if (court && !String(row.court || "").toLowerCase().includes(court)) return false;
    return true;
  });
}

type SourceTextLoadOptions = {
  includeMetadataFallback?: boolean;
  allowRemoteFileRead?: boolean;
};

type SourceTextLoader = (
  entry: {
    sourceDocId?: number | null;
    sourceType?: string | null;
    summary?: string | null;
    title?: string | null;
    citation?: string | null;
  },
  options?: SourceTextLoadOptions,
) => Promise<string>;

async function rankCaseLawRowsBySourceRelevance(
  rows: CaseLaw[],
  userId: string,
  query: string,
  sourceTextLoader?: SourceTextLoader,
): Promise<CaseLaw[]> {
  if (rows.length <= 1) return rows;
  const scored = await Promise.all(
    rows.map(async (row) => {
      let sourceText = "";
      try {
        const loadSourceText = sourceTextLoader
          ? (opts?: SourceTextLoadOptions) => sourceTextLoader(row, opts)
          : (opts?: SourceTextLoadOptions) => loadCaseLawSourceText(row, userId, opts);
        sourceText = await loadSourceText({
          includeMetadataFallback: false,
          allowRemoteFileRead: false,
        });
        if (!sourceText.trim()) {
          sourceText = await loadSourceText({
            includeMetadataFallback: false,
            allowRemoteFileRead: true,
          });
        }
      } catch {
        sourceText = "";
      }
      const metadataScore = scoreCaseLawTextMatch(row, query);
      const fullTextScore = scoreSourceTextMatch(sourceText, query);
      const recencyScore = Number.isInteger(Number(row.citationYear)) ? Number(row.citationYear) / 10000 : 0;
      const role = String(row.citationRole || "").toLowerCase();
      const roleScore = role === "primary" ? 8 : role === "cited" ? -2 : 0;
      const derivedPenalty = isLikelyDerivedCitationEntry(row) ? -10 : 6;
      return { row, score: metadataScore + fullTextScore + recencyScore + roleScore + derivedPenalty };
    }),
  );
  scored.sort((a, b) => b.score - a.score);
  return scored.map((item) => item.row);
}

async function searchCaseLawWithFullText(args: {
  userId: string;
  query: string;
  limit: number;
  year?: number;
  report?: string;
  page?: number;
  court?: string;
  sort?: "relevance" | "latest";
  parsedCitation?: CaseLawCitationQueryParts | null;
}): Promise<CaseLaw[]> {
  const query = String(args.query || "").trim();
  const sourceTextLoader = createCachedCaseLawSourceTextLoader(args.userId);
  const baseResultsPromise = storage.searchCaseLaw(args.query, args.limit, {
    year: args.year,
    report: args.report,
    page: args.page,
    court: args.court,
    sort: args.sort,
    parsedCitation: args.parsedCitation,
    includeSourceContentSearch: false,
  });
  const ragCandidatesPromise: Promise<CaseLaw[]> = !query
    ? Promise.resolve([])
    : (async () => {
      try {
        const retrieval = await retrieveForQuery({
          userId: args.userId,
          query,
          topK: Math.min(120, Math.max(args.limit * 4, 24)),
        });

        const sourceDocIds: number[] = [];
        const seenDocIds = new Set<number>();
        for (const match of retrieval.matches) {
          const sourceType = String((match.metadata || {}).sourceType || "").toLowerCase();
          if (sourceType !== "admin-case-law") continue;
          const sourceDocId = Number(match.sourceDocumentId);
          if (!Number.isInteger(sourceDocId) || sourceDocId <= 0 || seenDocIds.has(sourceDocId)) continue;
          seenDocIds.add(sourceDocId);
          sourceDocIds.push(sourceDocId);
          if (sourceDocIds.length >= Math.max(args.limit * 4, 30)) break;
        }

        if (sourceDocIds.length === 0) return [];
        const rowsRaw = await storage.getCaseLawBySourceDocuments(sourceDocIds, "admin");
        const rows = filterToPrimaryCaseLawRows(filterToTrustedCaseLawRows(rowsRaw));
        const filteredRows = filterCaseLawByStructuredFields(rows, {
          year: args.year,
          report: args.report,
          page: args.page,
          court: args.court,
        });

        const bestBySourceDoc = new Map<number, CaseLaw>();
        for (const row of filteredRows) {
          const sourceDocId = Number(row.sourceDocId || 0);
          if (!Number.isInteger(sourceDocId) || sourceDocId <= 0) continue;
          const existing = bestBySourceDoc.get(sourceDocId);
          if (!existing) {
            bestBySourceDoc.set(sourceDocId, row);
            continue;
          }
          const existingPrimary = String(existing.citationRole || "").toLowerCase() === "primary";
          const candidatePrimary = String(row.citationRole || "").toLowerCase() === "primary";
          if (candidatePrimary && !existingPrimary) {
            bestBySourceDoc.set(sourceDocId, row);
            continue;
          }
          const existingScore = scoreCaseLawTextMatch(existing, query);
          const candidateScore = scoreCaseLawTextMatch(row, query);
          if (candidateScore > existingScore) {
            bestBySourceDoc.set(sourceDocId, row);
          }
        }

        return sourceDocIds
          .map((sourceDocId) => bestBySourceDoc.get(sourceDocId))
          .filter((row): row is CaseLaw => Boolean(row));
      } catch (err) {
        console.warn("[CaseLaw Search] Full-text retrieval fallback unavailable:", err);
        return [];
      }
    })();

  const [baseResultsRaw, ragCandidates] = await Promise.all([baseResultsPromise, ragCandidatesPromise]);
  const baseResults = filterToPrimaryCaseLawRows(filterToTrustedCaseLawRows(baseResultsRaw));
  if (!query) {
    return filterCaseLawResultsWithRealFullText(baseResults, args.userId, sourceTextLoader);
  }

  const merged: CaseLaw[] = [];
  const seen = new Set<string>();
  for (const row of [...baseResults, ...ragCandidates]) {
    const key = caseLawSearchRowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
    if (merged.length >= args.limit) break;
  }
  const strictFullTextRows = await filterCaseLawResultsWithRealFullText(merged, args.userId, sourceTextLoader);
  const rankedStrictRows = await rankCaseLawRowsBySourceRelevance(strictFullTextRows, args.userId, query, sourceTextLoader);
  const citationIntent = Boolean(args.parsedCitation || parseCaseLawCitationQuery(query));
  const normalizedStrictRows = citationIntent ? rankedStrictRows : collapseCaseRowsBySource(rankedStrictRows);
  if (normalizedStrictRows.length >= args.limit) {
    return normalizedStrictRows.slice(0, args.limit);
  }

  // Top-up from a wider pool when strict text filtering removes metadata-only entries.
  if (normalizedStrictRows.length < args.limit) {
    const topUpLimit = Math.max(args.limit * 3, args.limit + 10);
    const topUpRowsRaw = await storage.searchCaseLaw(args.query, topUpLimit, {
      year: args.year,
      report: args.report,
      page: args.page,
      court: args.court,
      sort: args.sort,
      parsedCitation: args.parsedCitation,
      includeSourceContentSearch: false,
    });
    const topUpRows = filterToPrimaryCaseLawRows(filterToTrustedCaseLawRows(topUpRowsRaw));
    const topUpFiltered = await filterCaseLawResultsWithRealFullText(topUpRows, args.userId, sourceTextLoader);
    const topUpRanked = await rankCaseLawRowsBySourceRelevance(topUpFiltered, args.userId, query, sourceTextLoader);
    const topUpNormalized = citationIntent ? topUpRanked : collapseCaseRowsBySource(topUpRanked);
    const out: CaseLaw[] = [];
    const outSeen = new Set<string>();
    for (const row of [...normalizedStrictRows, ...topUpNormalized]) {
      const key = caseLawSearchRowKey(row);
      if (outSeen.has(key)) continue;
      outSeen.add(key);
      out.push(row);
      if (out.length >= args.limit) break;
    }
    const reranked = await rankCaseLawRowsBySourceRelevance(out, args.userId, query, sourceTextLoader);
    const rerankedNormalized = citationIntent ? reranked : collapseCaseRowsBySource(reranked);
    return rerankedNormalized.slice(0, args.limit);
  }

  return normalizedStrictRows;
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
  options?: {
    includeMetadataFallback?: boolean;
    allowRemoteFileRead?: boolean;
  },
): Promise<string> {
  const sourceType = String(entry.sourceType || "").toLowerCase();
  const sourceDocId = Number(entry.sourceDocId || 0);
  const includeMetadataFallback = options?.includeMetadataFallback !== false;
  const allowRemoteFileRead = options?.allowRemoteFileRead !== false;
  let content = "";

  if (sourceDocId > 0 && sourceType === "admin") {
    const doc = await storage.getAdminKnowledgeById(sourceDocId);
    if (doc) {
      content = doc.content || "";
      const fileMeta = await storage.getAdminKnowledgeFile(doc.id);
      if (allowRemoteFileRead && fileMeta?.extractedTextKey) {
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
      if (allowRemoteFileRead && fileMeta?.extractedTextKey) {
        const fullContent = await getR2ObjectText(fileMeta.extractedTextKey);
        if (fullContent) content = fullContent;
      }
    }
  } else if (sourceDocId > 0 && sourceType === "user") {
    const doc = await storage.getDocumentById(sourceDocId, userId);
    if (doc) {
      content = doc.content || "";
      const fileMeta = await storage.getDocumentFile(doc.id, userId);
      if (allowRemoteFileRead && fileMeta?.extractedTextKey) {
        const fullContent = await getR2ObjectText(fileMeta.extractedTextKey);
        if (fullContent) content = fullContent;
      }
    }
  }

  if (includeMetadataFallback && !content.trim()) {
    const fallback = [entry.title || "", entry.summary || "", entry.citation || ""].filter(Boolean).join("\n\n");
    content = fallback;
  }
  return content.trim();
}

function createCachedCaseLawSourceTextLoader(userId: string): SourceTextLoader {
  const cache = new Map<string, Promise<string>>();

  return async (entry, options) => {
    const sourceType = String(entry.sourceType || "").toLowerCase();
    const sourceDocId = Number(entry.sourceDocId || 0);
    const includeMetadataFallback = options?.includeMetadataFallback !== false ? "1" : "0";
    const allowRemoteFileRead = options?.allowRemoteFileRead !== false ? "1" : "0";
    const key = [
      userId,
      sourceType,
      String(sourceDocId),
      includeMetadataFallback,
      allowRemoteFileRead,
      String(entry.citation || ""),
    ].join("::");

    let pending = cache.get(key);
    if (!pending) {
      pending = loadCaseLawSourceText(entry, userId, options)
        .then((text) => String(text || ""))
        .catch(() => "");
      cache.set(key, pending);
    }
    return pending;
  };
}

async function filterCaseLawResultsWithRealFullText(
  rows: CaseLaw[],
  userId: string,
  sourceTextLoader?: SourceTextLoader,
): Promise<CaseLaw[]> {
  if (rows.length === 0) return [];
  const localChecks = await Promise.all(
    rows.map(async (row) => {
      try {
        const sourceText = sourceTextLoader
          ? await sourceTextLoader(row, {
              includeMetadataFallback: false,
              allowRemoteFileRead: false,
            })
          : await loadCaseLawSourceText(row, userId, {
              includeMetadataFallback: false,
              allowRemoteFileRead: false,
            });
        if (!sourceText || sourceText.trim().length < 20) return null;
        return row;
      } catch {
        return null;
      }
    }),
  );
  const localRows = localChecks.filter((row): row is CaseLaw => Boolean(row));
  if (localRows.length > 0) return localRows;

  const remoteChecks = await Promise.all(
    rows.slice(0, Math.min(12, rows.length)).map(async (row) => {
      try {
        const sourceText = sourceTextLoader
          ? await sourceTextLoader(row, {
              includeMetadataFallback: false,
              allowRemoteFileRead: true,
            })
          : await loadCaseLawSourceText(row, userId, {
              includeMetadataFallback: false,
              allowRemoteFileRead: true,
            });
        if (!sourceText || sourceText.trim().length < 20) return null;
        return row;
      } catch {
        return null;
      }
    }),
  );
  return remoteChecks.filter((row): row is CaseLaw => Boolean(row));
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

async function persistExtractedCasesAndSync(args: {
  extractedCases: ExtractedCaseDraftRow[];
  sourceDocId?: number | null;
  sourceFilename?: string | null;
  actorUserId: string;
}): Promise<{
  inserted: number;
  errors: string[];
  citationSync?: {
    processed: number;
    imported: number;
    existing: number;
    skipped: number;
    failed: number;
    linked: number;
    unresolved: number;
    errors: string[];
  };
  citationSyncLimited: boolean;
  citationSyncDeferred: boolean;
}> {
  const extractedCases = ensureFilenameNeutralPrimaryCaseRow(args.extractedCases, args.sourceFilename);
  const seen = new Set<string>();
  const entries = extractedCases
    .map((c) => {
      const citation = sanitizeInputText(stripNullBytes(String(c.citation || "").trim()), 220);
      const title = sanitizeInputText(stripNullBytes(String(c.title || "").trim()), 500);
      if (!citation || !title) return null;
      const dedupeKey = `${citation.toLowerCase()}|${title.toLowerCase()}`;
      if (seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);
      const kw = Array.isArray(c.keywords)
        ? c.keywords
        : (typeof c.keywords === "string" ? c.keywords.split(",") : []);
      const keywords = kw
        .map((k) => sanitizeInputText(stripNullBytes(String(k || "").trim()), 64))
        .filter(Boolean)
        .slice(0, 30);
      const role = String(c.citationRole || "").toLowerCase() === "primary" ? "primary" : "cited";
      return {
        citation,
        citationRole: role as "primary" | "cited",
        court: sanitizeInputText(stripNullBytes(String(c.court || "").trim()), 180),
        title,
        summary: sanitizeInputText(stripNullBytes(String(c.summary || "").trim()), 20000),
        keywords,
        sourceDocId: args.sourceDocId || null,
        sourceType: args.sourceDocId ? "admin" : null,
        sourceFilename: sanitizeInputText(String(args.sourceFilename || ""), 220) || null,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (entries.length === 0) {
    return { inserted: 0, errors: [], citationSyncLimited: false, citationSyncDeferred: false };
  }

  const created: Array<{
    id: number;
    citation: string;
    court: string;
    title: string;
    summary: string;
    sourceDocId?: number | null;
    sourceType?: string | null;
  }> = [];
  const errors: string[] = [];
  const insertBatchSize = 150;

  for (let i = 0; i < entries.length; i += insertBatchSize) {
    const chunk = entries.slice(i, i + insertBatchSize);
    try {
      const insertedChunk = await storage.bulkCreateCaseLaw(chunk as any);
      created.push(...insertedChunk);
    } catch (chunkErr: any) {
      for (const row of chunk) {
        try {
          const inserted = await storage.createCaseLaw(row as any);
          created.push(inserted as any);
        } catch (rowErr: any) {
          errors.push(sanitizeInputText(rowErr?.message || "Insert failed", 300));
        }
      }
      console.warn("[Case Law Upload] Batch fallback activated:", sanitizeInputText(chunkErr?.message || "Unknown error", 300));
    }
  }

  if (created.length === 0) {
    return { inserted: 0, errors: errors.slice(0, 100), citationSyncLimited: false, citationSyncDeferred: false };
  }

  if (!shouldAutoSyncCaseLawUploads()) {
    return {
      inserted: created.length,
      errors: errors.slice(0, 100),
      citationSyncLimited: false,
      citationSyncDeferred: true,
    };
  }

  const syncBatch = created.slice(0, CASELAW_AUTO_SYNC_MAX);
  const citationSync = await syncCaseLawEntriesToJudgments(syncBatch, args.actorUserId);
  return {
    inserted: created.length,
    errors: errors.slice(0, 100),
    citationSync,
    citationSyncLimited: created.length > CASELAW_AUTO_SYNC_MAX,
    citationSyncDeferred: false,
  };
}

type PendingCaseLawAdminDoc = {
  id: number;
  title: string | null;
  filename: string | null;
  objectKey: string | null;
  extractedTextKey: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  caseLawProcessStatus: string | null;
  caseLawProcessAttempts: number | null;
  caseLawProcessLastAt: Date | null;
};

type CaseLawProcessTerminalStatus = "done" | "merged" | "no_cases" | "failed";
type CaseLawRetryTerminalStatus = Extract<CaseLawProcessTerminalStatus, "failed" | "no_cases" | "merged">;
type CaseLawPendingDiagnosticsSummary = {
  totalDocs: number;
  extractedDocs: number;
  pendingLegacy: number;
  actionablePending: number;
  processingFresh: number;
  maxAttemptsReached: number;
  terminalNoExtract: number;
};
type CaseLawPendingDiagnosticsStatusCount = {
  status: string;
  documents: number;
  noExtractDocuments: number;
  extractedDocuments: number;
};
type CaseLawPendingDiagnosticsTopError = {
  error: string;
  documents: number;
};

const CASELAW_RETRYABLE_TERMINAL_STATUSES: readonly CaseLawRetryTerminalStatus[] = ["failed", "no_cases", "merged"] as const;

function toCaseLawPendingDiagnosticsInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function normalizeCaseLawRetryTerminalStatuses(input: unknown): CaseLawRetryTerminalStatus[] {
  const source = Array.isArray(input)
    ? input
    : (typeof input === "string" ? input.split(",") : []);
  const normalized = source
    .map((value) => sanitizeInputText(String(value || "").trim().toLowerCase(), 24))
    .filter((value): value is CaseLawRetryTerminalStatus => (CASELAW_RETRYABLE_TERMINAL_STATUSES as readonly string[]).includes(value));
  if (normalized.length === 0) return ["failed", "no_cases"];
  return Array.from(new Set(normalized));
}

async function setCaseLawProcessState(args: {
  docId: number;
  status: string;
  attempts?: number;
  setLastAt?: boolean;
  error?: string | null;
}) {
  const patch: Record<string, any> = {
    caseLawProcessStatus: sanitizeInputText(String(args.status || "pending").trim().toLowerCase(), 32) || "pending",
  };
  if (Number.isInteger(Number(args.attempts)) && Number(args.attempts) >= 0) {
    patch.caseLawProcessAttempts = Number(args.attempts);
  }
  if (args.setLastAt !== false) {
    patch.caseLawProcessLastAt = new Date();
  }
  if (typeof args.error !== "undefined") {
    patch.caseLawProcessLastError = args.error
      ? sanitizeInputText(stripNullBytes(String(args.error || "")).trim(), 500)
      : null;
  }
  await db.update(adminKnowledge).set(patch as any).where(eq(adminKnowledge.id, args.docId));
}

async function finalizeCaseLawProcessState(args: {
  docId: number;
  status: CaseLawProcessTerminalStatus;
  error?: string | null;
}) {
  await setCaseLawProcessState({
    docId: args.docId,
    status: args.status,
    setLastAt: true,
    error: args.error ?? null,
  });
}

async function fetchPendingCaseLawAdminDocs(limit: number): Promise<PendingCaseLawAdminDoc[]> {
  const staleProcessingBefore = new Date(Date.now() - CASELAW_PENDING_PROCESSING_STALE_MINUTES * 60 * 1000);
  const rows = await db
    .select({
      id: adminKnowledge.id,
      title: adminKnowledge.title,
      filename: adminKnowledge.filename,
      objectKey: adminKnowledgeFiles.objectKey,
      extractedTextKey: adminKnowledgeFiles.extractedTextKey,
      mimeType: adminKnowledgeFiles.mimeType,
      sizeBytes: adminKnowledgeFiles.sizeBytes,
      caseLawProcessStatus: adminKnowledge.caseLawProcessStatus,
      caseLawProcessAttempts: adminKnowledge.caseLawProcessAttempts,
      caseLawProcessLastAt: adminKnowledge.caseLawProcessLastAt,
    })
    .from(adminKnowledge)
    .leftJoin(adminKnowledgeFiles, eq(adminKnowledgeFiles.adminKnowledgeId, adminKnowledge.id))
    .leftJoin(caseLaw, and(eq(caseLaw.sourceDocId, adminKnowledge.id), eq(caseLaw.sourceType, "admin")))
    .where(and(
      eq(adminKnowledge.category, "case-law"),
      sql`COALESCE(${adminKnowledge.caseLawProcessAttempts}, 0) < ${CASELAW_PENDING_MAX_ATTEMPTS}`,
      sql`(
        COALESCE(${adminKnowledge.caseLawProcessStatus}, 'pending') IN ('pending', 'retry')
        OR (
          COALESCE(${adminKnowledge.caseLawProcessStatus}, '') = 'processing'
          AND (
            ${adminKnowledge.caseLawProcessLastAt} IS NULL
            OR ${adminKnowledge.caseLawProcessLastAt} < ${staleProcessingBefore}
          )
        )
      )`,
    ))
    .groupBy(
      adminKnowledge.id,
      adminKnowledge.title,
      adminKnowledge.filename,
      adminKnowledge.caseLawProcessStatus,
      adminKnowledge.caseLawProcessAttempts,
      adminKnowledge.caseLawProcessLastAt,
      adminKnowledgeFiles.objectKey,
      adminKnowledgeFiles.extractedTextKey,
      adminKnowledgeFiles.mimeType,
      adminKnowledgeFiles.sizeBytes,
    )
    .having(eq(sql<number>`count(${caseLaw.id})`, 0))
    .orderBy(sql`${adminKnowledge.id} desc`)
    .limit(Math.max(1, Math.min(2000, limit)));
  return rows;
}

async function retryCaseLawTerminalDocs(args: {
  statuses: CaseLawRetryTerminalStatus[];
  limit: number;
}): Promise<{
  requestedStatuses: CaseLawRetryTerminalStatus[];
  scanned: number;
  updated: number;
  statusBreakdown: Array<{ status: string; documents: number }>;
  sample: Array<{ id: number; filename: string; previousStatus: string; previousAttempts: number }>;
}> {
  const safeStatuses = normalizeCaseLawRetryTerminalStatuses(args.statuses);
  const safeLimit = Math.max(1, Math.min(50000, Number(args.limit) || 5000));
  const statusSql = sql.join(safeStatuses.map((status) => sql`${status}`), sql`, `);

  const candidatesResult = await db.execute(sql`
    SELECT
      ak.id,
      COALESCE(NULLIF(trim(ak.filename), ''), NULLIF(trim(ak.title), ''), 'admin-knowledge-' || ak.id::text) AS filename,
      COALESCE(ak.case_law_process_status, 'pending') AS previous_status,
      COALESCE(ak.case_law_process_attempts, 0)::int AS previous_attempts
    FROM admin_knowledge ak
    LEFT JOIN case_law cl
      ON cl.source_doc_id = ak.id
      AND cl.source_type = 'admin'
    WHERE ak.category = 'case-law'
      AND COALESCE(ak.case_law_process_status, 'pending') IN (${statusSql})
    GROUP BY ak.id, ak.filename, ak.title, ak.case_law_process_status, ak.case_law_process_attempts
    HAVING count(cl.id) = 0
    ORDER BY ak.id DESC
    LIMIT ${safeLimit};
  `);

  const candidateRows = getDbRows<{
    id: number | string;
    filename: string | null;
    previous_status: string | null;
    previous_attempts: number | string;
  }>(candidatesResult)
    .map((row) => ({
      id: toCaseLawPendingDiagnosticsInt(row.id),
      filename: sanitizeInputText(String(row.filename || ""), 280),
      previousStatus: sanitizeInputText(String(row.previous_status || "pending"), 32) || "pending",
      previousAttempts: toCaseLawPendingDiagnosticsInt(row.previous_attempts),
    }))
    .filter((row) => Number.isInteger(row.id) && row.id > 0);

  if (candidateRows.length > 0) {
    const idSql = sql.join(candidateRows.map((row) => sql`${row.id}`), sql`, `);
    await db.execute(sql`
      UPDATE admin_knowledge
      SET
        case_law_process_status = 'retry',
        case_law_process_attempts = 0,
        case_law_process_last_error = NULL,
        case_law_process_last_at = NOW()
      WHERE category = 'case-law'
        AND id IN (${idSql});
    `);
  }

  const statusCounter = new Map<string, number>();
  for (const row of candidateRows) {
    statusCounter.set(row.previousStatus, (statusCounter.get(row.previousStatus) || 0) + 1);
  }

  return {
    requestedStatuses: safeStatuses,
    scanned: safeLimit,
    updated: candidateRows.length,
    statusBreakdown: Array.from(statusCounter.entries())
      .map(([status, documents]) => ({ status, documents }))
      .sort((a, b) => b.documents - a.documents || a.status.localeCompare(b.status)),
    sample: candidateRows.slice(0, 25),
  };
}

async function getCaseLawPendingDiagnostics(args?: { topErrorLimit?: number }): Promise<{
  generatedAt: string;
  staleProcessingMinutes: number;
  maxAttempts: number;
  summary: CaseLawPendingDiagnosticsSummary;
  statusCounts: CaseLawPendingDiagnosticsStatusCount[];
  topErrors: CaseLawPendingDiagnosticsTopError[];
}> {
  const staleProcessingBefore = new Date(Date.now() - CASELAW_PENDING_PROCESSING_STALE_MINUTES * 60 * 1000);
  const topErrorLimit = Math.max(1, Math.min(100, Number(args?.topErrorLimit) || 12));

  const summaryResult = await db.execute(sql`
    WITH base AS (
      SELECT
        ak.id,
        COALESCE(ak.case_law_process_status, 'pending') AS status,
        COALESCE(ak.case_law_process_attempts, 0) AS attempts,
        ak.case_law_process_last_at AS last_at,
        count(cl.id)::int AS case_rows
      FROM admin_knowledge ak
      LEFT JOIN case_law cl
        ON cl.source_doc_id = ak.id
        AND cl.source_type = 'admin'
      WHERE ak.category = 'case-law'
      GROUP BY ak.id, ak.case_law_process_status, ak.case_law_process_attempts, ak.case_law_process_last_at
    )
    SELECT
      count(*)::bigint AS total_docs,
      count(*) FILTER (WHERE case_rows > 0)::bigint AS extracted_docs,
      count(*) FILTER (WHERE case_rows = 0)::bigint AS pending_legacy,
      count(*) FILTER (
        WHERE case_rows = 0
          AND attempts < ${CASELAW_PENDING_MAX_ATTEMPTS}
          AND (
            status IN ('pending', 'retry')
            OR (
              status = 'processing'
              AND (last_at IS NULL OR last_at < ${staleProcessingBefore})
            )
          )
      )::bigint AS actionable_pending,
      count(*) FILTER (
        WHERE case_rows = 0
          AND status = 'processing'
          AND last_at IS NOT NULL
          AND last_at >= ${staleProcessingBefore}
      )::bigint AS processing_fresh,
      count(*) FILTER (
        WHERE case_rows = 0
          AND attempts >= ${CASELAW_PENDING_MAX_ATTEMPTS}
      )::bigint AS max_attempts_reached,
      count(*) FILTER (
        WHERE case_rows = 0
          AND (
            status IN ('failed', 'no_cases', 'merged')
            OR attempts >= ${CASELAW_PENDING_MAX_ATTEMPTS}
          )
      )::bigint AS terminal_no_extract
    FROM base;
  `);

  const summaryRow = getDbRows<{
    total_docs: string | number;
    extracted_docs: string | number;
    pending_legacy: string | number;
    actionable_pending: string | number;
    processing_fresh: string | number;
    max_attempts_reached: string | number;
    terminal_no_extract: string | number;
  }>(summaryResult)[0];

  const statusCountsResult = await db.execute(sql`
    WITH base AS (
      SELECT
        ak.id,
        COALESCE(ak.case_law_process_status, 'pending') AS status,
        count(cl.id)::int AS case_rows
      FROM admin_knowledge ak
      LEFT JOIN case_law cl
        ON cl.source_doc_id = ak.id
        AND cl.source_type = 'admin'
      WHERE ak.category = 'case-law'
      GROUP BY ak.id, ak.case_law_process_status
    )
    SELECT
      status,
      count(*)::bigint AS documents,
      count(*) FILTER (WHERE case_rows = 0)::bigint AS no_extract_documents,
      count(*) FILTER (WHERE case_rows > 0)::bigint AS extracted_documents
    FROM base
    GROUP BY status
    ORDER BY documents DESC, status ASC;
  `);

  const statusCounts = getDbRows<{
    status: string | null;
    documents: string | number;
    no_extract_documents: string | number;
    extracted_documents: string | number;
  }>(statusCountsResult).map((row) => ({
    status: sanitizeInputText(String(row.status || "pending"), 32) || "pending",
    documents: toCaseLawPendingDiagnosticsInt(row.documents),
    noExtractDocuments: toCaseLawPendingDiagnosticsInt(row.no_extract_documents),
    extractedDocuments: toCaseLawPendingDiagnosticsInt(row.extracted_documents),
  }));

  const topErrorsResult = await db.execute(sql`
    WITH base AS (
      SELECT
        COALESCE(ak.case_law_process_status, 'pending') AS status,
        NULLIF(trim(COALESCE(ak.case_law_process_last_error, '')), '') AS last_error,
        count(cl.id)::int AS case_rows
      FROM admin_knowledge ak
      LEFT JOIN case_law cl
        ON cl.source_doc_id = ak.id
        AND cl.source_type = 'admin'
      WHERE ak.category = 'case-law'
      GROUP BY ak.id, ak.case_law_process_status, ak.case_law_process_last_error
    )
    SELECT
      last_error AS error,
      count(*)::bigint AS documents
    FROM base
    WHERE case_rows = 0
      AND status IN ('failed', 'no_cases')
      AND last_error IS NOT NULL
    GROUP BY last_error
    ORDER BY documents DESC, last_error ASC
    LIMIT ${topErrorLimit};
  `);

  const topErrors = getDbRows<{
    error: string | null;
    documents: string | number;
  }>(topErrorsResult)
    .map((row) => ({
      error: sanitizeInputText(stripNullBytes(String(row.error || "")).trim(), 500),
      documents: toCaseLawPendingDiagnosticsInt(row.documents),
    }))
    .filter((row) => row.error.length > 0);

  return {
    generatedAt: new Date().toISOString(),
    staleProcessingMinutes: CASELAW_PENDING_PROCESSING_STALE_MINUTES,
    maxAttempts: CASELAW_PENDING_MAX_ATTEMPTS,
    summary: {
      totalDocs: toCaseLawPendingDiagnosticsInt(summaryRow?.total_docs),
      extractedDocs: toCaseLawPendingDiagnosticsInt(summaryRow?.extracted_docs),
      pendingLegacy: toCaseLawPendingDiagnosticsInt(summaryRow?.pending_legacy),
      actionablePending: toCaseLawPendingDiagnosticsInt(summaryRow?.actionable_pending),
      processingFresh: toCaseLawPendingDiagnosticsInt(summaryRow?.processing_fresh),
      maxAttemptsReached: toCaseLawPendingDiagnosticsInt(summaryRow?.max_attempts_reached),
      terminalNoExtract: toCaseLawPendingDiagnosticsInt(summaryRow?.terminal_no_extract),
    },
    statusCounts,
    topErrors,
  };
}

type PendingCaseLawExtractors = {
  parsePdfSafe: (buffer: Buffer) => Promise<string>;
  parsePdfWithOcrFallback: (file: Express.Multer.File) => Promise<string>;
  parseDocxSafe: (buffer: Buffer) => Promise<string>;
};

async function processSinglePendingCaseLawAdminDoc(
  doc: PendingCaseLawAdminDoc,
  actorUserId: string,
  extractors: PendingCaseLawExtractors,
  options?: { pauseForInteractive?: () => Promise<void> },
): Promise<{
  extractedDocuments: number;
  insertedRows: number;
  failed: number;
  skippedNoText: number;
  skippedNoCases: number;
  errors: string[];
}> {
  const out = {
    extractedDocuments: 0,
    insertedRows: 0,
    failed: 0,
    skippedNoText: 0,
    skippedNoCases: 0,
    errors: [] as string[],
  };
  const sourceFilename = sanitizeInputText(
    doc.filename || doc.title || `admin-knowledge-${doc.id}.txt`,
    240,
  ) || `admin-knowledge-${doc.id}.txt`;
  const currentAttempts = Math.max(0, Number(doc.caseLawProcessAttempts || 0));
  const nextAttempts = currentAttempts + 1;
  let content = "";

  if (currentAttempts >= CASELAW_PENDING_MAX_ATTEMPTS) {
    out.failed += 1;
    const attemptMsg = `maximum attempts reached (${CASELAW_PENDING_MAX_ATTEMPTS})`;
    try {
      await finalizeCaseLawProcessState({
        docId: doc.id,
        status: "failed",
        error: attemptMsg,
      });
    } catch {
      // best effort
    }
    pushCappedJobError(out.errors, `#${doc.id} ${sourceFilename}: ${attemptMsg}`);
    return out;
  }

  try {
    await setCaseLawProcessState({
      docId: doc.id,
      status: "processing",
      attempts: nextAttempts,
      setLastAt: true,
      error: null,
    });
  } catch {
    // best effort
  }

  try {
    const stored = await storage.getAdminKnowledgeById(doc.id);
    content = stripNullBytes(String(stored?.content || "")).trim();
  } catch {
    content = "";
  }

  if (!content && doc.extractedTextKey) {
    try {
      content = stripNullBytes(await getR2ObjectText(String(doc.extractedTextKey)) ?? "").trim();
    } catch (r2TextErr: any) {
      pushCappedJobError(
        out.errors,
        `#${doc.id} ${sourceFilename}: failed reading extracted text (${sanitizeInputText(r2TextErr?.message || "unknown", 180)})`,
      );
    }
  }

  if (!content && doc.objectKey) {
    try {
      if (options?.pauseForInteractive) await options.pauseForInteractive();
      const sourceBuffer = await getR2ObjectBinary(doc.objectKey);
      if (sourceBuffer && sourceBuffer.buffer.length > 0) {
        const ext = normalizeAttachmentExt(path.extname(sourceFilename || "").toLowerCase());
        let parseExt = ext;
        if (!parseExt) {
          const mime = String(doc.mimeType || "").toLowerCase();
          if (mime === "application/pdf") parseExt = ".pdf";
          else if (mime === "application/msword") parseExt = ".doc";
          else if ((DOCX_COMPAT_MIMES as readonly string[]).includes(mime)) parseExt = ".docx";
          else parseExt = ".txt";
        }

        const stableFile = {
          fieldname: "file",
          originalname: sourceFilename,
          encoding: "7bit",
          mimetype: String(doc.mimeType || "application/octet-stream"),
          size: Number(doc.sizeBytes || sourceBuffer.buffer.length),
          buffer: sourceBuffer.buffer,
          destination: "",
          filename: path.basename(sourceFilename),
          path: "",
        } as Express.Multer.File;

        const signatureExt = parseExt === ".md" || parseExt === ".json" || parseExt === ".csv" ? ".txt" : parseExt;
        if ([".pdf", ".doc", ".docx", ".txt"].includes(signatureExt) && !hasSafeDocumentSignature(stableFile, signatureExt)) {
          throw new Error("file signature does not match declared format");
        }

        if (parseExt === ".pdf") {
          if (options?.pauseForInteractive) await options.pauseForInteractive();
          try {
            content = await extractors.parsePdfSafe(stableFile.buffer);
          } catch {
            content = "";
          }
          if (!content) {
            if (options?.pauseForInteractive) await options.pauseForInteractive();
            content = await extractors.parsePdfWithOcrFallback(stableFile);
          }
        } else if (parseExt === ".doc" || parseExt === ".docx") {
          if (options?.pauseForInteractive) await options.pauseForInteractive();
          content = await extractors.parseDocxSafe(stableFile.buffer);
        } else {
          content = stripNullBytes(stableFile.buffer.toString("utf-8").trim());
        }
      }
    } catch (fileErr: any) {
      out.failed += 1;
      const normalizedError = sanitizeInputText(fileErr?.message || "processing failed", 220);
      try {
        await finalizeCaseLawProcessState({
          docId: doc.id,
          status: "failed",
          error: normalizedError,
        });
      } catch {
        // best effort
      }
      pushCappedJobError(
        out.errors,
        `#${doc.id} ${sourceFilename}: ${normalizedError}`,
      );
      return out;
    }
  }

  if (!content || content.length < 10) {
    out.skippedNoText += 1;
    try {
      await finalizeCaseLawProcessState({
        docId: doc.id,
        status: "failed",
        error: "extracted text empty",
      });
    } catch {
      // best effort
    }
    return out;
  }

  try {
    if (options?.pauseForInteractive) await options.pauseForInteractive();
    const extracted = nlpExtractCases(content, { sourceFilename });
    const validCases = extracted.filter((entry) => entry.citation && entry.title);
    if (validCases.length === 0) {
      out.skippedNoCases += 1;
      try {
        await finalizeCaseLawProcessState({
          docId: doc.id,
          status: "no_cases",
          error: "no valid case citations extracted",
        });
      } catch {
        // best effort
      }
      return out;
    }
    const saved = await persistExtractedCasesAndSync({
      extractedCases: validCases,
      sourceDocId: doc.id,
      sourceFilename,
      actorUserId,
    });
    out.extractedDocuments += 1;
    out.insertedRows += Number(saved.inserted || 0);
    if (saved.errors?.length) {
      for (const message of saved.errors.slice(0, 10)) {
        pushCappedJobError(out.errors, `#${doc.id} ${sourceFilename}: ${message}`);
      }
    }
    const linkedRows = await storage.getCaseLawBySourceDocuments([doc.id], "admin");
    const terminalStatus: CaseLawProcessTerminalStatus = linkedRows.length > 0
      ? "done"
      : "merged";
    await finalizeCaseLawProcessState({
      docId: doc.id,
      status: terminalStatus,
      error: saved.errors?.length ? saved.errors[0] : null,
    });
  } catch (extractErr: any) {
    out.failed += 1;
    const normalizedError = sanitizeInputText(extractErr?.message || "NLP extraction failed", 220);
    try {
      await finalizeCaseLawProcessState({
        docId: doc.id,
        status: "failed",
        error: normalizedError,
      });
    } catch {
      // best effort
    }
    pushCappedJobError(
      out.errors,
      `#${doc.id} ${sourceFilename}: ${normalizedError}`,
    );
  }

  return out;
}

async function fetchCaseLawEntriesForSync(args: {
  cursorId: number | null;
  batchSize: number;
}): Promise<Array<{
  id: number;
  citation: string;
  court: string;
  title: string;
  summary: string;
  sourceDocId?: number | null;
  sourceType?: string | null;
}>> {
  const safeBatchSize = Math.max(1, Math.min(5000, Number(args.batchSize) || 1000));
  const whereClause = Number.isInteger(Number(args.cursorId)) && Number(args.cursorId) > 0
    ? lt(caseLaw.id, Number(args.cursorId))
    : undefined;
  return db
    .select({
      id: caseLaw.id,
      citation: caseLaw.citation,
      court: caseLaw.court,
      title: caseLaw.title,
      summary: caseLaw.summary,
      sourceDocId: caseLaw.sourceDocId,
      sourceType: caseLaw.sourceType,
    })
    .from(caseLaw)
    .where(whereClause)
    .orderBy(sql`${caseLaw.id} desc`)
    .limit(safeBatchSize);
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
  let b: Buffer;
  try {
    b = getUploadBufferOrThrow(file);
  } catch {
    return false;
  }
  if (ext === ".pdf") return startsWithBytes(b, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
  if (ext === ".doc") return startsWithBytes(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // OLE2
  if (ext === ".docx") return startsWithBytes(b, [0x50, 0x4b, 0x03, 0x04]); // ZIP-based OpenXML
  if (ext === ".txt" || ext === ".md" || ext === ".json" || ext === ".csv") return appearsTextLike(b);
  return false;
}

const DOCX_COMPAT_EXTS = [".docx", ".docm", ".dotx"] as const;
const DOCX_COMPAT_MIMES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-word.document.macroenabled.12",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
] as const;

function normalizeAttachmentExt(rawExt: string): string {
  const ext = (rawExt || "").toLowerCase();
  if (ext === ".text") return ".txt";
  return ext;
}

function resolveAttachmentSignatureExt(normalizedExt: string, mime: string): ".txt" | ".pdf" | ".doc" | ".docx" | null {
  if (normalizedExt === ".txt") return ".txt";
  if (normalizedExt === ".pdf") return ".pdf";
  if (normalizedExt === ".doc") return ".doc";
  if ((DOCX_COMPAT_EXTS as readonly string[]).includes(normalizedExt)) return ".docx";
  if (mime === "application/pdf") return ".pdf";
  if (mime === "application/msword") return ".doc";
  if ((DOCX_COMPAT_MIMES as readonly string[]).includes(mime)) return ".docx";
  return null;
}

function hasSafeImageSignature(file: Express.Multer.File): boolean {
  let b: Buffer;
  try {
    b = getUploadBufferOrThrow(file);
  } catch {
    return false;
  }
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
  let scanBuffer: Buffer;
  try {
    scanBuffer = getUploadBufferOrThrow(file);
  } catch (err: any) {
    return { ok: false, reason: err?.message || "Unable to read uploaded file for malware scan." };
  }
  const scan = await scanUploadedBuffer(scanBuffer, file.originalname || "upload.bin");
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

function normalizeCourtReadyDraftingText(content: string): string {
  const PARTY_ROLE_PATTERN =
    /^(PETITIONER|PETITIONERS|RESPONDENT|RESPONDENTS|APPELLANT|APPELLANTS|DEFENDANT|DEFENDANTS|PLAINTIFF|PLAINTIFFS|COMPLAINANT|COMPLAINANTS|ACCUSED)$/i;
  const PARTY_ALIGN_COLUMN = 74;
  const rightAlignPartyLabel = (label: string): string => {
    const clean = String(label || "").trim();
    if (!clean) return "";
    if (clean.length >= PARTY_ALIGN_COLUMN - 2) return clean;
    return `${" ".repeat(PARTY_ALIGN_COLUMN - clean.length)}${clean}`;
  };
  const normalizePartyRole = (value: string): string => {
    const raw = String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
    if (!raw) return "";
    if (PARTY_ROLE_PATTERN.test(raw)) return raw;
    return "";
  };
  const enforcePartyCaptionAlignment = (text: string): string => {
    const rawLines = String(text || "").split("\n");
    const formatted: string[] = [];
    for (const rawLine of rawLines) {
      const line = rawLine.trimEnd();
      const trimmed = line.trim();
      if (!trimmed) {
        if (formatted.length > 0 && formatted[formatted.length - 1] !== "") formatted.push("");
        continue;
      }

      if (/^(v(?:s\.?)?|versus)$/i.test(trimmed)) {
        if (formatted.length > 0 && formatted[formatted.length - 1] !== "") formatted.push("");
        formatted.push("VERSUS");
        if (formatted[formatted.length - 1] !== "") formatted.push("");
        continue;
      }

      const inlineRole = trimmed.match(/^(.*?)(?:\s*)(?:\.{3,}|…)\s*([A-Za-z][A-Za-z ]+)\s*$/);
      if (inlineRole) {
        const role = normalizePartyRole(inlineRole[2] || "");
        if (role) {
          const partyLine = String(inlineRole[1] || "").trim();
          if (partyLine) formatted.push(partyLine);
          formatted.push(rightAlignPartyLabel(`... ${role}`));
          continue;
        }
      }

      const roleOnly = trimmed.match(/^(?:\.{3,}\s*)?([A-Za-z][A-Za-z ]+)\s*$/);
      if (roleOnly) {
        const role = normalizePartyRole(roleOnly[1] || "");
        if (role) {
          formatted.push(rightAlignPartyLabel(`... ${role}`));
          continue;
        }
      }

      formatted.push(line);
    }
    return formatted.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  };

  const base = normalizeDraftingText(content)
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\u2026/g, "...");
  const lines = base.split("\n").map((line) => {
    let out = line.trimEnd();
    if (/^\s*([-*_]\s*){3,}$/.test(out)) return "";
    out = out.replace(/\t+/g, " ");
    out = out.replace(/^\s{0,3}#{1,6}\s+/, "");
    out = out.replace(/^\s*>\s?/, "");
    out = out.replace(/^\s*[-*+•●▪]\s+/, "");
    out = out.replace(/\*\*([^*]+)\*\*/g, "$1");
    out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1$2");
    out = out.replace(/`([^`]+)`/g, "$1");
    out = out.replace(/\s+,/g, ",");
    out = out.replace(/ {2,}/g, " ");
    const trimmed = out.trim();
    const highCourtWithCity = trimmed.match(/^IN\s+THE\s+HONOURABLE\s+HIGH\s+COURT(?:\s+AT|,)?\s*([A-Z][A-Z .-]*)$/i);
    if (highCourtWithCity && highCourtWithCity[1]) {
      const city = highCourtWithCity[1].replace(/\s+/g, " ").trim().toUpperCase();
      return `IN THE HONOURABLE HIGH COURT, ${city}`;
    }
    if (/^respectfully\s+(submitted|sheweth)\s*:?\s*$/i.test(trimmed)) return "RESPECTFULLY SHEWETH:";
    if (/^brief\s+facts\s*:?\s*$/i.test(trimmed)) return "BRIEF FACTS";
    if (/^grounds(\s+of\s+(appeal|application))?\s*:?\s*$/i.test(trimmed)) return "GROUNDS";
    if (/^legal\s+authorities\s*:?\s*$/i.test(trimmed)) return "GROUNDS";
    if (/^valuation\s+and\s+court\s+fee\s*:?\s*$/i.test(trimmed)) return "VALUATION AND COURT FEE";
    if (/^prayer\s*:?\s*$/i.test(trimmed)) return "PRAYER";
    if (/^interim\s+relief\s*:?\s*$/i.test(trimmed)) return "INTERIM RELIEF";
    if (/^verification\s*:?\s*$/i.test(trimmed)) return "VERIFICATION";
    if (/^annexures?\s*:?\s*$/i.test(trimmed)) return "ANNEXURES";
    return out;
  });

  const normalized = lines
    .join("\n")
    .replace(/\n\s*versus\s*\n/gi, "\nVERSUS\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const sectionHeadings = new Set([
    "RESPECTFULLY SHEWETH:",
    "BRIEF FACTS",
    "GROUNDS",
    "VALUATION AND COURT FEE",
    "PRAYER",
    "INTERIM RELIEF",
    "VERIFICATION",
    "ANNEXURES",
  ]);
  const thatTheRequiredSections = new Set(["BRIEF FACTS", "GROUNDS"]);

  const ensureThatTheLine = (line: string): string => {
    const raw = line.trim();
    if (!raw) return line;

    const markerMatch = raw.match(/^((?:\(?\d+\)?|[A-Za-z]|[ivxlcdmIVXLCDM]+)[.)])\s*(.*)$/);
    const marker = markerMatch ? markerMatch[1] : "";
    let body = markerMatch ? markerMatch[2].trim() : raw;

    const plainBody = body.replace(/\s{2,}/g, " ").trim();
    const headingLike =
      (!!plainBody &&
        (
          /:\s*$/.test(plainBody) ||
          /^[A-Z][A-Z0-9\s/&()'.-]{3,}$/.test(plainBody) ||
          /^(MAINTAINABILITY|GROUNDS OF|QUESTIONS OF LAW|JURISDICTION|ARGUMENTS?|RELIEF SOUGHT|FACTS|BACKGROUND)\b/i.test(plainBody)
        ) &&
        !/[.!?]\s*$/.test(plainBody)
      );
    if (headingLike) {
      return marker ? `${marker} ${plainBody}` : plainBody;
    }

    if (!body) body = "[______].";
    body = body.replace(/^[,;:.-]+\s*/, "").trim();
    if (!body) body = "[______].";

    if (/^that\s+the\b/i.test(body)) {
      body = `That the ${body.replace(/^that\s+the\s*/i, "").trim()}`;
    } else {
      body = body.replace(/^that\s+/i, "");
      body = body.replace(/^the\s+/i, "");
      body = `That the ${body.trim()}`;
    }

    body = body.replace(/\s{2,}/g, " ").trim();
    return marker ? `${marker} ${body}` : body;
  };

  const rawLines = normalized.split("\n");
  const out: string[] = [];
  let currentSection = "";
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trimEnd();
    if (!line.trim()) {
      if (out.length > 0 && out[out.length - 1] !== "") out.push("");
      continue;
    }

    const upper = line.trim().toUpperCase();
    if (sectionHeadings.has(upper)) {
      const normalizedHeading = upper === "RESPECTFULLY SHEWETH" ? "RESPECTFULLY SHEWETH:" : upper;
      const lastNonEmpty = [...out].reverse().find((entry) => entry.trim().length > 0) || "";
      if (normalizedHeading === "GROUNDS" && lastNonEmpty.trim().toUpperCase() === "GROUNDS") {
        currentSection = "GROUNDS";
        continue;
      }
      if (out.length > 0 && out[out.length - 1] !== "") out.push("");
      out.push(normalizedHeading);
      currentSection = normalizedHeading.replace(/:$/, "");
      if (i + 1 < rawLines.length && rawLines[i + 1].trim() !== "") out.push("");
      continue;
    }

    if (thatTheRequiredSections.has(currentSection)) {
      out.push(ensureThatTheLine(line));
    } else {
      out.push(line);
    }
  }

  const courtReady = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return enforcePartyCaptionAlignment(courtReady);
}

type LegalDraftCaseReference = {
  id: number;
  citation: string;
  court: string;
  title: string;
  summary: string;
  hasSource: boolean;
  sourceType: string | null;
  sourceFilename: string | null;
};

type LegalDraftStatuteReference = {
  statuteName: string;
  section: string;
  sectionLabel: string;
  statuteId: number | null;
  description: string | null;
  punishment: string | null;
  statuteDocId: number | null;
  statuteDocTitle: string | null;
  statuteDocFilename: string | null;
  statuteDocCategory: string | null;
  viewUrl: string | null;
};

type LegalDraftUnresolvedStatute = {
  statuteName: string;
  section: string;
  sectionLabel: string;
};

type LegalDraftReferencePayload = {
  caseLaw: LegalDraftCaseReference[];
  statutes: LegalDraftStatuteReference[];
  removedCaseCitations: string[];
  unresolvedStatutes: LegalDraftUnresolvedStatute[];
};

type DraftReferenceResolutionResult = {
  cleanedText: string;
  references: LegalDraftReferencePayload;
};

type DraftStatuteMention = {
  statuteName: string;
  section: string;
  sectionLabel: string;
};

function createEmptyLegalDraftReferencePayload(): LegalDraftReferencePayload {
  return {
    caseLaw: [],
    statutes: [],
    removedCaseCitations: [],
    unresolvedStatutes: [],
  };
}

function normalizeSpaces(value: string): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCitationForMatch(value: string): string {
  return String(value || "")
    .toUpperCase()
    .replace(/\bP\.?\s*C\.?\s*R\.?\s*L\.?\s*J\b/g, "PCRLJ")
    .replace(/\bSUPREME\s+COURT\b/g, "SC")
    .replace(/\bFEDERAL\s+SHARIAT(?:\s+COURT)?\b/g, "FSC")
    .replace(/\bLAHORE\b/g, "LAH")
    .replace(/\bKARACHI\b/g, "KAR")
    .replace(/\bPESHAWAR\b/g, "PESH")
    .replace(/\bISLAMABAD\b/g, "IHC")
    .replace(/\bSINDH\b/g, "SHC")
    .replace(/\bBALOCHISTAN\b/g, "BHC")
    .replace(/[^A-Z0-9]/g, "");
}

function extractCaseCitationCandidates(text: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const separator = String.raw`(?:\s|[-/:,.;])*`;
  const patterns = [
    // Year-first standard citations: 1989 SCMR 585 / 1989 P Cr. L J 1871 / 1989-SCMR-585
    new RegExp(`\\b(?:19|20)\\d{2}${separator}(?:${CASELAW_REPORT_FLEX_PATTERN})${separator}\\d{1,6}\\b`, "gi"),
    // Report-first citations with optional court token: PLD 2015 SC 1245
    new RegExp(
      `\\b(?:${CASELAW_REPORT_FLEX_PATTERN})${separator}(?:19|20)\\d{2}(?:${separator}(?:SC|Lah\\.?|Lahore|Kar\\.?|Karachi|Pesh\\.?|Peshawar|Islamabad|Sindh|Balochistan|FSC|Federal\\s+Shariat(?:\\s+Court)?|Supreme\\s+Court))?${separator}\\d{1,6}\\b`,
      "gi",
    ),
    // Neutral compact citations: 2014LHC5158 / 2022IHC77 / 2019PHC456
    /\b(?:19|20)\d{2}(?:LHC|IHC|SHC|PHC|BHC|AJKHC)\d{1,6}\b/gi,
    // Neutral spaced/hyphenated citations: 2014 LHC 5158 / 2014-LHC-5158
    /\b(?:19|20)\d{2}(?:\s|[-/:,.;])*(?:LHC|IHC|SHC|PHC|BHC|AJKHC)(?:\s|[-/:,.;])*\d{1,6}\b/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = normalizeSpaces(match[0] || "");
      if (!raw) continue;
      const key = normalizeCitationForMatch(raw);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      candidates.push(raw);
    }
  }

  return candidates;
}

function extractCitationVariants(value: string): string[] {
  const extracted = extractCaseCitationCandidates(value);
  if (extracted.length > 0) return extracted;
  return value
    .split(/(?:\s*&\s*|;|,)/g)
    .map((item) => normalizeSpaces(item))
    .filter((item) => item.length > 0);
}

function caseCitationMatches(candidateCitation: string, rowCitation: string): boolean {
  const normalizedCandidate = normalizeCitationForMatch(candidateCitation);
  if (!normalizedCandidate) return false;
  const candidateParts = parseCaseLawCitationQuery(candidateCitation);
  const variants = extractCitationVariants(rowCitation);
  for (const variant of variants) {
    const normalizedVariant = normalizeCitationForMatch(variant);
    if (!normalizedVariant) continue;
    const variantParts = parseCaseLawCitationQuery(variant);
    if (isTrustedCaseLawCitationParts(candidateParts) && isTrustedCaseLawCitationParts(variantParts)) {
      if (
        candidateParts.year === variantParts.year
        && candidateParts.page === variantParts.page
        && normalizeCitationToken(candidateParts.report) === normalizeCitationToken(variantParts.report)
      ) {
        return true;
      }
      continue;
    }
    if (normalizedVariant === normalizedCandidate) return true;
  }
  return false;
}

const STATUTE_ALIAS_MAP: Array<{ regex: RegExp; canonical: string }> = [
  { regex: /\bcr\.?\s*p\.?\s*c\.?\b|\bcode of criminal procedure\b|\bcrpc\b/i, canonical: "Code of Criminal Procedure, 1898" },
  { regex: /\bc\.?\s*p\.?\s*c\.?\b|\bcode of civil procedure\b/i, canonical: "Code of Civil Procedure, 1908" },
  { regex: /\bppc\b|\bpakistan penal code\b/i, canonical: "Pakistan Penal Code, 1860" },
  { regex: /\bconstitution(?: of pakistan)?\b/i, canonical: "Constitution of the Islamic Republic of Pakistan, 1973" },
  { regex: /\bqanun[-\s]?e[-\s]?shahadat(?: order)?\b/i, canonical: "Qanun-e-Shahadat Order, 1984" },
  { regex: /\bfamily courts?\s*act\b/i, canonical: "Family Courts Act, 1964" },
  { regex: /\bnegotiable instruments act\b/i, canonical: "Negotiable Instruments Act, 1881" },
  { regex: /\bspecific relief act\b/i, canonical: "Specific Relief Act, 1877" },
  { regex: /\blimitation act\b/i, canonical: "Limitation Act, 1908" },
];

function canonicalizeStatuteName(value: string): string {
  const clean = normalizeSpaces(value);
  if (!clean) return "";
  for (const alias of STATUTE_ALIAS_MAP) {
    if (alias.regex.test(clean)) return alias.canonical;
  }
  return clean.replace(/\bthe\b/gi, "").replace(/\s+/g, " ").trim();
}

function normalizeTextForMatch(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSectionForMatch(value: string): string {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function splitSectionTokens(raw: string): string[] {
  return String(raw || "")
    .split(/(?:,|&|and|\/)/gi)
    .map((part) => normalizeSpaces(part).replace(/[^A-Za-z0-9.-]/g, ""))
    .filter((part) => part.length > 0);
}

function extractStatuteMentions(text: string): DraftStatuteMention[] {
  const mentions: DraftStatuteMention[] = [];
  const seen = new Set<string>();
  const pushMention = (statuteNameRaw: string, sectionRaw: string, labelPrefix: "Section" | "Article" | "Provision") => {
    const statuteName = canonicalizeStatuteName(statuteNameRaw);
    if (!statuteName) return;
    const tokens = splitSectionTokens(sectionRaw);
    if (tokens.length === 0) return;
    for (const token of tokens) {
      const sectionLabel = labelPrefix === "Provision" ? token : `${labelPrefix} ${token}`;
      const key = `${normalizeTextForMatch(statuteName)}::${normalizeSectionForMatch(sectionLabel)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      mentions.push({
        statuteName,
        section: token,
        sectionLabel,
      });
    }
  };

  const explicitPattern =
    /\b(section|sec\.?|s\.|article|art\.?)\s*([0-9A-Za-z-]+(?:\s*(?:,|and|&|\/)\s*[0-9A-Za-z-]+)*)\s+of\s+(?:the\s+)?([A-Z][A-Za-z0-9(),.'\-\/\s]{3,140}?)(?=[\n,.;:]|$)/gi;
  for (const match of text.matchAll(explicitPattern)) {
    const head = (match[1] || "").toLowerCase();
    const prefix: "Section" | "Article" = head.startsWith("art") ? "Article" : "Section";
    pushMention(match[3] || "", match[2] || "", prefix);
  }

  const shorthandPattern =
    /\b(section|sec\.?|s\.|article|art\.?)\s*([0-9A-Za-z-]+(?:\s*(?:,|and|&|\/)\s*[0-9A-Za-z-]+)*)\s*(?:of\s+)?(Cr\.?\s*P\.?\s*C\.?|C\.?\s*P\.?\s*C\.?|P\.?\s*P\.?\s*C\.?|Constitution(?:\s+of\s+Pakistan)?|Qanun[-\s]?e[-\s]?Shahadat(?:\s+Order)?|Family Courts?\s*Act|Specific Relief Act|Limitation Act|Negotiable Instruments Act)\b/gi;
  for (const match of text.matchAll(shorthandPattern)) {
    const head = (match[1] || "").toLowerCase();
    const prefix: "Section" | "Article" = head.startsWith("art") ? "Article" : "Section";
    pushMention(match[3] || "", match[2] || "", prefix);
  }

  const cpcOrderPattern =
    /\b(Order\s+[IVXLCDM0-9]+(?:\s+Rules?\s+[0-9A-Za-z,&\s-]+)?)\s*(?:of\s+)?(C\.?\s*P\.?\s*C\.?|Code of Civil Procedure)\b/gi;
  for (const match of text.matchAll(cpcOrderPattern)) {
    const statuteName = canonicalizeStatuteName(match[2] || "");
    const sectionLabel = normalizeSpaces(match[1] || "");
    if (!statuteName || !sectionLabel) continue;
    const key = `${normalizeTextForMatch(statuteName)}::${normalizeSectionForMatch(sectionLabel)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    mentions.push({
      statuteName,
      section: sectionLabel,
      sectionLabel,
    });
  }

  return mentions;
}

function chooseBestStatuteDocument(
  docs: Array<{ id: number; title: string; filename: string; category: string; content: string }>,
  statuteName: string,
  sectionLabel: string,
): { id: number; title: string; filename: string; category: string; content: string } | null {
  const statuteNameNorm = normalizeTextForMatch(statuteName);
  const sectionNorm = normalizeSectionForMatch(sectionLabel);
  const statuteNameTokens = statuteNameNorm.split(" ").filter((token) => token.length > 2);
  let best: { id: number; title: string; filename: string; category: string; content: string } | null = null;
  let bestScore = -1;
  for (const doc of docs) {
    const titleNorm = normalizeTextForMatch(doc.title);
    const fileNorm = normalizeTextForMatch(doc.filename);
    const contentNorm = normalizeSectionForMatch(doc.content.slice(0, 30000));
    let score = 0;
    if (titleNorm.includes(statuteNameNorm) || statuteNameNorm.includes(titleNorm)) score += 7;
    for (const token of statuteNameTokens) {
      if (titleNorm.includes(token)) score += 1;
      if (fileNorm.includes(token)) score += 0.5;
    }
    if (sectionNorm && contentNorm.includes(sectionNorm)) score += 4;
    if (score > bestScore) {
      bestScore = score;
      best = doc;
    }
  }
  return bestScore > 0 ? best : null;
}

async function resolveCaseCitationFromKnowledgeBase(candidate: string): Promise<LegalDraftCaseReference | null> {
  const normalizedCandidate = normalizeCitationForMatch(candidate);
  if (!normalizedCandidate) return null;

  const poolRows: CaseLaw[] = [];
  const seen = new Set<number>();
  const direct = await storage.getCaseLawByCitation(candidate).catch(() => undefined);
  if (direct?.id && !seen.has(direct.id)) {
    seen.add(direct.id);
    poolRows.push(direct);
  }
  const searchHits = await storage.searchCaseLaw(candidate, 25).catch(() => []);
  for (const hit of searchHits) {
    if (!seen.has(hit.id)) {
      seen.add(hit.id);
      poolRows.push(hit);
    }
  }

  for (const row of poolRows) {
    if (!caseCitationMatches(candidate, row.citation)) continue;
    const hasSource = !!(row.sourceDocId && row.sourceType);
    if (!hasSource) continue;
    return {
      id: row.id,
      citation: normalizeSpaces(row.citation),
      court: row.court,
      title: row.title,
      summary: row.summary,
      hasSource: true,
      sourceType: row.sourceType || null,
      sourceFilename: row.sourceFilename || null,
    };
  }

  return null;
}

async function resolveCaseCitationFromInternalDb(
  candidate: string,
  options?: {
    requirePrimary?: boolean;
    requireLinkedSource?: boolean;
  },
): Promise<CaseLaw | null> {
  const normalizedCandidate = normalizeCitationForMatch(candidate);
  if (!normalizedCandidate) return null;
  const candidateParts = parseCaseLawCitationQuery(candidate);
  const hasTrustedCandidateParts = isTrustedCaseLawCitationParts(candidateParts);
  const requirePrimary = options?.requirePrimary === true;
  const requireLinkedSource = options?.requireLinkedSource === true;
  const cacheKey = `${normalizedCandidate}|p:${requirePrimary ? 1 : 0}|l:${requireLinkedSource ? 1 : 0}`;
  const cached = getTimedCacheValue(caseCitationResolveCache, cacheKey);
  if (cached !== undefined) return cached;

  const rows: CaseLaw[] = [];
  const seen = new Set<number>();

  // Run all lookups in parallel: case_law exact, case_law keyword, judgments ILIKE, judgments keyword.
  // This ensures citations from the 204k judgments table are always found quickly.
  const [direct, caseLawHits, judgmentCitationHits, judgmentKeywordHits] = await Promise.all([
    storage.getCaseLawByCitation(candidate).catch(() => undefined),
    storage.searchCaseLaw(candidate, 25).catch(() => [] as CaseLaw[]),
    storage.findJudgmentByCitationString(candidate, 10).catch(() => [] as CaseLaw[]),
    storage.searchJudgmentsByKeywords(candidate, 10).catch(() => [] as CaseLaw[]),
  ]);

  // Merge: judgments citation ILIKE first (highest precision), then case_law, then keyword
  for (const row of [
    ...(direct ? [direct] : []),
    ...judgmentCitationHits,
    ...caseLawHits,
    ...judgmentKeywordHits,
  ]) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      rows.push(row);
    }
  }

  let best: CaseLaw | null = null;
  let bestScore = -1;
  for (const row of rows) {
    if (!isCaseLawRowCitationTrusted(row)) continue;
    if (requirePrimary && String(row.citationRole || "").toLowerCase() !== "primary") continue;
    // Judgment-table rows are verified by DB structure — they don't have sourceDocId.
    // Skip the linkedSource check for them so strict mode doesn't strip valid citations.
    const isJudgmentTableRow = String(row.sourceType || "") === "judgment";
    if (requireLinkedSource && !isJudgmentTableRow && !hasLinkedPrimaryCaseLawSource(row)) continue;
    const rowParts = getTrustedCaseLawCitationPartsFromRow(row);
    if (hasTrustedCandidateParts) {
      if (!rowParts) continue;
      if (
        normalizeCitationToken(rowParts.report) !== normalizeCitationToken(candidateParts!.report)
        || Number(rowParts.year) !== Number(candidateParts!.year)
        || Number(rowParts.page) !== Number(candidateParts!.page)
      ) {
        continue;
      }
    }
    if (!caseCitationMatches(candidate, row.citation)) continue;
    let score = 0;
    const normalizedRowCitation = normalizeCitationForMatch(String(row.citation || ""));
    if (normalizedRowCitation === normalizedCandidate) score += 6;
    if (rowParts && hasTrustedCandidateParts) score += 12;
    if (String(row.citationRole || "").toLowerCase() === "primary") score += 2;
    if (row.sourceDocId && row.sourceType) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }

  setTimedCacheValue(caseCitationResolveCache, cacheKey, best, CASE_CITATION_RESOLVE_CACHE_TTL_MS, 2000);
  return best;
}

async function enforceInternalCaseCitationIntegrity(
  content: string,
  options?: {
    placeholder?: string;
    normalizeVerified?: boolean;
    requirePrimary?: boolean;
    requireLinkedSource?: boolean;
    policy?: CitationPolicy;
    /**
     * Pool of citations already verified upstream (e.g. via tool-search direct
     * DB hits). Citations matching any entry in this set bypass the DB
     * resolver — they're real by construction, and going through the strict
     * resolver risks false-negatives on tiny formatting variants ("2024 SCMR
     * 1234" vs "SCMR 2024 1234"), which would silently strip valid citations
     * in strict mode.
     */
    trustedCitations?: Iterable<string>;
  },
): Promise<{ content: string; removed: string[]; verified: string[] }> {
  const rawInput = String(content || "");
  if (!rawInput.trim()) {
    return { content: "", removed: [], verified: [] };
  }

  // Protect the ```references JSON block from regex-based citation scrubbing.
  // The strict-mode line-deletion regexes (lines ~5215-5217) are designed for
  // human prose; if they fire on the JSON line they corrupt it (e.g. turning
  // `"judgments":[{...}]` into `"judgments":}`). Strip the block, scrub the
  // prose only, then re-append the block verbatim.
  const REFS_RE = /```references\s*[\s\S]*?```/i;
  const refsMatch = rawInput.match(REFS_RE);
  const refsBlock = refsMatch ? refsMatch[0] : "";
  const text = refsBlock ? rawInput.replace(REFS_RE, "").trimEnd() : rawInput;

  // Helper to re-attach the protected refs block on every early return path.
  const withRefs = (body: string): string =>
    refsBlock ? `${body.trimEnd()}\n\n${refsBlock}` : body;

  const candidates = extractCaseCitationCandidates(text);
  if (candidates.length === 0) {
    return { content: withRefs(text), removed: [], verified: [] };
  }

  const policy = options?.policy || DEFAULT_CITATION_POLICY;

  // Non-strict mode: skip all DB lookups, normalization, and removal entirely.
  // Citations came from the knowledge context already injected into the prompt;
  // post-processing them serves no purpose and risks unwanted format changes.
  if (!policy.strict) {
    return { content: withRefs(text), removed: [], verified: [] };
  }

  const placeholder = normalizeSpaces(String(options?.placeholder ?? ""));
  const normalizeVerified = options?.normalizeVerified !== false;
  const requirePrimary = options?.requirePrimary !== undefined ? options.requirePrimary : policy.strict;
  const requireLinkedSource = options?.requireLinkedSource !== undefined ? options.requireLinkedSource : policy.strict;
  const resolvedByKey = new Map<string, CaseLaw | null>();
  const removed = new Set<string>();
  const verifiedByKey = new Map<string, string>();
  const representativeByKey = new Map<string, string>();
  for (const candidate of candidates) {
    const key = normalizeCitationForMatch(candidate);
    if (!key) continue;
    if (!representativeByKey.has(key)) {
      representativeByKey.set(key, candidate);
    }
  }

  // Build a normalized lookup for the upstream-trusted pool (tool-search hits).
  const trustedKeys = new Set<string>();
  if (options?.trustedCitations) {
    for (const c of options.trustedCitations) {
      const k = normalizeCitationForMatch(String(c || ""));
      if (k) trustedKeys.add(k);
    }
  }

  // When the trusted pool is non-empty (tool-search returned hits), it
  // represents the canonical set of allowed citations for this query. Any
  // citation the model writes that is NOT in the pool — even if it happens
  // to exist somewhere in the 200k judgments table — is rejected. This is
  // intentional: the pool is the precision-filtered DB result for this exact
  // query, so off-pool citations are either (a) the model "remembering"
  // unrelated cases or (b) hallucinations whose formatting happens to match a
  // real row. Both should be stripped to keep every reference card clickable
  // and on-topic.
  const poolMode = trustedKeys.size > 0 && policy.strict;

  await Promise.all(
    Array.from(representativeByKey.entries()).map(async ([key, candidate]) => {
      // Trusted-pool fast path: citation came from a verified DB hit upstream.
      // Skip the strict resolver — it would false-negative on formatting
      // variants and erase a real citation.
      if (trustedKeys.has(key)) {
        verifiedByKey.set(key, normalizeSpaces(candidate));
        resolvedByKey.set(key, null);
        return;
      }
      // Pool mode: reject any citation not in the pool without a DB call.
      if (poolMode) {
        removed.add(normalizeSpaces(candidate));
        return;
      }
      const resolved = await resolveCaseCitationFromInternalDb(candidate, {
        requirePrimary,
        requireLinkedSource,
      });
      resolvedByKey.set(key, resolved);
      if (resolved) {
        verifiedByKey.set(key, normalizeSpaces(resolved.citation));
      } else {
        removed.add(normalizeSpaces(candidate));
      }
    }),
  );

  let cleaned = text;

  // In non-strict mode: NEVER remove unresolved citations.
  // The AI received these citations from the knowledge context injected into the prompt.
  // Removing them on a DB-lookup miss degrades response quality and hides valid case law.
  // Only strict mode (e.g. drafting modules) should strip unverified citations.
  if (removed.size > 0 && policy.strict) {
    const longestFirst = Array.from(removed).filter(Boolean).sort((a, b) => b.length - a.length);
    for (const raw of longestFirst) {
      const escapedCitation = escapeRegExp(raw);

      // Pattern matches both raw "PLD 2020 SC 456" and markdown-wrapped "**[PLD 2020 SC 456]**"
      const mdWrapped = `(?:\\*{1,3}\\[)?${escapedCitation}(?:\\]\\*{1,3})?`;

      if (policy.allowProseModification) {
        // Remove entire line/sentence containing the invalid citation (anchored: line starts with it)
        cleaned = cleaned.replace(new RegExp(`^[\\s]*${mdWrapped}[\\s\\S]*?(?=\\n|$)`, "gim"), "");
        // Remove from citation to end of logical sentence (non-anchored)
        cleaned = cleaned.replace(new RegExp(`${mdWrapped}\\s*(?:—|–|-)?\\s*[^\\n]*`, "gi"), "");
      }

      // Replace any remaining citation token (with or without markdown wrapper) with placeholder
      cleaned = cleaned.replace(new RegExp(mdWrapped, "gi"), placeholder || "");

      // Clean up leftover tabs and extra whitespace
      cleaned = cleaned.replace(/\n\s*\n\s*\n/g, "\n\n");
      cleaned = cleaned.replace(/^\s*[\t\s]+$/gm, "");
    }
  }

  if (normalizeVerified && verifiedByKey.size > 0) {
    const seenRaw = new Set<string>();
    const orderedCandidates = candidates
      .map((raw) => normalizeSpaces(raw))
      .filter((raw) => {
        if (!raw || seenRaw.has(raw.toLowerCase())) return false;
        seenRaw.add(raw.toLowerCase());
        return true;
      })
      .sort((a, b) => b.length - a.length);
    for (const raw of orderedCandidates) {
      const key = normalizeCitationForMatch(raw);
      const canonical = key ? verifiedByKey.get(key) : undefined;
      if (!canonical) continue;
      if (normalizeCitationForMatch(raw) === normalizeCitationForMatch(canonical)) continue;
      cleaned = cleaned.replace(new RegExp(escapeRegExp(raw), "gi"), canonical);
    }
  }

  // Re-append the protected references block exactly as received.
  let finalContent = stripCitationPlaceholderArtifacts(cleaned);
  if (refsBlock) {
    finalContent = `${finalContent.trimEnd()}\n\n${refsBlock}`;
  }

  return {
    content: finalContent,
    removed: Array.from(removed),
    verified: Array.from(new Set(Array.from(verifiedByKey.values()))),
  };
}

async function resolveStatuteMentionFromLibrary(mention: DraftStatuteMention): Promise<{
  resolved: LegalDraftStatuteReference | null;
  unresolved: LegalDraftUnresolvedStatute | null;
}> {
  const statuteRows = await storage.searchStatutes(`${mention.statuteName} ${mention.section}`, 30).catch(() => []);
  const statuteNameNorm = normalizeTextForMatch(mention.statuteName);
  const sectionNorm = normalizeSectionForMatch(mention.section);
  let bestRow: (typeof statuteRows)[number] | null = null;
  let bestRowScore = -1;

  for (const row of statuteRows) {
    const rowNameNorm = normalizeTextForMatch(row.shortTitle);
    const rowSectionNorm = normalizeSectionForMatch(row.section);
    let score = 0;
    if (rowNameNorm.includes(statuteNameNorm) || statuteNameNorm.includes(rowNameNorm)) score += 6;
    if (sectionNorm && rowSectionNorm === sectionNorm) score += 7;
    else if (sectionNorm && (rowSectionNorm.includes(sectionNorm) || sectionNorm.includes(rowSectionNorm))) score += 4;
    if (score > bestRowScore) {
      bestRowScore = score;
      bestRow = row;
    }
  }

  const preferredStatuteName = bestRow?.shortTitle || mention.statuteName;
  let statuteDocs = await storage.searchStatuteDocuments(preferredStatuteName, 20).catch(() => []);
  if (statuteDocs.length === 0 && preferredStatuteName !== mention.statuteName) {
    statuteDocs = await storage.searchStatuteDocuments(mention.statuteName, 20).catch(() => []);
  }

  const bestDoc = chooseBestStatuteDocument(statuteDocs, preferredStatuteName, mention.sectionLabel);
  if (!bestDoc) {
    return {
      resolved: null,
      unresolved: {
        statuteName: preferredStatuteName,
        section: mention.section,
        sectionLabel: mention.sectionLabel,
      },
    };
  }

  return {
    resolved: {
      statuteName: preferredStatuteName,
      section: mention.section,
      sectionLabel: mention.sectionLabel,
      statuteId: bestRow?.id || null,
      description: bestRow?.description || null,
      punishment: bestRow?.punishment || null,
      statuteDocId: bestDoc.id,
      statuteDocTitle: bestDoc.title,
      statuteDocFilename: bestDoc.filename,
      statuteDocCategory: bestDoc.category,
      viewUrl: `/statute-view/${bestDoc.id}?section=${encodeURIComponent(mention.sectionLabel)}`,
    },
    unresolved: null,
  };
}

async function resolveLegalDraftReferences(
  text: string,
  options?: {
    stripUnverifiedCaseCitations?: boolean;
    unresolvedCaseCitationPlaceholder?: string;
  },
): Promise<DraftReferenceResolutionResult> {
  const payload = createEmptyLegalDraftReferencePayload();
  const stripUnverifiedCaseCitations = options?.stripUnverifiedCaseCitations === true;
  const unresolvedCaseCitationPlaceholder = normalizeSpaces(
    String(options?.unresolvedCaseCitationPlaceholder ?? ""),
  );
  let cleanedText = String(text || "");
  if (!cleanedText.trim()) return { cleanedText: "", references: payload };

  const caseCandidates = extractCaseCitationCandidates(cleanedText);
  const verifiedCaseRefs: LegalDraftCaseReference[] = [];
  const seenCaseIds = new Set<number>();
  const unresolvedCaseCitations: string[] = [];
  for (const citation of caseCandidates) {
    const resolved = await resolveCaseCitationFromKnowledgeBase(citation);
    if (resolved) {
      if (!seenCaseIds.has(resolved.id)) {
        seenCaseIds.add(resolved.id);
        verifiedCaseRefs.push(resolved);
      }
      continue;
    }
    unresolvedCaseCitations.push(citation);
  }

  if (stripUnverifiedCaseCitations && unresolvedCaseCitations.length > 0) {
    const uniqueByLength = Array.from(new Set(unresolvedCaseCitations.map((item) => normalizeSpaces(item))))
      .filter((item) => item.length > 0)
      .sort((a, b) => b.length - a.length);
    for (const raw of uniqueByLength) {
      const pattern = new RegExp(escapeRegExp(raw), "gi");
      cleanedText = cleanedText.replace(pattern, unresolvedCaseCitationPlaceholder || "");
    }
  }

  payload.caseLaw = verifiedCaseRefs;
  payload.removedCaseCitations = Array.from(new Set(unresolvedCaseCitations.map((item) => normalizeSpaces(item)).filter(Boolean)));

  const mentions = extractStatuteMentions(cleanedText);
  const statuteResults = await Promise.all(mentions.map((mention) => resolveStatuteMentionFromLibrary(mention)));
  const statuteRefs: LegalDraftStatuteReference[] = [];
  const unresolvedStatutes: LegalDraftUnresolvedStatute[] = [];
  const seenStatuteKeys = new Set<string>();
  for (const result of statuteResults) {
    if (result.resolved) {
      const key = `${normalizeTextForMatch(result.resolved.statuteName)}::${normalizeSectionForMatch(result.resolved.sectionLabel)}`;
      if (!seenStatuteKeys.has(key)) {
        seenStatuteKeys.add(key);
        statuteRefs.push(result.resolved);
      }
      continue;
    }
    if (result.unresolved) {
      const unresolvedKey = `${normalizeTextForMatch(result.unresolved.statuteName)}::${normalizeSectionForMatch(result.unresolved.sectionLabel)}`;
      if (!seenStatuteKeys.has(unresolvedKey)) {
        seenStatuteKeys.add(unresolvedKey);
        unresolvedStatutes.push(result.unresolved);
      }
    }
  }
  payload.statutes = statuteRefs;
  payload.unresolvedStatutes = unresolvedStatutes;

  return {
    cleanedText: normalizeCourtReadyDraftingText(stripCitationPlaceholderArtifacts(cleanedText)),
    references: payload,
  };
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

const userRateCleanupTimer = setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  const staleKeys: string[] = [];
  for (const [key, bucket] of userRateBuckets.entries()) {
    if (bucket.lastRefillMs < cutoff) staleKeys.push(key);
  }
  for (const key of staleKeys) userRateBuckets.delete(key);
}, 60_000);
userRateCleanupTimer.unref?.();

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

CONVERSATIONAL CLIENT MODE (MANDATORY):
- Respond like a real human Pakistani advocate speaking directly to the client.
- Use first-person voice naturally (e.g., "I", "let's", "here is the move").
- Start with a short natural opener before legal analysis.
- Keep the tone confident, practical, and warm without becoming casual or slang-heavy.
- Include tagline and motto naturally in the opening portion of legal responses (not as robotic standalone labels).

MANDATORY RESPONSE STRUCTURE (FOR LEGAL QUERIES):
Use markdown sections (### headings) for legal analysis, legal advice, legal drafting, case strategy, statute interpretation, and citation-backed answers.

If the user message is only greeting/small talk/no legal request (e.g., "hi", "hello", "how are you"), do NOT use legal headings; reply conversationally in 3-6 lines and ask one clarifying legal question.

At the start of legal responses, include one short opening line that naturally reflects:
- Tagline: "Knowledge of Law is Power — and I'm Your Power Source."
- Motto: "Main hoon Al Wakeelo — not just your lawyer, your strategy partner in justice."

### Legal Context
Brief overview of the legal issue. Identify the area of law, applicable jurisdiction, and key legal questions involved.

### Statutory Framework and Legal Provisions
Cite specific sections of relevant Pakistani statutes with their full names in bold. Format each statute reference as:
**[Statute Name, Year]** — Section X: Brief description of what the section provides.
Examples: **[Pakistan Penal Code, 1860]**, **[Code of Civil Procedure, 1908]**, **[Income Tax Ordinance, 2001]**

### Leading Case Law and Judicial Precedents

RETRIEVAL SYSTEM: The database uses semantic topic matching via the Judgment Search database. Citations injected into the "VERIFIED JUDGMENTS FROM INTERNAL DATABASE" section are ALREADY filtered for relevance to your query. They are the correct cases for this specific legal topic.

MANDATORY JUDGMENT SEARCH INTEGRATION:
Your role is not just to cite cases, but to empower users to conduct independent case law research.
See the mandatory rules below (RULE J1-J5) in the CASE LAW RETRIEVAL section.
EVERY response involving cases, judgments, or judicial precedent MUST reference Judgment Search at /judgment-search.

━━━ CITATION INTEGRITY — NON-NEGOTIABLE ━━━

RULE 1 — ONLY DATABASE CITATIONS:
You may ONLY cite judgments that appear verbatim in the "VERIFIED JUDGMENTS FROM INTERNAL DATABASE" section below.
NEVER cite a case from your training memory. NEVER invent a citation. NEVER guess a citation.
YOUR TRAINING DATA IS NOT A SOURCE. Even if you strongly believe a judgment exists, if it is not in the section below, it does not exist for this response.

RULE 2 — NO CASE FOR A SUB-TOPIC = SKIP THE CITATION:
If the database has no case covering a specific point (e.g., dying declaration fitness, interested witness), do NOT invent one.
Write the legal analysis WITHOUT a citation, or write: "Our database does not currently have a specific judgment on this point — search /judgment-search with '[relevant keyword]' to find one."
NEVER fill a citation gap with a case you recall from training.

RULE 3 — EMPTY DATABASE = NO CASES:
If the "VERIFIED JUDGMENTS" section is absent or empty, write exactly:
"No relevant judgments are currently available in the internal database for this query."
Then move on. DO NOT add any case citation after this sentence.

RULE 4 — NO SYNTHESIZED OR ILLUSTRATIVE JUDGMENTS:
NEVER create a "synthesized illustration", "hypothetical case", or "example judgment".
NEVER write phrases like "for example, in PLD 20XX..." unless that exact citation is in the database.
NEVER say "a judgment such as PLD..." — if you do not have it verified, do not mention it.

RULE 5 — NO APOLOGIES FOR FABRICATION:
If you follow these rules, you will never need to apologize for a fake citation.
NEVER write: "I apologize, that judgment was not real" or "that was a synthesized illustration".
These phrases mean you already broke Rule 1. Prevent the fabrication — do not apologize after.

RULE 6 — FRONTEND VERIFICATION:
Every citation is verified against the database by the frontend. A fabricated citation:
- Produces a broken reference card visible to the user
- Destroys professional credibility of the platform
- Is always worse than saying "no cases found"

CITATION FORMAT (mandatory):
**[EXACT CITATION STRING FROM DATABASE]** — What the court held and why it applies here.
Example: **[PLD 2020 Supreme Court 456]** — The court held that intent is essential for conviction under Section 302 PPC.

EXACT STRING RULES:
- Copy the CITATION verbatim from the "VERIFIED JUDGMENTS" section — do not abbreviate, retype, or paraphrase
- DO NOT write [I], [II], [III], [A], [B], (1), (2), (3) — these are forbidden placeholder notations
- DO NOT invent citation variations or recall citations from training data
- If a record has an empty citation field: skip it entirely

### Practical Legal Strategy and Case Preparation
Provide actionable litigation strategy including:
- **Cause of Action**: What legal basis supports the claim
- **Evidence Requirements**: What documents/witnesses are needed
- **Procedural Pathway**: Step-by-step process (numbered list)
- **Limitation Period**: Applicable time limits for filing
- **Estimated Timeline**: Realistic timeframe expectations

For simple questions, you may omit sections that are not applicable, but always include at least Legal Context and one other section.

STRUCTURED REFERENCES (MANDATORY - DO NOT SKIP):
At the VERY END of every legal response, you MUST include a structured references block in the following exact format (even if empty). This block is parsed by the system to create clickable reference cards that users rely on.

CRITICAL BIDIRECTIONAL CONSISTENCY:
1. Every statute/section/judgment mentioned in your response text MUST appear in the references block.
2. Every statute/section/judgment in the references block MUST be cited and explained in the response text.
3. NO ORPHANED CITATIONS: If you list a statute in the block but don't use it in the explanation, DELETE it from the block.
4. NO ORPHANED EXPLANATIONS: If you mention a law in the text, you MUST include it in the block so users can click it.
5. NEVER STRIP CITATIONS: If you explain a case law holding (e.g., "the court held that..."), you MUST include the citation **[CITATION]** in the same paragraph. Do NOT explain case facts/holdings without their citation reference.
If you mention "Section 424 PPC" in the text, it MUST appear in the references block with its description.
If you add something to the references block, explain its relevance in the response text.

FORMAT (exactly as shown - do not modify):
\`\`\`references
{"laws":[{"name":"Full Statute Name, Year","section":"Section X","description":"One-sentence description of what this law/section provides"}],"judgments":[{"citation":"PLD 2024 Supreme Court 123","court":"Supreme Court of Pakistan","description":"One-sentence summary of the legal principle established"}]}
\`\`\`

INSTRUCTIONS:
1. Extract EVERY statute/law cited in your response — no exceptions
2. Extract EVERY judgment/case cited in your response — no exceptions
3. Include full formal names (e.g., "Pakistan Penal Code, 1860" not "PPC")
4. Include exact section numbers cited
5. Use proper court names (e.g., "Supreme Court of Pakistan", "Lahore High Court")
6. Use official citation format (PLD YYYY Court X, SCMR, YLR, etc.)
7. IF NO CITATIONS/STATUTES MENTIONED: Use empty arrays: {"laws":[],"judgments":[]}
8. DO NOT put this block inside any other code block or markdown section
9. This must be the VERY LAST element in your response
10. DO NOT add a law/judgment to the references block unless you explain its relevance in the response text
11. DO NOT mention a law/judgment in the text without adding it to the references block

EXAMPLES OF CORRECT FORMAT:
- Citation mentioned: "Section 424 PPC deals with forgery" → Must include in references block + use in text explanation
- Case cited: "In PLD 2020 Supreme Court 456..." → Must include in references block + explain its relevance
- Statute named: "Under the Income Tax Ordinance, 2001..." → Must include in references block + connect to your analysis

ANTI-PATTERNS (NEVER DO THIS):
- WRONG: Mention "Section 424 PPC" in text but omit it from references block → citation becomes invisible/unclickable
- WRONG: Add "PPC Section 424" to references block but don't explain it in the text → orphaned, confusing citation
- WRONG: Use abbreviated "PPC" in text but put full name "Pakistan Penal Code, 1860" in block without matching → might not be recognized
- WRONG: Use bracket notation [I], [II], [III], [A], [B] or any placeholder numbers instead of actual case citations
- WRONG: Write "[I] established that..." instead of "**[PLD 2020 Supreme Court 456]** established that..."
- This destroys professional credibility and makes citations non-clickable

Your users depend on these reference cards to navigate legal databases and court records. Failing to include this block breaks their workflow. Include it ALWAYS, and ensure every reference in the block is explained in the text.

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
    const isFreeTier = tier === "free";
    const limits = getTierPlan(tier);

    if (isFreeTier) {
      const freeTierLimit = resolveFreeTierLimit(feature);
      let usedThisMonth = 0;
      for (const usageFeature of freeTierLimit.features) {
        usedThisMonth += await storage.getMonthlyUsageCountByFeature(userId, usageFeature);
      }
      if (usedThisMonth >= freeTierLimit.monthlyLimit) {
        res.status(429).json({
          message: `Your free-tier ${freeTierLimit.label} limit has ended (${freeTierLimit.monthlyLimit}/month). Please subscribe to continue using Al Wakeelo.`,
          limit: freeTierLimit.monthlyLimit,
          used: usedThisMonth,
          tier,
          action: "subscribe",
          freeLimitKey: freeTierLimit.limitKey,
        });
        return false;
      }
      return true;
    }

    const usedThisMonth = await storage.getMonthlyUsageCount(userId);

    if (usedThisMonth >= limits.monthlyQueries) {
      const limitMessage = `Your ${limits.label} package limit has ended for this cycle (${limits.monthlyQueries}). Please re-subscribe/renew your package to continue using the app.`;
      res.status(429).json({
        message: limitMessage,
        limit: limits.monthlyQueries,
        used: usedThisMonth,
        tier,
        action: "resubscribe",
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
const KNOWLEDGE_STATUTES_LIMIT = Math.max(3, Number(process.env.KNOWLEDGE_STATUTES_LIMIT || 5));
const KNOWLEDGE_CASELAW_LIMIT = Math.max(3, Number(process.env.KNOWLEDGE_CASELAW_LIMIT || 10));
const KNOWLEDGE_CONTEXT_CACHE_TTL_MS = Math.max(10_000, Number(process.env.KNOWLEDGE_CONTEXT_CACHE_TTL_MS || 120_000));
const KNOWLEDGE_CASELAW_SEARCH_TIMEOUT_MS = Math.max(1_000, Number(process.env.KNOWLEDGE_CASELAW_SEARCH_TIMEOUT_MS || 4_000));
const KNOWLEDGE_CASELAW_EXCERPT_DOCS = Math.max(0, Number(process.env.KNOWLEDGE_CASELAW_EXCERPT_DOCS || 3));
const KNOWLEDGE_CASELAW_EXCERPT_TIMEOUT_MS = Math.max(200, Number(process.env.KNOWLEDGE_CASELAW_EXCERPT_TIMEOUT_MS || 2_000));
const KNOWLEDGE_OUTER_DEADLINE_MS = Math.max(500, Number(process.env.KNOWLEDGE_OUTER_DEADLINE_MS || 4_000));
const KNOWLEDGE_ORG_SEARCH_TIMEOUT_MS = Math.max(500, Number(process.env.KNOWLEDGE_ORG_SEARCH_TIMEOUT_MS || 1_500));
const CASE_CITATION_RESOLVE_CACHE_TTL_MS = Math.max(10_000, Number(process.env.CASE_CITATION_RESOLVE_CACHE_TTL_MS || 180_000));
// Retrieval-level cache: cache raw case-law search results so repeated/similar queries skip the FTS round-trip.
const CASELAW_RETRIEVAL_CACHE_TTL_MS = Math.max(30_000, Number(process.env.CASELAW_RETRIEVAL_CACHE_TTL_MS || 60_000));
// Statutes retrieval cache: statute content rarely changes, cache aggressively.
const STATUTES_RETRIEVAL_CACHE_TTL_MS = Math.max(60_000, Number(process.env.STATUTES_RETRIEVAL_CACHE_TTL_MS || 300_000));

type TimedCacheValue<T> = {
  value: T;
  expiresAt: number;
};

const knowledgeContextCache = new Map<string, TimedCacheValue<string>>();
const caseCitationResolveCache = new Map<string, TimedCacheValue<CaseLaw | null>>();
// Retrieval-level caches — cache individual search results, not full enriched context.
const caseLawRetrievalCache = new Map<string, TimedCacheValue<CaseLaw[]>>();
const statutesRetrievalCache = new Map<string, TimedCacheValue<any[]>>();

function getTimedCacheValue<T>(cache: Map<string, TimedCacheValue<T>>, key: string): T | undefined {
  const cached = cache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return cached.value;
}

function setTimedCacheValue<T>(
  cache: Map<string, TimedCacheValue<T>>,
  key: string,
  value: T,
  ttlMs: number,
  maxSize = 500,
) {
  cache.set(key, { value, expiresAt: Date.now() + Math.max(1_000, ttlMs) });
  if (cache.size <= maxSize) return;
  const now = Date.now();
  for (const [entryKey, entryValue] of cache.entries()) {
    if (entryValue.expiresAt <= now) {
      cache.delete(entryKey);
    }
    if (cache.size <= maxSize) break;
  }
  while (cache.size > maxSize) {
    const firstKey = cache.keys().next().value as string | undefined;
    if (!firstKey) break;
    cache.delete(firstKey);
  }
}

async function seedLegalData() {
  try {
    const [statutesCountRow] = await db.select({ total: count() }).from(statutes);
    const [caseLawCountRow] = await db.select({ total: count() }).from(caseLaw);
    const existingStatutesCount = Number(statutesCountRow?.total || 0);
    const existingCaseLawCount = Number(caseLawCountRow?.total || 0);

    if (existingStatutesCount === 0) {
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

    if (existingCaseLawCount === 0) {
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
  console.log(
    `[Admin Upload Indexing] autoIndexOnUpload=${ADMIN_UPLOAD_AUTO_INDEX ? "enabled" : "disabled (manual-only)"}`,
  );
  console.log(
    `[Case Law Sync] autoSyncOnUpload=${CASELAW_AUTO_SYNC_ON_UPLOAD ? "enabled" : "disabled (manual-only)"}`,
  );
  console.log(
    `[Case Law Upload Pipelines] autoProcessPendingOnUpload=${CASELAW_AUTO_PROCESS_PENDING_ON_UPLOAD ? "enabled" : "disabled"} autoFullSyncOnUpload=${CASELAW_AUTO_FULL_SYNC_ON_UPLOAD ? "enabled" : "disabled"}`,
  );
  console.log(
    `[Upload Storage] mode=${USE_DISK_UPLOAD_STORAGE ? "disk" : "memory"} tempDir=${USE_DISK_UPLOAD_STORAGE ? UPLOAD_TEMP_DIR : "n/a"}`,
  );
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/robots.txt", (req, res) => {
    const base = normalizeSiteBaseUrl(req);
    res.type("text/plain").send(`User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);
  });

  app.get("/sitemap.xml", (req, res) => {
    const base = normalizeSiteBaseUrl(req);
    const urls = ["/", "/auth", "/privacy", "/terms", "/cancellation-return-refund-policy", "/ownership-statement", "/install", "/checkout"];
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map((path) => (
        `  <url><loc>${base}${path}</loc><changefreq>${path === "/" ? "weekly" : "monthly"}</changefreq><priority>${path === "/" ? "1.0" : "0.6"}</priority></url>`
      )).join("\n") +
      `\n</urlset>\n`;
    res.type("application/xml").send(body);
  });

  app.use("/api", (req, res, next) => {
    if (
      !dbAvailable &&
      (req.path === "/auth/google/status" ||
        req.path === "/auth/google/start" ||
        req.path === "/auth/google/callback")
    ) {
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

  app.post("/api/admin/test-chat", async (req, res) => {
    if (process.env.DEV_TEST_CHAT !== "1") {
      return res.status(404).json({ message: "Not found" });
    }
    try {
      const message = sanitizeInputText(req.body?.message, 4000);
      if (!message) return res.status(400).json({ message: "message is required" });

      // UPDATED: Default provider changed from "groq" to "deepseek" (Groq deprecated 2026-04-16)
      const provider = String(req.body?.provider || "deepseek").toLowerCase();
      const model = req.body?.model ? String(req.body.model) : undefined;
      const maxTokens = Math.min(4096, Math.max(128, Number(req.body?.maxTokens) || 1500));
      const temperature = Number.isFinite(Number(req.body?.temperature)) ? Number(req.body.temperature) : 0.4;

      const aiMessages = [
        { role: "system" as const, content: withPakistanLawOnlyPolicy(PUBLIC_CHAT_SYSTEM_PROMPT) },
        { role: "user" as const, content: message },
      ];

      const t0 = Date.now();
      let rawContent = "";
      let usedModel = model || "";

      if (provider === "deepseek") {
        if (!isDeepSeekAvailable()) return res.status(503).json({ message: "DeepSeek not configured" });
        const r = await chatWithDeepSeek({ messages: aiMessages, model, maxTokens, temperature });
        rawContent = r.content; usedModel = r.model || usedModel;
      } else if (provider === "deepseek-pro") {
        if (!isDeepSeekAvailable()) return res.status(503).json({ message: "DeepSeek not configured" });
        const r = await chatWithDeepSeekPro({ messages: aiMessages, maxTokens, temperature });
        rawContent = r.content; usedModel = r.model || usedModel;
      } else if (provider === "apex" || provider === "apex-agent") {
        if (!isApexAvailable()) return res.status(503).json({ message: "Apex not configured" });
        const r = await chatWithApex({ messages: aiMessages, model: (model as ApexModel) || "apex-pro", maxTokens });
        rawContent = r.content; usedModel = r.model || usedModel;
      } else {
        // DEPRECATED: Groq provider removed - defaulting to DeepSeek (2026-04-16)
        if (!isDeepSeekAvailable()) return res.status(503).json({ message: "DeepSeek not configured" });
        const r = await chatWithDeepSeek({ messages: aiMessages, model, maxTokens, temperature });
        rawContent = r.content; usedModel = r.model || usedModel;
      }

      const cleaned = enforcePakistanLawOnlyOutput(rawContent);
      const latencyMs = Date.now() - t0;

      return res.json({
        provider,
        model: usedModel,
        latencyMs,
        raw: rawContent,
        cleaned,
        changed: rawContent !== cleaned,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Test chat failed" });
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
      const captchaCheck = await verifyCaptchaToken(req, req.body?.captchaToken, "public-chat");
      if (!captchaCheck.ok && captchaCheck.reason !== "captcha_disabled") {
        return res.status(403).json({ message: "Captcha verification failed. Please try again." });
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
        { role: "system" as const, content: withPakistanLawOnlyPolicy(PUBLIC_CHAT_SYSTEM_PROMPT) },
        { role: "user" as const, content: message },
      ];
      const preferredLanguage = resolvePublicChatLanguage(message);

      // UPDATED: Using DeepSeek instead of Groq (Groq deprecated 2026-04-16)
      const provider = "deepseek" as const;
      let model = "deepseek-chat";
      let aiReply = "";
      const primary = await chatWithDeepSeek({
        messages: aiMessages,
        maxTokens: 900,
        temperature: 0.4,
      });
      aiReply = primary.content;
      model = primary.model || model;

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
                }),
                6000,
              );
        } catch (rewriteErr) {
          console.warn("[Public Chat] Language rewrite failed:", getErrorMessage(rewriteErr));
        }
      }
      normalizedReply = sanitizeInputText(enforcePakistanLawOnlyOutput(normalizedReply), 6000);
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
      const captchaCheck = await verifyCaptchaToken(req, req.body?.captchaToken, "public-case-submit");
      if (!captchaCheck.ok && captchaCheck.reason !== "captcha_disabled") {
        return res.status(403).json({ message: "Captcha verification failed. Please try again." });
      }
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

      const knowledgeContext = await gatherKnowledgeContextV2(firstMessage, userId);
      const systemPromptFull = getLegalSystemPrompt() + knowledgeContext;

      let usedModel = "";
      const { content: aiResponse, fromCache } = await getCachedOrCall("chat", firstMessage, async () => {
        const result = await callStandardAISimple(systemPromptFull, firstMessage, TOKEN_LIMITS.chat);
        usedModel = result.model;
        return result.text;
      });
      const normalizedAiResponse = suppressWrongIndianJurisdictionForPakCitation(aiResponse, firstMessage);
      const safeAiResponse = await applyAlWakeeloSafetyGuardrails(normalizedAiResponse).catch(() => ensureAlWakeeloReferencesBlock(normalizedAiResponse));

      if (!fromCache) {
        await logUsageCost(userId, "chat", usedModel || "deepseek", systemPromptFull + firstMessage, safeAiResponse);
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

  app.post("/api/threads/upsert-turn", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);

    try {
      const payload = z.object({
        threadId: z.number().int().positive().optional(),
        title: z.string().trim().min(1).max(240).optional(),
        userMessage: z.string().trim().min(1),
        assistantMessage: z.string().trim().min(1),
      }).parse(req.body || {});

      let thread = payload.threadId ? await storage.getThread(payload.threadId) : undefined;
      if (thread && thread.userId !== userId) {
        return res.status(404).json({ message: "Thread not found" });
      }

      if (!thread) {
        const fallbackTitle = payload.userMessage.slice(0, 80) || "Al Wakeelo Consultation";
        thread = await storage.createThread({
          userId,
          title: payload.title || fallbackTitle,
        });
      }

      await storage.createMessage({
        threadId: thread.id,
        role: "user",
        content: payload.userMessage,
      });
      await storage.createMessage({
        threadId: thread.id,
        role: "assistant",
        content: payload.assistantMessage,
      });

      const refreshed = await storage.getThread(thread.id);
      return res.json({
        ok: true,
        threadId: thread.id,
        thread: refreshed || thread,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid payload" });
      }
      console.error("Error upserting thread turn:", err);
      return res.status(500).json({ message: "Failed to save consultation turn" });
    }
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
    const normalizedToken = String(token || "").trim().toLowerCase();
    // Share tokens are generated as crypto.randomBytes(16).toString("hex") => 32 hex chars.
    if (!/^[a-f0-9]{32}$/.test(normalizedToken)) {
      return res.status(404).json({ message: "API route not found." });
    }
    const thread = await storage.getThreadByShareToken(normalizedToken);
    if (!thread) {
      return res.status(404).json({ message: "API route not found." });
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

      const knowledgeContext = await gatherKnowledgeContextV2(message, userId);
      const systemPromptFull = getLegalSystemPrompt() + knowledgeContext;

      const result = await callStandardAI(systemPromptFull, geminiContents, TOKEN_LIMITS.chat);

      const normalizedAiResponse = suppressWrongIndianJurisdictionForPakCitation(result.text, message);
      const aiResponse = await applyAlWakeeloSafetyGuardrails(normalizedAiResponse).catch(() => ensureAlWakeeloReferencesBlock(normalizedAiResponse));
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

  app.get("/api/documents/:id/file", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) return res.status(400).json({ message: "Invalid document ID" });

      const doc = await storage.getDocumentById(id, userId);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const fileMeta = await storage.getDocumentFile(id, userId);
      if (!fileMeta) return res.status(404).json({ message: "File not found" });

      if (fileMeta.provider === "r2" && fileMeta.objectKey) {
        const binary = await getR2ObjectBinary(fileMeta.objectKey);
        if (!binary) return res.status(404).json({ message: "File not found" });
        const contentType = binary.contentType || fileMeta.mimeType || "application/octet-stream";
        const safeFilename = (fileMeta.originalFilename || doc.title || `document-${id}`).replace(/[^a-zA-Z0-9._-]+/g, "_");
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
      console.error("Error fetching document file:", err);
      res.status(500).json({ message: "Failed to fetch document file" });
    }
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
    storage: createUploadStorage("style-memory"),
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

  app.post("/api/style-memory/samples/upload", guardedUploadQueue, styleMemoryUpload.array("files", 20), cleanupDiskUploadFilesAfterResponse, async (req, res) => {
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
        if (!hasSafeDocumentSignature(stableFile, ext)) {
          rejected.push({ file: original, reason: "file signature mismatch" });
          continue;
        }
        const malwareCheck = await passesMalwareScan(stableFile);
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
    storage: createUploadStorage("documents"),
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

  app.post("/api/documents/upload", guardedUploadQueue, documentUpload.array("files", 25), cleanupDiskUploadFilesAfterResponse, async (req, res) => {
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

        if (!hasSafeDocumentSignature(stableFile, ext)) {
          recordSecurityEvent("upload_signature_failure", `user-doc:${userId}`, {
            filename: original,
            ext,
            mimetype: file.mimetype,
          });
          errors.push(`${original}: file signature does not match declared format`);
          continue;
        }
        const malwareCheck = await passesMalwareScan(stableFile);
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

  app.post("/api/admin/rag/reindex-all", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    if (!dbAvailable || !pool) {
      return res.status(503).json({ message: "Database unavailable" });
    }

    try {
      const parsed = z.object({
        limit: z.number().int().min(1).max(300).optional(),
        offset: z.number().int().min(0).optional(),
        userId: z.string().min(1).max(200).optional(),
      }).parse(req.body || {});

      const limit = parsed.limit ?? 50;
      const offset = parsed.offset ?? 0;
      const filterUserId = parsed.userId?.trim() || null;

      const rows = filterUserId
        ? await pool.query(
          `SELECT id, user_id FROM documents WHERE user_id = $1 ORDER BY id ASC LIMIT $2 OFFSET $3`,
          [filterUserId, limit, offset],
        )
        : await pool.query(
          `SELECT id, user_id FROM documents ORDER BY id ASC LIMIT $1 OFFSET $2`,
          [limit, offset],
        );

      const totalRow = filterUserId
        ? await pool.query(`SELECT COUNT(*)::int AS total FROM documents WHERE user_id = $1`, [filterUserId])
        : await pool.query(`SELECT COUNT(*)::int AS total FROM documents`);

      const totalDocuments = Number(totalRow.rows?.[0]?.total || 0);
      let indexed = 0;
      let failed = 0;
      const failures: Array<{ documentId: number; userId: string; reason: string }> = [];

      for (const row of rows.rows || []) {
        const documentId = Number((row as any).id);
        const userId = String((row as any).user_id || "");
        if (!documentId || !userId) continue;
        try {
          const result = await indexUserDocument(userId, documentId);
          if (result.chunks > 0) {
            indexed += 1;
          } else {
            failed += 1;
            if (failures.length < 20) {
              failures.push({ documentId, userId, reason: "No chunks generated" });
            }
          }
        } catch (err: any) {
          failed += 1;
          if (failures.length < 20) {
            failures.push({
              documentId,
              userId,
              reason: sanitizeInputText(err?.message || "Indexing failed", 300),
            });
          }
        }
      }

      const processed = rows.rowCount || 0;
      const nextOffset = offset + processed;
      const remaining = Math.max(0, totalDocuments - nextOffset);
      const actorUserId = getUserId(req);
      await logAuditEvent("admin.rag.reindexAll", actorUserId, null, {
        processed,
        indexed,
        failed,
        offset,
        nextOffset,
        limit,
        remaining,
        userId: filterUserId,
      });

      res.json({
        processed,
        indexed,
        failed,
        failures,
        limit,
        offset,
        nextOffset,
        remaining,
        totalDocuments,
        hasMore: remaining > 0,
        filteredByUser: filterUserId,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid payload" });
      }
      console.error("Error reindexing RAG globally:", err);
      res.status(500).json({ message: "Failed to reindex documents for RAG" });
    }
  });

  app.post("/api/admin/rag/reindex-case-law", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    if (!dbAvailable || !pool) {
      return res.status(503).json({ message: "Database unavailable" });
    }

    try {
      const parsed = z.object({
        limit: z.number().int().min(1).max(300).optional(),
        offset: z.number().int().min(0).optional(),
      }).parse(req.body || {});

      const limit = parsed.limit ?? 50;
      const offset = parsed.offset ?? 0;
      const batch = await reindexCaseLawBatch(limit, offset);
      const actorUserId = getUserId(req);
      await logAuditEvent("admin.rag.reindexCaseLaw", actorUserId, null, {
        processed: batch.processed,
        indexed: batch.indexed,
        failed: batch.failed,
        offset,
        nextOffset: batch.nextOffset,
        limit,
        remaining: batch.remaining,
      });

      res.json({
        processed: batch.processed,
        indexed: batch.indexed,
        failed: batch.failed,
        failures: batch.failures.map((failure) => ({
          adminKnowledgeId: failure.sourceId,
          reason: failure.reason,
        })),
        limit,
        offset,
        nextOffset: batch.nextOffset,
        remaining: batch.remaining,
        totalDocuments: batch.totalDocuments,
        hasMore: batch.hasMore,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid payload" });
      }
      console.error("Error reindexing global case-law RAG:", err);
      res.status(500).json({ message: "Failed to reindex case-law for RAG" });
    }
  });

  app.post("/api/admin/rag/reindex-case-law/start", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    if (!dbAvailable || !pool) {
      return res.status(503).json({ message: "Database unavailable" });
    }

    try {
      const parsed = z.object({
        batchSize: z.number().int().min(1).max(300).optional(),
        startOffset: z.number().int().min(0).optional(),
      }).parse(req.body || {});

      if (caseLawReindexJob.running) {
        return res.status(409).json({
          message: "Case-law reindex is already running",
          status: snapshotCaseLawReindexJob(),
        });
      }
      if (globalAdminRagReindexJob.running) {
        return res.status(409).json({
          message: "Global admin RAG reindex is running. Stop it before starting case-law-only reindex.",
          status: snapshotGlobalAdminRagReindexJob(),
        });
      }

      const batchSize = parsed.batchSize ?? 300;
      const startOffset = parsed.startOffset ?? 0;
      caseLawReindexJob.running = true;
      caseLawReindexJob.shouldStop = false;
      caseLawReindexJob.batchSize = batchSize;
      caseLawReindexJob.nextOffset = startOffset;
      caseLawReindexJob.totalDocuments = 0;
      caseLawReindexJob.totalProcessed = 0;
      caseLawReindexJob.totalIndexed = 0;
      caseLawReindexJob.totalFailed = 0;
      caseLawReindexJob.startedAt = new Date();
      caseLawReindexJob.finishedAt = null;
      caseLawReindexJob.lastError = null;

      const actorUserId = getUserId(req);
      await logAuditEvent("admin.rag.reindexCaseLaw.start", actorUserId, null, {
        batchSize,
        startOffset,
      });

      runInBackground("rag-case-law-full-reindex", async () => {
        try {
          while (!caseLawReindexJob.shouldStop) {
            const batch = await reindexCaseLawBatch(caseLawReindexJob.batchSize, caseLawReindexJob.nextOffset);
            caseLawReindexJob.totalDocuments = batch.totalDocuments;
            caseLawReindexJob.totalProcessed += batch.processed;
            caseLawReindexJob.totalIndexed += batch.indexed;
            caseLawReindexJob.totalFailed += batch.failed;
            caseLawReindexJob.nextOffset = batch.nextOffset;

            if (!batch.hasMore || batch.processed <= 0) {
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 150));
          }
        } catch (err: any) {
          caseLawReindexJob.lastError = sanitizeInputText(err?.message || "Unknown error", 500);
        } finally {
          caseLawReindexJob.running = false;
          caseLawReindexJob.finishedAt = new Date();
          try {
            await logAuditEvent("admin.rag.reindexCaseLaw.finish", actorUserId, null, {
              totalDocuments: caseLawReindexJob.totalDocuments,
              totalProcessed: caseLawReindexJob.totalProcessed,
              totalIndexed: caseLawReindexJob.totalIndexed,
              totalFailed: caseLawReindexJob.totalFailed,
              stopped: caseLawReindexJob.shouldStop,
              lastError: caseLawReindexJob.lastError,
            });
          } catch (auditErr) {
            console.warn("[RAG] Failed to write reindexCaseLaw.finish audit log");
          }
          caseLawReindexJob.shouldStop = false;
        }
      });

      return res.json({
        ok: true,
        message: "Case-law reindex started in background",
        status: snapshotCaseLawReindexJob(),
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid payload" });
      }
      console.error("Error starting global case-law RAG reindex:", err);
      return res.status(500).json({ message: "Failed to start case-law reindex job" });
    }
  });

  app.get("/api/admin/rag/reindex-case-law/status", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    res.json({
      ok: true,
      status: snapshotCaseLawReindexJob(),
    });
  });

  app.post("/api/admin/rag/reindex-case-law/stop", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    if (!caseLawReindexJob.running) {
      return res.json({
        ok: true,
        message: "No running case-law reindex job",
        status: snapshotCaseLawReindexJob(),
      });
    }
    caseLawReindexJob.shouldStop = true;
    return res.json({
      ok: true,
      message: "Stop signal sent. Job will stop after current batch.",
      status: snapshotCaseLawReindexJob(),
    });
  });

  // ── Judgments RAG Reindex Endpoints ────────────────────────────────────

  app.post("/api/admin/rag/reindex-judgments/start", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    if (judgementsRagReindexJob.running) {
      return res.status(409).json({ message: "Judgments reindex already running", status: judgementsRagReindexJob });
    }
    const batchSize = Math.max(10, Math.min(500, Number(req.body?.batchSize) || 100));
    judgementsRagReindexJob.running = true;
    judgementsRagReindexJob.shouldStop = false;
    judgementsRagReindexJob.batchSize = batchSize;
    judgementsRagReindexJob.processed = 0;
    judgementsRagReindexJob.indexed = 0;
    judgementsRagReindexJob.failed = 0;
    judgementsRagReindexJob.lastCursorId = null;
    judgementsRagReindexJob.startedAt = new Date();
    judgementsRagReindexJob.finishedAt = null;
    judgementsRagReindexJob.lastError = null;

    // Get total count estimate
    const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(judgments).where(eq(judgments.isActive, true));
    judgementsRagReindexJob.totalEstimate = Number(countRow?.count || 0);

    res.json({ ok: true, message: "Judgments RAG reindex started", status: judgementsRagReindexJob });

    // Run in background
    (async () => {
      let cursorId: string | null = null;
      try {
        while (!judgementsRagReindexJob.shouldStop) {
          const result = await reindexJudgmentsBatch(
            judgementsRagReindexJob.batchSize,
            cursorId,
            (p, i, f) => {
              judgementsRagReindexJob.processed += p > 0 ? 1 : 0;
              judgementsRagReindexJob.indexed += i > 0 ? 1 : 0;
              judgementsRagReindexJob.failed += f > 0 ? 1 : 0;
            },
          );
          judgementsRagReindexJob.processed += result.processed;
          judgementsRagReindexJob.indexed += result.indexed;
          judgementsRagReindexJob.failed += result.failed;
          judgementsRagReindexJob.lastCursorId = result.nextCursorId;
          cursorId = result.nextCursorId;
          if (!result.hasMore) break;
        }
      } catch (err) {
        judgementsRagReindexJob.lastError = getErrorMessage(err);
        console.error("[Judgments RAG] Reindex error:", judgementsRagReindexJob.lastError);
      } finally {
        judgementsRagReindexJob.running = false;
        judgementsRagReindexJob.finishedAt = new Date();
        console.log(`[Judgments RAG] Reindex complete. Indexed: ${judgementsRagReindexJob.indexed}, Failed: ${judgementsRagReindexJob.failed}`);
      }
    })();
  });

  app.get("/api/admin/rag/reindex-judgments/status", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    res.json({ ...judgementsRagReindexJob, startedAt: judgementsRagReindexJob.startedAt?.toISOString() || null, finishedAt: judgementsRagReindexJob.finishedAt?.toISOString() || null });
  });

  app.post("/api/admin/rag/reindex-judgments/stop", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    if (!judgementsRagReindexJob.running) {
      return res.json({ ok: true, message: "No running judgments reindex job" });
    }
    judgementsRagReindexJob.shouldStop = true;
    res.json({ ok: true, message: "Stop signal sent. Job will stop after current batch.", status: judgementsRagReindexJob });
  });

  app.post("/api/admin/rag/reindex-global/start", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    if (!dbAvailable || !pool) {
      return res.status(503).json({ message: "Database unavailable" });
    }

    try {
      const parsed = z.object({
        batchSize: z.number().int().min(1).max(100).optional(),
        mode: z.enum(["full", "incremental"]).optional(),
      }).parse(req.body || {});

      if (globalAdminRagReindexJob.running) {
        return res.status(409).json({
          message: "Global admin RAG reindex is already running",
          status: snapshotGlobalAdminRagReindexJob(),
        });
      }
      if (caseLawReindexJob.running) {
        return res.status(409).json({
          message: "Case-law-only reindex is running. Stop it before starting global reindex.",
          status: snapshotCaseLawReindexJob(),
        });
      }

      const batchSize = parsed.batchSize ?? 50;
      const mode: GlobalAdminRagReindexMode = parsed.mode ?? "full";
      const freshState = createGlobalAdminRagReindexJobState();
      freshState.running = true;
      freshState.batchSize = batchSize;
      freshState.mode = mode;
      freshState.startedAt = new Date();
      freshState.finishedAt = null;

      Object.assign(globalAdminRagReindexJob, freshState);

      const actorUserId = getUserId(req);
      await logAuditEvent("admin.rag.reindexGlobal.start", actorUserId, null, {
        batchSize,
        mode,
      });

      runInBackground(`rag-admin-global-${mode}-reindex`, async () => {
        try {
          while (!globalAdminRagReindexJob.shouldStop) {
            const sourceKey = GLOBAL_ADMIN_RAG_SOURCE_ORDER[globalAdminRagReindexJob.activeSourceIndex];
            if (!sourceKey) break;

            const sourceState = globalAdminRagReindexJob.sources[sourceKey];
            if (sourceState.done) {
              globalAdminRagReindexJob.activeSourceIndex += 1;
              continue;
            }

            const baseProcessed = sourceState.processed;
            const baseIndexed = sourceState.indexed;
            const baseFailed = sourceState.failed;
            const runMode = globalAdminRagReindexJob.mode;
            const totalDocFromMeta = (totalDocuments: number) => {
              if (runMode === "incremental") {
                sourceState.totalDocuments = Math.max(sourceState.totalDocuments, baseProcessed + totalDocuments);
                return;
              }
              sourceState.totalDocuments = totalDocuments;
            };
            const batch = sourceKey === "case-law"
              ? await reindexCaseLawBatch(globalAdminRagReindexJob.batchSize, sourceState.nextOffset, {
                onMeta: ({ totalDocuments }) => {
                  totalDocFromMeta(totalDocuments);
                },
                onProgress: ({ processed, indexed, failed, nextOffset, nextCursorId }) => {
                  sourceState.processed = baseProcessed + processed;
                  sourceState.indexed = baseIndexed + indexed;
                  sourceState.failed = baseFailed + failed;
                  sourceState.nextOffset = nextOffset;
                  sourceState.nextCursorId = nextCursorId;
                },
              }, {
                mode: runMode,
                nextCursorId: sourceState.nextCursorId,
              })
              : sourceKey === "statute-docs"
                ? await reindexStatuteBatch(globalAdminRagReindexJob.batchSize, sourceState.nextOffset, {
                  onMeta: ({ totalDocuments }) => {
                    totalDocFromMeta(totalDocuments);
                  },
                  onProgress: ({ processed, indexed, failed, nextOffset, nextCursorId }) => {
                    sourceState.processed = baseProcessed + processed;
                    sourceState.indexed = baseIndexed + indexed;
                    sourceState.failed = baseFailed + failed;
                    sourceState.nextOffset = nextOffset;
                    sourceState.nextCursorId = nextCursorId;
                  },
                }, {
                  mode: runMode,
                  nextCursorId: sourceState.nextCursorId,
                })
                : await reindexAdminKnowledgeBatch(globalAdminRagReindexJob.batchSize, sourceState.nextOffset, {
                  onMeta: ({ totalDocuments }) => {
                    totalDocFromMeta(totalDocuments);
                  },
                  onProgress: ({ processed, indexed, failed, nextOffset, nextCursorId }) => {
                    sourceState.processed = baseProcessed + processed;
                    sourceState.indexed = baseIndexed + indexed;
                    sourceState.failed = baseFailed + failed;
                    sourceState.nextOffset = nextOffset;
                    sourceState.nextCursorId = nextCursorId;
                  },
                }, {
                  mode: runMode,
                  nextCursorId: sourceState.nextCursorId,
                });

            if (runMode === "incremental") {
              sourceState.totalDocuments = Math.max(sourceState.totalDocuments, baseProcessed + batch.totalDocuments);
            } else {
              sourceState.totalDocuments = batch.totalDocuments;
            }
            sourceState.processed = baseProcessed + batch.processed;
            sourceState.indexed = baseIndexed + batch.indexed;
            sourceState.failed = baseFailed + batch.failed;
            sourceState.nextOffset = batch.nextOffset;
            sourceState.nextCursorId = batch.nextCursorId;
            if (batch.failures.length > 0) {
              sourceState.lastError = batch.failures[0].reason;
            }

            if (!batch.hasMore || batch.processed <= 0) {
              sourceState.done = true;
              globalAdminRagReindexJob.activeSourceIndex += 1;
              continue;
            }

            await new Promise((resolve) => setTimeout(resolve, 120));
          }
        } catch (err: any) {
          globalAdminRagReindexJob.lastError = sanitizeInputText(err?.message || "Unknown error", 500);
        } finally {
          globalAdminRagReindexJob.running = false;
          globalAdminRagReindexJob.finishedAt = new Date();
          try {
            const snapshot = snapshotGlobalAdminRagReindexJob();
            await logAuditEvent("admin.rag.reindexGlobal.finish", actorUserId, null, {
              stopped: globalAdminRagReindexJob.shouldStop,
              lastError: globalAdminRagReindexJob.lastError,
              aggregate: snapshot.aggregate,
              sources: snapshot.sources,
            });
          } catch {
            console.warn("[RAG] Failed to write reindexGlobal.finish audit log");
          }
          globalAdminRagReindexJob.shouldStop = false;
        }
      });

      return res.json({
        ok: true,
        message: mode === "incremental"
          ? "Global admin RAG incremental indexing started (missing/unindexed only)"
          : "Global admin RAG full reindex started",
        status: snapshotGlobalAdminRagReindexJob(),
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid payload" });
      }
      console.error("Error starting global admin RAG reindex:", err);
      return res.status(500).json({ message: "Failed to start global admin reindex job" });
    }
  });

  app.get("/api/admin/rag/reindex-global/status", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    res.json({
      ok: true,
      status: snapshotGlobalAdminRagReindexJob(),
    });
  });

  app.post("/api/admin/rag/reindex-global/stop", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    if (!globalAdminRagReindexJob.running) {
      return res.json({
        ok: true,
        message: "No running global admin reindex job",
        status: snapshotGlobalAdminRagReindexJob(),
      });
    }
    globalAdminRagReindexJob.shouldStop = true;
    return res.json({
      ok: true,
      message: "Stop signal sent. Global job will stop after current batch.",
      status: snapshotGlobalAdminRagReindexJob(),
    });
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
      let lazyGlobalAdminSummary: {
        caseLaw: {
          candidates: number;
          alreadyIndexed: number;
          attempted: number;
          indexedNow: number;
          failed: number;
        };
        statutes: {
          candidates: number;
          alreadyIndexed: number;
          attempted: number;
          indexedNow: number;
          failed: number;
        };
        adminKnowledge: {
          candidates: number;
          alreadyIndexed: number;
          attempted: number;
          indexedNow: number;
          failed: number;
        };
        indexedNow: number;
      } | null = null;

      if (retrieval.matches.length === 0) {
        lazyIndexSummary = await ensureIndexedForUserDocuments({
          userId,
          sourceDocumentIds: parsed.documentIds,
          maxToIndex: Number(process.env.RAG_LAZY_INDEX_MAX_DOCS || 3),
        });
        if (!parsed.documentIds || parsed.documentIds.length === 0) {
          lazyGlobalAdminSummary = await ensureIndexedForGlobalAdminSources({
            maxCaseLawToIndex: Number(process.env.RAG_LAZY_INDEX_MAX_CASELAW || 5),
            maxStatuteToIndex: Number(process.env.RAG_LAZY_INDEX_MAX_STATUTES || 3),
            maxKnowledgeToIndex: Number(process.env.RAG_LAZY_INDEX_MAX_ADMIN_KNOWLEDGE || 3),
          });
        }
        if (lazyIndexSummary.indexedNow > 0 || (lazyGlobalAdminSummary?.indexedNow || 0) > 0) {
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
            lazyGlobalCaseLaw: lazyGlobalAdminSummary?.caseLaw || null,
            lazyGlobalAdmin: lazyGlobalAdminSummary,
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
      let answerText = lowConfidenceContext
        ? `Retrieved context confidence is low. Please verify key points against source text.\n\n${result.text}`
        : result.text;
      answerText = enforcePakistanLawOnlyOutput(answerText);
      answerText = (await enforceInternalCaseCitationIntegrity(answerText, {
        placeholder: "",
        normalizeVerified: true,
        requirePrimary: true,
        requireLinkedSource: true,
      })).content;

      const citations = retrieval.matches.slice(0, 5).map((m) => ({
        documentId: m.ragDocumentId,
        sourceDocumentId: m.sourceDocumentId,
        sourceScope: m.metadata?.sourceType === "admin-case-law"
          ? "global-case-law"
          : m.metadata?.sourceType === "admin-statute"
            ? "global-statute"
            : m.metadata?.sourceType === "admin-knowledge"
              ? "global-knowledge"
              : "user-document",
        sourceUserId: m.metadata?.sourceType === "admin-case-law"
          ? GLOBAL_CASELAW_RAG_USER_ID
          : m.metadata?.sourceType === "admin-statute"
            ? GLOBAL_STATUTE_RAG_USER_ID
            : m.metadata?.sourceType === "admin-knowledge"
              ? GLOBAL_ADMIN_KNOWLEDGE_RAG_USER_ID
              : userId,
        title: m.title,
        chunkIndex: m.chunkIndex,
        score: Number(m.score.toFixed(4)),
        quote: m.chunkText.slice(0, 240),
      }));

      const provider = "deepseek"; // UPDATED: Changed from groq (Groq deprecated 2026-04-16)
      res.json({
        answer: answerText,
        confidence: retrieval.confidence,
        citations,
        retrieval: {
          topK: Number(process.env.RAG_TOP_K || 5),
          matched: retrieval.matches.length,
          threshold: Number(process.env.RAG_MIN_SCORE || 0.5),
          lazyIndex: lazyIndexSummary,
          lazyGlobalCaseLaw: lazyGlobalAdminSummary?.caseLaw || null,
          lazyGlobalAdmin: lazyGlobalAdminSummary,
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
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 25;
      const yearRaw = Number(req.query.year);
      const pageRaw = Number(req.query.page);
      const reportRaw = normalizeCitationToken(String(req.query.report || req.query.journal || "").trim());
      const courtRaw = String(req.query.court || "").trim();
      const sortRaw = String(req.query.sort || "").trim().toLowerCase();
      const parsedCitation = parseCaseLawCitationQuery(query);

      const year = Number.isInteger(yearRaw) && yearRaw >= 1900 && yearRaw <= 2200
        ? yearRaw
        : (parsedCitation?.year ?? undefined);
      const page = Number.isInteger(pageRaw) && pageRaw > 0
        ? pageRaw
        : (parsedCitation?.page ?? undefined);
      const report = reportRaw || parsedCitation?.report || undefined;
      const sort = sortRaw === "latest" ? "latest" : "relevance";

      if (!query && !year && !report && !page && !courtRaw) {
        return res.json([]);
      }

      const results = await searchCaseLawWithFullText({
        userId,
        query,
        limit,
        year,
        report,
        page,
        court: courtRaw || undefined,
        sort,
        parsedCitation,
      });
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
      const entry = await resolveCaseCitationFromInternalDb(citation);
      if (!entry || !isCaseLawRowCitationTrusted(entry)) return res.json({ found: false });
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
      let mimeType: string | null = null;
      let originalFileAvailable = false;

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
          if (fileMeta) {
            filename = fileMeta.originalFilename || filename;
            mimeType = fileMeta.mimeType || null;
            originalFileAvailable = !!((fileMeta.provider === "r2" && fileMeta.objectKey) || fileMeta.publicUrl);
          }
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
          if (fileMeta) {
            filename = fileMeta.originalFilename || filename;
            mimeType = fileMeta.mimeType || null;
            originalFileAvailable = !!((fileMeta.provider === "r2" && fileMeta.objectKey) || fileMeta.publicUrl);
          }
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
          if (fileMeta) {
            filename = fileMeta.originalFilename || filename;
            mimeType = fileMeta.mimeType || null;
            originalFileAvailable = !!((fileMeta.provider === "r2" && fileMeta.objectKey) || fileMeta.publicUrl);
          }
          if (fileMeta?.extractedTextKey) {
            const fullContent = await getR2ObjectText(fileMeta.extractedTextKey);
            if (fullContent) content = fullContent;
          }
        }
      }

      if (!content && !originalFileAvailable) {
        return res.json({ found: false, message: "Source document no longer available" });
      }

      res.json({
        found: true,
        title,
        content,
        filename,
        mimeType,
        originalFileAvailable,
        viewUrl: originalFileAvailable ? `/api/case-law/${entry.id}/source/file` : null,
        sourceType: entry.sourceType,
        citation: entry.citation,
      });
    } catch (err) {
      console.error("Error fetching case law source:", err);
      res.status(500).json({ message: "Failed to fetch source document" });
    }
  });

  app.get("/api/case-law/:id/source/file", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const entry = await storage.getCaseLawById(id);
      if (!entry) return res.status(404).json({ message: "Case law entry not found" });
      if (!entry.sourceDocId || !entry.sourceType) {
        return res.status(404).json({ message: "No source document linked to this case law entry" });
      }

      let fileMeta:
        | Awaited<ReturnType<typeof storage.getAdminKnowledgeFile>>
        | Awaited<ReturnType<typeof storage.getStatuteDocumentFile>>
        | Awaited<ReturnType<typeof storage.getDocumentFile>>
        | undefined;

      if (entry.sourceType === "admin") {
        fileMeta = await storage.getAdminKnowledgeFile(entry.sourceDocId);
      } else if (entry.sourceType === "statute") {
        fileMeta = await storage.getStatuteDocumentFile(entry.sourceDocId);
      } else if (entry.sourceType === "user") {
        const userDoc = await storage.getDocumentById(entry.sourceDocId, userId);
        if (!userDoc) return res.status(404).json({ message: "Source document not found" });
        fileMeta = await storage.getDocumentFile(userDoc.id, userId);
      } else {
        return res.status(404).json({ message: "Original file is not available for this source type" });
      }

      if (!fileMeta) return res.status(404).json({ message: "File not found" });

      if (fileMeta.provider === "r2" && fileMeta.objectKey) {
        const binary = await getR2ObjectBinary(fileMeta.objectKey);
        if (!binary) return res.status(404).json({ message: "File not found" });
        const contentType = binary.contentType || fileMeta.mimeType || "application/octet-stream";
        const safeFilename = (fileMeta.originalFilename || `case-law-source-${id}`).replace(/[^a-zA-Z0-9._-]+/g, "_");
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
      console.error("Error fetching case law source file:", err);
      res.status(500).json({ message: "Failed to fetch source file" });
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
      const journalCodeRaw = String(req.query.journal || "").trim();
      const normalizedJournalQuery = normalizeCitationToken(journalCodeRaw);
      const page = Number(req.query.page);
      const court = String(req.query.court || "").trim();
      const currentYear = new Date().getFullYear();
      const isAllJournals =
        !journalCodeRaw
        || journalCodeRaw.toLowerCase() === "all"
        || normalizedJournalQuery === "ALL";

      if (!Number.isInteger(year) || year < 1947 || year > currentYear + 1) {
        return res.status(400).json({ message: `Year must be between 1947 and ${currentYear + 1}` });
      }
      if (!Number.isInteger(page) || page < 1) {
        return res.status(400).json({ message: "Page must be a positive integer" });
      }

      if (!isAllJournals) {
        const journals = await storage.getLawJournals();
        const journalsByNormalizedCode = new Map(
          journals.map((j) => [normalizeCitationToken(j.code), j.code]),
        );
        const resolvedJournalCode = journalsByNormalizedCode.get(normalizedJournalQuery);
        if (!resolvedJournalCode) {
          return res.status(400).json({ message: `Unknown journal code: ${journalCodeRaw}` });
        }
        const matches = await storage.searchJudgmentsByCitation({
          year,
          journalCode: resolvedJournalCode,
          page,
          court: court || undefined,
        });
        return res.json(matches);
      }

      const matches = await storage.searchJudgmentsByCitation({
        year,
        journalCode: undefined,
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

  // Lookup statute by name or section - returns statute ID for direct opening
  app.get("/api/statute/lookup", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      if (!q) {
        return res.status(400).json({ message: "Query required" });
      }

      // Search by shortTitle (name) or section
      // Try exact/partial ilike match first
      let results = (await db.select().from(statutes).where(
        or(
          ilike(statutes.shortTitle, `%${q}%`),
          ilike(statutes.section, `%${q}%`),
          ilike(statutes.description, `%${q}%`),
        ),
      ).limit(1))[0] ?? null;

      // Fallback: try each token individually (handles "Code of Civil Procedure, 1908")
      if (!results) {
        const tokens = q.split(/[\s,]+/).filter((t: string) => t.length > 2);
        for (const token of tokens) {
          results = (await db.select().from(statutes).where(
            or(
              ilike(statutes.shortTitle, `%${token}%`),
              ilike(statutes.description, `%${token}%`),
            ),
          ).limit(1))[0] ?? null;
          if (results) break;
        }
      }

      if (results) {
        return res.json({ found: true, id: results.id, statute: results });
      }

      res.json({ found: false });
    } catch (err) {
      console.error("Error looking up statute:", err);
      res.status(500).json({ message: "Failed to lookup statute" });
    }
  });

  // Lookup case law / judgment by citation - returns judgment ID for direct opening
  app.get("/api/caseLaw/lookup", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      if (!q) {
        return res.status(400).json({ message: "Query required" });
      }

      // STEP 1: Parsed-parts match (year + report code + page).
      // Card-displayed citations include the expanded court name
      // (e.g. "PLD 2023 Supreme Court 362"). The default parser tries a
      // year-first regex that matches "Supreme Court" as the report token,
      // producing an invalid journal code. Strip court-name words first so
      // the parser sees "PLD 2023 362" and extracts {report:PLD, year, page}.
      const courtStripped = q
        // Period-style first (regex word boundaries don't fire correctly on "S.C." trailing dot)
        .replace(/\bS\.\s*C\.?/gi, " ")
        .replace(/\bF\.\s*S\.\s*C\.?/gi, " ")
        // Full-word court names
        .replace(
          /\b(Supreme\s+Court|Lahore|Peshawar|Karachi|Sindh|Islamabad|Balochistan|Federal\s+Shariat(?:\s+Court)?|FSC|AJK|SC)\b/gi,
          " ",
        )
        // Collapse stray punctuation between digits (e.g. "1998 . 1512")
        .replace(/(\d)\s*\.\s*(\d)/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim();

      const parsed = parseCaseLawCitationQuery(courtStripped) || parseCaseLawCitationQuery(q);
      if (parsed && isTrustedCaseLawCitationParts(parsed)) {
        const byParts = await storage.searchJudgmentsByCitation({
          year: parsed.year,
          journalCode: parsed.report,
          page: parsed.page,
        }).catch(() => []);
        if (byParts.length > 0) {
          const r = byParts[0];
          return res.json({
            found: true,
            id: r.id,
            judgment: {
              citation: r.citation,
              title: r.title,
              court: r.court,
              decisionDate: r.decisionDate,
            },
          });
        }
      }

      // STEP 2: Fallback — substring LIKE on citation string or title.
      // Handles non-standard citation formats and title-only searches.
      const [result] = await db
        .select({
          id: judgments.id,
          citationString: judgments.citationString,
          title: judgments.title,
          court: courtsRef.name,
          decisionDate: judgments.decisionDate,
        })
        .from(judgments)
        .leftJoin(courtsRef, eq(judgments.courtId, courtsRef.id))
        .where(
          or(
            like(judgments.citationString, `%${q}%`),
            like(judgments.title, `%${q}%`),
          ),
        )
        .limit(1);

      if (result) {
        return res.json({
          found: true,
          id: result.id,
          judgment: {
            citation: result.citationString,
            title: result.title,
            court: result.court,
            decisionDate: result.decisionDate,
          },
        });
      }

      res.json({ found: false });
    } catch (err) {
      console.error("Error looking up case law:", err);
      res.status(500).json({ message: "Failed to lookup case law" });
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
      const normalizedRequestedJournal = normalizeCitationToken(parsed.journalCode);
      const journal = journals.find(
        (j) => normalizeCitationToken(j.code) === normalizedRequestedJournal,
      );
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
      const profile = await storage.getUserProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      const tier = normalizeTier(profile.subscriptionTier);
      const subscriptionCycle = normalizeBillingCycle(profile.subscriptionCycle);
      const limits = getTierPlan(tier);
      const used = await storage.getMonthlyUsageCount(userId);
      const remaining = Math.max(0, limits.monthlyQueries - used);
      const percentage = Math.min(100, Math.round((used / limits.monthlyQueries) * 100));

      res.json({
        tier,
        tierLabel: limits.label,
        tierDescription: limits.description,
        subscriptionCycle,
        subscriptionStartAt: profile.subscriptionStartAt ? profile.subscriptionStartAt.toISOString() : null,
        subscriptionEndAt: profile.subscriptionEndAt ? profile.subscriptionEndAt.toISOString() : null,
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

  app.get("/api/activity/summary", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      // Get latest thread (last activity)
      const userThreads = await storage.getThreads(userId);
      const latestThread = userThreads?.[0];

      // Get recent documents
      const allDocuments = await db.select().from(documents)
        .where(eq(documents.userId, userId))
        .orderBy(desc(documents.createdAt))
        .limit(5);

      // Get document count
      const docCountResult = await db.select({ count: count() }).from(documents)
        .where(eq(documents.userId, userId));
      const documentCount = docCountResult?.[0]?.count || 0;

      // Prepare workspace focus suggestions based on activity
      const suggestions: string[] = [];

      if (documentCount === 0) {
        suggestions.push("Attach core case documents to strengthen AI analysis.");
      } else {
        suggestions.push("Your documents are loaded. Ready for research and drafting.");
      }

      if (latestThread) {
        suggestions.push("Review recent consultation thread for context continuity.");
      } else {
        suggestions.push("Start a new consultation with Al Wakeelo for legal guidance.");
      }

      if (allDocuments.length === 0) {
        suggestions.push("Upload judgment PDFs or legal documents to enhance responses.");
      } else {
        suggestions.push("Current documents available for reference in drafting.");
      }

      const lastActivityDate = latestThread?.updatedAt
        ? new Date(latestThread.updatedAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })
        : null;
      const lastActivityTime = latestThread?.updatedAt
        ? new Date(latestThread.updatedAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })
        : null;

      res.json({
        lastActivity: {
          threadId: latestThread?.id,
          threadTitle: latestThread?.title,
          updatedAt: latestThread?.updatedAt ? new Date(latestThread.updatedAt).toISOString() : null,
          displayDate: lastActivityDate,
          displayTime: lastActivityTime,
        },
        recentDocuments: allDocuments.map((doc: typeof allDocuments[number]) => ({
          id: doc.id,
          title: doc.title,
          createdAt: doc.createdAt?.toISOString(),
        })),
        documentCount,
        workspaceFocus: suggestions,
      });
    } catch (err) {
      console.error("Error fetching activity summary:", err);
      res.status(500).json({ message: "Failed to fetch activity summary" });
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
      const canUseAiFallback = isDeepSeekAvailable(); // UPDATED: Changed from isGroqAvailable (Groq deprecated 2026-04-16)

      if (shouldAiFallback && canUseAiFallback) {
        const allowed = await checkUsageLimit(userId, "contract-drafting", res);
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

  const retrievalAttachmentUpload = multer({
    storage: createUploadStorage("general"),
    limits: {
      fileSize: GENERAL_UPLOAD_MAX_FILE_SIZE_BYTES,
      files: 5,
    },
  });

  type LegalDraftingDocType =
    | "civil-suit-plaint"
    | "civil-misc-application"
    | "criminal-misc-application"
    | "temporary-injunction-application"
    | "execution-application"
    | "sessions-bail-application"
    | "sessions-pre-arrest-bail"
    | "sessions-criminal-appeal"
    | "sessions-criminal-revision"
    | "family-suit-petition"
    | "high-court-writ-petition"
    | "high-court-civil-appeal"
    | "high-court-criminal-appeal"
    | "high-court-criminal-revision"
    | "high-court-bail-before-arrest"
    | "supreme-court-cpla"
    | "supreme-court-criminal-petition";

  const LEGAL_DRAFTING_DOC_TYPES: Record<
    LegalDraftingDocType,
    { label: string; checklist: string; skeleton: string }
  > = {
    "civil-suit-plaint": {
      label: "Civil Suit (Plaint)",
      checklist:
        "- Cause title and parties\n- Jurisdiction and valuation\n- Material facts and cause of action\n- Relief/prayer with court fee statement\n- Verification",
      skeleton:
        "IN THE COURT OF ______\nCivil Suit No. ____ of ____\n\nPlaintiff: ____\nVersus\nDefendant: ____\n\nSUIT FOR ____\n\nFacts:\n1. ...\n2. ...\n\nJurisdiction:\n...\n\nPrayer:\na) ...\nb) ...\n\nVerification:\n...",
    },
    "civil-misc-application": {
      label: "Civil Misc. Application",
      checklist:
        "- Main case reference\n- Statutory provision invoked\n- Urgency/interim grounds\n- Specific interim prayer",
      skeleton:
        "IN THE COURT OF ______\nCMA No. ____ of ____ in Civil Suit/Appeal No. ____\n\nApplicant: ____\nVersus\nRespondent: ____\n\nAPPLICATION UNDER SECTION ____ / ORDER ____ CPC\n\nGrounds:\n1. ...\n2. ...\n\nPrayer:\n...",
    },
    "criminal-misc-application": {
      label: "Criminal Misc. Application",
      checklist:
        "- Proper forum/caption (Justice of Peace / Ex-Officio Justice of Peace where FIR registration is sought)\n- Correct respondent block (State through SHO and proposed accused, where applicable)\n- Cr.P.C. section(s) invoked with clear jurisdictional basis (22-A, 22-B, 154 Cr.P.C. when applicable)\n- Chronological facts including complaint/refusal details\n- Specific prayer for registration/investigation or other criminal relief sought\n- Verification and annexures",
      skeleton:
        "IN THE COURT OF THE JUSTICE OF PEACE / EX-OFFICIO JUSTICE OF PEACE, DISTRICT ______\nAT ______\n\nCRIMINAL MISCELLANEOUS APPLICATION NO. ____ OF ____\n\nIN RE:\n[APPLICANT/COMPLAINANT NAME], [parentage], resident of [address]\n... APPLICANT/COMPLAINANT\n\nVERSUS\n\n1. THE STATE THROUGH SHO, POLICE STATION ______\n2. [PROPOSED ACCUSED NAME], [parentage], resident of [address]\n... RESPONDENTS\n\nAPPLICATION UNDER SECTIONS 22-A & 22-B Cr.P.C. READ WITH SECTION 154 Cr.P.C. FOR REGISTRATION OF FIR\n\nRESPECTFULLY SHEWETH:\n\nBRIEF FACTS\n1. ...\n2. ...\n3. ...\n\nGROUNDS\nA. ...\nB. ...\nC. ...\n\nPRAYER\nIn view of the above, it is respectfully prayed that this Honourable Court may kindly:\na. Direct registration of FIR on applicant's complaint in accordance with law.\nb. Direct fair and lawful investigation by the police.\nc. Grant any other relief deemed just and proper.\n\nVERIFICATION\nVerified on oath at ______ on this ___ day of ______ 20__ that contents of this application are true and correct to the best of my knowledge and belief.\n\nAPPLICANT/COMPLAINANT\nTHROUGH COUNSEL\n\nPLACE: ______\nDATE: ______\n\nANNEXURES\nA. Copy of complaint to SHO\nB. Supporting documents",
    },
    "temporary-injunction-application": {
      label: "Temporary Injunction Application",
      checklist:
        "- Main suit reference\n- Prima facie case, balance of convenience, irreparable loss\n- Specific restraint sought with property/subject details\n- Prayer for ad-interim relief",
      skeleton:
        "IN THE COURT OF ______\nCMA No. ____ of ____ in Civil Suit No. ____\n\nApplicant/Plaintiff: ____\nVersus\nRespondent/Defendant: ____\n\nAPPLICATION UNDER ORDER XXXIX RULES 1 & 2 CPC\n\nFacts:\n1. ...\n\nGrounds:\n1. Prima facie case ...\n2. Balance of convenience ...\n3. Irreparable loss ...\n\nPrayer:\n...",
    },
    "execution-application": {
      label: "Execution Application",
      checklist:
        "- Decree/judgment details with date\n- Executing court jurisdiction\n- Mode of execution sought\n- Amount/property particulars",
      skeleton:
        "IN THE COURT OF ______\nExecution Application No. ____ of ____\n\nDecree Holder: ____\nVersus\nJudgment Debtor: ____\n\nAPPLICATION FOR EXECUTION OF DECREE UNDER ORDER XXI CPC\n\nDecree details:\n...\n\nAmount/Relief due:\n...\n\nMode of execution sought:\n...\n\nPrayer:\n...",
    },
    "sessions-bail-application": {
      label: "Sessions Court Bail Application",
      checklist:
        "- FIR details, offences, police station\n- Bail grounds (further inquiry, delay, etc.)\n- Undertaking to join trial\n- Prayer under correct Cr.P.C section",
      skeleton:
        "IN THE COURT OF THE SESSIONS JUDGE ______\nBail Application No. ____ of ____\n\nApplicant/Accused: ____\nVersus\nThe State\n\nAPPLICATION FOR BAIL UNDER SECTION ____ Cr.P.C.\n\nFIR details:\n...\n\nGrounds:\n1. ...\n2. ...\n\nPrayer:\n...",
    },
    "sessions-pre-arrest-bail": {
      label: "Sessions Pre-Arrest Bail",
      checklist:
        "- FIR details and accusation summary\n- Mala fide/ulterior motive grounds\n- Apprehension of arrest and cooperation undertaking\n- Prayer under Section 498 Cr.P.C.",
      skeleton:
        "IN THE COURT OF THE SESSIONS JUDGE ______\nPre-Arrest Bail Application No. ____ of ____\n\nApplicant/Accused: ____\nVersus\nThe State\n\nAPPLICATION FOR PRE-ARREST BAIL UNDER SECTION 498 Cr.P.C.\n\nFIR details:\n...\n\nGrounds:\n1. ...\n2. ...\n\nPrayer:\n...",
    },
    "sessions-criminal-appeal": {
      label: "Sessions Criminal Appeal",
      checklist:
        "- Impugned conviction/order details\n- Limitation and maintainability\n- Concise grounds of challenge\n- Clear relief (acquittal/reduction/remand)",
      skeleton:
        "IN THE COURT OF THE SESSIONS JUDGE ______\nCriminal Appeal No. ____ of ____\n\nAppellant: ____\nVersus\nThe State / Respondent: ____\n\nMEMORANDUM OF CRIMINAL APPEAL\n\nImpugned judgment/order:\n...\n\nGrounds:\n1. ...\n2. ...\n\nPrayer:\n...",
    },
    "sessions-criminal-revision": {
      label: "Sessions Criminal Revision",
      checklist:
        "- Challenged order and forum details\n- Jurisdictional/legal defects in order\n- Brief facts and prejudice caused\n- Prayer for setting aside/modification",
      skeleton:
        "IN THE COURT OF THE SESSIONS JUDGE ______\nCriminal Revision No. ____ of ____\n\nPetitioner: ____\nVersus\nRespondent: ____\n\nCRIMINAL REVISION PETITION UNDER Cr.P.C.\n\nImpugned order:\n...\n\nGrounds:\n1. ...\n2. ...\n\nPrayer:\n...",
    },
    "family-suit-petition": {
      label: "Family Suit / Petition",
      checklist:
        "- Relationship and family court jurisdiction\n- Cause of action with dates/events\n- Relief specifics (maintenance, custody, dissolution, etc.)\n- Prayer and verification",
      skeleton:
        "IN THE FAMILY COURT AT ______\nFamily Suit/Petition No. ____ of ____\n\nPlaintiff/Petitioner: ____\nVersus\nDefendant/Respondent: ____\n\nSUIT/PETITION FOR ______\n\nFacts:\n1. ...\n2. ...\n\nJurisdiction:\n...\n\nPrayer:\n...\n\nVerification:\n...",
    },
    "high-court-writ-petition": {
      label: "High Court Writ Petition",
      checklist:
        "- Article 199 jurisdiction\n- Impugned order/action details\n- Grounds: without lawful authority/no legal effect\n- Maintainability and alternate remedy stance\n- Prayer with interim relief if needed",
      skeleton:
        "IN THE HIGH COURT OF ______\nConstitutional Petition No. ____ of ____\n\nPetitioner: ____\nVersus\nRespondents: ____\n\nPETITION UNDER ARTICLE 199 OF THE CONSTITUTION\n\nFacts:\n...\n\nGrounds:\n...\n\nPrayer:\n...",
    },
    "high-court-civil-appeal": {
      label: "High Court Civil Appeal",
      checklist:
        "- Impugned judgment/decree details\n- Limitation statement\n- Numbered grounds of appeal\n- Clear relief sought",
      skeleton:
        "IN THE HIGH COURT OF ______\nCivil Appeal No. ____ of ____\n\nAppellant: ____\nVersus\nRespondent: ____\n\nMEMORANDUM OF CIVIL APPEAL\n\nImpugned judgment:\n...\n\nGrounds of appeal:\n1. ...\n2. ...\n\nPrayer:\n...",
    },
    "high-court-criminal-appeal": {
      label: "High Court Criminal Appeal",
      checklist:
        "- Trial court conviction/order details\n- Limitation and custody/sentence status\n- Concise legal and factual grounds\n- Prayer for acquittal/modification/suspension",
      skeleton:
        "IN THE HIGH COURT OF ______\nCriminal Appeal No. ____ of ____\n\nAppellant: ____\nVersus\nThe State / Respondent: ____\n\nMEMORANDUM OF CRIMINAL APPEAL\n\nImpugned judgment:\n...\n\nGrounds:\n1. ...\n2. ...\n\nPrayer:\n...",
    },
    "high-court-criminal-revision": {
      label: "High Court Criminal Revision",
      checklist:
        "- Impugned order details\n- Revisional jurisdiction basis\n- Jurisdictional/legal errors and miscarriage of justice\n- Prayer for setting aside/modification",
      skeleton:
        "IN THE HIGH COURT OF ______\nCriminal Revision No. ____ of ____\n\nPetitioner: ____\nVersus\nRespondent: ____\n\nCRIMINAL REVISION PETITION\n\nImpugned order:\n...\n\nGrounds:\n1. ...\n2. ...\n\nPrayer:\n...",
    },
    "high-court-bail-before-arrest": {
      label: "High Court Bail Before Arrest",
      checklist:
        "- FIR details and accusations\n- Grounds of mala fide / abuse of process\n- Prior proceedings (if any)\n- Prayer under Section 498 Cr.P.C.",
      skeleton:
        "IN THE HIGH COURT OF ______\nCriminal Bail Before Arrest No. ____ of ____\n\nPetitioner/Accused: ____\nVersus\nThe State\n\nPETITION FOR BAIL BEFORE ARREST UNDER SECTION 498 Cr.P.C.\n\nFIR details:\n...\n\nGrounds:\n1. ...\n2. ...\n\nPrayer:\n...",
    },
    "supreme-court-cpla": {
      label: "Supreme Court CPLA",
      checklist:
        "- Jurisdictional basis and maintainability\n- Questions of law/public importance\n- Concise but strong grounds\n- Prayer for leave and interim relief (if any)",
      skeleton:
        "IN THE SUPREME COURT OF PAKISTAN\nCivil Petition for Leave to Appeal No. ____ of ____\n\nPetitioner: ____\nVersus\nRespondent: ____\n\nPETITION FOR LEAVE TO APPEAL\n\nQuestions of law:\n1. ...\n2. ...\n\nGrounds:\n...\n\nPrayer:\n...",
    },
    "supreme-court-criminal-petition": {
      label: "Supreme Court Criminal Petition for Leave to Appeal",
      checklist:
        "- Impugned High Court order/judgment details\n- Questions of law/public importance in criminal context\n- Concise grounds for leave\n- Prayer for grant of leave and interim relief (if needed)",
      skeleton:
        "IN THE SUPREME COURT OF PAKISTAN\nCriminal Petition for Leave to Appeal No. ____ of ____\n\nPetitioner: ____\nVersus\nRespondent: ____\n\nCRIMINAL PETITION FOR LEAVE TO APPEAL\n\nImpugned judgment/order:\n...\n\nQuestions of law:\n1. ...\n2. ...\n\nGrounds:\n...\n\nPrayer:\n...",
    },
  };

  const LEGAL_DRAFTING_HEADING_ORDER: Record<LegalDraftingDocType, string[]> = {
    "civil-suit-plaint": [
      "Cause Title (Court, Parties, Suit Title)",
      "Facts Constituting Cause of Action (chronological, numbered)",
      "Jurisdiction",
      "Valuation and Court Fee",
      "Limitation (if relevant)",
      "Prayer",
      "Verification",
      "Annexures/List of Documents (if applicable)",
    ],
    "civil-misc-application": [
      "Cause Title and Main Case Reference",
      "Application Title (under correct section/order)",
      "Brief Background Facts",
      "Grounds",
      "Urgency/Interim Necessity (if any)",
      "Prayer",
      "Verification",
    ],
    "criminal-misc-application": [
      "Cause Title (Forum + Parties + FIR/Case Reference)",
      "Application Title under Relevant Cr.P.C. Provision (22-A, 22-B, 154 where applicable)",
      "BRIEF FACTS (chronological, numbered)",
      "GROUNDS (alphabetical/legal)",
      "Relief Sought from Justice of Peace / Criminal Court",
      "Prayer",
      "Verification/Affidavit and Annexures",
    ],
    "temporary-injunction-application": [
      "Cause Title and Main Suit Reference",
      "Application under Order XXXIX Rules 1 & 2 CPC",
      "Brief Facts",
      "Prima Facie Case",
      "Balance of Convenience",
      "Irreparable Loss",
      "Interim + Final Prayer",
      "Verification",
    ],
    "execution-application": [
      "Cause Title (Decree Holder vs Judgment Debtor)",
      "Decree Details (date, case no., court)",
      "Amount/Relief Outstanding",
      "Mode of Execution Sought",
      "Property/Asset Particulars (if any)",
      "Prayer",
      "Verification",
    ],
    "sessions-bail-application": [
      "Cause Title and Bail Provision Invoked",
      "FIR Details (No., Date, Police Station, Sections)",
      "Accused Role and Brief Facts",
      "Grounds for Bail (numbered)",
      "Undertaking to Join Trial / Surety Readiness",
      "Prayer",
      "Verification",
    ],
    "sessions-pre-arrest-bail": [
      "Cause Title and Section 498 Cr.P.C. Invocation",
      "FIR Details",
      "Apprehension of Arrest",
      "Mala Fide / False Implication Grounds",
      "Cooperation and Undertaking",
      "Prayer",
      "Verification",
    ],
    "sessions-criminal-appeal": [
      "Cause Title and Appeal Title",
      "Impugned Judgment/Order Details",
      "Limitation and Maintainability",
      "Concise Numbered Grounds",
      "Prayer",
      "Verification",
    ],
    "sessions-criminal-revision": [
      "Cause Title and Revision Title",
      "Impugned Order Details",
      "Revisional Jurisdiction Basis",
      "Concise Numbered Grounds",
      "Prayer",
      "Verification",
    ],
    "family-suit-petition": [
      "Cause Title (Family Court)",
      "Parties and Relationship Background",
      "Material Facts in Chronology",
      "Jurisdiction and Maintainability",
      "Relief Claimed",
      "Prayer",
      "Verification",
    ],
    "high-court-writ-petition": [
      "Cause Title (Constitutional Petition under Article 199)",
      "Parties and Jurisdiction",
      "Brief Facts in Chronology",
      "Maintainability and Alternate Remedy Position",
      "Grounds (without lawful authority / no legal effect, etc.)",
      "Interim Relief (if required)",
      "Main Prayer and Any Other Relief",
      "Verification",
    ],
    "high-court-civil-appeal": [
      "Cause Title and Memorandum of Civil Appeal",
      "Impugned Judgment/Decree Details",
      "Limitation Statement",
      "Brief Facts",
      "Grounds of Appeal (concise, numbered, non-argumentative)",
      "Prayer",
      "Verification",
      "Annexures/Certified Copy Reference",
    ],
    "high-court-criminal-appeal": [
      "Cause Title and Criminal Appeal Heading",
      "Impugned Conviction/Order Details",
      "Sentence/Custody Status",
      "Concise Numbered Grounds",
      "Prayer",
      "Verification",
      "Annexures",
    ],
    "high-court-criminal-revision": [
      "Cause Title and Criminal Revision Heading",
      "Impugned Order Details",
      "Revisional Jurisdiction Basis",
      "Concise Numbered Grounds",
      "Prayer",
      "Verification",
      "Annexures",
    ],
    "high-court-bail-before-arrest": [
      "Cause Title and Section 498 Cr.P.C. Invocation",
      "FIR Details",
      "Mala Fide/False Implication Grounds",
      "Urgency + Apprehension of Arrest",
      "Prayer",
      "Verification",
    ],
    "supreme-court-cpla": [
      "Cause Title (Supreme Court of Pakistan)",
      "Civil Petition for Leave to Appeal (CPLA)",
      "Impugned Judgment/Order Details",
      "Questions of Law of Public Importance",
      "Grounds (concise, numbered)",
      "Prayer for Grant of Leave (and interim relief if needed)",
      "Verification/Affidavit Placeholder",
      "Annexures/List of Filed Documents",
    ],
    "supreme-court-criminal-petition": [
      "Cause Title (Supreme Court of Pakistan)",
      "Criminal Petition for Leave to Appeal",
      "Impugned Judgment/Order Details",
      "Questions of Law / Public Importance",
      "Grounds (concise, numbered)",
      "Prayer for Leave (and interim relief if needed)",
      "Verification/Affidavit Placeholder",
      "Annexures/List of Filed Documents",
    ],
  };

  type LegalDraftTypeRule = {
    forumHeading: string;
    filingCaption: string;
    requiredInHeader: Array<{ regex: RegExp; label: string }>;
  };

  const LEGAL_DRAFTING_TYPE_RULES: Record<LegalDraftingDocType, LegalDraftTypeRule> = {
    "civil-suit-plaint": {
      forumHeading: "IN THE COURT OF [CIVIL COURT/JUDGE] AT [CITY]",
      filingCaption: "CIVIL SUIT NO. ____ OF ____ / SUIT FOR ____",
      requiredInHeader: [
        { regex: /IN THE COURT OF/i, label: "Civil Court heading" },
        { regex: /CIVIL SUIT/i, label: "Civil Suit caption" },
      ],
    },
    "civil-misc-application": {
      forumHeading: "IN THE COURT OF [CIVIL COURT/JUDGE] AT [CITY]",
      filingCaption: "CIVIL MISC. APPLICATION / CMA",
      requiredInHeader: [
        { regex: /IN THE COURT OF/i, label: "Civil Court heading" },
        { regex: /(CIVIL\s+MISC|CMA)/i, label: "Civil Misc. caption" },
        { regex: /APPLICATION UNDER/i, label: "Application title" },
      ],
    },
    "criminal-misc-application": {
      forumHeading: "IN THE COURT OF THE JUSTICE OF PEACE / EX-OFFICIO JUSTICE OF PEACE AT [CITY]",
      filingCaption: "CRIMINAL MISCELLANEOUS APPLICATION UNDER RELEVANT Cr.P.C. PROVISION",
      requiredInHeader: [
        { regex: /(JUSTICE OF PEACE|SESSIONS JUDGE|MAGISTRATE)/i, label: "Criminal forum heading" },
        { regex: /CRIMINAL\s+MISC/i, label: "Criminal Misc. caption" },
        { regex: /APPLICATION UNDER/i, label: "Application title" },
      ],
    },
    "temporary-injunction-application": {
      forumHeading: "IN THE COURT OF [CIVIL COURT/JUDGE] AT [CITY]",
      filingCaption: "APPLICATION UNDER ORDER XXXIX RULES 1 & 2 CPC",
      requiredInHeader: [
        { regex: /IN THE COURT OF/i, label: "Civil Court heading" },
        { regex: /(ORDER\s*XXXIX|TEMPORARY\s+INJUNCTION)/i, label: "Injunction caption" },
      ],
    },
    "execution-application": {
      forumHeading: "IN THE COURT OF [CIVIL COURT/JUDGE] AT [CITY]",
      filingCaption: "EXECUTION APPLICATION UNDER ORDER XXI CPC",
      requiredInHeader: [
        { regex: /IN THE COURT OF/i, label: "Civil Court heading" },
        { regex: /(EXECUTION\s+APPLICATION|ORDER\s*XXI)/i, label: "Execution caption" },
      ],
    },
    "sessions-bail-application": {
      forumHeading: "IN THE COURT OF THE SESSIONS JUDGE AT [CITY]",
      filingCaption: "APPLICATION FOR POST-ARREST BAIL UNDER SECTION 497 Cr.P.C.",
      requiredInHeader: [
        { regex: /SESSIONS JUDGE/i, label: "Sessions Court heading" },
        { regex: /(BAIL APPLICATION|APPLICATION FOR BAIL)/i, label: "Bail caption" },
      ],
    },
    "sessions-pre-arrest-bail": {
      forumHeading: "IN THE COURT OF THE SESSIONS JUDGE AT [CITY]",
      filingCaption: "APPLICATION FOR PRE-ARREST BAIL UNDER SECTION 498 Cr.P.C.",
      requiredInHeader: [
        { regex: /SESSIONS JUDGE/i, label: "Sessions Court heading" },
        { regex: /(PRE-ARREST|BEFORE ARREST)/i, label: "Pre-arrest caption" },
        { regex: /498\s*Cr\.?P\.?C/i, label: "Section 498 Cr.P.C reference" },
      ],
    },
    "sessions-criminal-appeal": {
      forumHeading: "IN THE COURT OF THE SESSIONS JUDGE AT [CITY]",
      filingCaption: "CRIMINAL APPEAL NO. ____ OF ____",
      requiredInHeader: [
        { regex: /SESSIONS JUDGE/i, label: "Sessions Court heading" },
        { regex: /CRIMINAL APPEAL/i, label: "Criminal Appeal caption" },
      ],
    },
    "sessions-criminal-revision": {
      forumHeading: "IN THE COURT OF THE SESSIONS JUDGE AT [CITY]",
      filingCaption: "CRIMINAL REVISION NO. ____ OF ____",
      requiredInHeader: [
        { regex: /SESSIONS JUDGE/i, label: "Sessions Court heading" },
        { regex: /CRIMINAL REVISION/i, label: "Criminal Revision caption" },
      ],
    },
    "family-suit-petition": {
      forumHeading: "IN THE FAMILY COURT AT [CITY]",
      filingCaption: "FAMILY SUIT / FAMILY PETITION",
      requiredInHeader: [
        { regex: /FAMILY COURT/i, label: "Family Court heading" },
        { regex: /(FAMILY\s+SUIT|FAMILY\s+PETITION|SUIT\/PETITION)/i, label: "Family caption" },
      ],
    },
    "high-court-writ-petition": {
      forumHeading: "IN THE HONOURABLE [NAME] HIGH COURT AT [CITY]",
      filingCaption: "CONSTITUTIONAL PETITION UNDER ARTICLE 199",
      requiredInHeader: [
        { regex: /HIGH COURT/i, label: "High Court heading" },
        { regex: /(ARTICLE\s*199|CONSTITUTIONAL PETITION)/i, label: "Article 199/Writ caption" },
      ],
    },
    "high-court-civil-appeal": {
      forumHeading: "IN THE HONOURABLE [NAME] HIGH COURT AT [CITY]",
      filingCaption: "CIVIL APPEAL NO. ____ OF ____",
      requiredInHeader: [
        { regex: /HIGH COURT/i, label: "High Court heading" },
        { regex: /CIVIL APPEAL/i, label: "Civil Appeal caption" },
      ],
    },
    "high-court-criminal-appeal": {
      forumHeading: "IN THE HONOURABLE [NAME] HIGH COURT AT [CITY]",
      filingCaption: "CRIMINAL APPEAL NO. ____ OF ____",
      requiredInHeader: [
        { regex: /HIGH COURT/i, label: "High Court heading" },
        { regex: /CRIMINAL APPEAL/i, label: "Criminal Appeal caption" },
      ],
    },
    "high-court-criminal-revision": {
      forumHeading: "IN THE HONOURABLE [NAME] HIGH COURT AT [CITY]",
      filingCaption: "CRIMINAL REVISION NO. ____ OF ____",
      requiredInHeader: [
        { regex: /HIGH COURT/i, label: "High Court heading" },
        { regex: /CRIMINAL REVISION/i, label: "Criminal Revision caption" },
      ],
    },
    "high-court-bail-before-arrest": {
      forumHeading: "IN THE HONOURABLE [NAME] HIGH COURT AT [CITY]",
      filingCaption: "CRIMINAL BAIL BEFORE ARREST UNDER SECTION 498 Cr.P.C.",
      requiredInHeader: [
        { regex: /HIGH COURT/i, label: "High Court heading" },
        { regex: /(BAIL BEFORE ARREST|PRE-ARREST BAIL)/i, label: "Bail Before Arrest caption" },
        { regex: /498\s*Cr\.?P\.?C/i, label: "Section 498 Cr.P.C reference" },
      ],
    },
    "supreme-court-cpla": {
      forumHeading: "IN THE SUPREME COURT OF PAKISTAN",
      filingCaption: "CIVIL PETITION FOR LEAVE TO APPEAL (CPLA)",
      requiredInHeader: [
        { regex: /SUPREME COURT OF PAKISTAN/i, label: "Supreme Court heading" },
        { regex: /(CPLA|CIVIL PETITION FOR LEAVE TO APPEAL)/i, label: "CPLA caption" },
      ],
    },
    "supreme-court-criminal-petition": {
      forumHeading: "IN THE SUPREME COURT OF PAKISTAN",
      filingCaption: "CRIMINAL PETITION FOR LEAVE TO APPEAL",
      requiredInHeader: [
        { regex: /SUPREME COURT OF PAKISTAN/i, label: "Supreme Court heading" },
        { regex: /CRIMINAL PETITION FOR LEAVE TO APPEAL/i, label: "Criminal Petition caption" },
      ],
    },
  };

  function buildStrictTypeLockInstruction(docType: LegalDraftingDocType, label: string): string {
    const rule = LEGAL_DRAFTING_TYPE_RULES[docType];
    const headings = LEGAL_DRAFTING_HEADING_ORDER[docType] || [];
    const headingOrder = headings.length
      ? headings.map((item, index) => `${index + 1}. ${item}`).join("\n")
      : "1. Cause title\n2. Facts\n3. Grounds\n4. Prayer\n5. Verification";
    return `Selected filing type lock (non-negotiable):
- You are drafting ONLY: ${label}
- Keep forum/court heading strictly aligned to: ${rule.forumHeading}
- Keep filing caption/title strictly aligned to: ${rule.filingCaption}
- Do not switch to any other court/forum or filing category.
- If user facts are incomplete, use placeholders [______] but keep this filing type unchanged.

Mandatory section flow (in this order):
${headingOrder}`;
  }

  function validateDraftForSelectedType(content: string, docType: LegalDraftingDocType): { ok: boolean; issues: string[] } {
    const text = normalizeCourtReadyDraftingText(content || "");
    const headerBlock = text.split("\n").slice(0, 40).join("\n");
    const issues: string[] = [];
    const rule = LEGAL_DRAFTING_TYPE_RULES[docType];

    for (const check of rule.requiredInHeader) {
      if (!check.regex.test(headerBlock)) issues.push(`Missing or incorrect ${check.label}.`);
    }

    if (!/^\s*RESPECTFULLY SHEWETH:\s*$/im.test(text)) issues.push("Missing heading: RESPECTFULLY SHEWETH:");
    if (!/^\s*PRAYER\s*$/im.test(text)) issues.push("Missing heading: PRAYER");
    if (!/^\s*VERIFICATION\s*$/im.test(text)) issues.push("Missing heading: VERIFICATION");
    if (!/^\s*VERSUS\s*$/im.test(text) && !/^\s*IN RE:\s*$/im.test(text)) {
      issues.push("Missing party separator line: VERSUS (or IN RE where appropriate).");
    }
    if (!/(^|\n)\s*1\.\s+/m.test(text)) issues.push("Facts/grounds are not in numbered court format.");

    return { ok: issues.length === 0, issues };
  }

  const PAKISTANI_JUDICIAL_FORMAT_GUIDANCE = `You are a highly skilled Pakistani litigation lawyer with extensive experience drafting pleadings before Civil Courts, Family Courts, Sessions Courts, High Courts, and the Supreme Court of Pakistan.

You must draft legal documents exactly in the professional format used by Pakistani advocates. Your drafting style must resemble real pleadings filed in Pakistani courts, particularly those used in High Courts and Sessions Courts.

Your expertise includes Pakistani procedural and substantive law including the Civil Procedure Code 1908, Criminal Procedure Code 1898, Pakistan Penal Code 1860, Negotiable Instruments Act 1881, Family Courts Act 1964, Specific Relief Act 1877, Qanun-e-Shahadat Order 1984, Limitation Act 1908, and the Constitution of Pakistan 1973.

You must also reference relevant Pakistani case law where appropriate such as PLD, SCMR, YLR, MLD, and CLD citations.

Your task is to convert the user’s facts into a court-ready legal pleading suitable for filing in Pakistani courts.

WRITING STYLE

Always use the formal legal language used by Pakistani lawyers.

Use expressions such as:

Respectfully Sheweth
It is respectfully submitted
The learned trial court gravely erred
The impugned judgment suffers from misreading and non-reading of evidence
The petitioner has no other adequate remedy except to approach this Honourable Court

Avoid casual or conversational language.

LEGAL SYSTEM HIERARCHY (MANDATORY)

You must follow Pakistani judicial forum hierarchy and select the correct forum for the filing type.

Forum mapping rules (strict):
- Constitutional Petition / Writ under Article 199: High Court only.
- Family Suit/Petition (custody, maintenance, khula, dissolution): Family Court only.
- Sessions Bail matters under Sections 497/498 Cr.P.C.: Sessions Court / High Court as legally applicable, never Family Court.
- Criminal Misc. for FIR registration under Sections 22-A/22-B Cr.P.C.: Justice of Peace / Ex-Officio Justice of Peace forum.
- CPLA / Petition for Leave to Appeal: Supreme Court of Pakistan only.

Never place a writ petition in Family Court.
Never place a Family matter in High Court/Sessions format unless explicitly a competent appellate/revisional forum is requested.

DOCUMENT FORMAT

All drafts must follow this structure.

COURT HEADING

Start with the court heading written in capital letters.

Examples:

IN THE HONOURABLE [NAME] HIGH COURT
AT [CITY]

or

IN THE COURT OF [CIVIL JUDGE / ADDITIONAL DISTRICT JUDGE / SESSIONS JUDGE]
AT [CITY]

or

IN THE SUPREME COURT OF PAKISTAN
(APPELLATE JURISDICTION)

CASE TITLE

After the heading provide the case number and parties.

Example format:

Civil Suit No ______ / 20__

[NAME]
S/o ______
Resident of ______

… PLAINTIFF / PETITIONER / APPELLANT

VERSUS

[NAME]
S/o ______
Resident of ______

… DEFENDANT / RESPONDENT

TITLE OF PETITION OR APPEAL

Clearly state the nature of proceedings.

Examples:

REGULAR FIRST APPEAL UNDER SECTION 96 OF THE CODE OF CIVIL PROCEDURE, 1908

CONSTITUTIONAL PETITION UNDER ARTICLE 199 OF THE CONSTITUTION OF ISLAMIC REPUBLIC OF PAKISTAN, 1973

APPLICATION FOR POST ARREST BAIL UNDER SECTION 497 Cr.P.C.

OPENING STATEMENT

All pleadings must begin with:

Respectfully Sheweth:

BRIEF FACTS

Provide a structured factual narrative using roman numbering.

Example structure:

BRIEF FACTS:

i.
ii.
iii.
iv.

Facts must be chronological and legally relevant.

MANDATORY LEADING PHRASE RULE

In BRIEF FACTS and GROUNDS, every individual line must begin with:

That the ...

If numbering/lettering is used, keep it before the phrase:

1. That the ...
A. That the ...

Do not prepend "That the" to caption/sub-heading lines (for example: "MAINTAINABILITY AND ALTERNATE REMEDY", "GROUNDS OF PETITION").

GROUNDS OF APPEAL OR GROUNDS

Legal grounds must be structured alphabetically.

Example structure:

GROUNDS OF APPEAL:

A. MISAPPLICATION OF LAW
B. MISREADING AND NON-READING OF EVIDENCE
C. ILLEGAL EXERCISE OF JURISDICTION
D. FAILURE TO CONSIDER MATERIAL EVIDENCE

Each ground must contain a heading, the legal principle, explanation of the error, and where appropriate reference to statute or precedent.
Each ground MUST be a detailed paragraph of 5 to 10 sentences. Under each ground, discuss the relevant legal principle, explain how the facts of the case satisfy that principle, and cite at least one verified case law authority from the INTERNAL DATABASE REFERENCES with its ratio decidendi. Short one-liner grounds are NOT acceptable — every ground must read like a mini legal argument as found in real Pakistani court filings.

CASE LAW DEPTH REQUIREMENT

Every legal draft MUST cite a minimum of 4 to 8 case law authorities from the INTERNAL DATABASE REFERENCES provided. For each cited case, include:
- The full citation (e.g. 2024 SCMR 205)
- The case title (e.g. Naveed Sattar vs The State)
- A 1-2 sentence summary of the ratio decidendi (the principle laid down)
Do NOT fabricate citations. Use ONLY citations from the INTERNAL DATABASE REFERENCES section. If insufficient references are available, use what is available and note that additional case law may be added.

DOCUMENT LENGTH

A complete court-ready legal draft must be comprehensive. Typical expected lengths:
- Bail applications: 1,500 to 3,000 words
- Writ petitions: 2,000 to 4,000 words
- Civil suits / appeals: 2,500 to 5,000 words
Do not cut short. Write the full document as a real Pakistani advocate would file it in court.

LEGAL AUTHORITIES INTEGRATION

Do not create a separate heading titled "LEGAL AUTHORITIES".

Wherever legal authorities are needed, include them within GROUNDS lines and connect each authority to the relevant legal ground.

Where relevant cite Pakistani case law such as:

PLD 2018 SC 806
2014 SCMR 1365
2024 CLD 105
2022 CLD 900

VALUATION AND COURT FEE ORDER RULE (MANDATORY)

The heading "VALUATION AND COURT FEE" must appear before the heading "PRAYER".

Keep this order strict:
- BRIEF FACTS
- GROUNDS
- VALUATION AND COURT FEE
- PRAYER
- VERIFICATION

PRAYER

Every draft must end with a prayer clause.

Example structure:

PRAYER:

In view of the above, it is most respectfully prayed that this Honourable Court may graciously be pleased to:

a. Accept the present petition or appeal.
b. Set aside the impugned judgment or order dated ______.
c. Grant the relief as prayed for.
d. Pass any other order deemed just and proper in the circumstances of the case.

INTERIM RELIEF

Where appropriate include interim relief.

Example:

INTERIM RELIEF:

Pending final decision of the present petition or appeal, it is respectfully prayed that the operation of the impugned order may kindly be suspended.

VERIFICATION

Where required include verification.

Example:

VERIFICATION:

Verified on oath at [CITY] on this ___ day of ______ that the contents of the above petition are true and correct to the best of my knowledge and belief.

PLACEHOLDERS

If the user does not provide full information use placeholders such as:

[Name of Court]
[Case Number]
[Petitioner Name]
[Respondent Name]
[FIR Number]
[Police Station]
[Date]

SUPPORTED DOCUMENT TYPES

The assistant must be able to draft the following documents according to Pakistani legal practice:

Civil Suit (Plaint)
Civil Miscellaneous Application
Criminal Miscellaneous Application
Temporary Injunction Application
Execution Application

Sessions Court Bail Application
Sessions Pre-Arrest Bail
Sessions Criminal Appeal
Sessions Criminal Revision

Family Suit or Petition

High Court Writ Petition
High Court Civil Appeal
High Court Criminal Appeal
High Court Criminal Revision
High Court Bail Before Arrest

Supreme Court Civil Petition for Leave to Appeal (CPLA)
Supreme Court Criminal Petition for Leave to Appeal

OUTPUT RULE

Whenever the user selects a document type or provides facts, generate the complete legal draft in full structured court format.

Do not summarize the draft.

Do not provide explanations unless explicitly requested.

Always produce a complete court-ready pleading following Pakistani legal drafting practice.`;

  function inferLegalDraftingDocTypeFromPrompt(prompt: string): LegalDraftingDocType | null {
    const text = String(prompt || "").toLowerCase();
    if (!text.trim()) return null;
    if (/(criminal petition|criminal leave to appeal|supreme court.*criminal)/.test(text)) return "supreme-court-criminal-petition";
    if (/(cpla|civil petition for leave to appeal|supreme court.*civil)/.test(text)) return "supreme-court-cpla";
    if (/(bail before arrest|pre[-\s]?arrest.*high court|high court.*498)/.test(text)) return "high-court-bail-before-arrest";
    if (/(high court.*criminal revision|criminal revision.*high court)/.test(text)) return "high-court-criminal-revision";
    if (/(high court.*criminal appeal|criminal appeal.*high court)/.test(text)) return "high-court-criminal-appeal";
    if (/(writ|article\s*199|constitutional petition|high court writ)/.test(text)) return "high-court-writ-petition";
    if (/(high court.*appeal|civil appeal.*high court|high court civil appeal)/.test(text)) return "high-court-civil-appeal";
    if (/(family suit|family petition|child\s*custody|custody\s*of\s*(minor|child)|guardian.*custody|hizanat|khula|dissolution of marriage|family court)/.test(text)) {
      // Guard: do not classify as family if bail/criminal context is dominant
      if (/(bail|497|498|fir|arrested|judicial custody|in custody|criminal|accused|challan)/.test(text)) return null;
      return "family-suit-petition";
    }
    if (/(maintenance)/.test(text)) {
      if (/(bail|497|498|fir|arrested|judicial custody|in custody|criminal|accused|challan)/.test(text)) return null;
      return "family-suit-petition";
    }
    if (/(criminal\s*(misc|misc\.?|miscellaneous)|crl\.?\s*misc|crm\.?\s*misc)/.test(text)) return "criminal-misc-application";
    if (/(criminal revision|revision petition)/.test(text)) return "sessions-criminal-revision";
    if (/(criminal appeal|appeal against conviction)/.test(text)) return "sessions-criminal-appeal";
    if (/(pre[-\s]?arrest bail|before arrest bail|498\s*cr\.?p\.?c)/.test(text)) return "sessions-pre-arrest-bail";
    if (/(bail|497|498|sessions court|criminal bail)/.test(text)) return "sessions-bail-application";
    if (/(execution|decree holder|order\s*xxi)/.test(text)) return "execution-application";
    if (/(temporary injunction|ad[-\s]?interim|order\s*xxxix|39\s*rules?\s*1\s*&?\s*2)/.test(text)) return "temporary-injunction-application";
    if (/(civil misc|cma|interim relief|151\s*cpc)/.test(text)) return "civil-misc-application";
    if (/(civil suit|plaint|declaration suit|injunction suit)/.test(text)) return "civil-suit-plaint";
    return null;
  }

  function shouldPromptHierarchyOverrideType(prompt: string, inferredType: LegalDraftingDocType): boolean {
    const text = String(prompt || "").toLowerCase();
    const highCourtSignals = /(writ|article\s*199|constitutional petition|high court)/.test(text);
    const familySignals = /(family court|family suit|family petition|khula|child\s*custody|custody\s*of\s*(minor|child)|guardian.*custody|hizanat|dissolution of marriage)/.test(text);
    // Negative signal: if bail/criminal keywords are present, suppress family override
    const bailCriminalSignals = /(bail|fir|arrested|judicial custody|in custody|accused|challan|497|498|489)/.test(text);
    const familySignalsNet = familySignals && !bailCriminalSignals;
    const supremeSignals = /(supreme court|cpla|leave to appeal)/.test(text);
    const sessionsSignals = /(sessions court|section\s*497|section\s*498|criminal bail)/.test(text);
    const justiceOfPeaceSignals = /(22[-\s]?a|22[-\s]?b|justice of peace|registration of fir|section\s*154\s*cr\.?p\.?c)/.test(text);

    if (inferredType === "high-court-writ-petition" && highCourtSignals) return true;
    if (inferredType === "family-suit-petition" && familySignalsNet) return true;
    if ((inferredType === "supreme-court-cpla" || inferredType === "supreme-court-criminal-petition") && supremeSignals) return true;
    if (
      (inferredType === "sessions-bail-application" || inferredType === "sessions-pre-arrest-bail") &&
      sessionsSignals
    ) {
      return true;
    }
    if (inferredType === "criminal-misc-application" && justiceOfPeaceSignals) return true;
    return false;
  }

  function normalizeLegalDraftingDocType(
    raw: string | undefined | null,
    prompt: string,
  ): LegalDraftingDocType {
    const value = String(raw || "").trim().toLowerCase();
    const inferredFromPrompt = inferLegalDraftingDocTypeFromPrompt(prompt);

    if (value in LEGAL_DRAFTING_DOC_TYPES) {
      const selected = value as LegalDraftingDocType;
      if (
        inferredFromPrompt &&
        inferredFromPrompt !== selected &&
        shouldPromptHierarchyOverrideType(prompt, inferredFromPrompt)
      ) {
        return inferredFromPrompt;
      }
      return selected;
    }

    if (inferredFromPrompt) return inferredFromPrompt;
    return "civil-suit-plaint";
  }

  const FULL_REWRITE_PROMPT_PATTERN =
    /\b(full|complete|entire|whole)\s+(rewrite|redraft|regenerate|draft|version)\b|\bfrom\s+scratch\b|\bstart\s+over\b|\brewrite\s+everything\b|\bregenerate\s+everything\b|\bfresh\s+draft\b/i;
  const GROUNDS_EXPANSION_PROMPT_PATTERN =
    /\b(add|include|insert|expand|elaborate|improve|enhance|provide|give)\b[\s\S]{0,40}\b(additional|extra|more|new)?\s*grounds?\b|\bmore\s+grounds?\b|\badditional\s+grounds?\b/i;

  function isFullLegalRewriteRequested(prompt: string): boolean {
    return FULL_REWRITE_PROMPT_PATTERN.test(String(prompt || ""));
  }

  function isGroundsExpansionRequest(prompt: string): boolean {
    return GROUNDS_EXPANSION_PROMPT_PATTERN.test(String(prompt || ""));
  }

  function extractGroundsSectionFromDraft(draftText: string): { start: number; end: number; text: string } | null {
    const source = String(draftText || "");
    if (!source.trim()) return null;

    const headingMatch = source.match(/(^|\n)\s*GROUNDS\s*:?\s*(?:\n|$)/i);
    if (!headingMatch || typeof headingMatch.index !== "number") return null;

    const headingStart = headingMatch.index + (headingMatch[1] ? headingMatch[1].length : 0);
    const remainder = source.slice(headingStart);
    const nextHeading = remainder.match(
      /\n\s*(VALUATION AND COURT FEE|PRAYER|INTERIM RELIEF|VERIFICATION|ANNEXURES|RELIEF SOUGHT)\s*:?\s*(?:\n|$)/i,
    );
    const sectionEnd = nextHeading && typeof nextHeading.index === "number"
      ? headingStart + nextHeading.index
      : source.length;
    const sectionText = source.slice(headingStart, sectionEnd).trimEnd();
    if (!sectionText.trim()) return null;

    return {
      start: headingStart,
      end: sectionEnd,
      text: sectionText,
    };
  }

  function parseOptionalSelectionIndex(value: unknown): number | null {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseOptionalBoolean(value: unknown): boolean {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
  }

  function applyTargetedLegalDraftEdit(params: {
    draftText: string;
    selectedSnippet: string;
    selectedStart: number | null;
    selectedEnd: number | null;
    replacementText: string;
  }): { ok: true; text: string } | { ok: false; reason: string } {
    const source = String(params.draftText || "");
    const replacement = String(params.replacementText || "").trim();
    if (!source.trim()) return { ok: false, reason: "Current draft is empty." };
    if (!replacement) return { ok: false, reason: "AI returned empty replacement text." };

    const start = params.selectedStart;
    const end = params.selectedEnd;
    if (typeof start === "number" && typeof end === "number" && start >= 0 && end > start && end <= source.length) {
      return {
        ok: true,
        text: `${source.slice(0, start)}${replacement}${source.slice(end)}`,
      };
    }

    const snippet = String(params.selectedSnippet || "");
    if (!snippet.trim()) {
      return { ok: false, reason: "No selected snippet was provided for targeted editing." };
    }
    const index = source.indexOf(snippet);
    if (index < 0) {
      return { ok: false, reason: "Selected snippet was not found in current draft." };
    }
    return {
      ok: true,
      text: `${source.slice(0, index)}${replacement}${source.slice(index + snippet.length)}`,
    };
  }

  app.post("/api/retrieval/clauses/generate", guardedUploadQueue, retrievalAttachmentUpload.array("attachments", 5), cleanupDiskUploadFilesAfterResponse, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const { prompt, draftText, jurisdiction, module, documentType } = req.body as {
        prompt?: string;
        draftText?: string;
        jurisdiction?: string;
        module?: string;
        documentType?: string;
        customDocumentType?: string;
        selectedSnippet?: string;
        selectedSnippetStart?: string | number;
        selectedSnippetEnd?: string | number;
        forceTargetedEdit?: string | boolean | number;
        assistantMode?: "draft" | "analysis" | string;
      };
      const safePrompt = (prompt || "").trim();
      if (!safePrompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      const files = req.files as Express.Multer.File[] | undefined;
      let attachmentContext = "";
      const failedAttachments: string[] = [];
      const failedAttachmentReasons: string[] = [];
      const allowedExts = [".txt", ".pdf", ".doc", ...DOCX_COMPAT_EXTS];
      const allowedMimes = ["text/plain", "application/pdf", ...DOCX_COMPAT_MIMES];

      if (files && files.length > 0) {
        const invalidFiles = files.filter((f) => {
          const ext = f.originalname.includes(".")
            ? f.originalname.substring(f.originalname.lastIndexOf(".")).toLowerCase()
            : "";
          const normalizedExt = normalizeAttachmentExt(ext);
          const mime = (f.mimetype || "").toLowerCase();
          return !allowedExts.includes(normalizedExt) && !allowedMimes.includes(mime);
        });
        if (invalidFiles.length > 0) {
          return res.status(400).json({
            message: `Unsupported file type. Only TXT, PDF, DOC/DOCX/DOCM/DOTX are allowed. Rejected: ${invalidFiles.map((f) => f.originalname).join(", ")}`,
          });
        }

        for (const file of files) {
          const stableFile = cloneUploadFile(file);
          const ext = file.originalname.includes(".")
            ? file.originalname.substring(file.originalname.lastIndexOf(".")).toLowerCase()
            : "";
          const normalizedExt = normalizeAttachmentExt(ext);
          const mime = (file.mimetype || "").toLowerCase();
          const signatureExt = resolveAttachmentSignatureExt(normalizedExt, mime);
          if (!signatureExt) {
            failedAttachments.push(file.originalname);
            failedAttachmentReasons.push(`${file.originalname}: unsupported extension or MIME type`);
            continue;
          }

          if (!hasSafeDocumentSignature(stableFile, signatureExt)) {
            failedAttachments.push(file.originalname);
            failedAttachmentReasons.push(`${file.originalname}: invalid signature`);
            continue;
          }
          const malwareCheck = await passesMalwareScan(stableFile);
          if (!malwareCheck.ok) {
            failedAttachments.push(file.originalname);
            failedAttachmentReasons.push(`${file.originalname}: ${malwareCheck.reason || "malware detected"}`);
            continue;
          }

          try {
            let extractedText = "";
            if (signatureExt === ".txt") {
              extractedText = stripNullBytes(stableFile.buffer.toString("utf-8"));
            } else if (signatureExt === ".pdf") {
              let parsedText = "";
              try {
                parsedText = await extractPdfTextSafe(stableFile.buffer, "retrieval-clause-generate");
              } catch (pdfErr) {
                if (isExtractionQueueFullError(pdfErr)) return sendExtractionBusy(res);
                console.warn(
                  `[Retrieval Clause] PDF parse failed for ${file.originalname}, using OCR fallback: ${getErrorMessage(pdfErr)}`,
                );
              }
              if (!parsedText.trim()) {
                parsedText = await extractPdfTextWithOcrFallback(stableFile, "retrieval-clause-generate");
              }
              extractedText = stripNullBytes(parsedText);
            } else {
              extractedText = await extractDocxTextSafe(stableFile.buffer, "retrieval-clause-generate");
              extractedText = stripNullBytes(extractedText);
            }

            if (!extractedText.trim()) {
              failedAttachments.push(file.originalname);
              failedAttachmentReasons.push(`${file.originalname}: extracted text was empty`);
              continue;
            }

            const bounded = trimTextToTokenBudget(extractedText, 2200);
            const label = signatureExt === ".pdf"
              ? "Context PDF"
              : (signatureExt === ".docx" || signatureExt === ".doc")
                ? "Context DOC/DOCX"
                : "Context TXT";
            attachmentContext += `\n\n--- ${label}: ${file.originalname} ---\n${bounded}\n--- End ---`;
          } catch (extractErr) {
            if (isExtractionQueueFullError(extractErr)) return sendExtractionBusy(res);
            failedAttachments.push(file.originalname);
            failedAttachmentReasons.push(`${file.originalname}: ${getErrorMessage(extractErr)}`);
          }
        }

        if (!attachmentContext.trim()) {
          const failureDetail = failedAttachmentReasons.length > 0
            ? ` Details: ${failedAttachmentReasons.slice(0, 3).join(" | ")}`
            : "";
          return res.status(400).json({
            message: `Could not extract readable text from context attachment(s): ${failedAttachments.join(", ")}.${failureDetail}`,
          });
        }
      }

      const baseDraftText = trimTextToTokenBudget((draftText || "").trim(), 12000);
      const draftContextForGeneration = trimTextToTokenBudget(`${baseDraftText}${attachmentContext}`, 12000);

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
            draftText: draftContextForGeneration,
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

      if (String(module || "").toLowerCase() === "legal-drafting") {
        const allowed = await checkUsageLimit(userId, "draft", res);
        if (!allowed) return;

        const rawDocType = String(documentType || "").trim().toLowerCase();
        const customDocType = String((req.body as any)?.customDocumentType || "").trim();
        const useCustomDocType = rawDocType === "custom-input" && customDocType.length > 0;
        const inferencePrompt = !rawDocType && baseDraftText.trim().length > 0
          ? `${safePrompt}\n\nExisting Draft Context:\n${baseDraftText.slice(0, 2600)}`
          : safePrompt;

        const selectedDocType = useCustomDocType
          ? null
          : normalizeLegalDraftingDocType(documentType, inferencePrompt);

        const profile = useCustomDocType
          ? {
              label: `Custom Court Filing (${customDocType})`,
              checklist:
                "- Court/forum and parties\n- Statutory provision/jurisdiction basis\n- Chronological facts\n- Concise legal grounds\n- Specific prayer and verification",
              skeleton:
                "IN THE COURT OF ______\nCase No. ____ of ____\n\nPetitioner/Plaintiff/Appellant: ____\nVersus\nRespondent/Defendant: ____\n\nTITLE: ____\n\nFacts:\n1. ...\n2. ...\n\nGrounds:\n1. ...\n2. ...\n\nPrayer:\n...\n\nVerification:\n...",
            }
          : LEGAL_DRAFTING_DOC_TYPES[selectedDocType as LegalDraftingDocType];

        const legalKnowledgeQuery = trimTextToTokenBudget(
          [
            safePrompt,
            profile.label,
            jurisdiction || "",
            baseDraftText.slice(0, 2200),
            attachmentContext.slice(0, 2200),
          ]
            .filter((part) => String(part || "").trim().length > 0)
            .join("\n"),
          2600,
        );
        const legalKnowledgeContextRaw = await gatherKnowledgeContextV2(legalKnowledgeQuery, userId);
        const legalKnowledgeContext = trimTextToTokenBudget(legalKnowledgeContextRaw, 5000);
        const legalKnowledgeContextBlock = legalKnowledgeContext
          ? legalKnowledgeContext
          : "\n\nREFERENCE MATERIALS:\n- No high-confidence internal matches were found for this prompt.\n- If a citation is unavailable in internal references, omit it (do not use placeholders).";

        const typeLockInstruction = selectedDocType
          ? buildStrictTypeLockInstruction(selectedDocType, profile.label)
          : `Selected filing type lock (non-negotiable):
- You are drafting ONLY: ${profile.label}
- Do not change the selected filing type.
- Keep proper Pakistani court forum heading, cause title, numbered facts, legal grounds, prayer, verification, and annexures (if needed).`;

        const requestedAssistantMode = String((req.body as any)?.assistantMode || "").trim().toLowerCase();
        const assistantMode: "draft" | "analysis" = requestedAssistantMode === "analysis" ? "analysis" : "draft";

        const sysInstruction = PAKISTANI_JUDICIAL_FORMAT_GUIDANCE;
        if (assistantMode === "analysis") {
          const analysisSystemInstruction = `${sysInstruction}

ANALYSIS MODE OVERRIDE (HIGH PRIORITY)
- For this request, act as a Pakistani legal AI advisor.
- The user is asking legal guidance/review, not necessarily a fresh pleading draft.
- Do not rewrite the full draft unless the user explicitly requests full rewrite/redraft.
- If reviewing a draft, provide concise practical recommendations and targeted improvements.
- Keep Pakistani forum hierarchy correct and clearly state if forum appears incorrect.
- Cite only INTERNAL DATABASE REFERENCES. If unavailable, omit citation.`;

          const analysisInput = `User legal query:
${safePrompt}

Current draft context (if any):
${baseDraftText || "[No draft provided]"}

Context files (if any):
${attachmentContext || "[No context attachments provided]"}

INTERNAL DATABASE REFERENCES (AUTO-LOADED):
${legalKnowledgeContextBlock}

Response format:
- Give a direct legal answer first.
- If draft-related, add "Suggested Improvements:" with numbered points.
- Keep concise but substantive for Pakistani legal practice.`;

          const analysisResult = await callLegalDraftingAI(analysisSystemInstruction, analysisInput, Math.min(TOKEN_LIMITS.draft, 1800), {
            timeoutProfile: "analysis",
            temperature: 0.2,
          });
          await logUsageCost(userId, "draft", analysisResult.model, analysisSystemInstruction + analysisInput, analysisResult.text);
          let analysisText = normalizeDraftingText(analysisResult.text || "");
          if (!analysisText) {
            return res.status(502).json({ message: "AI returned empty legal analysis text" });
          }

          const analysisReferences = await resolveLegalDraftReferences(analysisText, {
            stripUnverifiedCaseCitations: true,
            unresolvedCaseCitationPlaceholder: "",
          });
          analysisText = normalizeDraftingText(analysisReferences.cleanedText || analysisText);
          if (!analysisText) {
            return res.status(502).json({ message: "AI analysis failed citation integrity checks" });
          }

          return res.json({
            clause: analysisText,
            sourceId: `legal-analysis-${selectedDocType || "general"}`,
            confidence: 0.84,
            method: "ai-legal-analysis",
            assistantMode: "analysis",
            documentType: selectedDocType || "custom-input",
            customDocumentType: useCustomDocType ? customDocType : undefined,
            attachmentsUsed: files?.length || 0,
            references: analysisReferences.references,
            styleMemory: styleMemoryMeta || undefined,
          });
        }
        const selectedSnippetRaw = String((req.body as any)?.selectedSnippet || "");
        let selectedSnippet = selectedSnippetRaw.slice(0, 8000);
        let selectedSnippetStart = parseOptionalSelectionIndex((req.body as any)?.selectedSnippetStart);
        let selectedSnippetEnd = parseOptionalSelectionIndex((req.body as any)?.selectedSnippetEnd);
        const forceTargetedEdit = parseOptionalBoolean((req.body as any)?.forceTargetedEdit);
        const autoGroundsTargetMode =
          !selectedSnippet.trim() &&
          baseDraftText.trim().length > 0 &&
          !isFullLegalRewriteRequested(safePrompt) &&
          isGroundsExpansionRequest(safePrompt);
        if (autoGroundsTargetMode) {
          const groundsSection = extractGroundsSectionFromDraft(baseDraftText);
          if (groundsSection) {
            selectedSnippet = groundsSection.text.slice(0, 8000);
            selectedSnippetStart = groundsSection.start;
            selectedSnippetEnd = groundsSection.end;
          }
        }
        const targetedEditMode =
          selectedSnippet.trim().length > 0 &&
          baseDraftText.trim().length > 0 &&
          (forceTargetedEdit || !isFullLegalRewriteRequested(safePrompt));

        let draftedText = "";
        if (targetedEditMode) {
          const targetedInput = `User instruction:
${safePrompt}

Target filing:
${profile.label}

${typeLockInstruction}

Targeted edit mode (strict):
- Edit ONLY the selected excerpt.
- Keep all other draft text unchanged.
- Return only the replacement text for the selected excerpt.
- Do not repeat the full pleading.
- No markdown symbols, no bullets, no JSON, no explanations.
- Keep Pakistani court drafting language and formatting.
- Do not invent facts, citations, or statutory sections.
- Case law citation lock (absolute): use only citations found in the INTERNAL DATABASE REFERENCES block below.
- If an internal citation is unavailable, omit the citation (no placeholders).
${autoGroundsTargetMode ? "- Scope hint: selected excerpt is the GROUNDS section. Add/expand grounds as requested while preserving existing valid grounds and drafting style.\n- Each ground must include brief explanation (2 to 4 sentences) tied to facts and law." : ""}

Selected excerpt to replace:
${selectedSnippet}

Current full draft context:
${baseDraftText}

Additional context files (if any):
${attachmentContext || "[No attachment context provided]"}

INTERNAL DATABASE REFERENCES (AUTO-LOADED):
${legalKnowledgeContextBlock}${styleContext ? `\n\nPersonal Style Memory:\n${styleContext}` : ""}`;

          const targetedResult = await callLegalDraftingAI(sysInstruction, targetedInput, Math.min(TOKEN_LIMITS.draft, 1800), {
            timeoutProfile: "analysis",
            temperature: 0.2,
          });
          await logUsageCost(userId, "draft", targetedResult.model, sysInstruction + targetedInput, targetedResult.text);
          const replacementText = normalizeCourtReadyDraftingText(targetedResult.text);
          const patched = applyTargetedLegalDraftEdit({
            draftText: baseDraftText,
            selectedSnippet,
            selectedStart: selectedSnippetStart,
            selectedEnd: selectedSnippetEnd,
            replacementText,
          });
          if (!patched.ok) {
            return res.status(400).json({
              message: `Could not apply targeted AI edit. ${patched.reason} Select the exact section and try again, or request a full rewrite.`,
            });
          }
          draftedText = normalizeCourtReadyDraftingText(patched.text);
        } else {
          const userInput = `User instruction:
${safePrompt}

Target filing:
${profile.label}

Drafting checklist:
${profile.checklist}

Court-ready formatting requirements (mandatory):
- Output plain court pleading text only.
- Do not use markdown symbols such as *, **, #, -, backticks, or bullet markers.
- Keep professional Pakistani court format with clean headings and paragraphs.
- Use uppercase captions for core headings: court title, case title, RESPECTFULLY SHEWETH:, BRIEF FACTS, GROUNDS, PRAYER, VERIFICATION, ANNEXURES.
- Mandatory section order: place heading "VALUATION AND COURT FEE" immediately before heading "PRAYER".
- Use "VERSUS" on its own line between party blocks.
- Use numbered facts (1., 2., 3.) and alphabetic legal grounds (A., B., C.).
- In BRIEF FACTS and GROUNDS, every line/item must start with "That the" (for example: "1. That the ...", "A. That the ...").
- Do not add "That the" to heading/sub-heading labels inside sections.
- In GROUNDS, provide brief explanation for each ground (at least 2 to 4 sentences), not heading-only points.
- Do not create a separate heading "LEGAL AUTHORITIES"; place all statutes/case citations inside relevant GROUNDS lines.
- Court hierarchy rule (strict): use the correct Pakistani forum for selected filing type (e.g., Writ/Article 199 -> High Court; family matters -> Family Court; CPLA -> Supreme Court). Never place writ petitions in Family Court.
- Keep prayer specific to this filing type and facts; avoid generic/contract wording.
- Do not invent facts, dates, orders, or citations; use placeholders like [______] where details are missing.
- Case law citation rule (strict): include only citations that are real and verifiable from Al Wakeelo internal Knowledge Base; if unavailable, omit citation.
- Statute citation rule (strict): cite only authentic Pakistani statute provisions; do not invent section/article numbers.
- Use only citations available in the INTERNAL DATABASE REFERENCES block below. Do not cite any authority outside that block.
- End with signature block (party/counsel) and place/date.
- Keep spacing court-ready: no trailing spaces, no markdown bullets, and exactly clean paragraph breaks between sections.

${typeLockInstruction}

${selectedDocType === "criminal-misc-application" ? `Criminal Misc. filing focus:
- If facts show police refusal to register FIR, draft as Justice of Peace application under Sections 22-A and 22-B Cr.P.C. read with Section 154 Cr.P.C.
- Include Respondent No.1 as "The State through SHO, Police Station ______".
- Keep relief focused on registration of FIR and lawful investigation.
- Do not convert this format into a constitutional petition under Article 199.` : ""}

${useCustomDocType ? `Custom filing instruction:\n- Draft specifically as: ${customDocType}\n- Keep this strictly in Pakistani court/litigation drafting format.\n` : ""}

Jurisdiction/Forum (if provided): ${jurisdiction || "Pakistan"}

Current draft / case history context:
${draftContextForGeneration || "[No draft/context provided]"}

INTERNAL DATABASE REFERENCES (AUTO-LOADED):
${legalKnowledgeContextBlock}

Reference skeleton (adapt to facts):
${profile.skeleton}${styleContext ? `\n\nPersonal Style Memory:\n${styleContext}` : ""}`;

          const aiResult = await callLegalDraftingAI(sysInstruction, userInput, TOKEN_LIMITS.draft, {
            timeoutProfile: "analysis",
            temperature: 0.25,
          });
          await logUsageCost(userId, "draft", aiResult.model, sysInstruction + userInput, aiResult.text);
          draftedText = normalizeCourtReadyDraftingText(aiResult.text);
          if (selectedDocType) {
            const validation = validateDraftForSelectedType(draftedText, selectedDocType);
            if (!validation.ok) {
              const repairInput = `You must repair and reformat the following legal draft so it STRICTLY follows this selected filing type:
${profile.label}

Type lock rules:
${typeLockInstruction}

Validation issues detected:
${validation.issues.map((item, idx) => `${idx + 1}. ${item}`).join("\n")}

Repair instructions:
- Rewrite the full pleading in proper Pakistani court-ready format.
- Keep the same legal objective and facts; do not invent new facts.
- Ensure heading "VALUATION AND COURT FEE" appears before "PRAYER".
- Keep clean spacing and section breaks; no markdown symbols.
- Keep citations restricted to INTERNAL DATABASE REFERENCES only; if unavailable omit citation.
- Return plain pleading text only.

INTERNAL DATABASE REFERENCES (AUTO-LOADED):
${legalKnowledgeContextBlock}

Original draft:
${draftedText}`;

              const repaired = await callLegalDraftingAI(sysInstruction, repairInput, TOKEN_LIMITS.draft, {
                timeoutProfile: "analysis",
                temperature: 0.15,
              });
              await logUsageCost(userId, "draft", repaired.model, sysInstruction + repairInput, repaired.text);
              draftedText = normalizeCourtReadyDraftingText(repaired.text);
            }
          }
        }
        if (!draftedText) {
          return res.status(502).json({ message: "AI returned empty legal draft text" });
        }

        const referenceResolution = await resolveLegalDraftReferences(draftedText, {
          stripUnverifiedCaseCitations: true,
          unresolvedCaseCitationPlaceholder: "",
        });
        draftedText = referenceResolution.cleanedText;
        if (!draftedText) {
          return res.status(502).json({ message: "AI draft failed citation integrity checks" });
        }

        return res.json({
          clause: draftedText,
          sourceId: `legal-${selectedDocType || "custom-input"}`,
          confidence: 0.86,
          method: "ai-legal-drafting",
          assistantMode: "draft",
          documentType: selectedDocType || "custom-input",
          customDocumentType: useCustomDocType ? customDocType : undefined,
          attachmentsUsed: files?.length || 0,
          references: referenceResolution.references,
          styleMemory: styleMemoryMeta || undefined,
        });
      }

      const generated = generateClauseFromPrompt({
        prompt: safePrompt,
        draftText: draftContextForGeneration,
        jurisdiction: jurisdiction || "Lahore",
      });

      const aiFallbackThreshold = resolveConfidenceThreshold("RETRIEVAL_CLAUSE_GENERATE_AI_THRESHOLD", 0.58);
      const shouldAiFallback = generated.method === "fallback" || generated.confidence < aiFallbackThreshold;
      const shouldStyleRewrite = !!styleContext && generated.method === "retrieval";
      const canUseAiFallback = isDeepSeekAvailable(); // UPDATED: Changed from isGroqAvailable (Groq deprecated 2026-04-16)

      if ((shouldAiFallback || shouldStyleRewrite) && canUseAiFallback) {
        const allowed = await checkUsageLimit(userId, "contract-drafting", res);
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
${draftContextForGeneration || "[No draft text provided]"}${styleContext ? `\n\nPersonal Style Memory:\n${styleContext}` : ""}`;
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
              attachmentsUsed: files?.length || 0,
              styleMemory: styleMemoryMeta || undefined,
            });
          }
        } catch (aiErr) {
          console.warn("[Retrieval Clauses] AI fallback for generation failed:", getErrorMessage(aiErr));
        }
      }

      res.json({ ...generated, attachmentsUsed: files?.length || 0, styleMemory: styleMemoryMeta || undefined });
    } catch (err: any) {
      const errMsg = getErrorMessage(err);
      console.error("Error generating retrieval clause:", errMsg, err);
      const isTimeout = err?.code === "MODEL_TIMEOUT" || errMsg.includes("timed out");
      const isEmpty = err?.code === "EMPTY_MODEL_OUTPUT";
      const userMessage = isTimeout
        ? "AI model timed out generating your draft. This usually resolves on retry — please try again."
        : isEmpty
          ? "AI returned an empty response. Please rephrase your instruction with more detail and try again."
          : `Failed to generate clause: ${errMsg}`;
      res.status(isTimeout ? 504 : 500).json({ message: userMessage });
    }
  });

  const LEGAL_DRAFTING_WORKSPACE_STATE_DOC_TITLE = "__LEGAL_DRAFTING_WORKSPACE_STATE__";
  const LEGAL_DRAFTING_WORKSPACE_STATE_SOURCE_TYPE = "legal-drafting-workspace-state";

  app.get("/api/legal-drafting/workspace-state", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const [row] = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.userId, userId),
            eq(documents.sourceType, LEGAL_DRAFTING_WORKSPACE_STATE_SOURCE_TYPE),
          ),
        )
        .orderBy(desc(documents.id))
        .limit(1);

      if (!row || !row.content) {
        return res.json({ ok: true, state: null });
      }

      let parsed: any = null;
      try {
        parsed = JSON.parse(row.content);
      } catch {
        return res.json({ ok: true, state: null });
      }

      return res.json({
        ok: true,
        state: parsed && typeof parsed === "object" ? parsed : null,
      });
    } catch (err) {
      console.error("Error loading legal drafting workspace state:", err);
      return res.status(500).json({ message: "Failed to load legal drafting workspace state" });
    }
  });

  app.put("/api/legal-drafting/workspace-state", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const schema = z.object({
        draftTitle: z.string().trim().max(240).default("Untitled Draft"),
        docText: z.string().max(250_000).default(""),
        selectedDraftId: z.number().int().positive().nullable().optional(),
        hasDraftInSession: z.boolean().optional().default(false),
        draftChatMessages: z.array(
          z.object({
            id: z.string().trim().max(120),
            role: z.enum(["user", "assistant"]),
            content: z.string().max(80_000),
            attachments: z.array(z.string().max(260)).optional(),
            kind: z.enum(["guidance", "typing", "error"]).optional(),
            createdAt: z.number().int().nonnegative().optional(),
          }),
        ).max(250).optional().default([]),
        memoryItems: z.array(
          z.object({
            id: z.string().trim().max(120),
            kind: z.enum(["instruction", "clause", "risk"]),
            text: z.string().max(2000),
            ts: z.number().int().nonnegative(),
          }),
        ).max(200).optional().default([]),
      });

      const parsed = schema.parse(req.body || {});

      const statePayload = {
        draftTitle: parsed.draftTitle || "Untitled Draft",
        docText: parsed.docText || "",
        selectedDraftId: parsed.selectedDraftId ?? null,
        hasDraftInSession: !!parsed.hasDraftInSession,
        draftChatMessages: parsed.draftChatMessages.slice(-150),
        memoryItems: parsed.memoryItems.slice(0, 60),
        savedAt: new Date().toISOString(),
      };

      const serialized = JSON.stringify(statePayload);

      const [existing] = await db
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.userId, userId),
            eq(documents.sourceType, LEGAL_DRAFTING_WORKSPACE_STATE_SOURCE_TYPE),
          ),
        )
        .orderBy(desc(documents.id))
        .limit(1);

      if (existing?.id) {
        await db
          .update(documents)
          .set({
            title: LEGAL_DRAFTING_WORKSPACE_STATE_DOC_TITLE,
            content: serialized,
            summary: "Legal drafting workspace autosave state",
            sourceType: LEGAL_DRAFTING_WORKSPACE_STATE_SOURCE_TYPE,
            mimeType: "application/json",
            fileExtension: "json",
            detectedDomain: "other",
            detectedDomainLabel: "Other",
            classificationMethod: "workspace-autosave",
            classificationConfidence: 100,
          })
          .where(eq(documents.id, existing.id));
      } else {
        await db.insert(documents).values({
          userId,
          title: LEGAL_DRAFTING_WORKSPACE_STATE_DOC_TITLE,
          content: serialized,
          summary: "Legal drafting workspace autosave state",
          sourceType: LEGAL_DRAFTING_WORKSPACE_STATE_SOURCE_TYPE,
          mimeType: "application/json",
          fileExtension: "json",
          detectedDomain: "other",
          detectedDomainLabel: "Other",
          classificationMethod: "workspace-autosave",
          classificationConfidence: 100,
        });
      }

      return res.json({ ok: true, savedAt: statePayload.savedAt });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid workspace state payload" });
      }
      console.error("Error saving legal drafting workspace state:", err);
      return res.status(500).json({ message: "Failed to save legal drafting workspace state" });
    }
  });

  app.post("/api/legal-drafting/references", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const rawDraftText = sanitizeInputText(req.body?.draftText, 120000);
      if (!rawDraftText.trim()) {
        return res.json({ references: createEmptyLegalDraftReferencePayload() });
      }
      const bounded = trimTextToTokenBudget(rawDraftText, 16000);
      const resolved = await resolveLegalDraftReferences(bounded, { stripUnverifiedCaseCitations: false });
      res.json({ references: resolved.references });
    } catch (err) {
      console.error("Error resolving legal drafting references:", err);
      res.status(500).json({ message: "Failed to resolve legal drafting references" });
    }
  });

  const upload = multer({
    storage: createUploadStorage("general"),
    limits: {
      fileSize: GENERAL_UPLOAD_MAX_FILE_SIZE_BYTES,
      files: ADMIN_UPLOAD_MAX_FILES,
    },
  });

  app.post("/api/ai/transcribe", guardedUploadQueue, upload.single("audio"), cleanupDiskUploadFilesAfterResponse, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "No audio file provided" });
      const stableFile = cloneUploadFile(file);

      const allowedAudio = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a", "audio/webm", "audio/ogg", "audio/mp3"];
      if (!allowedAudio.some(t => file.mimetype.startsWith("audio/") || allowedAudio.includes(file.mimetype))) {
        return res.status(400).json({ message: "Unsupported audio format. Use MP3, WAV, M4A, or WebM." });
      }
      const transcribeMalwareCheck = await passesMalwareScan(stableFile);
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
          : (requestedModeRaw === "apex" || requestedModeRaw === "apex-pro")
            ? "apex-pro"
            : (requestedModeRaw === "apex-agent" || requestedModeRaw === "apex-agent-web")
              ? "apex-agent"
              : "standard";
      const userTier = await storage.getUserTier(userId);
      const canUseTurboMode = isTurboAllowedForTier(userTier);
      const canUseApexMode = isApexAllowedForTier(userTier);
      if (requestedMode === "turbo" && !canUseTurboMode) {
        return res.status(403).json({ message: "Turbo transcription requires Pro, Chamber, or Enterprise." });
      }
      if ((requestedMode === "apex-pro" || requestedMode === "apex-agent") && !canUseApexMode) {
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
      const base64Audio = stableFile.buffer.toString("base64");

      let transcription = "";
      let provider = "deepseek"; // UPDATED: Default changed from groq to deepseek (Groq deprecated 2026-04-16)
      let model = "whisper-large-v3-turbo";
      let fallbackUsed = false;
      let fallbackFrom: "deepseek" | "apex" | null = null;
      let localFallbackUsed = false;

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
          // UPDATED: Removed Groq fallback (deprecated 2026-04-16), using whisper.cpp instead
          if (isWhisperCppConfigured()) {
            try {
              const localResult = await transcribeWithWhisperCpp({
                audioBuffer: stableFile.buffer,
                filename: file.originalname,
              });
              const text = (localResult.text || "").trim();
              if (text) {
                transcription = text;
                provider = "local";
                model = localResult.model || "whisper.cpp";
                fallbackUsed = true;
                fallbackFrom = "deepseek";
                localFallbackUsed = true;
              }
            } catch (localErr) {
              console.warn(
                "[Transcription] whisper.cpp fallback failed after deepseek path failure:",
                getErrorMessage(localErr),
              );
            }
          }
          if (!transcription.trim()) {
            return res.status(503).json({
              message: isDeepSeekAvailable()
                ? "Turbo transcription failed and no fallback is available."
                : "Turbo transcription is unavailable because DeepSeek is not configured and no fallback is available.",
            });
          }
        }
      } else if (requestedMode === "apex-pro" || requestedMode === "apex-agent") {
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
        }

        if (!transcription.trim()) {
          // UPDATED: Removed Groq fallback (deprecated 2026-04-16), using whisper.cpp instead
          if (isWhisperCppConfigured()) {
            try {
              const localResult = await transcribeWithWhisperCpp({
                audioBuffer: stableFile.buffer,
                filename: file.originalname,
              });
              const text = (localResult.text || "").trim();
              if (text) {
                transcription = text;
                provider = "local";
                model = localResult.model || "whisper.cpp";
                fallbackUsed = true;
                fallbackFrom = "apex";
                localFallbackUsed = true;
              }
            } catch (localErr) {
              console.warn(
                "[Transcription] whisper.cpp fallback failed after apex path failure:",
                getErrorMessage(localErr),
              );
            }
          }
          if (!transcription.trim()) {
            return res.status(503).json({
              message: isApexAvailable()
                ? "Apex transcription failed and no fallback is available."
                : "Apex transcription is unavailable because Kimi is not configured and no fallback is available.",
            });
          }
        }
      } else {
        // UPDATED: Using DeepSeek instead of Groq for standard transcription (Groq deprecated 2026-04-16)
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
            console.warn("[Transcription] DeepSeek standard transcription failed:", getErrorMessage(deepseekErr));
          }
        }
        if (!transcription.trim()) {
          if (isWhisperCppConfigured()) {
            try {
              const localResult = await transcribeWithWhisperCpp({
                audioBuffer: stableFile.buffer,
                filename: file.originalname,
              });
              const text = (localResult.text || "").trim();
              if (text) {
                transcription = text;
                provider = "local";
                model = localResult.model || "whisper.cpp";
                localFallbackUsed = true;
              }
            } catch (localErr) {
              console.warn(
                "[Transcription] whisper.cpp fallback failed after deepseek path failure:",
                getErrorMessage(localErr),
              );
            }
          }
          if (!transcription.trim()) {
            return res.status(503).json({
              message:
                "Standard transcription is unavailable because DeepSeek failed/unconfigured and whisper.cpp fallback is unavailable.",
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

  app.post(api.ai.chat.path, guardedUploadQueue, upload.array("attachments", 5), cleanupDiskUploadFilesAfterResponse, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    const releaseInteractiveChatRequest = beginInteractiveChatRequest();
    try {
      let body = req.body;
      if (typeof body.messages === "string") {
        try {
          body = { ...body, messages: JSON.parse(body.messages) };
        } catch {
          return res.status(400).json({ message: "Invalid messages payload" });
        }
      }
      const moduleType: ModuleType = normalizeModuleType(body?.type);
      const limitFeature = moduleType === "draft"
        ? "draft"
        : moduleType === "contract-drafting"
          ? "contract-drafting"
          : "chat";
      const allowed = await checkUsageLimit(userId, limitFeature, res);
      if (!allowed) return;

      const {
        messages: userMessages,
        type,
        moduleIntent: moduleIntentRaw,
        aiMode: aiModeRaw,
        apexModel: apexModelRaw,
        turbo: turboRaw,
      } = body as {
        messages: Array<{ role: string; content: string }>;
        type?: string;
        moduleIntent?: string;
        aiMode?: string;
        apexModel?: string;
        turbo?: boolean | string;
      };
      const moduleProfile = getModuleProfile(type);
      const moduleIntent = typeof moduleIntentRaw === "string" ? (moduleIntentRaw as ModuleIntent) : undefined;
      const requestedStream = body.stream === true || body.stream === "true";
      const requestedAiMode = typeof aiModeRaw === "string" ? aiModeRaw.trim().toLowerCase() : "";
      const requestedTurbo = requestedAiMode === "turbo" || turboRaw === true || turboRaw === "true";
      const rawApexModel = typeof apexModelRaw === "string" ? apexModelRaw.trim().toLowerCase() : "";
      const normalizeRequestedApexModel = (value: string): ApexModel | "" => {
        if (value === "apex" || value === "apex-pro") return "apex-pro";
        if (value === "apex-agent" || value === "apex-agent-web") return "apex-agent";
        return "";
      };
      const requestedApexModelRaw = normalizeRequestedApexModel(rawApexModel)
        || normalizeRequestedApexModel(requestedAiMode);

      const files = req.files as Express.Multer.File[] | undefined;
      let attachmentContext = "";
      let extractedAttachmentCount = 0;
      const failedAttachments: string[] = [];
      const failedAttachmentReasons: string[] = [];
      const allowedExts = [".txt", ".pdf", ".doc", ...DOCX_COMPAT_EXTS];
      const allowedMimes = ["text/plain", "application/pdf", ...DOCX_COMPAT_MIMES];
      if (files && files.length > 0) {
        const invalidFiles = files.filter((f) => {
          const ext = f.originalname.includes(".")
            ? f.originalname.substring(f.originalname.lastIndexOf(".")).toLowerCase()
            : "";
          const normalizedExt = normalizeAttachmentExt(ext);
          const mime = (f.mimetype || "").toLowerCase();
          return !allowedExts.includes(normalizedExt) && !allowedMimes.includes(mime);
        });
        if (invalidFiles.length > 0) {
          return res.status(400).json({ message: `Unsupported file type. Only TXT, PDF, DOC/DOCX/DOCM/DOTX files are allowed. Rejected: ${invalidFiles.map(f => f.originalname).join(", ")}` });
        }
        type AttachOk = { kind: "ok"; label: string; filename: string; text: string };
        type AttachTerminal = { kind: "terminal"; status: number; message: string; securityEvent?: "signature" | "malware"; securityMeta?: Record<string, any> };
        type AttachBusy = { kind: "busy" };
        type AttachFailed = { kind: "failed"; filename: string; reason: string };
        type AttachOutcome = AttachOk | AttachTerminal | AttachBusy | AttachFailed;

        const processOneAttachment = async (file: Express.Multer.File): Promise<AttachOutcome> => {
          const stableFile = cloneUploadFile(file);
          const ext = file.originalname.includes(".")
            ? file.originalname.substring(file.originalname.lastIndexOf(".")).toLowerCase()
            : "";
          const normalizedExt = normalizeAttachmentExt(ext);
          const mime = (file.mimetype || "").toLowerCase();
          const signatureExt = resolveAttachmentSignatureExt(normalizedExt, mime);
          if (!signatureExt) {
            return { kind: "terminal", status: 400, message: `Unsupported file type. Rejected: ${file.originalname}` };
          }
          if (!hasSafeDocumentSignature(stableFile, signatureExt)) {
            return {
              kind: "terminal",
              status: 400,
              message: `Unsafe or invalid attachment detected: ${file.originalname}`,
              securityEvent: "signature",
              securityMeta: {
                filename: file.originalname,
                ext: normalizedExt || null,
                mimetype: file.mimetype,
              },
            };
          }
          const malwareCheck = await passesMalwareScan(stableFile);
          if (!malwareCheck.ok) {
            return {
              kind: "terminal",
              status: 400,
              message: `${file.originalname}: ${malwareCheck.reason || "malware detected"}`,
              securityEvent: "malware",
              securityMeta: {
                filename: file.originalname,
                reason: malwareCheck.reason || null,
              },
            };
          }
          try {
            let extractedText = "";
            if (signatureExt === ".txt") {
              extractedText = stripNullBytes(stableFile.buffer.toString("utf-8"));
            } else if (signatureExt === ".pdf") {
              let parsedText = "";
              try {
                parsedText = await extractPdfTextSafe(stableFile.buffer, "chat-attachment");
              } catch (pdfParseErr) {
                if (isExtractionQueueFullError(pdfParseErr)) {
                  throw pdfParseErr;
                }
                console.warn(
                  `[OCR][chat-attachment] PDF parse failed for ${file.originalname}, continuing to OCR fallback: ${getErrorMessage(pdfParseErr)}`,
                );
              }
              if (!parsedText.trim()) {
                parsedText = await extractPdfTextWithOcrFallback(stableFile, "chat-attachment");
              }
              extractedText = stripNullBytes(parsedText);
            } else if (signatureExt === ".docx" || signatureExt === ".doc") {
              const parsedText = await extractDocxTextSafe(stableFile.buffer, "chat-attachment");
              extractedText = stripNullBytes(parsedText);
            }

            if (!extractedText.trim()) {
              return { kind: "failed", filename: file.originalname, reason: `${file.originalname}: extracted text was empty after parse/OCR.` };
            }

            const boundedFileText = trimTextToTokenBudget(extractedText, ATTACHMENT_FILE_TOKEN_BUDGET);
            const label = signatureExt === ".pdf"
              ? "Attached PDF"
              : (signatureExt === ".docx" || signatureExt === ".doc")
                ? "Attached DOC/DOCX"
                : "Attached File";
            return { kind: "ok", label, filename: file.originalname, text: boundedFileText };
          } catch (fileErr) {
            if (isExtractionQueueFullError(fileErr)) {
              return { kind: "busy" };
            }
            console.error(`Error extracting text from ${file.originalname}:`, fileErr);
            return { kind: "failed", filename: file.originalname, reason: `${file.originalname}: ${getErrorMessage(fileErr)}` };
          }
        };

        const attachmentOutcomes = await Promise.all(files.map(processOneAttachment));

        const firstTerminal = attachmentOutcomes.find((o) => o.kind === "terminal") as AttachTerminal | undefined;
        if (firstTerminal) {
          if (firstTerminal.securityEvent === "signature") {
            recordSecurityEvent("upload_signature_failure", `chat-attachment:${userId}`, firstTerminal.securityMeta || {});
          } else if (firstTerminal.securityEvent === "malware") {
            recordSecurityEvent("malware_detected", `chat-attachment:${userId}`, firstTerminal.securityMeta || {});
          }
          return res.status(firstTerminal.status).json({ message: firstTerminal.message });
        }
        if (attachmentOutcomes.some((o) => o.kind === "busy")) {
          return sendExtractionBusy(res);
        }
        for (const outcome of attachmentOutcomes) {
          if (outcome.kind === "ok") {
            attachmentContext += `\n\n--- ${outcome.label}: ${outcome.filename} ---\n${outcome.text}\n--- End ---`;
            extractedAttachmentCount += 1;
          } else if (outcome.kind === "failed") {
            failedAttachments.push(outcome.filename);
            failedAttachmentReasons.push(outcome.reason);
          }
        }

        if (extractedAttachmentCount === 0) {
          const failureDetail = failedAttachmentReasons.length > 0
            ? ` Details: ${failedAttachmentReasons.slice(0, 3).join(" | ")}`
            : "";
          return res.status(400).json({
            message: `Could not extract readable text from uploaded attachment(s): ${failedAttachments.join(", ")}. Upload searchable PDF/TXT/DOC/DOCX or enable OCR dependencies for scanned PDFs.${failureDetail}`,
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
        : `${getLegalSystemPrompt()}${moduleType === "al-wakeelo" ? VERIFIED_JUDGMENTS_CITATION_ADDON : ""}\n\nMODULE PROFILE: ${moduleProfile.label}\n${moduleProfile.systemPromptAddon}`;

      // ----- Query Complexity Detection (response length scaling) -----
      // Simple/follow-up queries get short answers; complex queries get full analysis.
      // Only applies to al-wakeelo module; other modules unchanged.
      let queryComplexity: QueryComplexity = "moderate";
      if (!directMode && lastUserMessage && moduleType === "al-wakeelo") {
        queryComplexity = detectQueryComplexity(lastUserMessage.content);
        // Treat brief follow-ups as simple regardless of base classification.
        const hasPriorAssistantTurn = userMessages.some((m) => m.role === "assistant");
        if (hasPriorAssistantTurn && isFollowUpQuestion(lastUserMessage.content, 0)) {
          queryComplexity = "simple";
        }
        const lengthGuidance =
          queryComplexity === "simple"
            ? `\n\nRESPONSE LENGTH POLICY (THIS QUERY):
- This is a SIMPLE / FOLLOW-UP question. Be BRIEF.
- Target: 80-250 words. One short paragraph + at most ONE supporting case or section.
- Do NOT repeat context already provided in earlier turns.
- Do NOT pad with general background, headers, or multi-section structure.
- The references block can be empty or contain 1-2 entries — only what you actually cite.`
            : queryComplexity === "complex"
              ? `\n\nRESPONSE LENGTH POLICY (THIS QUERY):
- This is a COMPLEX query (drafting / comparison / multi-part scenario).
- Target: 1200-2200 words. Comprehensive legal analysis.
- Include multiple relevant cases and statute sections.
- Use headers/sections where it aids clarity.`
              : `\n\nRESPONSE LENGTH POLICY (THIS QUERY):
- This is a MODERATE query.
- Target: 350-800 words. Direct, focused answer.
- Cite 2-4 relevant cases or sections — only what is actually on point.
- Avoid filler, restated context, or unrelated background.`;
        systemPrompt += lengthGuidance;
      }

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

      const styleModule = mapModuleTypeToStyleModule(moduleType);
      const styleEligible = STYLE_MEMORY_ENABLED && !directMode && !!lastUserMessage && !!styleModule && shouldApplyStyleForChat(moduleType, moduleIntent);

      // Run knowledge gather and style retrieval in parallel with a shared enrichment deadline.
      // Both are optional enrichment — the chat request must proceed even if one or both time out.
      // OR tool search: ~2s API + up to 3x8s DB queries (each guarded) = ~26s worst case.
      // 20s outer budget gives DB searches enough runway without hanging chat indefinitely.
      const ENRICHMENT_BUDGET_MS = Math.max(500, Number(process.env.AI_CHAT_ENRICHMENT_BUDGET_MS || 20000));
      const knowledgeNeeded = !directMode && !!lastUserMessage && extractedAttachmentCount === 0;
      // V2 pipeline: intent classify → topic-validated retrieval → structured context
      // For al-wakeelo: pipeline handles statutes + admin docs; tool search handles case law.
      // Build conversation history for the query rewriter (prior turns only, no system msgs).
      // Excludes the last user message itself — that's the rawQuery being rewritten.
      const priorTurns: ConversationTurn[] = userMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(0, -1) // drop last entry (= lastUserMessage)
        .slice(-6)    // keep last 3 exchanges max (cheap on tokens)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const knowledgePromise: Promise<string> = knowledgeNeeded
        ? gatherKnowledgeContextV2(lastUserMessage!.content, userId, priorTurns).catch((err) => {
            console.warn("[AI Chat] Knowledge pipeline unavailable:", getErrorMessage(err));
            return "";
          })
        : Promise.resolve("");

      // Tool-based judgment search: AI calls search_judgments with its own short queries.
      // Runs in parallel with the pipeline — same DB function as the Judgment Search UI.
      const toolSearchStartMs = Date.now();
      // Tool routing: prefer OpenRouter (gpt-4o-mini, parallel calls, ~2s p50)
      // Fallback to DeepSeek V3 (~6-8s p50, sequential rounds) if OpenRouter not configured.
      const useOpenRouterTools = isOpenRouterAvailable();
      const toolSearchEnabled =
        knowledgeNeeded &&
        moduleType === "al-wakeelo" &&
        !directMode &&
        (useOpenRouterTools || isDeepSeekAvailable());
      interface ToolSearchResult {
        contextString: string;
        foundCount: number;
        queriesUsed: string[];
        verifiedCitations: string[];
        verifiedTitles: Array<{ title: string; citation: string }>;
        verifiedHits: Array<{ citation: string; title: string; court: string; summary: string }>;
      }

      // Live-stream tool search status events when the request will stream AND tool search is enabled.
      // Compute willStream early (before selectedRoute is assigned) so we can open SSE BEFORE awaiting enrichment.
      // Apex requests don't stream — detect via requestedApexModelRaw which is set early.
      const willStream = requestedStream && moduleProfile.modelStrategy.stream && !requestedApexModelRaw;
      const willStreamLiveStatus = willStream && toolSearchEnabled;
      let sseHeadersFlushed = false;
      const ensureSseOpen = () => {
        if (sseHeadersFlushed) return;
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();
        sseHeadersFlushed = true;
      };
      if (willStreamLiveStatus) {
        ensureSseOpen();
      }

      const toolStatusCallback = (query: string, found: number) => {
        const elapsedMs = Date.now() - toolSearchStartMs;
        console.log(
          `[ToolSearch:${useOpenRouterTools ? "OR" : "DS"}] query="${query}" found=${found} elapsed=${elapsedMs}ms`,
        );
        if (sseHeadersFlushed) {
          // Live: write directly to the SSE stream — user sees feedback within ~1s
          try {
            res.write(`data: ${JSON.stringify({ searching: true, query, found, elapsedMs })}\n\n`);
          } catch {
            /* client disconnected */
          }
        }
      };

      const toolSearchPromise: Promise<ToolSearchResult> = toolSearchEnabled
        ? (useOpenRouterTools
            ? runToolJudgmentSearchOR(lastUserMessage!.content, toolStatusCallback, undefined, 18000)
            : runToolJudgmentSearch(lastUserMessage!.content, toolStatusCallback)
          ).catch((err) => {
            console.warn("[ToolSearch] Failed:", err?.message || err);
            return { contextString: "", foundCount: 0, queriesUsed: [], verifiedCitations: [], verifiedTitles: [], verifiedHits: [] };
          })
        : Promise.resolve({ contextString: "", foundCount: 0, queriesUsed: [], verifiedCitations: [], verifiedTitles: [], verifiedHits: [] });

      type StyleFetch = Awaited<ReturnType<typeof retrieveStyleContextForGeneration>> | null;
      const stylePromise: Promise<StyleFetch> = (styleEligible && styleModule)
        ? (async (): Promise<StyleFetch> => {
            try {
              const userOrg = await storage.getUserOrganization(userId).catch(() => undefined);
              return await retrieveStyleContextForGeneration({
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
            } catch (styleErr) {
              console.warn("[StyleMemory] Retrieval failed for chat route:", getErrorMessage(styleErr));
              return null;
            }
          })()
        : Promise.resolve(null);

      const [knowledgeRace, styleRace, toolSearchRace] = await Promise.all([
        raceToDeadline<string>(knowledgePromise, ENRICHMENT_BUDGET_MS, "", "knowledge-context"),
        raceToDeadline<StyleFetch>(stylePromise, ENRICHMENT_BUDGET_MS, null, "style-memory"),
        raceToDeadline<ToolSearchResult>(toolSearchPromise, ENRICHMENT_BUDGET_MS, { contextString: "", foundCount: 0, queriesUsed: [], verifiedCitations: [], verifiedTitles: [], verifiedHits: [] }, "tool-search"),
      ]);
      const knowledgeContext = knowledgeRace.value;
      const styleRetrieved = styleRace.value;
      const toolSearchResult = toolSearchRace.value;
      if (toolSearchResult.foundCount > 0) {
        console.log(`[ToolSearch:Done] found=${toolSearchResult.foundCount} queries=${JSON.stringify(toolSearchResult.queriesUsed)}`);
      }
      // Live status: emit "searching done" terminator the moment enrichment finishes.
      // Client switches the loading bubble from "Searching case law" → "Writing response".
      if (sseHeadersFlushed && toolSearchEnabled) {
        try {
          res.write(`data: ${JSON.stringify({ searching: false, found: toolSearchResult.foundCount, totalMs: Date.now() - toolSearchStartMs })}\n\n`);
        } catch {
          /* client disconnected */
        }
      }

      // Emit Case Law Card payload — raw DB hits, no AI processing. Lets the
      // frontend render an authoritative case-law list independent of the AI's
      // prose. Arrives before the AI starts streaming so the user sees the
      // research results almost immediately.
      if (sseHeadersFlushed && toolSearchEnabled && toolSearchResult.verifiedHits.length > 0) {
        try {
          // Trim summaries for transport (frontend can fetch full doc on click).
          const cardHits = toolSearchResult.verifiedHits.slice(0, 25).map((h) => ({
            citation: h.citation,
            title: h.title,
            court: h.court,
            snippet: (h.summary || "").slice(0, 320),
          }));
          res.write(`data: ${JSON.stringify({
            caseLawCard: {
              hits: cardHits,
              totalFound: toolSearchResult.foundCount,
              queriesUsed: toolSearchResult.queriesUsed,
            },
          })}\n\n`);
        } catch {
          /* client disconnected */
        }
      }
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

      if (styleRetrieved && styleMemoryMeta) {
        styleMemoryMeta.scopeUsed = styleRetrieved.result.scopeUsed;
        styleMemoryMeta.confidence = styleRetrieved.result.confidence;
        styleMemoryMeta.chunksUsed = styleRetrieved.result.chunks.length;
        if (styleRetrieved.result.applied && styleRetrieved.result.confidence >= STYLE_CONTEXT_MIN_CONFIDENCE) {
          styleContext = trimTextToTokenBudget(styleRetrieved.result.contextText, STYLE_PROMPT_TOKEN_BUDGET);
          styleMemoryMeta.applied = true;
        }
      }
      const moduleRoute = resolveModuleRoute(
        moduleProfile.modelStrategy.primary,
        userTier,
      );
      if (moduleRoute.blocked) {
        return res.status(moduleRoute.blocked.status).json({ message: moduleRoute.blocked.message });
      }
      let selectedRoute: ChatRouteMode | "apex" = moduleRoute.route;
      let selectedApexModel: ApexModel | null = null;
      const normalizedTier = normalizeTier(userTier);

      if (requestedApexModelRaw) {
        if (!isApexAllowedForTier(userTier)) {
          return res.status(403).json({ message: `Your ${normalizedTier} plan does not include Apex mode` });
        }
        if (!isApexAvailable()) {
          return res.status(503).json({ message: "Apex AI is not configured" });
        }
        const allowedApexModels = getApexModelsForTier(normalizedTier).map((m) => m.id as ApexModel);
        if (allowedApexModels.length === 0) {
          return res.status(403).json({ message: `No Apex models are available for your ${normalizedTier} plan` });
        }
        if (allowedApexModels.includes(requestedApexModelRaw)) {
          selectedApexModel = requestedApexModelRaw;
        } else {
          return res.status(403).json({ message: `Your ${normalizedTier} plan does not include access to this Apex model` });
        }

        const tierPlan = getTierPlan(normalizedTier);
        const apexMonthlyCap = Math.max(0, Number(tierPlan.apexMonthlyCap || 0));
        const apexUsedThisMonth = await storage.getMonthlyUsageCountByFeature(userId, "chat-apex");
        if (apexMonthlyCap > 0 && apexUsedThisMonth >= apexMonthlyCap) {
          return res.status(429).json({
            message: `Apex monthly cap reached (${apexMonthlyCap}/${apexMonthlyCap}) on ${tierPlan.label} plan. Use Standard/Turbo or upgrade.`,
            cap: apexMonthlyCap,
            used: apexUsedThisMonth,
          });
        }

        selectedRoute = "apex";
      } else if (requestedAiMode === "standard") {
        selectedRoute = "standard";
      } else if (requestedTurbo) {
        if (isTurboAllowedForTier(userTier)) {
          if (!isDeepSeekAvailable()) {
            return res.status(503).json({ message: "Turbo mode is currently unavailable because DeepSeek is not configured." });
          }
          selectedRoute = "turbo";
        } else {
          return res.status(403).json({ message: `Your ${normalizedTier} plan does not include Turbo mode` });
        }
      }

      let usedModel = selectedRoute === "apex"
        ? (selectedApexModel || "apex-pro")
        : selectedRoute === "turbo"
          ? getDeepSeekProModelName()
          : "deepseek"; // Using deepseek-chat for standard mode (Groq deprecated)
      const enforcePrimaryLinkedSourceCitations = moduleProfile.features.strictCitations;
      if (enforcePrimaryLinkedSourceCitations) {
        systemPrompt += `\n\nCITATION INTEGRITY POLICY (ABSOLUTE):
- Use only case citations that are present in the internal database context provided to you.
- Use only PRIMARY citations from internal case entries (not secondary/referred citations).
- Do not cite web/internet authorities.
- If a citation is not available internally, omit the citation (no placeholders).`;
      }
      const featureKey = moduleProfile.modelStrategy.tokenLimitKey;
      const featureTokenLimit = TOKEN_LIMITS[featureKey] || TOKEN_LIMITS.chat;
      const planModeCap = selectedRoute === "apex"
        ? getModeOutputCap(userTier, "apex")
        : getModeOutputCap(userTier, selectedRoute);
      const baseTokenLimit = directMode
        ? 512
        : Math.min(featureTokenLimit, planModeCap > 0 ? planModeCap : featureTokenLimit);
      // Scale max output by query complexity for al-wakeelo. Hard ceilings prevent
      // verbose responses to "is it bailable?"-style follow-ups.
      const tokenLimit = (!directMode && moduleType === "al-wakeelo")
        ? (queryComplexity === "simple"
            ? Math.min(600, baseTokenLimit)
            : queryComplexity === "moderate"
              ? Math.min(1500, baseTokenLimit)
              : baseTokenLimit)
        : baseTokenLimit;
      const timeoutProfile: TimeoutProfile = directMode ? "search" : "default";
      // Lowered chat temperature 0.7 -> 0.3 for stronger pool adherence on
      // common topics (Section 302 PPC, cheque dishonour, defamation). Higher
      // temp let the model wander into training-memory citations even with
      // the pool present in context. 0.3 keeps responses natural while
      // making pool-citation tokens dominate the next-token distribution.
      const temperature = directMode ? 0 : 0.3;
      const knowledgeTokensBudget = styleContext
        ? Math.max(300, KNOWLEDGE_PROMPT_TOKEN_BUDGET - estimateTokens(styleContext))
        : KNOWLEDGE_PROMPT_TOKEN_BUDGET;
      // When tool search found judgments, strip the pipeline's case law section to avoid
      // two conflicting "VERIFIED JUDGMENTS" lists confusing the AI. Keep statutes + admin docs.
      const pipelineContext = (toolSearchResult.foundCount > 0 && knowledgeContext)
        ? knowledgeContext
            .replace(/=== VERIFIED JUDGMENTS FROM INTERNAL DATABASE ===[\s\S]*?(?===|$)/g, "")
            .replace(/=== INTERNAL KNOWLEDGE VAULT: CASE LAW ===[\s\S]*?(?===|$)/g, "")
            .trim()
        : knowledgeContext;
      const boundedKnowledgeContext = trimTextToTokenBudget(pipelineContext, knowledgeTokensBudget);
      // Tool search results come first — AI-chosen precise queries, direct DB hits.
      // When tool-search returned judgments, append a hard mandate: the model
      // MUST cite at least 3 of them by their exact formal citation. The
      // trusted-pool integrity check downstream will strip any citation that
      // isn't in this list, so writing case names instead of citations means
      // the user sees nothing in the references panel.
      const toolMandateBlock =
        toolSearchResult.foundCount > 0
          ? `\n\nCITATION MANDATE (REQUIRED — read carefully):\n` +
            `- You MUST cite at least 3 judgments from the AI-SEARCHED JUDGMENTS list above.\n` +
            `- Always use the FORMAL CITATION string, never the case name alone.\n` +
            `  WRONG: "Sohail Iqbal vs State held that..."\n` +
            `  RIGHT: "**[2024 SCMR 1419]** held that..."\n` +
            `  Copy each citation EXACTLY as listed (e.g. "2024 SCMR 1419", "PLD 2020 SC 456", "2019 PCRLJ 1683").\n` +
            `- Do NOT cite any case that is not in the list above — those citations will be removed.\n` +
            `- Do NOT cite from memory or training data, even on familiar topics like Section 302 PPC or cheque dishonour.\n` +
            `- Each cited judgment must appear in your prose AND in the final references block.`
          : "";
      // Tool-search context is now injected as a fake user/assistant turn
      // (see toolSearchTurns below) — NOT in the system prompt. LLMs weight
      // user/assistant content much higher than system content, so framing
      // the pool as "data the user just provided" dramatically improves
      // pool adherence on common topics. systemPromptFull no longer contains
      // the pool itself, only the base prompt + knowledge + style.
      const systemPromptFull =
        systemPrompt
        + boundedKnowledgeContext
        + (styleContext ? `\n\nPERSONAL STYLE MEMORY (generation-only):\n${styleContext}` : "");

      // Build the pool-injection conversation turns. Each turn-pair becomes
      // one user message ("here is the data...") and one assistant message
      // ("acknowledged, will only cite from this list"). Empty when no pool.
      const toolSearchTurns: Array<{ role: "user" | "assistant"; content: string }> =
        toolSearchResult.contextString
          ? [
              {
                role: "user",
                content:
                  `Before answering my next question, please use these Pakistani case-law records I just retrieved from our internal database for this query:\n\n` +
                  `${toolSearchResult.contextString}${toolMandateBlock}`,
              },
              {
                role: "assistant",
                content:
                  `Understood. I will cite at least 3 judgments from this list by their exact formal citation, ` +
                  `not their case names, and I will not cite any judgment that is not in the list above. ` +
                  `What is your legal question?`,
              },
            ]
          : [];
      const useStream = requestedStream && moduleProfile.modelStrategy.stream && selectedRoute !== "apex";
      const routeLabel = selectedRoute === "apex" ? `apex:${selectedApexModel || "auto"}` : selectedRoute;
      const routingPath: string[] = [`profile:${moduleType}`, `route:${routeLabel}`];
      if (selectedRoute === "apex" && selectedApexModel) routingPath.push(`apexModel:${selectedApexModel}`);
      if (directMode) routingPath.push("direct-mode:true");

      const cacheRaw = lastUserMessage ? lastUserMessage.content : JSON.stringify(userMessages);
      const latestUserPromptText = lastUserMessage?.content || "";
      const styleCacheTag = styleContext ? hashQuery("style-context", styleContext).slice(0, 12) : "none";
      const cacheKey = `${cacheRaw}::type=${featureKey}::intent=${moduleIntent || "none"}::profile=${moduleType}::route=${routeLabel}::direct=${directMode ? "1" : "0"}::style=${styleCacheTag}`;
      const normalized = normalizeQuery(cacheKey);
      const hash = hashQuery("ai-chat", normalized);
      let usageFeatureKey = selectedRoute === "apex" ? "chat-apex" : featureKey;

      try {
        const cached = await storage.getCachedResponse("ai-chat", hash);
        if (cached && isCacheFresh(cached.createdAt)) {
          await storage.incrementCacheHit(cached.id).catch(() => {});
          const citationPolicy: CitationPolicy = {
            strict: moduleProfile.features.strictCitations,
            allowProseModification: moduleProfile.features.strictCitations,
          };
          const cachedContent = moduleType === "al-wakeelo" && !directMode
            ? await applyAlWakeeloSafetyGuardrails(cached.response, citationPolicy, toolSearchResult?.verifiedCitations, toolSearchResult?.verifiedTitles).catch(() => ensureAlWakeeloReferencesBlock(cached.response))
            : cached.response;
          const scopedCachedContent = suppressWrongIndianJurisdictionForPakCitation(
            enforcePakistanLawOnlyOutput(cachedContent),
            latestUserPromptText,
          );
          const citationCheckedCached = await enforceInternalCaseCitationIntegrity(scopedCachedContent, {
            placeholder: "",
            normalizeVerified: true,
            requirePrimary: citationPolicy.strict,
            requireLinkedSource: citationPolicy.strict,
            policy: citationPolicy,
            // Tool-search citations came directly from the DB — bypass the
            // resolver to avoid format-variant false-negatives stripping them.
            trustedCitations: toolSearchResult?.verifiedCitations,
          });
          // Cache hit: if SSE is already flushed (live-status path), emit cached content as SSE chunks.
          // Otherwise fall through to the normal JSON response.
          if (sseHeadersFlushed) {
            try {
              res.write(`data: ${JSON.stringify({ text: citationCheckedCached.content })}\n\n`);
              res.write(`data: ${JSON.stringify({ done: true, model: usedModel, fromCache: true, moduleProfile: moduleProfile.id, routingPath })}\n\n`);
            } catch {}
            res.end();
            return;
          }
          return res.json({
            content: citationCheckedCached.content,
            model: usedModel,
            fromCache: true,
            moduleProfile: moduleProfile.id,
            routingPath,
            styleMemory: styleMemoryMeta || undefined,
          });
        }
      } catch {}

      if (useStream) {
        // Open SSE if not already done (live-status path opened it earlier).
        ensureSseOpen();

        let fullContent = "";
        const writeChunkToClient = (text: string) => {
          const chunk = text || "";
          if (!chunk) return;
          fullContent += chunk;
          res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        };
        try {
          const baseMessages = buildMessages(systemPromptFull, geminiContents);
          // Inject tool-search pool as user/assistant turns RIGHT before the
          // final user message. Splices toolSearchTurns at the index of the
          // last user message so the model sees: [system, ...prior turns,
          // user(pool), assistant(ack), user(actual question)].
          const lastUserIdx = baseMessages.map(m => m.role).lastIndexOf("user");
          const streamMessages = lastUserIdx >= 0 && toolSearchTurns.length > 0
            ? [...baseMessages.slice(0, lastUserIdx), ...toolSearchTurns, ...baseMessages.slice(lastUserIdx)]
            : baseMessages;
          // Al Wakeelo: tool-searched judgments + pipeline statutes injected via systemPromptFull.
          if (isAiRouterV2Enabled()) {
            // V2 router: used for all non-al-wakeelo modules (draft, contract, etc.)
            const chain = selectedRoute === "turbo" ? DEFAULT_TURBO_CHAIN : DEFAULT_STANDARD_CHAIN;
            const result = await streamWithFallback(chain, {
              messages: streamMessages,
              maxTokens: tokenLimit,
              temperature,
              onChunk: writeChunkToClient,
              onProviderError: (p, err) => {
                console.warn(`[AI Router] Stream provider ${p} failed: ${err instanceof Error ? err.message : String(err)}`);
              },
            });
            usedModel = result.modelName;
            routingPath.push(`router:v2:${result.provider}`);
          } else if (selectedRoute === "turbo") {
            usedModel = getDeepSeekProModelName();
            for await (const text of streamWithDeepSeek({
              messages: streamMessages,
              model: getDeepSeekProModelName(),
              maxTokens: tokenLimit,
              temperature,
            })) {
              writeChunkToClient(text);
            }
          } else {
            // Standard mode (non-router v2): use DeepSeek instead of Groq (Groq deprecated 2026-04-16)
            usedModel = "deepseek";
            for await (const text of streamWithDeepSeek({
              messages: streamMessages,
              maxTokens: tokenLimit,
              temperature,
            })) {
              writeChunkToClient(text);
            }
          }
        } catch (streamErr: any) {
          console.error("[AI Chat] Stream error:", streamErr?.message || streamErr);
          // If the router already committed to the wire (tokensEmitted > 0), preserve what we have.
          const partial = (streamErr && typeof streamErr === "object" && "partialText" in streamErr)
            ? String((streamErr as any).partialText || "")
            : "";
          if (!fullContent && partial) fullContent = partial;
          if (!fullContent) {
            res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
            res.end();
            return;
          }
          // Partial content exists — close the stream gracefully so the client
          // keeps what it already has rather than discarding the whole response.
          res.write(`data: ${JSON.stringify({ warning: "Upstream interrupted — returning partial response" })}\n\n`);
        }

        fullContent = suppressWrongIndianJurisdictionForPakCitation(fullContent, latestUserPromptText);
        // Phase 1+3: Pass policy to guardrails
        if (moduleType === "al-wakeelo" && !directMode) {
          const citationPolicy: CitationPolicy = {
            strict: moduleProfile.features.strictCitations,
            allowProseModification: moduleProfile.features.strictCitations,
          };
          const adjusted = await applyAlWakeeloSafetyGuardrails(fullContent, citationPolicy, toolSearchResult?.verifiedCitations, toolSearchResult?.verifiedTitles).catch(() => ensureAlWakeeloReferencesBlock(fullContent));
          if (adjusted !== fullContent) {
            fullContent = adjusted;
            res.write(`data: ${JSON.stringify({ reset: true })}\n\n`);
            res.write(`data: ${JSON.stringify({ text: adjusted })}\n\n`);
          }
        }
        const scopedFullContent = enforcePakistanLawOnlyOutput(fullContent);
        if (scopedFullContent !== fullContent) {
          fullContent = scopedFullContent;
          res.write(`data: ${JSON.stringify({ reset: true })}\n\n`);
          res.write(`data: ${JSON.stringify({ text: scopedFullContent })}\n\n`);
        }
        // Phase 1: Use module profile to determine citation policy
        const citationPolicy: CitationPolicy = {
          strict: moduleProfile.features.strictCitations,
          allowProseModification: moduleProfile.features.strictCitations, // Only modify prose in strict mode
        };
        const citationCheckedStream = await enforceInternalCaseCitationIntegrity(fullContent, {
          placeholder: "",
          normalizeVerified: true,
          requirePrimary: citationPolicy.strict,
          requireLinkedSource: citationPolicy.strict,
          policy: citationPolicy,
          // Tool-search verified citations bypass the resolver — they came
          // straight from the DB, format-variant lookups should not strip them.
          trustedCitations: toolSearchResult?.verifiedCitations,
        });
        if (citationCheckedStream.content !== fullContent) {
          fullContent = citationCheckedStream.content;
          res.write(`data: ${JSON.stringify({ reset: true })}\n\n`);
          res.write(`data: ${JSON.stringify({ text: fullContent })}\n\n`);
        }

        routingPath.push(`model:${usedModel}`);
        res.write(
          `data: ${JSON.stringify({ done: true, model: usedModel, moduleProfile: moduleProfile.id, routingPath, styleMemory: styleMemoryMeta || undefined })}\n\n`,
        );
        res.end();

        if (fullContent) {
          const inputText = systemPromptFull + userMessages.map(m => m.content).join(" ");
          await logUsageCost(userId, usageFeatureKey, usedModel, inputText, fullContent);
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

      let result: { text: string; model: string };
      if (selectedRoute === "apex") {
        const allowedApexModels = getApexModelsForTier(normalizedTier).map((m) => m.id as ApexModel);
        if (!selectedApexModel) {
          selectedApexModel = allowedApexModels[0] || null;
        }
        if (!selectedApexModel) {
          return res.status(403).json({ message: `No Apex models are available for your ${normalizedTier} plan` });
        }
        const apexSystemPrompt = buildApexModeSystemPrompt(
          systemPromptFull,
          selectedApexModel,
          moduleType,
          extractedAttachmentCount > 0,
        );
        routingPath.push(`apex-profile:${selectedApexModel}`);
        const apexMessages = buildMessages(apexSystemPrompt, geminiContents);
        const apexResult = await callApexAIPrimary(
          apexMessages,
          selectedApexModel,
          allowedApexModels,
          tokenLimit,
        );
        result = { text: apexResult.text, model: apexResult.model };
      } else if (isAiRouterV2Enabled()) {
        const chain = selectedRoute === "turbo" ? DEFAULT_TURBO_CHAIN : DEFAULT_STANDARD_CHAIN;
        const baseNonStreamMessages = buildMessages(systemPromptFull, geminiContents);
        const lastUserIdxNS = baseNonStreamMessages.map(m => m.role).lastIndexOf("user");
        const nonStreamMessages = lastUserIdxNS >= 0 && toolSearchTurns.length > 0
          ? [...baseNonStreamMessages.slice(0, lastUserIdxNS), ...toolSearchTurns, ...baseNonStreamMessages.slice(lastUserIdxNS)]
          : baseNonStreamMessages;
        const routerResult = await callWithFallback(chain, {
          messages: nonStreamMessages,
          maxTokens: tokenLimit,
          temperature,
        });
        const safeText = assertNonEmptyModelOutput(routerResult.provider, routerResult.content);
        result = { text: enforcePakistanLawOnlyOutput(safeText), model: routerResult.modelName };
        routingPath.push(`router:v2:${routerResult.provider}`);
      } else {
        // All modules use regular AI (tool-calling disabled, using RAG-injected cases instead)
        const baseAiCall = selectedRoute === "turbo" ? callTurboAI : callStandardAI;
        result = await baseAiCall(systemPromptFull, geminiContents, tokenLimit, { timeoutProfile, temperature });
      }
      usedModel = result.model;
      routingPath.push(`model:${usedModel}`);
      let completion = suppressWrongIndianJurisdictionForPakCitation(result.text, latestUserPromptText);

      if (moduleType === "al-wakeelo" && !directMode) {
        // Use module profile strictCitations — hardcoded true was stripping valid judgments-table citations
        completion = await applyAlWakeeloSafetyGuardrails(completion, { strict: enforcePrimaryLinkedSourceCitations, allowProseModification: false }, toolSearchResult?.verifiedCitations, toolSearchResult?.verifiedTitles).catch(() => ensureAlWakeeloReferencesBlock(completion));
      }
      // Always run drafting normalizer for draft module — strips markdown
      // (#, **bold**, ---, etc.) and aligns party captions. The previous
      // intent-prefix gate meant requests without an explicit moduleIntent
      // (e.g. direct chat-style draft requests) bypassed the normalizer
      // and emitted raw markdown that no Pakistani court accepts.
      if (moduleType === "draft") {
        completion = normalizeCourtReadyDraftingText(completion);
      }
      if (moduleType === "contract-drafting" && moduleIntent === "contract.generateDraft") {
        completion = normalizeDraftingText(completion);
      }
      if (moduleType === "contract-drafting" && (moduleIntent === "contract.clauseSuggest" || moduleIntent === "contract.redline")) {
        let normalizedContractJson = normalizeStrictContractJson(moduleIntent, completion);
        if (!normalizedContractJson.valid) {
          const repairAiCall = selectedRoute === "turbo" ? callTurboAI : callStandardAI;
          const repairPrompt =
            moduleIntent === "contract.clauseSuggest"
              ? `Repair the response into STRICT JSON format: {"suggestions":[{"title":"...","subtitle":"...","prompt":"..."}]}. Return ONLY JSON.\n\nOriginal output:\n${completion}`
              : `Repair the response into STRICT JSON format: {"edits":[{"title":"...","rationale":"...","originalSnippet":"...","suggestedText":"..."}]}. Return ONLY JSON.\n\nOriginal output:\n${completion}`;
          const repairResult = await repairAiCall(systemPromptFull, [{ role: "user", parts: [{ text: repairPrompt }] }], tokenLimit, { timeoutProfile: "analysis", temperature: 0.2 });
          usedModel = repairResult.model;
          routingPath.push(`repair:${usedModel}`);
          normalizedContractJson = normalizeStrictContractJson(moduleIntent, repairResult.text);
        }
        completion = normalizedContractJson.normalized;
      }
      completion = enforcePakistanLawOnlyOutput(completion);
      const citationPolicy: CitationPolicy = {
        strict: enforcePrimaryLinkedSourceCitations,
        allowProseModification: enforcePrimaryLinkedSourceCitations,
      };
      completion = (await enforceInternalCaseCitationIntegrity(completion, {
        placeholder: "",
        normalizeVerified: true,
        requirePrimary: enforcePrimaryLinkedSourceCitations,
        requireLinkedSource: enforcePrimaryLinkedSourceCitations,
        policy: citationPolicy,
        trustedCitations: toolSearchResult?.verifiedCitations,
      })).content;
      completion = assertNonEmptyModelOutput("AI route", completion);

      const inputText = systemPromptFull + userMessages.map(m => m.content).join(" ");
      try {
        await logUsageCost(userId, usageFeatureKey, usedModel, inputText, completion);
      } catch (usageErr) {
        // Do not fail user-facing chat if analytics logging is temporarily unavailable.
        console.warn("[AI Chat] Usage logging failed:", getErrorMessage(usageErr));
      }
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
      const detail = getErrorMessage(err);
      console.error("Error in AI chat:", err);
      if (isExtractionQueueFullError(err)) {
        return sendExtractionBusy(res);
      }
      if (/apex monthly cap reached/i.test(detail)) {
        return res.status(429).json({ message: detail });
      }
      if (/empty model output/i.test(detail)) {
        return res.status(503).json({ message: "AI model returned empty output. Please retry." });
      }
      if (/apex ai is not configured|no apex models are available|timed out|timeout|temporarily unavailable|service unavailable/i.test(detail)) {
        return res.status(503).json({ message: detail });
      }
      res.status(500).json({ message: `Failed to process AI chat: ${detail}` });
    } finally {
      releaseInteractiveChatRequest();
    }
  });

  app.post(api.ai.searchJudgments.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const allowed = await checkUsageLimit(userId, "search-judgments", res);
      if (!allowed) return;

      const body = (req.body || {}) as Record<string, unknown>;
      const safeQuery = String(body.query || "").trim();
      const yearRaw = Number(body.year);
      const pageRaw = Number(body.page);
      const reportRaw = normalizeCitationToken(String(body.report || body.journal || "").trim());
      const courtRaw = String(body.court || "").trim();
      const sortRaw = String(body.sort || "").trim().toLowerCase();
      const parsedCitation = parseCaseLawCitationQuery(safeQuery);

      const year = Number.isInteger(yearRaw) && yearRaw >= 1900 && yearRaw <= 2200
        ? yearRaw
        : (parsedCitation?.year ?? undefined);
      const page = Number.isInteger(pageRaw) && pageRaw > 0
        ? pageRaw
        : (parsedCitation?.page ?? undefined);
      const report = reportRaw || parsedCitation?.report || undefined;
      const sort = sortRaw === "latest" ? "latest" : "relevance";

      if (!safeQuery && !year && !report && !page && !courtRaw) {
        return res.status(400).json({ message: "Query or citation fields are required" });
      }

      const results = await searchCaseLawWithFullText({
        userId,
        query: safeQuery,
        limit: 20,
        year,
        report,
        page,
        court: courtRaw || undefined,
        sort,
        parsedCitation,
      });
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
      const knowledgeContext = await gatherKnowledgeContextV2(searchTerm, userId);

      let fullText = "";
      try {
        const parsedLookupCitation = parseCaseLawCitationQuery(citation || searchTerm);
        const candidateRows = await searchCaseLawWithFullText({
          userId,
          query: searchTerm,
          limit: 25,
          year: parsedLookupCitation?.year,
          report: parsedLookupCitation?.report,
          page: parsedLookupCitation?.page,
          parsedCitation: parsedLookupCitation,
          sort: "relevance",
        });
        const normalizedTitleForMatch = normalizeTextForMatch(title || "");
        let bestRow: CaseLaw | null = null;
        let bestScore = -1;
        for (const row of candidateRows) {
          let score = scoreCaseLawTextMatch(row, searchTerm);
          if (citation && caseCitationMatches(citation, row.citation)) score += 120;
          if (normalizedTitleForMatch) {
            const rowTitleNorm = normalizeTextForMatch(row.title || "");
            if (rowTitleNorm === normalizedTitleForMatch) score += 80;
            else if (rowTitleNorm.includes(normalizedTitleForMatch) || normalizedTitleForMatch.includes(rowTitleNorm)) score += 40;
          }
          if (score > bestScore) {
            bestScore = score;
            bestRow = row;
          }
        }
        if (bestRow) {
          fullText = await loadCaseLawSourceText(bestRow, userId, { includeMetadataFallback: false });
        }

        // Fallback path only if strict case-law resolution fails.
        if (fullText.trim()) {
          // strict path succeeded
        } else {
        const normalize = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();
        const citationNorm = citation ? normalize(citation) : "";
        const stopWords = new Set(["the", "and", "for", "with", "from", "this", "that", "case", "state", "versus", "pakistan", "government", "court", "high", "supreme", "lahore", "karachi", "islamabad", "peshawar", "quetta"]);
        const titleWords = title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3 && !stopWords.has(w));

        const validateMatch = (_content: string, docTitle: string): boolean => {
          const docTitleNorm = normalize(docTitle);
          if (citationNorm.length >= 6 && docTitleNorm.includes(citationNorm)) {
            return true;
          }
          const citationParts = citation
            ? citation.match(new RegExp(`\\b(?:${CASELAW_REPORT_FLEX_PATTERN})\\s*\\d{4}\\b`, "i"))
            : null;
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
        const knowledgeContext = await gatherKnowledgeContextV2(query);
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

      let briefModel = "deepseek"; // UPDATED: Changed from getGroqModelName() (Groq deprecated 2026-04-16)
      const { content: brief, fromCache } = await getCachedOrCall("brief", cacheKey, async () => {
        const knowledgeContext = await gatherKnowledgeContextV2(`${shortTitle} ${section} ${description}`);
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
        const knowledgeContext = await gatherKnowledgeContextV2(`${draftTitle}\n${draftText.slice(0, 2000)}`, userId);
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
        const result = await callLegalDraftingAI(sysInstruction, userInput, TOKEN_LIMITS.draft, {
          timeoutProfile: "analysis",
          temperature: 0.25,
        });
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

  app.post("/api/ai/draft-recommendations", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);

    const normalizePakistaniLawOnlyText = (value: string): string => {
      if (!value) return "";
      return value
        .replace(/\bsection\s+(\d+[A-Za-z-]*)\s+of\s+ipc\b/gi, "Section $1 PPC")
        .replace(/\bIndian Penal Code\b/gi, "Pakistan Penal Code, 1860")
        .replace(/\bIPC\b/gi, "PPC")
        .replace(/\bCode of Criminal Procedure,\s*1973\b/gi, "Code of Criminal Procedure, 1898")
        .replace(/\bCrPC\b/gi, "Cr.P.C.")
        .replace(/\bCr\.?\s*P\.?\s*C\.?\s*1973\b/gi, "Cr.P.C.")
        .replace(/\bIndian Evidence Act\b/gi, "Qanun-e-Shahadat Order, 1984")
        .replace(/\bConstitution of India\b/gi, "Constitution of Islamic Republic of Pakistan, 1973")
        .replace(/\bSupreme Court of India\b/gi, "Supreme Court of Pakistan")
        .replace(/\bHigh Courts? of India\b/gi, "High Courts of Pakistan")
        .trim();
    };

    try {
      const allowed = await checkUsageLimit(userId, "draft", res);
      if (!allowed) return;

      const { title, content, maxEdits } = req.body as { title?: string; content?: string; maxEdits?: number };
      const draftText = (content || "").trim();
      if (!draftText) {
        return res.json({ edits: [] });
      }

      const draftTitle = (title || "Untitled Draft").trim();
      const safeMaxEdits = Math.max(1, Math.min(10, Number(maxEdits) || 6));
      const cacheKey = `${draftTitle}\n\n${draftText.slice(0, 16000)}\nmax:${safeMaxEdits}`;

      const { content: responseText, fromCache } = await getCachedOrCall("draft-recommendations", cacheKey, async () => {
        const knowledgeContext = await gatherKnowledgeContextV2(`${draftTitle}\n${draftText.slice(0, 2000)}`, userId);
        const sysInstruction = `You are a Pakistani court drafting redline assistant.

TASK:
Review the user's legal draft and propose concrete, court-ready improvements.
Focus on pleading quality, legal precision, clarity, structure, jurisdictional framing, and prayer language.

OUTPUT FORMAT (STRICT):
Return ONLY valid JSON with this exact shape:
{
  "edits": [
    {
      "id": "short-stable-id",
      "title": "Short edit title",
      "reason": "Why this change improves the pleading",
      "originalSnippet": "Exact excerpt from user's draft to replace (can be empty if adding new text)",
      "suggestedText": "Improved replacement text in clean court-ready format",
      "impact": "high" | "medium" | "low"
    }
  ]
}

RULES:
- Return 1 to ${safeMaxEdits} edits when meaningful improvements exist; otherwise return {"edits":[]}.
- Use plain legal text only inside snippets and suggested text (no markdown symbols).
- Keep originalSnippet short and exact.
- Keep suggestedText specific and filing-ready for Pakistani court drafting.
- Never cite Indian statutes as authority: IPC, Indian Penal Code, CrPC 1973, Constitution of India, Indian Evidence Act.
- Indian judgments (SCC, AIR) are permitted as persuasive authority.
- Use Pakistani legal references only (for example: PPC, Cr.P.C., Constitution of Islamic Republic of Pakistan 1973, PLD, SCMR, YLR, MLD, CLC, CLD, PCRLJ).
- If a safe Pakistani equivalent is unclear, use a neutral placeholder like [Pakistani legal provision required] instead of inventing or using Indian citations.
- Do not include markdown, code fences, or extra keys.${knowledgeContext}`;

        const userInput = `Draft Title: ${draftTitle}\n\nDraft Content:\n${draftText.slice(0, 16000)}`;
        const result = await callLegalDraftingAI(sysInstruction, userInput, TOKEN_LIMITS.draft, { timeoutProfile: "analysis", temperature: 0.2 });
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

      const rawEdits = Array.isArray(parsed?.edits) ? parsed.edits : [];
      const seen = new Set<string>();
      const edits = rawEdits
        .slice(0, safeMaxEdits)
        .map((edit: any, idx: number) => {
          const titleText = typeof edit?.title === "string" && edit.title.trim()
            ? normalizePakistaniLawOnlyText(edit.title.trim())
            : `Recommended change ${idx + 1}`;
          const reasonText = typeof edit?.reason === "string" && edit.reason.trim()
            ? normalizePakistaniLawOnlyText(edit.reason.trim())
            : "Improves clarity and legal quality of the pleading.";
          const originalSnippet = typeof edit?.originalSnippet === "string" ? edit.originalSnippet.trim().slice(0, 1000) : "";
          const suggestedText = typeof edit?.suggestedText === "string"
            ? normalizePakistaniLawOnlyText(edit.suggestedText.trim().slice(0, 2000))
            : "";
          const impact = edit?.impact === "high" || edit?.impact === "low" ? edit.impact : "medium";
          const idText = typeof edit?.id === "string" && edit.id.trim()
            ? edit.id.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 48)
            : `edit-${idx + 1}`;
          return {
            id: idText || `edit-${idx + 1}`,
            title: titleText,
            reason: reasonText,
            originalSnippet,
            suggestedText,
            impact,
          };
        })
        .filter((edit: any) => {
          if (!edit.suggestedText) return false;
          const dedupeKey = `${edit.originalSnippet}::${edit.suggestedText}`.toLowerCase();
          if (seen.has(dedupeKey)) return false;
          seen.add(dedupeKey);
          return true;
        });

      res.json({ edits, fromCache });
    } catch (err) {
      console.error("Error generating draft recommendations:", err);
      res.status(500).json({ message: "Failed to generate draft recommendations" });
    }
  });

  // ====== ADMIN ROUTES ======

  async function extractPdfTextSafe(sourceBuffer: Buffer, context: string = "pdf-parse"): Promise<string> {
    const text = await extractPdfTextGuarded(sourceBuffer, {
      timeoutMs: EXTRACTION_TIMEOUT_MS,
      context,
    });
    return stripNullBytes(text);
  }

  async function refineChatOcrTextWithStandardAI(rawText: string, filename: string): Promise<string> {
    const cleanedRaw = stripNullBytes(rawText || "").trim();
    if (!cleanedRaw) return "";

    const enabled = !/^(0|false|no|off)$/i.test(String(process.env.CHAT_OCR_STANDARD_AI_ENABLED || "true"));
    if (!enabled) return cleanedRaw;

    try {
      const boundedRaw = trimTextToTokenBudget(cleanedRaw, 3500);
      const systemPrompt = `${getLegalSystemPrompt()}

You are an OCR cleanup assistant for legal text.
- Clean OCR noise and obvious recognition artifacts.
- Preserve legal meaning, citations, section numbers, party names, and dates exactly.
- Do not summarize, add, or remove substantive content.
- Return plain text only (no markdown).`;

      const userPrompt = `Filename: ${filename}

Clean this OCR text while preserving legal content exactly:
${boundedRaw}`;

      const result = await callStandardAISimple(systemPrompt, userPrompt, 3500, {
        timeoutProfile: "analysis",
        temperature: 0,
      });

      const refined = stripNullBytes((result.text || "").trim());
      if (!refined) return cleanedRaw;
      // Guardrail: if model output is suspiciously short, keep original OCR text.
      if (refined.length < Math.max(120, Math.floor(cleanedRaw.length * 0.45))) {
        return cleanedRaw;
      }
      return refined;
    } catch (err) {
      console.warn(`[OCR][chat-attachment] Standard AI cleanup failed for ${filename}: ${getErrorMessage(err)}`);
      return cleanedRaw;
    }
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
    const sourceBuffer = getUploadBufferOrThrow(file);
    const requestedLanguage = process.env.TESSERACT_OCR_LANG || process.env.TESSERACT_LANG || "eng+urd";
    let lastOcrError: unknown = null;

    const localOcrAvailable = await isPdfOcrAvailable();
    if (localOcrAvailable) {
      try {
        const result = await extractPdfOcrGuarded(sourceBuffer, {
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
          if (context === "chat-attachment") {
            const refined = await refineChatOcrTextWithStandardAI(text, file.originalname);
            return stripNullBytes(refined);
          }
          return text;
        }
        lastOcrError = new Error("Local OCR returned empty text.");
      } catch (err) {
        if (isExtractionQueueFullError(err)) {
          throw err;
        }
        lastOcrError = err;
        console.warn(`[OCR][${context}] Local OCR failed for ${file.originalname}: ${getErrorMessage(err)}`);
      }
    }

    if (!isCloudPdfOcrAvailable()) {
      return "";
    }

    try {
      const cloudResult = await ocrPdfWithCloud(sourceBuffer, {
        filename: file.originalname,
        language: requestedLanguage,
        timeoutMs: Number(process.env.CLOUD_OCR_TIMEOUT_MS || process.env.PDF_OCR_TIMEOUT_MS || 120000),
        maxPages: Number(process.env.CLOUD_OCR_MAX_PAGES || 3),
      });
      const text = stripNullBytes((cloudResult.text || "").trim());
      if (text) {
        console.log(
          `[OCR][${context}] Cloud OCR extracted ${text.length} chars from ${file.originalname} using ${cloudResult.pageCount} page(s), language ${cloudResult.language}.`,
        );
        if (context === "chat-attachment") {
          const refined = await refineChatOcrTextWithStandardAI(text, file.originalname);
          return stripNullBytes(refined);
        }
      } else {
        lastOcrError = new Error("Cloud OCR returned empty text.");
      }
      return text;
    } catch (err) {
      lastOcrError = err;
      console.warn(`[OCR][${context}] Cloud OCR failed for ${file.originalname}: ${getErrorMessage(err)}`);
    }

    if (lastOcrError) {
      throw new Error(`OCR fallback failed: ${getErrorMessage(lastOcrError)}`);
    }

    return "";
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
      const { subscriptionTier, subscriptionCycle, isAdmin: adminFlag, resetMonthlyQuota } = req.body;

      const validTiers = ["free", "standard", "pro", "chamber", "enterprise"];
      const validCycles = ["monthly", "quarterly", "yearly"];
      if (subscriptionTier !== undefined && !validTiers.includes(subscriptionTier)) {
        return res.status(400).json({ message: "Invalid subscription tier" });
      }
      if (subscriptionCycle !== undefined && !validCycles.includes(String(subscriptionCycle).toLowerCase())) {
        return res.status(400).json({ message: "Invalid subscription cycle" });
      }
      if (adminFlag !== undefined && typeof adminFlag !== "boolean") {
        return res.status(400).json({ message: "isAdmin must be a boolean" });
      }
      if (resetMonthlyQuota !== undefined && typeof resetMonthlyQuota !== "boolean") {
        return res.status(400).json({ message: "resetMonthlyQuota must be a boolean" });
      }
      if (adminFlag === false && targetId === currentUserId) {
        return res.status(400).json({ message: "You cannot remove your own admin access" });
      }

      let updated;
      let quotaReset: { before: number; deleted: number; after: number; windowStart: Date } | null = null;
      if (subscriptionTier !== undefined || subscriptionCycle !== undefined) {
        const existing = await storage.getUserProfile(targetId);
        if (!existing) return res.status(404).json({ message: "User not found" });

        const normalizedTier = normalizeTier(subscriptionTier ?? existing.subscriptionTier);
        const normalizedCycle = normalizeBillingCycle(subscriptionCycle ?? existing.subscriptionCycle);
        const isFreeTier = normalizedTier === "free";
        const cycleWindow = isFreeTier ? null : getSubscriptionWindow(normalizedCycle, new Date());

        updated = await storage.updateUserSubscription(targetId, {
          subscriptionTier: normalizedTier,
          subscriptionCycle: isFreeTier ? "monthly" : normalizedCycle,
          subscriptionStartAt: cycleWindow?.startAt ?? null,
          subscriptionEndAt: cycleWindow?.endAt ?? null,
        });

        if (updated && subscriptionTier !== undefined) {
          // Subscription reassignment refreshes this month's usage ledger.
          quotaReset = await storage.resetMonthlyUsageCount(targetId);
        }
      }
      if (adminFlag !== undefined) {
        updated = await storage.updateUserAdminStatus(targetId, adminFlag);
      }
      if (resetMonthlyQuota === true && subscriptionTier === undefined && subscriptionCycle === undefined) {
        updated = updated || (await storage.getUserProfile(targetId));
        if (!updated) return res.status(404).json({ message: "User not found" });
        quotaReset = await storage.resetMonthlyUsageCount(targetId);
      }

      if (!updated) return res.status(404).json({ message: "User not found" });
      await logAuditEvent("admin.user.update", currentUserId, targetId, {
        subscriptionTier: subscriptionTier ?? undefined,
        subscriptionCycle: subscriptionCycle ?? undefined,
        isAdmin: adminFlag ?? undefined,
        resetMonthlyQuota: !!quotaReset,
        quotaResetDeleted: quotaReset?.deleted ?? 0,
      });
      res.json(updated);
    } catch (err) {
      console.error("Error updating user:", err);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.post("/api/admin/users/:id/reset-monthly-quota", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const currentUserId = getUserId(req);
      const targetId = req.params.id;
      const target = await storage.getUserProfile(targetId);
      if (!target) return res.status(404).json({ message: "User not found" });

      const quotaReset = await storage.resetMonthlyUsageCount(targetId);
      await logAuditEvent("admin.user.resetQuota", currentUserId, targetId, {
        deleted: quotaReset.deleted,
        before: quotaReset.before,
        after: quotaReset.after,
        windowStart: quotaReset.windowStart.toISOString(),
      });

      return res.json({
        message: "Monthly quota reset successfully",
        ...quotaReset,
      });
    } catch (err) {
      console.error("Error resetting monthly quota:", err);
      return res.status(500).json({ message: "Failed to reset monthly quota" });
    }
  });

  app.post("/api/admin/users", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const { email, password, firstName, lastName, subscriptionTier, subscriptionCycle, isAdmin: makeAdmin } = req.body;
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
        emailVerified: true,
        emailVerifiedAt: new Date(),
      });
      const validTiers = ["free", "standard", "pro", "chamber", "enterprise"];
      const normalizedTier = validTiers.includes(String(subscriptionTier || "").toLowerCase())
        ? String(subscriptionTier).toLowerCase()
        : "free";
      const normalizedCycle = normalizeBillingCycle(subscriptionCycle);
      const cycleWindow = normalizedTier === "free" ? null : getSubscriptionWindow(normalizedCycle, new Date());
      const subscribedUser = await storage.updateUserSubscription(user.id, {
        subscriptionTier: normalizedTier,
        subscriptionCycle: normalizedTier === "free" ? "monthly" : normalizedCycle,
        subscriptionStartAt: cycleWindow?.startAt ?? null,
        subscriptionEndAt: cycleWindow?.endAt ?? null,
      });
      const createdUser = subscribedUser || user;
      if (makeAdmin === true) {
        await storage.updateUserAdminStatus(createdUser.id, true);
      }
      await logAuditEvent("admin.user.create", getUserId(req), user.id, {
        email,
        subscriptionTier: normalizedTier,
        subscriptionCycle: normalizedTier === "free" ? "monthly" : normalizedCycle,
        isAdmin: makeAdmin === true,
      });
      res.status(201).json({ message: "User created successfully", user: createdUser });
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
      const targetUser = await storage.getUserProfile(targetId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      await storage.deleteUser(targetId);

      // Log with null target_user_id because the user row is already deleted.
      await logAuditEvent("admin.user.delete", currentUserId, null, {
        deletedUserId: targetId,
        deletedEmail: targetUser.email || null,
      }).catch((auditErr) => {
        console.warn("Audit log failed for admin.user.delete:", auditErr);
      });

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

  app.post("/api/admin/knowledge", guardedUploadQueue, upload.array("files", Math.min(2000, ADMIN_UPLOAD_MAX_FILES)), cleanupDiskUploadFilesAfterResponse, async (req, res) => {
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
          if (!hasSafeDocumentSignature(stableFile, ext)) {
            recordSecurityEvent("upload_signature_failure", `admin-knowledge:${userId}`, {
              filename: file.originalname,
              ext,
              mimetype: file.mimetype,
            });
            errors.push(`${file.originalname}: file signature does not match declared format`);
            continue;
          }
          const malwareCheck = await passesMalwareScan(stableFile);
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

          const normalizedCategory = String(category || "general").toLowerCase();
          const preserveFullText = normalizedCategory === "case-law";
          const compacted = preserveFullText ? { inlineContent: content, wasTruncated: false } : compactContentForDb(content);
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
            category: normalizedCategory,
            uploadedBy: userId,
          });
          maybeIndexAdminCaseLawInBackground({
            adminKnowledgeId: doc.id,
            category: normalizedCategory,
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
        maybeIndexAdminCaseLawInBackground({
          adminKnowledgeId: doc.id,
          category: category || "general",
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
        indexing: {
          autoIndexOnUpload: ADMIN_UPLOAD_AUTO_INDEX,
          deferred: !ADMIN_UPLOAD_AUTO_INDEX,
        },
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
      const knowledgeDoc = await storage.getAdminKnowledgeById(id);
      const fileMeta = await storage.getAdminKnowledgeFile(id);
      if (fileMeta?.provider === "r2") {
        const keys = [fileMeta.objectKey, fileMeta.extractedTextKey].filter((k): k is string => !!k);
        await Promise.allSettled(keys.map((key) => deleteR2Object(key)));
      }
      await storage.deleteAdminKnowledge(id);
      const sourceUserId = isAdminKnowledgeCaseLawCategory(knowledgeDoc?.category)
        ? GLOBAL_CASELAW_RAG_USER_ID
        : GLOBAL_ADMIN_KNOWLEDGE_RAG_USER_ID;
      await deleteDocumentVectors(id, sourceUserId);
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
      const allKnowledge = await storage.getAllAdminKnowledge();
      const fileMetas = await storage.getAdminKnowledgeFiles();
      const count = await storage.deleteAllAdminKnowledge();
      const caseLawIds = allKnowledge
        .filter((doc) => isAdminKnowledgeCaseLawCategory(doc.category))
        .map((doc) => doc.id);
      const nonCaseLawIds = allKnowledge
        .filter((doc) => !isAdminKnowledgeCaseLawCategory(doc.category))
        .map((doc) => doc.id);
      await Promise.allSettled([
        ...caseLawIds.map((id) => deleteDocumentVectors(id, GLOBAL_CASELAW_RAG_USER_ID)),
        ...nonCaseLawIds.map((id) => deleteDocumentVectors(id, GLOBAL_ADMIN_KNOWLEDGE_RAG_USER_ID)),
      ]);
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

  app.get("/api/admin/case-law/bad-index/audit", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const sourceKind = normalizeCaseLawBadIndexSourceKind(req.query.source);
      const minRows = Math.max(5, Math.min(5000, toCaseLawBadIndexInt(req.query.minRows, 20)));
      const limit = Math.max(1, Math.min(1000, toCaseLawBadIndexInt(req.query.limit, 100)));
      const [duplicateStats, targets] = await Promise.all([
        getCaseLawDuplicateStats(),
        loadCaseLawBadIndexTargets(sourceKind, minRows, limit),
      ]);
      return res.json({
        ok: true,
        sourceKind,
        minRows,
        limit,
        generatedAt: new Date().toISOString(),
        duplicateStats,
        targets,
        jobStatus: snapshotCaseLawBadIndexReextractJob(),
      });
    } catch (err) {
      console.error("Error auditing case law bad index targets:", err);
      return res.status(500).json({ message: "Failed to audit bad index targets" });
    }
  });

  app.get("/api/admin/case-law/bad-index/reextract/status", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    return res.json({ ok: true, status: snapshotCaseLawBadIndexReextractJob() });
  });

  app.post("/api/admin/case-law/bad-index/reextract/start", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
      if (caseLawBadIndexReextractJob.running) {
        return res.status(409).json({
          ok: false,
          message: "Targeted bad-index re-extract job is already running",
          status: snapshotCaseLawBadIndexReextractJob(),
        });
      }

      const payload = z.object({
        source: z.enum(["admin", "github", "statute", "user", "all"]).optional(),
        minRows: z.number().int().min(5).max(5000).optional(),
        limit: z.number().int().min(1).max(1000).optional(),
        maxCitations: z.number().int().min(1).max(200).optional(),
      }).parse(req.body || {});

      caseLawBadIndexReextractJob.running = true;
      caseLawBadIndexReextractJob.shouldStop = false;
      caseLawBadIndexReextractJob.sourceKind = normalizeCaseLawBadIndexSourceKind(payload.source || "admin");
      caseLawBadIndexReextractJob.minRows = Math.max(5, Math.min(5000, Number(payload.minRows || 20)));
      caseLawBadIndexReextractJob.limit = Math.max(1, Math.min(1000, Number(payload.limit || 100)));
      caseLawBadIndexReextractJob.maxCitations = Math.max(1, Math.min(200, Number(payload.maxCitations || 40)));
      caseLawBadIndexReextractJob.totalTargets = 0;
      caseLawBadIndexReextractJob.processedTargets = 0;
      caseLawBadIndexReextractJob.reindexedTargets = 0;
      caseLawBadIndexReextractJob.skippedNoSource = 0;
      caseLawBadIndexReextractJob.skippedNoExtract = 0;
      caseLawBadIndexReextractJob.replacedRows = 0;
      caseLawBadIndexReextractJob.insertedRows = 0;
      caseLawBadIndexReextractJob.activeTarget = null;
      caseLawBadIndexReextractJob.startedAt = new Date();
      caseLawBadIndexReextractJob.finishedAt = null;
      caseLawBadIndexReextractJob.lastError = null;

      await logAuditEvent("admin.caseLaw.badIndexReextract.start", actorUserId, null, {
        source: caseLawBadIndexReextractJob.sourceKind,
        minRows: caseLawBadIndexReextractJob.minRows,
        limit: caseLawBadIndexReextractJob.limit,
        maxCitations: caseLawBadIndexReextractJob.maxCitations,
      });

      runInBackground("case-law-bad-index-reextract", async () => {
        try {
          const targets = await loadCaseLawBadIndexTargets(
            caseLawBadIndexReextractJob.sourceKind,
            caseLawBadIndexReextractJob.minRows,
            caseLawBadIndexReextractJob.limit,
          );
          caseLawBadIndexReextractJob.totalTargets = targets.length;

          for (const target of targets) {
            if (caseLawBadIndexReextractJob.shouldStop) break;
            caseLawBadIndexReextractJob.activeTarget = {
              sourceType: target.sourceType,
              sourceDocId: target.sourceDocId,
              sourceFilename: target.sourceFilename,
            };
            caseLawBadIndexReextractJob.processedTargets += 1;

            try {
              const result = await reextractCaseLawForSourceTarget(target, caseLawBadIndexReextractJob.maxCitations);
              if (result.skipped === "no-source") {
                caseLawBadIndexReextractJob.skippedNoSource += 1;
              } else if (result.skipped === "no-extract") {
                caseLawBadIndexReextractJob.skippedNoExtract += 1;
              } else {
                caseLawBadIndexReextractJob.reindexedTargets += 1;
                caseLawBadIndexReextractJob.replacedRows += result.replaced;
                caseLawBadIndexReextractJob.insertedRows += result.inserted;
              }
            } catch (targetErr: any) {
              caseLawBadIndexReextractJob.lastError = sanitizeInputText(
                targetErr?.message || `Target failed: ${target.sourceType}:${target.sourceDocId}`,
                400,
              );
              console.warn(
                `[CaseLaw][bad-index-reextract] Target failed ${target.sourceType}:${target.sourceDocId}:`,
                targetErr?.message || targetErr,
              );
            }
          }
        } catch (err: any) {
          caseLawBadIndexReextractJob.lastError = sanitizeInputText(err?.message || "Unknown error", 400);
        } finally {
          caseLawBadIndexReextractJob.running = false;
          caseLawBadIndexReextractJob.activeTarget = null;
          caseLawBadIndexReextractJob.finishedAt = new Date();
          try {
            await logAuditEvent("admin.caseLaw.badIndexReextract.finish", actorUserId, null, {
              stopped: caseLawBadIndexReextractJob.shouldStop,
              source: caseLawBadIndexReextractJob.sourceKind,
              totalTargets: caseLawBadIndexReextractJob.totalTargets,
              processedTargets: caseLawBadIndexReextractJob.processedTargets,
              reindexedTargets: caseLawBadIndexReextractJob.reindexedTargets,
              skippedNoSource: caseLawBadIndexReextractJob.skippedNoSource,
              skippedNoExtract: caseLawBadIndexReextractJob.skippedNoExtract,
              replacedRows: caseLawBadIndexReextractJob.replacedRows,
              insertedRows: caseLawBadIndexReextractJob.insertedRows,
              lastError: caseLawBadIndexReextractJob.lastError,
            });
          } catch (auditErr) {
            console.warn("[CaseLaw][bad-index-reextract] Failed to write finish audit log:", auditErr);
          }
          caseLawBadIndexReextractJob.shouldStop = false;
        }
      });

      return res.json({
        ok: true,
        message: "Targeted bad-index re-extract started in background",
        status: snapshotCaseLawBadIndexReextractJob(),
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid payload" });
      }
      console.error("Error starting bad-index re-extract:", err);
      return res.status(500).json({ message: "Failed to start targeted bad-index re-extract" });
    }
  });

  app.post("/api/admin/case-law/bad-index/reextract/stop", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    if (!caseLawBadIndexReextractJob.running) {
      return res.status(409).json({
        ok: false,
        message: "No targeted bad-index re-extract job is running",
        status: snapshotCaseLawBadIndexReextractJob(),
      });
    }
    caseLawBadIndexReextractJob.shouldStop = true;
    return res.json({
      ok: true,
      message: "Stop signal sent. Job will stop after current document.",
      status: snapshotCaseLawBadIndexReextractJob(),
    });
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
      const citationSync = shouldAutoSyncCaseLawUploads()
        ? await syncCaseLawEntriesToJudgments([created], actorUserId || "")
        : undefined;
      await logAuditEvent("admin.caseLaw.create", actorUserId, null, { id: created.id, citation: created.citation });
      res.status(201).json({
        ...created,
        citationSync,
        citationSyncDeferred: !citationSync,
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

  app.post("/api/admin/case-law/extract-client", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const userId = getUserId(req)!;
      const body = (req.body || {}) as {
        filename?: string;
        content?: string;
        sourceType?: string;
        fileHash?: string;
        confidence?: number;
        cases?: Array<{ citation?: string; court?: string; title?: string; summary?: string; keywords?: string[] | string }>;
      };

      const filename = sanitizeInputText(body.filename || "browser-upload.txt", 180);
      const ext = filename.split(".").pop()?.toLowerCase() || "txt";
      if (!["txt", "text", "md", "json", "csv", "pdf"].includes(ext)) {
        return res.status(400).json({ message: "Client extraction supports TXT, MD, JSON, CSV, and PDF text-only payloads." });
      }

      const content = stripNullBytes(String(body.content || "").trim());
      if (!content || content.length < 10) {
        return res.status(400).json({ message: "Client-extracted content is empty or too short." });
      }
      if (content.length > 2_500_000) {
        return res.status(413).json({ message: "Client-extracted content exceeds limit (2.5M chars)." });
      }

      const incomingCases = Array.isArray(body.cases) ? body.cases : [];
      const validCases: Array<{ citation: string; court: string; title: string; summary: string; keywords: string[] }> = [];
      const seen = new Set<string>();
      for (const row of incomingCases.slice(0, 5000)) {
        const citation = sanitizeInputText(row?.citation || "", 140);
        const title = sanitizeInputText(row?.title || "", 260);
        if (!citation || !title) continue;
        const key = `${citation.toLowerCase()}|${title.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const keywords = Array.isArray(row?.keywords)
          ? row!.keywords.map((k) => sanitizeInputText(String(k), 64)).filter(Boolean).slice(0, 12)
          : (typeof row?.keywords === "string"
            ? row.keywords.split(",").map((k) => sanitizeInputText(k, 64)).filter(Boolean).slice(0, 12)
            : []);
        validCases.push({
          citation,
          court: sanitizeInputText(row?.court || "", 160),
          title,
          summary: sanitizeInputText(row?.summary || "", 5000),
          keywords,
        });
      }
      const roleAwareCases = assignCitationRolesToCases(content, validCases, { sourceFilename: filename });

      let savedDocId: number | null = null;
      const savedFilename = filename;
      try {
        const docTitle = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Uploaded Case Law Document";
        const extractedTextKey = null;
        const persistedContent = content;
        const savedDoc = await storage.addAdminKnowledge({
          title: docTitle,
          filename,
          content: persistedContent,
          category: "case-law",
          uploadedBy: userId,
        });
        savedDocId = savedDoc.id;
        maybeIndexAdminCaseLawInBackground({
          adminKnowledgeId: savedDoc.id,
          category: "case-law",
        });

        runInBackground(`case-law-client-r2:${savedDoc.id}`, async () => {
          await uploadAdminKnowledgeFileToR2({
            docId: savedDoc.id,
            userId,
            buffer: Buffer.from(content, "utf-8"),
            fileName: filename,
            mimeType: "text/plain; charset=utf-8",
            sizeBytes: Buffer.byteLength(content, "utf-8"),
            source: "admin-case-law-extract-client",
            extractedTextKey,
          });
        });

        runInBackground(`case-law-client-audit:${savedDoc.id}`, async () => {
          await logAuditEvent("admin.caseLaw.extractClient", userId, null, {
            filename,
            savedDocId: savedDoc.id,
            extractedLength: content.length,
            sourceType: sanitizeInputText(body.sourceType || "browser-hybrid", 64),
            confidence: Number.isFinite(Number(body.confidence)) ? Number(body.confidence) : null,
            fileHash: sanitizeInputText(body.fileHash || "", 128) || null,
            caseCount: roleAwareCases.length,
          });
        });
      } catch (saveErr) {
        console.error("[Case Law Client Extract] Failed to save document:", saveErr);
      }

      const caseLawSave = await persistExtractedCasesAndSync({
        extractedCases: roleAwareCases,
        sourceDocId: savedDocId,
        sourceFilename: savedFilename,
        actorUserId: userId,
      });
      kickCaseLawUploadBackgroundPipelines(userId);

      return res.json({
        extracted: roleAwareCases.length,
        truncated: false,
        originalLength: content.length,
        cases: roleAwareCases,
        savedDocId,
        savedFilename,
        caseLawSave,
        autoSavedToCaseLaw: true,
        source: "client",
      });
    } catch (err) {
      console.error("Error in client-side case law extraction ingest:", err);
      return res.status(500).json({ message: "Failed to ingest client-side extracted case law" });
    }
  });

  app.post("/api/admin/case-law/bulk", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
      const { entries, sourceDocId, sourceFilename } = req.body as {
        entries: Array<{
          citation: string;
          citationRole?: "primary" | "cited" | string;
          court: string;
          title: string;
          summary: string;
          keywords: string | string[];
        }>;
        sourceDocId?: number;
        sourceFilename?: string;
      };
      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ message: "Entries array is required" });
      }
      const errors: string[] = [];
      const valid: Array<{
        citation: string;
        court: string;
        title: string;
        summary: string;
        keywords: string[];
        citationRole?: "primary" | "cited";
        sourceDocId?: number;
        sourceType?: string;
        sourceFilename?: string;
        _rowNumber: number;
      }> = [];
      const seen = new Set<string>();
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const rowNumber = i + 1;
        const citation = sanitizeInputText(stripNullBytes(String(e?.citation || "").trim()), 220);
        const title = sanitizeInputText(stripNullBytes(String(e?.title || "").trim()), 500);
        const court = sanitizeInputText(stripNullBytes(String(e?.court || "").trim()), 180);
        const summary = sanitizeInputText(stripNullBytes(String(e?.summary || "").trim()), 20000);
        const citationRole = String((e as any)?.citationRole || "").toLowerCase() === "primary" ? "primary" : "cited";
        if (!citation || !title) {
          errors.push(`Row ${i + 1}: Missing required fields (citation and title)`);
          continue;
        }
        const dedupeKey = `${citation.toLowerCase()}|${title.toLowerCase()}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        const kw = Array.isArray(e.keywords)
          ? e.keywords
          : (typeof e.keywords === "string"
            ? e.keywords.split(",")
            : []);
        const keywords = kw
          .map((k: string) => sanitizeInputText(stripNullBytes(String(k || "").trim()), 64))
          .filter(Boolean)
          .slice(0, 30);
        const entry: any = { citation, citationRole, court, title, summary, keywords, _rowNumber: rowNumber };
        if (sourceDocId) {
          entry.sourceDocId = sourceDocId;
          entry.sourceType = "admin";
          entry.sourceFilename = sourceFilename || "";
        }
        valid.push(entry);
      }
      const created: Array<{
        id: number;
        citation: string;
        court: string;
        title: string;
        summary: string;
        sourceDocId?: number | null;
        sourceType?: string | null;
      }> = [];

      const insertBatchSize = 150;
      for (let i = 0; i < valid.length; i += insertBatchSize) {
        const chunk = valid.slice(i, i + insertBatchSize);
        const chunkForInsert = chunk.map(({ _rowNumber, ...rest }) => rest);
        try {
          const insertedChunk = await storage.bulkCreateCaseLaw(chunkForInsert as any);
          created.push(...insertedChunk);
        } catch (chunkErr: any) {
          // Fallback to row-level insert so one bad row does not fail the whole save request.
          for (const row of chunk) {
            const { _rowNumber, ...entry } = row;
            try {
              const inserted = await storage.createCaseLaw(entry as any);
              created.push(inserted as any);
            } catch (rowErr: any) {
              errors.push(`Row ${_rowNumber}: ${sanitizeInputText(rowErr?.message || "Insert failed", 300)}`);
            }
          }
          console.warn("[Case Law Bulk] Batch fallback activated:", sanitizeInputText(chunkErr?.message || "Unknown error", 300));
        }
      }
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
      if (created.length > 0 && actorUserId && shouldAutoSyncCaseLawUploads()) {
        const syncBatch = created.slice(0, CASELAW_AUTO_SYNC_MAX);
        citationSync = await syncCaseLawEntriesToJudgments(syncBatch, actorUserId);
      }
      if (created.length > 0 && actorUserId) {
        kickCaseLawUploadBackgroundPipelines(actorUserId);
      }
      await logAuditEvent("admin.caseLaw.bulkCreate", actorUserId, null, { inserted: created.length, errors: errors.length, sourceDocId: sourceDocId || null });
      res.status(201).json({
        inserted: created.length,
        errors,
        citationSync,
        citationSyncLimited: created.length > CASELAW_AUTO_SYNC_MAX,
        citationSyncDeferred: !citationSync,
      });
    } catch (err) {
      console.error("Error bulk creating case law:", err);
      res.status(500).json({ message: "Failed to bulk create case law" });
    }
  });

  async function ensureCaseLawSyncToJudgmentsBackground(actorUserId: string, options?: { batchSize?: number; reason?: string }) {
    const batchSize = Math.max(100, Math.min(5000, Number(options?.batchSize) || caseLawSyncToJudgmentsJob.batchSize || 1500));
    if (caseLawSyncToJudgmentsJob.running) {
      return { started: false, status: snapshotCaseLawSyncToJudgmentsJob() };
    }

    caseLawSyncToJudgmentsJob.running = true;
    caseLawSyncToJudgmentsJob.shouldStop = false;
    caseLawSyncToJudgmentsJob.batchSize = batchSize;
    caseLawSyncToJudgmentsJob.nextCursorId = null;
    caseLawSyncToJudgmentsJob.processed = 0;
    caseLawSyncToJudgmentsJob.imported = 0;
    caseLawSyncToJudgmentsJob.existing = 0;
    caseLawSyncToJudgmentsJob.skipped = 0;
    caseLawSyncToJudgmentsJob.failed = 0;
    caseLawSyncToJudgmentsJob.linked = 0;
    caseLawSyncToJudgmentsJob.unresolved = 0;
    caseLawSyncToJudgmentsJob.startedAt = new Date();
    caseLawSyncToJudgmentsJob.finishedAt = null;
    caseLawSyncToJudgmentsJob.lastError = null;
    caseLawSyncToJudgmentsJob.activeRange = null;
    caseLawSyncToJudgmentsJob.errors = [];

    await logAuditEvent("admin.caseLaw.syncToJudgments.start", actorUserId, null, {
      mode: "full",
      batchSize,
      reason: sanitizeInputText(options?.reason || "manual", 80),
    });

    runInBackground("case-law-sync-to-judgments", async () => {
      try {
        while (!caseLawSyncToJudgmentsJob.shouldStop) {
          await pauseBackgroundForInteractiveChat();
          const batch = await fetchCaseLawEntriesForSync({
            cursorId: caseLawSyncToJudgmentsJob.nextCursorId,
            batchSize: caseLawSyncToJudgmentsJob.batchSize,
          });
          if (batch.length === 0) break;

          const ids = batch.map((row) => Number(row.id)).filter((id) => Number.isInteger(id));
          caseLawSyncToJudgmentsJob.activeRange = ids.length > 0
            ? { fromId: Math.max(...ids), toId: Math.min(...ids) }
            : null;

          const syncResult = await syncCaseLawEntriesToJudgments(batch, actorUserId || "");
          caseLawSyncToJudgmentsJob.processed += Number(syncResult.processed || 0);
          caseLawSyncToJudgmentsJob.imported += Number(syncResult.imported || 0);
          caseLawSyncToJudgmentsJob.existing += Number(syncResult.existing || 0);
          caseLawSyncToJudgmentsJob.skipped += Number(syncResult.skipped || 0);
          caseLawSyncToJudgmentsJob.failed += Number(syncResult.failed || 0);
          caseLawSyncToJudgmentsJob.linked += Number(syncResult.linked || 0);
          caseLawSyncToJudgmentsJob.unresolved += Number(syncResult.unresolved || 0);
          for (const message of syncResult.errors || []) {
            pushCappedJobError(caseLawSyncToJudgmentsJob.errors, message);
          }

          const minId = ids.length > 0 ? Math.min(...ids) : 0;
          caseLawSyncToJudgmentsJob.nextCursorId = minId > 0 ? minId : null;
          await pauseBackgroundForInteractiveChat();
        }

        await logAuditEvent("admin.caseLaw.syncToJudgments.finish", actorUserId, null, {
          mode: "full",
          stopped: caseLawSyncToJudgmentsJob.shouldStop,
          processed: caseLawSyncToJudgmentsJob.processed,
          imported: caseLawSyncToJudgmentsJob.imported,
          existing: caseLawSyncToJudgmentsJob.existing,
          skipped: caseLawSyncToJudgmentsJob.skipped,
          failed: caseLawSyncToJudgmentsJob.failed,
          linked: caseLawSyncToJudgmentsJob.linked,
          unresolved: caseLawSyncToJudgmentsJob.unresolved,
          errors: caseLawSyncToJudgmentsJob.errors.slice(0, 50),
        });
      } catch (err: any) {
        caseLawSyncToJudgmentsJob.lastError = sanitizeInputText(err?.message || "Citation sync failed", 300);
        pushCappedJobError(caseLawSyncToJudgmentsJob.errors, caseLawSyncToJudgmentsJob.lastError);
        try {
          await logAuditEvent("admin.caseLaw.syncToJudgments.fail", actorUserId, null, {
            error: caseLawSyncToJudgmentsJob.lastError,
          });
        } catch {
          // best-effort audit
        }
      } finally {
        caseLawSyncToJudgmentsJob.running = false;
        caseLawSyncToJudgmentsJob.shouldStop = false;
        caseLawSyncToJudgmentsJob.activeRange = null;
        caseLawSyncToJudgmentsJob.finishedAt = new Date();
      }
    });

    return { started: true, status: snapshotCaseLawSyncToJudgmentsJob() };
  }

  async function ensureCaseLawProcessPendingFilesBackground(actorUserId: string, options?: { batchSize?: number; reason?: string }) {
    const batchSize = Math.max(25, Math.min(1000, Number(options?.batchSize) || caseLawProcessPendingFilesJob.batchSize || 200));
    if (caseLawProcessPendingFilesJob.running) {
      return { started: false, status: snapshotCaseLawProcessPendingFilesJob() };
    }

    caseLawProcessPendingFilesJob.running = true;
    caseLawProcessPendingFilesJob.shouldStop = false;
    caseLawProcessPendingFilesJob.batchSize = batchSize;
    caseLawProcessPendingFilesJob.loops = 0;
    caseLawProcessPendingFilesJob.processed = 0;
    caseLawProcessPendingFilesJob.extractedDocuments = 0;
    caseLawProcessPendingFilesJob.insertedRows = 0;
    caseLawProcessPendingFilesJob.failed = 0;
    caseLawProcessPendingFilesJob.skippedNoText = 0;
    caseLawProcessPendingFilesJob.skippedNoCases = 0;
    caseLawProcessPendingFilesJob.startedAt = new Date();
    caseLawProcessPendingFilesJob.finishedAt = null;
    caseLawProcessPendingFilesJob.lastError = null;
    caseLawProcessPendingFilesJob.activeDocId = null;
    caseLawProcessPendingFilesJob.activeFilename = null;
    caseLawProcessPendingFilesJob.errors = [];

    await logAuditEvent("admin.caseLaw.processPendingFiles.start", actorUserId, null, {
      batchSize,
      reason: sanitizeInputText(options?.reason || "manual", 80),
    });

    runInBackground("case-law-process-pending-files", async () => {
      try {
        while (!caseLawProcessPendingFilesJob.shouldStop) {
          await pauseBackgroundForInteractiveChat();
          const pendingDocs = await fetchPendingCaseLawAdminDocs(caseLawProcessPendingFilesJob.batchSize);
          if (pendingDocs.length === 0) break;
          caseLawProcessPendingFilesJob.loops += 1;

          for (const pending of pendingDocs) {
            if (caseLawProcessPendingFilesJob.shouldStop) break;
            await pauseBackgroundForInteractiveChat();
            caseLawProcessPendingFilesJob.processed += 1;
            caseLawProcessPendingFilesJob.activeDocId = pending.id;
            caseLawProcessPendingFilesJob.activeFilename = sanitizeInputText(
              pending.filename || pending.title || `admin-knowledge-${pending.id}.txt`,
              240,
            ) || `admin-knowledge-${pending.id}.txt`;

            const result = await processSinglePendingCaseLawAdminDoc(
              pending,
              actorUserId,
              {
                parsePdfSafe: (buffer) => extractPdfTextSafe(buffer, "admin-case-law-process-pending"),
                parsePdfWithOcrFallback: (file) => extractPdfTextWithOcrFallback(file, "admin-case-law-process-pending"),
                parseDocxSafe: (buffer) => extractDocxTextSafe(buffer, "admin-case-law-process-pending"),
              },
              {
                pauseForInteractive: pauseBackgroundForInteractiveChat,
              },
            );
            caseLawProcessPendingFilesJob.extractedDocuments += result.extractedDocuments;
            caseLawProcessPendingFilesJob.insertedRows += result.insertedRows;
            caseLawProcessPendingFilesJob.failed += result.failed;
            caseLawProcessPendingFilesJob.skippedNoText += result.skippedNoText;
            caseLawProcessPendingFilesJob.skippedNoCases += result.skippedNoCases;
            for (const message of result.errors) {
              pushCappedJobError(caseLawProcessPendingFilesJob.errors, message);
            }
            await pauseBackgroundForInteractiveChat();
          }
        }

        await logAuditEvent("admin.caseLaw.processPendingFiles.finish", actorUserId, null, {
          stopped: caseLawProcessPendingFilesJob.shouldStop,
          loops: caseLawProcessPendingFilesJob.loops,
          processed: caseLawProcessPendingFilesJob.processed,
          extractedDocuments: caseLawProcessPendingFilesJob.extractedDocuments,
          insertedRows: caseLawProcessPendingFilesJob.insertedRows,
          failed: caseLawProcessPendingFilesJob.failed,
          skippedNoText: caseLawProcessPendingFilesJob.skippedNoText,
          skippedNoCases: caseLawProcessPendingFilesJob.skippedNoCases,
          errors: caseLawProcessPendingFilesJob.errors.slice(0, 50),
        });
      } catch (err: any) {
        caseLawProcessPendingFilesJob.lastError = sanitizeInputText(err?.message || "Process-pending failed", 300);
        pushCappedJobError(caseLawProcessPendingFilesJob.errors, caseLawProcessPendingFilesJob.lastError);
        try {
          await logAuditEvent("admin.caseLaw.processPendingFiles.fail", actorUserId, null, {
            error: caseLawProcessPendingFilesJob.lastError,
          });
        } catch {
          // best-effort audit
        }
      } finally {
        caseLawProcessPendingFilesJob.running = false;
        caseLawProcessPendingFilesJob.shouldStop = false;
        caseLawProcessPendingFilesJob.activeDocId = null;
        caseLawProcessPendingFilesJob.activeFilename = null;
        caseLawProcessPendingFilesJob.finishedAt = new Date();
      }
    });

    return { started: true, status: snapshotCaseLawProcessPendingFilesJob() };
  }

  function kickCaseLawUploadBackgroundPipelines(actorUserId: string) {
    runInBackground("case-law-upload-auto-pipelines", async () => {
      if (CASELAW_AUTO_PROCESS_PENDING_ON_UPLOAD) {
        await ensureCaseLawProcessPendingFilesBackground(actorUserId, { reason: "upload-auto" });
      }
      if (CASELAW_AUTO_FULL_SYNC_ON_UPLOAD) {
        await ensureCaseLawSyncToJudgmentsBackground(actorUserId, { reason: "upload-auto" });
      }
    });
  }

  app.post("/api/admin/case-law/sync-to-judgments", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
      const payload = (req.body || {}) as { caseLawIds?: number[]; limit?: number; batchSize?: number };
      const requestedIds = Array.isArray(payload.caseLawIds)
        ? payload.caseLawIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
        : [];
      const limit = Math.max(1, Math.min(5000, Number(payload.limit) || 1000));
      const batchSize = Math.max(100, Math.min(5000, Number(payload.batchSize) || 1500));

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
        const syncResult = await syncCaseLawEntriesToJudgments(entries, actorUserId || "");
        await logAuditEvent("admin.caseLaw.syncToJudgments", actorUserId, null, {
          requested: requestedIds.length,
          ...syncResult,
          mode: "targeted",
        });
        return res.json(syncResult);
      }

      const kickoff = await ensureCaseLawSyncToJudgmentsBackground(actorUserId || "", {
        batchSize,
        reason: "manual",
      });
      if (!kickoff.started) {
        return res.status(409).json({
          ok: false,
          message: "Citation sync job is already running",
          status: kickoff.status,
        });
      }
      return res.json({
        ok: true,
        message: "Citation sync started in background and will continue until all rows are scanned.",
        status: kickoff.status,
      });
    } catch (err) {
      console.error("Error syncing case law to judgments:", err);
      res.status(500).json({ message: "Failed to sync case law to citation database" });
    }
  });

  app.get("/api/admin/case-law/sync-to-judgments/status", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    return res.json({ ok: true, status: snapshotCaseLawSyncToJudgmentsJob() });
  });

  app.post("/api/admin/case-law/sync-to-judgments/stop", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    if (!caseLawSyncToJudgmentsJob.running) {
      return res.status(409).json({
        ok: false,
        message: "No running citation sync job",
        status: snapshotCaseLawSyncToJudgmentsJob(),
      });
    }
    caseLawSyncToJudgmentsJob.shouldStop = true;
    return res.json({
      ok: true,
      message: "Citation sync stop requested",
      status: snapshotCaseLawSyncToJudgmentsJob(),
    });
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

  app.post("/api/admin/case-law/process-pending-files", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req)!;
      const payload = (req.body || {}) as { limit?: number; batchSize?: number };
      const batchSize = Math.max(25, Math.min(1000, Number(payload.batchSize || payload.limit || 200)));

      const kickoff = await ensureCaseLawProcessPendingFilesBackground(actorUserId, {
        batchSize,
        reason: "manual",
      });
      if (!kickoff.started) {
        return res.status(409).json({
          ok: false,
          message: "Process-pending job is already running",
          status: kickoff.status,
        });
      }

      return res.json({
        ok: true,
        message: "Pending case-law processing started in background and will continue until no pending docs remain.",
        status: kickoff.status,
      });
    } catch (err: any) {
      console.error("Error processing pending case-law files:", err);
      return res.status(500).json({ message: "Failed to process pending case-law files" });
    }
  });

  app.get("/api/admin/case-law/process-pending-files/status", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    return res.json({ ok: true, status: snapshotCaseLawProcessPendingFilesJob() });
  });

  app.get("/api/admin/case-law/process-pending-files/diagnostics", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const topErrorLimit = Math.max(1, Math.min(100, Number(req.query?.topErrors || 12)));
      const diagnostics = await getCaseLawPendingDiagnostics({ topErrorLimit });
      return res.json({ ok: true, ...diagnostics });
    } catch (err) {
      console.error("Error loading process-pending diagnostics:", err);
      return res.status(500).json({ message: "Failed to load process-pending diagnostics" });
    }
  });

  app.post("/api/admin/case-law/process-pending-files/retry-terminal", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
      const payload = (req.body || {}) as { statuses?: string[] | string; limit?: number };
      const statuses = normalizeCaseLawRetryTerminalStatuses(payload.statuses);
      const limit = Math.max(1, Math.min(50000, Number(payload.limit) || 5000));

      const retried = await retryCaseLawTerminalDocs({ statuses, limit });
      await logAuditEvent("admin.caseLaw.processPendingFiles.retryTerminal", actorUserId, null, {
        statuses: retried.requestedStatuses,
        scanned: retried.scanned,
        updated: retried.updated,
        statusBreakdown: retried.statusBreakdown,
      });

      return res.json({
        ok: true,
        message: retried.updated > 0
          ? `Marked ${retried.updated.toLocaleString()} terminal case-law docs for retry`
          : "No matching terminal docs were found for retry",
        ...retried,
        status: snapshotCaseLawProcessPendingFilesJob(),
      });
    } catch (err) {
      console.error("Error retrying terminal process-pending docs:", err);
      return res.status(500).json({ message: "Failed to retry terminal process-pending docs" });
    }
  });

  app.post("/api/admin/case-law/process-pending-files/stop", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    if (!caseLawProcessPendingFilesJob.running) {
      return res.status(409).json({
        ok: false,
        message: "No running process-pending job",
        status: snapshotCaseLawProcessPendingFilesJob(),
      });
    }
    caseLawProcessPendingFilesJob.shouldStop = true;
    return res.json({
      ok: true,
      message: "Process-pending stop requested",
      status: snapshotCaseLawProcessPendingFilesJob(),
    });
  });

  app.post("/api/admin/case-law/reindex-roles/start", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    try {
      const actorUserId = getUserId(req);
      if (caseLawCitationRoleReindexJob.running) {
        return res.status(409).json({
          ok: false,
          message: "Case-law citation role reindex is already running",
          status: snapshotCaseLawCitationRoleReindexJob(),
        });
      }

      caseLawCitationRoleReindexJob.running = true;
      caseLawCitationRoleReindexJob.shouldStop = false;
      caseLawCitationRoleReindexJob.startedAt = new Date();
      caseLawCitationRoleReindexJob.finishedAt = null;
      caseLawCitationRoleReindexJob.lastError = null;
      caseLawCitationRoleReindexJob.progress = null;

      await logAuditEvent("admin.caseLaw.reindexRoles.start", actorUserId, null, {});

      runInBackground("case-law-role-reindex", async () => {
        try {
          const result = await reindexCaseLawFromAllExistingSources({
            shouldStop: () => caseLawCitationRoleReindexJob.shouldStop,
            onProgress: (progress) => {
              caseLawCitationRoleReindexJob.progress = progress;
            },
          });
          caseLawCitationRoleReindexJob.progress = {
            running: false,
            source: caseLawCitationRoleReindexJob.progress?.source || "user",
            totalDocuments: result.totalDocuments,
            processedDocuments: result.processedDocuments,
            extractedCitations: result.extractedCitations,
            savedCitations: result.savedCitations,
            failedDocuments: result.failedDocuments,
            stopped: result.stopped,
            done: true,
          };
          await logAuditEvent("admin.caseLaw.reindexRoles.finish", actorUserId, null, {
            ...result,
          });
        } catch (err: any) {
          caseLawCitationRoleReindexJob.lastError = sanitizeInputText(err?.message || "Case-law citation role reindex failed", 300);
          try {
            await logAuditEvent("admin.caseLaw.reindexRoles.fail", actorUserId, null, {
              error: caseLawCitationRoleReindexJob.lastError,
            });
          } catch {
            // best-effort audit
          }
        } finally {
          caseLawCitationRoleReindexJob.running = false;
          caseLawCitationRoleReindexJob.shouldStop = false;
          caseLawCitationRoleReindexJob.finishedAt = new Date();
        }
      });

      return res.json({
        ok: true,
        message: "Case-law citation role reindex started in background",
        status: snapshotCaseLawCitationRoleReindexJob(),
      });
    } catch (err) {
      console.error("Error starting case-law citation role reindex:", err);
      return res.status(500).json({ message: "Failed to start case-law citation role reindex" });
    }
  });

  app.get("/api/admin/case-law/reindex-roles/status", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    return res.json({ ok: true, status: snapshotCaseLawCitationRoleReindexJob() });
  });

  app.post("/api/admin/case-law/reindex-roles/stop", async (req, res) => {
    if (!(await isAdmin(req, res))) return;
    if (!caseLawCitationRoleReindexJob.running) {
      return res.status(409).json({
        ok: false,
        message: "No running case-law citation role reindex job",
        status: snapshotCaseLawCitationRoleReindexJob(),
      });
    }
    caseLawCitationRoleReindexJob.shouldStop = true;
    return res.json({
      ok: true,
      message: "Case-law citation role reindex stop requested",
      status: snapshotCaseLawCitationRoleReindexJob(),
    });
  });

  app.post("/api/admin/case-law/extract", guardedUploadQueue, upload.single("file"), cleanupDiskUploadFilesAfterResponse, async (req, res) => {
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
      const signatureExt = (extWithDot === ".text" || extWithDot === ".md") ? ".txt" : extWithDot;
      if (![".pdf", ".doc", ".docx", ".txt", ".text", ".md", ".json", ".csv"].includes(extWithDot)) {
        return res.status(400).json({ message: "Supported formats: PDF, DOC, DOCX, TXT, MD, JSON, CSV" });
      }
      if (!hasSafeDocumentSignature(stableFile, signatureExt)) {
        recordSecurityEvent("upload_signature_failure", "admin-case-law-extract", {
          filename: file.originalname,
          ext: extWithDot,
          mimetype: file.mimetype,
        });
        return res.status(400).json({ message: "File signature does not match declared format" });
      }
      const extractMalwareCheck = await passesMalwareScan(stableFile);
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
      } else if (ext === "txt" || ext === "text" || ext === "md") {
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
              const mappedWithRoles = assignCitationRolesToCases(rawJson, mapped, { sourceFilename: file.originalname });
              const uid = getUserId(req)!;
              let jsonDocId: number | null = null;
              try {
                const docTitle = file.originalname.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Uploaded Case Law Document";
                const extractedTextKey = null;
                const persistedContent = rawJson;
                const savedDoc = await storage.addAdminKnowledge({ title: docTitle, filename: file.originalname, content: persistedContent, category: "case-law", uploadedBy: uid });
                jsonDocId = savedDoc.id;
                maybeIndexAdminCaseLawInBackground({
                  adminKnowledgeId: savedDoc.id,
                  category: "case-law",
                });
                runInBackground(`case-law-json-r2:${savedDoc.id}`, async () => {
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
                });
                console.log(`[Case Law Extract] Saved JSON document as admin_knowledge id=${jsonDocId}`);
              } catch (saveErr) {
                console.error("[Case Law Extract] Failed to save JSON document:", saveErr);
              }
              const caseLawSave = await persistExtractedCasesAndSync({
                extractedCases: mappedWithRoles,
                sourceDocId: jsonDocId,
                sourceFilename: file.originalname,
                actorUserId: uid,
              });
              kickCaseLawUploadBackgroundPipelines(uid);
              return res.json({
                extracted: mappedWithRoles.length,
                truncated: false,
                originalLength: rawJson.length,
                cases: mappedWithRoles,
                savedDocId: jsonDocId,
                savedFilename: file.originalname,
                caseLawSave,
                autoSavedToCaseLaw: true,
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
              const entriesWithRoles = assignCitationRolesToCases(rawCsv, entries, { sourceFilename: file.originalname });
              const uid = getUserId(req)!;
              let csvDocId: number | null = null;
              try {
                const docTitle = file.originalname.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Uploaded Case Law Document";
                const extractedTextKey = null;
                const persistedContent = rawCsv;
                const savedDoc = await storage.addAdminKnowledge({ title: docTitle, filename: file.originalname, content: persistedContent, category: "case-law", uploadedBy: uid });
                csvDocId = savedDoc.id;
                maybeIndexAdminCaseLawInBackground({
                  adminKnowledgeId: savedDoc.id,
                  category: "case-law",
                });
                runInBackground(`case-law-csv-r2:${savedDoc.id}`, async () => {
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
                });
                console.log(`[Case Law Extract] Saved CSV document as admin_knowledge id=${csvDocId}`);
              } catch (saveErr) {
                console.error("[Case Law Extract] Failed to save CSV document:", saveErr);
              }
              const caseLawSave = await persistExtractedCasesAndSync({
                extractedCases: entriesWithRoles,
                sourceDocId: csvDocId,
                sourceFilename: file.originalname,
                actorUserId: uid,
              });
              kickCaseLawUploadBackgroundPipelines(uid);
              return res.json({
                extracted: entriesWithRoles.length,
                truncated: false,
                originalLength: rawCsv.length,
                cases: entriesWithRoles,
                savedDocId: csvDocId,
                savedFilename: file.originalname,
                caseLawSave,
                autoSavedToCaseLaw: true,
              });
            }
          }
        }
        content = rawCsv;
      } else {
        return res.status(400).json({ message: "Supported formats: PDF, DOC, DOCX, TXT, MD, JSON, CSV" });
      }

      if (!content || content.length < 10) {
        return res.status(400).json({ message: "Document appears empty or too short to extract case law from." });
      }

      const userId = getUserId(req)!;
      let savedDocId: number | null = null;
      let savedFilename = file.originalname;
      try {
        const docTitle = file.originalname.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Uploaded Case Law Document";
        const extractedTextKey = null;
        const persistedContent = content;
        const savedDoc = await storage.addAdminKnowledge({
          title: docTitle,
          filename: file.originalname,
          content: persistedContent,
          category: "case-law",
          uploadedBy: userId,
        });
        savedDocId = savedDoc.id;
        maybeIndexAdminCaseLawInBackground({
          adminKnowledgeId: savedDoc.id,
          category: "case-law",
        });
        runInBackground(`case-law-r2:${savedDoc.id}`, async () => {
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
        });
        console.log(`[Case Law Extract] Saved document as admin_knowledge id=${savedDocId}: "${docTitle}"`);
        runInBackground(`case-law-audit:${savedDoc.id}`, async () => {
          await logAuditEvent("admin.caseLaw.extract", userId, null, {
            filename: file.originalname,
            savedDocId: savedDoc.id,
            extractedLength: content.length,
          });
        });
      } catch (saveErr) {
        console.error("[Case Law Extract] Failed to save document to knowledge base:", saveErr);
      }

      const extracted = nlpExtractCases(content, { sourceFilename: file.originalname });
      const validCases = extracted.filter(c => c.citation && c.title);
      const caseLawSave = await persistExtractedCasesAndSync({
        extractedCases: validCases,
        sourceDocId: savedDocId,
        sourceFilename: savedFilename || file.originalname,
        actorUserId: userId,
      });
      kickCaseLawUploadBackgroundPipelines(userId);

      res.json({
        extracted: validCases.length,
        truncated: false,
        originalLength: content.length,
        cases: validCases,
        savedDocId,
        savedFilename,
        caseLawSave,
        autoSavedToCaseLaw: true,
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

  app.post("/api/admin/statute-documents", guardedUploadQueue, upload.array("files", Math.min(500, ADMIN_UPLOAD_MAX_FILES)), cleanupDiskUploadFilesAfterResponse, async (req, res) => {
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
        if (!hasSafeDocumentSignature(stableFile, extWithDot)) {
          recordSecurityEvent("upload_signature_failure", `admin-statute:${userId}`, {
            filename: file.originalname,
            ext: extWithDot,
            mimetype: file.mimetype,
          });
          errors.push(`${file.originalname}: file signature does not match declared format`);
          continue;
        }
        const statuteMalwareCheck = await passesMalwareScan(stableFile);
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
        maybeIndexStatuteDocumentInBackground({ statuteDocumentId: doc.id });
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
        indexing: {
          autoIndexOnUpload: ADMIN_UPLOAD_AUTO_INDEX,
          deferred: !ADMIN_UPLOAD_AUTO_INDEX,
        },
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
      await deleteDocumentVectors(id, GLOBAL_STATUTE_RAG_USER_ID);
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
      const allStatutes = await storage.getAllStatuteDocuments();
      const count = await storage.deleteAllStatuteDocuments();
      await Promise.allSettled(allStatutes.map((doc) => deleteDocumentVectors(doc.id, GLOBAL_STATUTE_RAG_USER_ID)));
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

  app.post("/api/profile/avatar", guardedUploadQueue, upload.single("avatar"), cleanupDiskUploadFilesAfterResponse, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);

    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "Avatar file is required" });
      const stableFile = cloneUploadFile(file);

      const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
      if (!allowedTypes.has(file.mimetype)) {
        return res.status(400).json({ message: "Unsupported image format. Use JPG, PNG, WEBP, or GIF." });
      }
      if (!hasSafeImageSignature(stableFile)) {
        recordSecurityEvent("upload_signature_failure", `avatar:${userId}`, {
          filename: file.originalname,
          mimetype: file.mimetype,
        });
        return res.status(400).json({ message: "Image signature does not match declared format." });
      }
      const avatarMalwareCheck = await passesMalwareScan(stableFile);
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

      const dataUrl = `data:${file.mimetype};base64,${stableFile.buffer.toString("base64")}`;
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
  } else {
    console.warn("[Startup] Skipping legal data seed because DB is unavailable.");
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

      let aiResponse = result.text;
      aiResponse = enforcePakistanLawOnlyOutput(aiResponse);
      aiResponse = (await enforceInternalCaseCitationIntegrity(aiResponse, {
        placeholder: "",
        normalizeVerified: true,
        requirePrimary: true,
        requireLinkedSource: true,
      })).content;
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

      const knowledgeContext = await gatherKnowledgeContextV2(message, userId);
      systemPrompt += knowledgeContext;
      systemPrompt = withPakistanLawOnlyPolicy(systemPrompt);

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
      const apexStartedAt = Date.now();
      const selectedApexModel = model as ApexModel;
      const result = await withTimeout(
        `Kimi(${selectedApexModel})`,
        MODEL_TIMEOUT_MS.apexPrimary,
        () => chatWithApex({
          model: selectedApexModel,
          messages,
          maxTokens: apexRequestCap,
        }),
      );
      responseContent = assertNonEmptyModelOutput(`Kimi(${selectedApexModel})`, result.content);
      responseReasoning = result.reasoning;
      responseModel = result.model;
      console.log(`[AI Routing][apex] Primary Kimi(${selectedApexModel}) succeeded in ${Date.now() - apexStartedAt}ms`);

      const actualModel = responseModel;
      let safeResponseContent = await applyAlWakeeloSafetyGuardrails(responseContent).catch(() => ensureAlWakeeloReferencesBlock(responseContent));
      safeResponseContent = enforcePakistanLawOnlyOutput(safeResponseContent);
      safeResponseContent = (await enforceInternalCaseCitationIntegrity(safeResponseContent, {
        placeholder: "",
        normalizeVerified: true,
        requirePrimary: true,
        requireLinkedSource: true,
      })).content;
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

  // ========== APEX AGENT (KIMI WEB RESEARCH) ROUTE ==========

  app.post("/api/apex/agent", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const tier = normalizeTier(await storage.getUserTier(userId));
    const tierPlan = getTierPlan(tier);

    if (!isApexAvailable()) {
      return res.status(503).json({ message: "Apex AI is not configured. MOONSHOT_API_KEY is required." });
    }

    // Only Chamber and Enterprise tiers can use Apex Agent
    if (!isApexAllowedForTier(tier)) {
      return res.status(403).json({ message: "Apex Agent requires Chamber or Enterprise plan." });
    }

    const { message, threadId, systemContext, maxIterations } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    // Check monthly Apex usage cap
    const apexMonthlyCap = Math.max(0, Number(tierPlan.apexMonthlyCap || 0));
    const apexUsedThisMonth = await storage.getMonthlyUsageCountByFeature(userId, "chat-apex");
    if (apexMonthlyCap > 0 && apexUsedThisMonth >= apexMonthlyCap) {
      return res.status(429).json({
        message: `Apex monthly cap reached (${apexMonthlyCap}/${apexMonthlyCap}) on ${tierPlan.label} plan.`,
        cap: apexMonthlyCap,
        used: apexUsedThisMonth,
      });
    }

    const allowed = await checkUsageLimit(userId, "chat", res);
    if (!allowed) return;

    try {
      // Build system prompt with legal context
      let systemPrompt = getLegalSystemPrompt();
      systemPrompt += `\n\nYou are operating in APEX AGENT mode with web research capabilities. You have access to the $web_search tool to research Pakistani legal topics, case law, statutes, and legal news from authoritative sources. When answering legal questions:

1. Use web search to find current, authoritative Pakistani legal information
2. Search for relevant case law from Pakistani courts (Supreme Court, High Courts)
3. Look up specific statutes, ordinances, and regulations
4. Find recent legal developments and amendments
5. Cross-reference multiple sources for accuracy
6. Always cite your sources with URLs when available
7. Synthesize findings into a comprehensive, structured legal analysis

Focus searches on: Pakistan Law Site (pakistanlawsite.com), Supreme Court of Pakistan, High Court judgments, PLD (Pakistan Legal Decisions), SCMR, and official government legal portals.`;
      systemPrompt += `\n\nCITATION INTEGRITY POLICY (ABSOLUTE):
- Formal case-law citations in your answer must come only from internal database references provided in context.
- Use only PRIMARY internal citations with linked source documents.
- Do not present web-found case citations as legal authorities.
- If no internal case citation is available, omit citation (no placeholders).`;

      if (systemContext) {
        systemPrompt += `\n\n${systemContext}`;
      }

      systemPrompt = withPakistanLawOnlyPolicy(systemPrompt);

      const knowledgeContext = await gatherKnowledgeContextV2(message, userId);
      systemPrompt += knowledgeContext;

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt },
      ];

      // Load thread history if provided
      if (threadId) {
        const threadMessages = await storage.getMessages(threadId);
        const recentMessages = threadMessages.slice(-8);
        for (const tm of recentMessages) {
          messages.push({ role: tm.role as "user" | "assistant", content: tm.content });
        }
      }

      messages.push({ role: "user", content: message });

      const apexRequestCap = Math.max(256, getModeOutputCap(tier, "apex") || 4096);
      const agentMaxIterations = Math.min(10, Math.max(3, Number(maxIterations) || 6));

      console.log(`[Apex Agent] Starting web research for user ${userId}, tier: ${tier}`);
      const startedAt = Date.now();

      const agentResult = await chatWithApexAgent({
        messages,
        maxTokens: apexRequestCap,
        maxIterations: agentMaxIterations,
      });

      console.log(`[Apex Agent] Completed in ${Date.now() - startedAt}ms, steps: ${agentResult.steps.length}, searches: ${agentResult.searchQueries.length}`);

      let safeContent = await applyAlWakeeloSafetyGuardrails(agentResult.content).catch(() => ensureAlWakeeloReferencesBlock(agentResult.content));
      safeContent = enforcePakistanLawOnlyOutput(safeContent);
      safeContent = (await enforceInternalCaseCitationIntegrity(safeContent, {
        placeholder: "",
        normalizeVerified: true,
        requirePrimary: true,
        requireLinkedSource: true,
      })).content;
      const inputText = messages.map(m => m.content).join("\n");
      await logUsageCost(userId, "chat-apex", agentResult.model, inputText, safeContent);

      res.json({
        content: safeContent,
        reasoning: agentResult.reasoning,
        model: agentResult.model,
        steps: agentResult.steps,
        searchQueries: agentResult.searchQueries,
        sourcesUsed: agentResult.sourcesUsed,
        inputTokens: agentResult.inputTokens,
        outputTokens: agentResult.outputTokens,
      });
    } catch (err: any) {
      console.error("[Apex Agent] Error:", err);
      if (err?.status === 429 || err?.message?.includes("429")) {
        return res.status(429).json({ message: "Rate limit exceeded. Please try again shortly." });
      }
      res.status(500).json({ message: err.message || "Apex Agent research failed" });
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
    if (!user || (normalizeTier(user.subscriptionTier) !== "chamber" && normalizeTier(user.subscriptionTier) !== "enterprise" && !user.isAdmin)) {
      return res.status(403).json({ message: "Only Chamber and Enterprise users can create organizations" });
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
    storage: createUploadStorage("org-knowledge"),
    limits: {
      fileSize: DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES,
      files: DOCUMENT_UPLOAD_MAX_FILES,
    },
  });

  app.post("/api/org/:id/knowledge", guardedUploadQueue, orgKnowledgeUpload.single("file"), cleanupDiskUploadFilesAfterResponse, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const orgId = parseInt(String(req.params.id));
    const isMember = await storage.isOrgMember(orgId, userId);
    if (!isMember) return res.status(403).json({ message: "Not a member" });

    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });
    const stableFile = cloneUploadFile(file);
    if (file.size > DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES) {
      return res.status(413).json({ message: `File exceeds max size (${toMbText(DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES)})` });
    }

    let content = "";
    const filename = file.originalname.toLowerCase();

    try {
      if (filename.endsWith(".txt")) {
        if (!hasSafeDocumentSignature(stableFile, ".txt")) {
          recordSecurityEvent("upload_signature_failure", `org-knowledge:${orgId}`, {
            filename: file.originalname,
            ext: ".txt",
            mimetype: file.mimetype,
          });
          return res.status(400).json({ message: "File signature does not match .txt format." });
        }
        content = stableFile.buffer.toString("utf-8");
      } else if (filename.endsWith(".pdf")) {
        if (!hasSafeDocumentSignature(stableFile, ".pdf")) {
          recordSecurityEvent("upload_signature_failure", `org-knowledge:${orgId}`, {
            filename: file.originalname,
            ext: ".pdf",
            mimetype: file.mimetype,
          });
          return res.status(400).json({ message: "File signature does not match .pdf format." });
        }
        content = await extractPdfTextSafe(stableFile.buffer, "org-knowledge-upload");
        if (!content.trim()) {
          content = await extractPdfTextWithOcrFallback(stableFile, "org-knowledge-upload");
        }
      } else if (filename.endsWith(".docx")) {
        if (!hasSafeDocumentSignature(stableFile, ".docx")) {
          recordSecurityEvent("upload_signature_failure", `org-knowledge:${orgId}`, {
            filename: file.originalname,
            ext: ".docx",
            mimetype: file.mimetype,
          });
          return res.status(400).json({ message: "File signature does not match .docx format." });
        }
        content = await extractDocxTextSafe(stableFile.buffer, "org-knowledge-upload");
      } else {
        return res.status(400).json({ message: "Unsupported file type. Use TXT, PDF, or DOCX." });
      }

      const orgMalwareCheck = await passesMalwareScan(stableFile);
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

  const cacheCleanupTimer = setInterval(() => {
    storage.cleanExpiredCache(7).then(count => {
      if (count > 0) console.log(`[Cache] Cleaned ${count} expired entries`);
    }).catch(() => {});
  }, 24 * 60 * 60 * 1000);
  cacheCleanupTimer.unref?.();

  return httpServer;
}
