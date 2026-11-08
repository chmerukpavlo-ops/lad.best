import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dbAmountToKopiyky,
  formatKopiykyToUah,
  formatUahDisplay,
  parseUahToKopiyky,
  sumKopiyky,
} from "./kopiyky";

describe("parseUahToKopiyky", () => {
  it("parses whole and fractional UAH without float drift", () => {
    const hundred = parseUahToKopiyky("100.10");
    assert.equal(hundred.ok, true);
    if (hundred.ok) {
      assert.equal(hundred.kopiyky, 10010);
    }
    const a = parseUahToKopiyky("70.05");
    const b = parseUahToKopiyky("0.05");
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (a.ok && b.ok) {
      assert.equal(a.kopiyky - b.kopiyky, 7000);
      assert.equal(formatKopiykyToUah(a.kopiyky - b.kopiyky), "70.00");
    }
  });

  it("accepts comma decimal separator", () => {
    const r = parseUahToKopiyky("12,34");
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.kopiyky, 1234);
    }
  });

  it("rejects more than two decimals", () => {
    assert.equal(parseUahToKopiyky("1.234").ok, false);
  });

  it("rejects negative", () => {
    assert.equal(parseUahToKopiyky("-1").ok, false);
  });
});

describe("sumKopiyky / BR example 6 style", () => {
  it("sums 100.10 - 70.05 - 0.05 as exact kopiyky margin 30.00", () => {
    const price = parseUahToKopiyky("100.10");
    const cost = parseUahToKopiyky("70.05");
    const extra = parseUahToKopiyky("0.05");
    assert.ok(price.ok && cost.ok && extra.ok);
    if (price.ok && cost.ok && extra.ok) {
      const margin = price.kopiyky - cost.kopiyky - extra.kopiyky;
      assert.equal(margin, 3000);
      assert.equal(formatKopiykyToUah(margin), "30.00");
    }
  });

  it("sums two ad payments exactly", () => {
    assert.equal(sumKopiyky([30000, 20000]), 50000);
    assert.equal(formatKopiykyToUah(50000), "500.00");
  });
});

describe("dbAmountToKopiyky", () => {
  it("reads numeric strings from DB", () => {
    assert.equal(dbAmountToKopiyky("300.00"), 30000);
    assert.equal(dbAmountToKopiyky("0.01"), 1);
  });
});

describe("formatUahDisplay", () => {
  it("formats with UA decimal comma", () => {
    assert.match(formatUahDisplay(123456), /1\u00a0234,56/);
  });
});
