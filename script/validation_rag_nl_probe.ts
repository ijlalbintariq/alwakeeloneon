import fs from "node:fs";
import { sql } from "drizzle-orm";
import { db, dbAvailable, dbUnavailableReason, pool } from "../server/db";

const REPORT_CODES = [
  "PLD", "SCMR", "YLR", "MLD", "CLC", "PCRLJ", "PLJ", "PLC", "NLR",
  "PSC", "ALD", "KLR", "PTD", "PTCL", "PLS", "GBLR", "CLD", "TAX", "SLR",
];

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

function normalizeCitation(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\bp\.?\s*cr\.?\s*l\.?\s*j\b/g, "pcrlj")
    .replace(/[^a-z0-9]+/g, "");
}

function extractCitationLikeStrings(text: string): string[] {
  const report = REPORT_CODES.join("|");
  const regexes = [
    new RegExp(`\\b(?:19|20)\\d{2}\\s+(?:${report})\\s+\\d{1,6}\\b`, "gi"),
    new RegExp(`\\b(?:${report})\\s+(?:19|20)\\d{2}\\s+\\d{1,6}\\b`, "gi"),
  ];
  const found = new Set<string>();
  for (const regex of regexes) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const raw = String(match[0] || "").trim().replace(/\s+/g, " ");
      if (raw) found.add(raw);
    }
  }
  return Array.from(found);
}

async function citationExistsInDb(citation: string): Promise<boolean> {
  const key = normalizeCitation(citation);
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
  const rows = (result as any).rows || [];
  const value = rows[0]?.present;
  return value === true || value === "t" || value === 1 || value === "1";
}

async function main(): Promise<void> {
  if (!dbAvailable) throw new Error(`DB unavailable: ${dbUnavailableReason || "unknown"}`);

  const baseUrl = String(process.env.VALIDATION_BASE_URL || "https://alwakeelo.com").replace(/\/+$/, "");
  const cookieHeader = parseCookieHeader(String(process.env.VALIDATION_COOKIE_PATH || "/tmp/alwakeelo_validation_cookie.txt"));
  if (!cookieHeader) throw new Error("No validation cookie found");

  const probes = [
    "latest case law where post arrest bail is granted or dismissed in murder case",
    "latest case law for cheque bounce under 489-F PPC",
    "latest narcotics bail judgment in pakistan",
    "latest high court writ on service matter pakistan",
  ];

  const report: Array<{
    query: string;
    statusCode: number;
    extractedCitations: string[];
    missingInDb: string[];
    pass: boolean;
  }> = [];

  for (const query of probes) {
    const res = await fetch(`${baseUrl}/api/rag/ask`, {
      method: "POST",
      headers: {
        cookie: cookieHeader,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
    const payload = await res.json().catch(() => ({} as any));
    const answer = String(payload?.answer || "");
    const extracted = extractCitationLikeStrings(answer);
    const missingInDb: string[] = [];
    for (const citation of extracted) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await citationExistsInDb(citation);
      if (!exists) missingInDb.push(citation);
    }
    report.push({
      query,
      statusCode: res.status,
      extractedCitations: extracted,
      missingInDb,
      pass: res.status === 200 && missingInDb.length === 0,
    });
  }

  const summary = {
    total: report.length,
    passed: report.filter((r) => r.pass).length,
    failed: report.filter((r) => !r.pass).length,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify({ summary, report }, null, 2));
}

main()
  .catch((err) => {
    console.error("[validation-rag-nl] failed:", err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool?.end?.();
  });
