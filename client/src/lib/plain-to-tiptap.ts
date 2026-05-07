/**
 * Converts plain-text legal drafts (AI output or legacy saved text)
 * into structured HTML suitable for the Tiptap editor.
 *
 * Recognises Pakistani court formatting conventions:
 *  - "IN THE COURT …" / "IN THE HIGH COURT …" → centred H1
 *  - ALL-CAPS headings (PRAYER, GROUNDS, VERIFICATION …) → H2
 *  - Numbered lines (1. / 2.) → ordered list
 *  - Lettered lines (a) / b) / (i)) → ordered list (lower-alpha / lower-roman)
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
  /^IN THE (COURT|HIGH COURT|SUPREME COURT|FAMILY COURT|SESSIONS)/i;

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
  "LEGAL NOTICE",
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

    // Skip blank lines (they become paragraph breaks naturally)
    if (!trimmed) {
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

    // ── Known section headings ────────────────────────────────────
    if (SECTION_HEADINGS.has(trimmed.toUpperCase().replace(/:$/, "")) ||
        SECTION_HEADINGS.has(trimmed.toUpperCase())) {
      blocks.push(`<h2>${esc(trimmed)}</h2>`);
      i++;
      continue;
    }

    // ── ALL-CAPS headings (≥5 chars, all uppercase) ──────────────
    if (ALL_CAPS_HEADING_RE.test(trimmed) && trimmed.length >= 5) {
      // Distinguish H2 (main sections) from centred titles
      const isCentredTitle =
        /^(SUIT FOR|APPLICATION|PETITION|MEMORANDUM|CONSTITUTIONAL)/i.test(trimmed);
      if (isCentredTitle) {
        blocks.push(`<h2 style="text-align: center">${esc(trimmed)}</h2>`);
      } else {
        blocks.push(`<h2>${esc(trimmed)}</h2>`);
      }
      i++;
      continue;
    }

    // ── Numbered list (1. / 2. / 3.) ─────────────────────────────
    if (NUMBERED_LINE_RE.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
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
    // Collect consecutive non-blank, non-special lines into one <p>
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
    trimmed.startsWith("<br")
  );
}
