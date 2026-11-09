/** Pure calendar-date helpers (YYYY-MM-DD), no timezone. */

export function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map((p) => Number.parseInt(p, 10));
  return { y, m, d };
}

export function formatYmd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return formatYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** ISO weekday 1=Mon .. 7=Sun for a calendar YMD. */
export function isoWeekday(ymd: string): number {
  const { y, m, d } = parseYmd(ymd);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  return wd === 0 ? 7 : wd;
}

/** Monday of the week containing ymd. */
export function mondayOf(ymd: string): string {
  return addDaysYmd(ymd, -(isoWeekday(ymd) - 1));
}

/** Whole weeks between Monday(a) and Monday(b); can be negative. */
export function weeksBetweenMondays(fromYmd: string, toYmd: string): number {
  const a = mondayOf(fromYmd);
  const b = mondayOf(toYmd);
  const { y: y1, m: m1, d: d1 } = parseYmd(a);
  const { y: y2, m: m2, d: d2 } = parseYmd(b);
  const ms =
    Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1);
  return Math.round(ms / (7 * 24 * 60 * 60 * 1000));
}

export function compareYmd(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function maxYmd(a: string, b: string): string {
  return a >= b ? a : b;
}

export function minYmd(a: string, b: string): string {
  return a <= b ? a : b;
}
