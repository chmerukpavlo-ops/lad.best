"use server";

import { revalidatePath } from "next/cache";

import { listWorkspaceMembers } from "@/app/actions/ads";
import { getOrCreateScheduleSettings } from "@/app/actions/calendar";
import { getMemberGate } from "@/lib/auth/member-gate";
import {
  asTrimmed,
  isUuid,
  isYmd,
  parseEditScope,
  validateCalendarEventInput,
} from "@/lib/calendar/event-validation";
import { addDaysYmd } from "@/lib/calendar/ymd";
import type {
  AvailabilityRuleRow,
  CalendarActionState,
  CalendarEventRow,
  CalendarExceptionRow,
} from "@/lib/calendar/types";
import { parsePositiveInt } from "@/lib/listings/validation";
import { resolveOptimisticUpdate } from "@/lib/listings/version";

const EVENT_SELECT =
  "id, workspace_id, owner_id, participants, event_type, title, note, tz, start_date, start_minute, end_minute, repeat_freq, repeat_interval, repeat_weekdays, repeat_until, version, deleted_at, created_by, updated_by, created_at, updated_at";

const EXC_SELECT =
  "id, workspace_id, event_id, occurrence_date, is_cancelled, title, start_minute, end_minute, version, created_by, updated_by, created_at, updated_at";

const RULE_SELECT =
  "id, workspace_id, member_id, weekday, start_minute, end_minute, version, deleted_at, created_by, updated_by, created_at, updated_at";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function formAll(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((v): v is string => typeof v === "string");
}

function fail(
  code: CalendarActionState["code"],
  message: string,
): CalendarActionState {
  return { ok: false, code, message };
}

function revalidateCalendar() {
  revalidatePath("/app");
  revalidatePath("/app/calendar");
}

async function requireMemberClient() {
  const gate = await getMemberGate(false);
  if (!gate.ok) {
    return {
      ok: false as const,
      state: fail(
        gate.reason === "unauthorized" ? "unauthorized" : "error",
        gate.message,
      ),
    };
  }
  return {
    ok: true as const,
    user: gate.user,
    supabase: gate.supabase,
    workspaceId: gate.workspaceId,
  };
}

function mapEvent(row: CalendarEventRow) {
  return row;
}

export async function ensureAvailabilityRules(): Promise<{
  ok: boolean;
  rules: AvailabilityRuleRow[];
  message?: string;
}> {
  const gate = await requireMemberClient();
  if (!gate.ok) return { ok: false, rules: [], message: gate.state.message };

  const { data: existing, error } = await gate.supabase
    .from("availability_rules")
    .select(RULE_SELECT)
    .eq("workspace_id", gate.workspaceId)
    .is("deleted_at", null);

  if (error) {
    return {
      ok: false,
      rules: [],
      message: "Не вдалося завантажити шаблон доступності.",
    };
  }

  if ((existing?.length ?? 0) > 0) {
    return { ok: true, rules: existing as AvailabilityRuleRow[] };
  }

  const [settingsRes, membersRes] = await Promise.all([
    getOrCreateScheduleSettings(),
    listWorkspaceMembers(),
  ]);
  if (!settingsRes.ok || !membersRes.ok || membersRes.members.length === 0) {
    return {
      ok: false,
      rules: [],
      message: "Немає учасників або робочих меж для шаблону доступності.",
    };
  }

  const start = settingsRes.settings.day_start_minute;
  const end = settingsRes.settings.day_end_minute;
  const rows = membersRes.members.flatMap((m) =>
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      workspace_id: gate.workspaceId,
      member_id: m.profile_id,
      weekday,
      start_minute: start,
      end_minute: end,
    })),
  );

  const { data: created, error: createError } = await gate.supabase
    .from("availability_rules")
    .insert(rows)
    .select(RULE_SELECT);

  if (createError || !created) {
    // race: someone else seeded
    const { data: again } = await gate.supabase
      .from("availability_rules")
      .select(RULE_SELECT)
      .eq("workspace_id", gate.workspaceId)
      .is("deleted_at", null);
    if (again?.length) {
      return { ok: true, rules: again as AvailabilityRuleRow[] };
    }
    return {
      ok: false,
      rules: [],
      message: "Не вдалося створити шаблон доступності.",
    };
  }

  return { ok: true, rules: created as AvailabilityRuleRow[] };
}

