import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDayPlan, nearestSharedWindow } from "./day-model";
import { expandOccurrences, type CalendarEventRule } from "./recurrence";

const baseRule = (
  over: Partial<CalendarEventRule> & Pick<CalendarEventRule, "id">,
): CalendarEventRule => ({
  ownerId: "a",
  participants: ["a"],
  eventType: "class",
  title: "Пара",
  startDate: "2026-11-09", // Monday
  startMinute: 9 * 60,
  endMinute: 11 * 60,
  repeatFreq: "weekly",
  repeatInterval: 1,
  repeatWeekdays: [1],
  repeatUntil: "2026-12-31",
  ...over,
});

describe("expandOccurrences", () => {
  it("expands weekly Mondays", () => {
    const occs = expandOccurrences(
      baseRule({ id: "e1" }),
      [],
      "2026-11-09",
      "2026-11-23",
    );
    assert.deepEqual(
      occs.map((o) => o.occurrenceDate),
      ["2026-11-09", "2026-11-16", "2026-11-23"],
    );
  });

  it("every 2 weeks from start_date anchor", () => {
    const occs = expandOccurrences(
      baseRule({ id: "e2", repeatInterval: 2 }),
      [],
      "2026-11-09",
      "2026-12-07",
    );
    assert.deepEqual(
      occs.map((o) => o.occurrenceDate),
      ["2026-11-09", "2026-11-23", "2026-12-07"],
    );
  });

  it("applies cancel and time override exceptions", () => {
    const occs = expandOccurrences(
      baseRule({ id: "e3" }),
      [
        {
          eventId: "e3",
          occurrenceDate: "2026-11-16",
          isCancelled: true,
        },
        {
          eventId: "e3",
          occurrenceDate: "2026-11-23",
          isCancelled: false,
          startMinute: 10 * 60,
          endMinute: 12 * 60,
          title: "Пара (перенесено)",
        },
      ],
      "2026-11-09",
      "2026-11-23",
    );
    assert.equal(occs.length, 2);
    assert.equal(occs[0]!.occurrenceDate, "2026-11-09");
    assert.equal(occs[1]!.occurrenceDate, "2026-11-23");
    assert.equal(occs[1]!.startMinute, 600);
    assert.equal(occs[1]!.title, "Пара (перенесено)");
    assert.equal(occs[1]!.isException, true);
  });

  it("none freq is single day only", () => {
    const occs = expandOccurrences(
      baseRule({
        id: "e4",
        repeatFreq: "none",
        repeatWeekdays: null,
        repeatUntil: null,
      }),
      [],
      "2026-11-01",
      "2026-11-30",
    );
    assert.equal(occs.length, 1);
    assert.equal(occs[0]!.occurrenceDate, "2026-11-09");
  });
});

describe("day-model shared windows", () => {
  it("shared = intersection of free after busy", () => {
    const plan = buildDayPlan({
      ymd: "2026-11-11", // Wed
      memberIds: ["u1", "u2"],
      rules: [
        { memberId: "u1", weekday: 3, startMinute: 480, endMinute: 1320 },
        { memberId: "u2", weekday: 3, startMinute: 480, endMinute: 1320 },
      ],
      eventRules: [
        {
          id: "c1",
          ownerId: "u1",
          participants: ["u1"],
          eventType: "class",
          title: "Пара",
          startDate: "2026-11-11",
          startMinute: 540,
          endMinute: 660,
          repeatFreq: "none",
          repeatInterval: 1,
          repeatWeekdays: null,
          repeatUntil: null,
        },
        {
          id: "w1",
          ownerId: "u2",
          participants: ["u2"],
          eventType: "work",
          title: "Робота",
          startDate: "2026-11-11",
          startMinute: 600,
          endMinute: 780,
          repeatFreq: "none",
          repeatInterval: 1,
          repeatWeekdays: null,
          repeatUntil: null,
        },
      ],
      exceptions: [],
      minSharedMinutes: 60,
    });

    // u1 free: 480-540, 660-1320; u2 free: 480-600, 780-1320
    // shared ≥60: 480-540 (60), 780-1320
    assert.deepEqual(plan.shared, [
      { start: 480, end: 540 },
      { start: 780, end: 1320 },
    ]);
    assert.deepEqual(plan.longestShared, { start: 780, end: 1320 });
  });

  it("personal event of A does not busy B", () => {
    const plan = buildDayPlan({
      ymd: "2026-11-11",
      memberIds: ["u1", "u2"],
      rules: [
        { memberId: "u1", weekday: 3, startMinute: 480, endMinute: 1320 },
        { memberId: "u2", weekday: 3, startMinute: 480, endMinute: 1320 },
      ],
      eventRules: [
        {
          id: "p1",
          ownerId: "u1",
          participants: ["u1"],
          eventType: "personal",
          title: "Особисте",
          startDate: "2026-11-11",
          startMinute: 600,
          endMinute: 720,
          repeatFreq: "none",
          repeatInterval: 1,
          repeatWeekdays: null,
          repeatUntil: null,
        },
      ],
      exceptions: [],
    });
    assert.deepEqual(plan.members[1]!.busy, []);
    assert.ok(plan.shared.some((w) => w.start === 480 && w.end === 600));
  });

  it("fallbackWindow expands shared beyond seeded rules", () => {
    const plan = buildDayPlan({
      ymd: "2026-11-11",
      memberIds: ["u1", "u2"],
      rules: [
        { memberId: "u1", weekday: 3, startMinute: 480, endMinute: 1320 },
        { memberId: "u2", weekday: 3, startMinute: 480, endMinute: 1320 },
      ],
      eventRules: [],
      exceptions: [],
      fallbackWindow: { start: 480, end: 1440 },
      minSharedMinutes: 60,
    });
    assert.deepEqual(plan.shared, [{ start: 480, end: 1440 }]);
  });

  it("nearestSharedWindow finds later day", () => {
    const hit = nearestSharedWindow({
      fromYmd: "2026-11-11",
      fromMinute: 1300,
      daysAhead: 3,
      memberIds: ["u1", "u2"],
      rules: [
        { memberId: "u1", weekday: 3, startMinute: 480, endMinute: 1320 },
        { memberId: "u2", weekday: 3, startMinute: 480, endMinute: 1320 },
        { memberId: "u1", weekday: 4, startMinute: 480, endMinute: 1320 },
        { memberId: "u2", weekday: 4, startMinute: 480, endMinute: 1320 },
      ],
      eventRules: [],
      exceptions: [],
      minSharedMinutes: 60,
    });
    assert.ok(hit);
    assert.equal(hit!.ymd, "2026-11-12");
    assert.deepEqual(hit!.window, { start: 480, end: 1320 });
  });
});
