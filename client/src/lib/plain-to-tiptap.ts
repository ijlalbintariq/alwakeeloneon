/**
 * Converts plain-text legal drafts into Tiptap HTML.
 * Pakistani court style: numbered paragraphs (NOT <ol>), centred titles,
 * right-aligned party roles, Title Case case numbers, page breaks.
 */

function esc(t: string): string {
  return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

const COURT_TITLE_RE = /^IN THE (COURT|HIGH COURT|HONOURABLE|SUPREME COURT|FAMILY COURT|SESSIONS|SPECIAL COURT|BANKING COURT|ACCOUNTABILITY COURT)/i;
const CENTRED_TITLE_RE = /^(SUIT FOR|APPLICATION|PETITION|MEMORANDUM|CONSTITUTIONAL|CRIMINAL (BAIL|MISC)|CIVIL MISC|BAIL APPLICATION|INDEX OF DOCUMENTS|READ WITH)/i;
const CASE_NUMBER_RE = /^(CRIMINAL|CIVIL|FAMILY|WRIT|CONSTITUTIONAL)\s+(MISC|BAIL|APPEAL|REVISION|PETITION|SUIT|ORIGINAL)/i;
// Title Case case numbers: "Criminal Misc. (Bail) No. ______ of 2025"
const TITLE_CASE_NUMBER_RE = /^(Criminal|Civil|Family|Writ|Constitutional)\s+(Misc|Bail|Appeal|Revision|Petition|Suit)/i;

const SECTION_HEADINGS = new Set([
  "PRAYER","PRAYER:","GROUNDS","GROUNDS:","GROUNDS OF APPEAL","GROUNDS OF APPEAL:",
  "GROUNDS FOR BAIL","GROUNDS FOR BAIL:","VERIFICATION","VERIFICATION:",
  "BRIEF FACTS","BRIEF FACTS:","RESPECTFULLY SHEWETH","RESPECTFULLY SHEWETH:",
  "RESPECTFULLY SUBMITTED","RESPECTFULLY SUBMITTED:","VAKALATNAMA","AFFIDAVIT",
  "AFFIDAVIT:","LEGAL NOTICE","INTERIM RELIEF","INTERIM RELIEF:","INDEX OF DOCUMENTS",
  "MEMO OF PETITION","MEMO OF PETITION:",
]);

const ALL_CAPS_RE = /^[A-Z][A-Z\s:&,./()'-]{4,}$/;
const PARTY_ROLE_RE = /\.{2,4}\s*(PETITIONER|APPLICANT|APPELLANT|PLAINTIFF|COMPLAINANT|RESPONDENT|DEFENDANT|ACCUSED|APPLICANT\/ACCUSED|PETITIONERS)\s*$/i;
const PARTY_ROLE_LINE_RE = /^\.{2,4}\s*(PETITIONER|APPLICANT|APPELLANT|PLAINTIFF|RESPONDENT|DEFENDANT|ACCUSED|COMPLAINANT|APPLICANT\/ACCUSED|PETITIONERS)/i;
const THROUGH_RE = /^Through\s*:/i;

// Detect standalone party role labels (with or without dots/ellipsis)
// Matches: "Applicant/Accused", "... RESPONDENT", "…Petitioner", ".... APPLICANT"
const STANDALONE_ROLE_RE = /^[.…]*\s*(PETITIONER|APPLICANT|APPELLANT|PLAINTIFF|COMPLAINANT|RESPONDENT|DEFENDANT|ACCUSED|APPLICANT\/ACCUSED|PETITIONERS)\s*$/i;

// Detect numbered items like "1. ", "2. ", "10. " at start of line
const NUMBERED_ITEM_RE = /^\d{1,3}\.\s+/;

export function plainTextToTiptapHTML(raw: string): string {
  if (!raw || typeof raw !== "string") return "<p></p>";
  if (raw.trimStart().startsWith("<")) return raw;

  const lines = raw.split(/\r?\n/);
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Blank lines → spacer paragraph for visual spacing
    // Every blank line group creates visual spacing (Pakistani court style)
    if (!trimmed) {
      let blankCount = 0;
      while (i < lines.length && !lines[i].trim()) { blankCount++; i++; }
      // Always add a spacer — Pakistani court pleadings need clear section separation
      if (blankCount >= 3) {
        blocks.push(`<p style="margin-top:1.5em">&nbsp;</p>`);
      } else if (blankCount >= 2) {
        blocks.push(`<p style="margin-top:0.8em">&nbsp;</p>`);
      } else {
        blocks.push(`<p style="margin-top:0.4em">&nbsp;</p>`);
      }
      continue;
    }

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

    // Markdown table detection (| col1 | col2 | col3 |)
    if (/^\|.+\|/.test(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && /^\|.+\|/.test(lines[i].trim())) {
        tableLines.push(lines[i].trim());
        i++;
      }
      // Skip separator lines like |:---|:---|:---|
      const dataLines = tableLines.filter(l => {
        const stripped = l.replace(/\s/g, "");
        return !/^\|[-:| ]+\|$/.test(stripped);
      });
      if (dataLines.length > 0) {
        let tableHtml = '<table style="width:100%;border-collapse:collapse;border:1px solid #333;margin:1em 0">';
        dataLines.forEach((line, rowIdx) => {
          const cells = line.split("|").filter(c => c.trim() !== "" || c.length > 0).map(c => c.trim()).filter(c => c !== "");
          if (cells.length === 0) return;
          const tag = rowIdx === 0 ? "th" : "td";
          const bgStyle = rowIdx === 0 ? 'background:#f0f0f0;font-weight:bold;' : '';
          tableHtml += "<tr>";
          cells.forEach(cell => {
            tableHtml += `<${tag} style="border:1px solid #333;padding:6px 10px;${bgStyle}">${esc(cell)}</${tag}>`;
          });
          tableHtml += "</tr>";
        });
        tableHtml += "</table>";
        blocks.push(tableHtml);
      }
      continue;
    }

    // Skip HTML comments
    if (trimmed.startsWith("<!--")) { i++; continue; }

    // <br> passthrough for spacing
    if (/^<br\s*\/?>$/i.test(trimmed)) {
      blocks.push(`<p>&nbsp;</p>`);
      i++; continue;
    }

    // Court title → centred H1 bold
    if (COURT_TITLE_RE.test(trimmed)) {
      blocks.push(`<h1 style="text-align:center"><strong>${esc(trimmed)}</strong></h1>`);
      i++; continue;
    }

    // Title Case case number (e.g. "Criminal Misc. (Bail) No. _____ of 2025") → centred bold
    if (TITLE_CASE_NUMBER_RE.test(trimmed) && /No\.|____/i.test(trimmed)) {
      blocks.push(`<p style="text-align:center"><strong>${esc(trimmed)}</strong></p>`);
      i++; continue;
    }

    // ALL CAPS case number line → centred bold
    if (CASE_NUMBER_RE.test(trimmed) && /NO\.|____/i.test(trimmed)) {
      blocks.push(`<p style="text-align:center"><strong>${esc(trimmed)}</strong></p>`);
      i++; continue;
    }

    // VERSUS → centred bold
    if (/^VERSUS$/i.test(trimmed)) {
      blocks.push(`<p style="text-align:center"><strong>VERSUS</strong></p>`);
      i++; continue;
    }

    // Party role with dots (.... APPLICANT/ACCUSED) → right-aligned
    if (PARTY_ROLE_RE.test(trimmed)) {
      blocks.push(`<p style="text-align:right"><strong>${esc(trimmed)}</strong></p>`);
      i++; continue;
    }

    // Party role on its own line (.... PETITIONER)
    if (PARTY_ROLE_LINE_RE.test(trimmed)) {
      blocks.push(`<p style="text-align:right"><strong>${esc(trimmed)}</strong></p>`);
      i++; continue;
    }

    // Standalone party role labels — with or without dots
    // "Applicant/Accused", "... RESPONDENT", "…Petitioner"
    if (STANDALONE_ROLE_RE.test(trimmed)) {
      blocks.push(`<p style="text-align:right"><strong>${esc(trimmed)}</strong></p>`);
      i++; continue;
    }

    // "Through:" line → left-aligned bold (signature block)
    if (THROUGH_RE.test(trimmed)) {
      blocks.push(`<p><strong>${esc(trimmed)}</strong></p>`);
      i++; continue;
    }

    // AFFIDAVIT → page break heading
    if (/^AFFIDAVIT\s*:?\s*$/i.test(trimmed)) {
      blocks.push(`<h2 data-page-break="true" class="page-break">${esc(trimmed)}</h2>`);
      i++; continue;
    }

    // RESPECTFULLY SHEWETH → page break (marks start of Page 2 body)
    if (/^RESPECTFULLY SHEWETH\s*:?\s*$/i.test(trimmed)) {
      blocks.push(`<h2 data-page-break="true" class="page-break">${esc(trimmed)}</h2>`);
      i++; continue;
    }

    // Known section headings → H2
    const upper = trimmed.toUpperCase().replace(/:$/, "");
    if (SECTION_HEADINGS.has(upper) || SECTION_HEADINGS.has(trimmed.toUpperCase())) {
      if (CENTRED_TITLE_RE.test(trimmed)) {
        blocks.push(`<h2 style="text-align:center"><strong>${esc(trimmed)}</strong></h2>`);
      } else {
        blocks.push(`<h2><strong>${esc(trimmed)}</strong></h2>`);
      }
      i++; continue;
    }

    // ALL-CAPS headings (petition titles, etc.)
    if (ALL_CAPS_RE.test(trimmed) && trimmed.length >= 5) {
      if (CENTRED_TITLE_RE.test(trimmed) || CASE_NUMBER_RE.test(trimmed) || COURT_TITLE_RE.test(trimmed)) {
        blocks.push(`<h2 style="text-align:center"><strong>${esc(trimmed)}</strong></h2>`);
      } else {
        blocks.push(`<h2><strong>${esc(trimmed)}</strong></h2>`);
      }
      i++; continue;
    }

    // Numbered items (e.g. "1. Muhammad Bilal s/o ...") → each as its own paragraph
    // In Pakistani court drafts, numbered items in the cause title (party list) or
    // numbered grounds should each be a separate, visually distinct block.
    if (NUMBERED_ITEM_RE.test(trimmed)) {
      // Collect all continuation lines until we hit a blank line or a special line
      const pLines: string[] = [esc(trimmed)];
      i++;
      while (i < lines.length) {
        const cur = lines[i].trim();
        if (!cur) break; // blank line ends this numbered item
        // If the next line is itself a new numbered item, heading, or special line, stop
        if (NUMBERED_ITEM_RE.test(cur) ||
            COURT_TITLE_RE.test(cur) || ALL_CAPS_RE.test(cur) || /^VERSUS$/i.test(cur) ||
            cur.startsWith("<!--") || cur.startsWith("<table") ||
            PARTY_ROLE_RE.test(cur) || PARTY_ROLE_LINE_RE.test(cur) ||
            STANDALONE_ROLE_RE.test(cur) ||
            THROUGH_RE.test(cur) ||
            SECTION_HEADINGS.has(cur.toUpperCase().replace(/:$/, "")) ||
            (CASE_NUMBER_RE.test(cur) && /NO\.|____/i.test(cur)) ||
            (TITLE_CASE_NUMBER_RE.test(cur) && /No\.|____/i.test(cur))) {
          break;
        }
        // Continuation of the same numbered item (wrap onto next line)
        pLines.push(esc(cur));
        i++;
      }
      // Numbered items in party blocks: indent slightly like court format
      blocks.push(`<p style="text-indent:1.5em">${pLines.join(" ")}</p>`);
      continue;
    }

    // Everything else → plain paragraph (numbers stay as text, not <ol>)
    const pLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i].trim();
      if (!cur) break;
      if (COURT_TITLE_RE.test(cur) || ALL_CAPS_RE.test(cur) || /^VERSUS$/i.test(cur) ||
          cur.startsWith("<!--") || cur.startsWith("<table") ||
          PARTY_ROLE_RE.test(cur) || PARTY_ROLE_LINE_RE.test(cur) ||
          STANDALONE_ROLE_RE.test(cur) ||
          THROUGH_RE.test(cur) ||
          NUMBERED_ITEM_RE.test(cur) ||
          SECTION_HEADINGS.has(cur.toUpperCase().replace(/:$/,"")) ||
          (CASE_NUMBER_RE.test(cur) && /NO\.|____/i.test(cur)) ||
          (TITLE_CASE_NUMBER_RE.test(cur) && /No\.|____/i.test(cur))) {
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
