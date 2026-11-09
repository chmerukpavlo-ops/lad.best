"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { CalendarActionState } from "@/lib/calendar/types";
import type { CalendarEventType } from "@/lib/calendar/recurrence";
import { buildDayPlan } from "@/lib/calendar/day-model";
import type { AvailabilityRule } from "@/lib/calendar/day-model";
import {
  EVENT_TYPE_LABELS,
  WEEKDAY_SHORT_UA,
  formatInterval,
  recurrenceSummaryUa,
} from "@/lib/calendar/labels";
import { hhMmFromMinute, minuteOfDayFromHhMm } from "@/lib/calendar/kyiv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";

const initial: CalendarActionState = { ok: false, code: "ok", message: "" };

type Member = { profile_id: string; display_name: string | null };

type EditTarget = {
  eventId: string;
  version: number;
  occurrenceDate: string;
  title: string;
  eventType: CalendarEventType;
  audience: "me" | "both";
  startMinute: number;
  endMinute: number;
  repeatMode: "none" | "weekly" | "biweekly";
  weekdays: number[];
  repeatUntil: string | null;
  note: string;
  isSeries: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  members: Member[];
  currentUserId: string;
  defaultDate: string;
  dayStartMinute: number;
  dayEndMinute: number;
  rules: AvailabilityRule[];
  createAction: (
    prev: CalendarActionState | null,
    formData: FormData,
  ) => Promise<CalendarActionState>;
  updateAction: (
    prev: CalendarActionState | null,
    formData: FormData,
  ) => Promise<CalendarActionState>;
  deleteAction: (
    prev: CalendarActionState | null,
    formData: FormData,
  ) => Promise<CalendarActionState>;
  edit?: EditTarget | null;
};

