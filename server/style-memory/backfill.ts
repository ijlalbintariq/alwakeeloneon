import { storage } from "../storage";
import { ingestStyleSample } from "./ingest";
import type { StyleMemoryModule } from "./types";

const LEGAL_PREFIX = "Legal Draft:";
const CONTRACT_PREFIX = "Contract Draft:";

export type BackfillResult = {
  processed: number;
  indexed: number;
  deduped: number;
  failed: number;
  remaining: number;
};

function belongsToModule(module: StyleMemoryModule, title: string): boolean {
  if (module === "legal-drafting") return title.startsWith(LEGAL_PREFIX);
  return title.startsWith(CONTRACT_PREFIX);
}

export async function backfillStyleMemoryFromSavedDrafts(args: {
  userId: string;
  module: StyleMemoryModule;
  orgId?: number | null;
  limit: number;
}): Promise<BackfillResult> {
  const safeLimit = Math.max(1, Math.min(200, Math.floor(args.limit || 50)));
  const docs = await storage.getDocuments(args.userId);
  const relevant = docs.filter((doc) => belongsToModule(args.module, doc.title || "") && !!(doc.content || "").trim());
  const toProcess = relevant.slice(0, safeLimit);

  let indexed = 0;
  let deduped = 0;
  let failed = 0;
  for (const doc of toProcess) {
    try {
      const result = await ingestStyleSample({
        userId: args.userId,
        module: args.module,
        orgId: args.orgId ?? null,
        sourceType: "saved-draft",
        sourceRef: `document:${doc.id}`,
        title: doc.title || `Draft ${doc.id}`,
        rawText: doc.content || "",
      });
      if (result.deduped) {
        deduped += 1;
      } else if (result.accepted && result.indexedChunks > 0) {
        indexed += 1;
      } else if (!result.accepted) {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  await storage.touchStyleMemoryBackfill(args.userId, args.module, args.orgId ?? null);
  return {
    processed: toProcess.length,
    indexed,
    deduped,
    failed,
    remaining: Math.max(0, relevant.length - toProcess.length),
  };
}

