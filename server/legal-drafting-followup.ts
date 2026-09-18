export type LegalDraftFollowUpOperation =
  | "answer"
  | "initial-draft"
  | "targeted-edit"
  | "section-edit"
  | "full-rewrite"
  | "conversion"
  | "ambiguous-edit"
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
  /\b(full|complete|entire|whole)\s+(rewrite|redraft|regenerate|draft|version)\b|\bfrom\s+scratch\b|\bstart\s+over\b|\b(?:rewrite|redraft|regenerate|redo)\s+(?:the\s+)?(everything|entire|whole)\b|\bfresh\s+draft\b/i;
// FULL_REWRITE_PATTERN also matches intensity-only phrasing ("a complete rewrite
// of the grounds"), which is still a section edit. This is the narrower set that
// names the DOCUMENT as the scope, and it is what outranks the section guard below.
const WHOLE_DOCUMENT_SCOPE_PATTERN =
  /\b(?:whole|entire|complete|full)\s+(?:draft|document|pleading|petition|application|filing|plaint|suit|thing)\b|\bfrom\s+scratch\b|\bstart\s+over\b|\brewrite\s+(?:it\s+)?(?:everything|all)\b|\bregenerate\s+everything\b/i;
const CONVERSION_PATTERN =
  /\b(convert|transform|turn|rewrite|redraft)\s+(?:this|it|the\s+draft|the\s+entire\s+document)?\s*(?:into|to|as)\s+(?:a|an)?\s*(?:civil|criminal|constitutional|writ|bail|appeal|revision|petition|plaint|suit|application|affidavit|notice|power\s+of\s+attorney|written\s+statement)\b|\bmake\s+(?:this|it|the\s+draft)\s+into\s+(?:a|an)?\s*(?:petition|plaint|suit|application|affidavit|notice|appeal|revision|written\s+statement)\b/i;
// "fill", "complete" and friends were missing, so a plain instruction like
// "fill in the facts: <full particulars>" matched no mutation verb and fell
// through to a clarification prompt.
const MUTATION_PATTERN =
  /\b(add|insert|include|incorporate|apply|use|put|delete|remove|omit|replace|change|shorten|condense|expand|elaborate|strengthen|improve|enhance|rewrite|redraft|revise|amend|edit|update|polish|format|finalize|fix|correct|c[io]{1,2}r{1,2}ect|reword|rephrase|restructure|move|make|undo|revert|fill|complete|populate|enter|set|substitute|swap|tighten|trim|extend|lengthen|shorten|merge|split|renumber|reorder)\b/i;
const EXPLICIT_DRAFT_ACTION_PATTERN =
  /\b(?:task\s*:?\s*)?(?:draft|prepare|write|generate|create)\s+(?:a|an|the|this|new|fresh|court|constitutional|writ|bail|plaint|suit|petition|application|pleading|affidavit|notice|agreement|contract)\b|\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:draft|prepare|write|generate|create)\b|^(?:please\s+)?(?:draft|prepare|write|generate|create)\b/i;
const EXPLICIT_NEW_FILING_PATTERN =
  /\b(?:task\s*:?\s*)?(?:draft|prepare|write|generate|create)\b[\s\S]{0,60}\b(?:petition|writ|suit|plaint|bail|application|affidavit|appeal|revision|reply|statement|notice|contract|agreement|power\s+of\s+attorney|constitutional\s+petition)\b/i;
const ANSWER_PATTERN =
  /\b(review|explain|analyse|analyze|check|identify|tell|compare|opinion|advice|why|what|which|whether|maintainable|valid|correct|c[io]{1,2}r{1,2}ect|wrong|risk|issue|problem|contradict)\b|\?\s*$/i;
