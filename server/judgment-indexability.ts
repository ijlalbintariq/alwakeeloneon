import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { courtsRef, judgments } from "@shared/schema";
import { db } from "./db";
import { assessJudgmentIdentity } from "./citation-verify";

export const indexableJudgmentCandidateFilter = and(
  eq(judgments.isActive, true),
  eq(judgments.textStatus, "own"),
  isNull(judgments.canonicalJudgmentId),
);

/** Stored provenance is necessary but does not establish the case's identity. */
export async function getIndexableJudgmentIds(ids: string[]): Promise<Set<string>> {
  const uniqueIds = [...new Set(ids.filter(id => /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)))];
  const confirmed = new Set<string>();
  for (let offset = 0; offset < uniqueIds.length; offset += 250) {
    const batch = uniqueIds.slice(offset, offset + 250);
    const rows = await db.select({
      id: judgments.id,
      citation: judgments.citationString,
      title: judgments.title,
      court: sql<string>`coalesce(${courtsRef.name}, ${judgments.courtNameSnapshot})`,
      opening: sql<string>`left(${judgments.fullText}, 16000)`,
      textStatus: judgments.textStatus,
      textTrueCitation: judgments.textTrueCitation,
      isActive: judgments.isActive,
      canonicalJudgmentId: judgments.canonicalJudgmentId,
    }).from(judgments)
      .leftJoin(courtsRef, eq(judgments.courtId, courtsRef.id))
      .where(and(indexableJudgmentCandidateFilter, inArray(judgments.id, batch)));
    for (const row of rows) {
      if (row.isActive === true && row.textStatus === "own" && row.canonicalJudgmentId === null
        && assessJudgmentIdentity(row).textIntegrity === "own") confirmed.add(row.id);
    }
  }
  return confirmed;
}
