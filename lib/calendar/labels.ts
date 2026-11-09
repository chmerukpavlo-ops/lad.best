import type { CalendarEventType } from "./recurrence";
import { hhMmFromMinute } from "./kyiv";
import type { LocalInterval } from "./local-intervals";

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  class: "Пара",
  work: "Робота",
  shared_work: "Спільна робота",
  free: "Вільний час",
  personal: "Особисте",
};

export const WEEKDAY_SHORT_UA = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"] as const;

export function formatLocalRange(start: number, end: number): string {
  return `${hhMmFromMinute(start)}–${hhMmFromMinute(end)}`;
}

export function formatInterval(w: LocalInterval): string {
  return formatLocalRange(w.start, w.end);
}

export function recurrenceSummaryUa(args: {
  repeatFreq: "none" | "weekly";
  repeatInterval: number;
  weekdays: number[];
  startMinute: number;
  endMinute: number;
  repeatUntil: string | null;
}): string {
  const time = formatLocalRange(args.startMinute, args.endMinute);
  if (args.repeatFreq === "none") {
    return `Один раз, ${time}`;
  }
  const days = args.weekdays
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_SHORT_UA[d - 1] ?? String(d))
    .join(", ")
    .toLowerCase();
  const freq =
    args.repeatInterval === 2 ? "Раз на 2 тижні" : "Щотижня";
  const until = args.repeatUntil
    ? `, до ${args.repeatUntil.split("-").reverse().join(".")}`
    : "";
  return `${freq}, ${days}, ${time}${until}`;
}