const TYPE_ORDER: CalendarEventType[] = [
  "class",
  "work",
  "shared_work",
  "free",
  "personal",
];

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center rounded-full px-3.5 text-sm font-medium",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function EventEditor({
  open,
  onClose,
  members,
  currentUserId,
  defaultDate,
  dayStartMinute,
  dayEndMinute,
  rules,
  createAction,
  updateAction,
  deleteAction,
  edit,
}: Props) {
  const router = useRouter();
  const isEdit = Boolean(edit);
  const [title, setTitle] = useState(edit?.title ?? "");
  const [eventType, setEventType] = useState<CalendarEventType>(
    edit?.eventType ?? "class",
  );
  const [audience, setAudience] = useState<"me" | "both">(
    edit?.audience ?? "me",
  );
  const [startDate, setStartDate] = useState(
    edit?.occurrenceDate ?? defaultDate,
  );
  const [startTime, setStartTime] = useState(
    hhMmFromMinute(edit?.startMinute ?? 15 * 60 + 30),
  );
  const [endTime, setEndTime] = useState(
    hhMmFromMinute(edit?.endMinute ?? 17 * 60),
  );
  const [repeatMode, setRepeatMode] = useState<"none" | "weekly" | "biweekly">(
    edit?.repeatMode ?? "none",
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    edit?.weekdays?.length ? edit.weekdays : [],
  );
  const [repeatUntil, setRepeatUntil] = useState(edit?.repeatUntil ?? "");
  const [note, setNote] = useState(edit?.note ?? "");
  const [scope, setScope] = useState<"this" | "following" | "all">("this");

  const [createState, createFormAction, createPending] = useActionState(
    createAction,
    initial,
  );
  const [updateState, updateFormAction, updatePending] = useActionState(
    updateAction,
    initial,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteAction,
    initial,
  );

  const pending = createPending || updatePending || deletePending;
  const state = isEdit
    ? updateState.message
      ? updateState
      : deleteState.message
        ? deleteState
        : updateState
    : createState;

  useEffect(() => {
    if (createState.ok || updateState.ok || deleteState.ok) {
      onClose();
      router.refresh();
    }
  }, [createState.ok, updateState.ok, deleteState.ok, onClose, router]);

  const startMinute = minuteOfDayFromHhMm(startTime) ?? 0;
  const endMinute = minuteOfDayFromHhMm(endTime) ?? 0;
  const effectiveType: CalendarEventType =
    audience === "both"
      ? "shared_work"
      : eventType === "shared_work"
        ? "work"
        : eventType;
  const effectiveWeekdays = useMemo(() => {
    if (weekdays.length > 0) return weekdays;
    const [y, m, d] = startDate.split("-").map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return [wd === 0 ? 7 : wd];
  }, [weekdays, startDate]);

  const preview = useMemo(() => {
    const memberIds = members.slice(0, 2).map((m) => m.profile_id);
    if (memberIds.length < 2 || endMinute <= startMinute) {
      return null;
    }
    const participants =
      audience === "both" ? memberIds : [currentUserId];
    const plan = buildDayPlan({
      ymd: startDate,
      memberIds,
      rules,
      eventRules: [
        {
          id: edit?.eventId ?? "draft",
          ownerId: currentUserId,
          participants,
          eventType: effectiveType,
          title: title || "Подія",
          startDate,
          startMinute,
          endMinute,
          repeatFreq: repeatMode === "none" ? "none" : "weekly",
          repeatInterval: repeatMode === "biweekly" ? 2 : 1,
          repeatWeekdays: repeatMode === "none" ? null : effectiveWeekdays,
          repeatUntil: repeatMode === "none" ? null : repeatUntil || null,
        },
      ],
      exceptions: [],
      fallbackWindow: { start: dayStartMinute, end: dayEndMinute },
      minSharedMinutes: 60,
    });
    return plan;
  }, [
    members,
    currentUserId,
    audience,
    startDate,
    startMinute,
    endMinute,
    effectiveType,
    title,
    repeatMode,
    effectiveWeekdays,
    repeatUntil,
    rules,
    dayStartMinute,
    dayEndMinute,
    edit?.eventId,
  ]);

  const summary = recurrenceSummaryUa({
    repeatFreq: repeatMode === "none" ? "none" : "weekly",
    repeatInterval: repeatMode === "biweekly" ? 2 : 1,
    weekdays: effectiveWeekdays,
    startMinute,
    endMinute,
    repeatUntil: repeatMode === "none" ? null : repeatUntil || null,
  });

  if (!open) return null;

  function toggleWeekday(d: number) {
    setWeekdays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  const span = Math.max(dayEndMinute - dayStartMinute, 1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-border bg-[#0b0c0d] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold">
            {isEdit ? "Змінити подію" : "Нова подія"}
          </h2>
          <button
            type="button"
            className="min-h-10 px-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            Закрити
          </button>
        </div>

        <form
          action={isEdit ? updateFormAction : createFormAction}
          className="grid flex-1 gap-0 overflow-y-auto lg:grid-cols-[1.2fr_0.9fr]"
        >
          {isEdit ? (
            <>
              <input type="hidden" name="event_id" value={edit!.eventId} />
              <input
                type="hidden"
                name="occurrence_date"
                value={edit!.occurrenceDate}
              />
              <input type="hidden" name="version" value={edit!.version} />
              <input type="hidden" name="scope" value={scope} />
            </>
          ) : null}
          <input type="hidden" name="event_type" value={eventType} />
          <input type="hidden" name="audience" value={audience} />
          <input type="hidden" name="repeat_mode" value={repeatMode} />
          {effectiveWeekdays.map((d) => (
            <input key={d} type="hidden" name="repeat_weekdays" value={d} />
          ))}

          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Назва</Label>
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
                className="min-h-11"
                disabled={pending}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Тип</Label>
              <div className="flex flex-wrap gap-2">
                {TYPE_ORDER.map((t) => (
                  <Chip
                    key={t}
                    active={eventType === t}
                    onClick={() => {
                      setEventType(t);
                      if (t === "shared_work") setAudience("both");
                    }}
                  >
                    {EVENT_TYPE_LABELS[t]}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Для кого</Label>
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={audience === "me"}
                  onClick={() => setAudience("me")}
                >
                  Тільки я
                </Chip>
                <Chip
                  active={audience === "both"}
                  onClick={() => {
                    setAudience("both");
                    setEventType("shared_work");
                  }}
                >
                  Обидва (спільна робота)
                </Chip>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="start_date">Дата</Label>
                <Input
                  id="start_date"
                  name="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="min-h-11"
                  disabled={pending || isEdit}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="start_time">Початок</Label>
                <Input
                  id="start_time"
                  name="start_time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="min-h-11"
                  disabled={pending}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="end_time">Кінець</Label>
                <Input
                  id="end_time"
                  name="end_time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="min-h-11"
                  disabled={pending}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Повторення</Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["none", "Ні"],
                    ["weekly", "Щотижня"],
                    ["biweekly", "Раз на 2 тижні"],
                  ] as const
                ).map(([mode, label]) => (
                  <Chip
                    key={mode}
                    active={repeatMode === mode}
                    onClick={() => setRepeatMode(mode)}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
            </div>

            {repeatMode !== "none" ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label>Дні тижня</Label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_SHORT_UA.map((label, idx) => {
                      const d = idx + 1;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleWeekday(d)}
                          className={cn(
                            "inline-flex size-10 items-center justify-center rounded-full text-sm font-medium",
                            effectiveWeekdays.includes(d)
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground",
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="repeat_until">Повторювати до</Label>
                  <Input
                    id="repeat_until"
                    name="repeat_until"
                    type="date"
                    value={repeatUntil}
                    onChange={(e) => setRepeatUntil(e.target.value)}
                    className="min-h-11"
                    disabled={pending}
                    required
                  />
                </div>
              </>
            ) : (
              <input type="hidden" name="repeat_until" value="" />
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="note">Примітка</Label>
              <Textarea
                id="note"
                name="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-24"
                disabled={pending}
                maxLength={2000}
              />
            </div>

            {isEdit && edit?.isSeries ? (
              <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
                <Label>Що змінити</Label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["this", "Лише ця подія"],
                      ["following", "Ця і наступні"],
                      ["all", "Усі події серії"],
                    ] as const
                  ).map(([s, label]) => (
                    <Chip
                      key={s}
                      active={scope === s}
                      onClick={() => setScope(s)}
                    >
                      {label}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 border-t border-border bg-[#101114] p-4 lg:border-t-0 lg:border-l">
            <div className="rounded-xl border border-border p-3">
              <p className="mb-2 text-sm font-medium">Перевірка</p>
              <p className="text-sm text-muted-foreground">{summary}</p>
              <p className="mt-2 text-sm text-primary">
                {preview ? "Конфліктів немає (чернетка поверх дня)" : "—"}
              </p>
              {preview ? (
                <div className="relative mt-3 h-10 overflow-hidden rounded-lg bg-[#151619]">
                  {preview.shared.map((w) => {
                    const left =
                      ((w.start - dayStartMinute) / span) * 100;
                    const width = ((w.end - w.start) / span) * 100;
                    return (
                      <div
                        key={`${w.start}-${w.end}`}
                        className="absolute top-1 bottom-1 rounded-md border border-dashed border-primary/80 bg-primary/25"
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                    );
                  })}
                  {endMinute > startMinute ? (
                    <div
                      className="absolute top-1 bottom-1 rounded-md bg-primary/70"
                      style={{
                        left: `${((startMinute - dayStartMinute) / span) * 100}%`,
                        width: `${((endMinute - startMinute) / span) * 100}%`,
                      }}
                    />
                  ) : null}
                </div>
              ) : null}
              <p className="mt-2 text-sm text-muted-foreground">
                Найдовше спільне вікно після збереження:{" "}
                <span className="font-medium text-foreground">
                  {preview?.longestShared
                    ? formatInterval(preview.longestShared)
                    : "—"}
                </span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Спільна робота зʼявляється в обох. Особиста подія видима іншому, але
              не змінює його розклад.
            </p>
          </div>

          <div className="col-span-full flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            {state.message ? (
              <p
                className={
                  state.ok ? "text-sm text-primary" : "text-sm text-destructive"
                }
              >
                {state.message}
              </p>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 rounded-xl"
                onClick={onClose}
                disabled={pending}
              >
                Скасувати
              </Button>
              {isEdit ? (
                <Button
                  type="submit"
                  formAction={deleteFormAction}
                  variant="destructive"
                  className="min-h-11 rounded-xl"
                  disabled={pending}
                >
                  Видалити
                </Button>
              ) : null}
              <Button
                type="submit"
                className="min-h-11 rounded-xl"
                disabled={pending}
              >
                {pending ? "Збереження…" : "Зберегти подію"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