const DIRECT_QUESTION_PATTERN = /^(?:is|are|was|were|do|does|did|can|could|would|should|will|what|why|which|whether|how)\b/i;
// Keep this verb set in step with MUTATION_PATTERN above.
const EXPLICIT_MUTATION_COMMAND_PATTERN =
  /^(?:please\s+)?(?:add|insert|include|incorporate|apply|use|put|delete|remove|omit|replace|change|shorten|condense|expand|elaborate|strengthen|improve|enhance|rewrite|redraft|revise|amend|edit|update|polish|format|finalize|fix|correct|reword|rephrase|restructure|move|make|undo|revert|fill|complete|populate|enter|set|substitute|swap|tighten|trim|extend|lengthen|merge|split|renumber|reorder)\b|\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:add|insert|include|incorporate|apply|use|put|delete|remove|omit|replace|change|shorten|condense|expand|elaborate|strengthen|improve|enhance|rewrite|redraft|revise|amend|edit|update|polish|format|finalize|fix|correct|reword|rephrase|restructure|move|make|undo|revert|fill|complete|populate|enter|set|substitute|swap|tighten|trim|extend|lengthen|merge|split|renumber|reorder)\b/i;

/**
 * Court drafts routinely letter-space their headings — "G R O U N D S:",
 * "P R A Y E R:". A literal /GROUNDS/ never matches those, so section targeting
 * dead-ended on drafts produced from the app's own templates. These builders
 * tolerate the gaps. Offsets stay valid because the source text is never changed.
 *
 * "GROUNDS" -> /G[ \t]*R[ \t]*O[ \t]*U[ \t]*N[ \t]*D[ \t]*S/ */
const sp = (word: string) => word.split("").join("[ \\t]*");

/** Build a heading matcher from plain alternatives, e.g. ["BRIEF FACTS", "FACTS"]. */
/**
 * Builds a court-heading matcher that tolerates what Pakistani pleadings actually
 * write: letter-spaced capitals ("P R A Y E R"), a trailing colon, and qualifier
 * prefixes ("MOST RESPECTFULLY SHEWETH", "MAIN PRAYER").
 */
export function heading(...alternatives: string[]): RegExp {
  const body = alternatives
    .map((alt) => alt.trim().split(/\s+/).map(sp).join("\\s+"))
    .join("|");
  return new RegExp(`^\\s*(?:${body})\\s*:?[ \\t]*$`, "im");
}

const SECTION_PATTERNS: Array<{
  label: string;
  prompt: RegExp;
  heading: RegExp;
}> = [
  {
    label: "PRELIMINARY OBJECTIONS",
    prompt: /\bpreliminary\s+objections?\b/i,
    heading: heading("PRELIMINARY OBJECTIONS", "PRELIMINARY OBJECTION"),
  },
  {
    label: "CAUSE OF ACTION",
    prompt: /\bcause\s+of\s+action\b/i,
    heading: heading("CAUSE OF ACTION"),
  },
  {
    label: "JURISDICTION",
    prompt: /\bjurisdiction(?:al)?\b/i,
    heading: heading("JURISDICTION AND VALUATION", "JURISDICTION"),
  },
  {
    label: "BRIEF FACTS",
    prompt: /\b(?:brief\s+facts|material\s+facts|facts(?:\s+of\s+the\s+case)?)\b/i,
    heading: heading("BRIEF FACTS", "MATERIAL FACTS", "FACTS OF THE CASE", "FACTS"),
  },
  {
    label: "GROUNDS",
    prompt: /\bgrounds?\b/i,
    heading: heading(
      "GROUNDS OF APPEAL", "GROUNDS OF PETITION", "GROUNDS OF APPLICATION",
      "GROUNDS OF REVISION", "GROUNDS", "GROUND",
    ),
  },
  {
    label: "PRAYER",
    prompt: /\b(?:prayer|relief\s+sought|reliefs?)\b/i,
    heading: heading("PRAYER", "RELIEF SOUGHT"),
  },
  {
    label: "VERIFICATION",
    prompt: /\bverification\b/i,
    heading: heading("VERIFICATION"),
  },
  {
    label: "AFFIDAVIT",
    prompt: /\baffidavit\b/i,
    heading: heading("AFFIDAVIT"),
  },
  {
    label: "ANNEXURES",
    prompt: /\b(?:annexures?|index\s+of\s+documents)\b/i,
    heading: heading("ANNEXURES", "ANNEXURE", "INDEX OF DOCUMENTS"),
  },
];

