import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  longestWindow,
  nearestWindowFrom,
  sharedWindows,
  subtractLocal,
} from "./local-intervals";

describe("subtractLocal", () => {
  it("cuts busy out of availability", () => {
    assert.deepEqual(
      subtractLocal([{ start: 480, end: 1320 }], [{ start: 600, end: 720 }]),
      [
        { start: 480, end: 600 },
        { start: 720, end: 1320 },
      ],
    );
  });
});

describe("sharedWindows", () => {
  it("intersects and drops short windows", () => {
    const a = [
      { start: 480, end: 600 },
      { start: 720, end: 900 },
    ];
    const b = [{ start: 540, end: 800 }];
    assert.deepEqual(sharedWindows(a, b, 60), [
      { start: 540, end: 600 },
      { start: 720, end: 800 },
    ]);
    assert.deepEqual(sharedWindows(a, b, 70), [{ start: 720, end: 800 }]);
  });
});

describe("nearest / longest", () => {
  it("nearestWindowFrom clips current window", () => {
    assert.deepEqual(
      nearestWindowFrom(
        [
          { start: 480, end: 600 },
          { start: 720, end: 900 },
        ],
        550,
      ),
      { start: 550, end: 600 },
    );
  });

  it("longestWindow picks max duration", () => {
    assert.deepEqual(
      longestWindow([
        { start: 0, end: 30 },
        { start: 100, end: 200 },
      ]),
      { start: 100, end: 200 },
    );
  });
});
