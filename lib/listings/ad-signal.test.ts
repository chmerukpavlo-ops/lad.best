import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calendarDaysBetween,
  listingAdSignal,
  needsAdPromotion,
} from "./ad-signal";

describe("listingAdSignal", () => {
  it("same-day ad is fresh; next day is due (N=1)", () => {
    const fresh = listingAdSignal({
      status: "active",
      lastAdPaidOn: "2026-11-09",
      todayYmd: "2026-11-09",
      promoteAfterDays: 1,
    });
    assert.equal(fresh.kind, "fresh");
    assert.equal(needsAdPromotion(fresh), false);

    const due = listingAdSignal({
      status: "active",
      lastAdPaidOn: "2026-11-08",
      todayYmd: "2026-11-09",
      promoteAfterDays: 1,
    });
    assert.equal(due.kind, "due");
    assert.equal(needsAdPromotion(due), true);
  });

  it("never advertised → due signal", () => {
    const s = listingAdSignal({
      status: "active",
      lastAdPaidOn: null,
      todayYmd: "2026-11-09",
    });
    assert.equal(s.kind, "never");
    assert.equal(needsAdPromotion(s), true);
  });

  it("archived ignores promote", () => {
    const s = listingAdSignal({
      status: "archived",
      lastAdPaidOn: null,
      todayYmd: "2026-11-09",
    });
    assert.equal(s.kind, "archived");
    assert.equal(needsAdPromotion(s), false);
  });
});

describe("calendarDaysBetween", () => {
  it("counts calendar days", () => {
    assert.equal(calendarDaysBetween("2026-11-08", "2026-11-09"), 1);
    assert.equal(calendarDaysBetween("2026-11-09", "2026-11-09"), 0);
  });
});