export async function listCalendarV2Bundle(args: {
  rangeStart: string;
  rangeEnd: string;
}): Promise<{
  ok: boolean;
  events: CalendarEventRow[];
  exceptions: CalendarExceptionRow[];
  rules: AvailabilityRuleRow[];
  message?: string;
}> {
  const gate = await requireMemberClient();
  if (!gate.ok) {
    return {
      ok: false,
      events: [],
      exceptions: [],
      rules: [],
      message: gate.state.message,
    };
  }

  const rulesRes = await ensureAvailabilityRules();
  if (!rulesRes.ok) {
    return {
      ok: false,
      events: [],
      exceptions: [],
      rules: [],
      message: rulesRes.message,
    };
  }

  const { data: allEvents, error: allErr } = await gate.supabase
    .from("calendar_events")
    .select(EVENT_SELECT)
    .eq("workspace_id", gate.workspaceId)
    .is("deleted_at", null)
    .order("start_date", { ascending: true });

  if (allErr) {
    return {
      ok: false,
      events: [],
      exceptions: [],
      rules: rulesRes.rules,
      message: "Не вдалося завантажити події.",
    };
  }

  const filtered = ((allEvents ?? []) as CalendarEventRow[]).filter((e) => {
    if (e.start_date > args.rangeEnd) return false;
    if (e.repeat_freq === "none") {
      return e.start_date >= args.rangeStart && e.start_date <= args.rangeEnd;
    }
    const until = e.repeat_until ?? "9999-12-31";
    return until >= args.rangeStart;
  });

  const ids = filtered.map((e) => e.id);
  let exceptions: CalendarExceptionRow[] = [];
  if (ids.length > 0) {
    const { data: ex, error: exErr } = await gate.supabase
      .from("calendar_event_exceptions")
      .select(EXC_SELECT)
      .eq("workspace_id", gate.workspaceId)
      .in("event_id", ids)
      .gte("occurrence_date", args.rangeStart)
      .lte("occurrence_date", args.rangeEnd);
    if (exErr) {
      return {
        ok: false,
        events: filtered,
        exceptions: [],
        rules: rulesRes.rules,
        message: "Не вдалося завантажити винятки.",
      };
    }
    exceptions = (ex ?? []) as CalendarExceptionRow[];
  }

  return {
    ok: true,
    events: filtered.map(mapEvent),
    exceptions,
    rules: rulesRes.rules,
  };
}

export async function createCalendarEvent(
  _prev: CalendarActionState | null,
  formData: FormData,
): Promise<CalendarActionState> {
  const gate = await requireMemberClient();
  if (!gate.ok) return gate.state;

  const parsed = validateCalendarEventInput({
    title: formString(formData, "title"),
    note: formString(formData, "note"),
    event_type: formString(formData, "event_type"),
    audience: formString(formData, "audience"),
    start_date: formString(formData, "start_date"),
    start_time: formString(formData, "start_time"),
    end_time: formString(formData, "end_time"),
    repeat_mode: formString(formData, "repeat_mode"),
    repeat_weekdays: formAll(formData, "repeat_weekdays"),
    repeat_until: formString(formData, "repeat_until"),
  });
  if (!parsed.ok) return fail("validation", parsed.message);

  const membersRes = await listWorkspaceMembers();
  if (!membersRes.ok || membersRes.members.length < 1) {
    return fail("error", "Немає учасників workspace.");
  }
  const memberIds = membersRes.members.map((m) => m.profile_id);
  if (!memberIds.includes(gate.user.id)) {
    return fail("unauthorized", "Ви не учасник workspace.");
  }

  const participants =
    parsed.value.audience === "both"
      ? memberIds.slice(0, 2)
      : [gate.user.id];

  if (parsed.value.audience === "both" && participants.length < 2) {
    return fail("validation", "Для спільної роботи потрібні двоє учасників.");
  }

  const { data, error } = await gate.supabase
    .from("calendar_events")
    .insert({
      workspace_id: gate.workspaceId,
      owner_id: gate.user.id,
      participants,
      event_type: parsed.value.eventType,
      title: parsed.value.title,
      note: parsed.value.note,
      start_date: parsed.value.startDate,
      start_minute: parsed.value.startMinute,
      end_minute: parsed.value.endMinute,
      repeat_freq: parsed.value.repeatFreq,
      repeat_interval: parsed.value.repeatInterval,
      repeat_weekdays: parsed.value.repeatWeekdays,
      repeat_until: parsed.value.repeatUntil,
    })
    .select("id")
    .single();

  if (error || !data) {
    return fail(
      "error",
      "Не вдалося зберегти подію. Перевірте поля й спробуйте ще раз.",
    );
  }

  revalidateCalendar();
  return {
    ok: true,
    code: "ok",
    message: "Подію збережено.",
    eventId: data.id as string,
  };
}

