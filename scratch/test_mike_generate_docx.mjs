import fs from "fs";
import path from "path";

// Extract elements from docx library
const {
  Document,
  Paragraph,
  HeadingLevel,
  Packer,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  TextRun,
  AlignmentType,
  LevelFormat,
  LevelSuffix,
  PageOrientation,
  PageBreak,
} = await import("docx");

const FONT = "Times New Roman";
const SIZE = 22; // 11pt in half-points

const cellBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
};

const headingLevels = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
];

const LEGAL_NUMBERING_REF = "legal-clause-numbering";
const legalNumbering = (level) => ({
  reference: LEGAL_NUMBERING_REF,
  level: Math.max(0, Math.min(level, 4)),
});

// Legal Numbering config levels matching Mike OSS
const legalNumberingLevels = [
  {
    level: 0,
    format: LevelFormat.DECIMAL,
    text: "%1.",
    alignment: AlignmentType.START,
    suffix: LevelSuffix.TAB,
    isLegalNumberingStyle: true,
    style: {
      paragraph: { indent: { left: 720, hanging: 720 } },
      run: { bold: true, color: "000000", font: FONT, size: SIZE },
    },
  },
  {
    level: 1,
    format: LevelFormat.DECIMAL,
    text: "%1.%2",
    alignment: AlignmentType.START,
    suffix: LevelSuffix.TAB,
    isLegalNumberingStyle: true,
    style: {
      paragraph: { indent: { left: 720, hanging: 720 } },
      run: { color: "000000", font: FONT, size: SIZE },
    },
  },
  {
    level: 2,
    format: LevelFormat.LOWER_LETTER,
    text: "(%3)",
    alignment: AlignmentType.START,
    suffix: LevelSuffix.TAB,
    style: {
      paragraph: { indent: { left: 1440, hanging: 720 } },
      run: { color: "000000", font: FONT, size: SIZE },
    },
  },
  {
    level: 3,
    format: LevelFormat.LOWER_ROMAN,
    text: "(%4)",
    alignment: AlignmentType.START,
    suffix: LevelSuffix.TAB,
    style: {
      paragraph: { indent: { left: 1440, hanging: 720 } },
      run: { color: "000000", font: FONT, size: SIZE },
    },
  },
  {
    level: 4,
    format: LevelFormat.UPPER_LETTER,
    text: "(%5)",
    alignment: AlignmentType.START,
    suffix: LevelSuffix.TAB,
    style: {
      paragraph: { indent: { left: 2520, hanging: 720 } },
      run: { color: "000000", font: FONT, size: SIZE },
    },
  },
];

const normalizeTable = (table) => {
  if (!table || typeof table !== "object") return null;
  const raw = table;
  const headers = Array.isArray(raw.headers)
    ? raw.headers
        .map((header) => (typeof header === "string" ? header.trim() : ""))
        .filter(Boolean)
    : [];
  if (headers.length === 0) return null;

  const rawRows = Array.isArray(raw.rows) ? raw.rows : [];
  const rows = rawRows
    .filter((row) => Array.isArray(row))
    .map((row) =>
      headers.map((_, i) => (typeof row[i] === "string" ? row[i] : "")),
    );

  return { headers, rows };
};

const stripManualNumbering = (value) => {
  const match = value.trim().match(/^(\d+(?:\.\d+)*)(?:[.)])?\s+(.+)$/);
  if (!match) return { text: value.trim(), levelFromPrefix: null };
  return {
    text: match[2].trim(),
    levelFromPrefix: match[1].split(".").length - 1,
  };
};

const parseManualListMarker = (value) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\(([a-z]+)\)|([a-z]+)[.)])\s+(.+)$/i);
  if (!match) return { text: trimmed, levelOffset: null };
  const marker = (match[2] ?? match[3] ?? "").toLowerCase();
  const isRoman =
    marker === "i" ||
    (marker.length > 1 &&
      /^(?:m{0,4}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3}))$/i.test(
        marker,
      ));
  return { text: match[4].trim(), levelOffset: isRoman ? 3 : 2 };
};

const normalizeHeadingText = (value) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();

const isTitleLikeFirstHeading = (heading, title, sectionIndex) => {
  if (sectionIndex !== 0) return false;
  const normalized = normalizeHeadingText(heading);
  const titleNormalized = normalizeHeadingText(title);
  if (!normalized || !titleNormalized) return false;
  if (normalized === titleNormalized) return true;
  return (
    titleNormalized.includes(normalized) &&
    /\b(agreement|contract|deed|terms|policy|notice|nda|disclosure)\b/.test(
      normalized,
    )
  );
};

