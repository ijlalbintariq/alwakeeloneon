import fs from "node:fs";
import { sql } from "drizzle-orm";
import { db, dbAvailable, dbUnavailableReason, pool } from "../server/db";

type CitationSample = {
  citation_string: string;
  year: number;
  journal: string;
  page: number;
  title: string;
};

type CaseSample = {
  citation: string;
  title: string;
};

type RAGResponse = {
  answer?: string;
  citations?: Array<{
    sourceDocumentId?: number;
    title?: string;
    score?: number;
  }>;
  retrieval?: {
    matched?: number;
  };
};

type TestResult = {
  id: string;
  type: "citation-search" | "case-search" | "rag-ask" | "citation-alias";
  query: string;
  pass: boolean;
  statusCode: number;
  detail: string;
};

function getRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: T[] } | null)?.rows;
  return Array.isArray(rows) ? rows : [];
}

function normalizeCitation(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\bp\.?\s*cr\.?\s*l\.?\s*j\b/g, "pcrlj")
    .replace(/[^a-z0-9]+/g, "");
}

function parseCookieHeader(path: string): string {
  const raw = fs.readFileSync(path, "utf8");
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const cookies: string[] = [];
  for (const line of lines) {
    if (line.startsWith("#") && !line.startsWith("#HttpOnly_")) continue;
    const normalizedLine = line.startsWith("#HttpOnly_")
      ? line.replace(/^#HttpOnly_/, "")
      : line;
    const parts = normalizedLine.split("\t");
    if (parts.length < 7) continue;
    const name = parts[5];
    const value = parts[6];
    if (!name || !value) continue;
    cookies.push(`${name}=${value}`);
  }
  return cookies.join("; ");
}

async function citationExistsInDb(citation: string): Promise<boolean> {
  const key = normalizeCitation(citation);
  if (!key) return false;
  const result = await db.execute(sql`
    SELECT (
      EXISTS(
        SELECT 1 FROM judgments
        WHERE regexp_replace(lower(coalesce(citation_string, '')), '[^a-z0-9]+', '', 'g') = ${key}
      )
      OR EXISTS(
        SELECT 1 FROM case_law
        WHERE regexp_replace(lower(coalesce(citation, '')), '[^a-z0-9]+', '', 'g') = ${key}
      )
    ) AS present
  `);
  const rows = getRows<{ present: boolean | string | number }>(result);
  const value = rows[0]?.present;
  return value === true || value === "t" || value === 1 || value === "1";
}

function extractReferencesCitations(answer: string): string[] {
  const raw = String(answer || "");
  const match = raw.match(/```references\s*([\s\S]*?)```/i);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    const refs = Array.isArray(parsed?.judgments) ? parsed.judgments : [];
    return refs
      .map((item: any) => String(item?.citation || "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  if (!dbAvailable) {
    throw new Error(`Database unavailable: ${dbUnavailableReason || "unknown reason"}`);
  }

  const baseUrl = String(process.env.VALIDATION_BASE_URL || "https://alwakeelo.com").replace(/\/+$/, "");
  const cookiePath = String(process.env.VALIDATION_COOKIE_PATH || "/tmp/alwakeelo_validation_cookie.txt");
  const cookieHeader = parseCookieHeader(cookiePath);
  if (!cookieHeader) {
    throw new Error(`No valid cookies found in ${cookiePath}`);
  }

  const citationSamplesResult = await db.execute(sql.raw(`
    SELECT j.citation_string, j.year, lj.code AS journal, j.page, j.title
    FROM judgments j
    JOIN law_journals lj ON lj.id = j.journal_id
    WHERE coalesce(j.full_text, '') <> ''
    ORDER BY random()
    LIMIT 8
  `));
  const citationSamples = getRows<CitationSample>(citationSamplesResult);

  const caseSamplesResult = await db.execute(sql.raw(`
    SELECT citation, title
    FROM case_law
    WHERE coalesce(citation, '') <> ''
    ORDER BY random()
    LIMIT 8
  `));
  const caseSamples = getRows<CaseSample>(caseSamplesResult);

  const ragSamplesResult = await db.execute(sql.raw(`
    SELECT citation, title
    FROM case_law
    WHERE coalesce(citation, '') <> ''
    ORDER BY random()
    LIMIT 4
  `));
  const ragSamples = getRows<CaseSample>(ragSamplesResult);

  const pcrljSampleResult = await db.execute(sql.raw(`
    SELECT j.citation_string, j.year, lj.code AS journal, j.page, j.title
    FROM judgments j
    JOIN law_journals lj ON lj.id = j.journal_id
    WHERE upper(lj.code) = 'PCRLJ'
    LIMIT 1
  `));
  const pcrljSample = getRows<CitationSample>(pcrljSampleResult)[0];

  const results: TestResult[] = [];

  for (let i = 0; i < citationSamples.length; i += 1) {
    const row = citationSamples[i];
    const url = `${baseUrl}/api/citation-search?year=${row.year}&journal=${encodeURIComponent(row.journal)}&page=${row.page}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { cookie: cookieHeader },
    });
    const payload = await res.json().catch(() => null);
    const expected = normalizeCitation(`${row.year} ${row.journal} ${row.page}`);
    const list = Array.isArray(payload) ? payload : [];
    const found = list.some((item: any) => normalizeCitation(String(item?.citation || "")) === expected);
    results.push({
      id: `CIT-${i + 1}`,
      type: "citation-search",
      query: `${row.year} ${row.journal} ${row.page}`,
      pass: res.status === 200 && found,
      statusCode: res.status,
      detail: res.status === 200
        ? `matches=${list.length} exact=${found}`
        : `error=${JSON.stringify(payload)}`,
    });
  }

  if (pcrljSample) {
    const aliasUrl = `${baseUrl}/api/citation-search?year=${pcrljSample.year}&journal=${encodeURIComponent("P Cr. L J")}&page=${pcrljSample.page}`;
    const res = await fetch(aliasUrl, {
      method: "GET",
      headers: { cookie: cookieHeader },
    });
    const payload = await res.json().catch(() => null);
    const expected = normalizeCitation(`${pcrljSample.year} PCRLJ ${pcrljSample.page}`);
    const list = Array.isArray(payload) ? payload : [];
    const found = list.some((item: any) => normalizeCitation(String(item?.citation || "")) === expected);
    results.push({
      id: "CIT-ALIAS-PCRLJ",
      type: "citation-alias",
      query: `${pcrljSample.year} P Cr. L J ${pcrljSample.page}`,
      pass: res.status === 200 && found,
      statusCode: res.status,
      detail: res.status === 200
        ? `matches=${list.length} exact=${found}`
        : `error=${JSON.stringify(payload)}`,
    });
  }

  for (let i = 0; i < caseSamples.length; i += 1) {
    const row = caseSamples[i];
    const url = `${baseUrl}/api/case-law/search?q=${encodeURIComponent(row.citation)}&limit=10`;
    const res = await fetch(url, {
      method: "GET",
      headers: { cookie: cookieHeader },
    });
    const payload = await res.json().catch(() => null);
    const list = Array.isArray(payload) ? payload : [];
    const expected = normalizeCitation(row.citation);
    const found = list.some((item: any) => normalizeCitation(String(item?.citation || "")) === expected);
    results.push({
      id: `KW-${i + 1}`,
      type: "case-search",
      query: row.citation,
      pass: res.status === 200 && found,
      statusCode: res.status,
      detail: res.status === 200
        ? `matches=${list.length} exact=${found}`
        : `error=${JSON.stringify(payload)}`,
    });
  }

  for (let i = 0; i < ragSamples.length; i += 1) {
    const query = `${ragSamples[i].citation} ${ragSamples[i].title}`;
    const res = await fetch(`${baseUrl}/api/rag/ask`, {
      method: "POST",
      headers: {
        cookie: cookieHeader,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
    const payload = (await res.json().catch(() => null)) as RAGResponse | null;
    const matched = Number(payload?.retrieval?.matched || 0);
    const refCitations = extractReferencesCitations(String(payload?.answer || ""));
    let refsValid = true;
    for (const citation of refCitations) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await citationExistsInDb(citation);
      if (!exists) {
        refsValid = false;
        break;
      }
    }
    results.push({
      id: `RAG-${i + 1}`,
      type: "rag-ask",
      query,
      pass: res.status === 200 && matched > 0 && refsValid,
      statusCode: res.status,
      detail: res.status === 200
        ? `matched=${matched} refs=${refCitations.length} refsValid=${refsValid}`
        : `error=${JSON.stringify(payload)}`,
    });
  }

  const summary = {
    total: results.length,
    passed: results.filter((row) => row.pass).length,
    failed: results.filter((row) => !row.pass).length,
    timestamp: new Date().toISOString(),
    baseUrl,
  };

  const report = { summary, results };
  fs.writeFileSync("/tmp/validation_pack_report.json", JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    console.error("[validation-pack] failed:", err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool?.end?.();
  });
