import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";
import {
  Document as DocxDocument,
  Paragraph as DocxParagraph,
  Packer as DocxPacker,
  TextRun as DocxTextRun,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  BorderStyle as DocxBorderStyle,
  WidthType as DocxWidthType,
  HeadingLevel as DocxHeadingLevel,
  AlignmentType as DocxAlignmentType,
  Footer as DocxFooter,
  PageNumber as DocxPageNumber,
  Header as DocxHeader,
} from "docx";

// Set up DOM globals for testing
const dom = new JSDOM("");
(global as any).DOMParser = dom.window.DOMParser;
(global as any).Node = dom.window.Node;

const testHtml = `
<h1 style="text-align: center">SERVICE AGREEMENT</h1>
<p style="text-align: center">This Agreement is made on this 5th day of July, 2026</p>
<p>&nbsp;</p>
<h2><strong>1. PARTIES</strong></h2>
<p><strong>Alpha Corp</strong>, a company incorporated in Pakistan (hereinafter referred to as the "Client") and <strong>Beta LLC</strong> (hereinafter referred to as the "Consultant").</p>
<p>&nbsp;</p>
<h2><strong>2. SERVICES AND COMPENSATION</strong></h2>
<p>The Consultant shall perform IT consultancy services as specified below. The Client agrees to pay the Consultant based on the following schedule:</p>
<p>&nbsp;</p>
<table>
  <tr>
    <th>Service Milestone</th>
    <th>Fee (PKR)</th>
    <th>Due Date</th>
  </tr>
  <tr>
    <td>Phase 1: Database Migration</td>
    <td>500,000</td>
    <td>August 1, 2026</td>
  </tr>
  <tr>
    <td>Phase 2: Frontend Redesign</td>
    <td>750,000</td>
    <td>September 15, 2026</td>
  </tr>
</table>
<p>&nbsp;</p>
<h2><strong>3. MISCELLANEOUS</strong></h2>
<ul>
  <li>This agreement constitutes the entire agreement between the parties.</li>
  <li>Any amendments must be in writing.</li>
  <li>All disputes shall be settled under the Arbitration Act 1940.</li>
</ul>
<p>&nbsp;</p>
<p style="text-align: center"><em>[Signature block follows on next page]</em></p>
<hr class="page-break" />
<h2 style="text-align: center"><strong>SIGNATURES</strong></h2>
<p style="text-align: right"><strong>For Alpha Corp:</strong><br>___________________<br>Director</p>
<p style="text-align: left"><strong>For Beta LLC:</strong><br>___________________<br>CEO</p>
`;