const isUnnumberedHeading = (heading, title, sectionIndex) => {
  const normalized = normalizeHeadingText(heading);
  if (!normalized) return true;
  if (normalized === "signatures" || normalized === "signature") {
    return true;
  }
  if (isTitleLikeFirstHeading(heading, title, sectionIndex)) {
    return true;
  }
  if (
    sectionIndex === 0 &&
    /^(agreement|contract|mutual non disclosure agreement|non disclosure agreement|employment agreement|service level agreement)$/.test(
      normalized,
    )
  ) {
    return true;
  }
  return false;
};

const isSignatureLine = (value) =>
  /^(?:by|name|title|date):\s*/i.test(value.trim());

const looksLikeSignatureBlock = (value) => {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return false;
  const signatureLineCount = lines.filter(isSignatureLine).length;
  return signatureLineCount >= 2;
};

// local generation helper
export async function generateDocxLocal(title, sections, outputPath, options = {}) {
  try {
    const children = [];

    // Title Paragraph
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        spacing: { after: 200 },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: title.toUpperCase(),
            color: "000000",
            font: FONT,
            size: SIZE,
            bold: true,
          }),
        ],
      }),
    );

    let currentClauseLevel = null;

    for (const [sectionIndex, section] of sections.entries()) {
      if (section.pageBreak) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
      }
      if (section.heading) {
        const stripped = stripManualNumbering(section.heading);
        const isUnnumbered = isUnnumberedHeading(stripped.text, title, sectionIndex);
        const skipHeading = isTitleLikeFirstHeading(stripped.text, title, sectionIndex);
        const idx = Math.min(
          stripped.levelFromPrefix ?? (section.level ?? 1) - 1,
          3,
        );
        currentClauseLevel = isUnnumbered || skipHeading ? null : idx;
        const headingText =
          idx === 0 && !isUnnumbered
            ? stripped.text.toUpperCase()
            : stripped.text;
        if (!skipHeading) {
          children.push(
            new Paragraph({
              heading: headingLevels[idx],
              numbering: isUnnumbered ? undefined : legalNumbering(idx),
              spacing: { after: 160 },
              children: [
                new TextRun({
                  text: headingText,
                  color: "000000",
                  font: FONT,
                  size: SIZE,
                  bold: true,
                }),
              ],
            }),
          );
        }
      }

      const normalizedTable = normalizeTable(section.table);
      if (normalizedTable) {
        const { headers, rows } = normalizedTable;
        const tableRows = [];
        tableRows.push(
          new TableRow({
            tableHeader: true,
            children: headers.map(
              (h) =>
                new TableCell({
                  borders: cellBorder,
                  shading: { fill: "F2F2F2" },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: h,
                          bold: true,
                          font: FONT,
                          size: SIZE,
                        }),
                      ],
                      alignment: AlignmentType.LEFT,
                    }),
                  ],
                }),
            ),
          }),
        );
        for (const normalized of rows) {
          tableRows.push(
            new TableRow({
              children: normalized.map(
                (cell) =>
                  new TableCell({
                    borders: cellBorder,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: cell,
                            font: FONT,
                            size: SIZE,
                          }),
                        ],
                      }),
                    ],
                  }),
              ),
            }),
          );
        }
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
        );
        children.push(new Paragraph({ text: "" }));
      }

      if (section.content) {
        let numberedBodyParagraphs = 0;
        const contentIsSignatureBlock =
          section.heading &&
          normalizeHeadingText(section.heading).includes("signature")
            ? true
            : looksLikeSignatureBlock(section.content);
        for (const line of section.content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const bulletMatch = trimmed.match(/^[-•*]\s+(.+)/);
          const rawText = bulletMatch ? bulletMatch[1].trim() : trimmed;
          const manualList = parseManualListMarker(rawText);
          const numeric = stripManualNumbering(rawText);
          const text = bulletMatch
            ? rawText
            : manualList.levelOffset !== null
              ? manualList.text
              : numeric.text;
          const inferredLevel =
            currentClauseLevel === null || contentIsSignatureBlock
              ? undefined
              : bulletMatch
                ? currentClauseLevel + 2
                : manualList.levelOffset !== null
                  ? currentClauseLevel + manualList.levelOffset
                  : numeric.levelFromPrefix !== null
                    ? numeric.levelFromPrefix
                    : numberedBodyParagraphs === 0
                      ? currentClauseLevel + 1
                      : currentClauseLevel + 2;
          if (currentClauseLevel !== null) numberedBodyParagraphs++;
          children.push(
            new Paragraph({
              numbering:
                inferredLevel === undefined
                  ? undefined
                  : legalNumbering(inferredLevel),
              spacing: { after: 120 },
              children: [
                new TextRun({
                  text,
                  font: FONT,
                  size: SIZE,
                }),
              ],
            }),
          );
        }
      }
    }

    const pageSetup = options?.landscape
      ? { page: { size: { orientation: PageOrientation.LANDSCAPE } } }
      : {};

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: LEGAL_NUMBERING_REF,
            levels: legalNumberingLevels,
          },
        ],
      },
      sections: [{ properties: pageSetup, children }],
    });

    const buf = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buf);
    console.log(`\n🎉 Document generated successfully!`);
    console.log(`📂 Output saved to: ${outputPath}\n`);
  } catch (err) {
    console.error("❌ Generation failed:", err);
  }
}

