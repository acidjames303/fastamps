import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeTargetSectors,
  parseExcludedCompanyLines,
  parseListIcp,
} from "../src/lib/companyExclusion.js";

describe("lookalike grow ICP helpers", () => {
  it("merges exclusion paste with existing clients", () => {
    const merged = parseExcludedCompanyLines(
      ["Acme Ltd", "Beta PLC", "acme limited", "Gamma"].join("\n"),
    );
    assert.deepEqual(merged, ["Acme Ltd", "Beta PLC", "Gamma"]);
  });

  it("keeps structured ICP when seeding sectors for lookalikes", () => {
    const icp = parseListIcp(JSON.stringify({
      target_sectors: ["Finance"],
      excluded_companies: ["Client A"],
    }));
    const next = {
      ...icp,
      target_sectors: mergeTargetSectors(icp.target_sectors, [
        { name: "Finance", count: 4 },
        { name: "Insurance", count: 2 },
      ]),
    };
    assert.deepEqual(next.target_sectors, ["Finance", "Insurance"]);
    assert.deepEqual(next.excluded_companies, ["Client A"]);
  });
});
