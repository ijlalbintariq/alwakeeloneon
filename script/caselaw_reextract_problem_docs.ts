import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, dbAvailable, dbUnavailableReason, pool } from "../server/db";
import { nlpExtractCases } from "../server/auto-extract-caselaw";
import { storage } from "../server/storage";
import { caseLaw, documents } from "../shared/schema";

type SourceKind = "admin" | "github" | "statute" | "user" | "all";

type ProblemDocRow = {
  source_type: string;
  source_doc_id: string | number;
  source_filename: string | null;
  total_rows: string | number;
  primary_rows: string | number;
  cited_rows: string | number;
  unique_keys: string | number;
  duplicate_rows: string | number;
};

type SourceContent = {
  content: string;
  filename: string;
};

type ExtractedCase = {
  citation: string;
  citationRole: "primary" | "cited";
  court: string;
  title: string;
  summary: string;
  keywords: string[];
};

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function argValue(name: string): string | null {
  const arg = process.argv.find((token) => token.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}

function toNumber(value: string | number | null | undefined, fallback: number = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: T[] } | null)?.rows;
  return Array.isArray(rows) ? rows : [];
}

function normalizeCaseLawCitationReport(token: string): string {
  return String(token || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

const CASELAW_REPORT_CODES = new Set([
  "PLD", "SCMR", "YLR", "MLD", "CLC", "PCRLJ", "PLJ", "PLC", "NLR",
  "PSC", "ALD", "KLR", "PTD", "PTCL", "PLS", "GBLR", "CLD", "TAX", "SLR",
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
    const report = extractKnownCaseLawReport(yearFirst[2]) || normalizeCaseLawCitationReport(yearFirst[2]);
    const page = Number(yearFirst[3]);
    if (Number.isInteger(year) && Number.isInteger(page) && page > 0 && report) {
      return { year, report, page };
    }
  }

  const reportFirst =
    normalized.match(/\b([A-Za-z][A-Za-z0-9.]{0,12}(?:\s+[A-Za-z][A-Za-z0-9.]{0,12}){0,4})\s+((?:19|20)\d{2})\s+(\d{1,6})\b/i);
  if (!reportFirst) return null;
  const report = extractKnownCaseLawReport(reportFirst[1]) || normalizeCaseLawCitationReport(reportFirst[1]);
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

function normalizeExtractedCase(row: ExtractedCase): ExtractedCase | null {
  const citation = String(row.citation || "").trim();
  if (!citation) return null;
  const title = String(row.title || "").trim();
  if (!title) return null;
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

function capExtractedCases(rows: ExtractedCase[], maxTotal: number): ExtractedCase[] {
  const safeMax = Math.max(1, maxTotal);
  const deduped: ExtractedCase[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const normalized = normalizeExtractedCase(row);
    if (!normalized) continue;
    const key = buildCaseLawDedupKey({
      citation: normalized.citation,
    });
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

async function loadSourceContent(sourceType: Exclude<SourceKind, "all">, sourceDocId: number): Promise<SourceContent | null> {
  if (sourceType === "admin") {
    const doc = await storage.getAdminKnowledgeById(sourceDocId);
    if (!doc) return null;
    return { content: String(doc.content || ""), filename: String(doc.filename || `admin-${sourceDocId}.md`) };
  }
  if (sourceType === "github") {
    const doc = await storage.getGithubKnowledgeById(sourceDocId);
    if (!doc) return null;
    return { content: String(doc.content || ""), filename: String(doc.filename || `github-${sourceDocId}.md`) };
  }
  if (sourceType === "statute") {
    const doc = await storage.getStatuteDocument(sourceDocId);
    if (!doc) return null;
    return { content: String(doc.content || ""), filename: String(doc.filename || `statute-${sourceDocId}.md`) };
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

async function loadProblemDocs(
  sourceKind: SourceKind,
  minRows: number,
  limit: number,
): Promise<Array<{
  sourceType: Exclude<SourceKind, "all">;
  sourceDocId: number;
  sourceFilename: string;
  totalRows: number;
  primaryRows: number;
  citedRows: number;
  uniqueKeys: number;
  duplicateRows: number;
}>> {
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

  const rows = getRows<ProblemDocRow>(result);
  return rows
    .map((row) => ({
      sourceType: String(row.source_type) as Exclude<SourceKind, "all">,
      sourceDocId: toNumber(row.source_doc_id),
      sourceFilename: String(row.source_filename || "").trim(),
      totalRows: toNumber(row.total_rows),
      primaryRows: toNumber(row.primary_rows),
      citedRows: toNumber(row.cited_rows),
      uniqueKeys: toNumber(row.unique_keys),
      duplicateRows: toNumber(row.duplicate_rows),
    }))
    .filter((row) =>
      ["admin", "github", "statute", "user"].includes(row.sourceType)
      && Number.isInteger(row.sourceDocId)
      && row.sourceDocId > 0,
    );
}

async function main(): Promise<void> {
  const apply = hasFlag("--apply");
  const sourceRaw = String(argValue("--source") || "admin").toLowerCase();
  const minRows = Math.max(5, toNumber(argValue("--min-rows"), 60));
  const limit = Math.max(1, Math.min(1000, toNumber(argValue("--limit"), 100)));
  const maxCitations = Math.max(1, Math.min(200, toNumber(argValue("--max-citations"), 40)));
  const sourceKind = (["admin", "github", "statute", "user", "all"].includes(sourceRaw)
    ? sourceRaw
    : "admin") as SourceKind;

  if (!dbAvailable) {
    throw new Error(`Database unavailable: ${dbUnavailableReason || "unknown reason"}`);
  }

  console.log(
    `[CaseLaw][reextract] mode=${apply ? "apply" : "dry-run"} source=${sourceKind} minRows=${minRows} limit=${limit} maxCitations=${maxCitations}`,
  );

  const targets = await loadProblemDocs(sourceKind, minRows, limit);
  if (targets.length === 0) {
    console.log("[CaseLaw][reextract] No problematic source documents found.");
    return;
  }

  console.log(`[CaseLaw][reextract] targets=${targets.length}`);
  targets.slice(0, 50).forEach((row, idx) => {
    console.log(
      `[CaseLaw][reextract][target ${idx + 1}] source=${row.sourceType}:${row.sourceDocId} rows=${row.totalRows} primary=${row.primaryRows} cited=${row.citedRows} unique=${row.uniqueKeys} duplicate=${row.duplicateRows} file="${row.sourceFilename}"`,
    );
  });
  if (targets.length > 50) {
    console.log(`[CaseLaw][reextract] ...and ${targets.length - 50} more targets`);
  }

  if (!apply) {
    console.log("[CaseLaw][reextract] Dry-run complete. Re-run with --apply to execute controlled re-extraction.");
    return;
  }

  let processed = 0;
  let skippedNoSource = 0;
  let skippedNoExtract = 0;
  let deletedRows = 0;
  let insertedCandidates = 0;

  for (const target of targets) {
    processed += 1;
    const source = await loadSourceContent(target.sourceType, target.sourceDocId);
    if (!source || !source.content || source.content.trim().length < 200) {
      skippedNoSource += 1;
      continue;
    }

    const extractedRaw = nlpExtractCases(source.content, { sourceFilename: source.filename }) as ExtractedCase[];
    const extracted = capExtractedCases(extractedRaw, maxCitations);
    if (extracted.length === 0) {
      skippedNoExtract += 1;
      continue;
    }

    const desiredByKey = new Map<string, ExtractedCase>();
    for (const row of extracted) {
      const key = buildCaseLawDedupKey({ citation: row.citation });
      if (key && !desiredByKey.has(key)) {
        desiredByKey.set(key, row);
      }
    }
    if (desiredByKey.size === 0) {
      skippedNoExtract += 1;
      continue;
    }

    const existingRows = await db.select({
      id: caseLaw.id,
      citation: caseLaw.citation,
      citationYear: caseLaw.citationYear,
      citationReport: caseLaw.citationReport,
      citationPage: caseLaw.citationPage,
      citationRole: caseLaw.citationRole,
    })
      .from(caseLaw)
      .where(and(eq(caseLaw.sourceDocId, target.sourceDocId), eq(caseLaw.sourceType, target.sourceType)))
      .orderBy(desc(caseLaw.id));

    const keepRowIdByKey = new Map<string, number>();
    for (const row of existingRows) {
      const key = buildCaseLawDedupKey({
        citation: row.citation,
        citationYear: row.citationYear,
        citationReport: row.citationReport,
        citationPage: row.citationPage,
      });
      if (!desiredByKey.has(key)) continue;
      if (!keepRowIdByKey.has(key)) {
        keepRowIdByKey.set(key, row.id);
      }
    }

    const staleIds: number[] = [];
    for (const row of existingRows) {
      const key = buildCaseLawDedupKey({
        citation: row.citation,
        citationYear: row.citationYear,
        citationReport: row.citationReport,
        citationPage: row.citationPage,
      });
      const keepId = keepRowIdByKey.get(key);
      if (!desiredByKey.has(key) || keepId !== row.id) {
        staleIds.push(row.id);
      }
    }
    if (staleIds.length > 0) {
      deletedRows += staleIds.length;
      await db.delete(caseLaw).where(inArray(caseLaw.id, staleIds));
    }

    const existingKeys = new Set<string>(Array.from(keepRowIdByKey.keys()));
    for (const [key, row] of desiredByKey.entries()) {
      if (existingKeys.has(key)) continue;
      insertedCandidates += 1;
      await storage.createCaseLaw({
        citation: row.citation,
        citationRole: row.citationRole,
        court: row.court,
        title: row.title,
        summary: row.summary,
        keywords: row.keywords,
        sourceDocId: target.sourceDocId,
        sourceType: target.sourceType,
        sourceFilename: source.filename,
      });
    }

    const preferredPrimary = extracted.find((row) => row.citationRole === "primary") || extracted[0];
    const preferredKey = buildCaseLawDedupKey({ citation: preferredPrimary.citation });
    const refreshedRows = await db.select({
      id: caseLaw.id,
      citation: caseLaw.citation,
      citationYear: caseLaw.citationYear,
      citationReport: caseLaw.citationReport,
      citationPage: caseLaw.citationPage,
    })
      .from(caseLaw)
      .where(and(eq(caseLaw.sourceDocId, target.sourceDocId), eq(caseLaw.sourceType, target.sourceType)));

    const primaryCandidate = refreshedRows.find((row) =>
      buildCaseLawDedupKey({
        citation: row.citation,
        citationYear: row.citationYear,
        citationReport: row.citationReport,
        citationPage: row.citationPage,
      }) === preferredKey,
    ) || refreshedRows[0];

    if (primaryCandidate) {
      await db.update(caseLaw)
        .set({ citationRole: "cited" })
        .where(and(eq(caseLaw.sourceDocId, target.sourceDocId), eq(caseLaw.sourceType, target.sourceType)));
      await db.update(caseLaw)
        .set({ citationRole: "primary" })
        .where(eq(caseLaw.id, primaryCandidate.id));
    }

    if (processed % 10 === 0 || processed === targets.length) {
      console.log(
        `[CaseLaw][reextract] progress ${processed}/${targets.length} deleted=${deletedRows} insert_candidates=${insertedCandidates} skipped_no_source=${skippedNoSource} skipped_no_extract=${skippedNoExtract}`,
      );
    }
  }

  console.log(
    `[CaseLaw][reextract] done processed=${processed} deleted=${deletedRows} insert_candidates=${insertedCandidates} skipped_no_source=${skippedNoSource} skipped_no_extract=${skippedNoExtract}`,
  );
}

main()
  .catch((err) => {
    console.error("[CaseLaw][reextract] failed:", err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool?.end?.();
    } catch {
      // no-op
    }
  });
