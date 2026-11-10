import { and, count, desc, eq } from "drizzle-orm";
import { judgments, courtsRef, lawJournals } from "@shared/schema";
import { db } from "./db";
import { getIndexableJudgmentIds, indexableJudgmentCandidateFilter } from "./judgment-indexability";

type DirectoryJudgment = Pick<typeof judgments.$inferSelect, "id" | "year" | "page" | "title" | "decisionDate"> & {
  citation: string; courtName: string | null; courtSnapshot: string | null; journalCode: string;
};

export function directoryOptions(params: URLSearchParams) {
  const integer = (name: string, fallback?: number, max = 100_000) => {
    const raw = params.get(name);
    if (!raw) return fallback;
    if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > max) throw new RangeError(`Invalid ${name}`);
    return Number(raw);
  };
  return { courtId: integer("courtId"), journalId: integer("journalId"), year: integer("year", undefined, 9999),
    page: integer("page", 1)!, limit: integer("limit", 50, 100)! };
}

export async function getPublicJudgmentDirectory(params: URLSearchParams) {
  const { courtId, journalId, year, page, limit } = directoryOptions(params);
  const conditions = [indexableJudgmentCandidateFilter];
  if (courtId) conditions.push(eq(judgments.courtId, courtId));
  if (journalId) conditions.push(eq(judgments.journalId, journalId));
  if (year) conditions.push(eq(judgments.year, year));
  const where = and(...conditions);
  const [counts] = await db.select({ value: count() }).from(judgments).where(where);
  const candidates: DirectoryJudgment[] = await db.select({ id: judgments.id, year: judgments.year, page: judgments.page,
    citation: judgments.citationString, title: judgments.title, decisionDate: judgments.decisionDate,
    courtName: courtsRef.name, courtSnapshot: judgments.courtNameSnapshot, journalCode: lawJournals.code })
    .from(judgments).innerJoin(lawJournals, eq(judgments.journalId, lawJournals.id))
    .leftJoin(courtsRef, eq(judgments.courtId, courtsRef.id)).where(where)
    .orderBy(desc(judgments.createdAt), desc(judgments.id)).limit(limit).offset((page - 1) * limit);
  const confirmed = await getIndexableJudgmentIds(candidates.map(row => row.id));
  const total = Number(counts?.value || 0), totalPages = Math.ceil(total / limit);
  return { items: candidates.filter(row => confirmed.has(row.id)),
    // Counts describe candidate slots; individual unsafe identities are omitted.
    pagination: { total, totalIsEstimate: true, page, limit, totalPages, hasMore: page < totalPages } };
}
