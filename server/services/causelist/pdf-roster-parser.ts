import { extractText } from "unpdf";
import * as cheerio from "cheerio";
import { ParsedCauseList, ParsedCaseItem, CourtCode, ListType } from "./types";

export const PAK_CASE_REGEX = /\b(?:W\.?P\.?|Crl\.?\s*(?:Misc|Appeal|A\b|Rev|Org|Bail)|Civil\s*(?:Appeal|Revision|Petition|Misc)|I\.?C\.?A\.?|C\.?A\b|C\.?R\b|C\.?M\b|B\.?A\b|B\.?B\.?A\b|F\.?A\.?O\b|R\.?F\.?A\b|Tax\s*(?:Ref|App)\b|Const\.?\s*P\b|C\.?P\b|Suit\b|COC\b|Contempt\b|Review\b|Execution\b)\.?\s*(?:No\.?)?\s*[\d\w\-\.\/]+/i;

export function normalizeCaseType(caseNumber: string): string {
  if (/i\.?c\.?a\.?|intra\s*court/i.test(caseNumber)) return "Intra Court Appeal";
  if (/crl\.?\s*(?:appeal|a\b)/i.test(caseNumber)) return "Criminal Appeal";
  if (/crl\.?\s*(?:misc|m\b|rev|org)/i.test(caseNumber)) return "Criminal Misc";
  if (/w\.?p\.?|writ/i.test(caseNumber)) return "Writ Petition";
  if (/\bc\.?a\b|civil\s*appeal/i.test(caseNumber)) return "Civil Appeal";
  if (/\bc\.?r\b|civil\s*revision/i.test(caseNumber)) return "Civil Revision";
  if (/\bb\.?a\b|b\.?b\.?a\b|bail/i.test(caseNumber)) return "Bail Application";
  if (/f\.?a\.?o\b/i.test(caseNumber)) return "First Appeal from Order";
  if (/r\.?f\.?a\b/i.test(caseNumber)) return "Regular First Appeal";
  if (/tax/i.test(caseNumber)) return "Tax Reference";
  if (/const/i.test(caseNumber)) return "Constitutional Petition";
  if (/contempt|coc/i.test(caseNumber)) return "Contempt of Court";
  return "General Case";
}

export function extractCaseYear(caseNumber: string): number | null {
  const match = caseNumber.match(/[\/-]\s*(\d{2,4})\b/);
  if (!match) return null;
  let year = parseInt(match[1], 10);
  if (year < 100) {
    year = year > 50 ? 1900 + year : 2000 + year;
  }
  return year >= 1947 && year <= 2035 ? year : null;
}

/**
 * Parses HTML cause list tables (common in LHC, IHC, SHC CMS portals)
 */
