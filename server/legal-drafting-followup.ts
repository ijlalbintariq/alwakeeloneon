export type LegalDraftFollowUpOperation =
  | "answer"
  | "initial-draft"
  | "targeted-edit"
  | "section-edit"
  | "full-rewrite"
  | "conversion"
  | "clarify";

export type LegalDraftEditAction = "replace" | "insert-before" | "insert-after" | "delete";

export type LegalDraftEditTarget = {
  label: string;
  start: number;
  end: number;
  text: string;
  action: LegalDraftEditAction;
};

const FULL_REWRITE_PATTERN =
  /\b(full|complete|entire|whole)\s+(rewrite|redraft|regenerate|draft|version)\b|\bfrom\s+scratch\b|\bstart\s+over\b|\brewrite\s+everything\b|\bregenerate\s+everything\b|\bfresh\s+draft\b/i;
const CONVERSION_PATTERN =
  /\b(convert|transform|turn)\s+(?:this|it|the\s+draft)?\s*(?:into|to)\s+(?:a|an)?\s*(?:civil|criminal|constitutional|writ|bail|appeal|revision|petition|plaint|suit|application|affidavit|notice|power\s+of\s+attorney|written\s+statement)\b|\bmake\s+(?:this|it|the\s+draft)\s+into\s+(?:a|an)?\s*(?:petition|plaint|suit|application|affidavit|notice|appeal|revision|written\s+statement)\b/i;
const MUTATION_PATTERN =
  /\b(add|insert|include|incorporate|apply|use|put|delete|remove|omit|replace|change|shorten|condense|expand|elaborate|strengthen|improve|enhance|rewrite|redraft|revise|amend|edit|update|polish|format|finalize|fix|correct|reword|rephrase|restructure|move|make|undo|revert)\b/i;
const EXPLICIT_DRAFT_ACTION_PATTERN =
  /^(?:please\s+)?(?:draft|prepare|write|generate|create)\b|\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:draft|prepare|write|generate|create)\b/i;
const ANSWER_PATTERN =
  /\b(review|explain|analyse|analyze|check|identify|tell|compare|opinion|advice|why|what|which|whether|maintainable|valid|correct|wrong|risk|issue|problem|contradict)\b|\?\s*$/i;
const DIRECT_QUESTION_PATTERN = /^(?:is|are|was|were|do|does|did|can|could|would|should|will|what|why|which|whether|how)\b/i;
const EXPLICIT_MUTATION_COMMAND_PATTERN =
  /^(?:please\s+)?(?:add|insert|include|incorporate|apply|use|put|delete|remove|omit|replace|change|shorten|condense|expand|elaborate|strengthen|improve|enhance|rewrite|redraft|revise|amend|edit|update|polish|format|finalize|fix|correct|reword|rephrase|restructure|move|make|undo|revert)\b|\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:add|insert|include|incorporate|apply|use|put|delete|remove|omit|replace|change|shorten|condense|expand|elaborate|strengthen|improve|enhance|rewrite|redraft|revise|amend|edit|update|polish|format|finalize|fix|correct|reword|rephrase|restructure|move|make|undo|revert)\b/i;

