"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "cn";

import {
  createCalendarEvent,
  deleteCalendarEventScope,
  updateCalendarEventScope,
} from "@/app/actions/calendar-v2";
import { DayBoardV2, WeekBoardV2 } from "@/components/calendar/calendar-boards";
import { EventEditor } from "@/components/calendar/event-editor";
import { useCalendarRealtime } from "@/components/calendar/use-calendar-realtime";
import { CardSurface } from "@/components/ui/card-surface";
import { Button } from "@/components/ui/button";
import { buildDayPlan, nearestSharedWindow } from "@/lib/calendar/day-model";
import type { AvailabilityRule } from "@/lib/calendar/day-model";
import {
  EVENT_TYPE_LABELS,
  formatInterval,
  formatLocalRange,
} from "@/lib/calendar/labels";
import { hhMmFromMinute } from "@/lib/calendar/kyiv";
import { expandMany, type Occurrence } from "@/lib/calendar/recurrence";
import type {
  AvailabilityRuleRow,
  CalendarEventRow,
  CalendarExceptionRow,
} from "@/lib/calendar/types";
import {
  toAvailabilityRule,
  toEventRule,
  toException,
} from "@/lib/calendar/map-rows";
import { addDaysYmd } from "@/lib/calendar/ymd";
import { kyivTodayYmd } from "@/lib/summary/period";

type Member = { profile_id: string; display_name: string | null };

type Props = {
  view: "week" | "day";
  dayYmd: string;
  weekStart: string;
  weekDays: { ymd: string; label: string; dayNum: string }[];
  workspaceId: string;
  currentUserId: string;
  members: Member[];
  dayStartMinute: number;
  dayEndMinute: number;
  events: CalendarEventRow[];
  exceptions: CalendarExceptionRow[];
  rules: AvailabilityRuleRow[];
};