export function parseHtmlCauseList(
  html: string,
  court: CourtCode,
  bench: string,
  targetDate: string,
  listType: ListType = "regular"
): ParsedCauseList[] {
  const $ = cheerio.load(html);
  const results: ParsedCauseList[] = [];
  const hearingDate = new Date(`${targetDate}T00:00:00.000Z`);

  let courtContainers = $("div.courtroom-block, div.judge-section");
  if (courtContainers.length === 0) {
    courtContainers = $("table.cause-list-table");
  }
  if (courtContainers.length === 0) {
    courtContainers = $("table");
  }

  courtContainers.each((_, container) => {
    const $sec = $(container);
    let judgeName = $sec.find(".judge-name, .court-judge, h2, h3, h4, caption").first().text().trim();
    let courtNumber = $sec.find(".court-number, .courtroom, .court-room-no").first().text().trim();

    if (!judgeName) {
      const prevHeading = $sec.prevAll("h2, h3, h4, .judge-header").first().text().trim();
      if (prevHeading) {
        judgeName = prevHeading;
      }
    }

    if (!judgeName) {
      const firstRowText = $sec.find("tr").first().text();
      const match = firstRowText.match(/(?:Mr\.\s*Justice|Hon'ble|Justice|Chief\s*Justice)\s+[A-Za-z\s\.]+/i);
      if (match) {
        judgeName = match[0].trim();
      }
    }

    if (!judgeName) {
      judgeName = "Hon'ble High Court Bench";
    }

    if (!courtNumber) {
      const courtMatch = judgeName.match(/(Court\s*(?:Room\s*)?(?:No\.?)?\s*\w+|DB-[I|V|X]+|SB-[I|V|X]+)/i);
      if (courtMatch) {
        courtNumber = courtMatch[1];
      }
    }

    const items: ParsedCaseItem[] = [];

    $sec.find("tr").each((rowIndex, row) => {
      const $row = $(row);
      const cells = $row.find("td");
      if (cells.length < 2) return;

      const rowText = $row.text();
      const firstCellText = $(cells[0]).text().trim();
      let srNo = parseInt(firstCellText.replace(/\D/g, ""), 10);
      if (isNaN(srNo) || srNo <= 0) {
        srNo = rowIndex;
      }

      let caseNumber = "";
      let caseTitle = "";
      let petitioner = "";
      let respondent = "";
      let petAdv = "";
      let respAdv = "";
      let purpose = "";
      let isRedList = false;

      if ($row.hasClass("red-list") || $row.css("color") === "red" || rowText.toLowerCase().includes("red cause list")) {
        isRedList = true;
      }

      cells.each((ci, cell) => {
        const text = $(cell).text().trim();
        if (!caseNumber) {
          const cMatch = text.match(PAK_CASE_REGEX);
          if (cMatch) {
            caseNumber = cMatch[0].trim();
          }
        }

        if (text.includes("VS") || text.includes("V/S") || text.includes(" Versus ") || text.includes(" v. ")) {
          caseTitle = text;
          const parts = text.split(/\s+(?:VS|V\/S|Versus|v\.)\s+/i);
          if (parts.length >= 2) {
            petitioner = parts[0].trim();
            respondent = parts[1].trim();
          }
        }

        if (text.toLowerCase().includes("adv") || text.toLowerCase().includes("counsel") || text.toLowerCase().includes("advocate")) {
          if (!petAdv) {
            petAdv = text;
          } else if (!respAdv) {
            respAdv = text;
          }
        }

        if (text.toLowerCase().includes("for arguments") || text.toLowerCase().includes("for hearing") || text.toLowerCase().includes("for notice") || text.toLowerCase().includes("ad-interim")) {
          purpose = text;
        }
      });

      if (caseNumber) {
        if (!caseTitle) {
          caseTitle = rowText.slice(0, 120).trim();
        }

        items.push({
          serialNumber: srNo,
          caseNumber,
          caseType: normalizeCaseType(caseNumber),
          caseYear: extractCaseYear(caseNumber),
          caseTitle: caseTitle || "Case Matters",
          petitioner: petitioner || null,
          respondent: respondent || null,
          petitionerAdvocate: petAdv || null,
          respondentAdvocate: respAdv || null,
          fixationPurpose: purpose || "For Hearing",
          isRedList,
          rawText: rowText.trim(),
        });
      }
    });

    if (items.length > 0) {
      results.push({
        court,
        bench,
        hearingDate,
        targetDateStr: targetDate,
        courtNumber: courtNumber || null,
        judgeName,
        listType,
        items,
      });
    }
  });

  return results;
}

/**
 * Parses raw text extracted from PDF cause lists
 */
export async function parsePdfCauseListBuffer(
  pdfBuffer: Buffer,
  court: CourtCode,
  bench: string,
  targetDate: string,
  listType: ListType = "regular"
): Promise<ParsedCauseList[]> {
  const result = await extractText(new Uint8Array(pdfBuffer));
  const fullText = Array.isArray(result.text) ? result.text.join("\n") : String(result.text || "");
  return parseTextCauseList(fullText, court, bench, targetDate, listType);
}

/**
 * Text-based layout parser for PDF extracted text
 */
export function parseTextCauseList(
  rawText: string,
  court: CourtCode,
  bench: string,
  targetDate: string,
  listType: ListType = "regular"
): ParsedCauseList[] {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results: ParsedCauseList[] = [];
  const hearingDate = new Date(`${targetDate}T00:00:00.000Z`);

  let currentJudge: string | null = null;
  let currentCourtNo: string | null = null;
  let currentItems: ParsedCaseItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect Court Room Header (e.g. Court Room No. 1, Court No. 2, DB-I)
    if (/(?:Court\s*(?:Room\s*)?(?:No\.?)?\s*\w+|DB-[I|V|X]+|SB-[I|V|X]+)/i.test(line) && !line.includes("VS") && !line.includes("Versus")) {
      const match = line.match(/(Court\s*(?:Room\s*)?(?:No\.?)?\s*\w+|DB-[I|V|X]+|SB-[I|V|X]+)/i);
      if (match) {
        if (currentItems.length > 0 && currentJudge) {
          results.push({
            court,
            bench,
            hearingDate,
            targetDateStr: targetDate,
            courtNumber: currentCourtNo,
            judgeName: currentJudge,
            listType,
            items: [...currentItems],
          });
          currentItems = [];
        }
        currentCourtNo = match[1];
      }
    }

    // Detect Judge/Bench Header
    if (/(?:^Before|^Coram|^Hon'ble|^Mr\.\s*Justice|^Chief\s*Justice|^Justice\s+[A-Z])/i.test(line)) {
      if (currentItems.length > 0 && currentJudge) {
        results.push({
          court,
          bench,
          hearingDate,
          targetDateStr: targetDate,
          courtNumber: currentCourtNo,
          judgeName: currentJudge,
          listType,
          items: [...currentItems],
        });
        currentItems = [];
      }
      currentJudge = line.replace(/^(?:Before|Coram|Hon'ble)\s*[:\-]?\s*/i, "").trim();
      continue;
    }

    const caseMatch = line.match(PAK_CASE_REGEX);
    if (caseMatch) {
      const caseNumber = caseMatch[0].trim();
      
      const srMatch = line.match(/^(\d{1,4})\.?\s+/);
      let srNo = srMatch ? parseInt(srMatch[1], 10) : currentItems.length + 1;
      if (isNaN(srNo)) srNo = currentItems.length + 1;

      let caseTitle = line.replace(caseNumber, "").replace(/^\d+\.?\s*/, "").trim();
      let petAdv: string | null = null;
      let respAdv: string | null = null;
      let purpose: string | null = null;

      let j = i + 1;
      while (j < lines.length && j <= i + 3 && !PAK_CASE_REGEX.test(lines[j]) && !/(?:^Before|^Coram|^Hon'ble|Court\s*No)/i.test(lines[j])) {
        const nextLine = lines[j];
        if (nextLine.includes("VS") || nextLine.includes("V/S") || nextLine.includes("Versus")) {
          caseTitle = caseTitle ? `${caseTitle} ${nextLine}` : nextLine;
        } else if (nextLine.toLowerCase().includes("adv") || nextLine.toLowerCase().includes("counsel")) {
          if (!petAdv) petAdv = nextLine;
          else if (!respAdv) respAdv = nextLine;
        } else if (nextLine.toLowerCase().includes("for arguments") || nextLine.toLowerCase().includes("for notice")) {
          purpose = nextLine;
        }
        j++;
      }

      currentItems.push({
        serialNumber: srNo,
        caseNumber,
        caseType: normalizeCaseType(caseNumber),
        caseYear: extractCaseYear(caseNumber),
        caseTitle: caseTitle || "Case Hearing",
        petitionerAdvocate: petAdv,
        respondentAdvocate: respAdv,
        fixationPurpose: purpose || "For Hearing",
        isRedList: line.toLowerCase().includes("red") || false,
        rawText: line,
      });
    }
  }

  if (currentItems.length > 0) {
    results.push({
      court,
      bench,
      hearingDate,
      targetDateStr: targetDate,
      courtNumber: currentCourtNo,
      judgeName: currentJudge || "Hon'ble High Court Bench",
      listType,
      items: currentItems,
    });
  }

  return results;
}
