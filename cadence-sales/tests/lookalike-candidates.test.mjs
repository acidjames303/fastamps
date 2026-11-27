import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LOOKALIKE_BATCH_SIZE, mergeLookalikeCandidates } from "../src/lib/lookalikeCandidates.js";

describe("lookalikeCandidates", () => {
  it("defaults batch size to 100", () => {
    assert.equal(LOOKALIKE_BATCH_SIZE, 100);
  });

  it("appends new companies and skips domain/name duplicates", () => {
    const merged = mergeLookalikeCandidates(
      [{ name: "Acme Ltd", domain: "acme.com" }],
      [
        { name: "Acme Limited", domain: "acme.com" },
        { name: "Beta PLC", domain: "beta.co.uk" },
        { name: "Gamma", domain: "" },
      ],
    );
    assert.equal(merged.length, 3);
    assert.equal(merged[1].name, "Beta PLC");
    assert.equal(merged[2].name, "Gamma");
  });
});
