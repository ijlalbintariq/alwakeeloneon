import { createElement as h } from "react";

export interface PublicJudgmentIdentity {
  id: string;
  title?: string | null;
  citation?: string | null;
  court?: string | null;
  decisionDate?: string | Date | null;
  textIntegrity?: string;
}

export function judgmentDecisionDate(value: PublicJudgmentIdentity["decisionDate"]): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

export function publicJudgmentSeo(record: PublicJudgmentIdentity) {
  const url = `https://www.alwakeelo.com/judgment/${encodeURIComponent(record.id)}`;
  const confirmed = record.textIntegrity === "own";
  const name = record.title?.trim() || "Pakistani judgment";
  const citation = record.citation?.trim();
  const court = record.court?.trim();
  const date = judgmentDecisionDate(record.decisionDate);
  const title = confirmed
    ? `${citation ? `${citation}: ` : ""}${name}${court ? ` — ${court}` : ""} | Al Wakeelo`
    : "Judgment identity unverified | Al Wakeelo";
  const summary = confirmed
    ? `${name}${citation ? ` (${citation})` : ""}${court ? ` — ${court}` : ""}${date ? `, decided ${date}` : ""}. Read the available judgment text and citation references on Al Wakeelo.`
    : "This record's judgment identity has not been confirmed. Check the available source before attributing its text to a case.";
  const schema = confirmed ? {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage", "@id": `${url}#webpage`, url, name: title,
        description: summary, isAccessibleForFree: true,
        isPartOf: { "@id": "https://www.alwakeelo.com/#website" },
        mainEntity: { "@id": `${url}#judgment` },
        breadcrumb: { "@id": `${url}#breadcrumbs` },
      },
      {
        "@type": "CreativeWork", "@id": `${url}#judgment`, url, name,
        ...(citation ? { identifier: citation } : {}),
        ...(court ? { creator: { "@type": "GovernmentOrganization", name: court } } : {}),
        ...(date ? { dateCreated: date } : {}),
        description: summary, genre: "Court judgment",
        mainEntityOfPage: { "@id": `${url}#webpage` },
      },
      {
        "@type": "BreadcrumbList", "@id": `${url}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://www.alwakeelo.com/" },
          { "@type": "ListItem", position: 2, name: "Judgments", item: "https://www.alwakeelo.com/judgments" },
          { "@type": "ListItem", position: 3, name: citation || name, item: url },
        ],
      },
    ],
  } : null;
  return { url, title, description: summary, schema };
}

export function JudgmentCitationSummary({ record }: { record: PublicJudgmentIdentity }) {
  if (record.textIntegrity !== "own") return null;
  const seo = publicJudgmentSeo(record);
  return h("section", { "aria-label": "Judgment citation and verification", className: "my-6 rounded-xl border border-slate-200 p-5 space-y-3 text-sm leading-relaxed" },
    h("h2", { className: "text-lg font-semibold" }, "Which judgment is this?"),
    h("p", null, seo.description),
    h("h2", { className: "text-lg font-semibold" }, "How can I cite and verify this judgment?"),
    h("p", null, "Use the case title and recorded citation, court and decision date above. Read the original judgment before relying on a headnote or extracted text. Citation links alone do not establish that a decision remains good law. Al Wakeelo is a research platform, not the issuing court."),
    h("a", { href: seo.url, className: "underline break-all" }, "Permanent judgment link"),
    h("p", null, "Missing or incorrect information? ", h("a", { href: "/contact", className: "underline" }, "Report a record issue"), "."));
}
