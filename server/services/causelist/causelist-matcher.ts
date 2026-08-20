import { and, eq, sql, inArray } from "drizzle-orm";
import { db } from "../../db";
import * as schema from "@shared/schema";
import { ParsedCaseItem, MatchScoreResult } from "./types";
import { sendCauseListAlertEmail } from "./notifications";
import { createGoogleCalendarEvent, updateGoogleCalendarEvent } from "../google-calendar/google-calendar-service";

const TITLE_PREFIXES = [
  /^(?:mr\.|mrs\.|ms\.|miss|dr\.|prof\.)\s+/i,
  /^(?:ch\.|chaudhry|choudhary|chowdhry)\s+/i,
  /^(?:syed|mian|malik|sheikh|raja|sardar|qazi|rana|nawab|khawaja|mirza|pir)\s+/i,
  /^(?:barrister|advocate|adv\.|adv|senior\s*advocate|asc|aor)\s+/i,
];

const TITLE_SUFFIXES = [
  /\s+(?:advocate|adv\.|adv|asc|aor|barrister|senior\s*advocate|llb|llm|phd)$/i,
  /\s+\(petitioner\)$/i,
  /\s+\(respondent\)$/i,
  /\s+\(counsel\)$/i,
];

export function normalizeAdvocateName(name: string): string {
  if (!name) return "";
  let clean = name.trim().toLowerCase();

  clean = clean.replace(/\([^)]*\)/g, "").trim();

  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of TITLE_PREFIXES) {
      if (prefix.test(clean)) {
        clean = clean.replace(prefix, "").trim();
        changed = true;
      }
    }
  }

  changed = true;
  while (changed) {
    changed = false;
    for (const suffix of TITLE_SUFFIXES) {
      if (suffix.test(clean)) {
        clean = clean.replace(suffix, "").trim();
        changed = true;
      }
    }
  }

  return clean.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeCaseNumber(caseNum: string): string {
  if (!caseNum) return "";
  return caseNum
    .toLowerCase()
    .replace(/\b(?:no|number)\.?\s*/gi, "")
    .replace(/[^\w\d\/]/g, "")
    .trim();
}

/**
 * Evaluates match confidence between a scraped case item and user trackers / chamber case files
 */
export function evaluateMatch(
  item: {
    id: number;
    caseNumber: string;
    petitionerAdvocate?: string | null;
    respondentAdvocate?: string | null;
    court: string;
    bench: string;
    judgeName: string;
    courtNumber?: string | null;
    hearingDate: Date;
  },
  trackerOrCase: {
    userId: string;
    type: "tracker_case" | "tracker_advocate" | "chamber_case";
    query: string;
    courtFilter?: string | null;
    caseId?: number;
  }
): MatchScoreResult | null {
  const normItemCase = normalizeCaseNumber(item.caseNumber);
  const normQuery = trackerOrCase.type === "tracker_advocate"
    ? normalizeAdvocateName(trackerOrCase.query)
    : normalizeCaseNumber(trackerOrCase.query);

  // 1. Tier 1 (Confidence 1.0): Exact Case Number Match
  if (trackerOrCase.type === "tracker_case" || trackerOrCase.type === "chamber_case") {
    if (normItemCase === normQuery && normItemCase.length > 2) {
      return {
        userId: trackerOrCase.userId,
        causeListItemId: item.id,
        confidenceScore: 1.0,
        matchTier: "tier1_case_number",
        matchReason: `Exact Case Number Match: ${item.caseNumber}`,
        caseNumber: item.caseNumber,
        court: item.court,
        bench: item.bench,
        judgeName: item.judgeName,
        courtNumber: item.courtNumber,
        hearingDate: item.hearingDate,
      };
    }
  }

  // 2. Advocate Name Matching
  if (trackerOrCase.type === "tracker_advocate" && normQuery.length >= 3) {
    const petAdvNorm = normalizeAdvocateName(item.petitionerAdvocate || "");
    const respAdvNorm = normalizeAdvocateName(item.respondentAdvocate || "");

    const nameMatches =
      petAdvNorm.includes(normQuery) ||
      respAdvNorm.includes(normQuery) ||
      (normQuery.length > 5 && (normQuery.includes(petAdvNorm) || normQuery.includes(respAdvNorm)));

    if (nameMatches) {
      const hasCourtFilter = Boolean(trackerOrCase.courtFilter && trackerOrCase.courtFilter.trim().length > 0);
      const courtMatches = hasCourtFilter && trackerOrCase.courtFilter!.toLowerCase() === item.court.toLowerCase();

      // Tier 2 (Confidence 0.85): Name Match + Court Matches
      if (courtMatches) {
        return {
          userId: trackerOrCase.userId,
          causeListItemId: item.id,
          confidenceScore: 0.85,
          matchTier: "tier2_advocate_court",
          matchReason: `Advocate Name & Court Match: ${trackerOrCase.query} at ${item.court}`,
          caseNumber: item.caseNumber,
          advocateName: trackerOrCase.query,
          court: item.court,
          bench: item.bench,
          judgeName: item.judgeName,
          courtNumber: item.courtNumber,
          hearingDate: item.hearingDate,
        };
      }

      // Tier 3 (Confidence 0.65): Name Match without Court filter
      return {
        userId: trackerOrCase.userId,
        causeListItemId: item.id,
        confidenceScore: 0.65,
        matchTier: "tier3_advocate_exact",
        matchReason: `Advocate Name Match: ${trackerOrCase.query}`,
        caseNumber: item.caseNumber,
        advocateName: trackerOrCase.query,
        court: item.court,
        bench: item.bench,
        judgeName: item.judgeName,
        courtNumber: item.courtNumber,
        hearingDate: item.hearingDate,
      };
    }
  }

  return null;
}

