import type { CalendarEventType, RepeatFreq } from "./recurrence";

export type AvailabilityKind = "busy" | "free";

/** Gate 6 one-off busy/free (legacy until UI switches). */
export type AvailabilityEvent = {
  id: string;
  workspace_id: string;
  participant_id: string;
  kind: AvailabilityKind;
  starts_at: string;
  ends_at: string;
  note: string | null;
  version: number;
  deleted_at: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type ScheduleSettings = {
  workspace_id: string;
  day_start_minute: number;
  day_end_minute: number;
  version: number;
  updated_by: string;
  updated_at: string;
};

export type CalendarActionState = {
  ok: boolean;
  code: "ok" | "validation" | "unauthorized" | "not_found" | "conflict" | "error";
  message: string;
  eventId?: string;
};

/** Calendar v2 row shapes (local date + minutes). */
export type CalendarEventRow = {
  id: string;
  workspace_id: string;
  owner_id: string;
  participants: string[];
  event_type: CalendarEventType;
  title: string;
  note: string | null;
  tz: string;
  start_date: string;
  start_minute: number;
  end_minute: number;
  repeat_freq: RepeatFreq;
  repeat_interval: number;
  repeat_weekdays: number[] | null;
  repeat_until: string | null;
  version: number;
  deleted_at: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type CalendarExceptionRow = {
  id: string;
  workspace_id: string;
  event_id: string;
  occurrence_date: string;
  is_cancelled: boolean;
  title: string | null;
  start_minute: number | null;
  end_minute: number | null;
  version: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type AvailabilityRuleRow = {
  id: string;
  workspace_id: string;
  member_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  version: number;
  deleted_at: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};
