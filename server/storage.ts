import { db } from "./db";
import { clearSitemapCache } from "./sitemap";
import { triggerGoogleIndexing } from "./services/google-indexing";
import {
  threads, messages, documents, bookmarks, searchHistory, statutes, caseLaw, githubKnowledge, queryCache, usageTracking, aiOutputLog, adminKnowledge, statuteDocuments, savedJudgments,
  organizations, orgMembers, orgInvites, orgKnowledge, lawJournals, courtsRef, judgments, citationLinks, unresolvedCitations, documentFiles, adminKnowledgeFiles, statuteDocumentFiles, visitorSessions, caseLeads, publicFunnelEvents,
  styleMemorySettings, styleMemorySamples, styleMemoryChunks, styleMemoryEvents,
  caseFiles, caseClients, caseCompliance, caseDocuments, caseNotes, diaryEntries, notificationPreferences, paymentRecords, apiKeys,
  type Thread, type InsertThread,
  type Message, type InsertMessage,
  type ApiKey,
  type Document, type InsertDocument,
  type DocumentFile, type InsertDocumentFile,
  type Bookmark, type InsertBookmark,
  type SearchHistory, type InsertSearchHistory,
  type Statute,
  type CaseLaw, type InsertCaseLaw,
  type InsertJudgment, type Judgment, type InsertCitationLink, type CitationLink, type InsertUnresolvedCitation,
  type GithubKnowledge, type InsertGithubKnowledge,
  type QueryCache, type InsertQueryCache,
  type UsageTracking,
  type AdminKnowledge, type InsertAdminKnowledge,
  type AdminKnowledgeFile, type InsertAdminKnowledgeFile,
  type StatuteDocument, type InsertStatuteDocument,
  type StatuteDocumentFile, type InsertStatuteDocumentFile,
  type SavedJudgment, type InsertSavedJudgment,
  type VisitorSession, type InsertVisitorSession,
  type CaseLead, type CaseLeadStatus, type InsertCaseLead, type InsertPublicFunnelEvent,
  type Organization, type InsertOrganization,
  type OrgMember, type InsertOrgMember,
  type OrgInvite, type InsertOrgInvite,
  type OrgKnowledge, type InsertOrgKnowledge,
  type StyleMemorySettings, type InsertStyleMemorySettings,
  type StyleMemorySample, type InsertStyleMemorySample,
  type CaseFile, type InsertCaseFile,
  type CaseClient, type InsertCaseClient,
  type CaseCompliance, type InsertCaseCompliance,
  type CaseDocument, type InsertCaseDocument,
  type CaseNote, type InsertCaseNote,
  type PaymentRecord, type InsertPaymentRecord,
} from "@shared/schema";
import { users, passwordResetTokens, emailVerificationTokens, type User } from "@shared/models/auth";
import { eq, desc, asc, or, ilike, sql, and, lt, gte, lte, ne, count, inArray, isNotNull } from "drizzle-orm";

export type DocumentInsights = {
  totalDocuments: number;
  sourceCounts: Array<{ key: string; label: string; count: number }>;
  domainCounts: Array<{ key: string; label: string; count: number }>;
  unclassifiedCount: number;
};

export type PagedResult<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type AdminKnowledgeListItem = Omit<AdminKnowledge, "content">;
export type StatuteDocumentListItem = Omit<StatuteDocument, "content">;

export type VisitorSessionStats = {
  ipAddress: string;
  messageCount: number;
  remaining: number;
  resetAt: Date;
};

export type DocumentMetadataUpdate = {
  id: number;
  sourceType: string;
  mimeType: string | null;
  fileExtension: string | null;
  detectedDomain: string;
  detectedDomainLabel: string;
  classificationMethod: string;
  classificationConfidence: number;
};

export type StyleMemoryModule = "legal-drafting" | "contract-drafting";
export type StyleMemoryScope = "user" | "org" | "user-org";
export type StyleMemoryStrictness = "strict" | "balanced" | "flexible";
export type StyleMemorySourceType = "upload" | "saved-draft" | "accepted-redline";
export type BillingCycle = "monthly" | "quarterly" | "yearly";

const BILLING_CYCLE_SET = new Set<BillingCycle>(["monthly", "quarterly", "yearly"]);

function normalizeBillingCycle(cycleRaw: string | null | undefined): BillingCycle {
  const cycle = String(cycleRaw || "monthly").toLowerCase();
  return BILLING_CYCLE_SET.has(cycle as BillingCycle) ? (cycle as BillingCycle) : "monthly";
}

export type StyleMemorySettingsView = {
  module: StyleMemoryModule;
  enabled: boolean;
  ownershipMode: StyleMemoryScope;
  learningSource: "full-activity";
  coverage: "generation-only";
  strictness: StyleMemoryStrictness;
  lastBackfillAt: Date | null;
};

export type StyleMemorySampleView = {
  id: number;
  module: StyleMemoryModule;
  sourceType: StyleMemorySourceType;
  sourceRef: string | null;
  title: string;
  status: "active" | "deleted";
  createdAt: Date | null;
};

export type StyleMemorySourceCounts = {
  upload: number;
  savedDraft: number;
  acceptedRedline: number;
  total: number;
};

function toStyleMemorySettingsView(row: StyleMemorySettings): StyleMemorySettingsView {
  return {
    module: row.module as StyleMemoryModule,
    enabled: !!row.enabled,
    ownershipMode: row.ownershipMode as StyleMemoryScope,
    learningSource: "full-activity",
    coverage: "generation-only",
    strictness: row.strictness as StyleMemoryStrictness,
    lastBackfillAt: row.lastBackfillAt || null,
  };
}

function toVisitorSessionStats(
  row: VisitorSession | undefined,
  ipAddress: string,
  windowHours: number,
  maxMessages: number,
): VisitorSessionStats {
  const now = new Date();
  const windowMs = Math.max(1, windowHours) * 60 * 60 * 1000;
  const lastMessageAt = row?.lastMessageAt ? new Date(row.lastMessageAt) : null;
  const inWindow = !!lastMessageAt && (now.getTime() - lastMessageAt.getTime() < windowMs);
  const messageCount = inWindow ? Number(row?.messageCount || 0) : 0;
  const remaining = Math.max(0, maxMessages - messageCount);
  const resetAt = inWindow && lastMessageAt
    ? new Date(lastMessageAt.getTime() + windowMs)
    : new Date(now.getTime() + windowMs);

  return {
    ipAddress,
    messageCount,
    remaining,
    resetAt,
  };
}

export type CitationSearchResult = {
  id: string;
  citation: string;
  title: string;
  court: string;
  decisionDate: Date | null;
  pdfUrl: string | null;
};

export type JudgmentCitationLink = {
  id: number;
  citationType: string;
  contextExcerpt: string | null;
  citationText: string;
  linkedJudgmentId: string | null;
  linkedCitation: string | null;
  linkedTitle: string | null;
};

export type JudgmentDetail = {
  id: string;
  year: number;
  page: number;
  journalCode: string;
  journalName: string;
  citation: string;
  title: string;
  petitioner: string | null;
  respondent: string | null;
  court: string;
  decisionDate: Date | null;
  headnotes: string | null;
  fullText: string;
  pdfUrl: string | null;
  citations: {
    made: JudgmentCitationLink[];
    received: JudgmentCitationLink[];
  };
};

export type CaseLawCitationParts = {
  year: number;
  report: string;
  page: number;
};

export type CaseLawSearchOptions = {
  year?: number;
  report?: string;
  page?: number;
  court?: string;
  sort?: "relevance" | "latest";
  parsedCitation?: CaseLawCitationParts | null;
  includeSourceContentSearch?: boolean;
};

