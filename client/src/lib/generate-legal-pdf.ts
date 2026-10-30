/**
 * generate-legal-pdf.ts
 *
 * Court-compliant PDF generator for the Al Wakeelo Legal Drafting module.
 * Converts Tiptap editor HTML into a properly paginated court PDF using jsPDF.
 *
 * Typography standards:
 *  - Font: Times New Roman (jsPDF built-in "times")
 *  - Body: 13pt, H1/H2: 14pt, H3: 13pt
 *  - Page: selectable Legal or A4 court profile
 *  - Line height: 1.3x
 *  - Footer: page numbering
 */

import jsPDF from "jspdf";
import {
  DEFAULT_LEGAL_PAGE_PROFILE_ID,
  resolveLegalPageProfile,
  type LegalPageProfileId,
} from "./legal-page-layout";

// ── Configuration (must match generate-legal-docx.ts) ────────────────────

const FONT_BODY = 13;
const FONT_H1 = 14;
const FONT_H2 = 14;
const FONT_H3 = 13;
const LINE_HEIGHT_FACTOR = 1.3; // match DOCX default

// ── Types ────────────────────────────────────────────────────────────────

export type LegalPDFOptions = {
  /** Tiptap editor HTML content */
  html: string;
  /** Document title (used for the filename) */
  title: string;
  /** Draft type, e.g. "Bail Application", "Writ Petition" */
  draftType?: string;
  /** Court name, e.g. "Lahore High Court" */
  court?: string;
  /** Case number, e.g. "W.P. No. 12345/2026" */
  caseNumber?: string;
  /** Parties, e.g. "Petitioner vs State" */
  parties?: string;
  /** Show a diagonal watermark */
  isDraft?: boolean;
  /** Watermark text; defaults to "DRAFT" */
  watermarkText?: string;
  /** Paper size and court margin profile */
  pageProfileId?: LegalPageProfileId;
};

// ── Parsed node types ────────────────────────────────────────────────────

type TextRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

type TableCell = {
  text: string;
  bold: boolean;
};

type TableRow = {
  cells: TableCell[];
  isHeader: boolean;
};

type ParsedNode =
  | { type: "heading"; level: 1 | 2 | 3; runs: TextRun[]; align?: "left" | "center" | "right" | "justify"; lineHeight?: number }
  | { type: "paragraph"; runs: TextRun[]; align?: "left" | "center" | "right" | "justify"; lineHeight?: number; indentMm?: number }
  | { type: "list-item"; runs: TextRun[]; ordered: boolean; index: number }
  | { type: "blockquote"; runs: TextRun[] }
  | { type: "table"; rows: TableRow[] }
  | { type: "hr" }
  | { type: "spacer" }
  | { type: "page-break" };

// ── HTML parser (lightweight, no DOM dependency for SSR compat) ──────────

