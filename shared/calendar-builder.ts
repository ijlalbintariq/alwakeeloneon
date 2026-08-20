/**
 * Core Google Calendar & iCal URL / File Builder
 * Converts Pakistani court hearing metadata and Daily Diary items into pre-populated calendar events.
 */

export interface CourtHearingCalendarEvent {
  title: string;
  court?: string | null;
  bench?: string | null;
  courtNumber?: string | null;
  judgeName?: string | null;
  caseNumber?: string | null;
  caseTitle?: string | null;
  petitionerAdvocate?: string | null;
  respondentAdvocate?: string | null;
  fixationPurpose?: string | null;
  date: string; // 'YYYY-MM-DD'
  time?: string | null; // 'HH:mm' (default: 09:00 PKT)
  durationMinutes?: number; // default: 120 minutes
  sourceUrl?: string | null;
  isRedList?: boolean;
}

/**
 * Formats a clean, professional description for the lawyer's calendar entry.
 */
export function formatHearingDescription(event: CourtHearingCalendarEvent): string {
  const lines: string[] = [];

  if (event.isRedList) {
    lines.push("🚨 PRIORITY / RED CAUSE LIST HEARING");
    lines.push("----------------------------------------");
  }

  if (event.caseNumber) {
    lines.push(`Case Number: ${event.caseNumber}`);
  }

  if (event.caseTitle) {
    lines.push(`Case Title: ${event.caseTitle}`);
  }

  if (event.court || event.bench) {
    const courtParts = [event.court, event.bench].filter(Boolean);
    lines.push(`Court: ${courtParts.join(" - ")}`);
  }

  if (event.courtNumber) {
    lines.push(`Court Room: ${event.courtNumber}`);
  }

  if (event.judgeName) {
    lines.push(`Bench / Judge: ${event.judgeName}`);
  }

  if (event.fixationPurpose) {
    lines.push(`Fixation Purpose: ${event.fixationPurpose}`);
  }

  if (event.petitionerAdvocate) {
    lines.push(`Petitioner Counsel: ${event.petitionerAdvocate}`);
  }

  if (event.respondentAdvocate) {
    lines.push(`Respondent Counsel: ${event.respondentAdvocate}`);
  }

  lines.push("----------------------------------------");
  lines.push("Managed via Alwakeelo — AI Legal Platform for Pakistan");
  if (event.sourceUrl) {
    lines.push(`Official Source: ${event.sourceUrl}`);
  }

  return lines.join("\n");
}

/**
 * Builds a clean location string for calendar events
 */
export function formatHearingLocation(event: CourtHearingCalendarEvent): string {
  const parts: string[] = [];
  if (event.courtNumber) parts.push(event.courtNumber);
  if (event.bench) parts.push(event.bench);
  if (event.court) parts.push(event.court);
  parts.push("Pakistan");
  return parts.filter(Boolean).join(", ");
}

/**
 * Converts a YYYY-MM-DD date and optional HH:mm time in PKT (UTC+5) into UTC ISO format YYYYMMDDTHHmmssZ
 */
export function toUtcCalendarTimestamps(
  dateStr: string,
  timeStr?: string | null,
  durationMinutes = 120
): { startIso: string; endIso: string } {
  const [year, month, day] = dateStr.split("-").map((v) => parseInt(v, 10));
  
  let hours = 9; // Default 09:00 AM PKT
  let minutes = 0;

  if (timeStr && timeStr.includes(":")) {
    const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10));
    if (!isNaN(h) && h >= 0 && h < 24) hours = h;
    if (!isNaN(m) && m >= 0 && m < 60) minutes = m;
  }

  // Pakistan Standard Time is UTC+5 (subtract 5 hours for UTC)
  const startDate = new Date(Date.UTC(year, month - 1, day, hours - 5, minutes, 0));
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const formatUtc = (d: Date) => {
    return d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  };

  return {
    startIso: formatUtc(startDate),
    endIso: formatUtc(endDate),
  };
}

/**
 * Generates a pre-filled 1-click Google Calendar web deep link.
 * Requires zero OAuth setup and works in any browser / mobile device.
 */
export function buildGoogleCalendarUrl(event: CourtHearingCalendarEvent): string {
  const { startIso, endIso } = toUtcCalendarTimestamps(
    event.date,
    event.time,
    event.durationMinutes || 120
  );

  const titlePrefix = event.isRedList ? "🚨 [RED LIST] " : "🏛️ ";
  const fullTitle = `${titlePrefix}${event.title}`;
  const details = formatHearingDescription(event);
  const location = formatHearingLocation(event);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: fullTitle,
    dates: `${startIso}/${endIso}`,
    details,
    location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates an RFC 5545 standard .ICS iCalendar file string for Apple Calendar, Outlook, and Google Calendar.
 */
export function buildIcsCalendarFile(event: CourtHearingCalendarEvent): string {
  const { startIso, endIso } = toUtcCalendarTimestamps(
    event.date,
    event.time,
    event.durationMinutes || 120
  );

  const titlePrefix = event.isRedList ? "[RED LIST] " : "";
  const fullTitle = `${titlePrefix}${event.title}`;
  const description = formatHearingDescription(event).replace(/\n/g, "\\n");
  const location = formatHearingLocation(event);
  const uid = `alwakeelo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@alwakeelo.com`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Alwakeelo Legal AI//Court Hearing Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${startIso}`,
    `DTEND:${endIso}`,
    `SUMMARY:${fullTitle}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT60M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Court Hearing Reminder (1 hour before)",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
