/**
 * Converts plain-text legal drafts into Tiptap HTML.
 * Pakistani court style: numbered paragraphs (NOT <ol>), centred titles, right-aligned party roles.
 */

function esc(t: string): string {
  return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

const COURT_TITLE_RE = /^IN THE (COURT|HIGH COURT|HONOURABLE|SUPREME COURT|FAMILY COURT|SESSIONS)/i;
const CENTRED_TITLE_RE = /^(SUIT FOR|APPLICATION|PETITION|MEMORANDUM|CONSTITUTIONAL|CRIMINAL (BAIL|MISC)|CIVIL MISC|BAIL APPLICATION|INDEX OF DOCUMENTS)/i;
const CASE_NUMBER_RE = /^(CRIMINAL|CIVIL|FAMILY|WRIT|CONSTITUTIONAL)\s+(MISC|BAIL|APPEAL|REVISION|PETITION|SUIT|ORIGINAL)/i;

const SECTION_HEADINGS = new Set([
  "PRAYER","PRAYER:","GROUNDS","GROUNDS:","GROUNDS OF APPEAL","GROUNDS OF APPEAL:",
  "GROUNDS FOR BAIL","GROUNDS FOR BAIL:","VERIFICATION","VERIFICATION:",
  "BRIEF FACTS","BRIEF FACTS:","RESPECTFULLY SHEWETH","RESPECTFULLY SHEWETH:",
  "RESPECTFULLY SUBMITTED","RESPECTFULLY SUBMITTED:","VAKALATNAMA","AFFIDAVIT",
  "AFFIDAVIT:","LEGAL NOTICE","INTERIM RELIEF","INTERIM RELIEF:","INDEX OF DOCUMENTS",
]);

const ALL_CAPS_RE = /^[A-Z][A-Z\s:&,./()'-]{4,}$/;
const PARTY_ROLE_RE = /\.\.\.\s*(PETITIONER|APPLICANT|APPELLANT|PLAINTIFF|COMPLAINANT|RESPONDENT|DEFENDANT|ACCUSED|APPLICANT\/ACCUSED)\s*$/i;

export function plainTextToTiptapHTML(raw: string): string {
  if (!raw || typeof raw !== "string") return "<p></p>";
  if (raw.trimStart().startsWith("<")) return raw;

  const lines = raw.split(/\r?\n/);
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) { i++; continue; }

    // HTML table passthrough
    if (trimmed.startsWith("<!-- INDEX_TABLE") || trimmed.startsWith("<table")) {
      const html: string[] = [];
      while (i < lines.length) {
        html.push(lines[i]);
        if (lines[i].includes("</table>") || lines[i].includes("INDEX_TABLE_END")) { i++; break; }
        i++;
      }
      blocks.push(html.join("\n"));
      continue;
    }

    // Skip HTML comments
    if (trimmed.startsWith("<!--")) { i++; continue; }

    // Court title → centred H1
    if (COURT_TITLE_RE.test(trimmed)) {
      blocks.push(`<h1 style="text-align:center">${esc(trimmed)}</h1>`);
      i++; continue;
    }

    // Case number line → centred paragraph
    if (CASE_NUMBER_RE.test(trimmed) && /NO\.|____/i.test(trimmed)) {
      blocks.push(`<p style="text-align:center"><strong>${esc(trimmed)}</strong></p>`);
      i++; continue;
    }

    // VERSUS → centred bold
    if (/^VERSUS$/i.test(trimmed)) {
      blocks.push(`<p style="text-align:center"><strong>VERSUS</strong></p>`);
      i++; continue;
    }

    // Party role line (... APPLICANT) → right-aligned
    if (PARTY_ROLE_RE.test(trimmed)) {
      blocks.push(`<p style="text-align:right">${esc(trimmed)}</p>`);
      i++; continue;
    }

    // Right-aligned party role on its own line
    if (/^\.\.\.\s*(PETITIONER|APPLICANT|APPELLANT|PLAINTIFF|RESPONDENT|DEFENDANT|ACCUSED|COMPLAINANT)/i.test(trimmed)) {
      blocks.push(`<p style="text-align:right">${esc(trimmed)}</p>`);
      i++; continue;
    }

    // AFFIDAVIT → page break
    if (/^AFFIDAVIT\s*:?\s*$/i.test(trimmed)) {
      blocks.push(`<h2 data-page-break="true" class="page-break">${esc(trimmed)}</h2>`);
      i++; continue;
    }

    // Known section headings → H2
    const upper = trimmed.toUpperCase().replace(/:$/, "");
    if (SECTION_HEADINGS.has(upper) || SECTION_HEADINGS.has(trimmed.toUpperCase())) {
      if (CENTRED_TITLE_RE.test(trimmed)) {
        blocks.push(`<h2 style="text-align:center">${esc(trimmed)}</h2>`);
      } else {
        blocks.push(`<h2>${esc(trimmed)}</h2>`);
      }
      i++; continue;
    }

    // ALL-CAPS headings
    if (ALL_CAPS_RE.test(trimmed) && trimmed.length >= 5) {
      if (CENTRED_TITLE_RE.test(trimmed) || CASE_NUMBER_RE.test(trimmed)) {
        blocks.push(`<h2 style="text-align:center">${esc(trimmed)}</h2>`);
      } else {
        blocks.push(`<h2>${esc(trimmed)}</h2>`);
      }
      i++; continue;
    }

    // Everything else → plain paragraph (numbers stay as text, not <ol>)
    const pLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i].trim();
      if (!cur) break;
      if (COURT_TITLE_RE.test(cur) || ALL_CAPS_RE.test(cur) || /^VERSUS$/i.test(cur) ||
          cur.startsWith("<!--") || cur.startsWith("<table") ||
          PARTY_ROLE_RE.test(cur) || /^\.\.\.\s*(PETITIONER|APPLICANT|APPELLANT|RESPONDENT)/i.test(cur) ||
          SECTION_HEADINGS.has(cur.toUpperCase().replace(/:$/,"")) ||
          (CASE_NUMBER_RE.test(cur) && /NO\.|____/i.test(cur))) {
        break;
      }
      pLines.push(esc(cur));
      i++;
    }
    if (pLines.length > 0) {
      blocks.push(`<p>${pLines.join("<br>")}</p>`);
    }
  }

  return blocks.length > 0 ? blocks.join("") : "<p></p>";
}

export function isHTMLContent(content: string): boolean {
  if (!content) return false;
  const t = content.trimStart();
  return t.startsWith("<") && (t.startsWith("<p") || t.startsWith("<h") || t.startsWith("<ol") ||
    t.startsWith("<ul") || t.startsWith("<div") || t.startsWith("<!") || t.startsWith("<br") || t.startsWith("<table"));
}
