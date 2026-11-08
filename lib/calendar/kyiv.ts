const TZ = "Europe/Kyiv";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Offset of Europe/Kyiv at a UTC instant, in minutes east of UTC. */
export function kyivOffsetMinutesAt(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(new Date(utcMs));
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = name.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) {
    return 120;
  }
  const sign = match[1] === "-" ? -1 : 1;
  const hh = Number(match[2]);
  const mm = Number(match[3] ?? "0");
  return sign * (hh * 60 + mm);
}

/** Convert Kyiv wall-clock YMD + minute-of-day → UTC epoch ms. Handles DST. */
export function kyivLocalToUtcMs(ymd: string, minuteOfDay: number): number {
  const [y, m, d] = ymd.split("-").map((p) => Number.parseInt(p, 10));
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const asUtc = Date.UTC(y, m - 1, d, hour, minute, 0);
  let utc = asUtc - kyivOffsetMinutesAt(asUtc) * 60_000;
  utc = asUtc - kyivOffsetMinutesAt(utc) * 60_000;
  return utc;
}

export function utcMsToKyivYmd(utcMs: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(utcMs));
}

export function formatKyivTime(utcMs: number): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(utcMs));
}

export function formatKyivRange(startMs: number, endMs: number): string {
  return `${formatKyivTime(startMs)}–${formatKyivTime(endMs)}`;
}

export function workWindowForKyivDay(
  ymd: string,
  dayStartMinute: number,
  dayEndMinute: number,
): { start: number; end: number } {
  return {
    start: kyivLocalToUtcMs(ymd, dayStartMinute),
    end: kyivLocalToUtcMs(ymd, dayEndMinute),
  };
}

export function minuteOfDayFromHhMm(value: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function hhMmFromMinute(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

/** Parse datetime-local-ish `YYYY-MM-DDTHH:mm` as Kyiv wall time → UTC ms. */
export function parseKyivDateTimeLocal(raw: string): number | null {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const ymd = m[1]!;
  const minute = Number(m[2]) * 60 + Number(m[3]);
  if (minute < 0 || minute >= 1440) return null;
  return kyivLocalToUtcMs(ymd, minute);
}
