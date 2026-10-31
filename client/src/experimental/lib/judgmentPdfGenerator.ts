import { jsPDF } from "jspdf";
import { getJudgmentDetail } from "./judgmentApiClient";

export interface JudgmentPdfPayload {
  id?: string | number;
  citation: string;
  title: string;
  court?: string | null;
  decisionDate?: string | null;
  petitioner?: string | null;
  respondent?: string | null;
  bench?: string | null;
  headnotes?: string | null;
  fullText?: string | null;
  summary?: string | null;
  ratioDecidendi?: any;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Date not recorded";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date not recorded";
  return d.toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "2-digit" });
}

function sanitizeTextForPdf(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
    .replace(/[\u2013\u2014]/g, "-") // En-dash and em-dash
    .replace(/\u00A0/g, " ") // Non-breaking space
    .replace(/\u2026/g, "...") // Ellipsis
    .replace(/[^\x00-\x7F\u0600-\u06FF]/g, " "); // Keep ASCII and Urdu ranges, replace unknown control bytes
}

export async function generateAndDownloadCourtPdf(request: JudgmentPdfPayload): Promise<{ filename: string; openedOriginal?: boolean }> {
  // Always refresh through the guarded reader; caller text and summaries may be stale.
  const judgment = await getJudgmentDetail(request.id || request.citation);
  if (!judgment) throw new Error("Judgment could not be loaded. No PDF was generated.");
  if (judgment.textIntegrity === "mislabeled" || judgment.contentFormat === "unavailable" || !judgment.textIntegrity) {
    throw new Error(judgment.textWarning || "Judgment identity could not be checked. No PDF was generated.");
  }
  const fullText = judgment.fullText || "";
  if (!fullText.trim()) {
    if (judgment.pdfUrl) {
      const link = document.createElement("a");
      link.href = judgment.pdfUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
      return { filename: "Original PDF", openedOriginal: true };
    }
    throw new Error("No judgment text or original PDF is available.");
  }
  const title = judgment.title;
  const citation = judgment.citation;
  const court = judgment.court || "Court not recorded";

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 24;

  const addText = (
    rawText: string,
    fontSize: number,
    style: "normal" | "bold" | "italic" = "normal",
    maxWidth = contentWidth
  ) => {
    if (!rawText) return;
    const sanitized = sanitizeTextForPdf(rawText);
    doc.setFontSize(fontSize);
    doc.setFont("times", style);
    const paragraphs = sanitized.split(/\r?\n/);
    for (const paragraph of paragraphs) {
      if (paragraph.trim() === "") {
        y += fontSize * 0.45;
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        continue;
      }
      const lines = doc.splitTextToSize(paragraph, maxWidth);
      for (const line of lines) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += fontSize * 0.45;
      }
    }
    y += 2;
  };

  const addLine = () => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  // Running Header Banner
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.setFont("times", "normal");
  doc.text("AL WAKEELO - PAKISTANI PRECEDENT RESEARCH WORKSTATION", margin, 14);
  doc.text(
    new Date().toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" }),
    pageWidth - margin - 35,
    14
  );
  doc.setTextColor(0, 0, 0);

  // Court Title
  doc.setFontSize(11);
  doc.setFont("times", "bold");
  const courtHeading = court.toUpperCase().startsWith("IN THE") ? court.toUpperCase() : `IN THE ${court.toUpperCase()}`;
  doc.text(courtHeading, margin, y);
  y += 6;

  // Case Title
  addText(title, 14, "bold");
  y += 1;

  // Metadata block
  addText(`Reported Citation: ${citation}`, 10, "bold");
  addText(`Forum / Jurisdiction: ${court}`, 10);
  if (judgment.decisionDate) {
    addText(`Date of Decision: ${formatDate(judgment.decisionDate)}`, 10);
  }
  if (judgment.bench) {
    addText(`Bench: ${sanitizeTextForPdf(judgment.bench)}`, 10);
  }
  if (judgment.petitioner || judgment.respondent) {
    addText(
      `${judgment.petitioner || "Petitioner / Appellant"}  VS  ${judgment.respondent || "Respondent / State"}`,
      10,
      "italic"
    );
  }

  addText("Generated from database text; not an original court PDF.", 9, "italic");
  if (judgment.textIntegrity !== "own") {
    addText(judgment.textWarning || "Case identity has not been verified.", 10, "bold");
  }

  // Full Judgment Order
  y += 2;
  addLine();
  addText("JUDGMENT TEXT", 11, "bold");
  y += 1;
  addText(fullText, 9.5);

  // Footer on final page
  y += 6;
  addLine();
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.setFont("times", "normal");
  doc.text(
    "Database text copy - Al Wakeelo Legal Research Workstation - www.alwakeelo.com",
    margin,
    y
  );

  // Add Page Numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 10);
    doc.text(`${citation} - Database text copy`, margin, pageHeight - 10);
  }

  const cleanFilename = `${citation.replace(/[^a-zA-Z0-9]/g, "_")}_Database_Text.pdf`;
  doc.save(cleanFilename);

  return { filename: cleanFilename };
}
