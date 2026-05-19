/**
 * generate-legal-docx.ts
 *
 * Court-compliant .docx generator for the Al Wakeelo Legal Drafting module.
 * Uses the `docx` npm package to produce a real OOXML document that opens
 * perfectly in Microsoft Word with preserved formatting.
 *
 * Page: Legal size (8.5" × 14") — standard for Pakistani courts
 * Font: Times New Roman, 13pt body, justified
 * Margins: 1" top/right/bottom, 1.25" left (binding margin)
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  PageOrientation,
  convertInchesToTwip,
  Footer,
  PageNumber,
  NumberFormat,
  TabStopPosition,
  TabStopType,
} from "docx";
import { saveAs } from "file-saver";

// ── Configuration ────────────────────────────────────────────────────────

// Legal page: 8.5" × 14"
const PAGE_W = convertInchesToTwip(8.5);
const PAGE_H = convertInchesToTwip(14);
const MARGIN_TOP = convertInchesToTwip(1);
const MARGIN_BOTTOM = convertInchesToTwip(1);
const MARGIN_LEFT = convertInchesToTwip(1.25); // binding margin
const MARGIN_RIGHT = convertInchesToTwip(1);

const FONT = "Times New Roman";
const FONT_BODY = 26; // half-points (13pt × 2)
const FONT_H1 = 28;   // 14pt
const FONT_H2 = 28;   // 14pt
const FONT_H3 = 26;   // 13pt
const LINE_SPACING = 312; // ~1.3 line spacing (in 240ths of a line = 1.3 × 240)

// ── Types ────────────────────────────────────────────────────────────────

type InlineStyle = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

// ── HTML → docx node converter ───────────────────────────────────────────

function createTextRun(text: string, style: InlineStyle, fontSize = FONT_BODY): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: fontSize,
    bold: style.bold,
    italics: style.italic,
    underline: style.underline ? {} : undefined,
  });
}

function extractRuns(el: Node, parentStyle: InlineStyle, fontSize = FONT_BODY): TextRun[] {
  const runs: TextRun[] = [];

  el.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || "";
      if (text) {
        runs.push(createTextRun(text, parentStyle, fontSize));
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = (child as Element).tagName.toLowerCase();
      const style = { ...parentStyle };

      if (tag === "strong" || tag === "b") style.bold = true;
      if (tag === "em" || tag === "i") style.italic = true;
      if (tag === "u") style.underline = true;

      // Citation chip — render as bold
      if ((child as Element).classList?.contains("citation-chip")) {
        const citationText = (child as Element).textContent || "";
        if (citationText) {
          runs.push(createTextRun(citationText, { bold: true, italic: false, underline: false }, fontSize));
        }
        return;
      }

      if (tag === "br") {
        runs.push(new TextRun({ break: 1, font: FONT, size: fontSize }));
        return;
      }

      runs.push(...extractRuns(child, style, fontSize));
    }
  });

  return runs;
}

function getAlignment(el: Element): (typeof AlignmentType)[keyof typeof AlignmentType] {
  const style = el.getAttribute("style") || "";
  if (style.includes("text-align: center") || style.includes("text-align:center")) return AlignmentType.CENTER;
  if (style.includes("text-align: right") || style.includes("text-align:right")) return AlignmentType.RIGHT;
  if (style.includes("text-align: left") || style.includes("text-align:left")) return AlignmentType.LEFT;
  return AlignmentType.JUSTIFIED; // court default
}

function buildDocxChildren(html: string): (Paragraph | Table)[] {
  const container = document.createElement("div");
  container.innerHTML = html;
  const children: (Paragraph | Table)[] = [];
  const defaultStyle: InlineStyle = { bold: false, italic: false, underline: false };

  function processElement(el: Element) {
    const tag = el.tagName.toLowerCase();

    // ── Headings ──
    if (tag === "h1" || tag === "h2" || tag === "h3") {
      const level = tag === "h1" ? HeadingLevel.HEADING_1 : tag === "h2" ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      const fontSize = tag === "h1" ? FONT_H1 : tag === "h2" ? FONT_H2 : FONT_H3;
      const runs = extractRuns(el, { bold: true, italic: false, underline: false }, fontSize);

      children.push(
        new Paragraph({
          children: runs,
          heading: level,
          alignment: tag === "h1" ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: {
            before: tag === "h1" ? 240 : 160,
            after: tag === "h1" ? 120 : 80,
            line: LINE_SPACING,
          },
        }),
      );
      return;
    }

    // ── Paragraphs ──
    if (tag === "p") {
      const runs = extractRuns(el, defaultStyle);
      if (runs.length === 0 || !el.textContent?.trim()) {
        // Empty paragraph — spacer
        children.push(new Paragraph({ spacing: { before: 60, after: 60 } }));
        return;
      }
      children.push(
        new Paragraph({
          children: runs,
          alignment: getAlignment(el),
          spacing: { after: 60, line: LINE_SPACING },
        }),
      );
      return;
    }

    // ── Lists ──
    if (tag === "ul" || tag === "ol") {
      const ordered = tag === "ol";
      let idx = 0;
      el.querySelectorAll(":scope > li").forEach((li) => {
        idx++;
        const runs = extractRuns(li, defaultStyle);
        const bullet = ordered ? `${idx}. ` : "• ";
        children.push(
          new Paragraph({
            children: [
              createTextRun(bullet, defaultStyle),
              ...runs,
            ],
            indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
            spacing: { after: 40, line: LINE_SPACING },
            alignment: AlignmentType.JUSTIFIED,
          }),
        );
      });
      return;
    }

    // ── Tables ──
    if (tag === "table") {
      const tableRows: TableRow[] = [];
      el.querySelectorAll("tr").forEach((tr) => {
        const isHeaderRow = tr.closest("thead") !== null || tr.querySelectorAll("th").length > 0;
        const cells: TableCell[] = [];

        tr.querySelectorAll("th, td").forEach((cell) => {
          const isHeader = cell.tagName.toLowerCase() === "th" || isHeaderRow;
          const text = (cell.textContent || "").trim();

          cells.push(
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    createTextRun(text, { bold: isHeader, italic: false, underline: false }, 20), // 10pt for tables
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { before: 40, after: 40 },
                }),
              ],
              shading: isHeader
                ? { fill: "1a2332", type: ShadingType.CLEAR, color: "auto" }
                : undefined,
              width: { size: 0, type: WidthType.AUTO },
            }),
          );
        });

        if (cells.length > 0) {
          tableRows.push(new TableRow({ children: cells }));
        }
      });

      if (tableRows.length > 0) {
        children.push(
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
        );
        // Add spacing after table
        children.push(new Paragraph({ spacing: { before: 80, after: 80 } }));
      }
      return;
    }

    // ── Blockquote ──
    if (tag === "blockquote") {
      const runs = extractRuns(el, { bold: false, italic: true, underline: false });
      children.push(
        new Paragraph({
          children: runs,
          indent: { left: convertInchesToTwip(0.5) },
          spacing: { before: 80, after: 80, line: LINE_SPACING },
          alignment: AlignmentType.JUSTIFIED,
        }),
      );
      return;
    }

    // ── Horizontal rule ──
    if (tag === "hr") {
      children.push(
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999" },
          },
          spacing: { before: 120, after: 120 },
        }),
      );
      return;
    }

    // ── Container elements — recurse ──
    if (tag === "div" || tag === "section" || tag === "article" || tag === "tbody" || tag === "thead") {
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          processElement(child as Element);
        } else if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent?.trim();
          if (text) {
            children.push(
              new Paragraph({
                children: [createTextRun(text, defaultStyle)],
                alignment: AlignmentType.JUSTIFIED,
                spacing: { after: 60, line: LINE_SPACING },
              }),
            );
          }
        }
      });
      return;
    }

    // ── Fallback — treat as paragraph ──
    const runs = extractRuns(el, defaultStyle);
    if (runs.length > 0 && el.textContent?.trim()) {
      children.push(
        new Paragraph({
          children: runs,
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 60, line: LINE_SPACING },
        }),
      );
    }
  }

  container.childNodes.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      processElement(child as Element);
    } else if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim();
      if (text) {
        children.push(
          new Paragraph({
            children: [createTextRun(text, defaultStyle)],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 60, line: LINE_SPACING },
          }),
        );
      }
    }
  });

  return children;
}

// ── Public API ────────────────────────────────────────────────────────────

export interface LegalDocxOptions {
  /** Tiptap editor HTML content */
  html: string;
  /** Document title (used in filename) */
  title: string;
}

