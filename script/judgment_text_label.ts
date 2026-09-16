/**
 * judgment_text_label.ts
 *
 * Classifies every judgment body without deleting any of it.
 *
 * THE PROBLEM
 * -----------
 * The original ingest wrote a document's body to every citation that document
 * mentioned, not only to the citation it is actually reported under. Around
 * 48,500 rows (about 20% of `judgments`) therefore share a byte-identical
 * `full_text` with rows whose citations span different years. Asking for one of
 * those citations returns a different case's judgment, complete with a real
 * title, headnotes and date, so nothing on the surface looks wrong.
 *
 * THE FIX
 * -------
 * Every stored body names its own citation in a header line:
 *
 *     Reported As: 1972 P Cr. L J 1034
 *
 * For each group of rows sharing a body, this script reads that header and
 * marks the row it names as the body's owner. The other rows keep their text
 * untouched; they are simply labelled as holding someone else's body, together
 * with the citation that body belongs to.
 *
 *   text_status = 'own'         safe to serve as this citation's judgment
 *   text_status = 'mislabeled'  body belongs to text_true_citation instead
 *   text_status = 'unknown'     shared body, true owner not determined
 *
 * Nothing is deleted and no text is overwritten. Only the two provenance
 * columns are written, so the operation is fully reversible with --reset.
 *
 * PREREQUISITE
 *   Apply migrations/0009_judgment_text_provenance.sql (or run: npm run db:push)
 *
 * USAGE
 *   npx tsx script/judgment_text_label.ts          # dry run, writes a plan file
 *   npx tsx script/judgment_text_label.ts --apply  # write the labels
 *   npx tsx script/judgment_text_label.ts --reset  # clear all labels
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Client } from "pg";

const APPLY = process.argv.includes("--apply");
const RESET = process.argv.includes("--reset");
const PLAN_FILE = "judgment_text_label_plan.csv";

function canonJournalCode(code: string): string {
  return String(code || "").toUpperCase().replace(/[^A-Z]/g, "");
}

function splitCitations(raw: string): string[] {
  return String(raw || "")
    // "&" separates citations only between digits ("1450 & 2023 PLJ 55").
    // Inside a journal's category name it is part of the name and must not
    // split ("K.L.R. 2001 Labour & Service Cases 52").
    .split(/(?:\s*[,;]\s*|\s+and\s+|(?<=\d)\s*&\s*)/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

function parseCitation(raw: string, knownJournals: Set<string>): { year: number; journal: string; page: number } | null {
  let s = String(raw || "").toUpperCase();

  // Canonicalize dotted/spaced journal codes BEFORE punctuation is stripped.
  s = s.replace(/P\s*\.?\s*CR?\s*\.?\s*L\s*\.?\s*J\s*\.?\s*N(?:OTES?)?/g, " PCRLJN ");
  s = s.replace(/P\s*\.?\s*CR?\s*\.?\s*L\s*\.?\s*J/g, " PCRLJ ");
  s = s.replace(/PLC\s*\(?\s*C\.?\s*S\.?\s*\)?\s*N(?:OTES?)?/g, " PLCCSN ");
  s = s.replace(/PLC\s*\(?\s*C\.?\s*S\.?\s*\)?/g, " PLCCS ");
  s = s.replace(/Y\s*\.?\s*L\s*\.?\s*R\s*\.?\s*N(?:OTES?)?/g, " YLRN ");
  s = s.replace(/C\s*\.?\s*L\s*\.?\s*C\s*\.?\s*N(?:OTES?)?/g, " CLCN ");
  s = s.replace(/\bPLC\s*N(?:OTES?)?\b/g, " PLCN ");
  s = s.replace(/S\s*\.?\s*C\s*\.?\s*M\s*\.?\s*R\s*\.?/g, " SCMR ");
  s = s.replace(/P\s*\.?\s*L\s*\.?\s*D\s*\.?/g, " PLD ");
  s = s.replace(/G\s*\.?\s*B\s*\.?\s*L\s*\.?\s*R\s*\.?/g, " GBLR ");

  // Strip remaining punctuation.
  s = s.replace(/[.,()\[\]\/-]/g, " ");

  // KEY FIX: split letter/digit boundaries so "PLD1968281" becomes "PLD 1968 281".
  s = s.replace(/([A-Z])(\d)/g, "$1 $2").replace(/(\d)([A-Z])/g, "$1 $2");

  const rawTokens = s.split(/\s+/).filter(Boolean);

  // Merge runs of single letters so a spaced-out journal code such as
  // "1990 C L C 1439" collapses to "CLC" and matches law_journals.
  const tokens: string[] = [];
  for (const t of rawTokens) {
    const prev = tokens[tokens.length - 1];
    if (t.length === 1 && /^[A-Z]$/.test(t) && prev && /^[A-Z]+$/.test(prev) && prev.length <= 5) {
      tokens[tokens.length - 1] = prev + t;
    } else {
      tokens.push(t);
    }
  }

  const yearIdx = tokens.findIndex((t) => /^(?:1[89]|20)\d{2}$/.test(t));
  if (yearIdx === -1) return null;

  const journal = tokens.find((t) => knownJournals.has(t));
  if (!journal) return null;

  // Page is the last standalone number that is not the year token.
  let page = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (i === yearIdx) continue;
    if (/^\d{1,5}$/.test(tokens[i])) { page = Number(tokens[i]); break; }
  }
  if (page < 0) return null;

  return { year: Number(tokens[yearIdx]), journal, page };
}

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const raw = readFileSync(".env", "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)$/);
    if (m) return m[1].trim().replace(/^["\']|["\']$/g, "");
  }
  throw new Error("DATABASE_URL not found in environment or .env");
}

type Member = {
  id: string;
  year: number;
  journalId: number;
  page: number;
  citation: string;
  header: string | null;
};

async function requireColumns(c: Client) {
  const r = await c.query(`
    select count(*)::int n from information_schema.columns
    where table_name = 'judgments' and column_name in ('text_status', 'text_true_citation')`);
  if (r.rows[0].n < 2) {
    throw new Error(
      "Columns text_status / text_true_citation are missing. " +
      "Apply migrations/0009_judgment_text_provenance.sql first (or run: npm run db:push).");
  }
}

async function main() {
  const c = new Client({ connectionString: loadDatabaseUrl(), ssl: { rejectUnauthorized: false } });
  await c.connect();
  await requireColumns(c);

  if (RESET) {
    const r = await c.query(`update judgments set text_status = null, text_true_citation = null
                             where text_status is not null`);
    console.log(`Cleared labels on ${r.rowCount} rows. No judgment text was touched.`);
    await c.end();
    return;
  }

  const journalRows = await c.query(`select id, code from law_journals`);
  const codes = new Map<string, number>(
    journalRows.rows.map((r: any) => [canonJournalCode(r.code), r.id] as const));
  const known = new Set(codes.keys());

  /** Turn a citation string into the (year, journal_id, page) keys it names. */
  const keysOf = (raw: string): string[] => {
    const out: string[] = [];
    for (const part of splitCitations(raw)) {
      const p = parseCitation(part, known);
      const journalId = p ? codes.get(p.journal) : undefined;
      if (p && journalId !== undefined) out.push(`${p.year}|${journalId}|${p.page}`);
    }
    return out;
  };

  // Every citation key that exists, so the plan can say whether a body's true
  // owner is a judgment you actually hold or one outside the database.
  const existingKeys = new Set<string>();
  for (const r of (await c.query(`select year, journal_id, page from judgments`)).rows as any[])
    existingKeys.add(`${r.year}|${r.journal_id}|${r.page}`);

  console.log("Scanning for rows that share a judgment body...");
  const rows = await c.query(`
    with shared as (
      select md5(full_text) h from judgments
      where full_text is not null and length(full_text) > 500
      group by 1
      having count(*) > 1 and max(year) - min(year) > 0)
    select md5(j.full_text) as h, j.id, j.year, j.journal_id, j.page, j.citation_string,
           substring(j.full_text from 'Reported As:[^\n]{0,160}') as header
    from judgments j
    join shared on md5(j.full_text) = shared.h`);

  const groups = new Map<string, Member[]>();
  for (const r of rows.rows as any[]) {
    const m: Member = {
      id: r.id, year: r.year, journalId: r.journal_id, page: r.page,
      citation: r.citation_string, header: r.header,
    };
    const list = groups.get(r.h);
    if (list) list.push(m); else groups.set(r.h, [m]);
  }

  const owns: string[] = [];
  const mislabeled: Array<{ id: string; trueCitation: string }> = [];
  const unknown: string[] = [];
  const plan: string[] = ["group,status,citation,true_citation,owner_in_db"];
  let resolvedGroups = 0, ownerElsewhere = 0, ownerOutside = 0, unreadableGroups = 0, noHeaderGroups = 0;

  let groupNo = 0;
  for (const [, members] of groups) {
    groupNo++;
    const header = members.find((m) => m.header)?.header;

    if (!header) {
      noHeaderGroups++;
      for (const m of members) {
        unknown.push(m.id);
        plan.push(`${groupNo},unknown,"${m.citation}",,`);
      }
      continue;
    }

    const reportedAs = header.replace(/^Reported As:\s*/, "").trim();
    const wanted = new Set(keysOf(reportedAs));
    const correct = members.filter((m) => wanted.has(`${m.year}|${m.journalId}|${m.page}`));

    // The header names none of this group's members. The body still states
    // whose judgment it is, so every member is holding someone else's text.
    // That is knowable without guessing: mark them mislabeled and record the
    // citation the body claims, whether or not that judgment is in the table.
    // Only a header that cannot be read at all leaves a group unknown.
    if (correct.length === 0) {
      if (wanted.size === 0) {
        unreadableGroups++;
        for (const m of members) {
          unknown.push(m.id);
          plan.push(`${groupNo},unknown,"${m.citation}","${reportedAs}",`);
        }
        continue;
      }
      const ownerHeld = [...wanted].some((k) => existingKeys.has(k));
      if (ownerHeld) ownerElsewhere++; else ownerOutside++;
      for (const m of members) {
        mislabeled.push({ id: m.id, trueCitation: reportedAs });
        plan.push(`${groupNo},mislabeled,"${m.citation}","${reportedAs}",${ownerHeld ? "yes" : "no"}`);
      }
      continue;
    }

    resolvedGroups++;
    const correctIds = new Set(correct.map((m) => m.id));
    for (const m of correct) {
      owns.push(m.id);
      plan.push(`${groupNo},own,"${m.citation}","${reportedAs}",yes`);
    }
    for (const m of members) {
      if (correctIds.has(m.id)) continue;
      mislabeled.push({ id: m.id, trueCitation: reportedAs });
      plan.push(`${groupNo},mislabeled,"${m.citation}","${reportedAs}",yes`);
    }
  }

  writeFileSync(PLAN_FILE, plan.join("\n"));

  const totals = await c.query(`select count(*)::int n from judgments`);
  const sharedRows = owns.length + mislabeled.length + unknown.length;
  const uniqueRows = totals.rows[0].n - sharedRows;

  console.log("");
  console.log(`groups of rows sharing a body : ${groups.size}`);
  console.log(`  header names a member                    : ${resolvedGroups}`);
  console.log(`  header names a judgment held elsewhere   : ${ownerElsewhere}`);
  console.log(`  header names a judgment not in the table : ${ownerOutside}`);
  console.log(`  header unreadable                        : ${unreadableGroups}`);
  console.log(`  no header present                        : ${noHeaderGroups}`);
  console.log("");
  console.log(`rows labelled 'own'        : ${owns.length + uniqueRows}  (${uniqueRows} never shared + ${owns.length} confirmed owners)`);
  console.log(`rows labelled 'mislabeled' : ${mislabeled.length}  (text kept, true citation recorded)`);
  console.log(`rows labelled 'unknown'    : ${unknown.length}`);
  console.log(`plan written to            : ${PLAN_FILE}`);

  if (!APPLY) {
    console.log("");
    console.log("Dry run. Nothing was written. Review the plan file, then re-run with --apply.");
    await c.end();
    return;
  }

  console.log("");
  console.log("Writing labels. No judgment text is modified.");

  // Only rows whose label actually changes are written. Rewriting all 234,837
  // rows costs ~25 minutes here, because every row rewrite must also update the
  // table's twelve indexes, several of them GIN trigram indexes over large text
  // columns. Diffing first keeps a re-run to the rows that moved.
  const desired = new Map<string, { status: string; cite: string | null }>();
  for (const id of unknown) desired.set(id, { status: "unknown", cite: null });
  for (const m of mislabeled) desired.set(m.id, { status: "mislabeled", cite: m.trueCitation });
  for (const id of owns) desired.set(id, { status: "own", cite: null });

  const changed = { own: [] as string[], unknown: [] as string[], mislabeled: [] as Array<{ id: string; cite: string }> };
  let unchanged = 0;
  const current = await c.query(`select id, text_status, text_true_citation from judgments`);
  for (const r of current.rows as any[]) {
    // A row outside every shared group holds a body nothing else holds.
    const want = desired.get(r.id) ?? { status: "own", cite: null };
    if (r.text_status === want.status && (r.text_true_citation ?? null) === want.cite) { unchanged++; continue; }
    if (want.status === "own") changed.own.push(r.id);
    else if (want.status === "unknown") changed.unknown.push(r.id);
    else changed.mislabeled.push({ id: r.id, cite: want.cite as string });
  }

  const totalChanged = changed.own.length + changed.unknown.length + changed.mislabeled.length;
  console.log(`  rows already correct : ${unchanged}`);
  console.log(`  rows to update       : ${totalChanged}  (own ${changed.own.length}, unknown ${changed.unknown.length}, mislabeled ${changed.mislabeled.length})`);
  if (totalChanged === 0) {
    console.log("Nothing to do.");
    await c.end();
    return;
  }

  const CHUNK = 500;
  await c.query("begin");
  for (let i = 0; i < changed.own.length; i += CHUNK) {
    await c.query(
      `update judgments set text_status = 'own', text_true_citation = null where id = any($1::uuid[])`,
      [changed.own.slice(i, i + CHUNK)]);
  }
  for (let i = 0; i < changed.unknown.length; i += CHUNK) {
    await c.query(
      `update judgments set text_status = 'unknown', text_true_citation = null where id = any($1::uuid[])`,
      [changed.unknown.slice(i, i + CHUNK)]);
  }
  for (let i = 0; i < changed.mislabeled.length; i += CHUNK) {
    const slice = changed.mislabeled.slice(i, i + CHUNK);
    await c.query(
      `update judgments j set text_status = 'mislabeled', text_true_citation = v.cite
       from (select unnest($1::uuid[]) as id, unnest($2::text[]) as cite) v
       where j.id = v.id`,
      [slice.map((x) => x.id), slice.map((x) => x.cite)]);
  }
  await c.query("commit");

  const check = await c.query(
    `select text_status, count(*)::int n from judgments group by 1 order by 2 desc`);
  console.log("");
  console.log("final label counts:");
  for (const r of check.rows as any[]) console.log(`  ${String(r.text_status)} : ${r.n}`);
  console.log("");
  console.log("No judgment text was deleted. Undo with: npx tsx script/judgment_text_label.ts --reset");
  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
