export type StyleMemoryModule = "legal-drafting" | "contract-drafting";
export type StyleMemoryScope = "user" | "org" | "user-org";
export type StyleMemoryStrictness = "strict" | "balanced" | "flexible";
export type StyleMemorySourceType = "upload" | "saved-draft" | "accepted-redline";

export type StyleMemorySettings = {
  module: StyleMemoryModule;
  enabled: boolean;
  ownershipMode: StyleMemoryScope;
  learningSource: "full-activity";
  coverage: "generation-only";
  strictness: StyleMemoryStrictness;
  sampleCounts: {
    upload: number;
    savedDraft: number;
    acceptedRedline: number;
    total: number;
  };
  lastBackfillAt: Date | null;
};

export type RetrievedStyleChunk = {
  sampleId: number;
  title: string;
  sourceType: StyleMemorySourceType;
  chunkIndex: number;
  content: string;
  vectorScore: number;
  keywordScore: number;
  score: number;
};

export type StyleRetrievalResult = {
  applied: boolean;
  confidence: number;
  scopeUsed: StyleMemoryScope;
  chunks: RetrievedStyleChunk[];
  contextText: string;
};

export function isStyleMemoryModule(value: string): value is StyleMemoryModule {
  return value === "legal-drafting" || value === "contract-drafting";
}

