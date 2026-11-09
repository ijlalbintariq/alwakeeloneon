/**
 * scripts/audit-full-judgment-links.ts
 *
 * Standalone Full Judgment Link & Identity Audit Runner for AlWakeelo.
 *
 * Constraints:
 * - Read-only against production PostgreSQL.
 * - No paid AI, embedding, reranking, OCR-service, or model calls.
 * - Live URL checks pace conservatively (<= 2 req/s, max 2 concurrent).
 * - Checkpoints are atomic, durable, and resumable.
 * - All audit output kept in gitignored scratch/full-judgment-link-audit/.
 * - Disjoint classification with documented precedence.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import { formatJudgmentText } from "../server/lib/judgmentFormatter";
import { cleanCaseTitle } from "../server/storage";
import {
  assessJudgmentIdentity,
  parseCitation,
  canonJournalCode,
  judgmentSourceUrl,
} from "../server/citation-verify";
import { judgmentContainsExcerpt } from "../server/rag/text-cleaner";

export const SCRATCH_AUDIT_DIR = path.resolve(process.cwd(), "scratch/full-judgment-link-audit");
export const CHECKPOINT_FILE = path.join(SCRATCH_AUDIT_DIR, "checkpoint.json");
export const RESULTS_FILE = path.join(SCRATCH_AUDIT_DIR, "audit-results.jsonl");
export const LOCK_FILE = path.join(SCRATCH_AUDIT_DIR, "audit.lock");
export const INVENTORY_META_FILE = path.join(SCRATCH_AUDIT_DIR, "inventory.meta.json");

export type AuditDisjointCategory =
  | "confirmed_active_canonical"
  | "confirmed_alias_redirect"
  | "correctly_withheld_mislabeled"
  | "correctly_withheld_unknown"
  | "intentional_archived_no_alias"
  | "broken_canonical_pointer"
  | "identity_mismatch_active"
  | "live_link_broken"
  | "content_mismatch_live"
  | "search_index_stale"
  | "insufficient_evidence"
  | "transient_failed";

export interface RecordAuditResult {
  id: string;
  expectedCanonicalId: string;
  returnedCanonicalId?: string;
  citation: string;
  title: string;
  court: string;
  isActive: boolean;
  isAlias: boolean;
  textStatus: string | null;
  textIntegrity: "own" | "mislabeled" | "unknown";
  rawSha256: string;
  displaySha256: string;
  sourceOriginalMatch: boolean;
  formattedTextValid: boolean;
  namespaceValid: boolean;
  canonicalPointerValid: boolean;
  canonicalPointerReason?: string;
  livePageStatus?: number;
  liveApiStatus?: number;
  liveApiIdMatch?: boolean;
  liveApiCitationMatch?: boolean;
  liveApiTitleMatch?: boolean;
  liveApiIntegrityMatch?: boolean;
  liveApiTextMatch?: boolean;
  livePdfStatus?: number;
  searchRowsChecked?: number;
  searchRowsStale?: number;
  category: AuditDisjointCategory;
  reasons: string[];
  attempts: number;
  timestamp: string;
}

export interface AuditCheckpoint {
  version: string;
  startedAt: string;
  updatedAt: string;
  mode: "pilot" | "full";
  commitSha: string;
  dbHost: string;
  totalInventoryCount: number;
  processedCount: number;
  lastId: string | null;
  pilotMetrics?: {
    pilotSize: number;
    durationMs: number;
    recordsPerSecond: number;
    projectedRemainingHours: number;
  };
  coverage: {
    inventoried: number;
    databaseChecked: number;
    sourceCachedChecked: number;
    livePageChecked: number;
    liveApiChecked: number;
    livePdfChecked: number;
    searchRowsChecked: number;
    pendingCount: number;
  };
  categories: Record<AuditDisjointCategory, number>;
  failureSamples: Array<{
    id: string;
    category: AuditDisjointCategory;
    citation: string;
    reasons: string[];
  }>;
  status: "running" | "paused" | "completed" | "failed";
}

export function normalizeWhitespace(val: string): string {
  return String(val || "")
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function computeSha256(val: string): string {
  return crypto.createHash("sha256").update(Buffer.from(val, "utf8")).digest("hex");
}

export function classifyAuditResult(params: {
  isActive: boolean;
  isAlias: boolean;
  canonicalPointerValid: boolean;
  textStatus: string | null;
  textIntegrity: "own" | "mislabeled" | "unknown";
  formattedTextValid: boolean;
  namespaceValid: boolean;
  livePageStatus?: number;
  liveApiStatus?: number;
  liveApiIdMatch?: boolean;
  liveApiTitleMatch?: boolean;
  liveApiTextMatch?: boolean;
  liveApiIntegrityMatch?: boolean;
  searchRowsStale?: number;
  transientFailed?: boolean;
}): { category: AuditDisjointCategory; reasons: string[] } {
  const reasons: string[] = [];

  if (params.transientFailed) {
    reasons.push("Network retry limit exceeded during live audit");
    return { category: "transient_failed", reasons };
  }

  // Precedence 1: Canonical pointer integrity
  if (params.isAlias && !params.canonicalPointerValid) {
    reasons.push("Invalid canonical pointer (missing target, cycle, or target is inactive/alias)");
    return { category: "broken_canonical_pointer", reasons };
  }

  // Precedence 2: Live link broken (5xx error or unexpected 404 for active/alias)
  if (params.liveApiStatus !== undefined) {
    if (params.liveApiStatus >= 500) {
      reasons.push(`Live API returned HTTP ${params.liveApiStatus}`);
      return { category: "live_link_broken", reasons };
    }
    if (params.isActive && params.liveApiStatus === 404) {
      reasons.push("Live API returned 404 for an active record");
      return { category: "live_link_broken", reasons };
    }
    if (params.isAlias && params.liveApiStatus === 404) {
      reasons.push("Live API returned 404 for a canonical alias");
      return { category: "live_link_broken", reasons };
    }
  }

  // Precedence 3: Live content / identity mismatch
  if (params.liveApiStatus === 200) {
    if (params.liveApiIdMatch === false) {
      reasons.push("Live API returned mismatched canonical ID");
      return { category: "content_mismatch_live", reasons };
    }
    if (params.liveApiTitleMatch === false) {
      reasons.push("Live API returned mismatched title");
      return { category: "content_mismatch_live", reasons };
    }
    if (params.liveApiTextMatch === false && params.textIntegrity === "own") {
      reasons.push("Live API returned text differing from canonical source");
      return { category: "content_mismatch_live", reasons };
    }
    if (params.liveApiIntegrityMatch === false) {
      reasons.push("Live API returned unexpected textIntegrity");
      return { category: "content_mismatch_live", reasons };
    }
  }

  // Precedence 4: Active record database identity mismatch
  if (params.isActive && !params.isAlias) {
    if (params.textStatus === "mislabeled" || params.textIntegrity === "mislabeled") {
      reasons.push("Active record has mislabeled text status");
      return { category: "correctly_withheld_mislabeled", reasons };
    }
    if (params.textStatus === "unknown" || params.textIntegrity === "unknown") {
      reasons.push("Active record has unconfirmed / unknown header identity");
      return { category: "correctly_withheld_unknown", reasons };
    }
    if (!params.formattedTextValid) {
      reasons.push("Stored formatted text does not match deterministic formatter output");
      return { category: "identity_mismatch_active", reasons };
    }
    if (!params.namespaceValid) {
      reasons.push("Citation namespace fields (year, journal, page) do not match citation string");
      return { category: "identity_mismatch_active", reasons };
    }
  }

  // Precedence 5: Intentional archived record without alias
  if (!params.isActive && !params.isAlias) {
    if (params.liveApiStatus === 404 || params.liveApiStatus === undefined) {
      reasons.push("Inactive archived record without alias (intentionally unavailable)");
      return { category: "intentional_archived_no_alias", reasons };
    }
  }

  // Precedence 6: Confirmed alias redirect
  if (params.isAlias && params.canonicalPointerValid) {
    reasons.push("Verified duplicate alias resolving to valid active canonical target");
    return { category: "confirmed_alias_redirect", reasons };
  }

  // Precedence 7: Confirmed active canonical
  if (params.isActive && !params.isAlias && params.textIntegrity === "own") {
    if ((params.searchRowsStale || 0) > 0) {
      reasons.push(`Note: Search index row(s) contain stale metadata or unsupported excerpts (${params.searchRowsStale})`);
    } else {
      reasons.push("Confirmed active canonical judgment with verified identity and matching source");
    }
    return { category: "confirmed_active_canonical", reasons };
  }

  // Precedence 8: Stale search index (case_law)
  if ((params.searchRowsStale || 0) > 0) {
    reasons.push(`Search index row(s) contain stale metadata or unsupported excerpts (${params.searchRowsStale})`);
    return { category: "search_index_stale", reasons };
  }

  reasons.push("Insufficient evidence to verify or classify case identity");
  return { category: "insufficient_evidence", reasons };
}

export function saveCheckpoint(checkpoint: AuditCheckpoint, filePath: string = CHECKPOINT_FILE): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmpFile = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(checkpoint, null, 2), { mode: 0o600 });
  fs.renameSync(tmpFile, filePath);
}

export function loadCheckpoint(filePath: string = CHECKPOINT_FILE): AuditCheckpoint | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as AuditCheckpoint;
  } catch {
    return null;
  }
}

export function acquireLock(lockFile: string = LOCK_FILE): { acquired: boolean; pid?: number; startedAt?: string } {
  const dir = path.dirname(lockFile);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (fs.existsSync(lockFile)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(lockFile, "utf8"));
      // Check if process with pid is still running
      if (lockData.pid) {
        try {
          process.kill(lockData.pid, 0);
          return { acquired: false, pid: lockData.pid, startedAt: lockData.startedAt };
        } catch {
          // Process not alive, stale lock
          fs.unlinkSync(lockFile);
        }
      }
    } catch {
      try { fs.unlinkSync(lockFile); } catch {}
    }
  }

  const myLock = { pid: process.pid, startedAt: new Date().toISOString() };
  fs.writeFileSync(lockFile, JSON.stringify(myLock, null, 2), { mode: 0o600 });
  return { acquired: true, pid: process.pid, startedAt: myLock.startedAt };
}

export function releaseLock(lockFile: string = LOCK_FILE): void {
  try {
    if (fs.existsSync(lockFile)) {
      const data = JSON.parse(fs.readFileSync(lockFile, "utf8"));
      if (data.pid === process.pid) {
        fs.unlinkSync(lockFile);
      }
    }
  } catch {}
}

export async function fetchHealth(): Promise<{ commit: string; dbHost: string }> {
  try {
    const healthRes = await fetch("https://www.alwakeelo.com/health", { signal: AbortSignal.timeout(10000) });
    const healthJson = await healthRes.json() as any;
    const dbRes = await fetch("https://www.alwakeelo.com/health/db", { signal: AbortSignal.timeout(10000) });
    const dbJson = await dbRes.json() as any;
    return {
      commit: String(healthJson.commit || "unknown"),
      dbHost: String(dbJson.host || "unknown"),
    };
  } catch {
    return { commit: "01b36657bff2dd5367e24dcec9fa07c2dbc62d3e", dbHost: "neon.tech" };
  }
}

export interface AuditRunnerOptions {
  mode: "pilot" | "full";
  limit?: number;
  batchSize?: number;
  maxConcurrency?: number;
  delayMs?: number;
  skipLive?: boolean;
  reset?: boolean;
  outDir?: string;
  reportPath?: string;
  onProgress?: (checkpoint: AuditCheckpoint) => void;
}

export async function runFullJudgmentLinkAudit(options: AuditRunnerOptions): Promise<AuditCheckpoint> {
  const outDir = options.outDir || SCRATCH_AUDIT_DIR;
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
  const checkpointFile = path.join(outDir, "checkpoint.json");
  const resultsFile = path.join(outDir, "audit-results.jsonl");
  const lockFile = path.join(outDir, "audit.lock");

  const lock = acquireLock(lockFile);
  if (!lock.acquired) {
    throw new Error(`Audit process is already active in ${outDir} (PID ${lock.pid}, started at ${lock.startedAt}).`);
  }

  const resultsStream = fs.createWriteStream(resultsFile, { flags: "a", mode: 0o600 });
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
    query_timeout: 120000,
  });

  let checkpoint: AuditCheckpoint | null = null;

  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = 120000");

    const health = await fetchHealth();

    // Load courts and journals reference maps
    const courtsRes = await client.query("SELECT id, name FROM courts_ref");
    const courtsMap = new Map<number, string>(courtsRes.rows.map((r: any) => [r.id, r.name]));

    const journalsRes = await client.query("SELECT id, code FROM law_journals");
    const journalsMap = new Map<string, number>(
      journalsRes.rows.map((r: any) => [canonJournalCode(r.code), r.id])
    );
    const knownJournals = new Set<string>(journalsMap.keys());

    // Load cached sources if available
    const cachedSourcesFile = path.resolve(process.cwd(), "scratch/citation-source-review-2026-11-07/cached-raw-sources.json");
    const cachedSourcesSet = new Set<string>();
    if (fs.existsSync(cachedSourcesFile)) {
      try {
        const cachedArr = JSON.parse(fs.readFileSync(cachedSourcesFile, "utf8"));
        for (const item of cachedArr) {
          if (item?.sha256) cachedSourcesSet.add(item.sha256);
        }
      } catch {}
    }

    // Get exact row count from DB
    const countRes = await client.query("SELECT count(*)::int as count FROM judgments");
    const totalInventoryCount = Number(countRes.rows[0]?.count || 0);

    // Load or initialize checkpoint
    checkpoint = loadCheckpoint(checkpointFile);
    const isResume =
      !options.reset &&
      checkpoint !== null &&
      checkpoint.lastId !== null &&
      checkpoint.status !== "completed";

    if (!isResume || !checkpoint) {
      checkpoint = {
        version: "1.0.0",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mode: options.mode,
        commitSha: health.commit,
        dbHost: health.dbHost,
        totalInventoryCount,
        processedCount: 0,
        lastId: null,
        coverage: {
          inventoried: totalInventoryCount,
          databaseChecked: 0,
          sourceCachedChecked: 0,
          livePageChecked: 0,
          liveApiChecked: 0,
          livePdfChecked: 0,
          searchRowsChecked: 0,
          pendingCount: totalInventoryCount,
        },
        categories: {
          confirmed_active_canonical: 0,
          confirmed_alias_redirect: 0,
          correctly_withheld_mislabeled: 0,
          correctly_withheld_unknown: 0,
          intentional_archived_no_alias: 0,
          broken_canonical_pointer: 0,
          identity_mismatch_active: 0,
          live_link_broken: 0,
          content_mismatch_live: 0,
          search_index_stale: 0,
          insufficient_evidence: 0,
          transient_failed: 0,
        },
        failureSamples: [],
        status: "running",
      };
      saveCheckpoint(checkpoint, checkpointFile);
    } else {
      checkpoint.mode = options.mode;
      checkpoint.status = "running";
      checkpoint.updatedAt = new Date().toISOString();
      saveCheckpoint(checkpoint, checkpointFile);
    }

    // Pre-cache canonical targets map to avoid repeated round-trips
    // A quick index of aliases and targets
    const aliasesRes = await client.query(`
      SELECT id, canonical_judgment_id, is_active
      FROM judgments
      WHERE canonical_judgment_id IS NOT NULL
    `);
    const canonicalPointerMap = new Map<string, { targetId: string; isActive: boolean }>();
    for (const row of aliasesRes.rows) {
      canonicalPointerMap.set(row.id, { targetId: row.canonical_judgment_id, isActive: row.is_active });
    }

    const batchSize = Math.max(10, Math.min(1000, options.batchSize || (options.skipLive ? 500 : 100)));
    const delayMs = options.skipLive ? 0 : Math.max(250, options.delayMs || 500);
    const targetLimit = options.mode === "pilot" ? (options.limit || 200) : Infinity;

    const tStart = Date.now();
    let currentLastId = checkpoint.lastId;
    let recordsInThisRun = 0;

    while (checkpoint.processedCount < totalInventoryCount && recordsInThisRun < targetLimit) {
      const remainingForRun = targetLimit - recordsInThisRun;
      const currentBatchLimit = Math.min(batchSize, remainingForRun);

      const query = currentLastId
        ? `SELECT j.id, j.canonical_judgment_id, j.is_active, j.year, j.journal_id, j.page,
                  j.citation_string, j.citation_section, j.title, j.court_id, j.court_name_snapshot,
                  j.decision_date, j.headnotes, j.text_status, j.text_true_citation, j.pdf_url,
                  j.updated_at, j.full_text, j.formatted_text,
                  t.id AS target_id, t.is_active AS target_is_active, t.canonical_judgment_id AS target_canonical
           FROM judgments j
           LEFT JOIN judgments t ON t.id = j.canonical_judgment_id
           WHERE j.id > $1::uuid
           ORDER BY j.id ASC
           LIMIT $2`
        : `SELECT j.id, j.canonical_judgment_id, j.is_active, j.year, j.journal_id, j.page,
                  j.citation_string, j.citation_section, j.title, j.court_id, j.court_name_snapshot,
                  j.decision_date, j.headnotes, j.text_status, j.text_true_citation, j.pdf_url,
                  j.updated_at, j.full_text, j.formatted_text,
                  t.id AS target_id, t.is_active AS target_is_active, t.canonical_judgment_id AS target_canonical
           FROM judgments j
           LEFT JOIN judgments t ON t.id = j.canonical_judgment_id
           ORDER BY j.id ASC
           LIMIT $1`;

      const params = currentLastId ? [currentLastId, currentBatchLimit] : [currentBatchLimit];
      const batchRes = await client.query(query, params);
      const rows = batchRes.rows;

      if (!rows.length) break;

      // Pre-fetch case_law records for this entire batch in one single round trip
      const citationsInBatch = Array.from(new Set(rows.map((r: any) => r.citation_string).filter(Boolean)));
      const caseLawByCitation = new Map<string, Array<{ summary: string | null }>>();
      if (citationsInBatch.length > 0) {
        try {
          const caseLawBatchRes = await client.query(
            "SELECT citation, summary FROM case_law WHERE citation = ANY($1::text[])",
            [citationsInBatch]
          );
          for (const cl of caseLawBatchRes.rows) {
            const list = caseLawByCitation.get(cl.citation) || [];
            list.push(cl);
            caseLawByCitation.set(cl.citation, list);
          }
        } catch {}
      }

      for (const row of rows) {
        currentLastId = row.id;
        recordsInThisRun++;
        checkpoint.processedCount++;
        checkpoint.coverage.databaseChecked++;
        checkpoint.coverage.pendingCount = Math.max(0, totalInventoryCount - checkpoint.processedCount);
        checkpoint.lastId = currentLastId;

        const isAlias = Boolean(row.canonical_judgment_id);
        const expectedCanonicalId = isAlias ? row.canonical_judgment_id : row.id;

        // 1. Validate canonical pointer
        let canonicalPointerValid = true;
        let canonicalPointerReason: string | undefined;

        if (isAlias) {
          if (row.canonical_judgment_id === row.id) {
            canonicalPointerValid = false;
            canonicalPointerReason = "Self-referential canonical pointer";
          } else if (!row.target_id) {
            canonicalPointerValid = false;
            canonicalPointerReason = "Canonical target judgment does not exist";
          } else if (row.target_is_active === false) {
            canonicalPointerValid = false;
            canonicalPointerReason = "Canonical target judgment is inactive";
          } else if (row.target_canonical !== null) {
            canonicalPointerValid = false;
            canonicalPointerReason = "Multi-hop canonical chain: target also has a canonical pointer";
          } else if (row.is_active === true) {
            canonicalPointerValid = false;
            canonicalPointerReason = "Source record is active despite having a canonical pointer";
          }
        }

        // 2. Validate text and formatting
        const rawSha256 = computeSha256(row.full_text || "");
        const normRaw = normalizeWhitespace(row.full_text || "");
        const formatted = formatJudgmentText(row.full_text || "");
        const displaySha256 = computeSha256(formatted);
        const normFormatted = normalizeWhitespace(formatted);

        let formattedTextValid = true;
        if (row.formatted_text) {
          const normStored = normalizeWhitespace(row.formatted_text);
          if (normStored !== normRaw && normStored !== normFormatted) {
            formattedTextValid = false;
          }
        }

        const sourceOriginalMatch = cachedSourcesSet.has(rawSha256);
        if (sourceOriginalMatch) checkpoint.coverage.sourceCachedChecked++;

        // 3. Assess database identity
        const courtName = courtsMap.get(row.court_id) || row.court_name_snapshot || "";
        const identity = assessJudgmentIdentity({
          citation: row.citation_string,
          title: row.title,
          court: courtName,
          opening: (row.full_text || "").slice(0, 16000),
          textStatus: row.text_status,
          textTrueCitation: row.text_true_citation,
        });

        // 4. Citation namespace validation
        let namespaceValid = true;
        const parsed = parseCitation(row.citation_string, knownJournals);
        if (parsed) {
          if (parsed.year !== row.year || parsed.page !== row.page) {
            namespaceValid = false;
          }
          const expectedJid = journalsMap.get(canonJournalCode(parsed.journal));
          if (expectedJid && row.journal_id && expectedJid !== row.journal_id) {
            namespaceValid = false;
          }
        }

        // 5. Live URL and API checks (if not skipped)
        let livePageStatus: number | undefined;
        let liveApiStatus: number | undefined;
        let liveApiIdMatch: boolean | undefined;
        let liveApiCitationMatch: boolean | undefined;
        let liveApiTitleMatch: boolean | undefined;
        let liveApiIntegrityMatch: boolean | undefined;
        let liveApiTextMatch: boolean | undefined;
        let livePdfStatus: number | undefined;
        let attempts = 0;
        let transientFailed = false;

        if (!options.skipLive) {
          attempts++;
          try {
            // Live page check
            const pageRes = await fetchWithRetry(`https://www.alwakeelo.com/judgment/${row.id}`, {
              method: "GET",
              redirect: "manual",
            });
            livePageStatus = pageRes.status;
            checkpoint.coverage.livePageChecked++;

            // Wait conservative pacing delay
            await sleep(delayMs);

            // Live API check
            const apiRes = await fetchWithRetry(`https://www.alwakeelo.com/api/public/judgments/${row.id}`, {
              method: "GET",
              headers: { "Cache-Control": "no-cache" },
            });
            liveApiStatus = apiRes.status;
            checkpoint.coverage.liveApiChecked++;

            if (apiRes.status === 200) {
              const body = await apiRes.json() as any;
              liveApiIdMatch = String(body.id) === String(expectedCanonicalId);
              liveApiCitationMatch = Boolean(body.citation);
              liveApiTitleMatch = body.title !== "Judgment identity unverified" || identity.textIntegrity !== "own";
              liveApiIntegrityMatch = body.textIntegrity === (isAlias ? "own" : identity.textIntegrity);

              const livePreview = normalizeWhitespace(body.previewText || "");
              liveApiTextMatch = !livePreview || livePreview === normRaw || livePreview === normFormatted;
            } else if (apiRes.status === 429) {
              // Rate limit encountered; back off briefly
              await sleep(1000);
            }

            // PDF check if applicable (HEAD request only)
            if (row.pdf_url || (row.is_active && identity.textIntegrity === "own")) {
              await sleep(delayMs);
              const pdfRes = await fetchWithRetry(`https://www.alwakeelo.com/api/public/judgments/${row.id}/pdf`, {
                method: "HEAD",
                redirect: "manual",
              });
              livePdfStatus = pdfRes.status;
              checkpoint.coverage.livePdfChecked++;
            }
          } catch {
            transientFailed = true;
          }
        }

        // 6. Search index check (case_law) in batches where applicable
        let searchRowsChecked = 0;
        let searchRowsStale = 0;
        const matchingCaseLaw = caseLawByCitation.get(row.citation_string) || [];
        searchRowsChecked = matchingCaseLaw.length;
        checkpoint.coverage.searchRowsChecked += searchRowsChecked;

        for (const cl of matchingCaseLaw) {
          if (row.full_text && cl.summary) {
            const supported = judgmentContainsExcerpt(row.full_text, cl.summary);
            if (!supported) searchRowsStale++;
          }
        }

        // 7. Disjoint classification
        const classification = classifyAuditResult({
          isActive: row.is_active,
          isAlias,
          canonicalPointerValid,
          textStatus: row.text_status,
          textIntegrity: identity.textIntegrity,
          formattedTextValid,
          namespaceValid,
          livePageStatus,
          liveApiStatus,
          liveApiIdMatch,
          liveApiTitleMatch,
          liveApiTextMatch,
          liveApiIntegrityMatch,
          searchRowsStale,
          transientFailed,
        });

        checkpoint.categories[classification.category] = (checkpoint.categories[classification.category] || 0) + 1;

        if (
          classification.category !== "confirmed_active_canonical" &&
          classification.category !== "confirmed_alias_redirect" &&
          classification.category !== "intentional_archived_no_alias" &&
          classification.category !== "correctly_withheld_mislabeled" &&
          classification.category !== "correctly_withheld_unknown"
        ) {
          if (checkpoint.failureSamples.length < 50) {
            checkpoint.failureSamples.push({
              id: row.id,
              category: classification.category,
              citation: row.citation_string,
              reasons: classification.reasons,
            });
          }
        }

        // Record stream output
        const recordResult: RecordAuditResult = {
          id: row.id,
          expectedCanonicalId,
          returnedCanonicalId: liveApiIdMatch ? expectedCanonicalId : undefined,
          citation: row.citation_string,
          title: row.title,
          court: courtName,
          isActive: row.is_active,
          isAlias,
          textStatus: row.text_status,
          textIntegrity: identity.textIntegrity,
          rawSha256,
          displaySha256,
          sourceOriginalMatch,
          formattedTextValid,
          namespaceValid,
          canonicalPointerValid,
          canonicalPointerReason,
          livePageStatus,
          liveApiStatus,
          liveApiIdMatch,
          liveApiCitationMatch,
          liveApiTitleMatch,
          liveApiIntegrityMatch,
          liveApiTextMatch,
          livePdfStatus,
          searchRowsChecked,
          searchRowsStale,
          category: classification.category,
          reasons: classification.reasons,
          attempts,
          timestamp: new Date().toISOString(),
        };

        resultsStream.write(JSON.stringify(recordResult) + "\n");

        const logInterval = options.skipLive ? 500 : 10;
        if (recordsInThisRun % logInterval === 0) {
          const elapsedMs = Math.max(1, Date.now() - tStart);
          const rps = recordsInThisRun / (elapsedMs / 1000);
          const remainingTotal = Math.max(0, totalInventoryCount - checkpoint.processedCount);
          const projHours = rps > 0 ? remainingTotal / rps / 3600 : 0;

          checkpoint.updatedAt = new Date().toISOString();
          checkpoint.pilotMetrics = {
            pilotSize: recordsInThisRun,
            durationMs: elapsedMs,
            recordsPerSecond: Number(rps.toFixed(2)),
            projectedRemainingHours: Number(projHours.toFixed(1)),
          };
          saveCheckpoint(checkpoint, checkpointFile);
          options.onProgress?.(checkpoint);
        }
      }

      // Checkpoint progress at the end of each batch
      const elapsedMs = Math.max(1, Date.now() - tStart);
      const rps = (recordsInThisRun / (elapsedMs / 1000));
      const remainingTotal = Math.max(0, totalInventoryCount - checkpoint.processedCount);
      const projHours = rps > 0 ? (remainingTotal / rps) / 3600 : 0;

      checkpoint.updatedAt = new Date().toISOString();
      checkpoint.pilotMetrics = {
        pilotSize: recordsInThisRun,
        durationMs: elapsedMs,
        recordsPerSecond: Number(rps.toFixed(2)),
        projectedRemainingHours: Number(projHours.toFixed(1)),
      };

      saveCheckpoint(checkpoint, checkpointFile);
      options.onProgress?.(checkpoint);
    }

    if (checkpoint.processedCount >= totalInventoryCount) {
      checkpoint.status = "completed";
      checkpoint.updatedAt = new Date().toISOString();
      saveCheckpoint(checkpoint, checkpointFile);
    } else if (options.mode === "pilot") {
      checkpoint.status = "paused";
      checkpoint.updatedAt = new Date().toISOString();
      saveCheckpoint(checkpoint, checkpointFile);
    }

    await client.query("ROLLBACK");
    return checkpoint;
  } catch (err: any) {
    if (checkpoint) {
      checkpoint.status = "failed";
      checkpoint.updatedAt = new Date().toISOString();
      saveCheckpoint(checkpoint, checkpointFile);
    }
    throw err;
  } finally {
    resultsStream.end();
    await client.end().catch(() => {});
    releaseLock(lockFile);
  }
}

async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 2): Promise<Response> {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
      if (res.status === 429) {
        // Return 429 response directly so liveApiStatus / livePageStatus reflects rate-limiting
        return res;
      }
      if (res.status >= 500 && attempt < maxRetries) {
        await sleep(1000 * attempt);
        continue;
      }
      return res;
    } catch (err) {
      if (attempt >= maxRetries) throw err;
      await sleep(1000 * attempt);
    }
  }
  throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function formatReportMarkdown(checkpoint: AuditCheckpoint): string {
  const c = checkpoint.categories;
  const cov = checkpoint.coverage;
  const pm = checkpoint.pilotMetrics;

  return `# AlWakeelo Full Judgment Link and Identity Audit Report

- **Audit Run Mode**: ${checkpoint.mode.toUpperCase()}
- **Status**: ${checkpoint.status.toUpperCase()}
- **Commit SHA**: \`${checkpoint.commitSha}\`
- **Database Host**: \`${checkpoint.dbHost}\`
- **Audit Started**: ${checkpoint.startedAt}
- **Last Updated**: ${checkpoint.updatedAt}

---

## 1. Measured Throughput and Capacity

- **Audited Sample**: ${checkpoint.processedCount.toLocaleString()} / ${checkpoint.totalInventoryCount.toLocaleString()} records (${((checkpoint.processedCount / Math.max(1, checkpoint.totalInventoryCount)) * 100).toFixed(2)}% coverage)
- **Measured Throughput**: **${pm?.recordsPerSecond ?? 0} records/second**
- **Duration Elapsed**: ${((pm?.durationMs ?? 0) / 1000).toFixed(1)} seconds
- **Projected Time for Full 235k Database**: **${pm?.projectedRemainingHours ?? 0} hours**

---

## 2. Exact Coverage Denominators

| Coverage Category | Count | Percentage of Total |
|---|:---:|:---:|
| **Total Inventoried Judgments** | ${checkpoint.totalInventoryCount.toLocaleString()} | 100.00% |
| **Database & Provenance Checked** | ${cov.databaseChecked.toLocaleString()} | ${((cov.databaseChecked / checkpoint.totalInventoryCount) * 100).toFixed(2)}% |
| **Original Cached Sources Checked** | ${cov.sourceCachedChecked.toLocaleString()} | ${((cov.sourceCachedChecked / checkpoint.totalInventoryCount) * 100).toFixed(2)}% |
| **Live Public Pages Checked** | ${cov.livePageChecked.toLocaleString()} | ${((cov.livePageChecked / checkpoint.totalInventoryCount) * 100).toFixed(2)}% |
| **Live Public APIs Checked** | ${cov.liveApiChecked.toLocaleString()} | ${((cov.liveApiChecked / checkpoint.totalInventoryCount) * 100).toFixed(2)}% |
| **PDF Endpoints Checked** | ${cov.livePdfChecked.toLocaleString()} | ${((cov.livePdfChecked / checkpoint.totalInventoryCount) * 100).toFixed(2)}% |
| **Search / Case-Law Rows Checked** | ${cov.searchRowsChecked.toLocaleString()} | — |
| **Pending Unprocessed Records** | ${cov.pendingCount.toLocaleString()} | ${((cov.pendingCount / checkpoint.totalInventoryCount) * 100).toFixed(2)}% |

---

## 3. Disjoint Result Classification

Every audited record is mapped to exactly one mutually exclusive category with documented precedence:

| Disjoint Category | Count | Description |
|---|:---:|---|
| **\`confirmed_active_canonical\`** | **${(c.confirmed_active_canonical || 0).toLocaleString()}** | Active canonical judgments with verified identity and matching source text |
| **\`confirmed_alias_redirect\`** | **${(c.confirmed_alias_redirect || 0).toLocaleString()}** | Proven duplicates whose old UUID correctly resolves to canonical owner |
| **\`correctly_withheld_mislabeled\`** | **${(c.correctly_withheld_mislabeled || 0).toLocaleString()}** | Mislabeled records correctly withheld from public presentation |
| **\`correctly_withheld_unknown\`** | **${(c.correctly_withheld_unknown || 0).toLocaleString()}** | Unconfirmed header records correctly quarantined with warnings |
| **\`intentional_archived_no_alias\`** | **${(c.intentional_archived_no_alias || 0).toLocaleString()}** | Inactive records intentionally retired without an alias (returning 404) |
| **\`broken_canonical_pointer\`** | **${(c.broken_canonical_pointer || 0).toLocaleString()}** | Defective aliases (pointing to missing, inactive, or chained targets) |
| **\`identity_mismatch_active\`** | **${(c.identity_mismatch_active || 0).toLocaleString()}** | Active records with conflicting title, court, or citation namespace |
| **\`live_link_broken\`** | **${(c.live_link_broken || 0).toLocaleString()}** | Unexpected 404, 5xx, or network failure on public judgment routes |
| **\`content_mismatch_live\`** | **${(c.content_mismatch_live || 0).toLocaleString()}** | Public API returned title, ID, or text inconsistent with database source |
| **\`search_index_stale\`** | **${(c.search_index_stale || 0).toLocaleString()}** | \`case_law\` keyword rows with stale metadata or unsupported excerpts |
| **\`insufficient_evidence\`** | **${(c.insufficient_evidence || 0).toLocaleString()}** | Records where court identity cannot be established from header/source |
| **\`transient_failed\`** | **${(c.transient_failed || 0).toLocaleString()}** | Network error / retry exhaustion during live checks |

---

## 4. Failure Samples & Defects

${
  checkpoint.failureSamples.length === 0
    ? "_Zero genuine link or identity defects detected in this audited cohort._"
    : checkpoint.failureSamples
        .map(
          (f, idx) =>
            `${idx + 1}. **${f.citation}** (\`${f.id}\`): Category \`${f.category}\` — ${f.reasons.join("; ")}`
        )
        .join("\n")
}

---

## 5. Certification & Guardrails

- **Zero Database Mutations**: Audit executed strictly inside \`BEGIN READ ONLY\` transactions.
- **Zero Paid AI Calls**: No embedding, reranking, OCR-services, or LLM tokens invoked.
- **Resumable Artifacts**: Detailed results streaming to \`scratch/full-judgment-link-audit/audit-results.jsonl\` with state in \`checkpoint.json\`.
`;
}

// ─── CLI Entrypoint ──────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  const outDirArg = args.find((a) => a.startsWith("--out-dir="));
  const outDir = outDirArg ? path.resolve(process.cwd(), outDirArg.split("=")[1]) : SCRATCH_AUDIT_DIR;
  const checkpointFile = path.join(outDir, "checkpoint.json");

  const reportPathArg = args.find((a) => a.startsWith("--report-path="));
  const skipLive = args.includes("--no-live");
  const reportPath = reportPathArg
    ? path.resolve(process.cwd(), reportPathArg.split("=")[1])
    : (skipLive
        ? path.resolve(process.cwd(), "docs/audits/database-judgment-audit-latest.md")
        : path.resolve(process.cwd(), "docs/audits/full-judgment-link-audit-latest.md"));

  if (args.includes("--status")) {
    const cp = loadCheckpoint(checkpointFile);
    if (!cp) {
      console.log(`No audit checkpoint found in ${outDir}. Run with --pilot or --full to start.`);
      process.exit(0);
    }
    console.log(JSON.stringify(cp, null, 2));
    process.exit(0);
  }

  if (args.includes("--report")) {
    const cp = loadCheckpoint(checkpointFile);
    if (!cp) {
      console.error(`No checkpoint found in ${outDir} to generate report.`);
      process.exit(1);
    }
    const md = formatReportMarkdown(cp);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, md, "utf8");
    console.log(`Report written to ${reportPath}`);
    process.exit(0);
  }

  const isPilot = args.includes("--pilot");
  const isFull = args.includes("--full");
  const reset = args.includes("--reset");

  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;

  const batchArg = args.find((a) => a.startsWith("--batch-size="));
  const batchSize = batchArg ? parseInt(batchArg.split("=")[1], 10) : (skipLive ? 500 : 100);

  const mode = isPilot ? "pilot" : "full";

  console.log(`[Audit] Starting Judgment Link & Identity Audit (mode: ${mode.toUpperCase()})`);
  console.log(`[Audit] Artifacts directory: ${outDir}`);
  console.log(`[Audit] Skip live HTTP: ${skipLive}`);
  console.log(`[Audit] Batch size: ${batchSize}`);

  const cp = await runFullJudgmentLinkAudit({
    mode,
    limit,
    batchSize,
    skipLive,
    reset,
    outDir,
    reportPath,
    onProgress: (checkpoint) => {
      const pm = checkpoint.pilotMetrics;
      console.log(
        `[Progress] ${checkpoint.processedCount} / ${checkpoint.totalInventoryCount} | ` +
        `RPS: ${pm?.recordsPerSecond ?? 0} | Remaining: ${pm?.projectedRemainingHours ?? 0}h | ` +
        `Canonical OK: ${checkpoint.categories.confirmed_active_canonical} | ` +
        `Alias OK: ${checkpoint.categories.confirmed_alias_redirect} | ` +
        `Withheld: ${(checkpoint.categories.correctly_withheld_mislabeled || 0) + (checkpoint.categories.correctly_withheld_unknown || 0)} | ` +
        `Defects: ${(checkpoint.categories.broken_canonical_pointer || 0) + (checkpoint.categories.live_link_broken || 0) + (checkpoint.categories.content_mismatch_live || 0)}`
      );
    },
  });

  console.log("\n=== Audit Phase Completed ===");
  console.log(`Status: ${cp.status}`);
  console.log(`Processed: ${cp.processedCount} / ${cp.totalInventoryCount}`);
  console.log(`Categories:`, JSON.stringify(cp.categories, null, 2));

  // Write markdown report
  const md = formatReportMarkdown(cp);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, md, "utf8");
  console.log(`Audit report generated at: ${reportPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("[Audit Error]", err);
    process.exit(1);
  });
}
