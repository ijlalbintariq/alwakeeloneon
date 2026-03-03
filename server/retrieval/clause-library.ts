export type ClauseTemplate = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  keywords: string[];
  text: string;
};

export type ClauseSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  score: number;
};

const CLAUSE_TEMPLATES: ClauseTemplate[] = [
  {
    id: "governing-law",
    title: "Governing Law",
    subtitle: "Specify governing law and interpretation framework.",
    category: "Contractual Clauses",
    keywords: ["governing law", "law", "jurisdiction", "interpretation"],
    text: `Governing Law. This Agreement shall be governed by and construed in accordance with the laws of Pakistan. Subject to the dispute resolution provisions of this Agreement, the courts at [Jurisdiction] shall have exclusive jurisdiction in respect of all matters arising out of or in connection with this Agreement.`,
  },
  {
    id: "dispute-resolution",
    title: "Dispute Resolution / Arbitration",
    subtitle: "Arbitration seat, language, and enforcement language.",
    category: "Contractual Clauses",
    keywords: ["dispute", "arbitration", "tribunal", "seat", "award"],
    text: `Dispute Resolution. Any dispute, controversy, or claim arising out of or relating to this Agreement shall first be resolved through good-faith negotiations between the Parties within fifteen (15) days of written notice. Failing settlement, the dispute shall be finally resolved by arbitration seated in [Jurisdiction], Pakistan, by a sole arbitrator appointed in accordance with the Arbitration Act, 1940. The language of arbitration shall be English. The arbitral award shall be final and binding and may be enforced in any court of competent jurisdiction.`,
  },
  {
    id: "force-majeure",
    title: "Force Majeure",
    subtitle: "Unforeseeable events, notice, mitigation, and suspension.",
    category: "Contractual Clauses",
    keywords: ["force majeure", "unforeseeable", "delay", "suspension", "mitigation"],
    text: `Force Majeure. Neither Party shall be liable for failure or delay in performance to the extent caused by events beyond its reasonable control, including natural disasters, war, terrorism, epidemic, government restrictions, or disruption of essential services. The affected Party shall notify the other Party in writing within five (5) days of the event and shall use commercially reasonable efforts to mitigate the effect. If the force majeure event continues for more than thirty (30) consecutive days, either Party may terminate this Agreement by written notice without liability, except for obligations accrued prior to termination.`,
  },
  {
    id: "termination",
    title: "Termination",
    subtitle: "Cause, cure period, and post-termination effects.",
    category: "Contractual Clauses",
    keywords: ["termination", "breach", "cure", "default", "post-termination"],
    text: `Termination. Either Party may terminate this Agreement for material breach by the other Party if such breach remains uncured for fifteen (15) days after receipt of written notice specifying the breach. Either Party may also terminate immediately upon insolvency, liquidation, or cessation of business of the other Party. Upon termination, each Party shall promptly return confidential information and settle all undisputed dues accrued up to the termination date. Clauses intended by their nature to survive shall continue in full force.`,
  },
  {
    id: "confidentiality",
    title: "Confidentiality",
    subtitle: "Definition, permitted use/disclosure, and remedies.",
    category: "Contractual Clauses",
    keywords: ["confidential", "non-disclosure", "proprietary", "disclosure"],
    text: `Confidentiality. Each Party shall keep confidential all non-public information disclosed by the other Party in connection with this Agreement and shall use such information solely for performance of this Agreement. Confidential Information may be disclosed only to employees, advisors, or subcontractors on a strict need-to-know basis and subject to equivalent confidentiality obligations, or where required by law after prompt notice to the disclosing Party (where legally permissible). Unauthorized disclosure shall entitle the aggrieved Party to injunctive and other legal relief, without prejudice to damages.`,
  },
  {
    id: "indemnity",
    title: "Indemnity",
    subtitle: "Scope of indemnification and claim handling.",
    category: "Contractual Clauses",
    keywords: ["indemnity", "claim", "liability", "defend", "hold harmless"],
    text: `Indemnity. Each Party (Indemnifying Party) shall indemnify, defend, and hold harmless the other Party, its directors, officers, and employees from and against third-party claims, liabilities, losses, damages, and reasonable legal costs arising out of the Indemnifying Party's breach of this Agreement, negligence, willful misconduct, or violation of applicable law. The indemnified Party shall promptly notify the Indemnifying Party of any claim and cooperate in defense, provided that failure to notify promptly shall not relieve indemnity obligations except to the extent of material prejudice.`,
  },
  {
    id: "payment-terms",
    title: "Payment Terms",
    subtitle: "Invoicing, due dates, taxes, and delay consequences.",
    category: "Commercial Clauses",
    keywords: ["payment", "invoice", "due", "tax", "late"],
    text: `Payment Terms. The Service Provider shall issue invoices in accordance with the payment schedule set out in Schedule A. The Client shall pay each undisputed invoice within thirty (30) days of receipt via bank transfer to the notified account. All payments are exclusive of applicable taxes, duties, and withholdings required by law. Any delayed undisputed payment beyond the due date may attract late payment charges at [Rate]% per month on the overdue amount.`,
  },
  {
    id: "notice",
    title: "Notices",
    subtitle: "Valid service methods and deemed delivery.",
    category: "Contractual Clauses",
    keywords: ["notice", "writing", "delivery", "email", "courier"],
    text: `Notices. All notices, demands, and communications under this Agreement shall be in writing and delivered by hand, reputable courier service, or email to the addresses specified by each Party. Notices delivered by hand shall be deemed received on delivery; by courier on the next business day after dispatch; and by email at the time of transmission, provided no delivery failure message is received.`,
  },
  {
    id: "assignment",
    title: "Assignment",
    subtitle: "Transfer restrictions and consent requirements.",
    category: "Contractual Clauses",
    keywords: ["assignment", "transfer", "consent", "affiliate"],
    text: `Assignment. Neither Party may assign or transfer this Agreement or any of its rights or obligations without the prior written consent of the other Party, which shall not be unreasonably withheld. Notwithstanding the foregoing, either Party may assign this Agreement to an affiliate or successor in connection with merger, restructuring, or sale of substantially all assets, provided that such assignee assumes all obligations under this Agreement.`,
  },
  {
    id: "severability",
    title: "Severability",
    subtitle: "Invalid provisions do not void the entire agreement.",
    category: "Contractual Clauses",
    keywords: ["severability", "invalid", "unenforceable", "remaining"],
    text: `Severability. If any provision of this Agreement is held invalid, illegal, or unenforceable by a court or tribunal of competent jurisdiction, such provision shall be deemed modified to the minimum extent necessary to make it enforceable, and the remaining provisions shall remain in full force and effect.`,
  },
  {
    id: "entire-agreement",
    title: "Entire Agreement",
    subtitle: "Supersedes prior discussions and understandings.",
    category: "Contractual Clauses",
    keywords: ["entire agreement", "supersede", "understanding", "oral"],
    text: `Entire Agreement. This Agreement, including its schedules and annexures, constitutes the entire agreement between the Parties concerning its subject matter and supersedes all prior discussions, correspondence, representations, and agreements, whether oral or written, relating to such subject matter.`,
  },
  {
    id: "amendment-waiver",
    title: "Amendment and Waiver",
    subtitle: "Written modification requirements.",
    category: "Contractual Clauses",
    keywords: ["amendment", "waiver", "written", "signed"],
    text: `Amendment and Waiver. No amendment, modification, or waiver of any provision of this Agreement shall be valid unless made in writing and signed by duly authorized representatives of both Parties. Failure or delay by either Party in exercising any right shall not operate as a waiver of that right.`,
  },
];