// Sample contract schema mimicking the AI output in Mike OSS
const sampleContractTitle = "Mutual Non-Disclosure Agreement";
const sampleContractSections = [
  {
    heading: "Mutual Non-Disclosure Agreement",
    content: "This Mutual Non-Disclosure Agreement (\"Agreement\") is entered into on this 1st day of July, 2026 (\"Effective Date\") by and between TechCorp (Pvt) Ltd. (\"Disclosing Party\") and Ali Ahmed (\"Receiving Party\").",
    level: 1,
  },
  {
    heading: "1. Purpose",
    content: "The parties wish to explore a business relationship of mutual interest. In connection with this opportunity, each party may disclose to the other certain proprietary and confidential information. The Receiving Party agrees to protect this information as outlined below.",
    level: 1,
  },
  {
    heading: "2. Definition of Confidential Information",
    content: "For purposes of this Agreement, \"Confidential Information\" shall include all information or material that has or could have commercial value or other utility in the business in which Disclosing Party is engaged. If Information is in written form, the Disclosing Party shall label or stamp the materials with the word \"Confidential\" or some similar warning. Confidential Information includes:\n- Technical data, source code, database structures, and CRM systems.\n- Financial projections, customer lists, and pricing sheets.\n- Marketing plans, partnership strategies, and business development materials.",
    level: 1,
  },
  {
    heading: "3. Non-Disclosure Obligations",
    content: "The Receiving Party shall hold and maintain the Confidential Information in strictest confidence for the sole and exclusive benefit of the Disclosing Party. Receiving Party shall carefully restrict access to Confidential Information to employees, contractors, and third parties as is reasonably required and shall require those persons to sign non-disclosure restrictions at least as protective as those in this Agreement. Receiving Party shall not, without prior written approval of Disclosing Party, use for Receiving Party's own benefit, publish, copy, or otherwise disclose to others, or permit the use by others for their benefit or to the detriment of Disclosing Party, any Confidential Information.",
    level: 1,
  },
  {
    heading: "4. Permitted Access Matrix",
    table: {
      headers: ["Department", "Access Privilege", "Retention Period"],
      rows: [
        ["Engineering Team", "Read & Write (Source Code)", "Project Duration"],
        ["Product Management", "Read Only (Roadmaps)", "1 Year"],
        ["Legal & Compliance", "Full Access (All Files)", "Indefinite"],
      ]
    }
  },
  {
    heading: "5. Governing Law and Jurisdiction",
    content: "This Agreement shall be governed by, and construed in accordance with, the laws of Pakistan. The parties agree that any dispute arising out of or related to this Agreement shall be subject to the exclusive jurisdiction of the courts located in Lahore, Pakistan.",
    level: 1,
  },
  {
    heading: "6. Signatures",
    content: "IN WITNESS WHEREOF, the parties hereto have executed this Mutual Non-Disclosure Agreement as of the Effective Date.\n\nDISCLOSING PARTY:\nBy:\nName:\nTitle:\nDate:\n\nRECEIVING PARTY:\nBy:\nName:\nTitle:\nDate:",
    level: 1,
    pageBreak: true,
  }
];

const outputPath = path.resolve("./scratch/mike_drafted_contract.docx");
generateDocxLocal(sampleContractTitle, sampleContractSections, outputPath);