export async function generateLegalDocx(options: LegalDocxOptions): Promise<void> {
  const { html, title } = options;

  const docChildren = buildDocxChildren(html);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT,
            size: FONT_BODY,
          },
          paragraph: {
            spacing: { line: LINE_SPACING },
            alignment: AlignmentType.JUSTIFIED,
          },
        },
        heading1: {
          run: {
            font: FONT,
            size: FONT_H1,
            bold: true,
            allCaps: true,
          },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 120, line: LINE_SPACING },
          },
        },
        heading2: {
          run: {
            font: FONT,
            size: FONT_H2,
            bold: true,
            allCaps: true,
          },
          paragraph: {
            spacing: { before: 160, after: 80, line: LINE_SPACING },
          },
        },
        heading3: {
          run: {
            font: FONT,
            size: FONT_H3,
            bold: true,
          },
          paragraph: {
            spacing: { before: 120, after: 60, line: LINE_SPACING },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: PAGE_W,
              height: PAGE_H,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: MARGIN_TOP,
              bottom: MARGIN_BOTTOM,
              left: MARGIN_LEFT,
              right: MARGIN_RIGHT,
            },
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.DECIMAL,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES],
                    font: FONT,
                    size: 16, // 8pt
                    color: "999999",
                  }),
                ],
              }),
            ],
          }),
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeTitle = (title || "legal-draft")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 60);
  saveAs(blob, `${safeTitle}.docx`);
}
