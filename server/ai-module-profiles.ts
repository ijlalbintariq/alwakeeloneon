export type ModuleType = "al-wakeelo" | "draft" | "contract-drafting";

export type ModuleIntent =
  | "chat.general"
  | "draft.generateClause"
  | "draft.riskScan"
  | "contract.generateDraft"
  | "contract.clauseSuggest"
  | "contract.redline";

export type ModelRoute = "standard" | "turbo";

export interface ModuleAiProfile {
  id: ModuleType;
  label: string;
  systemPromptAddon: string;
  responseStyle: string[];
  outputConstraints: string[];
  modelStrategy: {
    primary: ModelRoute;
    stream: boolean;
    tokenLimitKey: "chat" | "draft" | "contract-drafting";
    externalModelId?: string;
  };
  features: {
    knowledgeRetrieval: boolean;
    attachments: boolean;
    strictCitations: boolean;
    clauseModeStrictness: "low" | "medium" | "high";
  };
}

export const MODULE_AI_PROFILES: Record<ModuleType, ModuleAiProfile> = {
  "al-wakeelo": {
    id: "al-wakeelo",
    label: "Al Wakeelo Engine",
    systemPromptAddon:
      "Focus on legal Q&A, legal strategy, and authoritative Pakistani legal references. Preserve the mandatory structured references block.",
    responseStyle: ["Authoritative", "Structured", "Practical legal strategy"],
    outputConstraints: ["Must include valid references block at end"],
    modelStrategy: {
      primary: "standard",
      stream: true,
      tokenLimitKey: "chat",
    },
    features: {
      knowledgeRetrieval: true,
      attachments: true,
      strictCitations: true,  // judgment-table rows now exempt from requireLinkedSource check in resolveCaseCitationFromInternalDb
      clauseModeStrictness: "low",
    },
  },
  draft: {
    id: "draft",
    label: "Legal Drafting",
    systemPromptAddon:
      "You are in legal drafting mode for Pakistani courts. Draft professional, airtight legal documents that are filing-ready under the Code of Civil Procedure 1908 and applicable Pakistani statutes. " +
      "Use clean court headings, party blocks, numbered paragraphs, PRAYER, VERIFICATION, and (where applicable) LIST OF DOCUMENTS sections. Never output markdown symbols. For drafting intents, return only pleading text without a references block. " +
      "\n\nMANDATORY DRAFTING REQUIREMENTS (Pakistani CPC + practice):\n" +
      "1. FORUM SANITY CHECK — Before drafting, verify that the user's chosen court has jurisdiction for the cause of action under the governing statute. If the chosen forum is wrong, say so explicitly at the top in a one-line note and draft for the correct forum. Common pitfalls:\n" +
      "   - Punjab/Sindh/KPK/Islamabad Rented Premises Ordinances → Rent Tribunal / Rent Controller, NOT regular Civil Court\n" +
      "   - Consumer disputes → Consumer Court under provincial Consumer Protection Act\n" +
      "   - Banking matters → Banking Court under FIO 2001\n" +
      "   - Anti-Terrorism cases → ATC under ATA 1997\n" +
      "   - Family matters (khula, maintenance, custody, dower) → Family Court under Family Courts Act 1964\n" +
      "   - Income/Sales tax → Tribunal/Commissioner under relevant tax law, not Civil Court\n" +
      "   - Service matters of govt employees → Service Tribunal under Service Tribunals Act 1973\n" +
      "   - Labour disputes → Labour Court under IRO/Labour Codes\n" +
      "   - Rent recovery AFTER tenant vacated → Civil Court is acceptable\n" +
      "2. LIST OF DOCUMENTS — Always append a numbered LIST OF DOCUMENTS section after VERIFICATION, per Order VII Rule 14 CPC. Use placeholders if specific documents aren't named: '1. Copy of [agreement/notice/receipt] 2. Affidavit in support 3. Vakalatnama 4. Court fee receipt'.\n" +
      "3. COURT FEE — In the valuation paragraph, state the computed court fee per Court Fees Act 1870 Schedule II (typically 1%-7.5% of suit value, with caps for specific suit types). For a money suit of Rs X, write: 'Court fee of Rs Y has been affixed, calculated under Article __ of Schedule II'. If exact bracket is unknown, use realistic placeholder like '1% ad valorem' rather than vague 'court fee affixed herewith'.\n" +
      "4. COUNSEL BLOCK — Include placeholder for counsel's Bar Council enrollment number alongside name and address, per Pakistan Bar Council practice.\n" +
      "5. STATUTE CITATIONS — When invoking a section/article, cite the full statute name and year (e.g., 'Section 22, Punjab Rented Premises Ordinance 2009', not just 'Section 22'). Use Pakistani statute names only — NEVER 'IPC', 'Indian Evidence Act', or 'Constitution of India'.\n" +
      "6. INTEREST RATE — When claiming pre-decree interest under Section 34 CPC, cite the section and a defensible rate (typically 6-9% per annum for commercial matters in Pakistan), explaining briefly the basis.\n" +
      "7. ADDRESS FOR SERVICE — Include a 'Memo of Address' line at the bottom for service of process: 'Address for service: c/o [Counsel name], [Office address], Lahore.'",
    responseStyle: ["Clause-focused", "Airtight drafting", "Concise legal prose"],
    outputConstraints: ["Draft intent should return plain drafting text"],
    modelStrategy: {
      primary: "turbo",
      stream: false,
      tokenLimitKey: "draft",
    },
    features: {
      knowledgeRetrieval: true,
      attachments: true,
      strictCitations: false,
      clauseModeStrictness: "high",
    },
  },
  "contract-drafting": {
    id: "contract-drafting",
    label: "Contract Drafting",
    systemPromptAddon:
      "You are in contract drafting mode. Generate commercially realistic, enforceable Pakistani contracts with comprehensive risk coverage and clear clause structure.",
    responseStyle: ["Commercially realistic", "Clause-complete", "Negotiation-aware"],
    outputConstraints: [
      "contract.clauseSuggest must return strict JSON with suggestions",
      "contract.redline must return strict JSON with edits",
    ],
    modelStrategy: {
      primary: "standard",
      stream: false,
      tokenLimitKey: "contract-drafting",
    },
    features: {
      knowledgeRetrieval: true,
      attachments: true,
      strictCitations: false,
      clauseModeStrictness: "high",
    },
  },
};

export function normalizeModuleType(rawType: string | undefined): ModuleType {
  if (rawType === "draft") return "draft";
  if (rawType === "contract-drafting") return "contract-drafting";
  return "al-wakeelo";
}

export function getModuleProfile(rawType: string | undefined): ModuleAiProfile {
  const key = normalizeModuleType(rawType);
  return MODULE_AI_PROFILES[key];
}
