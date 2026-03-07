import { storage } from "../storage";
import type { StyleMemoryModule, StyleMemoryScope, StyleMemorySettings, StyleMemoryStrictness } from "./types";

export async function getOrCreateStyleMemorySettings(
  userId: string,
  module: StyleMemoryModule,
  orgId?: number | null,
): Promise<StyleMemorySettings> {
  const existing = await storage.getStyleMemorySettings(userId, module, orgId);
  const settings = existing
    ? existing
    : await storage.upsertStyleMemorySettings({
      userId,
      orgId,
      module,
      enabled: true,
      ownershipMode: "user-org",
      strictness: "balanced",
    });

  const counts = await storage.getStyleMemorySourceCounts(userId, module, orgId);
  return {
    module,
    enabled: settings.enabled,
    ownershipMode: settings.ownershipMode,
    learningSource: "full-activity",
    coverage: "generation-only",
    strictness: settings.strictness,
    sampleCounts: counts,
    lastBackfillAt: settings.lastBackfillAt || null,
  };
}

export async function updateStyleMemorySettings(args: {
  userId: string;
  module: StyleMemoryModule;
  orgId?: number | null;
  enabled?: boolean;
  ownershipMode?: StyleMemoryScope;
  strictness?: StyleMemoryStrictness;
}): Promise<StyleMemorySettings> {
  await storage.upsertStyleMemorySettings(args);
  return getOrCreateStyleMemorySettings(args.userId, args.module, args.orgId);
}

