import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { importNextAction } from "../src/lib/importNextAction.js";

describe("importNextAction", () => {
  it("prioritises fill phones when majority lack dialable numbers", () => {
    const next = importNextAction({
      importedCount: 10,
      missingPhone: 8,
      missingEmail: 5,
      numbersCount: 2,
      campaignId: "c1",
      listId: "l1",
    });
    assert.equal(next.id, "fill_phones");
    assert.equal(next.action, "fill_phones");
    assert.equal(next.secondary.action, "scroll_grow");
  });

  it("prioritises emails when phones are mostly filled", () => {
    const next = importNextAction({
      importedCount: 10,
      missingPhone: 2,
      missingEmail: 7,
      numbersCount: 8,
      listId: "l1",
    });
    assert.equal(next.id, "fill_emails");
    assert.equal(next.action, "fill_emails");
  });

  it("offers split for large batches when callers are ready", () => {
    const next = importNextAction({
      importedCount: 40,
      missingPhone: 5,
      missingEmail: 5,
      numbersCount: 30,
      campaignId: "c1",
      canSplit: true,
    });
    assert.equal(next.id, "split_data");
    assert.equal(next.action, "split");
  });

  it("deep-links Start calling to dialer with list, never bare /dialer", () => {
    const next = importNextAction({
      importedCount: 5,
      missingPhone: 1,
      missingEmail: 1,
      numbersCount: 6,
      campaignId: "camp9",
      listId: "list9",
    });
    assert.equal(next.id, "start_calling");
    assert.equal(next.href, "/dialer?list=camp9");
    assert.ok(!next.href.endsWith("/dialer"));
  });

  it("defaults to find similar when no phones and no enrichment majority", () => {
    const next = importNextAction({
      importedCount: 4,
      missingPhone: 1,
      missingEmail: 1,
      numbersCount: 0,
      listId: "l1",
    });
    assert.equal(next.id, "find_similar");
    assert.equal(next.action, "scroll_grow");
  });
});
