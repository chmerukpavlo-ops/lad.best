import {
  DEFAULT_MIN_SHARED_MINUTES,
  longestWindow,
  mergeLocal,
  nearestWindowFrom,
  sharedWindows,
  subtractLocal,
  type LocalInterval,
} from "./local-intervals";
import {
  expandMany,
  isBusyOccurrence,
  isFreeOccurrence,
  occurrenceTouchesMember,
  type CalendarEventRule,
  type CalendarException,
  type Occurrence,
} from "./recurrence";
import { addDaysYmd, isoWeekday } from "./ymd";

export type AvailabilityRule = {
  memberId: string;
  weekday: number; // 1=Mon..7=Sun
  startMinute: number;
  endMinute: number;
};

export type MemberDayPlan = {
  memberId: string;
  availability: LocalInterval[];
  busy: LocalInterval[];
  free: LocalInterval[];
  occurrences: Occurrence[];
};

export type DayPlan = {
  ymd: string;
  members: MemberDayPlan[];
  shared: LocalInterval[];
  longestShared: LocalInterval | null;
};

/**
 * availability = weekly rules for weekday ∪ free-type occurrences that day.
 * If no rules and no free events → empty (not whole day).
 * Optional fallbackWindow fills empty rules (e.g. workspace 08–22 during transition).
 */
export function availabilityForMember(args: {
  memberId: string;
  ymd: string;
  rules: readonly AvailabilityRule[];
  freeOccs: readonly Occurrence[];
  fallbackWindow?: LocalInterval | null;
}): LocalInterval[] {
  const weekday = isoWeekday(args.ymd);
  const fromRules = args.rules
    .filter((r) => r.memberId === args.memberId && r.weekday === weekday)
    .map((r) => ({ start: r.startMinute, end: r.endMinute }));

  const fromFree = args.freeOccs
    .filter(
      (o) =>
        o.occurrenceDate === args.ymd &&
        isFreeOccurrence(o) &&
        occurrenceTouchesMember(o, args.memberId),
    )
    .map((o) => ({ start: o.startMinute, end: o.endMinute }));

  let base = mergeLocal([...fromRules, ...fromFree]);
  if (base.length === 0 && args.fallbackWindow) {
    base = mergeLocal([args.fallbackWindow]);
  }
  return base;
}

export function busyForMember(
  memberId: string,
  ymd: string,
  occs: readonly Occurrence[],
): LocalInterval[] {
  return mergeLocal(
    occs
      .filter(
        (o) =>
          o.occurrenceDate === ymd &&
          isBusyOccurrence(o) &&
          occurrenceTouchesMember(o, memberId),
      )
      .map((o) => ({ start: o.startMinute, end: o.endMinute })),
  );
}

export function buildDayPlan(args: {
  ymd: string;
  memberIds: readonly [string, string] | readonly string[];
  rules: readonly AvailabilityRule[];
  eventRules: readonly CalendarEventRule[];
  exceptions: readonly CalendarException[];
  fallbackWindow?: LocalInterval | null;
  minSharedMinutes?: number;
}): DayPlan {
  const occs = expandMany(
    args.eventRules,
    args.exceptions,
    args.ymd,
    args.ymd,
  );
  const min = args.minSharedMinutes ?? DEFAULT_MIN_SHARED_MINUTES;

  const members: MemberDayPlan[] = args.memberIds.map((memberId) => {
    const availability = availabilityForMember({
      memberId,
      ymd: args.ymd,
      rules: args.rules,
      freeOccs: occs,
      fallbackWindow: args.fallbackWindow,
    });
    const busy = busyForMember(memberId, args.ymd, occs);
    const free = subtractLocal(availability, busy);
    return {
      memberId,
      availability,
      busy,
      free,
      occurrences: occs.filter((o) => occurrenceTouchesMember(o, memberId)),
    };
  });

  const shared =
    members.length >= 2
      ? sharedWindows(members[0]!.free, members[1]!.free, min)
      : [];

  return {
    ymd: args.ymd,
    members,
    shared,
    longestShared: longestWindow(shared),
  };
}

/** Find nearest shared window starting from (ymd, minute), scanning forward up to `daysAhead`. */
export function nearestSharedWindow(args: {
  fromYmd: string;
  fromMinute: number;
  daysAhead: number;
  memberIds: readonly [string, string];
  rules: readonly AvailabilityRule[];
  eventRules: readonly CalendarEventRule[];
  exceptions: readonly CalendarException[];
  fallbackWindow?: LocalInterval | null;
  minSharedMinutes?: number;
}): { ymd: string; window: LocalInterval } | null {
  for (let i = 0; i <= args.daysAhead; i++) {
    const ymd = addDaysYmd(args.fromYmd, i);
    const plan = buildDayPlan({
      ymd,
      memberIds: args.memberIds,
      rules: args.rules,
      eventRules: args.eventRules,
      exceptions: args.exceptions,
      fallbackWindow: args.fallbackWindow,
      minSharedMinutes: args.minSharedMinutes,
    });
    const fromMin = i === 0 ? args.fromMinute : 0;
    const hit = nearestWindowFrom(plan.shared, fromMin);
    if (hit && hit.end - hit.start >= (args.minSharedMinutes ?? DEFAULT_MIN_SHARED_MINUTES)) {
      return { ymd, window: hit };
    }
  }
  return null;
}