/**
 * Runs matching for all cause list items on a target date against active trackers and case files
 */
export async function runCauseListMatcher(targetDate: string): Promise<{
  totalMatches: number;
  diaryEntriesCreated: number;
  emailsSent: number;
}> {
  let totalMatches = 0;
  let diaryEntriesCreated = 0;
  let emailsSent = 0;

  if (!db) return { totalMatches, diaryEntriesCreated, emailsSent };

  const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
  const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

  console.log(`[CauseListMatcher] Running matching engine for date: ${targetDate}...`);

  const itemsWithRosters = await db
    .select({
      id: schema.courtCauseListItems.id,
      serialNumber: schema.courtCauseListItems.serialNumber,
      caseNumber: schema.courtCauseListItems.caseNumber,
      caseTitle: schema.courtCauseListItems.caseTitle,
      petitioner: schema.courtCauseListItems.petitioner,
      respondent: schema.courtCauseListItems.respondent,
      petitionerAdvocate: schema.courtCauseListItems.petitionerAdvocate,
      respondentAdvocate: schema.courtCauseListItems.respondentAdvocate,
      fixationPurpose: schema.courtCauseListItems.fixationPurpose,
      isRedList: schema.courtCauseListItems.isRedList,
      causeListId: schema.courtCauseListItems.causeListId,
      court: schema.courtCauseLists.court,
      bench: schema.courtCauseLists.bench,
      courtNumber: schema.courtCauseLists.courtNumber,
      judgeName: schema.courtCauseLists.judgeName,
      listType: schema.courtCauseLists.listType,
      hearingDate: schema.courtCauseLists.hearingDate,
    })
    .from(schema.courtCauseListItems)
    .innerJoin(
      schema.courtCauseLists,
      eq(schema.courtCauseListItems.causeListId, schema.courtCauseLists.id)
    )
    .where(
      sql`TO_CHAR(${schema.courtCauseLists.hearingDate}, 'YYYY-MM-DD') = ${targetDate}`
    );

  if (itemsWithRosters.length === 0) {
    console.log(`[CauseListMatcher] No cause list items found for ${targetDate}`);
    return { totalMatches, diaryEntriesCreated, emailsSent };
  }

  const activeTrackers = await db
    .select()
    .from(schema.causeListTrackers)
    .where(eq(schema.causeListTrackers.isActive, true));

  const activeCaseFiles = await db
    .select({
      id: schema.caseFiles.id,
      userId: schema.caseFiles.userId,
      caseNumber: schema.caseFiles.caseNumber,
      court: schema.caseFiles.court,
      title: schema.caseFiles.title,
    })
    .from(schema.caseFiles)
    .where(and(eq(schema.caseFiles.status, "active"), sql`${schema.caseFiles.caseNumber} IS NOT NULL`));

  const candidateRules: Array<{
    userId: string;
    type: "tracker_case" | "tracker_advocate" | "chamber_case";
    query: string;
    courtFilter?: string | null;
    caseId?: number;
    notifyEmail: boolean;
    notifyDiary: boolean;
  }> = [];

  for (const t of activeTrackers) {
    candidateRules.push({
      userId: t.userId,
      type: t.trackType === "case_number" ? "tracker_case" : "tracker_advocate",
      query: t.query,
      courtFilter: t.court,
      notifyEmail: t.notifyEmail,
      notifyDiary: t.notifyDailyDiary,
    });
  }

  for (const c of activeCaseFiles) {
    if (c.caseNumber) {
      candidateRules.push({
        userId: c.userId,
        type: "chamber_case",
        query: c.caseNumber,
        courtFilter: c.court,
        caseId: c.id,
        notifyEmail: false, // Automated emails disabled by default
        notifyDiary: true,
      });
    }
  }

  const userMatches: Record<string, Array<{ match: MatchScoreResult; item: (typeof itemsWithRosters)[0] }>> = {};

  for (const item of itemsWithRosters) {
    for (const rule of candidateRules) {
      const matchResult = evaluateMatch(item, rule);
      if (matchResult && matchResult.confidenceScore >= 0.80) {
        totalMatches++;

        if (!userMatches[rule.userId]) {
          userMatches[rule.userId] = [];
        }
        userMatches[rule.userId].push({ match: matchResult, item });

        if (rule.notifyDiary) {
          try {
            const dateStr = item.hearingDate.toISOString().slice(0, 10);
            const courtroomStr = item.courtNumber ? ` (${item.courtNumber})` : "";
            const title = `Court Hearing: ${item.caseNumber} - ${item.judgeName}${courtroomStr}`;
            const desc = `Court: ${item.court} (${item.bench})\nListed at Sr. #${item.serialNumber || "?"} before ${item.judgeName}\nParties: ${item.caseTitle}\nFixation Purpose: ${item.fixationPurpose || "Hearing"}\nList Type: ${item.listType}`;

            const existingDiary = await db.query.diaryEntries.findFirst({
              where: and(
                eq(schema.diaryEntries.userId, rule.userId),
                eq(schema.diaryEntries.causeListItemId, item.id)
              ),
            });

            const calHearingEvent = {
              title: `Court Hearing: ${item.caseNumber}`,
              court: item.court,
              bench: item.bench,
              courtNumber: item.courtNumber,
              judgeName: item.judgeName,
              caseNumber: item.caseNumber,
              caseTitle: item.caseTitle,
              petitionerAdvocate: item.petitionerAdvocate,
              respondentAdvocate: item.respondentAdvocate,
              fixationPurpose: item.fixationPurpose,
              date: dateStr,
              time: "09:00",
              isRedList: item.isRedList,
            };

            if (!existingDiary) {
              const [insertedEntry] = await db.insert(schema.diaryEntries).values({
                userId: rule.userId,
                date: dateStr,
                time: "09:00",
                title,
                description: desc,
                caseId: rule.caseId || null,
                causeListItemId: item.id,
                priority: item.isRedList ? "urgent" : "high",
                completed: false,
              }).returning();
              diaryEntriesCreated++;

              // Background Google Calendar Auto-Sync Hook
              try {
                const gEventId = await createGoogleCalendarEvent(rule.userId, calHearingEvent);
                if (gEventId && insertedEntry) {
                  await db
                    .update(schema.diaryEntries)
                    .set({ googleEventId: gEventId })
                    .where(eq(schema.diaryEntries.id, insertedEntry.id));
                }
              } catch (gcalErr: any) {
                console.warn(`[CauseListMatcher] Google Calendar background sync skipped for user ${rule.userId}:`, gcalErr.message);
              }
            } else {
              await db
                .update(schema.diaryEntries)
                .set({
                  title,
                  description: desc,
                  date: dateStr,
                  priority: item.isRedList ? "urgent" : "high",
                })
                .where(eq(schema.diaryEntries.id, existingDiary.id));

              // Update existing Google Calendar event if present
              if (existingDiary.googleEventId) {
                try {
                  await updateGoogleCalendarEvent(rule.userId, existingDiary.googleEventId, calHearingEvent);
                } catch (gcalErr: any) {
                  console.warn(`[CauseListMatcher] Google Calendar update skipped for user ${rule.userId}:`, gcalErr.message);
                }
              }
            }
          } catch (diaryErr: any) {
            console.error(`[CauseListMatcher] Failed to insert/update diary entry for user ${rule.userId}:`, diaryErr.message);
          }
        }
      }
    }
  }

  // Automated emails are disabled by default to prevent unwanted inbox messages.
  const ENABLE_AUTOMATED_EMAILS = process.env.ENABLE_AUTOMATED_CAUSELIST_EMAILS === "true";
  if (ENABLE_AUTOMATED_EMAILS) {
    for (const [userId, matches] of Object.entries(userMatches)) {
      try {
        const user = await db.query.users.findFirst({
          where: eq(schema.users.id, userId),
        });

        if (user && user.email) {
          const sent = await sendCauseListAlertEmail(user.email, user.name || "Advocate", targetDate, matches.map(m => m.item));
          if (sent) emailsSent++;
        }
      } catch (emailErr: any) {
        console.warn(`[CauseListMatcher] Failed to send email alert to user ${userId}:`, emailErr.message);
      }
    }
  }

  console.log(
    `[CauseListMatcher] Completed matching for ${targetDate}. Total Matches: ${totalMatches}, Diary Entries: ${diaryEntriesCreated}, Emails Sent: ${emailsSent}`
  );

  return { totalMatches, diaryEntriesCreated, emailsSent };
}
