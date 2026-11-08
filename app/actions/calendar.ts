"use server";

import { revalidatePath } from "next/cache";

import { listWorkspaceMembers } from "@/app/actions/ads";
import {
  clipToWindow,
  nextIntervalFrom,
  participantDayAvailability,
  sharedAvailability,
  type MsInterval,
} from "@/lib/calendar/intervals";
import {
  addCalendarDays,
  kyivTodayYmd,
} from "@/lib/summary/period";
import {
  formatKyivRange,
  utcMsToKyivYmd,
  workWindowForKyivDay,
} from "@/lib/calendar/kyiv";
import type {
  AvailabilityEvent,
  CalendarActionState,
  ScheduleSettings,
} from "@/lib/calendar/types";
import { emptyToNull, validateEventInput } from "@/lib/calendar/validation";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { parsePositiveInt } from "@/lib/listings/validation";
import { resolveOptimisticUpdate } from "@/lib/listings/version";
import { getMembershipWorkspace } from "@/lib/listings/workspace";
import { createClient } from "@/lib/supabase/server";

const EVENT_SELECT =
  "id, workspace_id, participant_id, kind, starts_at, ends_at, note, version, deleted_at, created_by, updated_by, created_at, updated_at";

const DEFAULT_START = 480;
const DEFAULT_END = 1320;

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function fail(
  code: CalendarActionState["code"],
  message: string,
): CalendarActionState {
  return { ok: false, code, message };
}

async function requireMemberClient() {
  const user = await requireVerifiedUser({ withUserRecord: true });
  const supabase = await createClient();
  const membership = await getMembershipWorkspace(supabase, user.id);
  if (!membership.ok) {
    return {
      ok: false as const,
      state: fail(
        membership.reason === "none" ? "unauthorized" : "error",
        membership.message,
      ),
    };
  }
  return {
    ok: true as const,
    user,
    supabase,
    workspaceId: membership.workspaceId,
  };
}

function revalidateCalendar() {
  revalidatePath("/app");
  revalidatePath("/app/calendar");
}

export async function getOrCreateScheduleSettings(): Promise<{
  ok: boolean;
  settings: ScheduleSettings;
  message?: string;
}> {
  const gate = await requireMemberClient();
  const fallback: ScheduleSettings = {
    workspace_id: "",
    day_start_minute: DEFAULT_START,
    day_end_minute: DEFAULT_END,
    version: 1,
    updated_by: "",
    updated_at: new Date().toISOString(),
  };
  if (!gate.ok) {
    return { ok: false, settings: fallback, message: gate.state.message };
  }

  const { data, error } = await gate.supabase
    .from("workspace_schedule_settings")
    .select("*")
    .eq("workspace_id", gate.workspaceId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      settings: { ...fallback, workspace_id: gate.workspaceId },
      message: "Не вдалося завантажити робочі межі. Спробуйте пізніше.",
    };
  }

  if (data) {
    return { ok: true, settings: data as ScheduleSettings };
  }

  const { data: created, error: createError } = await gate.supabase
    .from("workspace_schedule_settings")
    .insert({
      workspace_id: gate.workspaceId,
      day_start_minute: DEFAULT_START,
      day_end_minute: DEFAULT_END,
    })
    .select("*")
    .single();

  if (createError || !created) {
    // Race: another member created it
    const { data: again } = await gate.supabase
      .from("workspace_schedule_settings")
      .select("*")
      .eq("workspace_id", gate.workspaceId)
      .maybeSingle();
    if (again) {
      return { ok: true, settings: again as ScheduleSettings };
    }
    return {
      ok: false,
      settings: { ...fallback, workspace_id: gate.workspaceId },
      message: "Не вдалося створити робочі межі.",
    };
  }

  return { ok: true, settings: created as ScheduleSettings };
}

export async function listAvailabilityEvents(args?: {
  fromIso?: string;
  toIso?: string;
}): Promise<{
  ok: boolean;
  events: AvailabilityEvent[];
  message?: string;
}> {
  const gate = await requireMemberClient();
  if (!gate.ok) {
    return { ok: false, events: [], message: gate.state.message };
  }

  let q = gate.supabase
    .from("availability_events")
    .select(EVENT_SELECT)
    .eq("workspace_id", gate.workspaceId)
    .is("deleted_at", null)
    .order("starts_at", { ascending: true });

  if (args?.fromIso) q = q.gte("ends_at", args.fromIso);
  if (args?.toIso) q = q.lte("starts_at", args.toIso); // starts before horizon end

  const { data, error } = await q;
  if (error) {
    return {
      ok: false,
      events: [],
      message:
        "Не вдалося завантажити календар. Спробуйте пізніше.",
    };
  }
  return { ok: true, events: (data ?? []) as AvailabilityEvent[] };
}

export type SharedWindowPreview = {
  label: string;
  rangeText: string | null;
  detail: string;
  rows: Array<{
    label: string;
    segments: Array<{ start: number; width: number; shared?: boolean }>;
  }>;
};

