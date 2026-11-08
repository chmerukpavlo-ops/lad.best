/** Half-open intervals [start, end) in UTC epoch ms. */

export type MsInterval = { start: number; end: number };

export function normalizeIntervals(raw: readonly MsInterval[]): MsInterval[] {
  const sorted = [...raw]
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (sorted.length === 0) return [];
  const out: MsInterval[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = out[out.length - 1]!;
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/** free minus busy; busy wins overlaps. */
export function subtractBusy(
  free: readonly MsInterval[],
  busy: readonly MsInterval[],
): MsInterval[] {
  let result = normalizeIntervals(free);
  const busyNorm = normalizeIntervals(busy);
  for (const b of busyNorm) {
    const next: MsInterval[] = [];
    for (const f of result) {
      if (b.end <= f.start || b.start >= f.end) {
        next.push(f);
        continue;
      }
      if (b.start > f.start) {
        next.push({ start: f.start, end: b.start });
      }
      if (b.end < f.end) {
        next.push({ start: b.end, end: f.end });
      }
    }
    result = next;
  }
  return result.filter((i) => i.end > i.start);
}

export function intersectIntervals(
  a: readonly MsInterval[],
  b: readonly MsInterval[],
): MsInterval[] {
  const left = normalizeIntervals(a);
  const right = normalizeIntervals(b);
  const out: MsInterval[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const x = left[i]!;
    const y = right[j]!;
    const start = Math.max(x.start, y.start);
    const end = Math.min(x.end, y.end);
    if (end > start) {
      out.push({ start, end });
    }
    if (x.end < y.end) i++;
    else j++;
  }
  return out;
}

export function clipToWindow(
  intervals: readonly MsInterval[],
  window: MsInterval,
): MsInterval[] {
  return normalizeIntervals(intervals)
    .map((i) => ({
      start: Math.max(i.start, window.start),
      end: Math.min(i.end, window.end),
    }))
    .filter((i) => i.end > i.start);
}

/**
 * Participant availability for a day:
 * - no free marks → empty (NOT whole day)
 * - free clipped to work window, then busy subtracted
 */
export function participantDayAvailability(args: {
  workWindow: MsInterval;
  free: readonly MsInterval[];
  busy: readonly MsInterval[];
}): MsInterval[] {
  if (args.free.length === 0) {
    return [];
  }
  const freeInWork = clipToWindow(args.free, args.workWindow);
  return subtractBusy(freeInWork, args.busy);
}

export function sharedAvailability(
  a: readonly MsInterval[],
  b: readonly MsInterval[],
): MsInterval[] {
  return intersectIntervals(a, b);
}

/** Next interval starting at or after `fromMs`. */
export function nextIntervalFrom(
  intervals: readonly MsInterval[],
  fromMs: number,
): MsInterval | null {
  for (const i of normalizeIntervals(intervals)) {
    if (i.end <= fromMs) continue;
    if (i.start >= fromMs) return i;
    return { start: fromMs, end: i.end };
  }
  return null;
}
