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
      strictCitations: false,
      clauseModeStrictness: "low",
    },
  },
  draft: {
    id: "draft",
    label: "Legal Drafting",
    systemPromptAddon:
      "You are in legal drafting mode. Draft professional, airtight legal clauses/documents with Pakistani judicial conventions and court-ready filing format. Use clean court headings/party blocks/PRAYER/VERIFICATION structure, and never output markdown symbols. For drafting intents, return only pleading text without references block.",
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
      primary: "turbo",
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
