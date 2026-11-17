import { createElement as h } from "react";

export const CASE_LAW_TITLE = "Pakistani Case Law Search | Al Wakeelo";
export const CASE_LAW_DESCRIPTION = "Search Pakistani case law on Al Wakeelo by citation, party name or legal issue. Browse available judgments and check original sources before relying on a result.";

export const CASE_LAW_ANSWERS = [
  { question: "What is Al Wakeelo for Pakistani case law research?", answer: "Al Wakeelo is a Pakistan-focused legal research app for advocates, law students and law chambers. It combines judgment search, citation lookup, a browsable case-law directory and AI-assisted research. Search for a known citation or describe a legal issue, then open the available case record to examine its court, parties, text and source. Al Wakeelo is a research aid, not an official court publisher." },
  { question: "How do I find a Pakistani judgment by citation?", answer: "Use citation search when you already know the report year, journal and page. Supported citation formats include PLD, SCMR, CLC, YLR, MLD, CLD and PCrLJ. For a broader search, enter party names or legal keywords. You can also browse the judgment directory by court, year and journal. A missing result does not establish that a case does not exist." },
  { question: "Does Al Wakeelo include every Pakistani judgment?", answer: "Coverage depends on the records available in the library and is not exhaustive. Text, PDFs and citation relationships may be incomplete or unavailable for an individual record. Check the record itself for its court, decision date and available source material; do not infer complete court or year coverage from a search result." },
  { question: "How should I verify an AI case-law recommendation?", answer: "Treat an AI answer as a research starting point. Match the citation, parties, court and decision date to the original judgment. Read the relevant passage in context and check subsequent decisions before relying on the case. Summaries and citation identity checks do not establish that a judgment remains good law. A qualified advocate should review research used in legal work." },
];

/** Shared visible content keeps the app and initial HTML in agreement. */
export function CaseLawResearchGuide() {
  return h("section", { "aria-label": "Pakistani case law research guide", className: "mx-auto max-w-4xl px-6 py-8 space-y-6 text-foreground" },
    ...CASE_LAW_ANSWERS.map(({ question, answer }) => h("div", { key: question },
      h("h2", { className: "text-lg font-semibold mb-2" }, question),
      h("p", { className: "text-sm leading-relaxed text-muted-foreground" }, answer))),
    h("nav", { "aria-label": "Case law research resources", className: "flex flex-wrap gap-4 text-sm underline" },
      ...[["/judgments", "Search case law"], ["/citation-search", "Look up a citation"], ["/judgments/browse", "Browse judgments"], ["/about", "About Al Wakeelo"], ["/contact", "Report a record issue"]].map(([href, label]) => h("a", { key: href, href }, label))));
}