const SECTION_PATTERNS: Array<{
  label: string;
  prompt: RegExp;
  heading: RegExp;
}> = [
  {
    label: "PRELIMINARY OBJECTIONS",
    prompt: /\bpreliminary\s+objections?\b/i,
    heading: /^\s*PRELIMINARY\s+OBJECTIONS?\s*:?[ \t]*$/im,
  },
  {
    label: "CAUSE OF ACTION",
    prompt: /\bcause\s+of\s+action\b/i,
    heading: /^\s*CAUSE\s+OF\s+ACTION\s*:?[ \t]*$/im,
  },
  {
    label: "JURISDICTION",
    prompt: /\bjurisdiction(?:al)?\b/i,
    heading: /^\s*JURISDICTION(?:\s+AND\s+VALUATION)?\s*:?[ \t]*$/im,
  },
  {
    label: "BRIEF FACTS",
    prompt: /\b(?:brief\s+facts|material\s+facts|facts(?:\s+of\s+the\s+case)?)\b/i,
    heading: /^\s*(?:BRIEF\s+FACTS|MATERIAL\s+FACTS|FACTS(?:\s+OF\s+THE\s+CASE)?)\s*:?[ \t]*$/im,
  },
  {
    label: "GROUNDS",
    prompt: /\bgrounds?\b/i,
    heading: /^\s*GROUNDS?(?:\s+OF\s+(?:APPEAL|PETITION|APPLICATION|REVISION))?\s*:?[ \t]*$/im,
  },
  {
    label: "PRAYER",
    prompt: /\b(?:prayer|relief\s+sought|reliefs?)\b/i,
    heading: /^\s*(?:PRAYER|RELIEF\s+SOUGHT)\s*:?[ \t]*$/im,
  },
  {
    label: "VERIFICATION",
    prompt: /\bverification\b/i,
    heading: /^\s*VERIFICATION\s*:?[ \t]*$/im,
  },
  {
    label: "AFFIDAVIT",
    prompt: /\baffidavit\b/i,
    heading: /^\s*AFFIDAVIT\s*:?[ \t]*$/im,
  },
  {
    label: "ANNEXURES",
    prompt: /\b(?:annexures?|index\s+of\s+documents)\b/i,
    heading: /^\s*(?:ANNEXURES?|INDEX\s+OF\s+DOCUMENTS)\s*:?[ \t]*$/im,
  },
];

const ANY_MAJOR_HEADING =
  /^\s*(?:PRELIMINARY\s+OBJECTIONS?|CAUSE\s+OF\s+ACTION|JURISDICTION(?:\s+AND\s+VALUATION)?|BRIEF\s+FACTS|MATERIAL\s+FACTS|FACTS(?:\s+OF\s+THE\s+CASE)?|GROUNDS?(?:\s+OF\s+(?:APPEAL|PETITION|APPLICATION|REVISION))?|PRAYER|RELIEF\s+SOUGHT|VERIFICATION|AFFIDAVIT|ANNEXURES?|INDEX\s+OF\s+DOCUMENTS|INTERIM\s+RELIEF)\s*:?[ \t]*$/gim;

function resolveAction(prompt: string): LegalDraftEditAction {
  if (/\b(delete|remove|omit)\b/i.test(prompt)) return "delete";
  if (/\b(?:add|insert|include|incorporate|put|move)\b[\s\S]{0,50}\bbefore\b/i.test(prompt)) return "insert-before";
  if (/\b(?:add|insert|include|incorporate|put|move)\b[\s\S]{0,50}\bafter\b/i.test(prompt)) return "insert-after";
  if (/\b(?:add|insert|include|incorporate)\b/i.test(prompt)) return "insert-after";
  return "replace";
}

export function classifyLegalDraftFollowUp(input: {
  prompt: string;
  hasDraft: boolean;
  hasSelection: boolean;
  requestedMode?: string;
}): LegalDraftFollowUpOperation {
  const prompt = String(input.prompt || "").trim();
  const hasMutation = MUTATION_PATTERN.test(prompt) || EXPLICIT_DRAFT_ACTION_PATTERN.test(prompt);
  const asksForAnswer = ANSWER_PATTERN.test(prompt);
  const asksAboutPriorAction = /\b(?:what|which)\s+(?:did\s+you|was)\s+(?:change|changed|edit|edited|do|done)\b/i.test(prompt);
  const isDirectQuestion = DIRECT_QUESTION_PATTERN.test(prompt) && !EXPLICIT_MUTATION_COMMAND_PATTERN.test(prompt) && !EXPLICIT_DRAFT_ACTION_PATTERN.test(prompt);

  if (FULL_REWRITE_PATTERN.test(prompt)) return input.hasDraft ? "full-rewrite" : "initial-draft";
  if (CONVERSION_PATTERN.test(prompt)) return input.hasDraft ? "conversion" : "initial-draft";
  if (input.hasSelection) {
    return hasMutation && !asksAboutPriorAction ? "targeted-edit" : "answer";
  }
  if (!input.hasDraft) {
    return input.requestedMode === "analysis" || (asksForAnswer && !hasMutation)
      ? "answer"
      : "initial-draft";
  }
  if (asksAboutPriorAction || isDirectQuestion || (asksForAnswer && !hasMutation)) return "answer";
  if (hasMutation) {
    if (
      findLegalDraftEditTarget(input.prompt, "") ||
      /\b(?:paragraph|para)\s*(?:no\.?\s*)?\d{1,3}\b/i.test(prompt) ||
      /\bground\s+[A-Z]\b/i.test(prompt)
    ) return "section-edit";
    return "clarify";
  }
  if (input.requestedMode === "analysis") return "answer";
  return "clarify";
}

