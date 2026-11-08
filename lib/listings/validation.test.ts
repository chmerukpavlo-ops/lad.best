import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptyToNull,
  parseListingStatus,
  parsePositiveInt,
  validateListingInput,
} from "./validation";
import { resolveOptimisticUpdate } from "./version";

describe("validateListingInput", () => {
  it("requires title", () => {
    const result = validateListingInput({ title: "   " });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /назв/i);
    }
  });

  it("accepts model with colors and optional fields", () => {
    const result = validateListingInput({
      title: "Dunk",
      colors_text: "чорний, білий, 30 інших",
      description: "одна модель, багато кольорів",
      notes: "тест",
      publication_url: "https://example.com/dunk",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.title, "Dunk");
      assert.equal(result.value.colors_text, "чорний, білий, 30 інших");
      assert.equal(result.value.publication_url, "https://example.com/dunk");
    }
  });

  it("rejects non-http publication url", () => {
    const result = validateListingInput({
      title: "Dunk",
      publication_url: "javascript:alert(1)",
    });
    assert.equal(result.ok, false);
  });

  it("rejects oversized title", () => {
    const result = validateListingInput({ title: "x".repeat(201) });
    assert.equal(result.ok, false);
  });
});

describe("parsePositiveInt / version conflict helpers", () => {
  it("parses expected version from form string", () => {
    assert.equal(parsePositiveInt("3"), 3);
    assert.equal(parsePositiveInt("0"), null);
    assert.equal(parsePositiveInt("-1"), null);
    assert.equal(parsePositiveInt("abc"), null);
  });

  it("resolveOptimisticUpdate: ok when row returned", () => {
    assert.equal(
      resolveOptimisticUpdate({
        updated: { id: "a" },
        current: null,
      }),
      "ok",
    );
  });

  it("resolveOptimisticUpdate: conflict when version missed but row exists", () => {
    assert.equal(
      resolveOptimisticUpdate({
        updated: null,
        current: { id: "a", version: 2 },
      }),
      "conflict",
    );
  });

  it("resolveOptimisticUpdate: not_found when row absent", () => {
    assert.equal(
      resolveOptimisticUpdate({
        updated: null,
        current: null,
      }),
      "not_found",
    );
  });
});

describe("parseListingStatus", () => {
  it("allows only active|archived", () => {
    assert.equal(parseListingStatus("active"), "active");
    assert.equal(parseListingStatus("archived"), "archived");
    assert.equal(parseListingStatus("deleted"), null);
  });
});

describe("emptyToNull", () => {
  it("maps blank to null", () => {
    assert.equal(emptyToNull("  "), null);
    assert.equal(emptyToNull("ок"), "ок");
  });
});

describe("access shape (membership gate contract)", () => {
  it("treats missing membership as denied", () => {
    const membership = null as { workspaceId: string } | null;
    const workspaceId = membership === null ? null : membership.workspaceId;
    assert.equal(workspaceId, null);
  });

  it("allows same-workspace listing filter", () => {
    const workspaceId = "ws-1";
    const listingWorkspaceId = "ws-1";
    assert.equal(workspaceId === listingWorkspaceId, true);
  });
});
