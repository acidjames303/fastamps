import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasReusableResearch, pickableFindings } from "../src/lib/outreachResearchReuse.js";

describe("outreachResearchReuse", () => {
  it("prefers lead research_facts and dedupes against summary", () => {
    const findings = pickableFindings({
      lead: {
        research_fact: "Building 200 homes in Bristol",
        research_source_url: "https://example.com/a",
        research_facts: [
          { label: "Pipeline", value: "Building 200 homes in Bristol", source_url: "https://example.com/a" },
          { label: "News", value: "Won a framework for EV chargers", source_url: "https://example.com/b" },
        ],
      },
      researchRecord: {
        summary: "Building 200 homes in Bristol",
        findings: [{ label: "Extra", value: "HQ in Bath", source_url: "https://example.com/c" }],
      },
    });
    assert.equal(findings.length, 3);
    assert.equal(findings[0].label, "Saved for outreach");
    assert.equal(findings[1].fact, "Won a framework for EV chargers");
    assert.equal(findings[2].fact, "HQ in Bath");
    assert.equal(hasReusableResearch(findings), true);
  });

  it("returns empty when nothing reusable", () => {
    assert.deepEqual(pickableFindings({ lead: {}, researchRecord: null }), []);
    assert.equal(hasReusableResearch([]), false);
  });
});
