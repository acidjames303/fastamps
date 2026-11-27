import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OUTREACH_INSTRUCTION_PRESETS,
  briefInstructionText,
  sortResearchBriefs,
} from "../src/lib/researchBriefReuse.js";

describe("researchBriefReuse", () => {
  it("trims and caps brief instruction text", () => {
    assert.equal(briefInstructionText({ instruction: "  Hello world  " }), "Hello world");
    assert.equal(briefInstructionText({ instruction: "x".repeat(2000) }).length, 1500);
  });

  it("sorts by last_used_at then created_date", () => {
    const sorted = sortResearchBriefs([
      { id: "a", last_used_at: "2026-01-01", created_date: "2026-01-01" },
      { id: "b", last_used_at: "2026-06-01", created_date: "2026-01-02" },
      { id: "c", created_date: "2026-12-01" },
    ]);
    assert.deepEqual(sorted.map((b) => b.id), ["b", "a", "c"]);
  });

  it("ships three outreach presets", () => {
    assert.equal(OUTREACH_INSTRUCTION_PRESETS.length, 3);
    assert.ok(OUTREACH_INSTRUCTION_PRESETS.every((p) => p.id && p.label && p.text));
  });
});
