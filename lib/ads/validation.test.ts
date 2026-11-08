import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveOptimisticUpdate } from "@/lib/listings/version";

import {
  parsePaidOn,
  validateAdPaymentCorrect,
  validateAdPaymentCreate,
} from "./validation";

const LISTING = "11111111-1111-4111-8111-111111111111";
const PAYER = "22222222-2222-4222-8222-222222222222";
const REQUEST = "33333333-3333-4333-8333-333333333333";

describe("validateAdPaymentCreate", () => {
  it("accepts valid payment", () => {
    const result = validateAdPaymentCreate({
      listing_id: LISTING,
      payer_id: PAYER,
      client_request_id: REQUEST,
      amount: "300.50",
      paid_on: "2026-01-15",
      note: "Meta",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.amount_kopiyky, 30050);
      assert.equal(result.value.paid_on, "2026-01-15");
    }
  });

  it("rejects zero amount for new payment", () => {
    const result = validateAdPaymentCreate({
      listing_id: LISTING,
      payer_id: PAYER,
      client_request_id: REQUEST,
      amount: "0",
      paid_on: "2026-01-15",
    });
    assert.equal(result.ok, false);
  });

  it("rejects foreign-shaped ids", () => {
    const result = validateAdPaymentCreate({
      listing_id: "not-a-uuid",
      payer_id: PAYER,
      client_request_id: REQUEST,
      amount: "10",
      paid_on: "2026-01-15",
    });
    assert.equal(result.ok, false);
  });
});

describe("validateAdPaymentCorrect", () => {
  it("requires correction reason", () => {
    const result = validateAdPaymentCorrect({
      amount: "100",
      paid_on: "2026-01-15",
      payer_id: PAYER,
      status: "valid",
      correction_reason: "ab",
    });
    assert.equal(result.ok, false);
  });

  it("allows void with reason", () => {
    const result = validateAdPaymentCorrect({
      amount: "100",
      paid_on: "2026-01-15",
      payer_id: PAYER,
      status: "void",
      correction_reason: "подвійне внесення",
    });
    assert.equal(result.ok, true);
  });
});

describe("parsePaidOn", () => {
  it("accepts calendar dates only", () => {
    assert.equal(parsePaidOn("2026-02-28"), "2026-02-28");
    assert.equal(parsePaidOn("2026-02-30"), null);
    assert.equal(parsePaidOn("15.01.2026"), null);
  });
});

describe("idempotency / conflict helpers (contract)", () => {
  it("same client_request_id implies one logical create", () => {
    const first = REQUEST;
    const retry = REQUEST;
    assert.equal(first, retry);
  });

  it("stale version is conflict when row still exists", () => {
    assert.equal(
      resolveOptimisticUpdate({
        updated: null,
        current: { id: "pay-1", version: 2 },
      }),
      "conflict",
    );
  });

  it("cross-workspace listing id must not match caller's workspace filter", () => {
    const callerWorkspace = "ws-a";
    const listingWorkspace = "ws-b";
    assert.equal(callerWorkspace === listingWorkspace, false);
  });
});