export async function updateCalendarEventScope(
  _prev: CalendarActionState | null,
  formData: FormData,
): Promise<CalendarActionState> {
  const gate = await requireMemberClient();
  if (!gate.ok) return gate.state;

  const eventId = asTrimmed(formString(formData, "event_id"));
  const occurrenceDate = asTrimmed(formString(formData, "occurrence_date"));
  const scope = parseEditScope(formString(formData, "scope"));
  const version = parsePositiveInt(formString(formData, "version"));

  if (!isUuid(eventId) || !isYmd(occurrenceDate) || !scope || version == null) {
    return fail("validation", "Некоректні дані зміни.");
  }

  const parsed = validateCalendarEventInput({
    title: formString(formData, "title"),
    note: formString(formData, "note"),
    event_type: formString(formData, "event_type"),
    audience: formString(formData, "audience"),
    start_date: occurrenceDate,
    start_time: formString(formData, "start_time"),
    end_time: formString(formData, "end_time"),
    repeat_mode: formString(formData, "repeat_mode"),
    repeat_weekdays: formAll(formData, "repeat_weekdays"),
    repeat_until: formString(formData, "repeat_until"),
  });
  if (!parsed.ok) return fail("validation", parsed.message);

  const { data: event, error: loadErr } = await gate.supabase
    .from("calendar_events")
    .select(EVENT_SELECT)
    .eq("workspace_id", gate.workspaceId)
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle();

  if (loadErr || !event) {
    return fail("not_found", "Подію не знайдено.");
  }
  const row = event as CalendarEventRow;

  const membersRes = await listWorkspaceMembers();
  const memberIds = membersRes.ok
    ? membersRes.members.map((m) => m.profile_id)
    : [];
  const participants =
    parsed.value.audience === "both"
      ? memberIds.slice(0, 2)
      : [row.owner_id];

  if (scope === "this") {
    const { data: updated, error } = await gate.supabase
      .from("calendar_event_exceptions")
      .upsert(
        {
          workspace_id: gate.workspaceId,
          event_id: eventId,
          occurrence_date: occurrenceDate,
          is_cancelled: false,
          title: parsed.value.title,
          start_minute: parsed.value.startMinute,
          end_minute: parsed.value.endMinute,
        },
        { onConflict: "event_id,occurrence_date" },
      )
      .select("id")
      .maybeSingle();

    if (error || !updated) {
      return fail("error", "Не вдалося змінити цю дату.");
    }
    revalidateCalendar();
    return { ok: true, code: "ok", message: "Змінено лише цю подію." };
  }

  if (scope === "following") {
    const until = addDaysYmd(occurrenceDate, -1);
    if (until >= row.start_date) {
      const { data: cut } = await gate.supabase
        .from("calendar_events")
        .update({
          repeat_until: until,
          version: row.version,
        })
        .eq("id", eventId)
        .eq("workspace_id", gate.workspaceId)
        .eq("version", row.version)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();

      if (!cut) {
        const { data: current } = await gate.supabase
          .from("calendar_events")
          .select("id, version")
          .eq("id", eventId)
          .maybeSingle();
        const outcome = resolveOptimisticUpdate({
          updated: null,
          current: current ? { id: current.id, version: current.version } : null,
        });
        return fail(
          outcome === "conflict" ? "conflict" : "not_found",
          outcome === "conflict"
            ? "Подію змінено іншим учасником. Оновіть сторінку."
            : "Подію не знайдено.",
        );
      }
    } else {
      await gate.supabase
        .from("calendar_events")
        .update({ deleted_at: new Date().toISOString(), version: row.version })
        .eq("id", eventId)
        .eq("version", row.version)
        .is("deleted_at", null);
    }

    const { data: created, error: createErr } = await gate.supabase
      .from("calendar_events")
      .insert({
        workspace_id: gate.workspaceId,
        owner_id: row.owner_id,
        participants,
        event_type: parsed.value.eventType,
        title: parsed.value.title,
        note: parsed.value.note,
        start_date: occurrenceDate,
        start_minute: parsed.value.startMinute,
        end_minute: parsed.value.endMinute,
        repeat_freq: parsed.value.repeatFreq,
        repeat_interval: parsed.value.repeatInterval,
        repeat_weekdays: parsed.value.repeatWeekdays,
        repeat_until: parsed.value.repeatUntil,
      })
      .select("id")
      .single();

    if (createErr || !created) {
      return fail("error", "Не вдалося зберегти «цю і наступні».");
    }
    revalidateCalendar();
    return {
      ok: true,
      code: "ok",
      message: "Оновлено цю та наступні події.",
      eventId: created.id as string,
    };
  }

  // all
  const { data: updated } = await gate.supabase
    .from("calendar_events")
    .update({
      participants,
      event_type: parsed.value.eventType,
      title: parsed.value.title,
      note: parsed.value.note,
      start_minute: parsed.value.startMinute,
      end_minute: parsed.value.endMinute,
      repeat_freq: parsed.value.repeatFreq,
      repeat_interval: parsed.value.repeatInterval,
      repeat_weekdays: parsed.value.repeatWeekdays,
      repeat_until: parsed.value.repeatUntil,
      version,
    })
    .eq("id", eventId)
    .eq("workspace_id", gate.workspaceId)
    .eq("version", version)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (!updated) {
    const { data: current } = await gate.supabase
      .from("calendar_events")
      .select("id, version")
      .eq("id", eventId)
      .maybeSingle();
    const outcome = resolveOptimisticUpdate({
      updated: null,
      current: current ? { id: current.id, version: current.version } : null,
    });
    return fail(
      outcome === "conflict" ? "conflict" : "not_found",
      outcome === "conflict"
        ? "Подію змінено іншим учасником. Оновіть сторінку."
        : "Подію не знайдено.",
    );
  }

  revalidateCalendar();
  return { ok: true, code: "ok", message: "Оновлено всю серію." };
}