function parseHTML(html: string): ParsedNode[] {
  const nodes: ParsedNode[] = [];
  // Parse HTML using DOMParser for safe inert DOM parsing (prevents inline script execution during parse)
  let container: Element;
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    container = doc.body;
  } else {
    container = document.createElement("div");
    container.innerHTML = html;
  }

  function extractTextRuns(el: Node, parentBold = false, parentItalic = false, parentUnderline = false): TextRun[] {
    const runs: TextRun[] = [];
    el.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent || "";
        if (text) {
          runs.push({ text, bold: parentBold, italic: parentItalic, underline: parentUnderline });
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = (child as Element).tagName.toLowerCase();
        let b = parentBold;
        let i = parentItalic;
        let u = parentUnderline;
        if (tag === "strong" || tag === "b") b = true;
        if (tag === "em" || tag === "i") i = true;
        if (tag === "u") u = true;
        // Citation chip — render as bold
        if ((child as Element).classList?.contains("citation-chip")) {
          const citationText = (child as Element).textContent || "";
          if (citationText) {
            runs.push({ text: citationText, bold: true, italic: false, underline: false });
          }
          return;
        }
        if (tag === "br") {
          runs.push({ text: "\n", bold: false, italic: false, underline: false });
          return;
        }
        runs.push(...extractTextRuns(child, b, i, u));
      }
    });
    return runs;
  }

  function getAlignment(el: Element): "left" | "center" | "right" | "justify" | undefined {
    const style = el.getAttribute("style") || "";
    if (style.includes("text-align: center") || style.includes("text-align:center")) return "center";
    if (style.includes("text-align: right") || style.includes("text-align:right")) return "right";
    if (style.includes("text-align: left") || style.includes("text-align:left")) return "left";
    if (style.includes("text-align: justify") || style.includes("text-align:justify")) return "justify";
    return undefined;
  }

  function getTextIndentMm(el: Element): number | undefined {
    const style = el.getAttribute("style") || "";
    const match = style.match(/text-indent:\s*(-?[\d.]+)\s*(in|mm|cm|pt|px|em)?/i);
    if (!match) return undefined;
    const value = Number.parseFloat(match[1]);
    if (!Number.isFinite(value)) return undefined;
    switch ((match[2] || "px").toLowerCase()) {
      case "in": return value * 25.4;
      case "mm": return value;
      case "cm": return value * 10;
      case "pt": return value * (25.4 / 72);
      case "em": return value * 13 * (25.4 / 72);
      default: return value * (25.4 / 96);
    }
  }

  function getElementLineHeight(el: Element): number | undefined {
    const style = el.getAttribute("style") || "";
    const match = style.match(/line-height:\s*([\d.]+)/);
    if (match) return parseFloat(match[1]);
    return undefined;
  }

  function processChildren(parent: Element) {
    parent.childNodes.forEach((child) => {
      if (child.nodeType !== Node.ELEMENT_NODE) {
        // Bare text nodes at top level — treat as paragraph
        const text = child.textContent?.trim();
        if (text) {
          nodes.push({ type: "paragraph", runs: [{ text, bold: false, italic: false, underline: false }] });
        }
        return;
      }
      const el = child as Element;
      const tag = el.tagName.toLowerCase();

      const className = el.getAttribute("class") || "";
      const style = el.getAttribute("style") || "";
      if (className.includes("page-break") || el.hasAttribute("data-page-break") || style.includes("page-break-before: always")) {
        nodes.push({ type: "page-break" });
        if (el.getAttribute("data-type") === "legal-page-break") return;
      }

      if (tag === "h1") {
        nodes.push({ type: "heading", level: 1, runs: extractTextRuns(el), align: getAlignment(el), lineHeight: getElementLineHeight(el) });
      } else if (tag === "h2") {
        nodes.push({ type: "heading", level: 2, runs: extractTextRuns(el), align: getAlignment(el), lineHeight: getElementLineHeight(el) });
      } else if (tag === "h3") {
        nodes.push({ type: "heading", level: 3, runs: extractTextRuns(el), align: getAlignment(el), lineHeight: getElementLineHeight(el) });
      } else if (tag === "p") {
        const runs = extractTextRuns(el);
        if (runs.length > 0 && runs.some((r) => r.text.trim())) {
          nodes.push({
            type: "paragraph",
            runs,
            align: getAlignment(el),
            lineHeight: getElementLineHeight(el),
            indentMm: getTextIndentMm(el),
          });
        } else {
          nodes.push({ type: "spacer" });
        }
      } else if (tag === "ul" || tag === "ol") {
        const ordered = tag === "ol";
        let idx = 0;
        el.querySelectorAll(":scope > li").forEach((li) => {
          idx++;
          const runs = extractTextRuns(li);
          nodes.push({ type: "list-item", runs, ordered, index: idx });
        });
      } else if (tag === "table") {
        // Parse table into structured rows/cells
        const rows: TableRow[] = [];
        el.querySelectorAll("tr").forEach((tr) => {
          const cells: TableCell[] = [];
          const isHeader = tr.closest("thead") !== null || tr.querySelectorAll("th").length > 0;
          tr.querySelectorAll("th, td").forEach((cell) => {
            const text = (cell.textContent || "").trim();
            const bold = cell.tagName.toLowerCase() === "th";
            cells.push({ text, bold });
          });
          if (cells.length > 0) {
            rows.push({ cells, isHeader });
          }
        });
        if (rows.length > 0) {
          nodes.push({ type: "table", rows });
        }
      } else if (tag === "blockquote") {
        // Blockquotes may contain <p> children
        const runs: TextRun[] = [];
        el.querySelectorAll("p").forEach((p) => {
          runs.push(...extractTextRuns(p, false, true));
          runs.push({ text: "\n", bold: false, italic: true, underline: false });
        });
        if (runs.length === 0) {
          runs.push(...extractTextRuns(el, false, true));
        }
        nodes.push({ type: "blockquote", runs });
      } else if (tag === "hr") {
        nodes.push({ type: "hr" });
      } else if (tag === "div" || tag === "section" || tag === "article") {
        // Recurse into container elements
        processChildren(el);
      } else {
        // Fallback — treat as paragraph
        const runs = extractTextRuns(el);
        if (runs.length > 0 && runs.some((r) => r.text.trim())) {
          nodes.push({ type: "paragraph", runs });
        }
      }
    });
  }

  processChildren(container);
  return nodes;
}

