/**
 * Converts plain-text legal drafts into Tiptap HTML.
 * Pakistani court style: numbered paragraphs (NOT <ol>), centred titles,
 * right-aligned party roles, Title Case case numbers, page breaks,
 * robust markdown formatting, lists, horizontal rules, and court grounds.
 */

function esc(t: string): string {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parseInlineFormatting(t: string): string {
  if (!t) return "";
  let res = esc(t);

  // Restore and normalize existing standard safe HTML tags if present in plain text
  // e.g. &lt;strong&gt;, &lt;b&gt;, &lt;em&gt;, &lt;i&gt;, &lt;u&gt;, &lt;s&gt;, &lt;code&gt;, &lt;br&gt;, &lt;mark&gt;, &lt;span...&gt;
  res = res.replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/gi, "<strong>$1</strong>");
  res = res.replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/gi, "<strong>$1</strong>");
  res = res.replace(/&lt;em&gt;(.*?)&lt;\/em&gt;/gi, "<em>$1</em>");
  res = res.replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/gi, "<em>$1</em>");
  res = res.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, "<u>$1</u>");
  res = res.replace(/&lt;(s|strike|del)&gt;(.*?)&lt;\/\1&gt;/gi, "<s>$2</s>");
  res = res.replace(/&lt;code&gt;(.*?)&lt;\/code&gt;/gi, "<code>$1</code>");
  res = res.replace(/&lt;mark&gt;(.*?)&lt;\/mark&gt;/gi, "<mark>$1</mark>");
  res = res.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
  res = res.replace(/&lt;span([^&]*)&gt;(.*?)&lt;\/span&gt;/gi, "<span$1>$2</span>");

  // Markdown bold + italic: ***text*** or ___text___
  res = res.replace(/\*\*\*([^*]+?)\*\*\*/g, "<strong><em>$1</em></strong>");

  // Markdown bold: **text**
  res = res.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");

  // Markdown bold: __text__ (ensuring not 3+ underscores used for fill blanks like _____________)
  res = res.replace(/(?<!_)__([^_]+?)__(?!_)/g, "<strong>$1</strong>");

  // Markdown italic: *text* (when not part of a list bullet or asterisks)
  res = res.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "<em>$1</em>");

  // Markdown italic: _text_ (when text has word characters and not purely underscores)
  res = res.replace(/(?<!_)_([a-zA-Z0-9][^_]*?[a-zA-Z0-9]|[a-zA-Z0-9])_(?!_)/g, "<em>$1</em>");

  // Markdown strikethrough: ~~text~~ or ~text~
  res = res.replace(/~~([^~]+?)~~/g, "<s>$1</s>");
  res = res.replace(/(?<!~)~([^~]+?)~(?!~)/g, "<s>$1</s>");

  // Markdown code: `text`
  res = res.replace(/`([^`]+?)`/g, "<code>$1</code>");

  return res;
}

export const COURT_TITLE_RE = /^\**\s*(IN THE (COURT|HIGH COURT|HONOURABLE|HON'BLE|SUPREME COURT|FAMILY COURT|SESSIONS|SPECIAL|BANKING|ACCOUNTABILITY|DISTRICT|CIVIL|GUARDIAN|APPELLATE)|BEFORE THE (HONOURABLE|HON'BLE|HIGH COURT|SUPREME COURT|COURT))/i;
export const SUBTITLE_RE = /^\**\s*\(([A-Za-z\s/&,.-]+)\)\s*\**$/i;
export const CENTRED_TITLE_RE = /^\**\s*(WRIT PETITION|CONSTITUTION(AL)? PETITION|CIVIL (REVISION|APPEAL|MISC|SUIT|PETITION|ORIGINAL)|CRIMINAL (APPEAL|REVISION|MISC|BAIL|PETITION|ORIGINAL)|BAIL APPLICATION|POST-ARREST BAIL|PRE-ARREST BAIL|SUIT FOR|SUIT UNDER|APPLICATION (UNDER|FOR|OF|SEEKING)|PETITION (UNDER|FOR|OF|SEEKING)|MEMORANDUM (OF|FOR)|MEMO OF|SPECIAL LEAVE|FIRST APPEAL|SECOND APPEAL|IN THE MATTER OF|INDEX OF DOCUMENTS|LIST OF (DOCUMENTS|CITATIONS|ANNEXURES)|READ WITH|PARTNERSHIP DEED|DEED OF|SETTLEMENT AGREEMENT|EMPLOYMENT (AGREEMENT|CONTRACT)|NON-DISCLOSURE AGREEMENT|NDA|POWER OF ATTORNEY|(GENERAL|SPECIAL) POWER OF ATTORNEY|SALE DEED|AGREEMENT TO SELL|RENT AGREEMENT|LEASE AGREEMENT|COMMERCIAL LEASE|SOFTWARE-AS-A-SERVICE|SAAS AGREEMENT|AGREEMENT FOR|SERVICE LEVEL AGREEMENT|LEGAL NOTICE|REPLY TO LEGAL NOTICE)/i;
export const CASE_NUMBER_RE = /^\**\s*((CRIMINAL|CIVIL|FAMILY|WRIT|CONSTITUTIONAL|C\.?M\.?A\.?)\s+(MISC\.?|BAIL|APPEAL|REVISION|PETITION|SUIT|ORIGINAL|APPLICATION)|SUIT\s+NO\.|W\.?P\.?\s+NO\.|C\.?M\.?A\.?\s+NO\.)/i;
export const TITLE_CASE_NUMBER_RE = /^\**\s*((Criminal|Civil|Family|Writ|Constitutional|C\.?M\.?A\.?)\s+(Misc\.?|Bail|Appeal|Revision|Petition|Suit|Application)|Suit\s+No\.|W\.?P\.?\s+No\.|C\.?M\.?A\.?\s+No\.)/i;

export const SECTION_HEADINGS = new Set([
  "PRAYER", "PRAYER:", "PRAYER CLAUSE", "PRAYER CLAUSE:", "GROUNDS", "GROUNDS:", "GROUNDS OF APPEAL", "GROUNDS OF APPEAL:",
  "GROUNDS FOR BAIL", "GROUNDS FOR BAIL:", "GROUNDS FOR LEAVE TO APPEAL", "GROUNDS FOR LEAVE TO APPEAL:",
  "VERIFICATION", "VERIFICATION:", "BRIEF FACTS", "BRIEF FACTS:", "STATEMENT OF FACTS", "STATEMENT OF FACTS:",
  "FACTS", "FACTS:", "PRELIMINARY OBJECTIONS", "PRELIMINARY OBJECTIONS:", "ON MERITS", "ON MERITS:",
  "RESPECTFULLY SHEWETH", "RESPECTFULLY SHEWETH:", "RESPECTFULLY SUBMITTED", "RESPECTFULLY SUBMITTED:",
  "VAKALATNAMA", "AFFIDAVIT", "AFFIDAVIT:", "LEGAL NOTICE", "REPLY TO LEGAL NOTICE", "INTERIM RELIEF", "INTERIM RELIEF:",
  "STAY APPLICATION", "STAY APPLICATION:", "INJUNCTION APPLICATION", "INJUNCTION APPLICATION:",
  "INDEX OF DOCUMENTS", "INDEX", "INDEX:", "MEMO OF PETITION", "MEMO OF PETITION:", "RECITALS:", "RECITALS",
  "WITNESSETH:", "WITNESSETH", "SCHEDULE A", "SCHEDULE B", "SCHEDULE C", "ANNEXURE A", "ANNEXURE B",
  "CAUSE OF ACTION", "CAUSE OF ACTION:", "JURISDICTION", "JURISDICTION:", "COURT FEE", "COURT FEE:",
  "CERTIFICATE", "CERTIFICATE:", "QUESTIONS OF LAW", "QUESTIONS OF LAW:", "QUESTION OF LAW", "QUESTION OF LAW:",
]);

export const ALL_CAPS_RE = /^[A-Z][A-Z\s:&,./()'-]{4,}$/;
export const PARTY_ROLE_RE = /\.{2,4}\s*(PETITIONER|APPLICANT|APPELLANT|PLAINTIFF|COMPLAINANT|RESPONDENT|DEFENDANT|ACCUSED|APPLICANT\/ACCUSED|PETITIONERS|RESPONDENTS|DEFENDANTS|APPELLANTS|PLAINTIFFS|CLAIMANT|DECREE HOLDER|JUDGMENT DEBTOR|OBJECTOR|NON-APPLICANT|PROFORMA RESPONDENT|PROFORMA RESPONDENTS)\s*$/i;
export const PARTY_ROLE_LINE_RE = /^\.{2,4}\s*(PETITIONER|APPLICANT|APPELLANT|PLAINTIFF|RESPONDENT|DEFENDANT|ACCUSED|COMPLAINANT|APPLICANT\/ACCUSED|PETITIONERS|RESPONDENTS|DEFENDANTS|APPELLANTS|PLAINTIFFS|CLAIMANT|DECREE HOLDER|JUDGMENT DEBTOR|OBJECTOR|NON-APPLICANT|PROFORMA RESPONDENT|PROFORMA RESPONDENTS)/i;
export const THROUGH_RE = /^Through\s*:/i;
export const VERSUS_RE = /^(\.{2,4}\s*)?VERSUS(\s*\.{2,4})?$/i;

// Detect standalone party role labels (with or without dots/ellipsis)
export const STANDALONE_ROLE_RE = /^[.…]*\s*(PETITIONER|APPLICANT|APPELLANT|PLAINTIFF|COMPLAINANT|RESPONDENT|DEFENDANT|ACCUSED|APPLICANT\/ACCUSED|PETITIONERS|RESPONDENTS|DEFENDANTS|APPELLANTS|PLAINTIFFS|CLAIMANT|DECREE HOLDER|JUDGMENT DEBTOR|OBJECTOR|NON-APPLICANT|PROFORMA RESPONDENT|PROFORMA RESPONDENTS)\s*$/i;

// Detect numbered items and court grounds (e.g. "1. ", "1.1 ", "A. ", "I. ", "(a) ", "a) ", "**1.** ")
export const GROUND_OR_NUMBERED_RE = /^(\*{0,2}|_{0,2})(\d{1,3}\.|\d+\.\d+(\.\d+)?\.?|[A-Z]\.|[IVXLCDMivxlcdm]+\.|\([a-zA-Z0-9]+\)|[a-zA-Z0-9]+\))(\*{0,2}|_{0,2})\s+(.+)$/;

// Detect bullet list items (e.g. "- ", "* ", "• ", "+ ")
export const BULLET_ITEM_RE = /^[-*•+]\s+(.+)$/;

// Detect horizontal rules (e.g. "---", "***", "___")
export const HORIZONTAL_RULE_RE = /^(\-{3,}|\*{3,}|_{3,})$/;

export function plainTextToTiptapHTML(raw: string): string {
  if (!raw || typeof raw !== "string") return "<p></p>";
  if (isHTMLContent(raw)) return raw;

  const lines = raw.split(/\r?\n/);
  const blocks: string[] = [];
  let i = 0;

  function isSpecialLine(line: string): boolean {
    const t = line.trim();
    if (!t) return true;
    const cleanT = t.replace(/^[*_#\s]+|[*_#\s]+$/g, "").trim();
    const upper = cleanT.toUpperCase().replace(/:$/, "");
    return (
      /^#{1,4}\s+/.test(t) ||
      HORIZONTAL_RULE_RE.test(t) ||
      BULLET_ITEM_RE.test(t) ||
      GROUND_OR_NUMBERED_RE.test(t) ||
      COURT_TITLE_RE.test(t) ||
      COURT_TITLE_RE.test(cleanT) ||
      SUBTITLE_RE.test(t) ||
      SUBTITLE_RE.test(cleanT) ||
      VERSUS_RE.test(t) ||
      PARTY_ROLE_RE.test(t) ||
      PARTY_ROLE_LINE_RE.test(t) ||
      STANDALONE_ROLE_RE.test(t) ||
      THROUGH_RE.test(t) ||
      SECTION_HEADINGS.has(upper) ||
      SECTION_HEADINGS.has(cleanT.toUpperCase()) ||
      SECTION_HEADINGS.has(t.toUpperCase()) ||
      CENTRED_TITLE_RE.test(cleanT) ||
      CENTRED_TITLE_RE.test(t) ||
      ((CASE_NUMBER_RE.test(t) || TITLE_CASE_NUMBER_RE.test(t)) && (/No\.|____|\/|20\d\d/i.test(t))) ||
      (ALL_CAPS_RE.test(cleanT) && cleanT.length >= 5) ||
      t.startsWith("<!--") ||
      t.startsWith("<table") ||
      /^\|.+\|/.test(t)
    );
  }

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Blank lines → spacer paragraph for visual spacing
    if (!trimmed) {
      let blankCount = 0;
      while (i < lines.length && !lines[i].trim()) {
        blankCount++;
        i++;
      }
      if (blankCount >= 3) {
        blocks.push(`<p style="margin-top:1.5em">&nbsp;</p>`);
      } else if (blankCount >= 2) {
        blocks.push(`<p style="margin-top:0.8em">&nbsp;</p>`);
      } else {
        blocks.push(`<p style="margin-top:0.4em">&nbsp;</p>`);
      }
      continue;
    }

    // Markdown heading detection (###, ##, #)
    if (/^#{1,4}\s+/.test(trimmed)) {
      const match = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const headingText = match[2].trim();
        const tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
        const cleanHeading = headingText.replace(/^\*+|\*+$/g, "").trim();
        if (CENTRED_TITLE_RE.test(cleanHeading) || COURT_TITLE_RE.test(cleanHeading)) {
          blocks.push(`<${tag} style="text-align:center"><strong>${parseInlineFormatting(headingText)}</strong></${tag}>`);
        } else {
          blocks.push(`<${tag}><strong>${parseInlineFormatting(headingText)}</strong></${tag}>`);
        }
        i++;
        continue;
      }
    }

    // Horizontal rule (---, ***, ___)
    if (HORIZONTAL_RULE_RE.test(trimmed)) {
      blocks.push(`<hr>`);
      i++;
      continue;
    }

    // Bullet lists (- item, * item, • item, + item)
    if (BULLET_ITEM_RE.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        const bulletMatch = cur.match(BULLET_ITEM_RE);
        if (bulletMatch) {
          listItems.push(bulletMatch[1]);
          i++;
        } else if (cur && !isSpecialLine(cur) && lines[i].startsWith("  ")) {
          // Indented continuation line for the previous bullet item
          if (listItems.length > 0) {
            listItems[listItems.length - 1] += " " + cur;
          } else {
            listItems.push(cur);
          }
          i++;
        } else {
          break;
        }
      }
      if (listItems.length > 0) {
        const itemsHtml = listItems.map((item) => `<li>${parseInlineFormatting(item)}</li>`).join("");
        blocks.push(`<ul>${itemsHtml}</ul>`);
      }
      continue;
    }

    // HTML table passthrough
    if (trimmed.startsWith("<!-- INDEX_TABLE") || trimmed.startsWith("<table")) {
      const html: string[] = [];
      while (i < lines.length) {
        html.push(lines[i]);
        if (lines[i].includes("</table>") || lines[i].includes("INDEX_TABLE_END")) {
          i++;
          break;
        }
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
      const dataLines = tableLines.filter((l) => {
        const stripped = l.replace(/\s/g, "");
        return !/^\|[-:| ]+\|$/.test(stripped);
      });
      if (dataLines.length > 0) {
        let tableHtml = '<table style="width:100%;border-collapse:collapse;border:1px solid #333;margin:1em 0">';
        dataLines.forEach((line, rowIdx) => {
          const cells = line
            .split("|")
            .filter((c) => c.trim() !== "" || c.length > 0)
            .map((c) => c.trim())
            .filter((c) => c !== "");
          if (cells.length === 0) return;
          const tag = rowIdx === 0 ? "th" : "td";
          const bgStyle = rowIdx === 0 ? "background:#f0f0f0;font-weight:bold;" : "";
          tableHtml += "<tr>";
          cells.forEach((cell) => {
            tableHtml += `<${tag} style="border:1px solid #333;padding:6px 10px;${bgStyle}">${parseInlineFormatting(cell)}</${tag}>`;
          });
          tableHtml += "</tr>";
        });
        tableHtml += "</table>";
        blocks.push(tableHtml);
      }
      continue;
    }

    // Skip HTML comments
    if (trimmed.startsWith("<!--")) {
      i++;
      continue;
    }

    // <br> passthrough for spacing
    if (/^<br\s*\/?>$/i.test(trimmed)) {
      blocks.push(`<p>&nbsp;</p>`);
      i++;
      continue;
    }

    // Court title → centred H1 bold
    if (COURT_TITLE_RE.test(trimmed)) {
      blocks.push(`<h1 style="text-align:center"><strong>${parseInlineFormatting(trimmed)}</strong></h1>`);
      i++;
      continue;
    }

    // Court subtitle like (JUDICIAL DEPARTMENT) → centred italic/bold
    if (SUBTITLE_RE.test(trimmed)) {
      blocks.push(`<p style="text-align:center;font-weight:bold;margin-top:0.2em;margin-bottom:0.6em"><em>${parseInlineFormatting(trimmed)}</em></p>`);
      i++;
      continue;
    }

    // Case number line → centred bold
    if ((CASE_NUMBER_RE.test(trimmed) || TITLE_CASE_NUMBER_RE.test(trimmed)) && (/No\.|____|\/|20\d\d/i.test(trimmed))) {
      blocks.push(`<p style="text-align:center"><strong>${parseInlineFormatting(trimmed)}</strong></p>`);
      i++;
      continue;
    }

    // VERSUS → centred bold
    if (VERSUS_RE.test(trimmed)) {
      blocks.push(`<p style="text-align:center;margin:0.8em 0"><strong>VERSUS</strong></p>`);
      i++;
      continue;
    }

    // Party role with dots or standalone → right-aligned bold
    if (PARTY_ROLE_RE.test(trimmed) || PARTY_ROLE_LINE_RE.test(trimmed) || STANDALONE_ROLE_RE.test(trimmed)) {
      blocks.push(`<p style="text-align:right"><strong>${parseInlineFormatting(trimmed)}</strong></p>`);
      i++;
      continue;
    }

    // "Through:" line → left-aligned bold (signature block)
    if (THROUGH_RE.test(trimmed)) {
      blocks.push(`<p><strong>${parseInlineFormatting(trimmed)}</strong></p>`);
      i++;
      continue;
    }

    // AFFIDAVIT / VAKALATNAMA → page break heading
    if (/^AFFIDAVIT\s*:?\s*$/i.test(trimmed)) {
      blocks.push(`<div data-type="legal-page-break" data-page-break="true"></div>`);
      blocks.push(`<h2>${parseInlineFormatting(trimmed)}</h2>`);
      i++;
      continue;
    }

    if (/^VAKALATNAMA\s*:?\s*$/i.test(trimmed)) {
      blocks.push(`<div data-type="legal-page-break" data-page-break="true"></div>`);
      blocks.push(`<h2>${parseInlineFormatting(trimmed)}</h2>`);
      i++;
      continue;
    }

    // RESPECTFULLY SHEWETH → section heading
    if (/^RESPECTFULLY SHEWETH\s*:?\s*$/i.test(trimmed)) {
      blocks.push(`<h2><strong>${parseInlineFormatting(trimmed)}</strong></h2>`);
      i++;
      continue;
    }

    // Known section headings → H2
    const cleanTrimmed = trimmed.replace(/^[*_#\s]+|[*_#\s]+$/g, "").trim();
    const upper = cleanTrimmed.toUpperCase().replace(/:$/, "");
    if (SECTION_HEADINGS.has(upper) || SECTION_HEADINGS.has(cleanTrimmed.toUpperCase())) {
      if (CENTRED_TITLE_RE.test(cleanTrimmed)) {
        blocks.push(`<h2 style="text-align:center"><strong>${parseInlineFormatting(trimmed)}</strong></h2>`);
      } else {
        blocks.push(`<h2><strong>${parseInlineFormatting(trimmed)}</strong></h2>`);
      }
      i++;
      continue;
    }

    // Main centered pleading / petition title or contract title
    if (CENTRED_TITLE_RE.test(cleanTrimmed)) {
      blocks.push(`<h2 style="text-align:center"><strong>${parseInlineFormatting(trimmed)}</strong></h2>`);
      i++;
      continue;
    }

    // ALL-CAPS headings (petition titles, etc.)
    if (ALL_CAPS_RE.test(cleanTrimmed) && cleanTrimmed.length >= 5) {
      if (CENTRED_TITLE_RE.test(cleanTrimmed) || CASE_NUMBER_RE.test(cleanTrimmed) || COURT_TITLE_RE.test(cleanTrimmed)) {
        blocks.push(`<h2 style="text-align:center"><strong>${parseInlineFormatting(trimmed)}</strong></h2>`);
      } else {
        blocks.push(`<h2><strong>${parseInlineFormatting(trimmed)}</strong></h2>`);
      }
      i++;
      continue;
    }

    // Numbered items, grounds (1., 1.1, A., B., I., II., (a), (b), a), b)) → formatted distinct block
    if (GROUND_OR_NUMBERED_RE.test(trimmed)) {
      const pLines: string[] = [trimmed];
      i++;
      while (i < lines.length) {
        const cur = lines[i].trim();
        if (!cur) break; // blank line ends this ground/clause
        if (isSpecialLine(cur)) break;
        pLines.push(cur);
        i++;
      }
      blocks.push(`<p style="text-indent:1.5em">${parseInlineFormatting(pLines.join(" "))}</p>`);
      continue;
    }

    // Standard body paragraph
    const pLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i].trim();
      if (!cur) break;
      if (isSpecialLine(cur)) break;
      pLines.push(cur);
      i++;
    }
    if (pLines.length > 0) {
      blocks.push(`<p>${parseInlineFormatting(pLines.join("<br>"))}</p>`);
    }
  }

  return blocks.length > 0 ? blocks.join("") : "<p></p>";
}

export function isHTMLContent(content: string): boolean {
  if (!content) return false;
  const t = content.trimStart();
  return (
    t.startsWith("<") &&
    (t.startsWith("<p") ||
      t.startsWith("<h") ||
      t.startsWith("<ol") ||
      t.startsWith("<ul") ||
      t.startsWith("<div") ||
      t.startsWith("<!") ||
      t.startsWith("<br") ||
      t.startsWith("<table") ||
      t.startsWith("<hr"))
  );
}