export async function getSharedAvailabilityPreview(): Promise<{
  ok: boolean;
  preview: SharedWindowPreview;
  message?: string;
}> {
  const empty: SharedWindowPreview = {
    label: "Спільна доступність",
    rangeText: null,
    detail:
      "Немає спільних вікон: потрібні позначені free в обох, busy віднімається. Порожній день ≠ вільний.",
    rows: [],
  };

  const gate = await requireMemberClient();
  if (!gate.ok) {
    return { ok: false, preview: empty, message: gate.state.message };
  }

  const settingsRes = await getOrCreateScheduleSettings();
  if (!settingsRes.ok) {
    return { ok: false, preview: empty, message: settingsRes.message };
  }

  const membersRes = await listWorkspaceMembers();
  const members = membersRes.ok ? membersRes.members : [];
  if (members.length < 2) {
    return {
      ok: true,
      preview: {
        ...empty,
        detail: "Потрібні двоє учасників workspace для спільного вікна.",
      },
    };
  }

  const today = kyivTodayYmd();
  const fromIso = new Date(
    workWindowForKyivDay(
      today,
      settingsRes.settings.day_start_minute,
      settingsRes.settings.day_end_minute,
    ).start,
  ).toISOString();
  const horizon = addCalendarDays(today, 14);
  const toIso = new Date(
    workWindowForKyivDay(
      horizon,
      settingsRes.settings.day_start_minute,
      settingsRes.settings.day_end_minute,
    ).end,
  ).toISOString();

  const eventsRes = await listAvailabilityEvents({ fromIso, toIso });
  if (!eventsRes.ok) {
    return { ok: false, preview: empty, message: eventsRes.message };
  }

  const [m1, m2] = members;
  const now = Date.now();
  let nextShared: MsInterval | null = null;
  let dayUsed = today;

  for (let d = 0; d < 14; d++) {
    const ymd = addCalendarDays(today, d);
    const work = workWindowForKyivDay(
      ymd,
      settingsRes.settings.day_start_minute,
      settingsRes.settings.day_end_minute,
    );
    const dayEvents = eventsRes.events.filter((e) => {
      const s = Date.parse(e.starts_at);
      const en = Date.parse(e.ends_at);
      return en > work.start && s < work.end;
    });

    const avail = (participantId: string) =>
      participantDayAvailability({
        workWindow: work,
        free: dayEvents
          .filter((e) => e.participant_id === participantId && e.kind === "free")
          .map((e) => ({
            start: Date.parse(e.starts_at),
            end: Date.parse(e.ends_at),
          })),
        busy: dayEvents
          .filter((e) => e.participant_id === participantId && e.kind === "busy")
          .map((e) => ({
            start: Date.parse(e.starts_at),
            end: Date.parse(e.ends_at),
          })),
      });

    const shared = sharedAvailability(avail(m1!.profile_id), avail(m2!.profile_id));
    const next = nextIntervalFrom(shared, Math.max(now, work.start));
    if (next) {
      nextShared = next;
      dayUsed = ymd;
      break;
    }
  }

  const workToday = workWindowForKyivDay(
    dayUsed,
    settingsRes.settings.day_start_minute,
    settingsRes.settings.day_end_minute,
  );
  const span = Math.max(workToday.end - workToday.start, 1);

  const toSeg = (intervals: MsInterval[], shared = false) =>
    intervals.map((i) => {
      const clipped = clipToWindow([i], workToday)[0];
      if (!clipped) return { start: 0, width: 0, shared };
      return {
        start: ((clipped.start - workToday.start) / span) * 100,
        width: ((clipped.end - clipped.start) / span) * 100,
        shared,
      };
    });

  const dayEvents = eventsRes.events.filter((e) => {
    const s = Date.parse(e.starts_at);
    const en = Date.parse(e.ends_at);
    return en > workToday.start && s < workToday.end;
  });

  const availOf = (id: string) =>
    participantDayAvailability({
      workWindow: workToday,
      free: dayEvents
        .filter((e) => e.participant_id === id && e.kind === "free")
        .map((e) => ({
          start: Date.parse(e.starts_at),
          end: Date.parse(e.ends_at),
        })),
      busy: dayEvents
        .filter((e) => e.participant_id === id && e.kind === "busy")
        .map((e) => ({
          start: Date.parse(e.starts_at),
          end: Date.parse(e.ends_at),
        })),
    });

  const a1 = availOf(m1!.profile_id);
  const a2 = availOf(m2!.profile_id);
  const sharedToday = sharedAvailability(a1, a2);

  return {
    ok: true,
    preview: {
      label: `Хто вільний (${String(Math.floor(settingsRes.settings.day_start_minute / 60)).padStart(2, "0")}:00–${String(Math.floor(settingsRes.settings.day_end_minute / 60)).padStart(2, "0")}:00, Kyiv)`,
      rangeText: nextShared
        ? `${utcMsToKyivYmd(nextShared.start) === today ? "" : `${utcMsToKyivYmd(nextShared.start)} `}${formatKyivRange(nextShared.start, nextShared.end)}`
        : null,
      detail: nextShared
        ? "Перетин free обох після busy"
        : "Немає спільного вікна в найближчі 14 днів (або не позначено free).",
      rows: [
        {
          label: m1!.display_name?.trim() || "Учасник 1",
          segments: toSeg(a1),
        },
        {
          label: m2!.display_name?.trim() || "Учасник 2",
          segments: toSeg(a2),
        },
        {
          label: "Спільне",
          segments: toSeg(sharedToday, true),
        },
      ],
    },
  };
}

