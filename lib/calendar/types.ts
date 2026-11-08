export type AvailabilityKind = "busy" | "free";

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
