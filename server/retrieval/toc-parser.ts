export type TocItem = {
  title: string;
  children?: TocItem[];
};

const MAIN_HEADING = /^\s*(PART|CHAPTER|SCHEDULE|TITLE|BOOK|VOLUME)\s+([A-Z0-9IVXLCM\-\.]+)?\s*[:\-\u2013\u2014]?\s*(.*)$/i;
const SUB_HEADING = /^\s*(ARTICLE|SECTION|RULE|CLAUSE)\s+([0-9A-Z\-\.]+)\s*[:\-\u2013\u2014]?\s*(.*)$/i;

function cleanTitle(value: string): string {
  return (value || "")
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F]/g, "")
    .trim()
    .slice(0, 80);
}

function isLikelyHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length < 4 || trimmed.length > 120) return false;
  const upperRatio = trimmed.replace(/[^A-Za-z]/g, "").split("").filter((c) => c === c.toUpperCase()).length /
    Math.max(1, trimmed.replace(/[^A-Za-z]/g, "").length);
  return upperRatio > 0.75;
}

export function extractTocFromText(content: string): TocItem[] {
  const lines = (content || "").split(/\r?\n/).slice(0, 4000);
  const toc: TocItem[] = [];
  let currentMain: TocItem | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const main = line.match(MAIN_HEADING);
    if (main) {
      const title = cleanTitle(`${main[1]} ${main[2] || ""} ${main[3] || ""}`);
      if (!title) continue;
      currentMain = { title };
      toc.push(currentMain);
      continue;
    }

    const sub = line.match(SUB_HEADING);
    if (sub) {
      const childTitle = cleanTitle(`${sub[1]} ${sub[2] || ""} ${sub[3] || ""}`);
      if (!childTitle) continue;
      if (!currentMain) {
        currentMain = { title: "General" };
        toc.push(currentMain);
      }
      if (!currentMain.children) currentMain.children = [];
      if (currentMain.children.length < 80) {
        currentMain.children.push({ title: childTitle });
      }
      continue;
    }

    if (isLikelyHeading(line)) {
      const heading = cleanTitle(line);
      if (!heading) continue;
      currentMain = { title: heading };
      toc.push(currentMain);
    }

    if (toc.length >= 120) break;
  }

  if (toc.length === 0) {
    return [{ title: "Document Overview" }];
  }

  return toc;
}
