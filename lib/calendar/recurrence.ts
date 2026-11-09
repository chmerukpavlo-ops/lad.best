import {
  addDaysYmd,
  compareYmd,
  isoWeekday,
  maxYmd,
  minYmd,
  weeksBetweenMondays,
} from "./ymd";

export type CalendarEventType =
  | "class"
  | "work"
  | "shared_work"
  | "free"
  | "personal";

export type RepeatFreq = "none" | "weekly";

export type CalendarEventRule = {
  id: string;
  ownerId: string;
  participants: string[];
  eventType: CalendarEventType;
  title: string;
  note?: string | null;
  startDate: string; // YYYY-MM-DD first occurrence
  startMinute: number;
  endMinute: number;
  repeatFreq: RepeatFreq;
  repeatInterval: number; // 1..4; 2 = every other week
  /** ISO 1=Mon..7=Sun; null/empty → weekday of startDate */
  repeatWeekdays: number[] | null;
  repeatUntil: string | null;
};

export type CalendarException = {
  eventId: string;
  occurrenceDate: string;
  isCancelled: boolean;
  title?: string | null;
  startMinute?: number | null;
  endMinute?: number | null;
};

export type Occurrence = {
  eventId: string;
  occurrenceDate: string;
  startMinute: number;
  endMinute: number;
  title: string;
  eventType: CalendarEventType;
  ownerId: string;
  participants: string[];
  isException: boolean;
};

function weekdaysFor(rule: CalendarEventRule): Set<number> {
  if (rule.repeatWeekdays && rule.repeatWeekdays.length > 0) {
    return new Set(rule.repeatWeekdays);
  }
  return new Set([isoWeekday(rule.startDate)]);
}

function matchesWeeklyInterval(rule: CalendarEventRule, ymd: string): boolean {
  const interval = Math.max(1, rule.repeatInterval || 1);
  if (interval === 1) return true;
  const weeks = weeksBetweenMondays(rule.startDate, ymd);
  return weeks >= 0 && weeks % interval === 0;
}

function dateMatchesRule(rule: CalendarEventRule, ymd: string): boolean {
  if (compareYmd(ymd, rule.startDate) < 0) return false;
  if (rule.repeatUntil && compareYmd(ymd, rule.repeatUntil) > 0) return false;

  if (rule.repeatFreq === "none") {
    return ymd === rule.startDate;
  }

  // weekly
  if (!weekdaysFor(rule).has(isoWeekday(ymd))) return false;
  return matchesWeeklyInterval(rule, ymd);
}

/**
 * Expand a single rule into occurrences in [rangeStart, rangeEnd] inclusive.
 * Exceptions cancel or override a specific date; they do not invent new dates.
 */
export function expandOccurrences(
  rule: CalendarEventRule,
  exceptions: readonly CalendarException[],
  rangeStart: string,
  rangeEnd: string,
): Occurrence[] {
  if (compareYmd(rangeEnd, rangeStart) < 0) return [];

  const byDate = new Map<string, CalendarException>();
  for (const ex of exceptions) {
    if (ex.eventId !== rule.id) continue;
    byDate.set(ex.occurrenceDate, ex);
  }

  const from = maxYmd(rangeStart, rule.startDate);
  const to = rule.repeatUntil
    ? minYmd(rangeEnd, rule.repeatUntil)
    : rangeEnd;
  if (compareYmd(to, from) < 0) return [];

  const out: Occurrence[] = [];
  for (let ymd = from; compareYmd(ymd, to) <= 0; ymd = addDaysYmd(ymd, 1)) {
    if (!dateMatchesRule(rule, ymd)) continue;

    const ex = byDate.get(ymd);
    if (ex?.isCancelled) continue;

    const startMinute =
      ex?.startMinute != null ? ex.startMinute : rule.startMinute;
    const endMinute = ex?.endMinute != null ? ex.endMinute : rule.endMinute;
    if (!(endMinute > startMinute)) continue;

    out.push({
      eventId: rule.id,
      occurrenceDate: ymd,
      startMinute,
      endMinute,
      title: (ex?.title && ex.title.trim()) || rule.title,
      eventType: rule.eventType,
      ownerId: rule.ownerId,
      participants: rule.participants,
      isException: Boolean(ex),
    });
  }
  return out;
}

export function expandMany(
  rules: readonly CalendarEventRule[],
  exceptions: readonly CalendarException[],
  rangeStart: string,
  rangeEnd: string,
): Occurrence[] {
  const out: Occurrence[] = [];
  for (const rule of rules) {
    out.push(...expandOccurrences(rule, exceptions, rangeStart, rangeEnd));
  }
  return out.sort(
    (a, b) =>
      compareYmd(a.occurrenceDate, b.occurrenceDate) ||
      a.startMinute - b.startMinute ||
      a.endMinute - b.endMinute,
  );
}

/** Busy for a member: non-free events that include them as participant. */
export function isBusyOccurrence(occ: Occurrence): boolean {
  return occ.eventType !== "free";
}

export function isFreeOccurrence(occ: Occurrence): boolean {
  return occ.eventType === "free";
}

export function occurrenceTouchesMember(
  occ: Occurrence,
  memberId: string,
): boolean {
  return occ.participants.includes(memberId);
}
