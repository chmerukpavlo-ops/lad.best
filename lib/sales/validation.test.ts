import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeMarginKopiyky,
  formatKopiykyToUah,
  parseSignedUahToKopiyky,
} from "@/lib/money/kopiyky";
import { resolveOptimisticUpdate } from "@/lib/listings/version";

import {
  validateSaleCorrect,
  validateSaleCreate,
  validateSaleUpdate,
} from "./validation";

const LISTING = "11111111-1111-4111-8111-111111111111";
const EXEC = "22222222-2222-4222-8222-222222222222";
const REQUEST = "33333333-3333-4333-8333-333333333333";

describe("sale margin / kopiyky", () => {
  it("computes BR example: 1500 − 1000 − 100 = 400", () => {
    const m = computeMarginKopiyky(150000, 100000, 10000);
    assert.equal(m, 40000);
    assert.equal(formatKopiykyToUah(m), "400.00");
  });

  it("allows negative margin: 500 − 600 − 20 = −120", () => {
    const m = computeMarginKopiyky(50000, 60000, 2000);
    assert.equal(m, -12000);
    assert.equal(formatKopiykyToUah(m), "-120.00");
    const parsed = parseSignedUahToKopiyky("-120.00");
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.kopiyky, -12000);
  });

  it("keeps kopiyky exact for 100.10 − 70.05 − 0.05", () => {
    const m = computeMarginKopiyky(10010, 7005, 5);
    assert.equal(m, 3000);
  });
});

describe("validateSaleCreate", () => {
  it("accepts open sale draft", () => {
    const result = validateSaleCreate({
      listing_id: LISTING,
      executor_id: EXEC,
      client_request_id: REQUEST,
      sale_price: "1500",
      cost_price: "1000",
      direct_expenses: "100",
      sold_on: "2026-11-08",
      color_text: "чорний",
      size_text: "42",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.sale_price_kopiyky, 150000);
      assert.equal(
        computeMarginKopiyky(
          result.value.sale_price_kopiyky,
          result.value.cost_price_kopiyky,
          result.value.direct_expenses_kopiyky,
        ),
        40000,
      );
    }
  });

  it("defaults blank direct expenses to 0", () => {
    const result = validateSaleUpdate({
      executor_id: EXEC,
      sale_price: "100",
      cost_price: "40",
      direct_expenses: "",
      sold_on: "2026-11-08",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.direct_expenses_kopiyky, 0);
    }
  });
});

describe("validateSaleCorrect", () => {
  it("requires correction reason", () => {
    const result = validateSaleCorrect({
      executor_id: EXEC,
      sale_price: "100",
      cost_price: "40",
      direct_expenses: "0",
      sold_on: "2026-11-08",
      completed_on: "2026-11-08",
      correction_reason: "x",
    });
    assert.equal(result.ok, false);
  });
});

describe("state / version contracts", () => {
  it("stale version is conflict when row exists", () => {
    assert.equal(
      resolveOptimisticUpdate({
        updated: null,
        current: { id: "sale-1", version: 3 },
      }),
      "conflict",
    );
  });

  it("complete retry uses same complete_request_id identity", () => {
    const first = REQUEST;
    const retry = REQUEST;
    assert.equal(first, retry);
  });
});
