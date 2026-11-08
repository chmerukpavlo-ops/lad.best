/**
 * Period bounds for summary queries.
 * Business dates (completed_on, paid_on) are calendar dates.
 * Interval is half-open [start, end) in Europe/Kyiv local calendar days.
 */

export const SUMMARY_PERIODS = ["today", "week", "month"] as const;
export type SummaryPeriodKey = (typeof SUMMARY_PERIODS)[number];

export type PeriodBounds = {
  key: SummaryPeriodKey;
  label: string;
  /** Inclusive YYYY-MM-DD */
  startDate: string;
  /** Exclusive YYYY-MM-DD */
  endDate: string;
};

/** Today's calendar date in Europe/Kyiv as YYYY-MM-DD. */
export function kyivTodayYmd(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map((p) => Number.parseInt(p, 10));
  return { y, m, d };
}

/** Add whole calendar days to a YMD (UTC noon trick avoided — pure date math). */
export function addCalendarDays(ymd: string, days: number): string {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Monday of the Kyiv week containing `ymd` (ISO-like: Mon start). */
export function startOfKyivWeek(ymd: string): string {
  const { y, m, d } = parseYmd(ymd);
  // Weekday of that calendar day via UTC date (YMD has no TZ).
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  const daysFromMonday = wd === 0 ? 6 : wd - 1;
  return addCalendarDays(ymd, -daysFromMonday);
}

export function startOfMonth(ymd: string): string {
  const { y, m } = parseYmd(ymd);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

export function startOfNextMonth(ymd: string): string {
  const { y, m } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m, 1)); // day 1 of next month
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function parseSummaryPeriod(
  raw: string | null | undefined,
): SummaryPeriodKey {
  if (raw === "week" || raw === "month" || raw === "today") {
    return raw;
  }
  return "today";
}

export function getPeriodBounds(
  key: SummaryPeriodKey,
  now: Date = new Date(),
): PeriodBounds {
  const today = kyivTodayYmd(now);
  if (key === "today") {
    return {
      key,
      label: "Сьогодні",
      startDate: today,
      endDate: addCalendarDays(today, 1),
    };
  }
  if (key === "week") {
    const start = startOfKyivWeek(today);
    return {
      key,
      label: "Тиждень",
      startDate: start,
      endDate: addCalendarDays(start, 7),
    };
  }
  const start = startOfMonth(today);
  return {
    key,
    label: "Місяць",
    startDate: start,
    endDate: startOfNextMonth(today),
  };
}

/** Half-open: start <= date < end */
export function dateInPeriod(
  ymd: string,
  startDate: string,
  endDate: string,
): boolean {
  return ymd >= startDate && ymd < endDate;
}