const MAJOR_HEADINGS = [
  "PRELIMINARY OBJECTIONS", "PRELIMINARY OBJECTION", "CAUSE OF ACTION",
  "JURISDICTION AND VALUATION", "JURISDICTION", "BRIEF FACTS", "MATERIAL FACTS",
  "FACTS OF THE CASE", "FACTS", "GROUNDS OF APPEAL", "GROUNDS OF PETITION",
  "GROUNDS OF APPLICATION", "GROUNDS OF REVISION", "GROUNDS", "GROUND",
  "PRAYER", "RELIEF SOUGHT", "VERIFICATION", "AFFIDAVIT", "ANNEXURES",
  "ANNEXURE", "INDEX OF DOCUMENTS", "INTERIM RELIEF", "APPLICANT",
  "RESPONDENT", "DEFENDANT", "PLAINTIFF", "PETITIONER", "DEPONENT", "ACCUSED",
];
// Section end boundary. Must tolerate the same letter-spacing as the start
// matcher, otherwise a GROUNDS edit runs past "P R A Y E R:" and swallows it.
const ANY_MAJOR_HEADING = new RegExp(
  `^\\s*(?:${MAJOR_HEADINGS.map((h) => h.split(/\s+/).map(sp).join("\\s+")).join("|")})\\s*:?[ \\t]*$`,
  "gim",
);

function resolveAction(prompt: string): LegalDraftEditAction {
  if (/\b(delete|remove|omit)\b/i.test(prompt)) return "delete";
  if (/\b(?:add|insert|include|incorporate|put|move)\b[\s\S]{0,50}\bbefore\b/i.test(prompt)) return "insert-before";
  if (/\b(?:add|insert|include|incorporate|put|move)\b[\s\S]{0,50}\bafter\b/i.test(prompt)) return "insert-after";
  // Section enrichment: "add case law in grounds", "include citations in prayer", "add references in facts"
  if (/\b(?:add|insert|include|incorporate|cite|mention)\b[\s\S]{0,50}\b(?:case\s*law|citations?|precedents?|judgments?|rulings?|references?|sections?|articles?|statutes?|provisions?|grounds?)\b[\s\S]{0,50}\b(?:in|into|to|under|inside)\b/i.test(prompt)) {
    return "replace";
  }
  if (/\b(?:in|into|within)\s+(?:the\s+)?(?:grounds?|facts?|prayer|preliminary\s+objections?|verification|affidavit)\b/i.test(prompt)) {
    return "replace";
  }
  // Generic "add a new ground" targeting the whole section implies enrichment of the section (rewrite).
  // "insert-after" is only appropriate if the prompt explicitly says "after X".
  return "replace";
}