function findRangeForMatch(source: string, match: RegExpMatchArray): { start: number; end: number } | null {
  if (typeof match.index !== "number") return null;
  const start = match.index;
  ANY_MAJOR_HEADING.lastIndex = start + match[0].length;
  const next = ANY_MAJOR_HEADING.exec(source);
  ANY_MAJOR_HEADING.lastIndex = 0;
  const rawEnd = next?.index ?? source.length;
  const end = start + source.slice(start, rawEnd).trimEnd().length;
  return { start, end };
}

function findNumberedTarget(source: string, prompt: string): LegalDraftEditTarget | null {
  const requested = prompt.match(/\b(?:paragraph|para|fact|ground)\s*(?:no\.?\s*)?(\d{1,3})\b/i);
  if (!requested) return null;
  const number = Number(requested[1]);
  const itemPattern = new RegExp(
    `(?:^|\\n)([ \\t]*${number}[.)][ \\t]+[\\s\\S]*?)(?=\\n[ \\t]*(?:\\d{1,3}[.)][ \\t]+|[A-Z][.)][ \\t]+|PRELIMINARY\\s+OBJECTIONS?|CAUSE\\s+OF\\s+ACTION|JURISDICTION|BRIEF\\s+FACTS|MATERIAL\\s+FACTS|GROUNDS?|PRAYER|RELIEF\\s+SOUGHT|VERIFICATION|AFFIDAVIT|ANNEXURES?|INDEX\\s+OF\\s+DOCUMENTS|INTERIM\\s+RELIEF)[ \\t]*:?|$)`,
    "mi",
  );
  const match = source.match(itemPattern);
  if (!match || typeof match.index !== "number") return null;
  const prefixLength = match[0].length - match[1].length;
  const start = match.index + prefixLength;
  const end = start + match[1].length;
  return {
    label: `PARAGRAPH ${number}`,
    start,
    end,
    text: source.slice(start, end),
    action: resolveAction(prompt),
  };
}

function findLetteredGroundTarget(source: string, prompt: string): LegalDraftEditTarget | null {
  const requested = prompt.match(/\bground\s+([A-Z])\b/i);
  if (!requested) return null;
  const letter = requested[1].toUpperCase();
  const itemPattern = new RegExp(
    `(?:^|\\n)([ \\t]*${letter}[.)][ \\t]+[\\s\\S]*?)(?=\\n[ \\t]*(?:[A-Z][.)][ \\t]+|PRELIMINARY\\s+OBJECTIONS?|CAUSE\\s+OF\\s+ACTION|JURISDICTION|BRIEF\\s+FACTS|MATERIAL\\s+FACTS|GROUNDS?|PRAYER|RELIEF\\s+SOUGHT|VERIFICATION|AFFIDAVIT|ANNEXURES?|INDEX\\s+OF\\s+DOCUMENTS|INTERIM\\s+RELIEF)[ \\t]*:?|$)`,
    "mi",
  );
  const match = source.match(itemPattern);
  if (!match || typeof match.index !== "number") return null;
  const prefixLength = match[0].length - match[1].length;
  const start = match.index + prefixLength;
  const end = start + match[1].length;
  return {
    label: `GROUND ${letter}`,
    start,
    end,
    text: source.slice(start, end),
    action: resolveAction(prompt),
  };
}

