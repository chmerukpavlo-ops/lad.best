import { addCalendarDays, kyivTodayYmd } from "@/lib/summary/period";

/** Days after last valid ad payment before «пора рекламувати». */
export const AD_PROMOTE_AFTER_DAYS = 1;

export type ListingAdSignalKind = "archived" | "fresh" | "due" | "never";

export type ListingAdSignal = {
  kind: ListingAdSignalKind;
  /** Short label for badge / table */
  label: string;
  lastAdPaidOn: string | null;
};

function formatDayShort(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${d}.${m}`;
}

/** Calendar-day difference toYmd - fromYmd (can be negative). */
export function calendarDaysBetween(fromYmd: string, toYmd: string): number {
  const [y1, m1, d1] = fromYmd.split("-").map((p) => Number.parseInt(p, 10));
  const [y2, m2, d2] = toYmd.split("-").map((p) => Number.parseInt(p, 10));
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86_400_000);
}

export function listingAdSignal(args: {
  status: "active" | "archived";
  lastAdPaidOn: string | null;
  todayYmd?: string;
  promoteAfterDays?: number;
}): ListingAdSignal {
  const today = args.todayYmd ?? kyivTodayYmd();
  const n = args.promoteAfterDays ?? AD_PROMOTE_AFTER_DAYS;

  if (args.status === "archived") {
    return {
      kind: "archived",
      label: "Архів",
      lastAdPaidOn: args.lastAdPaidOn,
    };
  }

  if (!args.lastAdPaidOn) {
    return {
      kind: "never",
      label: "Пора рекламувати",
      lastAdPaidOn: null,
    };
  }

  const days = calendarDaysBetween(args.lastAdPaidOn, today);
  if (days >= n) {
    return {
      kind: "due",
      label: `Пора рекламувати · було ${formatDayShort(args.lastAdPaidOn)}`,
      lastAdPaidOn: args.lastAdPaidOn,
    };
  }

  return {
    kind: "fresh",
    label: `Реклама · ${formatDayShort(args.lastAdPaidOn)}`,
    lastAdPaidOn: args.lastAdPaidOn,
  };
}

/** Cutoff YMD: ads on or after this date count as fresh. */
export function adFreshSinceYmd(
  todayYmd: string = kyivTodayYmd(),
  promoteAfterDays: number = AD_PROMOTE_AFTER_DAYS,
): string {
  return addCalendarDays(todayYmd, -(promoteAfterDays - 1));
}

export function needsAdPromotion(signal: ListingAdSignal): boolean {
  return signal.kind === "due" || signal.kind === "never";
}