export async function createAvailabilityEvent(
  _prev: CalendarActionState | null,
  formData: FormData,
): Promise<CalendarActionState> {
  const gate = await requireMemberClient();
  if (!gate.ok) return gate.state;

  const validated = validateEventInput({
    participant_id: formString(formData, "participant_id"),
    kind: formString(formData, "kind"),
    starts_at: formString(formData, "starts_at"),
    ends_at: formString(formData, "ends_at"),
    note: formString(formData, "note"),
  });
  if (!validated.ok) return fail("validation", validated.message);

  const { data: member } = await gate.supabase
    .from("memberships")
    .select("profile_id")
    .eq("workspace_id", gate.workspaceId)
    .eq("profile_id", validated.value.participant_id)
    .maybeSingle();
  if (!member) {
    return fail("validation", "Учасник має бути в цьому workspace.");
  }

  const { data, error } = await gate.supabase
    .from("availability_events")
    .insert({
      workspace_id: gate.workspaceId,
      participant_id: validated.value.participant_id,
      kind: validated.value.kind,
      starts_at: validated.value.starts_at_iso,
      ends_at: validated.value.ends_at_iso,
      note: emptyToNull(validated.value.note),
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return fail("error", "Не вдалося зберегти інтервал.");
  }
  revalidateCalendar();
  return {
    ok: true,
    code: "ok",
    message: "Інтервал додано.",
    eventId: data.id,
  };
}

export async function updateAvailabilityEvent(
  _prev: CalendarActionState | null,
  formData: FormData,
): Promise<CalendarActionState> {
  const gate = await requireMemberClient();
  if (!gate.ok) return gate.state;

  const id = formString(formData, "id").trim();
  const version = parsePositiveInt(formString(formData, "version"));
  if (!id || version == null) {
    return fail("validation", "Некоректні id/version.");
  }

  const validated = validateEventInput({
    participant_id: formString(formData, "participant_id"),
    kind: formString(formData, "kind"),
    starts_at: formString(formData, "starts_at"),
    ends_at: formString(formData, "ends_at"),
    note: formString(formData, "note"),
  });
  if (!validated.ok) return fail("validation", validated.message);

  const { data, error } = await gate.supabase
    .from("availability_events")
    .update({
      participant_id: validated.value.participant_id,
      kind: validated.value.kind,
      starts_at: validated.value.starts_at_iso,
      ends_at: validated.value.ends_at_iso,
      note: emptyToNull(validated.value.note),
    })
    .eq("id", id)
    .eq("workspace_id", gate.workspaceId)
    .is("deleted_at", null)
    .eq("version", version)
    .select("id")
    .maybeSingle();

  if (error) return fail("error", "Не вдалося оновити інтервал.");
  if (!data) {
    const { data: current } = await gate.supabase
      .from("availability_events")
      .select("id, version")
      .eq("id", id)
      .eq("workspace_id", gate.workspaceId)
      .is("deleted_at", null)
      .maybeSingle();
    const outcome = resolveOptimisticUpdate({
      updated: null,
      current: current ? { id: current.id, version: current.version } : null,
    });
    if (outcome === "not_found") {
      return fail("not_found", "Інтервал не знайдено.");
    }
    return fail(
      "conflict",
      "Інтервал змінено іншим учасником. Оновіть сторінку.",
    );
  }

  revalidateCalendar();
  return { ok: true, code: "ok", message: "Збережено.", eventId: data.id };
}

export async function softDeleteAvailabilityEvent(
  _prev: CalendarActionState | null,
  formData: FormData,
): Promise<CalendarActionState> {
  const gate = await requireMemberClient();
  if (!gate.ok) return gate.state;

  const id = formString(formData, "id").trim();
  const version = parsePositiveInt(formString(formData, "version"));
  if (!id || version == null) {
    return fail("validation", "Некоректні id/version.");
  }

  const { data, error } = await gate.supabase
    .from("availability_events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", gate.workspaceId)
    .is("deleted_at", null)
    .eq("version", version)
    .select("id")
    .maybeSingle();

  if (error) return fail("error", "Не вдалося видалити інтервал.");
  if (!data) {
    return fail(
      "conflict",
      "Інтервал уже змінено або видалено. Оновіть сторінку.",
    );
  }

  revalidateCalendar();
  return { ok: true, code: "ok", message: "Інтервал видалено.", eventId: data.id };
}
