import type { CalendarEventType, RepeatFreq } from "./recurrence";
import { isoWeekday } from "./ymd";
import { minuteOfDayFromHhMm } from "./kyiv";

const TYPES: CalendarEventType[] = [
  "class",
  "work",
  "shared_work",
  "free",
  "personal",
];

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export type ParsedEventInput = {
  title: string;
  note: string | null;
  eventType: CalendarEventType;
  audience: "me" | "both";
  startDate: string;
  startMinute: number;
  endMinute: number;
  repeatFreq: RepeatFreq;
  repeatInterval: number;
  repeatWeekdays: number[] | null;
  repeatUntil: string | null;
};

export function parseEventType(raw: unknown): CalendarEventType | null {
  const v = asTrimmed(raw);
  return TYPES.includes(v as CalendarEventType)
    ? (v as CalendarEventType)
    : null;
}

export function validateCalendarEventInput(raw: {
  title?: unknown;
  note?: unknown;
  event_type?: unknown;
  audience?: unknown;
  start_date?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  repeat_mode?: unknown;
  repeat_weekdays?: unknown;
  repeat_until?: unknown;
}): { ok: true; value: ParsedEventInput } | { ok: false; message: string } {
  const title = asTrimmed(raw.title);
  const noteRaw = asTrimmed(raw.note);
  let eventType = parseEventType(raw.event_type);
  const audienceRaw = asTrimmed(raw.audience);
  const audience =
    audienceRaw === "both" ? "both" : audienceRaw === "me" ? "me" : null;
  const startDate = asTrimmed(raw.start_date);
  const startMinute = minuteOfDayFromHhMm(asTrimmed(raw.start_time));
  const endMinute = minuteOfDayFromHhMm(asTrimmed(raw.end_time));
  const repeatMode = asTrimmed(raw.repeat_mode); // none | weekly | biweekly
  const repeatUntil = asTrimmed(raw.repeat_until) || null;

  if (!title || title.length > 200) {
    return { ok: false, message: "Вкажіть назву (до 200 символів)." };
  }
  if (!eventType) {
    return { ok: false, message: "Оберіть тип події." };
  }
  if (!audience) {
    return { ok: false, message: "Оберіть «для кого»." };
  }
  if (!isYmd(startDate)) {
    return { ok: false, message: "Некоректна дата." };
  }
  if (startMinute == null || endMinute == null) {
    return { ok: false, message: "Час у форматі ГГ:ХХ." };
  }
  if (endMinute <= startMinute) {
    return { ok: false, message: "Кінець має бути пізніше за початок (без переходу через північ)." };
  }
  if (noteRaw.length > 2000) {
    return { ok: false, message: "Примітка занадто довга." };
  }

  if (audience === "both") {
    eventType = "shared_work";
  } else if (eventType === "shared_work") {
    eventType = "work";
  }

  let repeatFreq: RepeatFreq = "none";
  let repeatInterval = 1;
  let repeatWeekdays: number[] | null = null;

  if (repeatMode === "weekly" || repeatMode === "biweekly") {
    repeatFreq = "weekly";
    repeatInterval = repeatMode === "biweekly" ? 2 : 1;
    const daysRaw = Array.isArray(raw.repeat_weekdays)
      ? raw.repeat_weekdays
      : typeof raw.repeat_weekdays === "string"
        ? raw.repeat_weekdays.split(",")
        : [];
    const days = [
      ...new Set(
        daysRaw
          .map((d) => Number.parseInt(String(d), 10))
          .filter((d) => d >= 1 && d <= 7),
      ),
    ].sort((a, b) => a - b);
    repeatWeekdays = days.length > 0 ? days : [isoWeekday(startDate)];
    if (!repeatUntil || !isYmd(repeatUntil)) {
      return { ok: false, message: "Для повторення вкажіть «Повторювати до»." };
    }
    if (repeatUntil < startDate) {
      return { ok: false, message: "Дата завершення не може бути раніше початку." };
    }
  } else if (repeatMode && repeatMode !== "none") {
    return { ok: false, message: "Невідомий режим повторення." };
  }

  return {
    ok: true,
    value: {
      title,
      note: noteRaw || null,
      eventType,
      audience,
      startDate,
      startMinute,
      endMinute,
      repeatFreq,
      repeatInterval,
      repeatWeekdays,
      repeatUntil: repeatFreq === "none" ? null : repeatUntil,
    },
  };
}

export function parseEditScope(
  raw: unknown,
): "this" | "following" | "all" | null {
  const v = asTrimmed(raw);
  if (v === "this" || v === "following" || v === "all") return v;
  return null;
}

export { isUuid, isYmd, asTrimmed };