// ── Runs to plain text (for jsPDF splitTextToSize) ──────────────────────

function runsToPlainText(runs: TextRun[]): string {
  return runs.map((r) => r.text).join("");
}

// ── PDF Renderer ─────────────────────────────────────────────────────────

export function generateLegalPDF(options: LegalPDFOptions): void {
  const {
    html,
    title,
    draftType,
    court,
    caseNumber,
    parties,
    isDraft,
    watermarkText,
    pageProfileId = DEFAULT_LEGAL_PAGE_PROFILE_ID,
  } = options;
  const pageProfile = resolveLegalPageProfile(pageProfileId);
  const PAGE_WIDTH = pageProfile.widthMm;
  const PAGE_HEIGHT = pageProfile.heightMm;
  const MARGIN_LEFT = pageProfile.marginLeftMm;
  const MARGIN_RIGHT = pageProfile.marginRightMm;
  const MARGIN_TOP = pageProfile.marginTopMm;
  const MARGIN_BOTTOM = pageProfile.marginBottomMm;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const FOOTER_Y = PAGE_HEIGHT - Math.min(12, MARGIN_BOTTOM / 2);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [PAGE_WIDTH, PAGE_HEIGHT] });
  const nodes = parseHTML(html);
  let y = MARGIN_TOP;

  // ── Helper: check page break ──────────────────────────────────────────
  const maxY = PAGE_HEIGHT - MARGIN_BOTTOM;

  function startNewPage() {
    doc.addPage([PAGE_WIDTH, PAGE_HEIGHT], "portrait");
    y = MARGIN_TOP;
  }

  function ensureSpace(needed: number): boolean {
    if (y + needed > maxY) {
      startNewPage();
      return true;
    }
    return false;
  }

  // ── Diagonal watermark ────────────────────────────────────────────────
  const watermarkLabel = (watermarkText || "DRAFT").trim().toUpperCase();
  function addDraftWatermark() {
    if (!isDraft) return;
    doc.setFont("times", "bold");
    doc.setFontSize(60);
    doc.setTextColor(230, 230, 230);

    // Save the current state
    const gState = (doc as any).GState ? new (doc as any).GState({ opacity: 0.15 }) : null;
    if (gState) {
      (doc as any).setGState(gState);
    }

    // Rotate and center the text
    doc.text(watermarkLabel, PAGE_WIDTH / 2, PAGE_HEIGHT / 2, {
      align: "center",
      angle: 45,
    });

    // Restore opacity
    if (gState) {
      const normalState = new (doc as any).GState({ opacity: 1 });
      (doc as any).setGState(normalState);
    }

    doc.setTextColor(0, 0, 0);
  }

  // ── Render text runs with mixed formatting ────────────────────────────
  function renderRuns(
    runs: TextRun[],
    fontSize: number,
    baseStyle: "normal" | "bold" | "italic" = "normal",
    indent = 0,
    align?: "left" | "center" | "right" | "justify",
    lineHeightOverride?: number,
  ) {
    if (!runsToPlainText(runs).trim()) return;
    const lineSpacing = fontSize * 0.353 * (lineHeightOverride ?? LINE_HEIGHT_FACTOR);
    const effectiveWidth = Math.max(10, CONTENT_WIDTH - indent);
    const setRunFont = (run: TextRun) => {
      const bold = run.bold || baseStyle === "bold";
      const italic = run.italic || baseStyle === "italic";
      doc.setFont("times", bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal");
      doc.setFontSize(fontSize);
    };
    type Line = { runs: TextRun[]; width: number; paragraphEnd: boolean };
    const lines: Line[] = [];
    let line: Line = { runs: [], width: 0, paragraphEnd: false };
    const flush = (paragraphEnd = false) => {
      while (line.runs.length && /^\s+$/.test(line.runs[line.runs.length - 1].text)) {
        const last = line.runs.pop()!;
        setRunFont(last);
        line.width -= doc.getTextWidth(last.text);
      }
      lines.push({ ...line, paragraphEnd });
      line = { runs: [], width: 0, paragraphEnd: false };
    };
    const append = (text: string, run: TextRun) => {
      setRunFont(run);
      let width = doc.getTextWidth(text);
      if (line.width + width > effectiveWidth && line.runs.length) flush();
      if (!line.runs.length && /^\s+$/.test(text)) return;
      // A single long URL or reference must also fit inside the court margins.
      if (width > effectiveWidth) {
        for (const character of Array.from(text)) {
          setRunFont(run);
          const characterWidth = doc.getTextWidth(character);
          if (line.width + characterWidth > effectiveWidth && line.runs.length) flush();
          line.runs.push({ ...run, text: character });
          line.width += characterWidth;
        }
      } else {
        line.runs.push({ ...run, text });
        line.width += width;
      }
    };
    for (const run of runs) {
      for (const token of run.text.split(/(\n|[^\S\n]+)/).filter(Boolean)) {
        if (token === "\n") flush(true);
        else append(token, run);
      }
    }
    if (line.runs.length) flush(true);
    else if (lines.length) lines[lines.length - 1].paragraphEnd = true;

    let lineIndex = 0;
    while (lineIndex < lines.length) {
      let availableLines = Math.floor((maxY - y) / lineSpacing);
      const remainingLines = lines.length - lineIndex;
      if (availableLines < 2 && remainingLines > availableLines && y > MARGIN_TOP + 1) {
        startNewPage();
        availableLines = Math.floor((maxY - y) / lineSpacing);
      }
      let count = Math.min(remainingLines, Math.max(1, availableLines));
      if (remainingLines > count && remainingLines - count === 1 && count > 1) count--;
      for (let offset = 0; offset < count; offset++) {
        const current = lines[lineIndex + offset];
        const spaces = current.runs.reduce((total, run) => total + (run.text.match(/\s/g)?.length || 0), 0);
        const gap = align === "justify" && !current.paragraphEnd && spaces
          ? Math.max(0, effectiveWidth - current.width) / spaces : 0;
        let x = MARGIN_LEFT + indent;
        if (align === "center") x += (effectiveWidth - current.width) / 2;
        else if (align === "right") x += effectiveWidth - current.width;
        for (const run of current.runs) {
          setRunFont(run);
          const width = doc.getTextWidth(run.text) + gap * (run.text.match(/\s/g)?.length || 0);
          doc.text(run.text, x, y);
          if (run.underline) {
            doc.setLineWidth(0.2);
            doc.line(x, y + 0.7, x + width, y + 0.7);
          }
          x += width;
        }
        y += current.runs.length ? lineSpacing : lineSpacing * 0.4;
      }
      lineIndex += count;
      if (lineIndex < lines.length) startNewPage();
    }
  }

  // ── Title Block ───────────────────────────────────────────────────────
  function renderTitleBlock() {
    // Court name
    if (court) {
      doc.setFont("times", "bold");
      doc.setFontSize(13);
      doc.text(court.toUpperCase(), PAGE_WIDTH / 2, y, { align: "center" });
      y += 7;
    }

    // Case number
    if (caseNumber) {
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.text(caseNumber, PAGE_WIDTH / 2, y, { align: "center" });
      y += 6;
    }

    // Draft type
    if (draftType) {
      doc.setFont("times", "italic");
      doc.setFontSize(11);
      doc.text(`(${draftType})`, PAGE_WIDTH / 2, y, { align: "center" });
      y += 6;
    }

    // Parties
    if (parties) {
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.text(parties, PAGE_WIDTH / 2, y, { align: "center" });
      y += 6;
    }

    if (court || caseNumber || draftType || parties) y += 4;
  }

  // ── Main render loop ──────────────────────────────────────────────────

  addDraftWatermark();
  renderTitleBlock();

  for (const node of nodes) {
    switch (node.type) {
      case "heading": {
        const fontSize = node.level === 1 ? FONT_H1 : node.level === 2 ? FONT_H2 : FONT_H3;
        const spacing = node.level === 1 ? 10 : node.level === 2 ? 8 : 6;

        // Add space before heading (prevent orphaned heading at bottom)
        ensureSpace(spacing + 12);
        y += node.level === 1 ? 4 : 2;

        renderRuns(
          node.runs,
          fontSize,
          "bold",
          0,
          node.align || (node.level === 1 ? "center" : "left"),
          node.lineHeight,
        );
        y += node.level === 1 ? 4 : 2;
        break;
      }

      case "paragraph": {
        renderRuns(node.runs, FONT_BODY, "normal", node.indentMm || 0, node.align || "justify", node.lineHeight);
        y += 2; // paragraph spacing
        break;
      }

      case "list-item": {
        const bullet = node.ordered ? `${node.index}.` : "•";
        const bulletWidth = 8;

        ensureSpace(FONT_BODY * 0.353 * LINE_HEIGHT_FACTOR * 2);
        doc.setFont("times", "normal");
        doc.setFontSize(FONT_BODY);
        doc.text(bullet, MARGIN_LEFT + 4, y);

        renderRuns(node.runs, FONT_BODY, "normal", bulletWidth + 4);
        y += 1;
        break;
      }

      case "blockquote": {
        ensureSpace(8);
        renderRuns(node.runs, FONT_BODY - 1, "italic", 10);
        y += 3;
        break;
      }

      case "hr": {
        ensureSpace(8);
        y += 3;
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
        y += 5;
        break;
      }

      case "table": {
        const { rows } = node;
        if (rows.length === 0) break;

        const numCols = Math.max(...rows.map((r) => r.cells.length));
        if (numCols === 0) break;

        const TABLE_FONT = 10;
        const CELL_PAD_X = 3;
        const CELL_PAD_Y = 2.5;
        const ROW_MIN_H = TABLE_FONT * 0.353 * 1.4 + CELL_PAD_Y * 2;

        // Calculate column widths proportionally based on header text length
        const headerRow = rows.find((r) => r.isHeader) || rows[0];
        const rawWidths = Array.from({ length: numCols }, (_, ci) => {
          const text = headerRow.cells[ci]?.text || "";
          return Math.max(text.length, 4); // minimum 4 chars
        });
        const totalRaw = rawWidths.reduce((a, b) => a + b, 0);
        const colWidths = rawWidths.map((w) => (w / totalRaw) * CONTENT_WIDTH);

        for (const row of rows) {
          // Calculate row height based on longest cell content
          let maxLines = 1;
          const cellLines: string[][] = [];
          for (let ci = 0; ci < numCols; ci++) {
            const text = row.cells[ci]?.text || "";
            doc.setFont("times", row.cells[ci]?.bold ? "bold" : "normal");
            doc.setFontSize(TABLE_FONT);
            const lines = doc.splitTextToSize(text, colWidths[ci] - CELL_PAD_X * 2) as string[];
            cellLines.push(lines);
            maxLines = Math.max(maxLines, lines.length);
          }
          const tableLineHeight = TABLE_FONT * 0.353 * 1.4;
          let firstLine = 0;
          while (firstLine < maxLines) {
            let capacity = Math.floor((maxY - y - CELL_PAD_Y * 2) / tableLineHeight);
            if (capacity < 1) {
              startNewPage();
              capacity = Math.max(1, Math.floor((maxY - y - CELL_PAD_Y * 2) / tableLineHeight));
            }
            const lineCount = Math.min(capacity, maxLines - firstLine);
            const rowH = Math.max(ROW_MIN_H, lineCount * tableLineHeight + CELL_PAD_Y * 2);
            let cellX = MARGIN_LEFT;
            for (let ci = 0; ci < numCols; ci++) {
              const cellW = colWidths[ci];
              const isBold = row.cells[ci]?.bold || row.isHeader;
              if (row.isHeader) {
                doc.setFillColor(26, 35, 50);
                doc.rect(cellX, y, cellW, rowH, "F");
              }
              doc.setDrawColor(80, 80, 80);
              doc.setLineWidth(0.3);
              doc.rect(cellX, y, cellW, rowH, "S");
              doc.setFont("times", isBold ? "bold" : "normal");
              doc.setFontSize(TABLE_FONT);
              doc.setTextColor(row.isHeader ? 255 : 0, row.isHeader ? 255 : 0, row.isHeader ? 255 : 0);
              let textY = y + CELL_PAD_Y + TABLE_FONT * 0.353;
              for (const textLine of (cellLines[ci] || []).slice(firstLine, firstLine + lineCount)) {
                doc.text(textLine, cellX + CELL_PAD_X, textY);
                textY += tableLineHeight;
              }
              cellX += cellW;
            }
            doc.setTextColor(0, 0, 0);
            y += rowH;
            firstLine += lineCount;
            if (firstLine < maxLines) startNewPage();
          }
        }

        y += 4; // spacing after table
        break;
      }

      case "spacer": {
        y += 3;
        break;
      }

      case "page-break": {
        if (y > MARGIN_TOP + 1) { // Only break if not already at the top of a new page
          startNewPage();
        }
        break;
      }
    }
  }

  // Add DRAFT watermark to all pages if needed
  if (isDraft) {
    const totalPages = doc.getNumberOfPages();
    for (let i = 2; i <= totalPages; i++) {
      doc.setPage(i);
      addDraftWatermark();
    }
  }

  // Update page numbers with total count
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${totalPages}`, PAGE_WIDTH / 2, FOOTER_Y, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  // ── Save the PDF ──────────────────────────────────────────────────────
  const safeTitle = (title || "legal-draft")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 60);
  doc.save(`${safeTitle}.pdf`);
}
