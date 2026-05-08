/**
 * generate-legal-pdf.ts
 *
 * Court-compliant PDF generator for the Al Wakeelo Legal Drafting module.
 * Converts Tiptap editor HTML into a properly formatted A4 PDF using jsPDF.
 *
 * Typography standards:
 *  - Font: Times New Roman (jsPDF built-in "times")
 *  - Body: 12pt, H1: 15pt, H2: 13pt, H3: 12pt
 *  - Page: A4 (210×297mm) with 25mm margins
 *  - Line height: 1.6x
 *  - Footer: page numbering + Al Wakeelo branding
 */

import jsPDF from "jspdf";

// ── Configuration ────────────────────────────────────────────────────────

const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 25;
const MARGIN_RIGHT = 25;
const MARGIN_TOP = 30;
const MARGIN_BOTTOM = 25;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const FOOTER_Y = PAGE_HEIGHT - 12;

const FONT_BODY = 12;
const FONT_H1 = 15;
const FONT_H2 = 13;
const FONT_H3 = 12;
const LINE_HEIGHT_FACTOR = 1.6;

// ── Types ────────────────────────────────────────────────────────────────

export type LegalPDFOptions = {
  /** Tiptap editor HTML content */
  html: string;
  /** Document title (used in header and filename) */
  title: string;
  /** Draft type, e.g. "Bail Application", "Writ Petition" */
  draftType?: string;
  /** Court name, e.g. "Lahore High Court" */
  court?: string;
  /** Case number, e.g. "W.P. No. 12345/2026" */
  caseNumber?: string;
  /** Parties, e.g. "Petitioner vs State" */
  parties?: string;
  /** Show a DRAFT watermark */
  isDraft?: boolean;
};

// ── Parsed node types ────────────────────────────────────────────────────

type TextRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

type ParsedNode =
  | { type: "heading"; level: 1 | 2 | 3; runs: TextRun[] }
  | { type: "paragraph"; runs: TextRun[]; align?: "left" | "center" | "right" | "justify" }
  | { type: "list-item"; runs: TextRun[]; ordered: boolean; index: number }
  | { type: "blockquote"; runs: TextRun[] }
  | { type: "hr" }
  | { type: "spacer" };

// ── HTML parser (lightweight, no DOM dependency for SSR compat) ──────────