async function compileHtmlToDocx(htmlContent: string, title: string, outputPath: string) {
  const parser = new DOMParser();
  const docHtml = parser.parseFromString(htmlContent, "text/html");
  const children: any[] = [];

  const cellBorder = {
    top: { style: DocxBorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    bottom: { style: DocxBorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    left: { style: DocxBorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    right: { style: DocxBorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  };

  const parseTextRuns = (element: any): DocxTextRun[] => {
    const runs: DocxTextRun[] = [];
    
    const traverse = (node: any, activeStyles: { bold?: boolean; italics?: boolean; underline?: boolean }) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        if (text) {
          runs.push(new DocxTextRun({
            text: text,
            font: "Times New Roman",
            size: 22,
            bold: activeStyles.bold,
            italics: activeStyles.italics,
            underline: activeStyles.underline ? {} : undefined,
          }));
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const styles = { ...activeStyles };
        if (["STRONG", "B"].includes(el.tagName)) styles.bold = true;
        if (["EM", "I"].includes(el.tagName)) styles.italics = true;
        if (["U"].includes(el.tagName)) styles.underline = true;
        
        el.childNodes.forEach(child => traverse(child, styles));
      }
    };

    element.childNodes.forEach((child: any) => traverse(child, {}));
    return runs;
  };

  const getAlignment = (el: any) => {
    const textAlign = el.style.textAlign || el.getAttribute("align") || "";
    if (textAlign === "center") return DocxAlignmentType.CENTER;
    if (textAlign === "right") return DocxAlignmentType.RIGHT;
    if (textAlign === "justify") return DocxAlignmentType.JUSTIFIED;
    return DocxAlignmentType.LEFT;
  };

  // Process DOM Nodes
  docHtml.body.childNodes.forEach((node: any) => {
    if (node.nodeType !== 1) return;
    const el = node as HTMLElement;

    if (["H1", "H2", "H3", "H4"].includes(el.tagName)) {
      const levelVal = parseInt(el.tagName.replace("H", ""), 10);
      const headingLevelsArr = [
        DocxHeadingLevel.HEADING_1,
        DocxHeadingLevel.HEADING_2,
        DocxHeadingLevel.HEADING_3,
        DocxHeadingLevel.HEADING_4,
      ];
      children.push(
        new DocxParagraph({
          heading: headingLevelsArr[Math.min(levelVal - 1, 3)],
          spacing: { before: 120, after: 120 },
          alignment: getAlignment(el),
          children: parseTextRuns(el),
        }),
      );
    } else if (el.tagName === "TABLE") {
      const tableRows: DocxTableRow[] = [];
      
      el.querySelectorAll("tr").forEach((tr) => {
        const cells: DocxTableCell[] = [];
        
        tr.querySelectorAll("th").forEach((th) => {
          cells.push(
            new DocxTableCell({
              borders: cellBorder,
              shading: { fill: "F2F2F2" },
              children: [
                new DocxParagraph({
                  alignment: getAlignment(th),
                  children: parseTextRuns(th),
                }),
              ],
            }),
          );
        });

        tr.querySelectorAll("td").forEach((td) => {
          cells.push(
            new DocxTableCell({
              borders: cellBorder,
              children: [
                new DocxParagraph({
                  alignment: getAlignment(td),
                  children: parseTextRuns(td),
                }),
              ],
            }),
          );
        });

        if (cells.length > 0) {
          tableRows.push(new DocxTableRow({ children: cells }));
        }
      });

      if (tableRows.length > 0) {
        children.push(
          new DocxTable({
            width: { size: 100, type: DocxWidthType.PERCENTAGE },
            rows: tableRows,
          }),
        );
        children.push(new DocxParagraph({ text: "" }));
      }
    } else if (["UL", "OL"].includes(el.tagName)) {
      el.querySelectorAll("li").forEach((li) => {
        children.push(
          new DocxParagraph({
            bullet: el.tagName === "UL" ? { level: 0 } : undefined,
            spacing: { after: 120 },
            alignment: getAlignment(li),
            children: parseTextRuns(li),
          }),
        );
      });
    } else {
      const textRuns = parseTextRuns(el);
      if (textRuns.length === 0) return;

      const alignVal = getAlignment(el);
      const finalAlign = alignVal === DocxAlignmentType.LEFT ? DocxAlignmentType.JUSTIFIED : alignVal;

      children.push(
        new DocxParagraph({
          spacing: { line: 276, lineRule: "auto", after: 160 },
          alignment: finalAlign,
          children: textRuns,
        }),
      );
    }
  });

  const doc = new DocxDocument({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,
            bottom: 1440,
            left: 1440,
            right: 1440,
          },
        },
      },
      headers: {
        default: new DocxHeader({
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.RIGHT,
              children: [
                new DocxTextRun({
                  text: title.toUpperCase(),
                  font: "Times New Roman",
                  size: 16,
                  color: "888888",
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new DocxFooter({
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: [
                new DocxTextRun({
                  text: "Page ",
                  font: "Times New Roman",
                  size: 20,
                }),
                new DocxTextRun({
                  children: [DocxPageNumber.CURRENT],
                  font: "Times New Roman",
                  size: 20,
                }),
              ],
            }),
          ],
        }),
      },
      children,
    }],
  });

  const buffer = await DocxPacker.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log("Success! Compiled file saved to:", outputPath);
}

const outputPath = path.resolve("./scratch/test_docx_output.docx");
compileHtmlToDocx(testHtml, "COMMERCIAL SERVICE LEASE", outputPath).catch(console.error);
