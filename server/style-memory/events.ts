import { ingestStyleSample } from "./ingest";
import type { StyleMemoryModule } from "./types";

export async function recordAcceptedRedlineStyleEvent(args: {
  userId: string;
  module: StyleMemoryModule;
  orgId?: number | null;
  draftId: string | number;
  acceptedText: string;
  beforeText?: string;
}) {
  const mergedText = [args.beforeText || "", args.acceptedText || ""].filter(Boolean).join("\n\n");
  return ingestStyleSample({
    userId: args.userId,
    module: args.module,
    orgId: args.orgId ?? null,
    sourceType: "accepted-redline",
    sourceRef: `redline:${String(args.draftId)}`,
    title: `Accepted Redline ${String(args.draftId)}`,
    rawText: mergedText,
  });
}

