/**
 * Pure interval math for one local day.
 * Times are minutes from local midnight; intervals are half-open [start, end).
 */

export type LocalInterval = { start: number; end: number };

export const DEFAULT_MIN_SHARED_MINUTES = 60;

export function mergeLocal(xs: readonly LocalInterval[]): LocalInterval[] {
  const sorted = xs
    .filter((x) => x.end > x.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const out: LocalInterval[] = [];
  for (const x of sorted) {
    const last = out[out.length - 1];
    if (last && x.start <= last.end) {
      last.end = Math.max(last.end, x.end);
    } else {
      out.push({ ...x });
    }
  }
  return out;
}

/** base minus busy */
export function subtractLocal(
  base: readonly LocalInterval[],
  busy: readonly LocalInterval[],
): LocalInterval[] {
  const b = mergeLocal(busy);
  const out: LocalInterval[] = [];
  for (const a of mergeLocal(base)) {
    let cur = a.start;
    for (const x of b) {
      if (x.end <= cur || x.start >= a.end) continue;
      if (x.start > cur) out.push({ start: cur, end: x.start });
      cur = Math.max(cur, x.end);
    }
    if (cur < a.end) out.push({ start: cur, end: a.end });
  }
  return out;
}

export function intersectLocal(
  a: readonly LocalInterval[],
  b: readonly LocalInterval[],
): LocalInterval[] {
  const A = mergeLocal(a);
  const B = mergeLocal(b);
  const out: LocalInterval[] = [];
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    const start = Math.max(A[i]!.start, B[j]!.start);
    const end = Math.min(A[i]!.end, B[j]!.end);
    if (end > start) out.push({ start, end });
    if (A[i]!.end < B[j]!.end) i++;
    else j++;
  }
  return out;
}

/** Intersection of free time, keeping windows at least minMinutes long. */
export function sharedWindows(
  freeA: readonly LocalInterval[],
  freeB: readonly LocalInterval[],
  minMinutes: number = DEFAULT_MIN_SHARED_MINUTES,
): LocalInterval[] {
  return intersectLocal(freeA, freeB).filter(
    (w) => w.end - w.start >= minMinutes,
  );
}

export function longestWindow(
  windows: readonly LocalInterval[],
): LocalInterval | null {
  let best: LocalInterval | null = null;
  for (const w of mergeLocal(windows)) {
    if (!best || w.end - w.start > best.end - best.start) best = w;
  }
  return best;
}

/** Next window that ends after `fromMinute`, clipped to start at fromMinute if overlapping. */
export function nearestWindowFrom(
  windows: readonly LocalInterval[],
  fromMinute: number,
): LocalInterval | null {
  for (const w of mergeLocal(windows)) {
    if (w.end <= fromMinute) continue;
    if (w.start >= fromMinute) return w;
    return { start: fromMinute, end: w.end };
  }
  return null;
}
