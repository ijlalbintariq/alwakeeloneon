export interface LawItem {
  name: string;
  section: string;
  description: string;
}

export interface JudgmentItem {
  citation: string;
  court: string;
  title: string;
  description: string;
}

export interface CleanChatResult {
  cleanContent: string;
  references: {
    laws: LawItem[];
    judgments: JudgmentItem[];
  } | null;
}

function parseJsonLoose(raw: string): any | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(text.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(text.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

function normalizeLaws(input: any): LawItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((l: any) => ({
      name: String(l?.name || l?.statute || l?.title || "").trim(),
      section: String(l?.section || l?.sec || "").trim(),
      description: String(l?.description || l?.summary || l?.snippet || "").trim(),
    }))
    .filter((l) => l.name.length > 0 || l.section.length > 0)
    .slice(0, 15);
}

function normalizeJudgments(input: any): JudgmentItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((j: any) => ({
      citation: String(j?.citation || j?.cite || "").trim(),
      court: String(j?.court || "Supreme Court of Pakistan").trim(),
      title: String(j?.title || j?.caseName || j?.name || "").trim(),
      description: String(j?.description || j?.summary || j?.snippet || j?.ratio || "").trim(),
    }))
    .filter((j) => j.citation.length > 0)
    .slice(0, 15);
}

export function cleanLegalChatResponse(content: string): CleanChatResult {
  if (!content) {
    return { cleanContent: "", references: null };
  }

  let body = String(content);

  // 1. Strip think blocks
  body = body.replace(/<think>[\s\S]*?<\/think>/gi, "");
  body = body.replace(/<think>[\s\S]*$/gi, "");

  let extractedPayload: any = null;

  // 2. Fenced ```references ... ``` blocks
  const refFencedPattern = /```references\s*\n?([\s\S]*?)\n?```/gi;
  let match: RegExpExecArray | null;
  while ((match = refFencedPattern.exec(body)) !== null) {
    const parsed = parseJsonLoose(match[1]);
    if (parsed && (Array.isArray(parsed.laws) || Array.isArray(parsed.judgments))) {
      extractedPayload = parsed;
    }
  }
  body = body.replace(refFencedPattern, "").trimEnd();

  // 3. Fenced ```json ... ``` blocks with laws/judgments
  const jsonFencedPattern = /```(?:json)?\s*\n?(\{[\s\S]*?"(?:laws|judgments)"[\s\S]*?\})\s*\n?```/gi;
  while ((match = jsonFencedPattern.exec(body)) !== null) {
    const parsed = parseJsonLoose(match[1]);
    if (parsed && (Array.isArray(parsed.laws) || Array.isArray(parsed.judgments))) {
      extractedPayload = extractedPayload || parsed;
    }
  }
  body = body.replace(jsonFencedPattern, "").trimEnd();

  // 4. Raw trailing JSON block: {"laws":[...],"judgments":[...]} or {"judgments":[...],"laws":[...]}
  const rawJsonPattern = /\n?\s*(\{[\s\S]*?"(?:laws|judgments)"\s*:\s*\[[\s\S]*?\][\s\S]*?\})\s*$/i;
  const rawMatch = body.match(rawJsonPattern);
  if (rawMatch && typeof rawMatch.index === "number") {
    const parsed = parseJsonLoose(rawMatch[1]);
    if (parsed && (Array.isArray(parsed.laws) || Array.isArray(parsed.judgments))) {
      extractedPayload = extractedPayload || parsed;
      body = body.slice(0, rawMatch.index).trimEnd();
    }
  }

  // 5. In-progress / Truncated streaming JSON cutoffs
  const truncatedPatterns = [
    /\n?\s*\{\s*"laws"\s*:\s*\[[\s\S]*$/i,
    /\n?\s*\{\s*"judgments"\s*:\s*\[[\s\S]*$/i,
    /\n?\s*\{\s*"(?:laws|judgments)"[\s\S]*$/i,
    /\n?\s*```references[\s\S]*$/i,
  ];
  for (const pat of truncatedPatterns) {
    body = body.replace(pat, "").trimEnd();
  }

  // 6. Cleanup empty / malformed references artifact tokens
  body = body.replace(/\n?\s*\{\s*"laws"\s*:\s*\[\s*\]\s*,\s*"judgments"\s*:\s*\[\s*\]\s*\}\s*$/i, "").trimEnd();
  body = body.replace(/\n?\s*\{\s*"judgments"\s*:\s*\[\s*\]\s*,\s*"laws"\s*:\s*\[\s*\]\s*\}\s*$/i, "").trimEnd();
  body = body.replace(/\n?\s*\{\s*"laws"\s*[:;,]?\s*[,:]?\s*"judgments"\s*[:;,]?\s*\}\s*$/i, "").trimEnd();
  body = body.replace(/\n?\s*\{\s*"judgments"\s*[:;,]?\s*[,:]?\s*"laws"\s*[:;,]?\s*\}\s*$/i, "").trimEnd();

  let references = null;
  if (extractedPayload) {
    const laws = normalizeLaws(extractedPayload.laws);
    const judgments = normalizeJudgments(extractedPayload.judgments);
    if (laws.length > 0 || judgments.length > 0) {
      references = { laws, judgments };
    }
  }

  return {
    cleanContent: body.trim(),
    references,
  };
}
