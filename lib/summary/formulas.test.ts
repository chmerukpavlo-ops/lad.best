import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeMarginKopiyky } from "@/lib/money/kopiyky";

import { listingLifetime, periodSummary } from "./formulas";
import {
  addCalendarDays,
  dateInPeriod,
  getPeriodBounds,
  startOfKyivWeek,
  startOfMonth,
  startOfNextMonth,
} from "./period";
import { hasTestMarker } from "./test-markers";

describe("listingLifetime BR §3", () => {
  it("example 1: ads 300, margin 400 → result 100, uncovered 0", () => {
    const m = computeMarginKopiyky(150000, 100000, 10000);
    const life = listingLifetime([m], [30000]);
    assert.equal(life.marginKopiyky, 40000);
    assert.equal(life.adsKopiyky, 30000);
    assert.equal(life.resultKopiyky, 10000);
    assert.equal(life.uncoveredAdsKopiyky, 0);
  });

  it("example 2: ads 500, margin 200 → result −300, uncovered 300", () => {
    const m = computeMarginKopiyky(100000, 70000, 10000);
    const life = listingLifetime([m], [50000]);
    assert.equal(life.resultKopiyky, -30000);
    assert.equal(life.uncoveredAdsKopiyky, 30000);
  });

  it("counts each ad amount once (no double spend)", () => {
    const life = listingLifetime([40000, 10000], [30000]);
    assert.equal(life.adsKopiyky, 30000);
    assert.equal(life.marginKopiyky, 50000);
    assert.equal(life.resultKopiyky, 20000);
  });

  it("void ads omitted by caller → not in A_L", () => {
    const life = listingLifetime([40000], []); // void excluded upstream
    assert.equal(life.adsKopiyky, 0);
    assert.equal(life.resultKopiyky, 40000);
  });
});

describe("periodSummary BR §4", () => {
  it("result = margin − ads; revenue from completed only", () => {
    const p = periodSummary({
      completedSalePrices: [150000, 100000],
      completedMargins: [40000, 20000],
      validAdAmounts: [30000],
    });
    assert.equal(p.completedCount, 2);
    assert.equal(p.revenueKopiyky, 250000);
    assert.equal(p.marginKopiyky, 60000);
    assert.equal(p.adsKopiyky, 30000);
    assert.equal(p.resultKopiyky, 30000);
  });

  it("example 7 style: Jan ads vs Feb margin stay separate periods", () => {
    const jan = periodSummary({
      completedSalePrices: [],
      completedMargins: [],
      validAdAmounts: [30000],
    });
    const feb = periodSummary({
      completedSalePrices: [150000],
      completedMargins: [40000],
      validAdAmounts: [],
    });
    assert.equal(jan.resultKopiyky, -30000);
    assert.equal(feb.resultKopiyky, 40000);
    const life = listingLifetime([40000], [30000]);
    assert.equal(life.resultKopiyky, 10000);
  });
});

describe("period bounds [start,end)", () => {
  it("dateInPeriod half-open", () => {
    assert.equal(dateInPeriod("2026-11-08", "2026-11-08", "2026-11-09"), true);
    assert.equal(dateInPeriod("2026-11-09", "2026-11-08", "2026-11-09"), false);
  });

  it("week starts Monday", () => {
    // 2026-11-08 is Sunday → week start 2026-11-02
    assert.equal(startOfKyivWeek("2026-11-08"), "2026-11-02");
    assert.equal(addCalendarDays("2026-11-02", 7), "2026-11-09");
  });

  it("month bounds", () => {
    assert.equal(startOfMonth("2026-11-08"), "2026-11-01");
    assert.equal(startOfNextMonth("2026-11-08"), "2026-12-01");
  });

  it("getPeriodBounds today is one day", () => {
    const b = getPeriodBounds("today", new Date("2026-11-08T12:00:00+02:00"));
    assert.equal(b.endDate, addCalendarDays(b.startDate, 1));
  });
});

describe("test markers", () => {
  it("detects [TEST Gate3]", () => {
    assert.equal(hasTestMarker("[TEST Gate3] x"), true);
    assert.equal(hasTestMarker("Samba Gate2"), false);
  });
});