export function CalendarApp({
  view,
  dayYmd,
  weekStart,
  weekDays,
  workspaceId,
  currentUserId,
  members,
  dayStartMinute,
  dayEndMinute,
  events,
  exceptions,
  rules: ruleRows,
}: Props) {
  const router = useRouter();
  useCalendarRealtime(workspaceId);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editOcc, setEditOcc] = useState<Occurrence | null>(null);

  const eventRules = useMemo(() => events.map(toEventRule), [events]);
  const exc = useMemo(() => exceptions.map(toException), [exceptions]);
  const rules: AvailabilityRule[] = useMemo(
    () => ruleRows.map(toAvailabilityRule),
    [ruleRows],
  );
  const memberIds = members.slice(0, 2).map((m) => m.profile_id);
  const fallback = useMemo(
    () => ({ start: dayStartMinute, end: dayEndMinute }),
    [dayStartMinute, dayEndMinute],
  );

  const weekEnd = addDaysYmd(weekStart, 6);
  const weekOccs = useMemo(
    () => expandMany(eventRules, exc, weekStart, weekEnd),
    [eventRules, exc, weekStart, weekEnd],
  );

  const dayPlan = useMemo(() => {
    if (memberIds.length < 2) return null;
    return buildDayPlan({
      ymd: dayYmd,
      memberIds,
      rules,
      eventRules,
      exceptions: exc,
      fallbackWindow: fallback,
    });
  }, [dayYmd, memberIds, rules, eventRules, exc, fallback]);

  const occurrencesByDay = useMemo(() => {
    const map: Record<string, Occurrence[]> = {};
    for (const o of weekOccs) {
      (map[o.occurrenceDate] ??= []).push(o);
    }
    return map;
  }, [weekOccs]);

  const sharedByDay = useMemo(() => {
    const map: Record<string, ReturnType<typeof buildDayPlan>["shared"]> = {};
    if (memberIds.length < 2) return map;
    for (const d of weekDays) {
      map[d.ymd] = buildDayPlan({
        ymd: d.ymd,
        memberIds,
        rules,
        eventRules,
        exceptions: exc,
        fallbackWindow: fallback,
      }).shared;
    }
    return map;
  }, [weekDays, memberIds, rules, eventRules, exc, fallback]);

  const nearest = useMemo(() => {
    if (memberIds.length < 2) return null;
    const today = kyivTodayYmd();
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Kyiv",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const hh = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const mm = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return nearestSharedWindow({
      fromYmd: today,
      fromMinute: hh * 60 + mm,
      daysAhead: 21,
      memberIds: [memberIds[0]!, memberIds[1]!],
      rules,
      eventRules,
      exceptions: exc,
      fallbackWindow: fallback,
    });
  }, [memberIds, rules, eventRules, exc, fallback]);

  const dayOccs = occurrencesByDay[dayYmd] ?? [];

  function setView(next: "week" | "day") {
    const q = new URLSearchParams({ day: dayYmd, view: next });
    router.push(`/app/calendar?${q.toString()}`);
  }

  function setDay(ymd: string) {
    const q = new URLSearchParams({ day: ymd, view });
    router.push(`/app/calendar?${q.toString()}`);
  }

  function openCreate() {
    setEditOcc(null);
    setEditorOpen(true);
  }

  function openEdit(occ: Occurrence) {
    setEditOcc(occ);
    setEditorOpen(true);
  }

  const eventRow = editOcc
    ? events.find((e) => e.id === editOcc.eventId)
    : null;

  const editTarget = editOcc && eventRow
    ? {
        eventId: editOcc.eventId,
        version: eventRow.version,
        occurrenceDate: editOcc.occurrenceDate,
        title: editOcc.title,
        eventType: editOcc.eventType,
        audience:
          editOcc.participants.length > 1
            ? ("both" as const)
            : ("me" as const),
        startMinute: editOcc.startMinute,
        endMinute: editOcc.endMinute,
        repeatMode:
          eventRow.repeat_freq === "none"
            ? ("none" as const)
            : eventRow.repeat_interval === 2
              ? ("biweekly" as const)
              : ("weekly" as const),
        weekdays: eventRow.repeat_weekdays ?? [],
        repeatUntil: eventRow.repeat_until,
        note: eventRow.note ?? "",
        isSeries: eventRow.repeat_freq !== "none",
      }
    : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Календар</h1>
        <Button
          type="button"
          className="min-h-11 rounded-xl"
          onClick={openCreate}
        >
          {view === "week" ? "Нова подія" : "Додати подію"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setView("week")}
          className={cn(
            "inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-medium",
            view === "week"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground",
          )}
        >
          Тиждень
        </button>
        <button
          type="button"
          onClick={() => setView("day")}
          className={cn(
            "inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-medium",
            view === "day"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground",
          )}
        >
          День
        </button>
        {view === "week" ? (
          <span className="text-sm text-muted-foreground">
            {weekDays[0]?.dayNum}–{weekDays[6]?.dayNum}{" "}
            {/* month implied by week */}
          </span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {weekDays.map((d) => (
              <button
                key={d.ymd}
                type="button"
                onClick={() => setDay(d.ymd)}
                className={cn(
                  "inline-flex size-10 items-center justify-center rounded-full text-sm font-medium",
                  d.ymd === dayYmd
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "week" ? (
        <>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#2a2d34]" /> Учасник 1
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#23262d]" /> Учасник 2
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded border border-dashed border-primary/70" />{" "}
              Спільне вікно (від 1 год)
            </span>
          </div>
          <WeekBoardV2
            days={weekDays}
            dayStartMinute={dayStartMinute}
            dayEndMinute={dayEndMinute}
            memberIds={memberIds}
            occurrencesByDay={occurrencesByDay}
            sharedByDay={sharedByDay}
            onSelectDay={(ymd) => {
              const q = new URLSearchParams({ day: ymd, view: "day" });
              router.push(`/app/calendar?${q.toString()}`);
            }}
            onSelectOccurrence={openEdit}
          />
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <DayBoardV2
            dayYmd={dayYmd}
            dayStartMinute={dayStartMinute}
            dayEndMinute={dayEndMinute}
            members={members}
            occurrences={dayOccs}
            shared={dayPlan?.shared ?? []}
            onSelectOccurrence={openEdit}
          />
          <div className="flex flex-col gap-3">
            <CardSurface className="gap-1.5 p-4">
              <p className="text-sm text-muted-foreground">
                Найближче спільне вікно
              </p>
              <p className="text-[1.65rem] font-semibold tabular-nums text-primary">
                {nearest ? formatInterval(nearest.window) : "—"}
              </p>
              {nearest && nearest.ymd !== dayYmd ? (
                <p className="text-xs text-muted-foreground">{nearest.ymd}</p>
              ) : null}
            </CardSurface>
            <CardSurface className="gap-3">
              <h2 className="text-base font-medium">Події сьогодні</h2>
              {dayOccs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Немає подій на цей день.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {dayOccs.map((o) => {
                    const who =
                      o.participants.length > 1
                        ? "Обидва"
                        : members.find((m) => m.profile_id === o.ownerId)
                            ?.display_name || "Учасник";
                    return (
                      <li key={`${o.eventId}-${o.startMinute}`}>
                        <button
                          type="button"
                          onClick={() => openEdit(o)}
                          className="w-full rounded-xl border border-border px-3 py-2 text-left text-sm hover:bg-secondary/50"
                        >
                          <span className="font-medium tabular-nums">
                            {hhMmFromMinute(o.startMinute)}{" "}
                            {EVENT_TYPE_LABELS[o.eventType]}
                          </span>
                          <span className="block text-muted-foreground">
                            {who} · {formatLocalRange(o.startMinute, o.endMinute)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Button
                type="button"
                className="min-h-11 w-full rounded-xl"
                onClick={openCreate}
              >
                Додати подію
              </Button>
            </CardSurface>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Робочі межі / шаблон: {hhMmFromMinute(dayStartMinute)}–
        {hhMmFromMinute(dayEndMinute)} (Kyiv). Спільне вікно ≥ 1 год.
      </p>

      {editorOpen ? (
        <EventEditor
          key={editTarget ? `${editTarget.eventId}-${editTarget.occurrenceDate}` : "new"}
          open={editorOpen}
          onClose={() => {
            setEditorOpen(false);
            setEditOcc(null);
          }}
          members={members}
          currentUserId={currentUserId}
          defaultDate={dayYmd}
          dayStartMinute={dayStartMinute}
          dayEndMinute={dayEndMinute}
          rules={rules}
          createAction={createCalendarEvent}
          updateAction={updateCalendarEventScope}
          deleteAction={deleteCalendarEventScope}
          edit={editTarget}
        />
      ) : null}
    </div>
  );
}