export function classifyLegalDraftFollowUp(input: {
  prompt: string;
  hasDraft: boolean;
  hasSelection: boolean;
  requestedMode?: string;
}): LegalDraftFollowUpOperation {
  const prompt = String(input.prompt || "").trim();
  const isNewFiling = EXPLICIT_NEW_FILING_PATTERN.test(prompt);
  const hasMutation = MUTATION_PATTERN.test(prompt) || EXPLICIT_DRAFT_ACTION_PATTERN.test(prompt);
  const asksForAnswer = ANSWER_PATTERN.test(prompt);
  const asksAboutPriorAction = /\b(?:what|which)\s+(?:did\s+you|was)\s+(?:change|changed|edit|edited|do|done)\b/i.test(prompt);
  const isDirectQuestion = DIRECT_QUESTION_PATTERN.test(prompt) && !EXPLICIT_MUTATION_COMMAND_PATTERN.test(prompt) && !isNewFiling;

  // Guard: when a draft already exists, section-specific keywords override full-rewrite.
  // This prevents chip prompts like "Draft post-arrest bail grounds" from rewriting the
  // entire document when the user only wants to add/edit the grounds section.
  const SECTION_KEYWORD_PATTERN = /\b(?:grounds?|facts?|prayer|reliefs?|objections?|verification|affidavit|jurisdiction|cause\s+of\s+action|preliminary)\b/i;
  // ...but "rewrite the whole draft, keeping the same facts" names the document as
  // the scope, and the incidental "facts" used to demote it to a BRIEF FACTS edit.
  if (
    input.hasDraft &&
    (FULL_REWRITE_PATTERN.test(prompt) || isNewFiling) &&
    SECTION_KEYWORD_PATTERN.test(prompt) &&
    !WHOLE_DOCUMENT_SCOPE_PATTERN.test(prompt)
  ) {
    return "section-edit";
  }

  if (FULL_REWRITE_PATTERN.test(prompt) || isNewFiling) return input.hasDraft ? "full-rewrite" : "initial-draft";
  if (CONVERSION_PATTERN.test(prompt)) return input.hasDraft ? "conversion" : "initial-draft";
  if (input.hasSelection) {
    return hasMutation && !asksAboutPriorAction ? "targeted-edit" : "answer";
  }
  if (!input.hasDraft) {
    return input.requestedMode === "analysis" || (asksForAnswer && !hasMutation && !isNewFiling)
      ? "answer"
      : "initial-draft";
  }
  if (asksAboutPriorAction || isDirectQuestion || (asksForAnswer && !hasMutation && !isNewFiling)) return "answer";
  if (hasMutation) {
    if (
      findLegalDraftEditTarget(input.prompt, "") ||
      /\b(?:paragraph|para)\s*(?:no\.?\s*)?\d{1,3}\b/i.test(prompt) ||
      /\bground\s+[A-Z]\b/i.test(prompt) ||
      /\b(?:corrective clause|resolve:)\b/i.test(prompt)
    ) return "section-edit";
    return "ambiguous-edit";
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

  // "add case law according to the facts of this plaint" asks for authorities, and
  // "facts" describes what they must match, not the section to edit. Matching FACTS
  // first put the citations in BRIEF FACTS and left GROUNDS — where authorities
  // belong — untouched.
  const wantsAuthorities = /\b(?:case\s*law|citations?|precedents?|judgments?|authorities|rulings?)\b/i.test(prompt);
  // "to" is deliberately absent: "according to the facts" describes what the
  // authorities must match, not the section to edit. "in the facts" does name it.
  const namesSectionExplicitly =
    /\b(?:in|into|inside|within)\s+(?:the\s+)?(?:brief\s+)?(?:facts?|prayer|reliefs?|verification|affidavit|objections?)\b/i.test(prompt);
  if (wantsAuthorities && !namesSectionExplicitly && source) {
    const groundsSection = SECTION_PATTERNS.find((section) => section.label === "GROUNDS");
    const groundsMatch = groundsSection && source.match(groundsSection.heading);
    const groundsRange = groundsMatch && findRangeForMatch(source, groundsMatch);
    if (groundsSection && groundsRange) {
      return {
        label: groundsSection.label,
        ...groundsRange,
        text: source.slice(groundsRange.start, groundsRange.end).trimEnd(),
        action: resolveAction(prompt),
      };
    }
  }

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
  let replacement = String(input.replacementText || "").trim();
  if (target.action !== "delete" && !replacement) {
    return { ok: false, reason: "AI returned empty edit text." };
  }

  // Guard against AI over-generation of subsequent sections (Bug 7)
  if (target.action !== "delete" && target.action !== "insert-before" && target.action !== "insert-after") {
    ANY_MAJOR_HEADING.lastIndex = 0;
    const targetMatch = ANY_MAJOR_HEADING.exec(target.text);
    const hasSecondHeadingInTarget = targetMatch ? ANY_MAJOR_HEADING.exec(target.text) !== null : false;
    
    if (!hasSecondHeadingInTarget) {
      ANY_MAJOR_HEADING.lastIndex = 0;
      const repMatch = ANY_MAJOR_HEADING.exec(replacement);
      if (repMatch) {
        const norm = (s: string) => s.replace(/[^A-Z]/gi, '').toUpperCase();
        const firstHeadingIsSame = targetMatch && norm(repMatch[0]) === norm(targetMatch[0]);
        let overgenMatch = firstHeadingIsSame ? ANY_MAJOR_HEADING.exec(replacement) : repMatch;
        if (!targetMatch) overgenMatch = repMatch;
        
        if (overgenMatch) {
          replacement = replacement.slice(0, overgenMatch.index).trimEnd();
        }
      }
    }
    ANY_MAJOR_HEADING.lastIndex = 0;
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
