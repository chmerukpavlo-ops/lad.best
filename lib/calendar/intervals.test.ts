import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  intersectIntervals,
  nextIntervalFrom,
  participantDayAvailability,
  sharedAvailability,
  subtractBusy,
} from "./intervals";
import { kyivLocalToUtcMs, kyivOffsetMinutesAt, workWindowForKyivDay } from "./kyiv";

describe("busy over free", () => {
  it("subtracts busy from free", () => {
    const free = [{ start: 0, end: 100 }];
    const busy = [{ start: 20, end: 40 }];
    assert.deepEqual(subtractBusy(free, busy), [
      { start: 0, end: 20 },
      { start: 40, end: 100 },
    ]);
  });
});

describe("shared = intersection", () => {
  it("intersects two participants", () => {
    const a = [
      { start: 0, end: 50 },
      { start: 60, end: 90 },
    ];
    const b = [{ start: 40, end: 80 }];
    assert.deepEqual(intersectIntervals(a, b), [
      { start: 40, end: 50 },
      { start: 60, end: 80 },
    ]);
    assert.deepEqual(sharedAvailability(a, b), intersectIntervals(a, b));
  });
});

describe("empty availability", () => {
  it("no free marks → empty day (not whole work window)", () => {
    const work = { start: 0, end: 100 };
    assert.deepEqual(
      participantDayAvailability({ workWindow: work, free: [], busy: [] }),
      [],
    );
    assert.deepEqual(
      participantDayAvailability({
        workWindow: work,
        free: [],
        busy: [{ start: 10, end: 20 }],
      }),
      [],
    );
  });

  it("free outside work window yields empty after clip", () => {
    const work = { start: 50, end: 100 };
    assert.deepEqual(
      participantDayAvailability({
        workWindow: work,
        free: [{ start: 0, end: 40 }],
        busy: [],
      }),
      [],
    );
  });
});

describe("time bounds / DST Kyiv", () => {
  it("summer vs winter offset differ (DST)", () => {
    const winter = kyivLocalToUtcMs("2026-01-15", 12 * 60);
    const summer = kyivLocalToUtcMs("2026-07-15", 12 * 60);
    assert.equal(kyivOffsetMinutesAt(winter), 120);
    assert.equal(kyivOffsetMinutesAt(summer), 180);
    // Same wall clock → summer UTC instant is 1h earlier than winter offset would imply
    assert.equal(summer % 86400000, (winter % 86400000) - 3600000);
  });

  it("work window 08–22 Kyiv is 14h", () => {
    const w = workWindowForKyivDay("2026-11-08", 480, 1320);
    assert.equal(w.end - w.start, 14 * 60 * 60 * 1000);
  });

  it("nextIntervalFrom skips past", () => {
    const next = nextIntervalFrom(
      [
        { start: 0, end: 10 },
        { start: 20, end: 30 },
      ],
      15,
    );
    assert.deepEqual(next, { start: 20, end: 30 });
  });
});