export async function deleteCalendarEventScope(
  _prev: CalendarActionState | null,
  formData: FormData,
): Promise<CalendarActionState> {
  const gate = await requireMemberClient();
  if (!gate.ok) return gate.state;

  const eventId = asTrimmed(formString(formData, "event_id"));
  const occurrenceDate = asTrimmed(formString(formData, "occurrence_date"));
  const scope = parseEditScope(formString(formData, "scope"));
  const version = parsePositiveInt(formString(formData, "version"));

  if (!isUuid(eventId) || !isYmd(occurrenceDate) || !scope || version == null) {
    return fail("validation", "Некоректні дані видалення.");
  }

  const { data: event } = await gate.supabase
    .from("calendar_events")
    .select(EVENT_SELECT)
    .eq("id", eventId)
    .eq("workspace_id", gate.workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!event) return fail("not_found", "Подію не знайдено.");
  const row = event as CalendarEventRow;

  if (scope === "this") {
    const { error } = await gate.supabase.from("calendar_event_exceptions").upsert(
      {
        workspace_id: gate.workspaceId,
        event_id: eventId,
        occurrence_date: occurrenceDate,
        is_cancelled: true,
        title: null,
        start_minute: null,
        end_minute: null,
      },
      { onConflict: "event_id,occurrence_date" },
    );
    if (error) return fail("error", "Не вдалося скасувати цю дату.");
    revalidateCalendar();
    return { ok: true, code: "ok", message: "Цю подію скасовано." };
  }

  if (scope === "following") {
    const until = addDaysYmd(occurrenceDate, -1);
    const patch =
      until < row.start_date
        ? { deleted_at: new Date().toISOString(), version }
        : { repeat_until: until, version };
    const { data } = await gate.supabase
      .from("calendar_events")
      .update(patch)
      .eq("id", eventId)
      .eq("version", version)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (!data) {
      const { data: current } = await gate.supabase
        .from("calendar_events")
        .select("id, version")
        .eq("id", eventId)
        .maybeSingle();
      const outcome = resolveOptimisticUpdate({
        updated: null,
        current: current ? { id: current.id, version: current.version } : null,
      });
      return fail(
        outcome === "conflict" ? "conflict" : "not_found",
        outcome === "conflict"
          ? "Подію змінено іншим учасником. Оновіть сторінку."
          : "Подію не знайдено.",
      );
    }
    revalidateCalendar();
    return { ok: true, code: "ok", message: "Видалено цю та наступні." };
  }

  const { data } = await gate.supabase
    .from("calendar_events")
    .update({
      deleted_at: new Date().toISOString(),
      version,
    })
    .eq("id", eventId)
    .eq("version", version)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (!data) {
    const { data: current } = await gate.supabase
      .from("calendar_events")
      .select("id, version")
      .eq("id", eventId)
      .maybeSingle();
    const outcome = resolveOptimisticUpdate({
      updated: null,
      current: current ? { id: current.id, version: current.version } : null,
    });
    return fail(
      outcome === "conflict" ? "conflict" : "not_found",
      outcome === "conflict"
        ? "Подію змінено іншим учасником. Оновіть сторінку."
        : "Подію не знайдено.",
    );
  }

  revalidateCalendar();
  return { ok: true, code: "ok", message: "Серію видалено." };
}
