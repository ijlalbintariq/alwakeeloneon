/**
 * Converts plain-text legal drafts (AI output or legacy saved text)
 * into structured HTML suitable for the Tiptap editor.
 *
 * Pakistani court formatting conventions:
 *  - "IN THE COURT …" / "IN THE HIGH COURT …" → centred H1
 *  - ALL-CAPS headings (PRAYER, GROUNDS, VERIFICATION …) → H2
 *  - Numbered lines (1. / 2. / 3.) → single continuous ordered list
 *  - Lettered lines (a) / b) / (i)) → ordered list (lower-alpha)
 *  - HTML table passthrough (INDEX OF DOCUMENTS)
 *  - AFFIDAVIT section → page-break-before for print
 *  - Blank-line separated paragraphs → <p>
 */

// ── helpers ────────────────────────────────────────────────────────────────

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const COURT_TITLE_RE =
  /^IN THE (COURT|HIGH COURT|HONOURABLE|SUPREME COURT|FAMILY COURT|SESSIONS)/i;

const ALL_CAPS_HEADING_RE =
  /^[A-Z][A-Z\s:&,./()'-]{4,}$/;

const NUMBERED_LINE_RE = /^(\d{1,3})[.)]\s+/;
const LETTERED_LINE_RE = /^(?:\(?([a-z])\)|\(([ivxlc]+)\))\s+/i;

const SECTION_HEADINGS = new Set([
  "PRAYER",
  "PRAYER:",
  "GROUNDS",
  "GROUNDS:",
  "GROUNDS OF APPEAL",
  "GROUNDS OF APPEAL:",
  "GROUNDS FOR BAIL",
  "GROUNDS FOR BAIL:",
  "VERIFICATION",
  "VERIFICATION:",
  "BRIEF FACTS",
  "BRIEF FACTS:",
  "RESPECTFULLY SHEWETH",
  "RESPECTFULLY SHEWETH:",
  "RESPECTFULLY SUBMITTED",
  "RESPECTFULLY SUBMITTED:",
  "VAKALATNAMA",
  "AFFIDAVIT",
  "AFFIDAVIT:",
  "LEGAL NOTICE",
  "INTERIM RELIEF",
  "INTERIM RELIEF:",
  "INDEX OF DOCUMENTS",
]);

// ── main converter ─────────────────────────────────────────────────────────

export function plainTextToTiptapHTML(raw: string): string {
  if (!raw || typeof raw !== "string") return "<p></p>";

  // Already HTML — return as-is
  if (raw.trimStart().startsWith("<")) return raw;

  const lines = raw.split(/\r?\n/);
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blank lines
    if (!trimmed) {
      i++;
      continue;
    }

    // ── HTML table passthrough (INDEX OF DOCUMENTS) ──────────────
    if (trimmed.startsWith("<!-- INDEX_TABLE_START") || trimmed.startsWith("<table")) {
      // Collect all HTML lines until closing tag
      const htmlLines: string[] = [];
      while (i < lines.length) {
        htmlLines.push(lines[i]);
        if (lines[i].includes("</table>") || lines[i].includes("INDEX_TABLE_END")) {
          i++;
          break;
        }
        i++;
      }
      blocks.push(htmlLines.join("\n"));
      continue;
    }

    // Skip HTML comments
    if (trimmed.startsWith("<!--")) {
      i++;
      continue;
    }

    // ── Court title (centred H1) ──────────────────────────────────
    if (COURT_TITLE_RE.test(trimmed)) {
      blocks.push(`<h1 style="text-align: center">${esc(trimmed)}</h1>`);
      i++;
      continue;
    }

    // ── "VERSUS" line (centred, bold) ─────────────────────────────
    if (/^VERSUS$/i.test(trimmed)) {
      blocks.push(`<p style="text-align: center"><strong>${esc(trimmed)}</strong></p>`);
      i++;
      continue;
    }

    // ── AFFIDAVIT heading — page break before for print ──────────
    if (/^AFFIDAVIT\s*:?\s*$/i.test(trimmed)) {
      blocks.push(`<h2 data-page-break="true" class="page-break">${esc(trimmed)}</h2>`);
      i++;
      continue;
    }

    // ── Known section headings ────────────────────────────────────
    if (SECTION_HEADINGS.has(trimmed.toUpperCase().replace(/:$/, "")) ||
        SECTION_HEADINGS.has(trimmed.toUpperCase())) {
      blocks.push(`<h2>${esc(trimmed)}</h2>`);
      i++;
      continue;
    }

    // ── ALL-CAPS headings (≥5 chars, all uppercase) ──────────────
    if (ALL_CAPS_HEADING_RE.test(trimmed) && trimmed.length >= 5) {
      const isCentredTitle =
        /^(SUIT FOR|APPLICATION|PETITION|MEMORANDUM|CONSTITUTIONAL|CRIMINAL BAIL)/i.test(trimmed);
      if (isCentredTitle) {
        blocks.push(`<h2 style="text-align: center">${esc(trimmed)}</h2>`);
      } else {
        blocks.push(`<h2>${esc(trimmed)}</h2>`);
      }
      i++;
      continue;
    }

    // ── Numbered list (1. / 2. / 3.) — CONTINUOUS single <ol> ────
    if (NUMBERED_LINE_RE.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        if (!cur) {
          // Allow blank lines within a numbered sequence — check if next non-blank is numbered
          let peek = i + 1;
          while (peek < lines.length && !lines[peek].trim()) peek++;
          if (peek < lines.length && NUMBERED_LINE_RE.test(lines[peek].trim())) {
            i++;
            continue;
          }
          break;
        }
        const m = cur.match(NUMBERED_LINE_RE);
        if (!m) break;
        items.push(`<li><p>${esc(cur.replace(NUMBERED_LINE_RE, ""))}</p></li>`);
        i++;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // ── Lettered list (a) / b) or (i) / (ii)) ────────────────────
    if (LETTERED_LINE_RE.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        if (!LETTERED_LINE_RE.test(cur)) break;
        items.push(`<li><p>${esc(cur.replace(LETTERED_LINE_RE, ""))}</p></li>`);
        i++;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // ── Regular paragraph ────────────────────────────────────────
    const pLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i].trim();
      if (!cur) break;
      if (
        COURT_TITLE_RE.test(cur) ||
        ALL_CAPS_HEADING_RE.test(cur) ||
        NUMBERED_LINE_RE.test(cur) ||
        LETTERED_LINE_RE.test(cur) ||
        /^VERSUS$/i.test(cur) ||
        cur.startsWith("<!--") ||
        cur.startsWith("<table") ||
        SECTION_HEADINGS.has(cur.toUpperCase().replace(/:$/, ""))
      ) {
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

/**
 * Detect whether a string is already HTML or plain text.
 */
export function isHTMLContent(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trimStart();
  return trimmed.startsWith("<") && (
    trimmed.startsWith("<p") ||
    trimmed.startsWith("<h") ||
    trimmed.startsWith("<ol") ||
    trimmed.startsWith("<ul") ||
    trimmed.startsWith("<div") ||
    trimmed.startsWith("<!") ||
    trimmed.startsWith("<br") ||
    trimmed.startsWith("<table")
  );
}