function normalizeCaseLawCitationReport(token: string): string {
  return String(token || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

const CASELAW_REPORT_CODES = new Set([
  "PLD", "SCMR", "YLR", "MLD", "CLC", "PCRLJ", "PLJ", "PLC", "NLR",
  "PSC", "ALD", "KLR", "PTD", "PTCL", "PLS", "GBLR", "CLD", "TAX", "SLR",
  "LHC", "IHC", "SHC", "PHC", "BHC", "AJKHC",
]);

function extractKnownCaseLawReport(raw: string): string | null {
  const direct = normalizeCaseLawCitationReport(raw);
  if (CASELAW_REPORT_CODES.has(direct)) return direct;

  const tokens = String(raw || "")
    .split(/\s+/g)
    .map((token) => normalizeCaseLawCitationReport(token))
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

function parseCaseLawCitationParts(citation: string): CaseLawCitationParts | null {
  const raw = String(citation || "").trim();
  if (!raw) return null;

  // Strip brackets/parens content but preserve the text inside (for "PLJ 2019 SC (AJK) 123")
  const normalized = raw
    .replace(/[()[\],;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // ── Format 1: Neutral compact  2014LHC5158 / 2022IHC77 ─────────────────────
  const compactNeutral = normalized.match(/\b((?:19|20)\d{2})(LHC|IHC|SHC|PHC|BHC|AJKHC)(\d{1,6})\b/i);
  if (compactNeutral) {
    const year = Number(compactNeutral[1]);
    const report = normalizeCaseLawCitationReport(compactNeutral[2]);
    const page = Number(compactNeutral[3]);
    if (Number.isInteger(year) && Number.isInteger(page) && page > 0 && report) {
      return { year, report, page };
    }
  }

  // ── Format 2: Year-first  1974 SCMR 184 / 1976 P Cr. L J 944 ───────────────
  const yearFirst = normalized.match(
    /\b((?:19|20)\d{2})\s+([A-Za-z][A-Za-z0-9.]{0,12}(?:\s+[A-Za-z][A-Za-z0-9.]{0,12}){0,4})\s+(\d{1,6})\b/i,
  );
  if (yearFirst) {
    const year = Number(yearFirst[1]);
    const report = extractKnownCaseLawReport(yearFirst[2]) || normalizeCaseLawCitationReport(yearFirst[2]);
    const page = Number(yearFirst[3]);
    if (Number.isInteger(year) && Number.isInteger(page) && page > 0 && report) {
      return { year, report, page };
    }
  }

  // ── Format 3: Report-first  SCMR 1974 184 / P Cr. L J 1976 944 ─────────────
  const reportFirst = normalized.match(
    /\b([A-Za-z][A-Za-z0-9.]{0,12}(?:\s+[A-Za-z][A-Za-z0-9.]{0,12}){0,4})\s+((?:19|20)\d{2})\s+(\d{1,6})\b/i,
  );
  if (reportFirst) {
    const report = extractKnownCaseLawReport(reportFirst[1]) || normalizeCaseLawCitationReport(reportFirst[1]);
    const year = Number(reportFirst[2]);
    const page = Number(reportFirst[3]);
    if (Number.isInteger(year) && Number.isInteger(page) && page > 0 && report) {
      return { year, report, page };
    }
  }

  // ── Format 4: Year + volume + code + page  "2015 (2) ILR 45" / "(2019) 3 SCC 100"
  // After normalization: "2015 2 ILR 45" / "2019 3 SCC 100"
  // Pattern: YEAR  VOL_NUM  CODE  PAGE
  const yearVolFirst = normalized.match(
    /\b((?:19|20)\d{2})\s+\d{1,4}\s+([A-Za-z][A-Za-z0-9.]{0,15}(?:\s+[A-Za-z][A-Za-z0-9.]{0,15}){0,3})\s+(\d{1,6})\b/i,
  );
  if (yearVolFirst) {
    const year = Number(yearVolFirst[1]);
    const report = extractKnownCaseLawReport(yearVolFirst[2]) || normalizeCaseLawCitationReport(yearVolFirst[2]);
    const page = Number(yearVolFirst[3]);
    if (Number.isInteger(year) && Number.isInteger(page) && page > 0 && report) {
      return { year, report, page };
    }
  }

  // ── Format 5: Report + year + qualifier + page  "NLR 2020 Civ 33" / "PLD 2019 SC 456"
  // Pattern: CODE  YEAR  QUALIFIER  PAGE  (qualifier is non-numeric text between year and page)
  const reportQualFirst = normalized.match(
    /\b([A-Za-z][A-Za-z0-9.]{0,12})\s+((?:19|20)\d{2})\s+[A-Za-z&]+(?:\s+[A-Za-z&]+){0,2}\s+(\d{1,6})\b/i,
  );
  if (reportQualFirst) {
    const report = extractKnownCaseLawReport(reportQualFirst[1]) || normalizeCaseLawCitationReport(reportQualFirst[1]);
    const year = Number(reportQualFirst[2]);
    const page = Number(reportQualFirst[3]);
    if (Number.isInteger(year) && Number.isInteger(page) && page > 0 && report) {
      return { year, report, page };
    }
  }

  // ── Format 6: Any known report code with a year anywhere in the string ───────
  // Last resort: extract year for hasTrustedCitation Criterion 2 even if page is unknown.
  // Return with page=0 sentinel — callers that require page>0 will ignore this,
  // but citationYear will be populated for the citation validity check.
  const knownCodeMatch = normalized.match(
    new RegExp(`\\b(${[...CASELAW_REPORT_CODES].join("|")})\\b`, "i"),
  );
  const anyYearMatch = normalized.match(/\b((?:19|20)\d{2})\b/);
  if (knownCodeMatch && anyYearMatch) {
    const year = Number(anyYearMatch[1]);
    const report = normalizeCaseLawCitationReport(knownCodeMatch[1]);
    if (Number.isInteger(year) && report) {
      // page is unknown — use 0 so callers requiring page>0 skip structured match
      // but citationYear and citationReport ARE set correctly
      return { year, report, page: 0 };
    }
  }

  return null;
}

function enrichCaseLawCitationFields<T extends Partial<InsertCaseLaw>>(entry: T): T {
  const hasCitation = Object.prototype.hasOwnProperty.call(entry, "citation");
  const hasYear = Object.prototype.hasOwnProperty.call(entry, "citationYear");
  const hasReport = Object.prototype.hasOwnProperty.call(entry, "citationReport");
  const hasPage = Object.prototype.hasOwnProperty.call(entry, "citationPage");
  if (!hasCitation && !hasYear && !hasReport && !hasPage) {
    return entry;
  }

  const parsed = hasCitation ? parseCaseLawCitationParts(String(entry.citation || "")) : null;
  const normalized = { ...entry } as Partial<InsertCaseLaw>;

  if (hasYear || parsed) {
    const value = Number(normalized.citationYear);
    normalized.citationYear = Number.isInteger(value) ? value : (parsed?.year ?? null);
  }

  if (hasReport || parsed) {
    const value = normalizeCaseLawCitationReport(String(normalized.citationReport || ""));
    normalized.citationReport = value || parsed?.report || null;
  }

  if (hasPage || parsed) {
    const value = Number(normalized.citationPage);
    normalized.citationPage = Number.isInteger(value) && value > 0 ? value : (parsed?.page ?? null);
  }

  // Fallback year extraction — runs when parseCaseLawCitationParts returned null or no year.
  // Covers patterns that structured parsing misses:
  //   "C.A. 8-Q of 2017"        → "of YYYY"
  //   "R.P.A 155/2014"           → "/YYYY"
  //   "2015 (2) ILR 45"          → year at start
  //   "(2019) 3 SCC 100"         → year in brackets (already stripped by normalization)
  //   "Unreported 2022"          → bare year at end
  if (!normalized.citationYear && hasCitation) {
    const citStr = String(entry.citation || "");
    // Priority 1: "of YEAR" or "/YEAR" — case numbers
    const ofYear = citStr.match(/\b(?:of\s+|\/)((?:19|20)\d{2})\b/i);
    // Priority 2: Any 4-digit year in the string
    const anyYear = citStr.match(/\b((?:19|20)\d{2})\b/);
    const raw = ofYear?.[1] ?? anyYear?.[1];
    if (raw) {
      const y = Number(raw);
      if (Number.isInteger(y) && y >= 1900 && y <= 2100) {
        normalized.citationYear = y;
      }
    }
  }

  return normalized as T;
}

function normalizeCaseLawCitationText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCaseLawDedupKey(entry: Partial<Pick<CaseLaw, "citation" | "citationYear" | "citationReport" | "citationPage">>): string {
  const report = normalizeCaseLawCitationReport(String(entry.citationReport || ""));
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

export interface IStorage {
  createThread(thread: InsertThread & { userId: string }): Promise<Thread>;
  getThreads(userId: string): Promise<Thread[]>;
  getThread(id: number): Promise<Thread | undefined>;
  deleteThread(id: number): Promise<void>;
  setThreadShareToken(id: number, token: string): Promise<Thread | undefined>;
  getThreadByShareToken(token: string): Promise<Thread | undefined>;

  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(threadId: number): Promise<Message[]>;

  createDocument(doc: InsertDocument & { userId: string }): Promise<Document>;
  getDocuments(userId: string): Promise<Document[]>;
  getDocumentById(id: number, userId: string): Promise<Document | undefined>;
  updateDocument(
    id: number,
    userId: string,
    data: Partial<Pick<InsertDocument, "title" | "content">>
  ): Promise<Document | undefined>;
  getAllDocuments(): Promise<Document[]>;
  getDocumentInsights(userId: string): Promise<DocumentInsights>;
  getDocumentsNeedingMetadata(userId: string, limit: number): Promise<Document[]>;
  backfillDocumentMetadata(userId: string, updates: DocumentMetadataUpdate[]): Promise<number>;
  deleteDocument(id: number, userId: string): Promise<void>;
  deleteAllDocuments(userId: string): Promise<number>;
  upsertDocumentFile(entry: InsertDocumentFile): Promise<DocumentFile>;
  getDocumentFile(documentId: number, userId: string): Promise<DocumentFile | undefined>;
  getDocumentFilesByUser(userId: string): Promise<DocumentFile[]>;
  deleteDocumentFile(documentId: number, userId: string): Promise<void>;
  getVisitorSessionStats(ipAddress: string, windowHours: number, maxMessages: number): Promise<VisitorSessionStats>;
  incrementVisitorSession(ipAddress: string, windowHours: number, maxMessages: number): Promise<VisitorSessionStats>;
  logPublicFunnelEvent(entry: InsertPublicFunnelEvent & { ipAddress: string }): Promise<void>;
  createCaseLead(entry: InsertCaseLead): Promise<CaseLead>;
  getCaseLeadsPage(limit: number, offset: number, query?: string): Promise<PagedResult<CaseLead>>;
  getCaseLeadById(id: string): Promise<CaseLead | undefined>;
  updateCaseLeadStatus(id: string, status: CaseLeadStatus): Promise<CaseLead | undefined>;
  deleteCaseLead(id: string): Promise<void>;
  getStyleMemorySettings(userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<StyleMemorySettingsView | null>;
  upsertStyleMemorySettings(args: {
    userId: string;
    module: StyleMemoryModule;
    orgId?: number | null;
    enabled?: boolean;
    ownershipMode?: StyleMemoryScope;
    strictness?: StyleMemoryStrictness;
  }): Promise<StyleMemorySettingsView>;
  touchStyleMemoryBackfill(userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<void>;
  getStyleMemorySourceCounts(userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<StyleMemorySourceCounts>;
  getStyleMemorySampleByHash(userId: string, module: StyleMemoryModule, textHash: string, orgId?: number | null): Promise<StyleMemorySample | undefined>;
  addStyleMemorySample(entry: InsertStyleMemorySample): Promise<StyleMemorySample>;
  listStyleMemorySamples(
    userId: string,
    module: StyleMemoryModule,
    limit: number,
    offset: number,
    orgId?: number | null,
  ): Promise<PagedResult<StyleMemorySampleView>>;
  deleteStyleMemorySample(id: number, userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<number>;
  deleteAllStyleMemorySamples(userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<number>;
  deleteStyleMemoryChunksBySample(sampleId: number, userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<number>;
  addStyleMemoryChunk(args: {
    sampleId: number;
    userId: string;
    module: StyleMemoryModule;
    orgId?: number | null;
    chunkIndex: number;
    content: string;
    tokenCount: number;
    embedding: string;
  }): Promise<void>;
  logStyleMemoryEvent(args: {
    eventType: string;
    userId: string;
    module: StyleMemoryModule;
    orgId?: number | null;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  upsertAdminKnowledgeFile(entry: InsertAdminKnowledgeFile): Promise<AdminKnowledgeFile>;
  getAdminKnowledgeFile(adminKnowledgeId: number): Promise<AdminKnowledgeFile | undefined>;
  getAdminKnowledgeFiles(): Promise<AdminKnowledgeFile[]>;
  deleteAdminKnowledgeFile(adminKnowledgeId: number): Promise<void>;
  upsertStatuteDocumentFile(entry: InsertStatuteDocumentFile): Promise<StatuteDocumentFile>;
  getStatuteDocumentFile(statuteDocumentId: number): Promise<StatuteDocumentFile | undefined>;
  getStatuteDocumentFiles(): Promise<StatuteDocumentFile[]>;
  deleteStatuteDocumentFile(statuteDocumentId: number): Promise<void>;

  createBookmark(bookmark: InsertBookmark & { userId: string }): Promise<Bookmark>;
  getBookmarks(userId: string): Promise<Bookmark[]>;
  deleteBookmark(id: number, userId: string): Promise<void>;

  addSearchHistory(entry: InsertSearchHistory & { userId: string }): Promise<SearchHistory>;
  getSearchHistory(userId: string): Promise<SearchHistory[]>;

  searchStatutes(query: string, limit?: number): Promise<Statute[]>;
  getStatutesByTitle(shortTitle: string, limit?: number): Promise<Statute[]>;
  getStatuteByTitleAndSection(shortTitle: string, section: string): Promise<Statute | undefined>;
  getAllStatutes(): Promise<Statute[]>;

  searchCaseLaw(query: string, limit?: number, options?: CaseLawSearchOptions): Promise<CaseLaw[]>;
  getAllCaseLaw(): Promise<CaseLaw[]>;
  getCaseLawPage(limit: number, offset: number): Promise<PagedResult<CaseLaw>>;
  getCaseLawById(id: number): Promise<CaseLaw | undefined>;
  getCaseLawByCitation(citation: string): Promise<CaseLaw | undefined>;
  getCaseLawBySourceDocuments(sourceDocIds: number[], sourceType?: string): Promise<CaseLaw[]>;
  getCaseLawCitations(): Promise<string[]>;
  resetAllCaseLawCitationRolesToCited(): Promise<number>;
  createCaseLaw(entry: InsertCaseLaw): Promise<CaseLaw>;
  updateCaseLaw(id: number, entry: Partial<InsertCaseLaw>): Promise<CaseLaw | undefined>;
  deleteCaseLaw(id: number): Promise<void>;
  deleteAllCaseLaw(): Promise<number>;
  bulkCreateCaseLaw(entries: InsertCaseLaw[]): Promise<CaseLaw[]>;
  getLawJournals(): Promise<Array<{ id: number; code: string; name: string }>>;
  getCourtsRef(): Promise<Array<{ id: number; code: string; name: string; level: string }>>;
  searchJudgmentsByCitation(params: { year: number; journalCode?: string; page: number; court?: string }): Promise<CitationSearchResult[]>;
  /** Full-text search the judgments table by keywords. Returns CaseLaw-shaped objects for pipeline compatibility. */
  searchJudgmentsByKeywords(query: string, limit: number): Promise<CaseLaw[]>;
  findJudgmentByCitationString(citation: string, limit: number): Promise<CaseLaw[]>;
  getJudgmentDetail(id: string): Promise<JudgmentDetail | undefined>;
  createJudgment(entry: InsertJudgment): Promise<Judgment>;
  createCitationLinks(entries: InsertCitationLink[]): Promise<number>;
  createUnresolvedCitations(entries: InsertUnresolvedCitation[]): Promise<number>;

  getGithubKnowledgeCount(): Promise<number>;
  getAllGithubKnowledge(): Promise<GithubKnowledge[]>;
  getGithubKnowledgeById(id: number): Promise<GithubKnowledge | undefined>;
  upsertGithubKnowledge(items: InsertGithubKnowledge[]): Promise<void>;
  searchGithubKnowledge(query: string, limit?: number): Promise<GithubKnowledge[]>;

  getCachedResponse(endpoint: string, queryHash: string): Promise<QueryCache | undefined>;
  setCachedResponse(entry: InsertQueryCache): Promise<QueryCache>;
  incrementCacheHit(id: number): Promise<void>;
  cleanExpiredCache(maxAgeDays?: number): Promise<number>;

  logUsage(userId: string, feature: string): Promise<UsageTracking>;
  logUsageCost(userId: string, feature: string, inputTokens: number, outputTokens: number, estimatedCost: number): Promise<void>;
  getMonthlyUsageCount(userId: string): Promise<number>;
  getMonthlyUsageCountByFeature(userId: string, feature: string): Promise<number>;
  getTotalUsageCountByFeature(userId: string, feature: string): Promise<number>;
  getMonthlyDocumentUploadCount(userId: string): Promise<number>;
  getMonthlyOcrPageCount(userId: string): Promise<number>;
  logOcrPages(userId: string, pageCount: number): Promise<void>;
  resetMonthlyUsageCount(userId: string): Promise<{ before: number; deleted: number; after: number; windowStart: Date }>;
  getUserTier(userId: string): Promise<string>;
  downgradeExpiredSubscriptions(): Promise<number>;
  getCostAnalytics(): Promise<{ byFeature: Array<{ feature: string; totalQueries: number; totalInputTokens: number; totalOutputTokens: number; totalCost: string }>; totalCost: string; totalTokens: number }>;

  getAllUsers(): Promise<User[]>;
  deleteUser(userId: string): Promise<void>;
  updateUserTier(userId: string, tier: string): Promise<User | undefined>;
  updateUserSubscription(
    userId: string,
    data: {
      subscriptionTier?: string;
      subscriptionCycle?: BillingCycle;
      subscriptionStartAt?: Date | null;
      subscriptionEndAt?: Date | null;
      autoRenew?: boolean;
    },
  ): Promise<User | undefined>;
  updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<User | undefined>;
  isUserAdmin(userId: string): Promise<boolean>;
  hasAnyAdmin(): Promise<boolean>;
  getSystemStats(): Promise<{ totalUsers: number; totalThreads: number; totalMessages: number; totalDocuments: number; totalKnowledge: number; totalCacheEntries: number; totalUsageThisMonth: number }>;
  getUserActivitySummary(userId: string): Promise<{
    threadCount: number;
    messageCount: number;
    lastActive: string | null;
    usageByFeature: Array<{ feature: string; totalQueries: number; totalInputTokens: number; totalOutputTokens: number; totalCost: string }>;
    totalCost: string;
    totalTokens: number;
    totalQueries: number;
    recentSearches: Array<{ id: number; type: string; query: string; createdAt: Date | null }>;
  }>;
  getUserThreadsWithMessageCount(userId: string, limit: number, offset: number): Promise<{
    items: Array<{ id: number; title: string; messageCount: number; createdAt: Date | null; updatedAt: Date | null }>;
    total: number;
  }>;
  getUserProfile(userId: string): Promise<User | undefined>;
  updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; profileImageUrl?: string | null }): Promise<User | undefined>;

  addAdminKnowledge(entry: InsertAdminKnowledge): Promise<AdminKnowledge>;
  getAdminKnowledgeById(id: number): Promise<AdminKnowledge | undefined>;
  getAllAdminKnowledge(): Promise<AdminKnowledge[]>;
  getAdminKnowledgePage(limit: number, offset: number): Promise<PagedResult<AdminKnowledgeListItem>>;
  deleteAdminKnowledge(id: number): Promise<void>;
  deleteAllAdminKnowledge(): Promise<number>;
  searchAdminKnowledge(query: string, limit?: number): Promise<AdminKnowledge[]>;

  getSavedJudgments(userId: string): Promise<SavedJudgment[]>;
  saveJudgment(entry: InsertSavedJudgment): Promise<SavedJudgment>;
  deleteSavedJudgment(id: number, userId: string): Promise<void>;

  addStatuteDocument(entry: InsertStatuteDocument): Promise<StatuteDocument>;
  getAllStatuteDocuments(): Promise<StatuteDocument[]>;
  getStatuteDocumentsPage(limit: number, offset: number): Promise<PagedResult<StatuteDocumentListItem>>;
  getStatuteDocument(id: number): Promise<StatuteDocument | undefined>;
  deleteStatuteDocument(id: number): Promise<void>;
  deleteAllStatuteDocuments(): Promise<number>;
  searchStatuteDocuments(query: string, limit?: number): Promise<StatuteDocument[]>;

  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganization(id: number): Promise<Organization | undefined>;
  getUserOrganization(userId: string): Promise<Organization | undefined>;
  addOrgMember(member: InsertOrgMember): Promise<OrgMember>;
  getOrgMembers(orgId: number): Promise<(OrgMember & { email: string | null; firstName: string | null; lastName: string | null })[]>;
  removeOrgMember(orgId: number, userId: string): Promise<void>;
  isOrgMember(orgId: number, userId: string): Promise<boolean>;
  createOrgInvite(invite: InsertOrgInvite): Promise<OrgInvite>;
  getOrgInvites(orgId: number): Promise<OrgInvite[]>;
  getPendingInvitesForUser(email: string): Promise<(OrgInvite & { orgName: string })[]>;
  acceptOrgInvite(inviteId: number, userId: string): Promise<void>;
  declineOrgInvite(inviteId: number): Promise<void>;
  deleteOrganization(id: number): Promise<void>;

  addOrgKnowledge(entry: InsertOrgKnowledge): Promise<OrgKnowledge>;
  getOrgKnowledge(orgId: number): Promise<OrgKnowledge[]>;
  deleteOrgKnowledge(id: number): Promise<void>;
  searchOrgKnowledge(orgId: number, query: string, limit?: number): Promise<OrgKnowledge[]>;

  // ── Payment Records (Safepay) ─────────────────────────────────────────────
  createPaymentRecord(data: InsertPaymentRecord): Promise<PaymentRecord>;
  getPaymentRecordByTracker(tracker: string): Promise<PaymentRecord | undefined>;
  getPaymentRecordsByUser(userId: string): Promise<PaymentRecord[]>;
  updatePaymentRecordStatus(tracker: string, status: string, response?: Record<string, unknown>): Promise<PaymentRecord | undefined>;

  // ── MCP API Keys ───────────────────────────────────────────────────────────
  createApiKey(userId: string, name: string, keyHash: string): Promise<ApiKey>;
  getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined>;
  listApiKeys(userId: string): Promise<ApiKey[]>;
  revokeApiKey(userId: string, id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async createThread(insertThread: InsertThread & { userId: string }): Promise<Thread> {
    const [thread] = await db.insert(threads).values(insertThread).returning();
    return thread;
  }

  async getThreads(userId: string): Promise<Thread[]> {
    return await db.select()
      .from(threads)
      .where(eq(threads.userId, userId))
      .orderBy(desc(threads.updatedAt), desc(threads.createdAt));
  }

  async getThread(id: number): Promise<Thread | undefined> {
    const [thread] = await db.select().from(threads).where(eq(threads.id, id));
    return thread;
  }

  async deleteThread(id: number): Promise<void> {
    await db.delete(messages).where(eq(messages.threadId, id));
    await db.delete(threads).where(eq(threads.id, id));
  }

  async setThreadShareToken(id: number, token: string): Promise<Thread | undefined> {
    const [thread] = await db.update(threads).set({ shareToken: token }).where(eq(threads.id, id)).returning();
    return thread;
  }

  async getThreadByShareToken(token: string): Promise<Thread | undefined> {
    const [thread] = await db.select().from(threads).where(eq(threads.shareToken, token));
    return thread;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(insertMessage).returning();
    await db
      .update(threads)
      .set({ updatedAt: new Date() })
      .where(eq(threads.id, insertMessage.threadId));
    return message;
  }

  async getMessages(threadId: number): Promise<Message[]> {
    return await db.select()
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(messages.createdAt);
  }

  async createDocument(insertDoc: InsertDocument & { userId: string }): Promise<Document> {
    const [doc] = await db.insert(documents).values(insertDoc).returning();
    return doc;
  }

  async getDocuments(userId: string): Promise<Document[]> {
    return await db.select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt));
  }

  async getDocumentById(id: number, userId: string): Promise<Document | undefined> {
    const [doc] = await db.select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
      .limit(1);
    return doc;
  }

  async updateDocument(
    id: number,
    userId: string,
    data: Partial<Pick<InsertDocument, "title" | "content">>
  ): Promise<Document | undefined> {
    const updateData: Partial<Pick<InsertDocument, "title" | "content">> = {};
    if (typeof data.title === "string") updateData.title = data.title;
    if (typeof data.content === "string" || data.content === null) updateData.content = data.content;
    if (Object.keys(updateData).length === 0) return undefined;

    const [doc] = await db
      .update(documents)
      .set(updateData)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
      .returning();
    return doc;
  }

  async getAllDocuments(): Promise<Document[]> {
    return await db.select().from(documents);
  }

  async getDocumentInsights(userId: string): Promise<DocumentInsights> {
    const totalResult = await db.select({ total: count() }).from(documents).where(eq(documents.userId, userId));
    const totalDocuments = totalResult[0]?.total || 0;

    const sourceRows = await db.select({
      key: documents.sourceType,
      count: count(),
    })
      .from(documents)
      .where(eq(documents.userId, userId))
      .groupBy(documents.sourceType);

    const domainRows = await db.select({
      key: documents.detectedDomain,
      label: documents.detectedDomainLabel,
      count: count(),
    })
      .from(documents)
      .where(eq(documents.userId, userId))
      .groupBy(documents.detectedDomain, documents.detectedDomainLabel);

    const unclassifiedResult = await db.select({ total: count() })
      .from(documents)
      .where(and(
        eq(documents.userId, userId),
        or(
          sql`${documents.fileExtension} IS NULL`,
          sql`${documents.fileExtension} = ''`,
          sql`${documents.classificationMethod} IS NULL`,
          sql`${documents.classificationMethod} = ''`
        ),
      ));
    const unclassifiedCount = unclassifiedResult[0]?.total || 0;

    return {
      totalDocuments,
      sourceCounts: sourceRows
        .map((row: { key: string | null; count: number }) => {
          const key = (row.key || "other").toLowerCase();
          const label = key === "docx" ? "DOCX" : key.toUpperCase();
          return { key, label, count: row.count };
        })
        .sort((a: { count: number }, b: { count: number }) => b.count - a.count),
      domainCounts: domainRows
        .map((row: { key: string | null; label: string | null; count: number }) => ({
          key: row.key || "other",
          label: row.label || "Other",
          count: row.count,
        }))
        .sort((a: { count: number }, b: { count: number }) => b.count - a.count),
      unclassifiedCount,
    };
  }

  async getDocumentsNeedingMetadata(userId: string, limit: number): Promise<Document[]> {
    return await db.select()
      .from(documents)
      .where(and(
        eq(documents.userId, userId),
        or(
          sql`${documents.fileExtension} IS NULL`,
          sql`${documents.fileExtension} = ''`,
          sql`${documents.classificationMethod} IS NULL`,
          sql`${documents.classificationMethod} = ''`
        ),
      ))
      .orderBy(desc(documents.createdAt))
      .limit(limit);
  }

  async backfillDocumentMetadata(userId: string, updates: DocumentMetadataUpdate[]): Promise<number> {
    let updated = 0;
    for (const item of updates) {
      const [row] = await db
        .update(documents)
        .set({
          sourceType: item.sourceType,
          mimeType: item.mimeType,
          fileExtension: item.fileExtension,
          detectedDomain: item.detectedDomain,
          detectedDomainLabel: item.detectedDomainLabel,
          classificationMethod: item.classificationMethod,
          classificationConfidence: item.classificationConfidence,
        })
        .where(and(eq(documents.id, item.id), eq(documents.userId, userId)))
        .returning({ id: documents.id });
      if (row) updated += 1;
    }
    return updated;
  }

  async deleteDocument(id: number, userId: string): Promise<void> {
    await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
  }

  async deleteAllDocuments(userId: string): Promise<number> {
    const all = await db.select({ id: documents.id }).from(documents).where(eq(documents.userId, userId));
    if (all.length === 0) return 0;
    await db.delete(documents).where(eq(documents.userId, userId));
    return all.length;
  }

  async upsertDocumentFile(entry: InsertDocumentFile): Promise<DocumentFile> {
    const [record] = await db
      .insert(documentFiles)
      .values(entry)
      .onConflictDoUpdate({
        target: documentFiles.documentId,
        set: {
          userId: entry.userId,
          provider: entry.provider,
          bucket: entry.bucket,
          objectKey: entry.objectKey,
          extractedTextKey: entry.extractedTextKey ?? null,
          originalFilename: entry.originalFilename ?? null,
          mimeType: entry.mimeType ?? null,
          sizeBytes: entry.sizeBytes ?? null,
          etag: entry.etag ?? null,
          publicUrl: entry.publicUrl ?? null,
          createdAt: new Date(),
        },
      })
      .returning();
    return record;
  }

  async getDocumentFile(documentId: number, userId: string): Promise<DocumentFile | undefined> {
    const [record] = await db
      .select()
      .from(documentFiles)
      .where(and(eq(documentFiles.documentId, documentId), eq(documentFiles.userId, userId)))
      .limit(1);
    return record;
  }

  async getDocumentFilesByUser(userId: string): Promise<DocumentFile[]> {
    return await db
      .select()
      .from(documentFiles)
      .where(eq(documentFiles.userId, userId));
  }

  async deleteDocumentFile(documentId: number, userId: string): Promise<void> {
    await db
      .delete(documentFiles)
      .where(and(eq(documentFiles.documentId, documentId), eq(documentFiles.userId, userId)));
  }

  async getVisitorSessionStats(ipAddress: string, windowHours: number, maxMessages: number): Promise<VisitorSessionStats> {
    const normalizedIp = String(ipAddress || "").trim() || "unknown";
    const [row] = await db
      .select()
      .from(visitorSessions)
      .where(eq(visitorSessions.ipAddress, normalizedIp))
      .limit(1);
    return toVisitorSessionStats(row, normalizedIp, windowHours, maxMessages);
  }

  async incrementVisitorSession(ipAddress: string, windowHours: number, maxMessages: number): Promise<VisitorSessionStats> {
    const normalizedIp = String(ipAddress || "").trim() || "unknown";
    const now = new Date();
    const [existing] = await db
      .select()
      .from(visitorSessions)
      .where(eq(visitorSessions.ipAddress, normalizedIp))
      .limit(1);
    const stats = toVisitorSessionStats(existing, normalizedIp, windowHours, maxMessages);
    const nextCount = Math.max(1, Math.min(maxMessages, stats.messageCount + 1));

    if (existing) {
      const [updated] = await db
        .update(visitorSessions)
        .set({
          messageCount: nextCount,
          createdAt: stats.messageCount === 0 ? now : existing.createdAt,
          lastMessageAt: now,
        })
        .where(eq(visitorSessions.id, existing.id))
        .returning();
      return toVisitorSessionStats(updated, normalizedIp, windowHours, maxMessages);
    }

    const [inserted] = await db
      .insert(visitorSessions)
      .values({
        ipAddress: normalizedIp,
        messageCount: nextCount,
        createdAt: now,
        lastMessageAt: now,
      })
      .returning();
    return toVisitorSessionStats(inserted, normalizedIp, windowHours, maxMessages);
  }

  async logPublicFunnelEvent(entry: InsertPublicFunnelEvent & { ipAddress: string }): Promise<void> {
    await db.insert(publicFunnelEvents).values({
      eventType: entry.eventType,
      sessionId: entry.sessionId || null,
      ipAddress: entry.ipAddress,
      metadata: entry.metadata || {},
    });
  }

  async createCaseLead(entry: InsertCaseLead): Promise<CaseLead> {
    const [lead] = await db.insert(caseLeads).values(entry).returning();
    return lead;
  }

  async getCaseLeadsPage(limit: number, offset: number, query?: string): Promise<PagedResult<CaseLead>> {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const q = String(query || "").trim();
    const pattern = `%${q}%`;
    const whereClause = q
      ? or(
        ilike(caseLeads.name, pattern),
        ilike(caseLeads.phone, pattern),
        ilike(caseLeads.email, pattern),
        ilike(caseLeads.caseType, pattern),
        ilike(caseLeads.city, pattern),
        ilike(caseLeads.urgency, pattern),
        ilike(caseLeads.caseDescription, pattern),
        ilike(caseLeads.ipAddress, pattern),
        ilike(caseLeads.status, pattern),
      )
      : undefined;

    const [totalRow] = whereClause
      ? await db.select({ total: count() }).from(caseLeads).where(whereClause)
      : await db.select({ total: count() }).from(caseLeads);
    const total = Number(totalRow?.total || 0);

    const items = whereClause
      ? await db.select().from(caseLeads).where(whereClause).orderBy(desc(caseLeads.createdAt)).limit(safeLimit).offset(safeOffset)
      : await db.select().from(caseLeads).orderBy(desc(caseLeads.createdAt)).limit(safeLimit).offset(safeOffset);

    return {
      items,
      total,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + items.length < total,
    };
  }

  async getCaseLeadById(id: string): Promise<CaseLead | undefined> {
    const [lead] = await db.select().from(caseLeads).where(eq(caseLeads.id, id)).limit(1);
    return lead;
  }

  async updateCaseLeadStatus(id: string, status: CaseLeadStatus): Promise<CaseLead | undefined> {
    const [lead] = await db
      .update(caseLeads)
      .set({
        status,
        statusUpdatedAt: new Date(),
      })
      .where(eq(caseLeads.id, id))
      .returning();
    return lead;
  }

  async deleteCaseLead(id: string): Promise<void> {
    await db.delete(caseLeads).where(eq(caseLeads.id, id));
  }

  async getStyleMemorySettings(userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<StyleMemorySettingsView | null> {
    const [row] = await db
      .select()
      .from(styleMemorySettings)
      .where(
        and(
          eq(styleMemorySettings.userId, userId),
          eq(styleMemorySettings.module, module),
          orgId == null ? sql`${styleMemorySettings.orgId} IS NULL` : eq(styleMemorySettings.orgId, orgId),
        ),
      )
      .limit(1);
    return row ? toStyleMemorySettingsView(row) : null;
  }

  async upsertStyleMemorySettings(args: {
    userId: string;
    module: StyleMemoryModule;
    orgId?: number | null;
    enabled?: boolean;
    ownershipMode?: StyleMemoryScope;
    strictness?: StyleMemoryStrictness;
  }): Promise<StyleMemorySettingsView> {
    const existing = await this.getStyleMemorySettings(args.userId, args.module, args.orgId);
    const nextEnabled = args.enabled ?? existing?.enabled ?? true;
    const nextOwnershipMode = args.ownershipMode ?? existing?.ownershipMode ?? "user-org";
    const nextStrictness = args.strictness ?? existing?.strictness ?? "balanced";

    if (existing) {
      const [updated] = await db
        .update(styleMemorySettings)
        .set({
          enabled: nextEnabled,
          ownershipMode: nextOwnershipMode,
          strictness: nextStrictness,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(styleMemorySettings.userId, args.userId),
            eq(styleMemorySettings.module, args.module),
            args.orgId == null ? sql`${styleMemorySettings.orgId} IS NULL` : eq(styleMemorySettings.orgId, args.orgId),
          ),
        )
        .returning();
      return toStyleMemorySettingsView(updated);
    }

    try {
      const [inserted] = await db
        .insert(styleMemorySettings)
        .values({
          userId: args.userId,
          orgId: args.orgId ?? null,
          module: args.module,
          enabled: nextEnabled,
          ownershipMode: nextOwnershipMode,
          strictness: nextStrictness,
          learningSource: "full-activity",
          coverage: "generation-only",
        })
        .returning();
      return toStyleMemorySettingsView(inserted);
    } catch (err: any) {
      // Race-safe path: if another request inserted the same scope first, update that row.
      if (String(err?.code || "") !== "23505") throw err;
      const collided = await this.getStyleMemorySettings(args.userId, args.module, args.orgId);
      if (!collided) throw err;
      const [updated] = await db
        .update(styleMemorySettings)
        .set({
          enabled: nextEnabled,
          ownershipMode: nextOwnershipMode,
          strictness: nextStrictness,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(styleMemorySettings.userId, args.userId),
            eq(styleMemorySettings.module, args.module),
            args.orgId == null ? sql`${styleMemorySettings.orgId} IS NULL` : eq(styleMemorySettings.orgId, args.orgId),
          ),
        )
        .returning();
      return toStyleMemorySettingsView(updated);
    }
  }

  async touchStyleMemoryBackfill(userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<void> {
    const existing = await this.getStyleMemorySettings(userId, module, orgId);
    if (!existing) {
      try {
        await db.insert(styleMemorySettings).values({
          userId,
          orgId: orgId ?? null,
          module,
          enabled: true,
          ownershipMode: "user-org",
          learningSource: "full-activity",
          coverage: "generation-only",
          strictness: "balanced",
          lastBackfillAt: new Date(),
        });
      } catch (err: any) {
        // If another request created it first, fall through to update.
        if (String(err?.code || "") !== "23505") throw err;
      }
      await db
        .update(styleMemorySettings)
        .set({ lastBackfillAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(styleMemorySettings.userId, userId),
            eq(styleMemorySettings.module, module),
            orgId == null ? sql`${styleMemorySettings.orgId} IS NULL` : eq(styleMemorySettings.orgId, orgId),
          ),
        );
      return;
    }

    await db
      .update(styleMemorySettings)
      .set({ lastBackfillAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(styleMemorySettings.userId, userId),
          eq(styleMemorySettings.module, module),
          orgId == null ? sql`${styleMemorySettings.orgId} IS NULL` : eq(styleMemorySettings.orgId, orgId),
        ),
      );
  }

  async getStyleMemorySourceCounts(userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<StyleMemorySourceCounts> {
    const rows = await db
      .select({
        sourceType: styleMemorySamples.sourceType,
        total: count(),
      })
      .from(styleMemorySamples)
      .where(
        and(
          eq(styleMemorySamples.userId, userId),
          eq(styleMemorySamples.module, module),
          eq(styleMemorySamples.status, "active"),
          orgId == null ? sql`${styleMemorySamples.orgId} IS NULL` : eq(styleMemorySamples.orgId, orgId),
        ),
      )
      .groupBy(styleMemorySamples.sourceType);

    let upload = 0;
    let savedDraft = 0;
    let acceptedRedline = 0;
    for (const row of rows) {
      if (row.sourceType === "upload") upload = Number(row.total || 0);
      if (row.sourceType === "saved-draft") savedDraft = Number(row.total || 0);
      if (row.sourceType === "accepted-redline") acceptedRedline = Number(row.total || 0);
    }

    return {
      upload,
      savedDraft,
      acceptedRedline,
      total: upload + savedDraft + acceptedRedline,
    };
  }

  async getStyleMemorySampleByHash(
    userId: string,
    module: StyleMemoryModule,
    textHash: string,
    orgId?: number | null,
  ): Promise<StyleMemorySample | undefined> {
    const [row] = await db
      .select()
      .from(styleMemorySamples)
      .where(
        and(
          eq(styleMemorySamples.userId, userId),
          eq(styleMemorySamples.module, module),
          eq(styleMemorySamples.textHash, textHash),
          orgId == null ? sql`${styleMemorySamples.orgId} IS NULL` : eq(styleMemorySamples.orgId, orgId),
        ),
      )
      .limit(1);
    return row;
  }

  async addStyleMemorySample(entry: InsertStyleMemorySample): Promise<StyleMemorySample> {
    const [row] = await db.insert(styleMemorySamples).values(entry).returning();
    return row;
  }

  async listStyleMemorySamples(
    userId: string,
    module: StyleMemoryModule,
    limit: number,
    offset: number,
    orgId?: number | null,
  ): Promise<PagedResult<StyleMemorySampleView>> {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const baseWhere = and(
      eq(styleMemorySamples.userId, userId),
      eq(styleMemorySamples.module, module),
      eq(styleMemorySamples.status, "active"),
      orgId == null ? sql`${styleMemorySamples.orgId} IS NULL` : eq(styleMemorySamples.orgId, orgId),
    );
    const [totalRow] = await db.select({ total: count() }).from(styleMemorySamples).where(baseWhere);
    const total = Number(totalRow?.total || 0);
    const rows = await db
      .select({
        id: styleMemorySamples.id,
        module: styleMemorySamples.module,
        sourceType: styleMemorySamples.sourceType,
        sourceRef: styleMemorySamples.sourceRef,
        title: styleMemorySamples.title,
        status: styleMemorySamples.status,
        createdAt: styleMemorySamples.createdAt,
      })
      .from(styleMemorySamples)
      .where(baseWhere)
      .orderBy(desc(styleMemorySamples.createdAt))
      .limit(safeLimit)
      .offset(safeOffset);

    return {
      items: rows.map((row: {
        id: number;
        module: string;
        sourceType: string;
        sourceRef: string | null;
        title: string;
        status: string;
        createdAt: Date | null;
      }) => ({
        id: row.id,
        module: row.module as StyleMemoryModule,
        sourceType: row.sourceType as StyleMemorySourceType,
        sourceRef: row.sourceRef,
        title: row.title,
        status: row.status as "active" | "deleted",
        createdAt: row.createdAt || null,
      })),
      total,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + rows.length < total,
    };
  }

  async deleteStyleMemorySample(id: number, userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<number> {
    const removed = await db
      .delete(styleMemorySamples)
      .where(
        and(
          eq(styleMemorySamples.id, id),
          eq(styleMemorySamples.userId, userId),
          eq(styleMemorySamples.module, module),
          orgId == null ? sql`${styleMemorySamples.orgId} IS NULL` : eq(styleMemorySamples.orgId, orgId),
        ),
      )
      .returning({ id: styleMemorySamples.id });
    return removed.length;
  }

  async deleteAllStyleMemorySamples(userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<number> {
    const removed = await db
      .delete(styleMemorySamples)
      .where(
        and(
          eq(styleMemorySamples.userId, userId),
          eq(styleMemorySamples.module, module),
          orgId == null ? sql`${styleMemorySamples.orgId} IS NULL` : eq(styleMemorySamples.orgId, orgId),
        ),
      )
      .returning({ id: styleMemorySamples.id });
    return removed.length;
  }

  async deleteStyleMemoryChunksBySample(sampleId: number, userId: string, module: StyleMemoryModule, orgId?: number | null): Promise<number> {
    const removed = await db
      .delete(styleMemoryChunks)
      .where(
        and(
          eq(styleMemoryChunks.sampleId, sampleId),
          eq(styleMemoryChunks.userId, userId),
          eq(styleMemoryChunks.module, module),
          orgId == null ? sql`${styleMemoryChunks.orgId} IS NULL` : eq(styleMemoryChunks.orgId, orgId),
        ),
      )
      .returning({ id: styleMemoryChunks.id });
    return removed.length;
  }

  async addStyleMemoryChunk(args: {
    sampleId: number;
    userId: string;
    module: StyleMemoryModule;
    orgId?: number | null;
    chunkIndex: number;
    content: string;
    tokenCount: number;
    embedding: string;
  }): Promise<void> {
    await db.insert(styleMemoryChunks).values({
      sampleId: args.sampleId,
      userId: args.userId,
      orgId: args.orgId ?? null,
      module: args.module,
      chunkIndex: args.chunkIndex,
      content: args.content,
      tokenCount: args.tokenCount,
      embedding: args.embedding,
    });
  }

  async logStyleMemoryEvent(args: {
    eventType: string;
    userId: string;
    module: StyleMemoryModule;
    orgId?: number | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await db.insert(styleMemoryEvents).values({
      eventType: args.eventType,
      userId: args.userId,
      orgId: args.orgId ?? null,
      module: args.module,
      metadata: args.metadata || {},
    });
  }

  async upsertAdminKnowledgeFile(entry: InsertAdminKnowledgeFile): Promise<AdminKnowledgeFile> {
    const [record] = await db
      .insert(adminKnowledgeFiles)
      .values(entry)
      .onConflictDoUpdate({
        target: adminKnowledgeFiles.adminKnowledgeId,
        set: {
          userId: entry.userId,
          provider: entry.provider,
          bucket: entry.bucket,
          objectKey: entry.objectKey,
          extractedTextKey: entry.extractedTextKey ?? null,
          originalFilename: entry.originalFilename ?? null,
          mimeType: entry.mimeType ?? null,
          sizeBytes: entry.sizeBytes ?? null,
          etag: entry.etag ?? null,
          publicUrl: entry.publicUrl ?? null,
          createdAt: new Date(),
        },
      })
      .returning();
    return record;
  }

  async getAdminKnowledgeFile(adminKnowledgeId: number): Promise<AdminKnowledgeFile | undefined> {
    const [record] = await db
      .select()
      .from(adminKnowledgeFiles)
      .where(eq(adminKnowledgeFiles.adminKnowledgeId, adminKnowledgeId))
      .limit(1);
    return record;
  }

  async getAdminKnowledgeFiles(): Promise<AdminKnowledgeFile[]> {
    return await db.select().from(adminKnowledgeFiles);
  }

  async deleteAdminKnowledgeFile(adminKnowledgeId: number): Promise<void> {
    await db.delete(adminKnowledgeFiles).where(eq(adminKnowledgeFiles.adminKnowledgeId, adminKnowledgeId));
  }

  async upsertStatuteDocumentFile(entry: InsertStatuteDocumentFile): Promise<StatuteDocumentFile> {
    const [record] = await db
      .insert(statuteDocumentFiles)
      .values(entry)
      .onConflictDoUpdate({
        target: statuteDocumentFiles.statuteDocumentId,
        set: {
          userId: entry.userId,
          provider: entry.provider,
          bucket: entry.bucket,
          objectKey: entry.objectKey,
          extractedTextKey: entry.extractedTextKey ?? null,
          originalFilename: entry.originalFilename ?? null,
          mimeType: entry.mimeType ?? null,
          sizeBytes: entry.sizeBytes ?? null,
          etag: entry.etag ?? null,
          publicUrl: entry.publicUrl ?? null,
          createdAt: new Date(),
        },
      })
      .returning();
    return record;
  }

  async getStatuteDocumentFile(statuteDocumentId: number): Promise<StatuteDocumentFile | undefined> {
    const [record] = await db
      .select()
      .from(statuteDocumentFiles)
      .where(eq(statuteDocumentFiles.statuteDocumentId, statuteDocumentId))
      .limit(1);
    return record;
  }

  async getStatuteDocumentFiles(): Promise<StatuteDocumentFile[]> {
    return await db.select().from(statuteDocumentFiles);
  }

  async deleteStatuteDocumentFile(statuteDocumentId: number): Promise<void> {
    await db.delete(statuteDocumentFiles).where(eq(statuteDocumentFiles.statuteDocumentId, statuteDocumentId));
  }

  async createBookmark(insertBookmark: InsertBookmark & { userId: string }): Promise<Bookmark> {
    const [bookmark] = await db.insert(bookmarks).values(insertBookmark).returning();
    return bookmark;
  }

  async getBookmarks(userId: string): Promise<Bookmark[]> {
    return await db.select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt));
  }

  async deleteBookmark(id: number, userId: string): Promise<void> {
    await db.delete(bookmarks).where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));
  }

  async addSearchHistory(entry: InsertSearchHistory & { userId: string }): Promise<SearchHistory> {
    const [record] = await db.insert(searchHistory).values(entry).returning();
    return record;
  }

  async getSearchHistory(userId: string): Promise<SearchHistory[]> {
    return await db.select()
      .from(searchHistory)
      .where(eq(searchHistory.userId, userId))
      .orderBy(desc(searchHistory.createdAt));
  }

  async searchStatutes(query: string, limit: number = 10): Promise<Statute[]> {
    const safeQuery = String(query || "").trim();
    if (!safeQuery) return [];

    const tokens = safeQuery
      .toLowerCase()
      .split(MULTIPLE_SPACES_REGEX)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
      .slice(0, 10);

    if (tokens.length === 0) {
      // Fallback if all words are stop words or too short
      const pattern = `%${safeQuery}%`;
      return await db.select()
        .from(statutes)
        .where(
          or(
            ilike(statutes.shortTitle, pattern),
            ilike(statutes.section, pattern),
            ilike(statutes.description, pattern),
            ilike(statutes.punishment, pattern)
          )
        )
        .limit(limit);
    }

    // Use OR across tokens with relevance ranking (AND was too strict —
    // complex multi-topic queries returned 0 results because no single
    // statute matched ALL tokens simultaneously).
    const conditions = tokens.map((token) => {
      const pattern = `%${token}%`;
      return or(
        ilike(statutes.shortTitle, pattern),
        ilike(statutes.section, pattern),
        ilike(statutes.description, pattern),
        ilike(statutes.punishment, pattern)
      );
    });

    // Require at least one token match (OR), then fetch extra and rank by match count
    const fetchLimit = Math.min(limit * 5, 200);
    const rows = await db.select()
      .from(statutes)
      .where(or(...conditions))
      .limit(fetchLimit);

    // Rank by number of matching tokens — statutes matching more tokens are more relevant
    const ranked = rows.map((row: Statute) => {
      const combined = `${row.shortTitle} ${row.section} ${row.description} ${row.punishment}`.toLowerCase();
      let matchCount = 0;
      for (const token of tokens) {
        if (combined.includes(token)) matchCount++;
      }
      return { row, matchCount };
    });

    ranked.sort((a: { matchCount: number }, b: { matchCount: number }) => b.matchCount - a.matchCount);
    return ranked.slice(0, limit).map((r: { row: Statute }) => r.row);
  }

  async getStatutesByTitle(shortTitle: string, limit: number = 20): Promise<Statute[]> {
    const safeTitle = String(shortTitle || "").trim();
    if (!safeTitle) return [];
    return await db.select()
      .from(statutes)
      .where(ilike(statutes.shortTitle, safeTitle))
      .limit(limit);
  }

  async getStatuteByTitleAndSection(shortTitle: string, section: string): Promise<Statute | undefined> {
    const [row] = await db.select()
      .from(statutes)
      .where(
        and(
          ilike(statutes.shortTitle, shortTitle),
          ilike(statutes.section, section)
        )
      )
      .limit(1);
    return row;
  }

  async getAllStatutes(): Promise<Statute[]> {
    return await db.select().from(statutes);
  }

  async searchCaseLaw(query: string, limit: number = 10, options: CaseLawSearchOptions = {}): Promise<CaseLaw[]> {
    const safeQuery = String(query || "").trim();
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const hasTextQuery = safeQuery.length > 0;
    const queryTokens = hasTextQuery
      ? safeQuery
          .toLowerCase()
          .split(MULTIPLE_SPACES_REGEX)
          .map((t) => t.trim())
          .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
          .slice(0, 10)
      : [];

    // Parse structured citation parts (year / report / page)
    const parsedFromQuery = options.parsedCitation === undefined
      ? parseCaseLawCitationParts(safeQuery)
      : (options.parsedCitation || null);

    const yearRaw = Number.isInteger(Number(options.year)) ? Number(options.year) : parsedFromQuery?.year;
    const pageRaw = Number.isInteger(Number(options.page)) ? Number(options.page) : parsedFromQuery?.page;
    const reportRaw = normalizeCaseLawCitationReport(options.report || parsedFromQuery?.report || "");
    const courtRaw = String(options.court || "").trim();
    const sortMode = options.sort === "latest" ? "latest" : "relevance";
    const includeSourceContentSearch = options.includeSourceContentSearch === true;

    const year = Number.isInteger(yearRaw) && Number(yearRaw) >= 1900 && Number(yearRaw) <= 2200 ? Number(yearRaw) : null;
    const page = Number.isInteger(pageRaw) && Number(pageRaw) > 0 ? Number(pageRaw) : null;
    const hasYear = year !== null;
    const hasPage = page !== null;
    const hasReport = reportRaw.length > 0;

    // ── Hybrid Search Strategy ──────────────────────────────────────────
    // Tier 1 (PRIMARY, <100ms): tsvector @@ tsquery using GIN index
    //   → Uses idx_case_law_full_text_tsv (expression-based GIN on citation||title||summary||court)
    // Tier 2 (FALLBACK, <500ms): pg_trgm ILIKE only if Tier 1 returns < limit
    //   → Uses idx_case_law_*_trgm indexes for partial/fuzzy matches
    // Structured citation match always runs (B-tree indexed, instant)

    const courtFilter = courtRaw ? ilike(caseLaw.court, `%${courtRaw}%`) : undefined;

    // ── Relevance scoring (shared by both tiers) ────────────────────────
    const exactTriplet = hasReport && hasYear && hasPage
      ? sql`CASE WHEN upper(${caseLaw.citationReport}) = ${reportRaw} AND ${caseLaw.citationYear} = ${year} AND ${caseLaw.citationPage} = ${page} THEN 1000 ELSE 0 END`
      : sql`0`;
    const reportMatch = hasReport
      ? sql`CASE WHEN upper(${caseLaw.citationReport}) = ${reportRaw} THEN 200 ELSE 0 END`
      : sql`0`;
    const yearMatch = hasYear
      ? sql`CASE WHEN ${caseLaw.citationYear} = ${year} THEN 100 ELSE 0 END`
      : sql`0`;
    const pageMatch = hasPage
      ? sql`CASE WHEN ${caseLaw.citationPage} = ${page} THEN 300 ELSE 0 END`
      : sql`0`;
    const primaryBoost = sql`CASE WHEN ${caseLaw.citationRole} = 'primary' THEN 150 ELSE 0 END`;

    // Per-token hit count for scoring (runs inside SELECT, not WHERE)
    const tokenScoreParts = queryTokens.map((token) => {
      const pat = `%${token}%`;
      return sql`(
        CASE WHEN ${caseLaw.citation} ILIKE ${pat} THEN 30 ELSE 0 END +
        CASE WHEN ${caseLaw.title} ILIKE ${pat} THEN 50 ELSE 0 END +
        CASE WHEN ${caseLaw.summary} ILIKE ${pat} THEN 40 ELSE 0 END +
        CASE WHEN ${caseLaw.court} ILIKE ${pat} THEN 20 ELSE 0 END +
        CASE WHEN array_to_string(coalesce(${caseLaw.keywords}, ARRAY[]::text[]), ' ') ILIKE ${pat} THEN 60 ELSE 0 END
      )`;
    });
    const tokenScore = tokenScoreParts.length > 0
      ? sql.join(tokenScoreParts, sql` + `)
      : sql`0`;

    const phraseScore = hasTextQuery
      ? sql`(
          CASE WHEN ${caseLaw.citation} ILIKE ${'%' + safeQuery + '%'} THEN 120 ELSE 0 END +
          CASE WHEN ${caseLaw.title} ILIKE ${'%' + safeQuery + '%'} THEN 80 ELSE 0 END +
          CASE WHEN ${caseLaw.summary} ILIKE ${'%' + safeQuery + '%'} THEN 60 ELSE 0 END
        )`
      : sql`0`;

    // tsvector rank score (0-1 range, multiply by 500 to be comparable with ILIKE bonuses)
    const tsRankScore = hasTextQuery && queryTokens.length > 0
      ? sql`(ts_rank_cd(tsv_citation_title_summary_court, to_tsquery('simple', ${queryTokens.join(' | ')})) * 500)::int`
      : sql`0`;

    const relevanceScore = sql<number>`(${exactTriplet} + ${reportMatch} + ${yearMatch} + ${pageMatch} + ${primaryBoost} + ${tokenScore} + ${phraseScore} + ${tsRankScore})`;

    const fetchLimit = Math.min(200, safeLimit * 4);

    // For single common-word queries (like "murder"), force sort by date and reduce
    // fetch limit. Sorting by date uses the B-tree index on citation_year (instant),
    // while relevance sorting requires expensive ILIKE scoring on every matched row.
    const isBroadSingleWord = queryTokens.length <= 1 && !hasYear && !hasReport && !hasPage;
    const effectiveFetchLimit = isBroadSingleWord
      ? Math.min(fetchLimit, safeLimit * 2)
      : fetchLimit;
    const effectiveSortMode = isBroadSingleWord ? "latest" : sortMode;

    // ── Tier 1: tsvector full-text search (GIN indexed) ─────────────────
    let rows: CaseLaw[] = [];

    if (hasTextQuery && queryTokens.length > 0) {
      // Build tsquery: OR of all tokens for broad matching
      const tsQueryBroad = queryTokens.join(' | ');
      // Build tsquery: AND of top 3 tokens for precise matching
      const tsQueryNarrow = queryTokens.slice(0, 3).join(' & ');

      const tsvExpr = sql`tsv_citation_title_summary_court`;

      // Structured citation clauses to OR with tsvector (B-tree, instant)
      const structuredClauses: ReturnType<typeof sql>[] = [];
      if (hasYear && hasReport && hasPage) {
        structuredClauses.push(sql`(${caseLaw.citationYear} = ${year} AND upper(${caseLaw.citationReport}) = ${reportRaw} AND ${caseLaw.citationPage} = ${page})`);
      } else {
        if (hasYear) structuredClauses.push(sql`${caseLaw.citationYear} = ${year}`);
        if (hasPage) structuredClauses.push(sql`${caseLaw.citationPage} = ${page}`);
        if (hasReport) structuredClauses.push(sql`upper(${caseLaw.citationReport}) = ${reportRaw}`);
      }

      // Try narrow (AND) first for precision
      const narrowWhere = structuredClauses.length > 0
        ? or(sql`${tsvExpr} @@ to_tsquery('simple', ${tsQueryNarrow})`, ...structuredClauses)!
        : sql`${tsvExpr} @@ to_tsquery('simple', ${tsQueryNarrow})`;
      const narrowWhereWithCourt = courtFilter ? and(narrowWhere, courtFilter)! : narrowWhere;

      const narrowBuilder = db.select().from(caseLaw).where(narrowWhereWithCourt);
      rows = effectiveSortMode === "latest"
        ? await narrowBuilder.orderBy(desc(caseLaw.citationYear), desc(relevanceScore), desc(caseLaw.id)).limit(effectiveFetchLimit)
        : await narrowBuilder.orderBy(desc(relevanceScore), desc(caseLaw.citationYear), desc(caseLaw.id)).limit(effectiveFetchLimit);

      // Only fall back to broad (OR) when narrow (AND) returns ZERO results.
      // Previously this triggered when rows < limit, which diluted precision —
      // e.g. "bail in narcotics" finding 5 exact matches would flood with any "bail" case.
      if (rows.length === 0 && queryTokens.length > 1) {
        const broadWhere = structuredClauses.length > 0
          ? or(sql`${tsvExpr} @@ to_tsquery('simple', ${tsQueryBroad})`, ...structuredClauses)!
          : sql`${tsvExpr} @@ to_tsquery('simple', ${tsQueryBroad})`;
        const broadWhereWithCourt = courtFilter ? and(broadWhere, courtFilter)! : broadWhere;

        const broadBuilder = db.select().from(caseLaw).where(broadWhereWithCourt);
        rows = effectiveSortMode === "latest"
          ? await broadBuilder.orderBy(desc(caseLaw.citationYear), desc(relevanceScore), desc(caseLaw.id)).limit(effectiveFetchLimit)
          : await broadBuilder.orderBy(desc(relevanceScore), desc(caseLaw.citationYear), desc(caseLaw.id)).limit(effectiveFetchLimit);
      }

      // ── Tier 2 FALLBACK: pg_trgm ILIKE if tsvector returned 0 ─────────
      if (rows.length === 0) {
        const ilikeClauses: ReturnType<typeof sql>[] = [...structuredClauses];
        // Per-token ILIKE (uses GIN trigram indexes)
        for (const token of queryTokens.slice(0, 6)) {
          const pat = `%${token}%`;
          ilikeClauses.push(ilike(caseLaw.title, pat));
          ilikeClauses.push(ilike(caseLaw.summary, pat));
          ilikeClauses.push(ilike(caseLaw.citation, pat));
        }
        if (ilikeClauses.length > 0) {
          const ilikeWhere = courtFilter
            ? and(or(...ilikeClauses)!, courtFilter)!
            : or(...ilikeClauses)!;
          const ilikeBuilder = db.select().from(caseLaw).where(ilikeWhere);
          rows = effectiveSortMode === "latest"
            ? await ilikeBuilder.orderBy(desc(caseLaw.citationYear), desc(relevanceScore), desc(caseLaw.id)).limit(effectiveFetchLimit)
            : await ilikeBuilder.orderBy(desc(relevanceScore), desc(caseLaw.citationYear), desc(caseLaw.id)).limit(effectiveFetchLimit);
        }
      }
    } else {
      // No text query — only structured citation filters
      const structuredClauses: ReturnType<typeof sql>[] = [];
      if (hasYear && hasReport && hasPage) {
        structuredClauses.push(sql`(${caseLaw.citationYear} = ${year} AND upper(${caseLaw.citationReport}) = ${reportRaw} AND ${caseLaw.citationPage} = ${page})`);
      } else {
        if (hasYear) structuredClauses.push(sql`${caseLaw.citationYear} = ${year}`);
        if (hasPage) structuredClauses.push(sql`${caseLaw.citationPage} = ${page}`);
        if (hasReport) structuredClauses.push(sql`upper(${caseLaw.citationReport}) = ${reportRaw}`);
      }
      if (structuredClauses.length === 0) return [];
      const structuredWhere = courtFilter
        ? and(or(...structuredClauses)!, courtFilter)!
        : or(...structuredClauses)!;
      const builder = db.select().from(caseLaw).where(structuredWhere);
      rows = effectiveSortMode === "latest"
        ? await builder.orderBy(desc(caseLaw.citationYear), desc(relevanceScore), desc(caseLaw.id)).limit(effectiveFetchLimit)
        : await builder.orderBy(desc(relevanceScore), desc(caseLaw.citationYear), desc(caseLaw.id)).limit(effectiveFetchLimit);
    }

    // ── Source content search (append additional results) ───────────────
    if (includeSourceContentSearch && hasTextQuery && rows.length < safeLimit) {
      const srcPattern = `%${safeQuery}%`;
      const srcWhere = sql`(
        (coalesce(${caseLaw.sourceType}, '') = 'admin' AND exists (select 1 from ${adminKnowledge} ak where ak.id = ${caseLaw.sourceDocId} and coalesce(ak.content, '') ILIKE ${srcPattern}))
        OR (coalesce(${caseLaw.sourceType}, '') = 'github' AND exists (select 1 from ${githubKnowledge} gk where gk.id = ${caseLaw.sourceDocId} and coalesce(gk.content, '') ILIKE ${srcPattern}))
        OR (coalesce(${caseLaw.sourceType}, '') = 'statute' AND exists (select 1 from ${statuteDocuments} sd where sd.id = ${caseLaw.sourceDocId} and coalesce(sd.content, '') ILIKE ${srcPattern}))
        OR (coalesce(${caseLaw.sourceType}, '') = 'user' AND exists (select 1 from ${documents} d where d.id = ${caseLaw.sourceDocId} and coalesce(d.content, '') ILIKE ${srcPattern}))
      )`;
      const srcRows = await db.select().from(caseLaw).where(srcWhere).limit(safeLimit).catch(() => [] as CaseLaw[]);
      rows = [...rows, ...srcRows];
    }

    // ── Deduplicate by citation key ─────────────────────────────────────
    const deduped: CaseLaw[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const key = buildCaseLawDedupKey(row);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push({ ...row, title: cleanCaseTitle(row.title) });
      if (deduped.length >= safeLimit) break;
    }
    return deduped;
  }

  async getAllCaseLaw(): Promise<CaseLaw[]> {
    return await db.select().from(caseLaw);
  }

  async getCaseLawPage(limit: number, offset: number): Promise<PagedResult<CaseLaw>> {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const [totalRow] = await db.select({ total: count() }).from(caseLaw);
    const total = Number(totalRow?.total || 0);
    const items = await db.select()
      .from(caseLaw)
      .orderBy(desc(caseLaw.id))
      .limit(safeLimit)
      .offset(safeOffset);
    return {
      items: items.map((item: any) => ({ ...item, title: cleanCaseTitle(item.title) })),
      total,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + items.length < total,
    };
  }

  async getCaseLawById(id: number): Promise<CaseLaw | undefined> {
    const [row] = await db.select().from(caseLaw).where(eq(caseLaw.id, id));
    if (row) {
      row.title = cleanCaseTitle(row.title);
    }
    return row;
  }

  async getCaseLawByCitation(citation: string): Promise<CaseLaw | undefined> {
    const [row] = await db.select().from(caseLaw).where(ilike(caseLaw.citation, `%${citation}%`)).limit(1);
    if (row) {
      row.title = cleanCaseTitle(row.title);
    }
    return row;
  }

  async getCaseLawBySourceDocuments(sourceDocIds: number[], sourceType?: string): Promise<CaseLaw[]> {
    const ids = Array.from(
      new Set(
        sourceDocIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    );
    if (ids.length === 0) return [];

    const normalizedType = String(sourceType || "").trim();
    const whereClause = normalizedType
      ? and(inArray(caseLaw.sourceDocId, ids), eq(caseLaw.sourceType, normalizedType))
      : inArray(caseLaw.sourceDocId, ids);

    return await db.select()
      .from(caseLaw)
      .where(whereClause)
      .orderBy(desc(caseLaw.id));
  }

  async getCaseLawCitations(): Promise<string[]> {
    const rows = await db.select({ citation: caseLaw.citation }).from(caseLaw);
    return rows.map((r: { citation: string }) => r.citation.toLowerCase().trim());
  }

  async resetAllCaseLawCitationRolesToCited(): Promise<number> {
    const updated = await db
      .update(caseLaw)
      .set({ citationRole: "cited" })
      .returning({ id: caseLaw.id });
    return updated.length;
  }

  async createCaseLaw(entry: InsertCaseLaw): Promise<CaseLaw> {
    const normalizedEntry = enrichCaseLawCitationFields(entry);
    if (normalizedEntry.citationRole !== "primary" && normalizedEntry.citationRole !== "cited") {
      normalizedEntry.citationRole = "cited";
    }
    const report = normalizeCaseLawCitationReport(String(normalizedEntry.citationReport || ""));
    const year = Number(normalizedEntry.citationYear);
    const page = Number(normalizedEntry.citationPage);

    const findExisting = async (): Promise<CaseLaw | undefined> => {
      let existing: CaseLaw | undefined;
      if (report && Number.isInteger(year) && Number.isInteger(page) && page > 0) {
        const [row] = await db.select().from(caseLaw).where(
          and(
            eq(caseLaw.citationYear, year),
            eq(caseLaw.citationPage, page),
            sql`upper(${caseLaw.citationReport}) = ${report}`,
          ),
        )
          .orderBy(desc(caseLaw.id))
          .limit(1);
        existing = row;
      }

      if (!existing && String(normalizedEntry.citation || "").trim()) {
        const citationRaw = String(normalizedEntry.citation).trim();
        const [row] = await db.select().from(caseLaw).where(
          sql`lower(trim(${caseLaw.citation})) = lower(trim(${citationRaw}))`,
        )
          .orderBy(desc(caseLaw.id))
          .limit(1);
        existing = row;
      }
      return existing;
    };

    const mergeIntoExisting = async (existing: CaseLaw): Promise<CaseLaw> => {
      const patch: Partial<InsertCaseLaw> = {};

      if (!String(existing.court || "").trim() && String(normalizedEntry.court || "").trim()) {
        patch.court = normalizedEntry.court;
      }
      if (
        String(existing.title || "").toLowerCase().startsWith("case reported at")
        && !String(normalizedEntry.title || "").toLowerCase().startsWith("case reported at")
      ) {
        patch.title = normalizedEntry.title;
      }
      if (
        String(existing.summary || "").toLowerCase().startsWith("case cited as")
        && !String(normalizedEntry.summary || "").toLowerCase().startsWith("case cited as")
      ) {
        patch.summary = normalizedEntry.summary;
      }

      if (!existing.sourceDocId && normalizedEntry.sourceDocId) {
        patch.sourceDocId = normalizedEntry.sourceDocId;
      }
      if (!existing.sourceType && normalizedEntry.sourceType) {
        patch.sourceType = normalizedEntry.sourceType;
      }
      if (!existing.sourceFilename && normalizedEntry.sourceFilename) {
        patch.sourceFilename = normalizedEntry.sourceFilename;
      }
      if (normalizedEntry.citationRole === "primary" && normalizedEntry.sourceDocId && normalizedEntry.sourceType) {
        const shouldPromoteSource =
          existing.citationRole !== "primary"
          || !existing.sourceDocId
          || !existing.sourceType;
        if (shouldPromoteSource) {
          patch.sourceDocId = normalizedEntry.sourceDocId;
          patch.sourceType = normalizedEntry.sourceType;
          if (normalizedEntry.sourceFilename) {
            patch.sourceFilename = normalizedEntry.sourceFilename;
          }
        }
      }
      if (existing.citationRole !== "primary" && normalizedEntry.citationRole === "primary") {
        patch.citationRole = "primary";
      }
      if (!existing.citationRole && normalizedEntry.citationRole) {
        patch.citationRole = normalizedEntry.citationRole;
      }

      if (Array.isArray(normalizedEntry.keywords) && normalizedEntry.keywords.length > 0) {
        const mergedKeywords = Array.from(
          new Set(
            [...(existing.keywords || []), ...normalizedEntry.keywords]
              .map((item) => String(item || "").trim())
              .filter(Boolean),
          ),
        ).slice(0, 30);
        const oldKeywords = Array.isArray(existing.keywords) ? existing.keywords : [];
        const changed = mergedKeywords.length !== oldKeywords.length
          || mergedKeywords.some((kw, idx) => kw !== oldKeywords[idx]);
        if (changed) patch.keywords = mergedKeywords;
      }

      if (Object.keys(patch).length > 0) {
        const [updated] = await db.update(caseLaw).set(patch).where(eq(caseLaw.id, existing.id)).returning();
        return updated || existing;
      }
      return existing;
    };

    const existing = await findExisting();
    if (existing) {
      return await mergeIntoExisting(existing);
    }

    try {
      const [created] = await db.insert(caseLaw).values(normalizedEntry).returning();
      return created;
    } catch (err: any) {
      // Race-safe path: if concurrent insert wins, resolve to canonical existing row.
      if (String(err?.code || "") === "23505") {
        const collided = await findExisting();
        if (collided) {
          return await mergeIntoExisting(collided);
        }
      }
      throw err;
    }
  }

  async updateCaseLaw(id: number, entry: Partial<InsertCaseLaw>): Promise<CaseLaw | undefined> {
    const normalizedEntry = enrichCaseLawCitationFields(entry);
    const [updated] = await db.update(caseLaw).set(normalizedEntry).where(eq(caseLaw.id, id)).returning();
    return updated;
  }

  async deleteCaseLaw(id: number): Promise<void> {
    await db.delete(caseLaw).where(eq(caseLaw.id, id));
  }

  async deleteAllCaseLaw(): Promise<number> {
    const all = await db.select({ id: caseLaw.id }).from(caseLaw);
    if (all.length === 0) return 0;
    await db.delete(caseLaw);
    return all.length;
  }

  async bulkCreateCaseLaw(entries: InsertCaseLaw[]): Promise<CaseLaw[]> {
    if (entries.length === 0) return [];

    // Normalize and in-batch dedup
    const normalizedEntries = entries.map((entry) => enrichCaseLawCitationFields(entry));
    const perBatchDeduped: InsertCaseLaw[] = [];
    const batchKeys = new Set<string>();
    for (const entry of normalizedEntries) {
      const key = buildCaseLawDedupKey(entry as Partial<CaseLaw>);
      if (!key || batchKeys.has(key)) continue;
      batchKeys.add(key);
      perBatchDeduped.push(entry);
    }
    if (perBatchDeduped.length === 0) return [];

    // Bulk lookup to find already-existing records by citation text
    const citationTexts = perBatchDeduped.map((e) =>
      normalizeCaseLawCitationText(String(e.citation || "")).toLowerCase(),
    );
    const existingRows = await db
      .select()
      .from(caseLaw)
      .where(sql`lower(trim(${caseLaw.citation})) = ANY(${citationTexts})`);

    const existingByCit = new Map<string, CaseLaw>();
    for (const row of existingRows) {
      existingByCit.set(
        normalizeCaseLawCitationText(row.citation).toLowerCase(),
        row,
      );
    }

    // Split into truly-new vs already-existing
    const toInsert: InsertCaseLaw[] = [];
    const alreadyExist: CaseLaw[] = [];
    for (const entry of perBatchDeduped) {
      const key = normalizeCaseLawCitationText(String(entry.citation || "")).toLowerCase();
      if (existingByCit.has(key)) {
        alreadyExist.push(existingByCit.get(key)!);
      } else {
        toInsert.push(entry);
      }
    }

    // Batch INSERT in chunks of 100 — use ON CONFLICT DO NOTHING via try/catch per chunk
    const CHUNK = 100;
    const inserted: CaseLaw[] = [];
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      try {
        const rows = await db.insert(caseLaw).values(chunk).returning();
        inserted.push(...rows);
      } catch {
        // Chunk had a collision — fall back to individual inserts for safety
        for (const entry of chunk) {
          try {
            const created = await this.createCaseLaw(entry);
            inserted.push(created);
          } catch { /* skip true duplicates */ }
        }
      }
    }

    return [...alreadyExist, ...inserted];
  }

  async getLawJournals(): Promise<Array<{ id: number; code: string; name: string }>> {
    return await db.select({
      id: lawJournals.id,
      code: lawJournals.code,
      name: lawJournals.name,
    })
      .from(lawJournals)
      .where(eq(lawJournals.isActive, true))
      .orderBy(lawJournals.code);
  }

  async getCourtsRef(): Promise<Array<{ id: number; code: string; name: string; level: string }>> {
    return await db.select({
      id: courtsRef.id,
      code: courtsRef.code,
      name: courtsRef.name,
      level: courtsRef.level,
    })
      .from(courtsRef)
      .where(eq(courtsRef.isActive, true))
      .orderBy(courtsRef.name);
  }

  async searchJudgmentsByCitation(params: { year: number; journalCode?: string; page: number; court?: string }): Promise<CitationSearchResult[]> {
    const conditions = [
      eq(judgments.year, params.year),
      eq(judgments.page, params.page),
      eq(judgments.isActive, true),
    ];
    if (params.journalCode?.trim()) {
      conditions.push(sql`lower(${lawJournals.code}) = lower(${params.journalCode.trim()})`);
    }

    if (params.court && params.court.trim()) {
      const courtPattern = `%${params.court.trim()}%`;
      conditions.push(or(
        ilike(courtsRef.name, courtPattern),
        ilike(judgments.courtNameSnapshot, courtPattern),
      )!);
    }

    const rows = await db.select({
      id: judgments.id,
      citation: judgments.citationString,
      title: judgments.title,
      courtName: courtsRef.name,
      courtSnapshot: judgments.courtNameSnapshot,
      decisionDate: judgments.decisionDate,
      pdfUrl: judgments.pdfUrl,
    })
      .from(judgments)
      .innerJoin(lawJournals, eq(judgments.journalId, lawJournals.id))
      .leftJoin(courtsRef, eq(judgments.courtId, courtsRef.id))
      .where(and(...conditions))
      .orderBy(desc(judgments.decisionDate));

    return rows.map((row: typeof rows[number]) => ({
      id: row.id,
      citation: row.citation,
      title: row.title,
      court: row.courtName || row.courtSnapshot || "",
      decisionDate: row.decisionDate,
      pdfUrl: row.pdfUrl,
    }));
  }

  async searchJudgmentsByKeywords(query: string, limit: number): Promise<CaseLaw[]> {
    const safeQuery = String(query || "").trim();
    if (!safeQuery) return [];
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));

    const seen = new Set<string>();
    const results: CaseLaw[] = [];

    // Prioritize direct citation lookup in case the user search query is an exact citation (e.g. "2026 CLC 424")
    const parsedCitation = parseCaseLawCitationParts(safeQuery);
    if (parsedCitation) {
      try {
        const [journal] = await db
          .select({ id: lawJournals.id })
          .from(lawJournals)
          .where(eq(sql`lower(${lawJournals.code})`, parsedCitation.report.toLowerCase()))
          .limit(1);

        if (journal) {
          const matchingJudgments = await db
            .select({
              id: judgments.id,
              year: judgments.year,
              page: judgments.page,
              citationString: judgments.citationString,
              title: judgments.title,
              petitioner: judgments.petitioner,
              respondent: judgments.respondent,
              headnotes: judgments.headnotes,
              fullTextHead: sql<string>`LEFT(${judgments.fullText}, 1500)`,
              courtName: courtsRef.name,
              courtSnapshot: judgments.courtNameSnapshot,
              journalCode: lawJournals.code,
            })
            .from(judgments)
            .innerJoin(lawJournals, eq(judgments.journalId, lawJournals.id))
            .leftJoin(courtsRef, eq(judgments.courtId, courtsRef.id))
            .where(
              and(
                eq(judgments.year, parsedCitation.year),
                eq(judgments.journalId, journal.id),
                eq(judgments.page, parsedCitation.page),
                eq(judgments.isActive, true)
              )
            )
            .limit(1);

          for (const row of matchingJudgments) {
            const citation = String(row.citationString || "").trim();
            if (citation) {
              seen.add(citation.toLowerCase());
              const numericId = Math.abs(parseInt(String(row.id || "").replace(/-/g, "").slice(0, 8), 16)) || 0;

              const fullTextStr = String(row.fullTextHead || "");
              const fullTextTitleMatch = fullTextStr.match(TITLE_HEADER_REGEX);
              const fullTextTitle = fullTextTitleMatch ? fullTextTitleMatch[1].replace(MULTIPLE_SPACES_REGEX, " ").trim() : "";

              const fullTextCourtNameMatch = fullTextStr.match(COURT_NAME_HEADER_REGEX);
              const fullTextCourtMatch = fullTextStr.match(COURT_HEADER_REGEX);
              const fullTextCourt = (fullTextCourtNameMatch ? fullTextCourtNameMatch[1].replace(MULTIPLE_SPACES_REGEX, " ").trim() : "") ||
                                    (fullTextCourtMatch ? fullTextCourtMatch[1].replace(MULTIPLE_SPACES_REGEX, " ").trim() : "");

              const courtRaw = String(row.courtName || row.courtSnapshot || "").trim();
              const courtStr = courtRaw || fullTextCourt;

              const parties = [row.petitioner, row.respondent].filter(Boolean).join(" vs ");
              const dbTitleRaw = String(row.title || "").trim();
              const isPlaceholderTitle =
                !dbTitleRaw ||
                PLACEHOLDER_TITLE_REGEX.test(dbTitleRaw) ||
                dbTitleRaw === `Case ${citation}` ||
                !looksLikeRealCaseTitle(dbTitleRaw);

              const titleStr =
                (!isPlaceholderTitle && dbTitleRaw) ||
                (looksLikeRealCaseTitle(fullTextTitle) ? fullTextTitle : "") ||
                parties ||
                fullTextTitle ||
                `Case ${citation}`;

              const headnotesRaw = String(row.headnotes || "").trim();
              const isPlaceholderHeadnotes =
                !headnotesRaw || 
                PLACEHOLDER_HEADNOTES_REGEX.test(headnotesRaw) ||
                isMetadataOnlySummary(headnotesRaw);
              const fullTextBody = extractSubstantiveSummary(fullTextStr);
              const summaryStr = isPlaceholderHeadnotes && fullTextBody
                ? fullTextBody
                : headnotesRaw.slice(0, 600).trim();

              results.push({
                id: numericId,
                citation,
                citationYear: Number.isInteger(row.year) ? row.year : null,
                citationReport: row.journalCode || null,
                citationPage: Number.isInteger(row.page) && row.page > 0 ? row.page : null,
                citationRole: "primary" as const,
                court: courtStr,
                title: cleanCaseTitle(titleStr),
                summary: summaryStr,
                keywords: [] as string[],
                sourceDocId: null,
                sourceType: "judgment",
                sourceFilename: null,
                documentClassification: null,
                fallbackExtraction: false,
                statuteReferences: [] as string[],
              } as unknown as CaseLaw);
            }
          }
        }
      } catch (err) {
        console.error("Direct citation lookup in searchJudgmentsByKeywords failed:", err);
      }
    }

    // ── Hybrid Search Strategy ──────────────────────────────────────────
    // Tier 1 (PRIMARY, <200ms): tsvector @@ tsquery using GIN index
    //   → Uses idx_judgments_title_headnotes_tsv (expression-based GIN on title||headnotes only)
    //   → Config: 'simple' (matches the index exactly — no config mismatch)
    // Tier 2 (FALLBACK, <1s): pg_trgm ILIKE only if tsvector returns 0
    //   → Uses idx_judgments_title_trgm, idx_judgments_headnotes_trgm



    // Legal signal tokens to prioritize for WHERE filtering over narrative filler words.
    // Example:
    //   "A issues a post-dated cheque ..." should prioritize "cheque" (and related legal
    //   terms), not first-seen narrative tokens like "issues post dated".
    const LEGAL_SIGNAL_TOKENS = new Set([
      // Core procedural / statutory tokens
      "section", "article", "ppc", "crpc", "qso", "cpc", "cnsa",
      "cheque", "dishonour", "dishonor", "bail", "murder", "qatl", "diyat",
      "contract", "agreement", "fraud", "forgery", "theft", "robbery",
      "narcotics", "zina", "inheritance", "succession", "custody",
      "maintenance", "divorce", "khula", "rent", "tenancy", "eviction",
      "appeal", "petition", "revision", "writ", "constitutional", "injunction",
      "conviction", "acquittal", "evidence", "fir",
      // Family / dower law tokens
      "haq", "mehr", "dower", "nikahnama", "mahr", "mehar", "hiba",
      "talaq", "nafaqa", "iddat", "walima", "mflo",
      "dissolution", "marriage", "restitution", "conjugal",
      // Banking / finance / recovery tokens
      "bank", "banking", "financing", "loan", "mortgage", "markup",
      "recovery", "credit", "guarantee", "guarantor", "restructuring",
      "defaulter", "lien", "hypothecation", "overdraft", "set-off",
      // Criminal law tokens (new)
      "arms", "weapons", "firearms", "pistol", "explosives", "ammunition",
      "terrorism", "terrorist", "ata", "blasphemy", "desecration",
      "hurt", "injury", "grievous", "arsh", "daman",
      "burglary", "housebreaking", "stealing",
      "extortion", "bhatta", "blackmail", "intimidation",
      "defamation", "defamatory", "libel", "slander",
      "obscenity", "pornography",
      "riot", "rioting", "unlawful", "affray",
      "arson", "mischief", "vandalism",
      "honor", "honour", "karo", "ghairat",
      "acid", "disfigurement", "corrosive",
      // Civil / commercial law tokens (new)
      "tenant", "landlord", "ejectment", "lease",
      "company", "corporate", "directors", "shareholders", "secp", "winding",
      "insurance", "premium", "indemnity", "insurer",
      "consumer", "warranty", "defective",
      "copyright", "trademark", "patent", "piracy",
      "partnership", "dissolution", "goodwill",
      "arbitration", "mediation", "conciliation", "arbitral",
      "limitation", "prescribed", "condonation",
      "execution", "decree", "attachment", "auction",
      "probate", "administrator", "executor",
      "pre-emption", "shufa",
      "promissory", "debt", "creditor", "debtor",
      // Inheritance / Islamic succession tokens (new)
      "miras", "wirasat", "faraid", "sharers", "residuaries",
      "wasiyat", "bequest", "testamentary",
      "widow", "daughter", "disinheritance", "exclusion",
      "ancestral", "coparcenary", "intaqal",
      // Civil procedure tokens (new)
      "declaratory", "declaration", "partition",
      "dispossession", "possession", "cancellation",
      "negligence", "tortious", "compensation", "damages",
      "easement", "prescriptive",
      "adverse", "hostile", "squatter",
      "res-judicata", "estoppel", "lis-pendens",
      "compromise", "settlement", "consent",
      "counterclaim", "replevin",
      "mesne", "plaint", "replication",
      // Specialized law tokens (new)
      "cybercrime", "hacking", "peca", "phishing", "stalking",
      "accident", "rash", "traffic", "challan",
      "pollution", "epa", "environmental",
      "election", "disqualification", "ecp", "tribunal",
      "court-martial", "military", "army",
      "immigration", "visa", "passport", "deportation", "fia",
      "malpractice", "medical", "negligence", "surgery",
      "domestic", "violence", "cruelty", "abuse",
      "juvenile", "borstal", "minor",
      "waqf", "trust", "endowment", "auqaf", "mutawalli",
      // Administrative / regulatory tokens (new)
      "contempt", "disobedience",
      "laundering", "amla", "proceeds",
      "pemra", "broadcast", "journalist",
      "ombudsman", "mohtasib", "maladministration",
      "pil", "suo-motu", "smuggling", "contraband", "confiscation",
      "municipal", "patwari", "khasra", "girdawari", "revenue",
      "seniority", "posting", "transfer",
      "cooperative", "registrar",
      "prohibition", "liquor", "alcohol",
      "detention", "mpo", "externment",
      "search", "warrant", "seizure",
      // Drug-specific terms
      "hashish", "charas", "heroin", "opium", "cocaine", "marijuana", "methamphetamine",
      "ice", "drug", "trafficking", "smuggling", "possession",
      // Inheritance-specific terms
      "share", "heir", "heirs", "quranic", "residuary", "agnatic",
      "wirasat", "sharia", "islamic", "hanafi", "sunni", "shia",
      // Rent-specific terms
      "vacate", "occupant", "subletting", "premises",
      // Section numbers commonly searched
      "302", "497", "489", "420", "406", "376", "377", "295",
      // More section numbers commonly searched
      "154", "155", "156", "161", "164", "173", "174", "175",
      "196", "249", "265", "324", "337", "342", "365", "379",
      "380", "392", "395", "411", "419", "468", "471", "496",
      "498", "500", "506", "507", "509", "511",
      // CrPC procedural sections
      "22-a", "22-b", "249-a", "265-k", "345", "426", "439",
      "497", "498", "561-a",
      // Key procedural terms missing
      "cognizable", "non-cognizable", "registration", "complainant",
      "informant", "challan", "investigation", "remand",
      // New legal signal tokens from expanded topics (32 additional topics)
      "rejection", "plaint", "stay", "ex-parte", "pleadings", "impleadment",
      "superdari", "supardari", "private", "defense", "common", "intention",
      "absconder", "proclaimed", "offender", "abscondence", "grabbing", "qabza",
      "dispossession", "parade", "dying", "declaration", "approver", "accomplice",
      "pension", "gratuity", "retirement", "seniority", "supersession", "electricity",
      "utility", "nepra", "wapda", "k-electric", "kelectric", "gas", "sngpl",
      "ssgc", "ogra", "billing", "spurious", "substandard", "cantonment", "encroachment",
      "demolition", "ostensible", "benami", "benamidar", "quo", "warranto",
      "mandamus", "certiorari", "jactitation", "conjugal", "dowry", "jahez",
      "visitation", "nuisance", "perjury", "foreign", "exchange", "hundi",
      "havala", "nirc", "union",
      "agency", "principal", "agent", "sub-agent", "subagent", "ratification", "broker",
      "telecom", "telecommunication", "pta", "sim", "cellular", "broadband", "spectrum", "frequency",
      "competition", "ccp", "anti-trust", "monopoly", "cartel", "merger",
      "procurement", "ppra", "tender", "bidding", "blacklisting",
      "pfa", "adulteration", "unhygienic", "halal",
      "maritime", "admiralty", "ship", "vessel", "shipping", "demurrage", "cargo",
      "aviation", "caa", "airline", "aircraft", "flight", "pilot",
      "mining", "mineral", "mine", "quarry", "excavation", "royalty",
      "forest", "wildlife", "timber", "hunting", "poaching", "endangered",
      "income", "fbr", "evasion", "withholding",
      "sales", "vat", "gst", "srb", "kpra", "bra", "invoice", "refund",
      "extradition", "interpol", "asylum",
      "privacy",
      "encounter", "extrajudicial", "custodial", "brutality",
      "transgender", "khawaja", "sira", "gender",
      "mental", "lunatic", "insane", "unsound", "psychiatric",
      "sez", "boi", "fdi", "epz",
      "zakat", "ushr",
      "evacuee", "etpb",
      "cda", "lda", "kda", "dha", "zoning", "bylaws",
      "stray", "veterinary", "livestock",
      "12(2)", "xxxvii", "confessional",
      // ── DATA-BACKED tokens (extracted from 223,165 real judgments via ts_stat) ──
      // These terms appear in 10+ actual judgment headnotes in the database.
      // High-frequency procedural terms (100+ judgments)
      "service", "land", "property", "sale", "deed", "customs", "excise",
      "university", "education", "employment", "allotment", "witness",
      "termination", "reinstatement", "gift", "hospital", "child",
      "guardian", "society", "promotion", "mutation", "examination",
      // Medium-frequency legal terms (10-99 judgments)
      // NOTE: "civil" and "criminal" are deliberately EXCLUDED — they appear in 200k+ judgments
      // and cause the tsvector OR fallback to scan the entire table (105s+). Too generic.
      "hadd", "tazir", "nikah", "surety", "confession", "drugs",
      "testimony", "attempt",
      // High-frequency institutional/role terms from titles (1000+ judgments)
      "commissioner", "collector", "federation", "police",
      "income-tax", "customs", "tribunal",
      // Journal report codes (used in citation matching, 5000+ judgments each)
      "scmr", "pcrlj", "pld", "mld", "clc", "ylr", "ptd", "plj", "cld",
    ]);

    const allTokens = safeQuery
      .toLowerCase()
      .split(MULTIPLE_SPACES_REGEX)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));

    // Prioritize legal signal tokens so the SQL uses legally relevant terms
    // Auto-promote: any token that looks like a section number (digits, or digits-letter like 22-a, 489-f)
    // is ALWAYS a signal token — no need to hardcode every section number.
    // IMPORTANT: Exclude 4-digit years (1800-2099) — they match thousands of judgments
    // and create terrible queries like "1898 & 22-a & 22-b" or slow OR scans.
    const SECTION_NUMBER_RE = /^\d+[a-z]?(-[a-z0-9]+)?$/;
    const YEAR_RE = /^(18|19|20)\d{2}$/;
    const isSignalToken = (t: string): boolean => {
      if (YEAR_RE.test(t)) return false; // Never treat years as section numbers
      return LEGAL_SIGNAL_TOKENS.has(t) || SECTION_NUMBER_RE.test(t);
    };
    const signalTokens = allTokens.filter(isSignalToken);
    const otherTokens = allTokens.filter((t) => !isSignalToken(t));
    const queryTokens = [...new Set([...signalTokens, ...otherTokens])].slice(0, 6);

    if (queryTokens.length === 0) return [];

    // ── Tier 1: tsvector @@ tsquery (GIN indexed) ───────────────────────
    // Build tsquery strings:
    // Narrow: AND of top 3 signal tokens (precise search)
    // Broad: OR of all tokens (fallback for broader results)
    const topCoreTokens = signalTokens.length > 0
      ? [...new Set(signalTokens)].slice(0, 3)
      : queryTokens.slice(0, 3);
    const tsQueryNarrow = topCoreTokens.join(' & ');
    const tsQueryBroad = queryTokens.join(' | ');

    // Search title + headnotes ONLY — NOT full_text.
    // Full judgment text mentions hundreds of cited cases and legal terms in passing,
    // causing irrelevant results (e.g. a property fraud case citing a narcotics bail case
    // would match "bail in narcotics" even though the case has nothing to do with narcotics).
    const tsvExpr = sql`tsv_title_headnotes`;

    // Build a relevance scoring expression using ts_rank_cd for both narrow and broad queries
    // This ensures results are ranked by how well they match, not just by recency
    const allTsTerms = queryTokens.join(' | ');

    const fetchRows = async (tsqStr: string): Promise<any[]> => {
      const res = await db.execute(sql`
        WITH candidates AS (
          SELECT id,
            ts_rank_cd(${tsvExpr}, to_tsquery('simple', ${allTsTerms})) as relevance
          FROM judgments
          WHERE is_active = true
            AND ${tsvExpr} @@ to_tsquery('simple', ${tsqStr})
          ORDER BY relevance DESC, year DESC
          LIMIT ${safeLimit * 8}
        )
        SELECT
          j.id, j.year, j.page, j.citation_string as "citationString", j.title, j.petitioner, j.respondent, j.headnotes,
          LEFT(j.full_text, 1500) as "fullTextHead",
          c.name as "courtName", j.court_name_snapshot as "courtSnapshot", l.code as "journalCode",
          cand.relevance
        FROM candidates cand
        INNER JOIN judgments j ON cand.id = j.id
        LEFT JOIN courts_ref c ON j.court_id = c.id
        INNER JOIN law_journals l ON j.journal_id = l.id
        ORDER BY cand.relevance DESC, j.year DESC
        LIMIT ${safeLimit * 2}
      `);
      return res.rows as any[];
    };

    // Try narrow AND first (top 3 core tokens), then broad OR fallback
    let rows = await fetchRows(tsQueryNarrow);

    if (rows.length === 0 && queryTokens.length > 1) {
      rows = await fetchRows(tsQueryBroad);
    }

    // ── Tier 2 FALLBACK: pg_trgm ILIKE if tsvector returned 0 ───────────
    if (rows.length === 0) {
      // Use per-token ILIKE on title + headnotes only (not full_text — too slow even with trigram)
      const perTokenExprs = queryTokens.slice(0, 4).map((token) => {
        return or(
          buildSearchTokenMatch(judgments.title, token),
          buildSearchTokenMatch(judgments.headnotes, token),
        )!;
      });
      // Use AND logic for ILIKE fallback to get more relevant results
      const ilikeExpr = perTokenExprs.length === 1
        ? perTokenExprs[0]
        : and(...perTokenExprs)!;

      const res = await db.execute(sql`
        SELECT
          j.id, j.year, j.page, j.citation_string as "citationString", j.title, j.petitioner, j.respondent, j.headnotes,
          LEFT(j.full_text, 1500) as "fullTextHead",
          c.name as "courtName", j.court_name_snapshot as "courtSnapshot", l.code as "journalCode",
          0.0 as relevance
        FROM judgments j
        LEFT JOIN courts_ref c ON j.court_id = c.id
        INNER JOIN law_journals l ON j.journal_id = l.id
        WHERE j.is_active = true AND ${ilikeExpr}
        ORDER BY j.year DESC
        LIMIT ${safeLimit * 2}
      `);
      rows = res.rows as any[];
      // If AND ILIKE returns 0, try OR ILIKE as last resort
      if (rows.length === 0 && perTokenExprs.length > 1) {
        const ilikeOrExpr = or(...perTokenExprs)!;
        const resOr = await db.execute(sql`
          SELECT
            j.id, j.year, j.page, j.citation_string as "citationString", j.title, j.petitioner, j.respondent, j.headnotes,
            LEFT(j.full_text, 1500) as "fullTextHead",
            c.name as "courtName", j.court_name_snapshot as "courtSnapshot", l.code as "journalCode",
            0.0 as relevance
          FROM judgments j
          LEFT JOIN courts_ref c ON j.court_id = c.id
          INNER JOIN law_journals l ON j.journal_id = l.id
          WHERE j.is_active = true AND ${ilikeOrExpr}
          ORDER BY j.year DESC
          LIMIT ${safeLimit * 2}
        `);
        rows = resOr.rows as any[];
      }
    }

    // ── Convert judgment rows to CaseLaw-compatible objects ──────────────
    for (const row of rows) {
      const citation = String(row.citationString || "").trim();
      if (!citation || seen.has(citation.toLowerCase())) continue;
      seen.add(citation.toLowerCase());

      // Derive a stable numeric id from UUID for dedup compatibility
      const numericId = Math.abs(parseInt(String(row.id || "").replace(/-/g, "").slice(0, 8), 16)) || 0;

      // Many legacy judgment rows have placeholder titles like
      // "Case reported at 2005 PCRLJ 1008" and empty court_name_snapshot,
      // because the original ingest only populated the citation. The full
      // judgment text starts with a header block:
      //   Court Name: Lahore High Court
      //   Judge(s): ...
      //   Title: MUHAMMAD AZIM vs DISTRICT MAGISTRATE
      // Extract the real values from there as a runtime fallback so the AI
      // and the Case Law Card both see proper titles/courts immediately.
      // fullTextHead is already capped at 1500 chars by the SELECT — header parsing only.
      const fullTextStr = String(row.fullTextHead || "");
      
      const fullTextTitleMatch = fullTextStr.match(TITLE_HEADER_REGEX);
      const fullTextTitle = fullTextTitleMatch ? fullTextTitleMatch[1].replace(MULTIPLE_SPACES_REGEX, " ").trim() : "";

      const fullTextCourtNameMatch = fullTextStr.match(COURT_NAME_HEADER_REGEX);
      const fullTextCourtMatch = fullTextStr.match(COURT_HEADER_REGEX);
      const fullTextCourt = (fullTextCourtNameMatch ? fullTextCourtNameMatch[1].replace(MULTIPLE_SPACES_REGEX, " ").trim() : "") ||
                            (fullTextCourtMatch ? fullTextCourtMatch[1].replace(MULTIPLE_SPACES_REGEX, " ").trim() : "");

      const courtRaw = String(row.courtName || row.courtSnapshot || "").trim();
      const courtStr = courtRaw || fullTextCourt;

      const parties = [row.petitioner, row.respondent].filter(Boolean).join(" vs ");
      const dbTitleRaw = String(row.title || "").trim();
      // Class A placeholders: literal "Case reported at...", "Case cited as...".
      // Class B prose-snippet titles: an older ingest pulled middle-of-judgment
      //   prose into the title column ("settled that considerations for the
      //   cancellation of bail...", "the right of divorce was given to the
      //   woman..."). These don't match a placeholder pattern but are
      //   clearly not a case title — real case titles always contain
      //   `vs`, `v.`, `versus`, or are an ALL-CAPS petitioner name.
      const isPlaceholderTitle =
        !dbTitleRaw ||
        PLACEHOLDER_TITLE_REGEX.test(dbTitleRaw) ||
        dbTitleRaw === `Case ${citation}` ||
        !looksLikeRealCaseTitle(dbTitleRaw);
      // Prefer fullText Title (real header) over the parties join, which is
      // often empty on legacy rows.
      const titleStr =
        (!isPlaceholderTitle && dbTitleRaw) ||
        (looksLikeRealCaseTitle(fullTextTitle) ? fullTextTitle : "") ||
        parties ||
        fullTextTitle ||
        `Case ${citation}`;

      // Headnotes are often a placeholder ("Case cited as 2005 PCRLJ 1008")
      // or metadata-only. Use the first chunk of full_text past the
      // header block as a substantive summary fallback.
      const headnotesRaw = String(row.headnotes || "").trim();
      const isPlaceholderHeadnotes =
        !headnotesRaw || 
        PLACEHOLDER_HEADNOTES_REGEX.test(headnotesRaw) ||
        isMetadataOnlySummary(headnotesRaw);
      const fullTextBody = extractSubstantiveSummary(fullTextStr);
      const summaryStr = isPlaceholderHeadnotes && fullTextBody
        ? fullTextBody
        : headnotesRaw.slice(0, 600).trim();

      results.push({
        id: numericId,
        citation,
        citationYear: Number.isInteger(row.year) ? row.year : null,
        citationReport: row.journalCode || null,
        citationPage: Number.isInteger(row.page) && row.page > 0 ? row.page : null,
        citationRole: "primary" as const,
        court: courtStr,
        title: cleanCaseTitle(titleStr),
        summary: summaryStr,
        keywords: [] as string[],
        sourceDocId: null,
        sourceType: "judgment",
        sourceFilename: null,
        documentClassification: null,
        fallbackExtraction: false,
        statuteReferences: [] as string[],
      } as unknown as CaseLaw);

      if (results.length >= safeLimit) break;
    }
    return results;
  }

  // Direct citation string lookup on the 204k judgments table.
  // Uses ILIKE on citationString only — single indexed column, fast even on large tables.
  // Used by citation verification so tool-search citations (from this table) are found quickly.
  async findJudgmentByCitationString(citation: string, limit: number): Promise<CaseLaw[]> {
    const safe = String(citation || "").trim();
    if (!safe) return [];
    const safeLimit = Math.max(1, Math.min(20, limit));
    const pat = `%${safe}%`;
    const rows = await db
      .select({
        id:             judgments.id,
        year:           judgments.year,
        page:           judgments.page,
        citationString: judgments.citationString,
        title:          judgments.title,
        petitioner:     judgments.petitioner,
        respondent:     judgments.respondent,
        headnotes:      judgments.headnotes,
        courtName:      courtsRef.name,
        courtSnapshot:  judgments.courtNameSnapshot,
        journalCode:    lawJournals.code,
      })
      .from(judgments)
      .leftJoin(courtsRef, eq(judgments.courtId, courtsRef.id))
      .innerJoin(lawJournals, eq(judgments.journalId, lawJournals.id))
      .where(and(eq(judgments.isActive, true), ilike(judgments.citationString, pat)))
      .limit(safeLimit);

    type JudgmentRow = (typeof rows)[number];
    return rows.map((row: JudgmentRow) => {
      const citation = String(row.citationString || "").trim();
      const numericId = Math.abs(parseInt(String(row.id || "").replace(/-/g, "").slice(0, 8), 16)) || 0;
      const courtStr = String(row.courtName || row.courtSnapshot || "");
      const parties = [row.petitioner, row.respondent].filter(Boolean).join(" vs ");
      const titleStr = String(row.title || parties || `Case ${citation}`).trim();
      return {
        id: numericId,
        citation,
        citationYear: Number.isInteger(row.year) ? row.year : null,
        citationReport: row.journalCode || null,
        citationPage: Number.isInteger(row.page) && row.page > 0 ? row.page : null,
        citationRole: "primary" as const,
        court: courtStr,
        title: cleanCaseTitle(titleStr),
        summary: String(row.headnotes || "").slice(0, 600).trim(),
        keywords: [] as string[],
        sourceDocId: null,
        sourceType: "judgment",
        sourceFilename: null,
        documentClassification: null,
        fallbackExtraction: false,
        statuteReferences: [] as string[],
      } as unknown as CaseLaw;
    });
  }

  async getJudgmentDetail(id: string): Promise<JudgmentDetail | undefined> {
    const [row] = await db.select({
      id: judgments.id,
      year: judgments.year,
      page: judgments.page,
      journalCode: lawJournals.code,
      journalName: lawJournals.name,
      citation: judgments.citationString,
      title: judgments.title,
      petitioner: judgments.petitioner,
      respondent: judgments.respondent,
      courtName: courtsRef.name,
      courtSnapshot: judgments.courtNameSnapshot,
      decisionDate: judgments.decisionDate,
      headnotes: judgments.headnotes,
      fullText: judgments.fullText,
      pdfUrl: judgments.pdfUrl,
    })
      .from(judgments)
      .innerJoin(lawJournals, eq(judgments.journalId, lawJournals.id))
      .leftJoin(courtsRef, eq(judgments.courtId, courtsRef.id))
      .where(eq(judgments.id, id))
      .limit(1);

    if (!row) return undefined;

    const madeBase = await db.select({
      id: citationLinks.id,
      citationType: citationLinks.citationType,
      contextExcerpt: citationLinks.contextExcerpt,
      citationText: citationLinks.citationText,
      linkedJudgmentId: citationLinks.targetJudgmentId,
    })
      .from(citationLinks)
      .where(eq(citationLinks.sourceJudgmentId, id))
      .orderBy(desc(citationLinks.createdAt));

    const receivedBase = await db.select({
      id: citationLinks.id,
      citationType: citationLinks.citationType,
      contextExcerpt: citationLinks.contextExcerpt,
      citationText: citationLinks.citationText,
      linkedJudgmentId: citationLinks.sourceJudgmentId,
    })
      .from(citationLinks)
      .where(eq(citationLinks.targetJudgmentId, id))
      .orderBy(desc(citationLinks.createdAt));

    const linkedIds = Array.from(
      new Set(
        [...madeBase, ...receivedBase]
          .map((item) => item.linkedJudgmentId)
          .filter((item): item is string => typeof item === "string" && item.length > 0),
      ),
    );

    const linkedJudgments: Array<{ id: string; citation: string; title: string }> = linkedIds.length > 0
      ? await db.select({
        id: judgments.id,
        citation: judgments.citationString,
        title: judgments.title,
      })
        .from(judgments)
        .where(inArray(judgments.id, linkedIds))
      : [];
    const linkedMap = new Map<string, { id: string; citation: string; title: string }>(
      linkedJudgments.map((j: { id: string; citation: string; title: string }) => [j.id, j]),
    );

    const made = madeBase.map((item: typeof madeBase[number]) => {
      const linked = item.linkedJudgmentId ? linkedMap.get(item.linkedJudgmentId) : undefined;
      return {
        id: item.id,
        citationType: item.citationType,
        contextExcerpt: item.contextExcerpt,
        citationText: item.citationText,
        linkedJudgmentId: item.linkedJudgmentId,
        linkedCitation: linked?.citation || null,
        linkedTitle: linked?.title || null,
      };
    });

    const received = receivedBase.map((item: typeof receivedBase[number]) => {
      const linked = item.linkedJudgmentId ? linkedMap.get(item.linkedJudgmentId) : undefined;
      return {
        id: item.id,
        citationType: item.citationType,
        contextExcerpt: item.contextExcerpt,
        citationText: item.citationText,
        linkedJudgmentId: item.linkedJudgmentId,
        linkedCitation: linked?.citation || null,
        linkedTitle: linked?.title || null,
      };
    });

    return {
      id: row.id,
      year: row.year,
      page: row.page,
      journalCode: row.journalCode,
      journalName: row.journalName,
      citation: row.citation,
      title: cleanCaseTitle(row.title),
      petitioner: row.petitioner,
      respondent: row.respondent,
      court: row.courtName || row.courtSnapshot || "",
      decisionDate: row.decisionDate,
      headnotes: row.headnotes,
      fullText: row.fullText,
      pdfUrl: row.pdfUrl,
      citations: { made, received },
    };
  }

  async createJudgment(entry: InsertJudgment): Promise<Judgment> {
    const [created] = await db.insert(judgments).values(entry).returning();
    clearSitemapCache();
    triggerGoogleIndexing(created.id, "URL_UPDATED").catch((err) => {
      console.warn("[Google Indexing] Background notification failed:", err?.message || err);
    });
    // Auto-index into RAG vector store for semantic search (fire-and-forget)
    import("./rag/rag-service").then(({ indexJudgmentDocument }) => {
      indexJudgmentDocument(created.id).then((result) => {
        console.log(`[RAG] Auto-indexed judgment ${created.citationString} (${result.chunks} chunks)`);
      }).catch((err) => {
        console.warn(`[RAG] Auto-index failed for judgment ${created.id}:`, err?.message || err);
      });
    }).catch(() => { /* rag-service not available yet */ });
    return created;
  }

  async createCitationLinks(entries: InsertCitationLink[]): Promise<number> {
    if (entries.length === 0) return 0;
    const inserted = await db.insert(citationLinks).values(entries).returning({ id: citationLinks.id });
    return inserted.length;
  }

  async createUnresolvedCitations(entries: InsertUnresolvedCitation[]): Promise<number> {
    if (entries.length === 0) return 0;
    const inserted = await db.insert(unresolvedCitations).values(entries).returning({ id: unresolvedCitations.id });
    return inserted.length;
  }

  async getGithubKnowledgeCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(githubKnowledge);
    return Number(result[0].count);
  }

  async getAllGithubKnowledge(): Promise<GithubKnowledge[]> {
    return await db.select().from(githubKnowledge);
  }

  async getGithubKnowledgeById(id: number): Promise<GithubKnowledge | undefined> {
    const [doc] = await db.select().from(githubKnowledge).where(eq(githubKnowledge.id, id)).limit(1);
    return doc;
  }

  async upsertGithubKnowledge(items: InsertGithubKnowledge[]): Promise<void> {
    for (const item of items) {
      const existing = await db.select().from(githubKnowledge).where(eq(githubKnowledge.filename, item.filename));
      if (existing.length > 0) {
        await db.update(githubKnowledge)
          .set({ content: item.content, title: item.title, syncedAt: new Date() })
          .where(eq(githubKnowledge.filename, item.filename));
      } else {
        await db.insert(githubKnowledge).values(item);
      }
    }
  }

  async searchGithubKnowledge(query: string, limit: number = 5): Promise<GithubKnowledge[]> {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return [];

    const conditions = words.map(word => 
      or(
        ilike(githubKnowledge.title, `%${word}%`),
        ilike(githubKnowledge.content, `%${word}%`)
      )
    );

    return await db.select()
      .from(githubKnowledge)
      .where(or(...conditions))
      .limit(limit);
  }

  async getCachedResponse(endpoint: string, queryHash: string): Promise<QueryCache | undefined> {
    const [cached] = await db.select()
      .from(queryCache)
      .where(and(eq(queryCache.endpoint, endpoint), eq(queryCache.queryHash, queryHash)))
      .orderBy(desc(queryCache.createdAt))
      .limit(1);
    return cached;
  }

  async setCachedResponse(entry: InsertQueryCache): Promise<QueryCache> {
    await db.delete(queryCache)
      .where(and(eq(queryCache.endpoint, entry.endpoint), eq(queryCache.queryHash, entry.queryHash)));
    const [cached] = await db.insert(queryCache).values(entry).returning();
    return cached;
  }

  async incrementCacheHit(id: number): Promise<void> {
    await db.update(queryCache)
      .set({ hitCount: sql`${queryCache.hitCount} + 1` })
      .where(eq(queryCache.id, id));
  }

  async cleanExpiredCache(maxAgeDays: number = 7): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    const deleted = await db.delete(queryCache)
      .where(lt(queryCache.createdAt, cutoff))
      .returning();
    return deleted.length;
  }

  async logUsage(userId: string, feature: string): Promise<UsageTracking> {
    const [entry] = await db.insert(usageTracking)
      .values({ userId, feature } as any)
      .returning();
    return entry;
  }

  async logUsageCost(userId: string, feature: string, inputTokens: number, outputTokens: number, estimatedCost: number): Promise<void> {
    await db.insert(usageTracking).values({
      userId,
      feature: feature as any,
      inputTokens,
      outputTokens,
      estimatedCost: estimatedCost.toFixed(6),
    });
  }

  async getCostAnalytics(): Promise<{ byFeature: Array<{ feature: string; totalQueries: number; totalInputTokens: number; totalOutputTokens: number; totalCost: string }>; totalCost: string; totalTokens: number }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const byFeature = await db.select({
      feature: usageTracking.feature,
      totalQueries: count(),
      totalInputTokens: sql<number>`COALESCE(SUM(${usageTracking.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`COALESCE(SUM(${usageTracking.outputTokens}), 0)`,
      totalCost: sql<string>`COALESCE(SUM(CAST(${usageTracking.estimatedCost} AS DECIMAL)), 0)`,
    })
      .from(usageTracking)
      .where(gte(usageTracking.createdAt, startOfMonth))
      .groupBy(usageTracking.feature);

    const totalCost = byFeature.reduce((sum: number, f: any) => sum + parseFloat(String(f.totalCost) || "0"), 0);
    const totalTokens = byFeature.reduce((sum: number, f: any) => sum + (Number(f.totalInputTokens) || 0) + (Number(f.totalOutputTokens) || 0), 0);

    return {
      byFeature: byFeature.map((f: any) => ({
        feature: f.feature,
        totalQueries: f.totalQueries,
        totalInputTokens: Number(f.totalInputTokens) || 0,
        totalOutputTokens: Number(f.totalOutputTokens) || 0,
        totalCost: parseFloat(String(f.totalCost) || "0").toFixed(4),
      })),
      totalCost: totalCost.toFixed(4),
      totalTokens,
    };
  }

  async getMonthlyUsageCount(userId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [result] = await db.select({ total: count() })
      .from(usageTracking)
      .where(and(
        eq(usageTracking.userId, userId),
        gte(usageTracking.createdAt, startOfMonth)
      ));
    return result?.total || 0;
  }

  async getMonthlyUsageCountByFeature(userId: string, feature: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [result] = await db.select({ total: count() })
      .from(usageTracking)
      .where(and(
        eq(usageTracking.userId, userId),
        eq(usageTracking.feature, feature as any),
        gte(usageTracking.createdAt, startOfMonth)
      ));
    return result?.total || 0;
  }

  async getTotalUsageCountByFeature(userId: string, feature: string): Promise<number> {
    const [result] = await db.select({ total: count() })
      .from(usageTracking)
      .where(and(
        eq(usageTracking.userId, userId),
        eq(usageTracking.feature, feature as any),
      ));
    return result?.total || 0;
  }

  async getMonthlyDocumentUploadCount(userId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [result] = await db.select({ total: count() })
      .from(documents)
      .where(and(
        eq(documents.userId, userId),
        gte(documents.createdAt, startOfMonth)
      ));
    return Number(result?.total || 0);
  }

  async getMonthlyOcrPageCount(userId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [result] = await db.select({ total: sql<number>`COALESCE(SUM(${usageTracking.inputTokens}), 0)` })
      .from(usageTracking)
      .where(and(
        eq(usageTracking.userId, userId),
        eq(usageTracking.feature, "ocr-pages" as any),
        gte(usageTracking.createdAt, startOfMonth)
      ));
    return Number(result?.total || 0);
  }

  async logOcrPages(userId: string, pageCount: number): Promise<void> {
    await db.insert(usageTracking).values({
      userId,
      feature: "ocr-pages" as any,
      inputTokens: pageCount,
      outputTokens: 0,
      estimatedCost: "0",
    });
  }

  async resetMonthlyUsageCount(userId: string): Promise<{ before: number; deleted: number; after: number; windowStart: Date }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [beforeRow] = await db.select({ total: count() })
      .from(usageTracking)
      .where(and(
        eq(usageTracking.userId, userId),
        gte(usageTracking.createdAt, startOfMonth),
      ));
    const before = Number(beforeRow?.total || 0);

    await db.delete(usageTracking).where(and(
      eq(usageTracking.userId, userId),
      gte(usageTracking.createdAt, startOfMonth),
    ));

    const [afterRow] = await db.select({ total: count() })
      .from(usageTracking)
      .where(and(
        eq(usageTracking.userId, userId),
        gte(usageTracking.createdAt, startOfMonth),
      ));
    const after = Number(afterRow?.total || 0);

    return {
      before,
      deleted: Math.max(0, before - after),
      after,
      windowStart: startOfMonth,
    };
  }

  async getUserTier(userId: string): Promise<string> {
    const [user] = await db.select({
      tier: users.subscriptionTier,
      subscriptionEndAt: users.subscriptionEndAt,
    })
      .from(users)
      .where(eq(users.id, userId));
    const rawTier = (user?.tier || "free").toLowerCase();
    if (rawTier === "free") return "free";
    if (rawTier !== "standard" && rawTier !== "pro" && rawTier !== "chamber" && rawTier !== "enterprise") {
      return "free";
    }

    // Check if subscription has expired
    if (user?.subscriptionEndAt && new Date(user.subscriptionEndAt) < new Date()) {
      // Lazy downgrade: update DB in background so future lookups are fast
      db.update(users)
        .set({ subscriptionTier: "free", updatedAt: new Date() })
        .where(eq(users.id, userId))
        .then(() => {
          console.log(`[Subscription] Auto-downgraded user ${userId} from ${rawTier} to free (expired ${user.subscriptionEndAt?.toISOString()})`);
        })
        .catch((err: any) => {
          console.warn(`[Subscription] Failed to auto-downgrade user ${userId}:`, err?.message || err);
        });
      return "free";
    }

    return rawTier;
  }

  async downgradeExpiredSubscriptions(): Promise<number> {
    const now = new Date();
    const result = await db.update(users)
      .set({ subscriptionTier: "free", updatedAt: now })
      .where(and(
        ne(users.subscriptionTier, "free"),
        isNotNull(users.subscriptionEndAt),
        lte(users.subscriptionEndAt, now)
      ))
      .returning({ id: users.id, tier: users.subscriptionTier });
    return result.length;
  }

  // ── AI Output Quality Monitoring ──────────────────────────────────────
  async logOutputQuality(entry: {
    userId: string;
    feature: string;
    model: string;
    inputSnippet: string;
    outputSnippet: string;
    outputLength: number;
    qualityScore: number;
    qualityFlags: string[];
    userQuery?: string;
    responseTimeMs?: number;
  }): Promise<void> {
    try {
      const pgFlags = `{${entry.qualityFlags.map(f => `"${f.replace(/"/g, '\\"')}"`).join(',')}}`;
      await db.execute(sql`
        INSERT INTO ai_output_log (user_id, feature, model, input_snippet, output_snippet, output_length, quality_score, quality_flags, user_query, response_time_ms)
        VALUES (${entry.userId}, ${entry.feature}, ${entry.model}, ${entry.inputSnippet}, ${entry.outputSnippet}, ${entry.outputLength}, ${entry.qualityScore}, ${pgFlags}::text[], ${entry.userQuery || ''}, ${entry.responseTimeMs || 0})
      `);
    } catch (err) {
      console.error("[QualityLog] Error logging output quality:", err);
    }
  }

  async getOutputQualityLogs(limit: number, offset: number, filters?: {
    feature?: string;
    minScore?: number;
    maxScore?: number;
    userId?: string;
  }): Promise<{ items: any[]; total: number }> {
    try {
      const safeLimit = Math.max(1, Math.min(100, limit));
      const safeOffset = Math.max(0, offset);

      const conditions: any[] = [];
      if (filters?.feature) conditions.push(eq(aiOutputLog.feature, filters.feature));
      if (filters?.userId) conditions.push(eq(aiOutputLog.userId, filters.userId));
      if (filters?.minScore !== undefined) conditions.push(gte(aiOutputLog.qualityScore, filters.minScore));
      if (filters?.maxScore !== undefined) conditions.push(lte(aiOutputLog.qualityScore, filters.maxScore));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [totalRow] = await db.select({ total: count() }).from(aiOutputLog).where(whereClause);
      const total = Number(totalRow?.total || 0);

      const rows = await db.select({
        id: aiOutputLog.id,
        userId: aiOutputLog.userId,
        feature: aiOutputLog.feature,
        model: aiOutputLog.model,
        inputSnippet: aiOutputLog.inputSnippet,
        outputSnippet: aiOutputLog.outputSnippet,
        outputLength: aiOutputLog.outputLength,
        qualityScore: aiOutputLog.qualityScore,
        qualityFlags: aiOutputLog.qualityFlags,
        createdAt: aiOutputLog.createdAt,
        userQuery: sql<string>`ai_output_log.user_query`,
        responseTimeMs: sql<number>`ai_output_log.response_time_ms`,
        userEmail: users.email,
        userFirstName: users.firstName,
      })
        .from(aiOutputLog)
        .leftJoin(users, eq(aiOutputLog.userId, users.id))
        .where(whereClause)
        .orderBy(desc(aiOutputLog.createdAt))
        .limit(safeLimit)
        .offset(safeOffset);

      return { items: rows, total };
    } catch (err) {
      console.error("[QualityLogs] Table may not exist yet:", err);
      return { items: [], total: 0 };
    }
  }

  async getOutputQualityStats(): Promise<{
    totalLogs: number;
    avgScore: number;
    scoreDistribution: Record<number, number>;
    byFeature: Array<{ feature: string; count: number; avgScore: number }>;
    flagCounts: Record<string, number>;
  }> {
    const empty = { totalLogs: 0, avgScore: 0, scoreDistribution: {}, byFeature: [], flagCounts: {} };
    try {
      const [totalRow] = await db.select({ total: count(), avg: sql<number>`AVG(${aiOutputLog.qualityScore})` }).from(aiOutputLog);
      const totalLogs = Number(totalRow?.total || 0);
      const avgScore = Number(totalRow?.avg || 0);

      // Score distribution
      const distRows = await db.select({
        score: aiOutputLog.qualityScore,
        cnt: count(),
      }).from(aiOutputLog).groupBy(aiOutputLog.qualityScore);
      const scoreDistribution: Record<number, number> = {};
      for (const r of distRows) {
        scoreDistribution[r.score] = Number(r.cnt);
      }

      // By feature
      const featureRows = await db.select({
        feature: aiOutputLog.feature,
        cnt: count(),
        avg: sql<number>`AVG(${aiOutputLog.qualityScore})`,
      }).from(aiOutputLog).groupBy(aiOutputLog.feature);
      const byFeature = featureRows.map((f: any) => ({
        feature: f.feature,
        count: Number(f.cnt),
        avgScore: Number(Number(f.avg).toFixed(2)),
      }));

      // Flag counts — aggregate from recent 500 entries
      const recentFlags = await db.select({ qualityFlags: aiOutputLog.qualityFlags })
        .from(aiOutputLog)
        .orderBy(desc(aiOutputLog.createdAt))
        .limit(500);
      const flagCounts: Record<string, number> = {};
      for (const row of recentFlags) {
        for (const flag of (row.qualityFlags || [])) {
          flagCounts[flag] = (flagCounts[flag] || 0) + 1;
        }
      }

      return { totalLogs, avgScore: Number(avgScore.toFixed(2)), scoreDistribution, byFeature, flagCounts };
    } catch (err) {
      console.error("[QualityStats] Table may not exist yet:", err);
      return empty;
    }
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async deleteUser(userId: string): Promise<void> {
    // Remove auth token rows first to avoid FK failures on users(id).
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));

    // Remove user org membership/invites and orgs owned by this user.
    await db.delete(orgMembers).where(eq(orgMembers.userId, userId));
    await db.delete(orgInvites).where(eq(orgInvites.invitedBy, userId));

    const ownedOrgs = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.ownerId, userId));
    const ownedOrgIds = ownedOrgs.map((o: { id: number }) => o.id);
    if (ownedOrgIds.length > 0) {
      await db.delete(orgMembers).where(inArray(orgMembers.orgId, ownedOrgIds));
      await db.delete(orgInvites).where(inArray(orgInvites.orgId, ownedOrgIds));
      await db.delete(orgKnowledge).where(inArray(orgKnowledge.orgId, ownedOrgIds));
      await db.delete(organizations).where(eq(organizations.ownerId, userId));
    }

    const userThreads = await db.select({ id: threads.id }).from(threads).where(eq(threads.userId, userId));
    const threadIds = userThreads.map((t: { id: number }) => t.id);
    if (threadIds.length > 0) {
      for (const tid of threadIds) {
        await db.delete(messages).where(eq(messages.threadId, tid));
      }
      await db.delete(threads).where(eq(threads.userId, userId));
    }

    await db.delete(documents).where(eq(documents.userId, userId));
    await db.delete(bookmarks).where(eq(bookmarks.userId, userId));
    await db.delete(searchHistory).where(eq(searchHistory.userId, userId));
    await db.delete(savedJudgments).where(eq(savedJudgments.userId, userId));
    await db.delete(usageTracking).where(eq(usageTracking.userId, userId));

    // Keep shared/admin content but detach uploader references.
    await db.update(orgKnowledge).set({ uploadedBy: null }).where(eq(orgKnowledge.uploadedBy, userId));
    await db.update(adminKnowledge).set({ uploadedBy: null }).where(eq(adminKnowledge.uploadedBy, userId));
    await db.update(statuteDocuments).set({ uploadedBy: null }).where(eq(statuteDocuments.uploadedBy, userId));

    await db.delete(users).where(eq(users.id, userId));
  }

  async updateUserTier(userId: string, tier: string): Promise<User | undefined> {
    const normalizedTier = String(tier || "free").toLowerCase();
    const [updated] = await db.update(users)
      .set({ subscriptionTier: normalizedTier, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserSubscription(
    userId: string,
    data: {
      subscriptionTier?: string;
      subscriptionCycle?: BillingCycle;
      subscriptionStartAt?: Date | null;
      subscriptionEndAt?: Date | null;
      autoRenew?: boolean;
    },
  ): Promise<User | undefined> {
    const patch: {
      subscriptionTier?: string;
      subscriptionCycle?: BillingCycle;
      subscriptionStartAt?: Date | null;
      subscriptionEndAt?: Date | null;
      autoRenew?: boolean;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (data.subscriptionTier !== undefined) {
      patch.subscriptionTier = String(data.subscriptionTier || "free").toLowerCase();
    }
    if (data.subscriptionCycle !== undefined) {
      patch.subscriptionCycle = normalizeBillingCycle(data.subscriptionCycle);
    }
    if (data.subscriptionStartAt !== undefined) {
      patch.subscriptionStartAt = data.subscriptionStartAt;
    }
    if (data.subscriptionEndAt !== undefined) {
      patch.subscriptionEndAt = data.subscriptionEndAt;
    }
    if (data.autoRenew !== undefined) {
      patch.autoRenew = data.autoRenew;
    }

    const [updated] = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ isAdmin, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async isUserAdmin(userId: string): Promise<boolean> {
    const [user] = await db.select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, userId));
    return user?.isAdmin || false;
  }

  async hasAnyAdmin(): Promise<boolean> {
    const [result] = await db.select({ total: count() })
      .from(users)
      .where(eq(users.isAdmin, true));
    return (result?.total || 0) > 0;
  }

  async getSystemStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const safeCount = async (table: unknown, label: string): Promise<number> => {
      try {
        const [row] = await db.select({ total: count() }).from(table as any);
        return Number(row?.total || 0);
      } catch (err: any) {
        if (String(err?.code || "") === "42P01") {
          console.warn(`[Stats] Missing relation for ${label}; defaulting count to 0.`);
          return 0;
        }
        throw err;
      }
    };

    const safeGithubCount = async (): Promise<number> => {
      try {
        return await this.getGithubKnowledgeCount();
      } catch (err: any) {
        if (String(err?.code || "") === "42P01") {
          console.warn("[Stats] Missing relation for github_knowledge; defaulting count to 0.");
          return 0;
        }
        throw err;
      }
    };

    const totalUsers = await safeCount(users, "users");
    const totalThreads = await safeCount(threads, "threads");
    const totalMessages = await safeCount(messages, "messages");
    const totalDocuments = await safeCount(documents, "documents");
    const totalGithubKnowledge = await safeGithubCount();
    const totalAdminKnowledge = await safeCount(adminKnowledge, "admin_knowledge");
    const totalCaseLaw = await safeCount(caseLaw, "case_law");
    const totalStatuteDocuments = await safeCount(statuteDocuments, "statute_documents");
    const totalCitationJudgments = await safeCount(judgments, "judgments");
    const totalCacheEntries = await safeCount(queryCache, "query_cache");
    const [usageCount] = await db.select({ total: count() })
      .from(usageTracking)
      .where(gte(usageTracking.createdAt, startOfMonth));

    const totalKnowledge =
      totalGithubKnowledge +
      totalAdminKnowledge +
      totalCaseLaw +
      totalStatuteDocuments +
      totalCitationJudgments;

    return {
      totalUsers,
      totalThreads,
      totalMessages,
      totalDocuments,
      totalKnowledge,
      totalCacheEntries,
      totalUsageThisMonth: usageCount?.total || 0,
      knowledgeBreakdown: {
        github: totalGithubKnowledge,
        adminKnowledge: totalAdminKnowledge,
        caseLaw: totalCaseLaw,
        statuteDocuments: totalStatuteDocuments,
        citationJudgments: totalCitationJudgments,
      },
    };
  }

  async getUserActivitySummary(userId: string) {
    // Thread + message counts
    const userThreadRows = await db.select({ id: threads.id }).from(threads).where(eq(threads.userId, userId));
    const threadCount = userThreadRows.length;
    const threadIds = userThreadRows.map((t: { id: number }) => t.id);

    let messageCount = 0;
    if (threadIds.length > 0) {
      const [msgRow] = await db.select({ total: count() }).from(messages).where(inArray(messages.threadId, threadIds));
      messageCount = Number(msgRow?.total || 0);
    }

    // Last active (latest thread updatedAt)
    const [latestThread] = await db.select({ updatedAt: threads.updatedAt })
      .from(threads)
      .where(eq(threads.userId, userId))
      .orderBy(desc(threads.updatedAt))
      .limit(1);
    const lastActive = latestThread?.updatedAt?.toISOString() || null;

    // Usage by feature (all time)
    const usageByFeature = await db.select({
      feature: usageTracking.feature,
      totalQueries: count(),
      totalInputTokens: sql<number>`COALESCE(SUM(${usageTracking.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`COALESCE(SUM(${usageTracking.outputTokens}), 0)`,
      totalCost: sql<string>`COALESCE(SUM(CAST(${usageTracking.estimatedCost} AS DECIMAL)), 0)`,
    })
      .from(usageTracking)
      .where(eq(usageTracking.userId, userId))
      .groupBy(usageTracking.feature);

    const totalCost = usageByFeature.reduce((sum: number, f: any) => sum + parseFloat(String(f.totalCost) || "0"), 0);
    const totalTokens = usageByFeature.reduce((sum: number, f: any) => sum + (Number(f.totalInputTokens) || 0) + (Number(f.totalOutputTokens) || 0), 0);
    const totalQueries = usageByFeature.reduce((sum: number, f: any) => sum + (Number(f.totalQueries) || 0), 0);

    // Recent searches
    const recentSearches = await db.select({
      id: searchHistory.id,
      type: searchHistory.type,
      query: searchHistory.query,
      createdAt: searchHistory.createdAt,
    })
      .from(searchHistory)
      .where(eq(searchHistory.userId, userId))
      .orderBy(desc(searchHistory.createdAt))
      .limit(30);

    // Recent user messages across all threads (for unified roster)
    let recentMessages: Array<{ id: number; threadId: number; threadTitle: string; content: string; createdAt: Date | null }> = [];
    if (threadIds.length > 0) {
      const rawMsgs = await db.select({
        id: messages.id,
        threadId: messages.threadId,
        content: messages.content,
        createdAt: messages.createdAt,
      })
        .from(messages)
        .where(and(inArray(messages.threadId, threadIds), eq(messages.role, "user")))
        .orderBy(desc(messages.createdAt))
        .limit(40);

      // Map threadId to title
      const threadTitleMap: Record<number, string> = {};
      for (const t of userThreadRows as Array<{ id: number }>) {
        threadTitleMap[t.id] = "";
      }
      if (rawMsgs.length > 0) {
        const neededIds = [...new Set(rawMsgs.map((m: { threadId: number }) => m.threadId))] as number[];
        const titleRows = await db.select({ id: threads.id, title: threads.title })
          .from(threads)
          .where(inArray(threads.id, neededIds));
        for (const t of titleRows) {
          threadTitleMap[t.id] = t.title;
        }
      }

      recentMessages = rawMsgs.map((m: any) => ({
        id: m.id,
        threadId: m.threadId,
        threadTitle: threadTitleMap[m.threadId] || "Untitled",
        content: m.content,
        createdAt: m.createdAt,
      }));
    }

    return {
      threadCount,
      messageCount,
      lastActive,
      usageByFeature: usageByFeature.map((f: any) => ({
        feature: f.feature,
        totalQueries: Number(f.totalQueries) || 0,
        totalInputTokens: Number(f.totalInputTokens) || 0,
        totalOutputTokens: Number(f.totalOutputTokens) || 0,
        totalCost: parseFloat(String(f.totalCost) || "0").toFixed(4),
      })),
      totalCost: totalCost.toFixed(4),
      totalTokens,
      totalQueries,
      recentSearches,
      recentMessages,
    };
  }

  async getUserThreadsWithMessageCount(userId: string, limit: number, offset: number) {
    const safeLimit = Math.max(1, Math.min(100, limit));
    const safeOffset = Math.max(0, offset);

    const [totalRow] = await db.select({ total: count() }).from(threads).where(eq(threads.userId, userId));
    const total = Number(totalRow?.total || 0);

    const threadRows = await db.select({
      id: threads.id,
      title: threads.title,
      createdAt: threads.createdAt,
      updatedAt: threads.updatedAt,
    })
      .from(threads)
      .where(eq(threads.userId, userId))
      .orderBy(desc(threads.updatedAt))
      .limit(safeLimit)
      .offset(safeOffset);

    const items = [];
    for (const t of threadRows) {
      const [msgRow] = await db.select({ total: count() }).from(messages).where(eq(messages.threadId, t.id));
      items.push({
        id: t.id,
        title: t.title,
        messageCount: Number(msgRow?.total || 0),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      });
    }

    return { items, total };
  }

  async getUserProfile(userId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user;
  }

  async updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; profileImageUrl?: string | null }): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async addAdminKnowledge(entry: InsertAdminKnowledge): Promise<AdminKnowledge> {
    const [doc] = await db.insert(adminKnowledge).values(entry).returning();
    return doc;
  }

  async getAdminKnowledgeById(id: number): Promise<AdminKnowledge | undefined> {
    const [doc] = await db.select().from(adminKnowledge).where(eq(adminKnowledge.id, id)).limit(1);
    return doc;
  }

  async getAllAdminKnowledge(): Promise<AdminKnowledge[]> {
    return await db.select().from(adminKnowledge).orderBy(desc(adminKnowledge.createdAt));
  }

  async getAdminKnowledgePage(limit: number, offset: number): Promise<PagedResult<AdminKnowledgeListItem>> {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const [totalRow] = await db.select({ total: count() }).from(adminKnowledge);
    const total = Number(totalRow?.total || 0);
    const items = await db.select({
      id: adminKnowledge.id,
      title: adminKnowledge.title,
      filename: adminKnowledge.filename,
      category: adminKnowledge.category,
      uploadedBy: adminKnowledge.uploadedBy,
      createdAt: adminKnowledge.createdAt,
    })
      .from(adminKnowledge)
      .orderBy(desc(adminKnowledge.createdAt))
      .limit(safeLimit)
      .offset(safeOffset);
    return {
      items,
      total,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + items.length < total,
    };
  }

  async deleteAdminKnowledge(id: number): Promise<void> {
    await db.delete(adminKnowledge).where(eq(adminKnowledge.id, id));
  }

  async deleteAllAdminKnowledge(): Promise<number> {
    const all = await db.select({ id: adminKnowledge.id }).from(adminKnowledge);
    if (all.length === 0) return 0;
    await db.delete(adminKnowledge);
    return all.length;
  }

  async searchAdminKnowledge(query: string, limit: number = 5): Promise<AdminKnowledge[]> {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return [];

    const conditions = words.map(word =>
      or(
        ilike(adminKnowledge.title, `%${word}%`),
        ilike(adminKnowledge.content, `%${word}%`)
      )
    );

    return await db.select()
      .from(adminKnowledge)
      .where(or(...conditions))
      .limit(limit);
  }

  async getSavedJudgments(userId: string): Promise<SavedJudgment[]> {
    return await db.select()
      .from(savedJudgments)
      .where(eq(savedJudgments.userId, userId))
      .orderBy(desc(savedJudgments.createdAt));
  }

  async saveJudgment(entry: InsertSavedJudgment): Promise<SavedJudgment> {
    const [saved] = await db.insert(savedJudgments).values(entry).returning();
    return saved;
  }

  async deleteSavedJudgment(id: number, userId: string): Promise<void> {
    await db.delete(savedJudgments).where(and(eq(savedJudgments.id, id), eq(savedJudgments.userId, userId)));
  }

  async addStatuteDocument(entry: InsertStatuteDocument): Promise<StatuteDocument> {
    const [doc] = await db.insert(statuteDocuments).values(entry).returning();
    return doc;
  }

  async getAllStatuteDocuments(): Promise<StatuteDocument[]> {
    return await db.select().from(statuteDocuments).orderBy(desc(statuteDocuments.createdAt));
  }

  async getStatuteDocumentsPage(limit: number, offset: number): Promise<PagedResult<StatuteDocumentListItem>> {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const [totalRow] = await db.select({ total: count() }).from(statuteDocuments);
    const total = Number(totalRow?.total || 0);
    const items = await db.select({
      id: statuteDocuments.id,
      title: statuteDocuments.title,
      filename: statuteDocuments.filename,
      category: statuteDocuments.category,
      uploadedBy: statuteDocuments.uploadedBy,
      createdAt: statuteDocuments.createdAt,
    })
      .from(statuteDocuments)
      .orderBy(desc(statuteDocuments.createdAt))
      .limit(safeLimit)
      .offset(safeOffset);
    return {
      items,
      total,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + items.length < total,
    };
  }

  async getStatuteDocument(id: number): Promise<StatuteDocument | undefined> {
    const [doc] = await db.select().from(statuteDocuments).where(eq(statuteDocuments.id, id));
    return doc;
  }

  async deleteStatuteDocument(id: number): Promise<void> {
    await db.delete(statuteDocuments).where(eq(statuteDocuments.id, id));
  }

  async deleteAllStatuteDocuments(): Promise<number> {
    const all = await db.select({ id: statuteDocuments.id }).from(statuteDocuments);
    if (all.length === 0) return 0;
    await db.delete(statuteDocuments);
    return all.length;
  }

  async searchStatuteDocuments(query: string, limit: number = 20): Promise<StatuteDocument[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const pattern = `%${trimmed}%`;

    return await db.select({
      id: statuteDocuments.id,
      title: statuteDocuments.title,
      filename: statuteDocuments.filename,
      content: statuteDocuments.content,
      category: statuteDocuments.category,
      uploadedBy: statuteDocuments.uploadedBy,
      createdAt: statuteDocuments.createdAt,
    })
      .from(statuteDocuments)
      .where(
        or(
          ilike(statuteDocuments.title, pattern),
          ilike(statuteDocuments.content, pattern),
          ilike(statuteDocuments.filename, pattern),
          ilike(statuteDocuments.category, pattern)
        )
      )
      .orderBy(
        sql`CASE 
          WHEN ${statuteDocuments.title} ILIKE ${trimmed} THEN 1
          WHEN ${statuteDocuments.title} ILIKE ${pattern} THEN 2
          WHEN ${statuteDocuments.filename} ILIKE ${pattern} THEN 3
          ELSE 4
        END ASC`,
        statuteDocuments.title
      )
      .limit(limit);
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [created] = await db.insert(organizations).values(org).returning();
    await db.insert(orgMembers).values({ orgId: created.id, userId: org.ownerId, role: "owner" });
    return created;
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async getUserOrganization(userId: string): Promise<Organization | undefined> {
    const membership = await db.select({ orgId: orgMembers.orgId })
      .from(orgMembers)
      .where(eq(orgMembers.userId, userId))
      .limit(1);
    if (membership.length === 0) return undefined;
    return this.getOrganization(membership[0].orgId);
  }

  async addOrgMember(member: InsertOrgMember): Promise<OrgMember> {
    const [created] = await db.insert(orgMembers).values(member).returning();
    return created;
  }

  async getOrgMembers(orgId: number): Promise<(OrgMember & { email: string | null; firstName: string | null; lastName: string | null })[]> {
    const rows = await db.select({
      id: orgMembers.id,
      orgId: orgMembers.orgId,
      userId: orgMembers.userId,
      role: orgMembers.role,
      joinedAt: orgMembers.joinedAt,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
      .from(orgMembers)
      .innerJoin(users, eq(orgMembers.userId, users.id))
      .where(eq(orgMembers.orgId, orgId));
    return rows;
  }

  async removeOrgMember(orgId: number, userId: string): Promise<void> {
    await db.delete(orgMembers).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
  }

  async isOrgMember(orgId: number, userId: string): Promise<boolean> {
    const [row] = await db.select({ id: orgMembers.id })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
    return !!row;
  }

  async createOrgInvite(invite: InsertOrgInvite): Promise<OrgInvite> {
    const [created] = await db.insert(orgInvites).values(invite).returning();
    return created;
  }

  async getOrgInvites(orgId: number): Promise<OrgInvite[]> {
    return await db.select().from(orgInvites)
      .where(eq(orgInvites.orgId, orgId))
      .orderBy(desc(orgInvites.createdAt));
  }

  async getPendingInvitesForUser(email: string): Promise<(OrgInvite & { orgName: string })[]> {
    const rows = await db.select({
      id: orgInvites.id,
      orgId: orgInvites.orgId,
      email: orgInvites.email,
      invitedBy: orgInvites.invitedBy,
      status: orgInvites.status,
      createdAt: orgInvites.createdAt,
      orgName: organizations.name,
    })
      .from(orgInvites)
      .innerJoin(organizations, eq(orgInvites.orgId, organizations.id))
      .where(and(eq(orgInvites.email, email.toLowerCase()), eq(orgInvites.status, "pending")));
    return rows;
  }

  async acceptOrgInvite(inviteId: number, userId: string): Promise<void> {
    const [invite] = await db.select().from(orgInvites).where(eq(orgInvites.id, inviteId));
    if (!invite) return;
    await db.update(orgInvites).set({ status: "accepted" }).where(eq(orgInvites.id, inviteId));
    const existing = await this.isOrgMember(invite.orgId, userId);
    if (!existing) {
      await db.insert(orgMembers).values({ orgId: invite.orgId, userId, role: "member" });
    }
  }

  async declineOrgInvite(inviteId: number): Promise<void> {
    await db.update(orgInvites).set({ status: "declined" }).where(eq(orgInvites.id, inviteId));
  }

  async deleteOrganization(id: number): Promise<void> {
    await db.delete(orgKnowledge).where(eq(orgKnowledge.orgId, id));
    await db.delete(orgInvites).where(eq(orgInvites.orgId, id));
    await db.delete(orgMembers).where(eq(orgMembers.orgId, id));
    await db.delete(organizations).where(eq(organizations.id, id));
  }

  async addOrgKnowledge(entry: InsertOrgKnowledge): Promise<OrgKnowledge> {
    const [doc] = await db.insert(orgKnowledge).values(entry).returning();
    return doc;
  }

  async getOrgKnowledge(orgId: number): Promise<OrgKnowledge[]> {
    return await db.select().from(orgKnowledge)
      .where(eq(orgKnowledge.orgId, orgId))
      .orderBy(desc(orgKnowledge.createdAt));
  }

  async deleteOrgKnowledge(id: number): Promise<void> {
    await db.delete(orgKnowledge).where(eq(orgKnowledge.id, id));
  }

  async searchOrgKnowledge(orgId: number, query: string, limit: number = 5): Promise<OrgKnowledge[]> {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return [];

    const conditions = words.map(word =>
      or(
        ilike(orgKnowledge.title, `%${word}%`),
        ilike(orgKnowledge.content, `%${word}%`)
      )
    );

    return await db.select()
      .from(orgKnowledge)
      .where(and(eq(orgKnowledge.orgId, orgId), or(...conditions)))
      .limit(limit);
  }

  // ── Case File Management ───────────────────────────────────────────────

  async getCaseFiles(userId: string): Promise<CaseFile[]> {
    return await db.select()
      .from(caseFiles)
      .where(eq(caseFiles.userId, userId))
      .orderBy(desc(caseFiles.updatedAt));
  }

  async getCaseFile(id: number, userId: string): Promise<CaseFile | undefined> {
    const [cf] = await db.select()
      .from(caseFiles)
      .where(and(eq(caseFiles.id, id), eq(caseFiles.userId, userId)));
    return cf;
  }

  async createCaseFile(entry: InsertCaseFile): Promise<CaseFile> {
    const [created] = await db.insert(caseFiles).values(entry).returning();
    return created;
  }

  async updateCaseFile(id: number, userId: string, updates: Partial<InsertCaseFile>): Promise<CaseFile | undefined> {
    const [updated] = await db.update(caseFiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(caseFiles.id, id), eq(caseFiles.userId, userId)))
      .returning();
    return updated;
  }

  async deleteCaseFile(id: number, userId: string): Promise<void> {
    await db.delete(caseFiles)
      .where(and(eq(caseFiles.id, id), eq(caseFiles.userId, userId)));
  }

  // Case Clients
  async getCaseClients(caseId: number): Promise<CaseClient[]> {
    return await db.select()
      .from(caseClients)
      .where(eq(caseClients.caseId, caseId))
      .orderBy(caseClients.createdAt);
  }

  async addCaseClient(entry: InsertCaseClient): Promise<CaseClient> {
    const [created] = await db.insert(caseClients).values(entry).returning();
    return created;
  }

  async updateCaseClient(id: number, caseId: number, updates: Partial<InsertCaseClient>): Promise<CaseClient | undefined> {
    const [updated] = await db.update(caseClients)
      .set(updates)
      .where(and(eq(caseClients.id, id), eq(caseClients.caseId, caseId)))
      .returning();
    return updated;
  }

  async deleteCaseClient(id: number, caseId: number): Promise<void> {
    await db.delete(caseClients)
      .where(and(eq(caseClients.id, id), eq(caseClients.caseId, caseId)));
  }

  // Case Compliance
  async getCaseComplianceItems(caseId: number): Promise<CaseCompliance[]> {
    return await db.select()
      .from(caseCompliance)
      .where(eq(caseCompliance.caseId, caseId))
      .orderBy(caseCompliance.dueDate);
  }

  async getUpcomingCompliance(userId: string, limit: number = 10): Promise<(CaseCompliance & { caseTitle: string })[]> {
    const rows = await db.select({
      id: caseCompliance.id,
      caseId: caseCompliance.caseId,
      type: caseCompliance.type,
      title: caseCompliance.title,
      dueDate: caseCompliance.dueDate,
      court: caseCompliance.court,
      judge: caseCompliance.judge,
      status: caseCompliance.status,
      notes: caseCompliance.notes,
      createdAt: caseCompliance.createdAt,
      caseTitle: caseFiles.title,
    })
      .from(caseCompliance)
      .innerJoin(caseFiles, eq(caseCompliance.caseId, caseFiles.id))
      .where(and(
        eq(caseFiles.userId, userId),
        eq(caseCompliance.status, "pending"),
        gte(caseCompliance.dueDate, new Date()),
      ))
      .orderBy(caseCompliance.dueDate)
      .limit(limit);
    return rows;
  }

  async addCaseCompliance(entry: InsertCaseCompliance): Promise<CaseCompliance> {
    const [created] = await db.insert(caseCompliance).values(entry).returning();
    return created;
  }

  async updateCaseCompliance(id: number, caseId: number, updates: Partial<InsertCaseCompliance>): Promise<CaseCompliance | undefined> {
    const [updated] = await db.update(caseCompliance)
      .set(updates)
      .where(and(eq(caseCompliance.id, id), eq(caseCompliance.caseId, caseId)))
      .returning();
    return updated;
  }

  async deleteCaseCompliance(id: number, caseId: number): Promise<void> {
    await db.delete(caseCompliance)
      .where(and(eq(caseCompliance.id, id), eq(caseCompliance.caseId, caseId)));
  }

  // Case Documents (junction)
  async getCaseDocuments(caseId: number): Promise<(CaseDocument & { docTitle: string; docSourceType: string | null })[]> {
    const rows = await db.select({
      id: caseDocuments.id,
      caseId: caseDocuments.caseId,
      documentId: caseDocuments.documentId,
      label: caseDocuments.label,
      addedAt: caseDocuments.addedAt,
      docTitle: documents.title,
      docSourceType: documents.sourceType,
    })
      .from(caseDocuments)
      .innerJoin(documents, eq(caseDocuments.documentId, documents.id))
      .where(eq(caseDocuments.caseId, caseId))
      .orderBy(desc(caseDocuments.addedAt));
    return rows;
  }

  async getCaseDocumentIds(caseId: number): Promise<number[]> {
    const rows = await db.select({ documentId: caseDocuments.documentId })
      .from(caseDocuments)
      .where(eq(caseDocuments.caseId, caseId));
    return rows.map((r: { documentId: number }) => r.documentId);
  }

  async linkDocumentToCase(entry: InsertCaseDocument): Promise<CaseDocument> {
    const [created] = await db.insert(caseDocuments).values(entry).returning();
    return created;
  }

  async unlinkDocumentFromCase(caseId: number, documentId: number): Promise<void> {
    await db.delete(caseDocuments)
      .where(and(eq(caseDocuments.caseId, caseId), eq(caseDocuments.documentId, documentId)));
  }

  // Case Notes
  async getCaseNotes(caseId: number): Promise<CaseNote[]> {
    return await db.select()
      .from(caseNotes)
      .where(eq(caseNotes.caseId, caseId))
      .orderBy(desc(caseNotes.createdAt));
  }

  async addCaseNote(entry: InsertCaseNote): Promise<CaseNote> {
    const [created] = await db.insert(caseNotes).values(entry).returning();
    return created;
  }

  async deleteCaseNote(id: number, caseId: number, userId: string): Promise<void> {
    await db.delete(caseNotes)
      .where(and(eq(caseNotes.id, id), eq(caseNotes.caseId, caseId), eq(caseNotes.userId, userId)));
  }

  // --- Diary Entries ---
  async getDiaryEntries(userId: string, dateFrom: string, dateTo: string): Promise<any[]> {
    const rows = await db.select({
      id: diaryEntries.id,
      userId: diaryEntries.userId,
      date: diaryEntries.date,
      time: diaryEntries.time,
      title: diaryEntries.title,
      description: diaryEntries.description,
      caseId: diaryEntries.caseId,
      caseTitle: caseFiles.title,
      priority: diaryEntries.priority,
      completed: diaryEntries.completed,
      outcome: diaryEntries.outcome,
      nextDate: diaryEntries.nextDate,
      complianceId: diaryEntries.complianceId,
      createdAt: diaryEntries.createdAt,
    })
      .from(diaryEntries)
      .leftJoin(caseFiles, eq(diaryEntries.caseId, caseFiles.id))
      .where(and(
        eq(diaryEntries.userId, userId),
        gte(diaryEntries.date, dateFrom),
        lte(diaryEntries.date, dateTo),
      ))
      .orderBy(asc(diaryEntries.date), asc(diaryEntries.time));
    return rows;
  }

  async addDiaryEntry(data: { userId: string; date: string; time?: string; title: string; description?: string; caseId?: number; complianceId?: number; priority?: string; completed?: boolean; outcome?: string; nextDate?: string }): Promise<any> {
    const [entry] = await db.insert(diaryEntries).values({
      userId: data.userId,
      date: data.date,
      time: data.time || null,
      title: data.title,
      description: data.description || null,
      caseId: data.caseId || null,
      complianceId: data.complianceId || null,
      priority: (data.priority as any) || "normal",
      completed: data.completed ?? false,
      outcome: data.outcome || null,
      nextDate: data.nextDate || null,
    }).returning();
    return entry;
  }

  async updateDiaryEntry(id: number, userId: string, updates: Partial<{ title: string; description: string; time: string; date: string; caseId: number | null; priority: string; completed: boolean; outcome: string; nextDate: string }>): Promise<any> {
    const [updated] = await db.update(diaryEntries).set(updates as any)
      .where(and(eq(diaryEntries.id, id), eq(diaryEntries.userId, userId)))
      .returning();
    return updated;
  }

  async deleteDiaryEntry(id: number, userId: string): Promise<void> {
    await db.delete(diaryEntries)
      .where(and(eq(diaryEntries.id, id), eq(diaryEntries.userId, userId)));
  }

  // --- Notification Preferences ---
  async getNotificationPrefs(userId: string): Promise<any> {
    const [row] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
    return row || { userId, dailyEmailEnabled: false, weeklyEmailEnabled: false, preferredTime: "19:00", timezone: "Asia/Karachi", lastDailySentAt: null, lastWeeklySentAt: null };
  }

  async upsertNotificationPrefs(userId: string, updates: Partial<{ dailyEmailEnabled: boolean; weeklyEmailEnabled: boolean; preferredTime: string; timezone: string }>): Promise<any> {
    const existing = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
    if (existing.length > 0) {
      const [updated] = await db.update(notificationPreferences).set(updates as any).where(eq(notificationPreferences.userId, userId)).returning();
      return updated;
    } else {
      const [created] = await db.insert(notificationPreferences).values({ userId, ...updates } as any).returning();
      return created;
    }
  }

  async getUsersForDailyDigest(): Promise<Array<{ userId: string; email: string; firstName: string | null; preferredTime: string }>> {
    const rows = await db.execute(sql`
      SELECT u.id AS user_id, u.email, u.first_name,
             COALESCE(np.preferred_time, '19:00') AS preferred_time
      FROM users u
      LEFT JOIN notification_preferences np ON np.user_id = u.id::text
      WHERE u.email IS NOT NULL
        AND u.email_verified = true
        AND COALESCE(np.daily_email_enabled, false) = true
        AND (np.last_daily_sent_at IS NULL OR np.last_daily_sent_at < CURRENT_DATE)
    `);
    return (rows as any).rows?.map((r: any) => ({ userId: r.user_id, email: r.email, firstName: r.first_name, preferredTime: r.preferred_time })) || [];
  }

  async getUsersForWeeklyDigest(): Promise<Array<{ userId: string; email: string; firstName: string | null }>> {
    const rows = await db.execute(sql`
      SELECT u.id AS user_id, u.email, u.first_name
      FROM users u
      LEFT JOIN notification_preferences np ON np.user_id = u.id::text
      WHERE u.email IS NOT NULL
        AND u.email_verified = true
        AND COALESCE(np.weekly_email_enabled, false) = true
        AND (np.last_weekly_sent_at IS NULL OR np.last_weekly_sent_at < CURRENT_DATE)
    `);
    return (rows as any).rows?.map((r: any) => ({ userId: r.user_id, email: r.email, firstName: r.first_name })) || [];
  }

  async markDailyDigestSent(userId: string): Promise<void> {
    const existing = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
    if (existing.length > 0) {
      await db.update(notificationPreferences).set({ lastDailySentAt: new Date() } as any).where(eq(notificationPreferences.userId, userId));
    } else {
      await db.insert(notificationPreferences).values({ userId, dailyEmailEnabled: false, weeklyEmailEnabled: false, lastDailySentAt: new Date() } as any);
    }
  }

  async markWeeklyDigestSent(userId: string): Promise<void> {
    const existing = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
    if (existing.length > 0) {
      await db.update(notificationPreferences).set({ lastWeeklySentAt: new Date() } as any).where(eq(notificationPreferences.userId, userId));
    } else {
      await db.insert(notificationPreferences).values({ userId, dailyEmailEnabled: false, weeklyEmailEnabled: false, lastWeeklySentAt: new Date() } as any);
    }
  }

  // ── Payment Records (Safepay) ─────────────────────────────────────────────

  async createPaymentRecord(data: InsertPaymentRecord): Promise<PaymentRecord> {
    const [record] = await db.insert(paymentRecords).values(data).returning();
    return record;
  }

  async getPaymentRecordByTracker(tracker: string): Promise<PaymentRecord | undefined> {
    const [record] = await db.select()
      .from(paymentRecords)
      .where(eq(paymentRecords.safepayTracker, tracker))
      .limit(1);
    return record;
  }

  async getPaymentRecordsByUser(userId: string): Promise<PaymentRecord[]> {
    return await db.select()
      .from(paymentRecords)
      .where(eq(paymentRecords.userId, userId))
      .orderBy(desc(paymentRecords.createdAt));
  }

  async updatePaymentRecordStatus(
    tracker: string,
    status: string,
    response?: Record<string, unknown>,
  ): Promise<PaymentRecord | undefined> {
    const patch: Record<string, unknown> = { status };
    if (status === "completed") patch.completedAt = new Date();
    if (response) patch.safepayResponse = response;
    const [record] = await db.update(paymentRecords)
      .set(patch)
      .where(eq(paymentRecords.safepayTracker, tracker))
      .returning();
    return record;
  }

  // ── MCP API Keys ───────────────────────────────────────────────────────────

  async createApiKey(userId: string, name: string, keyHash: string): Promise<ApiKey> {
    const [record] = await db.insert(apiKeys)
      .values({ userId, name, keyHash })
      .returning();
    return record;
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    const [record] = await db.select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
      .limit(1);
    return record;
  }

  async listApiKeys(userId: string): Promise<ApiKey[]> {
    return await db.select()
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true)))
      .orderBy(desc(apiKeys.createdAt));
  }

  async revokeApiKey(userId: string, id: number): Promise<boolean> {
    const [record] = await db.update(apiKeys)
      .set({ isActive: false })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
      .returning();
    return !!record;
  }
}

export const storage = new DatabaseStorage();

const JOURNAL_SEED_DATA: Array<{ code: string; name: string }> = [
  { code: "PLD", name: "Pakistan Law Decisions" },
  { code: "LHC", name: "Lahore High Court Neutral Citation" },
  { code: "IHC", name: "Islamabad High Court Neutral Citation" },
  { code: "SHC", name: "Sindh High Court Neutral Citation" },
  { code: "PHC", name: "Peshawar High Court Neutral Citation" },
  { code: "BHC", name: "Balochistan High Court Neutral Citation" },
  { code: "AJKHC", name: "High Court of Azad Jammu and Kashmir Neutral Citation" },
  { code: "SCMR", name: "Supreme Court Monthly Review" },
  { code: "PLJ", name: "Pakistan Law Journal" },
  { code: "MLD", name: "Monthly Law Digest" },
  { code: "CLC", name: "Civil Law Cases" },
  { code: "PCRLJ", name: "Pakistan Criminal Law Journal (P Cr. L J)" },
  { code: "PLC", name: "Pakistan Labour Cases" },
  { code: "YLR", name: "Yearly Law Reporter" },
  { code: "NLR", name: "National Law Reports" },
  { code: "CLD", name: "Corporate Law Decisions" },
  { code: "PTD", name: "Pakistan Tax Decisions" },
  { code: "PSC", name: "Pakistan Supreme Court (PSC)" },
  { code: "SLR", name: "Supreme Law Reporter" },
];

const COURT_SEED_DATA: Array<{ code: string; name: string; level: string }> = [
  { code: "SC", name: "Supreme Court of Pakistan", level: "supreme" },
  { code: "IHC", name: "Islamabad High Court", level: "high" },
  { code: "LHC", name: "Lahore High Court", level: "high" },
  { code: "SHC", name: "Sindh High Court", level: "high" },
  { code: "PHC", name: "Peshawar High Court", level: "high" },
  { code: "BHC", name: "Balochistan High Court", level: "high" },
  { code: "FSC", name: "Federal Shariat Court", level: "federal" },
];

async function ensureCitationReferenceSeedData(): Promise<void> {
  for (const journal of JOURNAL_SEED_DATA) {
    try {
      await db.insert(lawJournals)
        .values({ code: journal.code, name: journal.name, isActive: true })
        .onConflictDoNothing({ target: lawJournals.code });
    } catch (err: any) {
      console.warn(`[Seed] Could not ensure journal ${journal.code}:`, err?.message || err);
    }
  }

  for (const court of COURT_SEED_DATA) {
    try {
      await db.insert(courtsRef)
        .values({ code: court.code, name: court.name, level: court.level, isActive: true })
        .onConflictDoNothing({ target: courtsRef.code });
    } catch (err: any) {
      console.warn(`[Seed] Could not ensure court ${court.code}:`, err?.message || err);
    }
  }
}

async function backfillTsvColumn(): Promise<void> {
  if (!db) {
    console.warn("[Indexes] Database not initialized, skipping backfill.");
    return;
  }
  console.log("[Indexes] Starting background backfill of judgments.tsv_title_headnotes...");
  let rowsUpdated = 0;
  while (true) {
    try {
      const res = await db.execute(sql`
        WITH batch AS (
          SELECT id FROM judgments WHERE tsv_title_headnotes IS NULL LIMIT 2000
        )
        UPDATE judgments
        SET tsv_title_headnotes = to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(headnotes, ''))
        WHERE id IN (SELECT id FROM batch)
      `);
      const count = res.rowCount || 0;
      rowsUpdated += count;
      if (count === 0) break;
      console.log(`[Indexes] Backfilled ${count} judgments (total: ${rowsUpdated})`);
      // Sleep for 100ms to allow other queries to execute and prevent CPU exhaustion
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err: any) {
      console.warn("[Indexes] Error during backfill batch:", err?.message || err);
      break;
    }
  }
  console.log(`[Indexes] Finished background backfill. Total rows updated: ${rowsUpdated}`);
}

export async function ensureSearchIndexes(): Promise<void> {
  console.log("[Indexes] Starting search indexes creation with dedicated migration connection...");
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const migrationPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 60000,
    idle_in_transaction_session_timeout: 30000,
    statement_timeout: 0, // NO STATEMENT TIMEOUT!
  });
  const migrationDb = drizzle(migrationPool);

  try {
    const res = await migrationDb.execute(sql`select indexdef from pg_indexes where indexname = 'idx_judgments_full_text_tsv'`);
    if (res.rows.length > 0) {
      const indexDef = String(res.rows[0].indexdef || "");
      if (indexDef.includes("'english'")) {
        console.log("[Indexes] Found legacy english GIN index on judgments. Dropping it...");
        await migrationDb.execute(sql`DROP INDEX IF EXISTS idx_judgments_full_text_tsv`);
      } else {
        console.log("[Indexes] Found existing simple GIN index on judgments. Skipping drop.");
      }
    } else {
      console.log("[Indexes] No GIN index on judgments exists yet. Executing initial DROP for safety...");
      await migrationDb.execute(sql`DROP INDEX IF EXISTS idx_judgments_full_text_tsv`);
    }
  } catch (err) {
    console.warn("[Indexes] Error checking/dropping legacy GIN index:", err);
  }


  const indexStatements = [
    { label: "pgcrypto_extension", stmt: sql`CREATE EXTENSION IF NOT EXISTS pgcrypto` },
    { label: "pg_trgm_extension", stmt: sql`CREATE EXTENSION IF NOT EXISTS pg_trgm` },
    {
      label: "saved_judgments_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS saved_judgments (
          id serial PRIMARY KEY,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          citation text NOT NULL,
          court text NOT NULL,
          title text NOT NULL,
          summary text NOT NULL,
          keywords text[],
          uri text,
          source text,
          ai_analysis text,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "organizations_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS organizations (
          id serial PRIMARY KEY,
          name text NOT NULL,
          description text,
          owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "org_members_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS org_members (
          id serial PRIMARY KEY,
          org_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role text NOT NULL DEFAULT 'member',
          joined_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "org_invites_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS org_invites (
          id serial PRIMARY KEY,
          org_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          email text NOT NULL,
          invited_by varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status text NOT NULL DEFAULT 'pending',
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "org_knowledge_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS org_knowledge (
          id serial PRIMARY KEY,
          org_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          title text NOT NULL,
          filename text NOT NULL,
          content text NOT NULL,
          category text NOT NULL DEFAULT 'general',
          uploaded_by varchar REFERENCES users(id),
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "law_journals_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS law_journals (
          id serial PRIMARY KEY,
          code text NOT NULL,
          name text NOT NULL,
          is_active boolean NOT NULL DEFAULT true,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "courts_ref_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS courts_ref (
          id serial PRIMARY KEY,
          code text NOT NULL,
          name text NOT NULL,
          level text NOT NULL,
          is_active boolean NOT NULL DEFAULT true,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "judgments_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS judgments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          year integer NOT NULL,
          journal_id integer NOT NULL REFERENCES law_journals(id),
          page integer NOT NULL,
          citation_string text NOT NULL,
          title text NOT NULL,
          petitioner text,
          respondent text,
          court_id integer REFERENCES courts_ref(id),
          court_name_snapshot text,
          decision_date timestamp,
          headnotes text,
          full_text text NOT NULL,
          pdf_url text,
          is_active boolean NOT NULL DEFAULT true,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "citation_links_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS citation_links (
          id serial PRIMARY KEY,
          source_judgment_id uuid NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
          target_judgment_id uuid NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
          citation_type text NOT NULL,
          context_excerpt text,
          citation_text text NOT NULL,
          start_offset integer,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "unresolved_citations_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS unresolved_citations (
          id serial PRIMARY KEY,
          source_judgment_id uuid NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
          raw_citation text NOT NULL,
          year integer,
          journal_code text,
          page integer,
          context_excerpt text,
          status text NOT NULL DEFAULT 'pending',
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "document_files_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS document_files (
          id serial PRIMARY KEY,
          document_id integer NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider text NOT NULL DEFAULT 'r2',
          bucket text NOT NULL,
          object_key text NOT NULL,
          extracted_text_key text,
          original_filename text,
          mime_type text,
          size_bytes integer,
          etag text,
          public_url text,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "visitor_sessions_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS visitor_sessions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          ip_address text NOT NULL,
          message_count integer NOT NULL DEFAULT 0,
          created_at timestamp NOT NULL DEFAULT now(),
          last_message_at timestamp NOT NULL DEFAULT now()
        )
      `,
    },
    {
      label: "case_leads_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS case_leads (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL,
          phone text NOT NULL,
          email text NOT NULL,
          case_type text NOT NULL,
          case_description text NOT NULL,
          city text NOT NULL DEFAULT '',
          urgency text NOT NULL DEFAULT 'normal',
          preferred_callback_time text,
          consent_to_contact boolean NOT NULL DEFAULT false,
          ip_address text NOT NULL,
          status text NOT NULL DEFAULT 'open',
          status_updated_at timestamp NOT NULL DEFAULT now(),
          created_at timestamp NOT NULL DEFAULT now()
        )
      `,
    },
    {
      label: "email_verification_tokens_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token varchar NOT NULL UNIQUE,
          expires_at timestamp NOT NULL,
          used_at timestamp,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "public_funnel_events_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS public_funnel_events (
          id serial PRIMARY KEY,
          event_type text NOT NULL,
          session_id text,
          ip_address text NOT NULL,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `,
    },
    {
      label: "admin_knowledge_files_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS admin_knowledge_files (
          id serial PRIMARY KEY,
          admin_knowledge_id integer NOT NULL REFERENCES admin_knowledge(id) ON DELETE CASCADE,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider text NOT NULL DEFAULT 'r2',
          bucket text NOT NULL,
          object_key text NOT NULL,
          extracted_text_key text,
          original_filename text,
          mime_type text,
          size_bytes integer,
          etag text,
          public_url text,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "statute_document_files_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS statute_document_files (
          id serial PRIMARY KEY,
          statute_document_id integer NOT NULL REFERENCES statute_documents(id) ON DELETE CASCADE,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider text NOT NULL DEFAULT 'r2',
          bucket text NOT NULL,
          object_key text NOT NULL,
          extracted_text_key text,
          original_filename text,
          mime_type text,
          size_bytes integer,
          etag text,
          public_url text,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    { label: "vector_extension", stmt: sql`CREATE EXTENSION IF NOT EXISTS vector` },
    {
      label: "style_memory_settings_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS style_memory_settings (
          id serial PRIMARY KEY,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          org_id integer REFERENCES organizations(id) ON DELETE CASCADE,
          module text NOT NULL,
          enabled boolean NOT NULL DEFAULT true,
          ownership_mode text NOT NULL DEFAULT 'user-org',
          learning_source text NOT NULL DEFAULT 'full-activity',
          coverage text NOT NULL DEFAULT 'generation-only',
          strictness text NOT NULL DEFAULT 'balanced',
          last_backfill_at timestamp,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "style_memory_samples_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS style_memory_samples (
          id serial PRIMARY KEY,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          org_id integer REFERENCES organizations(id) ON DELETE CASCADE,
          module text NOT NULL,
          source_type text NOT NULL,
          source_ref text,
          title text NOT NULL,
          raw_text text NOT NULL,
          text_hash text NOT NULL,
          status text NOT NULL DEFAULT 'active',
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "style_memory_chunks_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS style_memory_chunks (
          id serial PRIMARY KEY,
          sample_id integer NOT NULL REFERENCES style_memory_samples(id) ON DELETE CASCADE,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          org_id integer REFERENCES organizations(id) ON DELETE CASCADE,
          module text NOT NULL,
          chunk_index integer NOT NULL,
          content text NOT NULL,
          token_count integer NOT NULL,
          embedding vector(384) NOT NULL,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "style_memory_events_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS style_memory_events (
          id serial PRIMARY KEY,
          event_type text NOT NULL,
          module text NOT NULL,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          org_id integer REFERENCES organizations(id) ON DELETE CASCADE,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    { label: "alter_case_law_citation_year", stmt: sql`ALTER TABLE case_law ADD COLUMN IF NOT EXISTS citation_year integer` },
    { label: "alter_case_law_citation_report", stmt: sql`ALTER TABLE case_law ADD COLUMN IF NOT EXISTS citation_report text` },
    { label: "alter_case_law_citation_page", stmt: sql`ALTER TABLE case_law ADD COLUMN IF NOT EXISTS citation_page integer` },
    { label: "alter_case_law_citation_role", stmt: sql`ALTER TABLE case_law ADD COLUMN IF NOT EXISTS citation_role text` },
    {
      label: "backfill_case_law_citation_parts",
      stmt: sql`
        UPDATE case_law
        SET
          citation_year = COALESCE(
            citation_year,
            NULLIF((regexp_match(upper(citation), '((?:19|20)[0-9]{2})'))[1], '')::integer
          ),
          citation_report = COALESCE(
            citation_report,
            NULLIF((regexp_match(upper(citation), '(?:19|20)[0-9]{2}\\s+([A-Z][A-Z0-9]{1,12})'))[1], '')
          ),
          citation_page = COALESCE(
            citation_page,
            NULLIF((regexp_match(upper(citation), '([0-9]{1,6})\\s*$'))[1], '')::integer
          )
        WHERE citation IS NOT NULL
          AND (citation_year IS NULL OR citation_report IS NULL OR citation_page IS NULL)
      `,
    },
    {
      label: "backfill_case_law_citation_role",
      stmt: sql`
        UPDATE case_law
        SET citation_role = COALESCE(NULLIF(trim(citation_role), ''), 'cited')
        WHERE citation_role IS NULL OR trim(citation_role) = ''
      `,
    },
    { label: "alter_case_law_citation_role_default", stmt: sql`ALTER TABLE case_law ALTER COLUMN citation_role SET DEFAULT 'cited'` },
    { label: "alter_case_law_citation_role_not_null", stmt: sql`ALTER TABLE case_law ALTER COLUMN citation_role SET NOT NULL` },
    { label: "idx_threads_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads (user_id)` },
    { label: "idx_messages_thread_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages (thread_id)` },
    { label: "idx_documents_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents (user_id)` },
    { label: "idx_bookmarks_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks (user_id)` },
    { label: "idx_search_history_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history (user_id)` },
    { label: "idx_usage_tracking_user_created", stmt: sql`CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_created ON usage_tracking (user_id, created_at)` },
    { label: "idx_saved_judgments_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_saved_judgments_user_id ON saved_judgments (user_id)` },
    { label: "idx_query_cache_endpoint_hash", stmt: sql`CREATE INDEX IF NOT EXISTS idx_query_cache_endpoint_hash ON query_cache (endpoint, query_hash)` },
    { label: "idx_case_law_citation_parts", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_law_citation_parts ON case_law (citation_report, citation_year, citation_page)` },
    { label: "idx_case_law_citation_page", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_law_citation_page ON case_law (citation_page)` },
    { label: "idx_case_law_citation_year", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_law_citation_year ON case_law (citation_year)` },
    { label: "idx_case_law_citation_role", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_law_citation_role ON case_law (citation_role, source_doc_id)` },
    { label: "idx_case_law_citation_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_law_citation_trgm ON case_law USING gin (citation gin_trgm_ops)` },
    { label: "idx_case_law_title_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_law_title_trgm ON case_law USING gin (title gin_trgm_ops)` },
    { label: "idx_case_law_court_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_law_court_trgm ON case_law USING gin (court gin_trgm_ops)` },
    { label: "idx_case_law_summary_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_law_summary_trgm ON case_law USING gin (summary gin_trgm_ops)` },
    // NOTE: array_to_string() expression GIN index removed — Postgres requires IMMUTABLE
    // functions in index expressions; array_to_string is not IMMUTABLE on all versions.
    // Keyword search falls back to the summary GIN index which covers the same content.
    { label: "idx_github_knowledge_title_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_github_knowledge_title_trgm ON github_knowledge USING gin (title gin_trgm_ops)` },
    { label: "idx_github_knowledge_content_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_github_knowledge_content_trgm ON github_knowledge USING gin (content gin_trgm_ops)` },
    { label: "idx_admin_knowledge_content_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_admin_knowledge_content_trgm ON admin_knowledge USING gin (content gin_trgm_ops)` },
    { label: "idx_documents_content_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_documents_content_trgm ON documents USING gin (content gin_trgm_ops)` },
    { label: "idx_statutes_short_title_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_statutes_short_title_trgm ON statutes USING gin (short_title gin_trgm_ops)` },
    { label: "idx_statutes_description_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_statutes_description_trgm ON statutes USING gin (description gin_trgm_ops)` },
    { label: "idx_statutes_section_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_statutes_section_trgm ON statutes USING gin (section gin_trgm_ops)` },
    { label: "idx_statutes_punishment_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_statutes_punishment_trgm ON statutes USING gin (punishment gin_trgm_ops)` },
    { label: "idx_statute_documents_title_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_statute_documents_title_trgm ON statute_documents USING gin (title gin_trgm_ops)` },
    { label: "idx_statute_documents_content_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_statute_documents_content_trgm ON statute_documents USING gin (content gin_trgm_ops)` },
    { label: "idx_law_journals_code", stmt: sql`CREATE INDEX IF NOT EXISTS idx_law_journals_code ON law_journals (code)` },
    { label: "idx_courts_ref_code", stmt: sql`CREATE INDEX IF NOT EXISTS idx_courts_ref_code ON courts_ref (code)` },
    { label: "law_journals_code_unique", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS law_journals_code_unique ON law_journals (code)` },
    { label: "courts_ref_code_unique", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS courts_ref_code_unique ON courts_ref (code)` },
    { label: "idx_judgments_citation_parts", stmt: sql`CREATE INDEX IF NOT EXISTS idx_judgments_citation_parts ON judgments (year, journal_id, page)` },
    { label: "judgments_year_journal_page_unique", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS judgments_year_journal_page_unique ON judgments (year, journal_id, page)` },
    { label: "idx_judgments_citation_string_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_judgments_citation_string_trgm ON judgments USING gin (citation_string gin_trgm_ops)` },
    {
      label: "idx_judgments_full_text_tsv",
      stmt: sql`CREATE INDEX IF NOT EXISTS idx_judgments_full_text_tsv ON judgments USING gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(headnotes,'') || ' ' || coalesce(full_text,'')))`
    },
    {
      label: "idx_judgments_title_headnotes_tsv",
      stmt: sql`CREATE INDEX IF NOT EXISTS idx_judgments_title_headnotes_tsv ON judgments USING gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(headnotes,'')))`
    },
    {
      label: "idx_case_law_full_text_tsv",
      stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_law_full_text_tsv ON case_law USING gin (to_tsvector('simple', coalesce(citation,'') || ' ' || coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(court,'')))`
    },
    // GIN trigram indexes for fast ILIKE on judgments — makes headnotes/title/parties search <500ms
    { label: "idx_judgments_headnotes_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_judgments_headnotes_trgm ON judgments USING gin (headnotes gin_trgm_ops)` },
    { label: "idx_judgments_title_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_judgments_title_trgm ON judgments USING gin (title gin_trgm_ops)` },
    { label: "idx_judgments_petitioner_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_judgments_petitioner_trgm ON judgments USING gin (petitioner gin_trgm_ops)` },
    { label: "idx_judgments_respondent_trgm", stmt: sql`CREATE INDEX IF NOT EXISTS idx_judgments_respondent_trgm ON judgments USING gin (respondent gin_trgm_ops)` },
    { label: "idx_citation_links_source", stmt: sql`CREATE INDEX IF NOT EXISTS idx_citation_links_source ON citation_links (source_judgment_id)` },
    { label: "idx_citation_links_target", stmt: sql`CREATE INDEX IF NOT EXISTS idx_citation_links_target ON citation_links (target_judgment_id)` },
    { label: "citation_links_unique", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS citation_links_unique ON citation_links (source_judgment_id, target_judgment_id, citation_type, citation_text)` },
    { label: "idx_unresolved_citations_status", stmt: sql`CREATE INDEX IF NOT EXISTS idx_unresolved_citations_status ON unresolved_citations (status)` },
    { label: "idx_document_files_document_id", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_document_files_document_id ON document_files (document_id)` },
    { label: "idx_document_files_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_document_files_user_id ON document_files (user_id)` },
    { label: "visitor_sessions_ip_address_unique", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS visitor_sessions_ip_address_unique ON visitor_sessions (ip_address)` },
    { label: "idx_visitor_sessions_last_message_at", stmt: sql`CREATE INDEX IF NOT EXISTS idx_visitor_sessions_last_message_at ON visitor_sessions (last_message_at)` },
    { label: "idx_case_leads_created_at", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_leads_created_at ON case_leads (created_at)` },
    { label: "idx_case_leads_case_type", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_leads_case_type ON case_leads (case_type)` },
    { label: "idx_case_leads_city", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_leads_city ON case_leads (city)` },
    { label: "idx_case_leads_urgency", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_leads_urgency ON case_leads (urgency)` },
    { label: "idx_case_leads_status", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_leads_status ON case_leads (status)` },
    { label: "idx_email_verification_tokens_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens (user_id)` },
    { label: "idx_email_verification_tokens_expires_at", stmt: sql`CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON email_verification_tokens (expires_at)` },
    { label: "idx_public_funnel_events_created_at", stmt: sql`CREATE INDEX IF NOT EXISTS idx_public_funnel_events_created_at ON public_funnel_events (created_at)` },
    { label: "idx_public_funnel_events_event_type", stmt: sql`CREATE INDEX IF NOT EXISTS idx_public_funnel_events_event_type ON public_funnel_events (event_type)` },
    { label: "idx_public_funnel_events_ip", stmt: sql`CREATE INDEX IF NOT EXISTS idx_public_funnel_events_ip ON public_funnel_events (ip_address)` },
    { label: "alter_case_leads_status", stmt: sql`ALTER TABLE case_leads ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'` },
    { label: "alter_case_leads_status_updated_at", stmt: sql`ALTER TABLE case_leads ADD COLUMN IF NOT EXISTS status_updated_at timestamp NOT NULL DEFAULT now()` },
    { label: "alter_case_leads_city", stmt: sql`ALTER TABLE case_leads ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT ''` },
    { label: "alter_case_leads_urgency", stmt: sql`ALTER TABLE case_leads ADD COLUMN IF NOT EXISTS urgency text NOT NULL DEFAULT 'normal'` },
    { label: "alter_case_leads_preferred_callback_time", stmt: sql`ALTER TABLE case_leads ADD COLUMN IF NOT EXISTS preferred_callback_time text` },
    { label: "alter_case_leads_consent_to_contact", stmt: sql`ALTER TABLE case_leads ADD COLUMN IF NOT EXISTS consent_to_contact boolean NOT NULL DEFAULT false` },
    { label: "alter_document_files_extracted_text_key", stmt: sql`ALTER TABLE document_files ADD COLUMN IF NOT EXISTS extracted_text_key text` },
    { label: "alter_admin_knowledge_case_law_process_status", stmt: sql`ALTER TABLE admin_knowledge ADD COLUMN IF NOT EXISTS case_law_process_status text DEFAULT 'pending'` },
    { label: "alter_admin_knowledge_case_law_process_attempts", stmt: sql`ALTER TABLE admin_knowledge ADD COLUMN IF NOT EXISTS case_law_process_attempts integer DEFAULT 0` },
    { label: "alter_admin_knowledge_case_law_process_last_at", stmt: sql`ALTER TABLE admin_knowledge ADD COLUMN IF NOT EXISTS case_law_process_last_at timestamp` },
    { label: "alter_admin_knowledge_case_law_process_last_error", stmt: sql`ALTER TABLE admin_knowledge ADD COLUMN IF NOT EXISTS case_law_process_last_error text` },
    { label: "alter_admin_knowledge_files_extracted_text_key", stmt: sql`ALTER TABLE admin_knowledge_files ADD COLUMN IF NOT EXISTS extracted_text_key text` },
    { label: "alter_statute_document_files_extracted_text_key", stmt: sql`ALTER TABLE statute_document_files ADD COLUMN IF NOT EXISTS extracted_text_key text` },
    { label: "idx_admin_knowledge_files_doc_id", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_knowledge_files_doc_id ON admin_knowledge_files (admin_knowledge_id)` },
    { label: "idx_admin_knowledge_files_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_admin_knowledge_files_user_id ON admin_knowledge_files (user_id)` },
    { label: "idx_statute_document_files_doc_id", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_statute_document_files_doc_id ON statute_document_files (statute_document_id)` },
    { label: "idx_statute_document_files_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_statute_document_files_user_id ON statute_document_files (user_id)` },
    { label: "idx_style_memory_settings_scope", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_style_memory_settings_scope ON style_memory_settings (user_id, coalesce(org_id, 0), module)` },
    { label: "idx_style_memory_samples_hash", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_style_memory_samples_hash ON style_memory_samples (module, user_id, coalesce(org_id, 0), text_hash)` },
    { label: "idx_style_memory_samples_scope", stmt: sql`CREATE INDEX IF NOT EXISTS idx_style_memory_samples_scope ON style_memory_samples (module, user_id, org_id, status, source_type, created_at)` },
    { label: "idx_style_memory_chunks_scope", stmt: sql`CREATE INDEX IF NOT EXISTS idx_style_memory_chunks_scope ON style_memory_chunks (module, user_id, org_id, sample_id)` },
    { label: "idx_style_memory_chunks_tsv", stmt: sql`CREATE INDEX IF NOT EXISTS idx_style_memory_chunks_tsv ON style_memory_chunks USING gin (to_tsvector('simple', content))` },
    { label: "idx_style_memory_chunks_unique", stmt: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_style_memory_chunks_unique ON style_memory_chunks (sample_id, chunk_index)` },
    { label: "idx_style_memory_events_scope", stmt: sql`CREATE INDEX IF NOT EXISTS idx_style_memory_events_scope ON style_memory_events (module, user_id, org_id, created_at)` },
    { label: "idx_admin_knowledge_case_law_process_status", stmt: sql`CREATE INDEX IF NOT EXISTS idx_admin_knowledge_case_law_process_status ON admin_knowledge (category, case_law_process_status, id)` },
    { label: "alter_style_memory_chunks_embedding_vector", stmt: sql`ALTER TABLE style_memory_chunks ALTER COLUMN embedding TYPE vector(384) USING embedding::vector` },
    { label: "alter_style_memory_settings_last_backfill", stmt: sql`ALTER TABLE style_memory_settings ADD COLUMN IF NOT EXISTS last_backfill_at timestamp` },
    { label: "alter_style_memory_settings_updated_at", stmt: sql`ALTER TABLE style_memory_settings ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()` },
    { label: "alter_users_session_epoch", stmt: sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_epoch integer NOT NULL DEFAULT 0` },
    { label: "alter_users_active_session_ip", stmt: sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active_session_ip text` },
    { label: "alter_users_active_session_at", stmt: sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active_session_at timestamp` },
    { label: "alter_users_email_verified", stmt: sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false` },
    { label: "alter_users_email_verified_at", stmt: sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamp` },
    { label: "alter_users_subscription_tier_default", stmt: sql`ALTER TABLE users ALTER COLUMN subscription_tier SET DEFAULT 'free'` },
    { label: "alter_users_subscription_cycle", stmt: sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_cycle text NOT NULL DEFAULT 'monthly'` },
    { label: "alter_users_subscription_start_at", stmt: sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_start_at timestamp` },
    { label: "alter_users_subscription_end_at", stmt: sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_end_at timestamp` },
    {
      label: "backfill_users_subscription_cycle",
      stmt: sql`UPDATE users SET subscription_cycle = 'monthly' WHERE subscription_cycle IS NULL OR trim(subscription_cycle) = ''`,
    },
    {
      label: "sanitize_users_subscription_cycle",
      stmt: sql`UPDATE users SET subscription_cycle = 'monthly' WHERE lower(subscription_cycle) NOT IN ('monthly', 'quarterly', 'yearly')`,
    },
    { label: "idx_users_subscription_cycle", stmt: sql`CREATE INDEX IF NOT EXISTS idx_users_subscription_cycle ON users (subscription_cycle)` },
    { label: "idx_users_subscription_end_at", stmt: sql`CREATE INDEX IF NOT EXISTS idx_users_subscription_end_at ON users (subscription_end_at)` },
    // ── Case File Management System ──────────────────────────────────────
    {
      label: "case_files_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS case_files (
          id serial PRIMARY KEY,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          org_id integer REFERENCES organizations(id) ON DELETE SET NULL,
          reference_no varchar(50),
          title text NOT NULL,
          case_type text NOT NULL DEFAULT 'other',
          court text,
          case_number text,
          status text NOT NULL DEFAULT 'active',
          priority text NOT NULL DEFAULT 'normal',
          description text,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "case_clients_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS case_clients (
          id serial PRIMARY KEY,
          case_id integer NOT NULL REFERENCES case_files(id) ON DELETE CASCADE,
          role text NOT NULL DEFAULT 'client',
          name text NOT NULL,
          father_name text,
          cnic text,
          phone text,
          email text,
          address text,
          notes text,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "case_compliance_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS case_compliance (
          id serial PRIMARY KEY,
          case_id integer NOT NULL REFERENCES case_files(id) ON DELETE CASCADE,
          type text NOT NULL,
          title text NOT NULL,
          due_date timestamp NOT NULL,
          court text,
          judge text,
          status text NOT NULL DEFAULT 'pending',
          notes text,
          document_id integer,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "case_compliance_document_id_col",
      stmt: sql`
        ALTER TABLE case_compliance ADD COLUMN IF NOT EXISTS document_id integer
      `,
    },
    {
      label: "case_documents_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS case_documents (
          id serial PRIMARY KEY,
          case_id integer NOT NULL REFERENCES case_files(id) ON DELETE CASCADE,
          document_id integer NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          label text,
          added_at timestamp DEFAULT now(),
          UNIQUE(case_id, document_id)
        )
      `,
    },
    {
      label: "case_notes_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS case_notes (
          id serial PRIMARY KEY,
          case_id integer NOT NULL REFERENCES case_files(id) ON DELETE CASCADE,
          user_id varchar NOT NULL REFERENCES users(id),
          content text NOT NULL,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    { label: "idx_case_files_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_files_user_id ON case_files (user_id)` },
    { label: "idx_case_files_status", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_files_status ON case_files (status)` },
    { label: "idx_case_files_org_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_files_org_id ON case_files (org_id)` },
    { label: "idx_case_clients_case_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_clients_case_id ON case_clients (case_id)` },
    { label: "idx_case_compliance_case_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_compliance_case_id ON case_compliance (case_id)` },
    { label: "idx_case_compliance_due_date", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_compliance_due_date ON case_compliance (due_date)` },
    { label: "idx_case_documents_case_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_documents_case_id ON case_documents (case_id)` },
    { label: "idx_case_documents_document_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_documents_document_id ON case_documents (document_id)` },
    { label: "idx_case_notes_case_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_notes_case_id ON case_notes (case_id)` },
    {
      label: "diary_entries_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS diary_entries (
          id serial PRIMARY KEY,
          user_id text NOT NULL,
          date text NOT NULL,
          time text,
          title text NOT NULL,
          description text,
          case_id integer REFERENCES case_files(id) ON DELETE SET NULL,
          compliance_id integer REFERENCES case_compliance(id) ON DELETE SET NULL,
          priority text NOT NULL DEFAULT 'normal',
          completed boolean NOT NULL DEFAULT false,
          outcome text,
          next_date text,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    { label: "diary_entries_userid_to_text", stmt: sql`ALTER TABLE diary_entries ALTER COLUMN user_id TYPE text USING user_id::text` },
    { label: "diary_entries_outcome_col", stmt: sql`ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS outcome text` },
    { label: "diary_entries_next_date_col", stmt: sql`ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS next_date text` },
    { label: "alter_judgments_ai_summary", stmt: sql`ALTER TABLE judgments ADD COLUMN IF NOT EXISTS ai_summary jsonb` },
    { label: "idx_diary_entries_user_date", stmt: sql`CREATE INDEX IF NOT EXISTS idx_diary_entries_user_date ON diary_entries (user_id, date)` },
    {
      label: "notification_preferences_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS notification_preferences (
          id serial PRIMARY KEY,
          user_id text NOT NULL UNIQUE,
          daily_email_enabled boolean NOT NULL DEFAULT false,
          weekly_email_enabled boolean NOT NULL DEFAULT false,
          preferred_time text NOT NULL DEFAULT '19:00',
          timezone text NOT NULL DEFAULT 'Asia/Karachi',
          last_daily_sent_at timestamp,
          last_weekly_sent_at timestamp,
          created_at timestamp DEFAULT now()
        )
      `,
    },
    {
      label: "disable_diary_emails_default",
      stmt: sql`
        ALTER TABLE notification_preferences
          ALTER COLUMN daily_email_enabled SET DEFAULT false,
          ALTER COLUMN weekly_email_enabled SET DEFAULT false
      `,
    },
    {
      label: "disable_all_diary_emails",
      stmt: sql`
        UPDATE notification_preferences
        SET daily_email_enabled = false, weekly_email_enabled = false
        WHERE daily_email_enabled = true OR weekly_email_enabled = true
      `,
    },
    // ── Payment Records (Safepay) ──────────────────────────────────────
    {
      label: "payment_records_table",
      stmt: sql`
        CREATE TABLE IF NOT EXISTS payment_records (
          id serial PRIMARY KEY,
          user_id varchar NOT NULL REFERENCES users(id),
          safepay_tracker text NOT NULL,
          safepay_token text,
          plan_key text NOT NULL,
          billing_cycle text NOT NULL,
          amount_pkr integer NOT NULL,
          status text NOT NULL DEFAULT 'pending',
          safepay_response jsonb,
          created_at timestamp DEFAULT now(),
          completed_at timestamp
        )
      `,
    },
    { label: "idx_payment_records_tracker", stmt: sql`CREATE INDEX IF NOT EXISTS idx_payment_records_tracker ON payment_records (safepay_tracker)` },
    { label: "idx_payment_records_user_id", stmt: sql`CREATE INDEX IF NOT EXISTS idx_payment_records_user_id ON payment_records (user_id)` },
    { label: "idx_payment_records_status", stmt: sql`CREATE INDEX IF NOT EXISTS idx_payment_records_status ON payment_records (status)` },
    // ── AI Output Quality enhancements ─────────────────────────────────
    { label: "alter_ai_output_log_user_query", stmt: sql`ALTER TABLE ai_output_log ADD COLUMN IF NOT EXISTS user_query text DEFAULT ''` },
    { label: "alter_ai_output_log_response_time_ms", stmt: sql`ALTER TABLE ai_output_log ADD COLUMN IF NOT EXISTS response_time_ms integer DEFAULT 0` },
    // ── Precomputed tsvector columns for keyword search optimization ────
    // ── Precomputed tsvector columns for keyword search optimization ────
    {
      label: "alter_judgments_tsv_title_headnotes_nullable",
      stmt: sql`ALTER TABLE judgments ADD COLUMN IF NOT EXISTS tsv_title_headnotes tsvector`,
    },
    {
      label: "idx_judgments_tsv_title_headnotes",
      stmt: sql`CREATE INDEX IF NOT EXISTS idx_judgments_tsv_title_headnotes ON judgments USING gin (tsv_title_headnotes)`,
    },
    {
      label: "create_judgments_tsv_trigger_fn",
      stmt: sql`
        CREATE OR REPLACE FUNCTION judgments_tsv_trigger() RETURNS trigger AS $$
        BEGIN
          new.tsv_title_headnotes := to_tsvector('simple', coalesce(new.title, '') || ' ' || coalesce(new.headnotes, ''));
          return new;
        END;
        $$ LANGUAGE plpgsql
      `,
    },
    {
      label: "drop_judgments_tsv_trigger_old",
      stmt: sql`DROP TRIGGER IF EXISTS tsvectorupdate_judgments ON judgments`,
    },
    {
      label: "create_judgments_tsv_trigger",
      stmt: sql`
        CREATE TRIGGER tsvectorupdate_judgments BEFORE INSERT OR UPDATE ON judgments
        FOR EACH ROW EXECUTE FUNCTION judgments_tsv_trigger()
      `,
    },
    {
      label: "alter_case_law_tsv_citation_title_summary_court",
      stmt: sql`ALTER TABLE case_law ADD COLUMN IF NOT EXISTS tsv_citation_title_summary_court tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(citation, '') || ' ' || coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(court, ''))) STORED`,
    },
    {
      label: "idx_case_law_tsv_full_text",
      stmt: sql`CREATE INDEX IF NOT EXISTS idx_case_law_tsv_full_text ON case_law USING gin (tsv_citation_title_summary_court)`,
    },
  ];

  for (const { label, stmt } of indexStatements) {
    try {
      await migrationDb.execute(stmt);
    } catch (err: any) {
      console.warn(`[Indexes] Could not ensure ${label}:`, err?.cause?.message || err?.message || err);
    }
  }
  try {
    await migrationDb.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_style_memory_chunks_embedding_cosine ON style_memory_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`,
    );
  } catch (err: any) {
    console.warn("[Indexes] Could not ensure idx_style_memory_chunks_embedding_cosine:", err?.cause?.message || err?.message || err);
  }
  try {
    await migrationPool.end();
    console.log("[Indexes] Dedicated migration connection closed.");
  } catch (err: any) {
    console.warn("[Indexes] Error closing migration pool:", err?.message || err);
  }
  try {
    const { ensureRagSchema } = await import("./rag/vector-store");
    await ensureRagSchema();
  } catch (err: any) {
    console.warn("[RAG] Could not ensure RAG schema:", err?.message || err);
  }
  await ensureCitationReferenceSeedData();
  // Start background backfilling of judgments.tsv_title_headnotes
  backfillTsvColumn().catch((err) => {
    console.error("[Indexes] Background backfill failed:", err?.message || err);
  });
  console.log("Search indexes verification complete.");
}

// Critical legal signal tokens that MUST be strictly matched (never bypassed in OR fallbacks)
export const CRITICAL_LEGAL_TOKENS = new Set([
  "mehr", "dower", "nikahnama", "mahr", "mehar", "hiba",
  "talaq", "nafaqa", "iddat", "divorce", "khula", "dissolution",
  "marriage", "custody", "maintenance", "bail", "murder", "qatl",
  "tax", "income", "sales", "fbr", "customs", "smuggling", "haq"
]);

// Shared stop words list to ignore in both searchCaseLaw and searchJudgmentsByKeywords
export const STOP_WORDS = new Set([
  "can","the","and","for","are","was","has","have","had","been","that","this",
  "with","from","his","her","its","they","them","will","may","not","out","any",
  "all","who","what","when","how","why","but","yet","nor","too","also","she",
  "him","our","your","their","give","seek","case","law","legal","does","would",
  "could","should","being","against","about","into","than","then","just","like",
  "which","there","where","here","such","after","before","under","over","upon",
  "without","within","between","through","during","while","although","however",
  "therefore","whether","both","each","some","more","most","other","only","also",
  "very","even","still","well","back","way","first","last","long","little","own",
  "right","old","same","new","want","need","take","make","come","get","put","ask",
]);

// Statically pre-compiled regular expressions to prevent V8 CPU bottlenecks in mapping loops
export const TITLE_SEP_REGEX = /\s+\b(vs\.?|versus|v\.?)\b\s+/i;
export const CLEAN_FALLBACK_REGEX = /(?<!^)(?:\.|\b)(?:Honorable\s+)?Justice\b[\s\S]*|(?<!^)(?:\.|\b)Before\b[\s\S]*|(?<!^)(?:\.|\b)(?:Advocate|Barrister|Counsel)\b[\s\S]*/i;
export const CLEAN_RESPONDENT_REGEX = /(?:\.|\b)(?:Honorable\s+)?Justice\b[\s\S]*|(?:\.|\b)Before\b[\s\S]*|(?:\.|\b)(?:Advocate|Barrister|Counsel)\b[\s\S]*|(?:\.|\b|---)(?:Respondents?|decided\s+on)\b[\s\S]*/i;
export const MULTIPLE_SPACES_REGEX = /\s+/g;
export const END_PUNCTUATION_REGEX = /[.,\s\-–—]+$/;

export const REAL_CASE_TITLE_SEP_REGEX = /\b(vs?\.?|versus)\b/i;
export const ALL_CAPS_PREFIX_REGEX = /^[A-Z][A-Z .'-]{3,}/;
export const PLACEHOLDER_TITLE_REGEX = /^case\s+(?:reported\s+at|cited\s+as|no\.?)\b/i;
export const PLACEHOLDER_HEADNOTES_REGEX = /^case\s+(?:cited\s+as|reported\s+at)\b/i;

export const TITLE_HEADER_REGEX = /(?:^|\n)\s*Title\s*:\s*([\s\S]*?)(?=\n\s*(?:Case No\.?|Reported As|Date of Judgment|Result|JUDGMENT|ORDER|Judge\(s\)|Court Name|Title)\s*:|$)/i;
export const COURT_NAME_HEADER_REGEX = /(?:^|\n)\s*Court Name\s*:\s*([\s\S]*?)(?=\n\s*(?:Case No\.?|Reported As|Date of Judgment|Result|JUDGMENT|ORDER|Judge\(s\)|Court Name|Title)\s*:|$)/i;
export const COURT_HEADER_REGEX = /(?:^|\n)\s*Court\s*:\s*([\s\S]*?)(?=\n\s*(?:Case No\.?|Reported As|Date of Judgment|Result|JUDGMENT|ORDER|Judge\(s\)|Court Name|Title)\s*:|$)/i;

export const STANDALONE_JUDGMENT_REGEX = /(?:^|\r?\n)\s*(JUDGMENT|ORDER)\s*(?:\r?\n)+([\s\S]*)$/i;
export const STRIP_JUDGE_SIGNATURE_REGEX = /^[A-Z\s,.'’-]+,\s*(?:[J|C]\.?\s*){1,2}[:\-–—\s]+/i;
export const STRIP_TITLE_HEADER_REGEX = /^[\s\S]*?\bTitle\s*:\s*[^\n]*/i;

export const METADATA_BULLET_REGEX = /\([a-z]\)\s*$/;
export const METADATA_NARRATIVE_REGEX = /\b(held|observed|dismissed|allowed|declared|illegal|lawful|entitled|refund|order|judgment|appeal|contended)\b/i;

export function looksLikeRealCaseTitle(s: string): boolean {
  if (!s) return false;
  if (REAL_CASE_TITLE_SEP_REGEX.test(s)) return true;
  if (ALL_CAPS_PREFIX_REGEX.test(s)) return true;
  return false;
}

/**
 * Builds a case-insensitive whole-word Postgres regex match or standard ILIKE wildcard.
 * For short tokens (under 5 characters, like "mehr" or "haq") or critical signal tokens,
 * it enforces word boundaries using Postgres \\y marker to avoid substring collisions (e.g. matching "Mehran" or "Mehrab").
 */
export function buildSearchTokenMatch(column: any, token: string) {
  const cleanToken = token.trim().toLowerCase();
  // Postgres regular expression whole-word boundary match: \y matches word boundary
  return sql`${column} ~* ${'\\y' + cleanToken + '\\y'}`;
}

export function isMetadataOnlySummary(text: string): boolean {
  if (!text) return true;
  const cleaned = text.trim();
  const lower = cleaned.toLowerCase();
  
  // Under 250 characters is almost certainly metadata-only or truncated
  if (cleaned.length < 250) return true;
  
  // Look for trailing bulletin marker e.g. "(a)" at the end
  const endsWithBullet = METADATA_BULLET_REGEX.test(cleaned);
  const hasNarrative = METADATA_NARRATIVE_REGEX.test(lower);
  
  if (endsWithBullet && !hasNarrative) {
    return true;
  }
  
  // Scan for metadata keywords (decided on, Versus, Constitution Petition) without legal narrative
  const hasVersus = lower.includes("versus") || lower.includes(" vs ");
  const hasDecidedOn = lower.includes("decided on");
  const hasBefore = lower.includes("before");
  
  if (hasVersus && hasDecidedOn && hasBefore && !hasNarrative) {
    return true;
  }
  
  return false;
}

export function cleanCaseTitle(title: string): string {
  if (!title) return "";
  
  // Find standard vs/versus separators (case-insensitive)
  const match = title.match(TITLE_SEP_REGEX);
  if (!match) {
    // Fallback: apply the regex only if it doesn't match the very start of the string
    let cleaned = title;
    cleaned = cleaned.replace(CLEAN_FALLBACK_REGEX, "");
    return cleaned.replace(MULTIPLE_SPACES_REGEX, " ").replace(END_PUNCTUATION_REGEX, "").trim();
  }
  
  // Split the title into Petitioner and Respondent to completely protect Petitioner names
  const sep = match[0];
  const sepIndex = title.indexOf(sep);
  const petitioner = title.substring(0, sepIndex).trim();
  const respondent = title.substring(sepIndex + sep.length).trim();
  
  // Clean Respondent metadata leakage (Justice, Before, counsel, decided on, Respondents suffix)
  const cleanedRespondent = respondent.replace(CLEAN_RESPONDENT_REGEX, "");
  
  const joined = `${petitioner}${sep}${cleanedRespondent}`;
  return joined.replace(MULTIPLE_SPACES_REGEX, " ").replace(END_PUNCTUATION_REGEX, "").trim();
}

export function extractSubstantiveSummary(fullTextStr: string): string {
  if (!fullTextStr) return "";
  
  let bodyText = fullTextStr;
  // Match stand-alone JUDGMENT or ORDER on its own line to strip metadata headers
  const standAloneMatch = fullTextStr.match(STANDALONE_JUDGMENT_REGEX);
  
  if (standAloneMatch) {
    bodyText = standAloneMatch[2];
    // Strip initial judge signature patterns like "ADNAN IQBAL CHAUDHRY, J:—"
    bodyText = bodyText.replace(STRIP_JUDGE_SIGNATURE_REGEX, "");
  } else {
    // Fallback: if no standalone JUDGMENT tag is found, strip standard header labels
    bodyText = bodyText.replace(STRIP_TITLE_HEADER_REGEX, "");
  }
  
  return bodyText.replace(MULTIPLE_SPACES_REGEX, " ").trim().slice(0, 600);
}