export function findLegalDraftEditTarget(
  prompt: string,
  draftText: string,
): LegalDraftEditTarget | null {
  const source = String(draftText || "");
  const numbered = findNumberedTarget(source, prompt);
  if (numbered || /\b(?:paragraph|para)\s*(?:no\.?\s*)?\d{1,3}\b/i.test(prompt)) return numbered;
  const lettered = findLetteredGroundTarget(source, prompt);
  if (lettered || /\bground\s+[A-Z]\b/i.test(prompt)) return lettered;

  for (const section of SECTION_PATTERNS) {
    if (!section.prompt.test(prompt)) continue;
    if (!source) {
      return { label: section.label, start: 0, end: 0, text: "", action: resolveAction(prompt) };
    }
    const match = source.match(section.heading);
    if (!match) return null;
    const range = findRangeForMatch(source, match);
    if (!range) return null;
    return {
      label: section.label,
      ...range,
      text: source.slice(range.start, range.end).trimEnd(),
      action: resolveAction(prompt),
    };
  }
  return null;
}

export function resolveExplicitSelectionTarget(input: {
  draftText: string;
  selectedSnippet: string;
  selectedStart: number | null;
  selectedEnd: number | null;
  prompt: string;
}): LegalDraftEditTarget | null {
  const source = String(input.draftText || "");
  const snippet = String(input.selectedSnippet || "");
  const start = input.selectedStart;
  const end = input.selectedEnd;
  if (
    typeof start === "number" &&
    typeof end === "number" &&
    start >= 0 &&
    end > start &&
    end <= source.length &&
    source.slice(start, end) === snippet
  ) {
    return { label: "SELECTED TEXT", start, end, text: snippet, action: resolveAction(input.prompt) };
  }
  if (!snippet) return null;
  const first = source.indexOf(snippet);
  if (first < 0 || source.indexOf(snippet, first + snippet.length) >= 0) return null;
  return {
    label: "SELECTED TEXT",
    start: first,
    end: first + snippet.length,
    text: snippet,
    action: resolveAction(input.prompt),
  };
}

export function applyLegalDraftEdit(input: {
  draftText: string;
  target: LegalDraftEditTarget;
  replacementText: string;
}): { ok: true; text: string } | { ok: false; reason: string } {
  const source = String(input.draftText || "");
  const { target } = input;
  if (target.start < 0 || target.end < target.start || target.end > source.length) {
    return { ok: false, reason: "The edit target is outside the current draft." };
  }
  if (source.slice(target.start, target.end).trimEnd() !== target.text.trimEnd()) {
    return { ok: false, reason: "The draft changed before the edit could be applied." };
  }
  const replacement = String(input.replacementText || "").trim();
  if (target.action !== "delete" && !replacement) {
    return { ok: false, reason: "AI returned empty edit text." };
  }

  const before = source.slice(0, target.start);
  const selected = source.slice(target.start, target.end);
  const after = source.slice(target.end);
  if (target.action === "delete") return { ok: true, text: `${before}${after}` };
  if (target.action === "insert-before") return { ok: true, text: `${before}${replacement}\n${selected}${after}` };
  if (target.action === "insert-after") return { ok: true, text: `${before}${selected}\n${replacement}${after}` };
  return { ok: true, text: `${before}${replacement}${after}` };
}

export function buildLegalDraftEditSummary(operation: LegalDraftFollowUpOperation, targetLabel?: string): string {
  if (operation === "targeted-edit" || operation === "section-edit") {
    return `Updated ${targetLabel || "the requested portion"} only. The rest of the draft was preserved.`;
  }
  if (operation === "conversion") return "Converted the complete draft to the requested filing type.";
  if (operation === "full-rewrite") return "Rewrote the complete draft as explicitly requested.";
  if (operation === "initial-draft") return "Created the complete legal draft.";
  return "Completed the requested drafting action.";
}
