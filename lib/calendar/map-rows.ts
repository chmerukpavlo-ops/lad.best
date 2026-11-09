import type {
  AvailabilityRuleRow,
  CalendarEventRow,
  CalendarExceptionRow,
} from "./types";
import type {
  CalendarEventRule,
  CalendarException,
} from "./recurrence";
import type { AvailabilityRule } from "./day-model";

export function toEventRule(row: CalendarEventRow): CalendarEventRule {
  return {
    id: row.id,
    ownerId: row.owner_id,
    participants: row.participants,
    eventType: row.event_type,
    title: row.title,
    note: row.note,
    startDate: row.start_date,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    repeatFreq: row.repeat_freq,
    repeatInterval: row.repeat_interval,
    repeatWeekdays: row.repeat_weekdays,
    repeatUntil: row.repeat_until,
  };
}

export function toException(row: CalendarExceptionRow): CalendarException {
  return {
    eventId: row.event_id,
    occurrenceDate: row.occurrence_date,
    isCancelled: row.is_cancelled,
    title: row.title,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
  };
}

export function toAvailabilityRule(row: AvailabilityRuleRow): AvailabilityRule {
  return {
    memberId: row.member_id,
    weekday: row.weekday,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
  };
}
