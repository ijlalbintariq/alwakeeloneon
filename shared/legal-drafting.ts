import { z } from "zod";

export const LEGAL_DRAFTING_WORKSPACE_VERSION = 1 as const;

export const legalDraftBriefSchema = z.object({
  draftType: z.enum(["pleading", "contract"]).default("pleading"),
  forum: z.string().trim().min(1).max(500),
  matterTitle: z.string().trim().min(1).max(240),
  reliefType: z.string().trim().min(1).max(500),
  facts: z.string().trim().max(100_000).default(""),
});

export const legalDraftInputSchema = z.object({
  title: z.string().trim().min(1).max(240),
  templateType: z.string().trim().max(120).nullish(),
  content: z.string().min(1).max(500_000),
  status: z.enum(["draft", "final", "archived"]).optional(),
  metadata: z.object({
    textContent: z.string().max(250_000).optional(),
    pageProfileId: z.enum(["court-legal", "a4"]).optional(),
    category: z.string().max(120).optional(),
    documentType: z.string().max(120).optional(),
  }).nullish(),
});

export const legalDraftChatMessageSchema = z.object({
  id: z.string().trim().max(120),
  role: z.enum(["user", "assistant"]),
  content: z.string().max(80_000),
  attachments: z.array(z.string().max(260)).max(8).optional(),
  kind: z.enum(["guidance", "typing", "error", "clarification"]).optional(),
  createdAt: z.number().int().nonnegative().optional(),
  suggestedTypes: z.array(
    z.object({
      key: z.string().trim().min(1).max(120),
      label: z.string().trim().min(1).max(200),
    }),
  ).max(5).optional(),
  originalPrompt: z.string().max(2_000).optional(),
});

export const legalDraftMemoryItemSchema = z.object({
  id: z.string().trim().max(120),
  kind: z.enum(["instruction", "clause", "risk"]),
  text: z.string().max(2_000),
  ts: z.number().int().nonnegative(),
});

const legalCaseReferenceSchema = z.object({
  id: z.number().int().positive(),
  citation: z.string().max(300),
  court: z.string().max(300),
  title: z.string().max(500),
  summary: z.string().max(5_000),
  hasSource: z.boolean(),
  sourceType: z.string().max(120).nullable().optional(),
  sourceFilename: z.string().max(500).nullable().optional(),
});

const legalStatuteReferenceSchema = z.object({
  statuteName: z.string().max(500),
  section: z.string().max(200),
  sectionLabel: z.string().max(300),
  statuteId: z.number().int().positive().nullable().optional(),
  description: z.string().max(5_000).nullable().optional(),
  punishment: z.string().max(5_000).nullable().optional(),
  statuteDocId: z.number().int().positive().nullable().optional(),
  statuteDocTitle: z.string().max(500).nullable().optional(),
  statuteDocFilename: z.string().max(500).nullable().optional(),
  statuteDocCategory: z.string().max(300).nullable().optional(),
  viewUrl: z.string().max(2_000).nullable().optional(),
});

const unresolvedStatuteSchema = z.object({
  statuteName: z.string().max(500),
  section: z.string().max(200),
  sectionLabel: z.string().max(300),
});

export const legalDraftReferencesSchema = z.object({
  caseLaw: z.array(legalCaseReferenceSchema).max(50).default([]),
  statutes: z.array(legalStatuteReferenceSchema).max(50).default([]),
  removedCaseCitations: z.array(z.string().max(300)).max(30).default([]),
  unresolvedStatutes: z.array(unresolvedStatuteSchema).max(30).default([]),
});

export const legalDraftRecommendationSchema = z.object({
  id: z.string().trim().max(120),
  title: z.string().max(200),
  reason: z.string().max(1_000),
  originalSnippet: z.string().max(5_000),
  suggestedText: z.string().max(5_000),
  impact: z.enum(["high", "medium", "low"]),
});

export const legalDraftWorkspaceStateSchema = z.object({
  version: z.literal(LEGAL_DRAFTING_WORKSPACE_VERSION).default(LEGAL_DRAFTING_WORKSPACE_VERSION),
  draftTitle: z.string().trim().max(240).default("Untitled Draft"),
  docText: z.string().max(250_000).default(""),
  selectedDraftId: z.number().int().positive().nullable().optional(),
  hasDraftInSession: z.boolean().optional().default(false),
  draftChatMessages: z.array(legalDraftChatMessageSchema).max(250).optional().default([]),
  memoryItems: z.array(legalDraftMemoryItemSchema).max(200).optional().default([]),
  draftReferences: legalDraftReferencesSchema.optional(),
  recommendations: z.array(legalDraftRecommendationSchema).max(10).optional(),
  savedAt: z.string().datetime().optional(),
});

export type LegalDraftChatMessage = z.infer<typeof legalDraftChatMessageSchema>;
export type LegalDraftMemoryItem = z.infer<typeof legalDraftMemoryItemSchema>;
export type LegalDraftReferences = z.infer<typeof legalDraftReferencesSchema>;
export type LegalDraftRecommendation = z.infer<typeof legalDraftRecommendationSchema>;
export type LegalDraftWorkspaceState = z.infer<typeof legalDraftWorkspaceStateSchema>;