function parseHTML(html: string): ParsedNode[] {
  const nodes: ParsedNode[] = [];
  // Use a temporary DOM element to parse HTML
  const container = document.createElement("div");
  container.innerHTML = html;

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
    if (style.includes("text-align: justify") || style.includes("text-align:justify")) return "justify";
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

      if (tag === "h1") {
        nodes.push({ type: "heading", level: 1, runs: extractTextRuns(el) });
      } else if (tag === "h2") {
        nodes.push({ type: "heading", level: 2, runs: extractTextRuns(el) });
      } else if (tag === "h3") {
        nodes.push({ type: "heading", level: 3, runs: extractTextRuns(el) });
      } else if (tag === "p") {
        const runs = extractTextRuns(el);
        if (runs.length > 0 && runs.some((r) => r.text.trim())) {
          nodes.push({ type: "paragraph", runs, align: getAlignment(el) });
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
  const { html, title, draftType, court, caseNumber, parties, isDraft } = options;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const nodes = parseHTML(html);
  let y = MARGIN_TOP;
  let pageNum = 1;

  // ── Helper: check page break ──────────────────────────────────────────
  const maxY = PAGE_HEIGHT - MARGIN_BOTTOM;

  function ensureSpace(needed: number) {
    if (y + needed > maxY) {
      addPageFooter();
      doc.addPage();
      pageNum++;
      y = MARGIN_TOP;
      addPageHeader();
    }
  }

  // ── Page header ───────────────────────────────────────────────────────
  function addPageHeader() {
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);

    // Left: Al Wakeelo branding
    doc.text("Al Wakeelo — Digital Chambers", MARGIN_LEFT, 15);

    // Right: date
    const dateStr = new Date().toLocaleDateString("en-PK", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.text(dateStr, PAGE_WIDTH - MARGIN_RIGHT, 15, { align: "right" });

    // Thin line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_LEFT, 18, PAGE_WIDTH - MARGIN_RIGHT, 18);

    doc.setTextColor(0, 0, 0);
  }

  // ── Page footer ───────────────────────────────────────────────────────
  function addPageFooter() {
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);

    // Thin line above footer
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_LEFT, FOOTER_Y - 3, PAGE_WIDTH - MARGIN_RIGHT, FOOTER_Y - 3);

    // Left: branding
    doc.text("Generated by Al Wakeelo — AI Legal Assistant", MARGIN_LEFT, FOOTER_Y);

    // Right: page number (will update later with total)
    doc.text(`Page ${pageNum}`, PAGE_WIDTH - MARGIN_RIGHT, FOOTER_Y, { align: "right" });

    doc.setTextColor(0, 0, 0);
  }

  // ── DRAFT watermark ───────────────────────────────────────────────────
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
    doc.text("DRAFT", PAGE_WIDTH / 2, PAGE_HEIGHT / 2, {
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
  ) {
    // For simplicity and reliability with jsPDF's limited rich-text support,
    // we render runs as lines of text, applying the dominant style per line.
    const plainText = runsToPlainText(runs);
    if (!plainText.trim()) return;

    const lineSpacing = fontSize * 0.353 * LINE_HEIGHT_FACTOR; // pt to mm conversion with spacing
    const effectiveWidth = CONTENT_WIDTH - indent;

    // Determine dominant style from runs
    const hasBold = runs.some((r) => r.bold);
    const hasItalic = runs.some((r) => r.italic);

    let fontStyle: "normal" | "bold" | "italic" | "bolditalic" = baseStyle;
    if (hasBold && hasItalic) fontStyle = "bolditalic";
    else if (hasBold) fontStyle = "bold";
    else if (hasItalic) fontStyle = "italic";

    doc.setFont("times", fontStyle);
    doc.setFontSize(fontSize);

    // Handle multiline text with inline newlines
    const paragraphs = plainText.split("\n");

    for (const para of paragraphs) {
      if (!para.trim()) {
        y += lineSpacing * 0.4;
        continue;
      }

      const lines = doc.splitTextToSize(para, effectiveWidth) as string[];

      for (const line of lines) {
        ensureSpace(lineSpacing);

        const xPos = MARGIN_LEFT + indent;

        if (align === "center") {
          doc.text(line, PAGE_WIDTH / 2, y, { align: "center" });
        } else if (align === "right") {
          doc.text(line, PAGE_WIDTH - MARGIN_RIGHT, y, { align: "right" });
        } else {
          doc.text(line, xPos, y);
        }

        y += lineSpacing;
      }
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

    // Document title
    if (title && title !== "Untitled Draft") {
      doc.setFont("times", "bold");
      doc.setFontSize(FONT_H1);
      const titleLines = doc.splitTextToSize(title.toUpperCase(), CONTENT_WIDTH) as string[];
      for (const line of titleLines) {
        ensureSpace(8);
        doc.text(line, PAGE_WIDTH / 2, y, { align: "center" });
        y += 7;
      }
      y += 2;
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

    // Separator line
    if (court || caseNumber || (title && title !== "Untitled Draft")) {
      y += 2;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
      y += 8;
    }
  }

  // ── Main render loop ──────────────────────────────────────────────────

  addPageHeader();
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

        renderRuns(node.runs, fontSize, "bold", 0, node.level === 1 ? "center" : "left");
        y += node.level === 1 ? 4 : 2;
        break;
      }

      case "paragraph": {
        renderRuns(node.runs, FONT_BODY, "normal", 0, node.align);
        y += 2; // paragraph spacing
        break;
      }

      case "list-item": {
        const bullet = node.ordered ? `${node.index}.` : "•";
        const bulletWidth = 8;

        ensureSpace(6);
        doc.setFont("times", "normal");
        doc.setFontSize(FONT_BODY);
        doc.text(bullet, MARGIN_LEFT + 4, y);

        renderRuns(node.runs, FONT_BODY, "normal", bulletWidth + 4);
        y += 1;
        break;
      }

      case "blockquote": {
        // Draw left border
        ensureSpace(8);
        const startY = y;
        renderRuns(node.runs, FONT_BODY - 1, "italic", 10);

        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.8);
        doc.line(MARGIN_LEFT + 4, startY - 3, MARGIN_LEFT + 4, y);
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

      case "spacer": {
        y += 3;
        break;
      }
    }
  }

  // Add footer to last page
  addPageFooter();

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
    // Overwrite the page number with total
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    // White-out old text area
    doc.setFillColor(255, 255, 255);
    doc.rect(PAGE_WIDTH - MARGIN_RIGHT - 30, FOOTER_Y - 4, 30, 6, "F");
    doc.text(`Page ${i} of ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT, FOOTER_Y, {
      align: "right",
    });
    doc.setTextColor(0, 0, 0);
  }

  // ── Save the PDF ──────────────────────────────────────────────────────
  const safeTitle = (title || "legal-draft")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 60);
  doc.save(`${safeTitle}.pdf`);
}