function normalize(value: string): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function keywordScore(text: string, keywords: string[]): number {
  let score = 0;
  for (const kw of keywords) {
    if (!kw) continue;
    if (text.includes(normalize(kw))) score += 2;
  }
  return score;
}

function alreadyCovered(draftText: string, template: ClauseTemplate): boolean {
  const normalizedDraft = normalize(draftText);
  if (!normalizedDraft) return false;
  const matched = template.keywords.filter((kw) => normalizedDraft.includes(normalize(kw))).length;
  return matched >= Math.max(2, Math.floor(template.keywords.length / 2));
}

function withDefaults(text: string, jurisdiction?: string): string {
  return text.replace(/\[Jurisdiction\]/g, jurisdiction || "Lahore").replace(/\[Rate\]/g, "1.5");
}

export function suggestClauses(params: {
  query?: string;
  draftText?: string;
  contractType?: string;
  limit?: number;
}): ClauseSuggestion[] {
  const queryText = normalize(`${params.contractType || ""} ${params.query || ""}`);
  const draftText = normalize(params.draftText || "");

  const scored = CLAUSE_TEMPLATES.map((item) => {
    let score = 0;
    score += keywordScore(queryText, item.keywords);
    if (!alreadyCovered(draftText, item)) score += 3;
    if (queryText.includes(normalize(item.title))) score += 4;
    return {
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      prompt: `Insert a ${item.title} clause tailored for Pakistani law and this draft.`,
      score,
    };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(8, params.limit || 4)));

  return scored;
}

export function generateClauseFromPrompt(params: {
  prompt: string;
  draftText?: string;
  jurisdiction?: string;
}): { clause: string; sourceId: string; confidence: number; method: "retrieval" | "fallback" } {
  const normalizedPrompt = normalize(params.prompt || "");
  const normalizedDraft = normalize(params.draftText || "");

  let best: ClauseTemplate | null = null;
  let bestScore = -1;

  for (const template of CLAUSE_TEMPLATES) {
    let score = 0;
    score += keywordScore(normalizedPrompt, template.keywords);
    if (normalizedPrompt.includes(normalize(template.title))) score += 5;
    if (!alreadyCovered(normalizedDraft, template)) score += 1;
    if (score > bestScore) {
      best = template;
      bestScore = score;
    }
  }

  if (best && bestScore > 0) {
    return {
      clause: withDefaults(best.text, params.jurisdiction),
      sourceId: best.id,
      confidence: Math.min(0.95, 0.55 + bestScore * 0.05),
      method: "retrieval",
    };
  }

  return {
    clause:
      "General Compliance Clause. Each Party shall comply with all applicable laws, regulations, and lawful directives of competent authorities in Pakistan in connection with performance under this Agreement. Any breach of this clause shall constitute a material breach entitling the non-breaching Party to appropriate legal remedies.",
    sourceId: "fallback-general-compliance",
    confidence: 0.35,
    method: "fallback",
  };
}

export function getClauseTemplateById(id: string): ClauseTemplate | undefined {
  return CLAUSE_TEMPLATES.find((item) => item.id === id);
}
