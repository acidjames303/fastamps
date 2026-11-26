import assert from "node:assert/strict";
import {
  classifyTerritory,
  bucketByTerritory,
  bucketByIndustry,
  splitEven,
  assignBucketsRoundRobin,
  parseSplitInstruction,
  toManualAssignments,
} from "../src/lib/splitCampaignData.js";

assert.equal(classifyTerritory("Manchester, United Kingdom").id, "northwest");
assert.equal(classifyTerritory("Brighton, UK").id, "southeast");
assert.equal(classifyTerritory("Glasgow").id, "scotland");

const accounts = [
  { id: "1", company_id: "1", name: "A", location: "Manchester", industry: "Finance" },
  { id: "2", company_id: "2", name: "B", location: "London", industry: "Finance" },
  { id: "3", company_id: "3", name: "C", location: "Leeds", industry: "Energy" },
  { id: "4", company_id: "4", name: "D", location: "Bristol", industry: "Energy" },
];

{
  const territories = bucketByTerritory(accounts);
  assert.ok(territories.some((b) => b.id === "northwest"));
  assert.ok(territories.some((b) => b.id === "southeast"));
}

{
  const industries = bucketByIndustry(accounts);
  assert.equal(industries.find((b) => b.label === "Finance").accounts.length, 2);
}

{
  const piles = splitEven(accounts, ["u1", "u2"]);
  assert.equal(piles[0].accounts.length, 2);
  assert.equal(piles[1].accounts.length, 2);
}

{
  const piles = assignBucketsRoundRobin(bucketByIndustry(accounts), ["u1", "u2"]);
  assert.equal(piles[0].accounts.length + piles[1].accounts.length, 4);
  // Each industry stays on one person
  const u1Industries = new Set(piles[0].accounts.map((a) => a.industry));
  assert.equal(u1Industries.size, 1);
}

{
  const parsed = parseSplitInstruction("Split 50/50 between Aileen and Malcolm", [
    { user_id: "a", full_name: "Aileen" },
    { user_id: "m", full_name: "Malcolm" },
  ]);
  assert.equal(parsed.mode, "even");
}

{
  const parsed = parseSplitInstruction("Split by industry", [
    { user_id: "a", full_name: "Aileen" },
    { user_id: "m", full_name: "Malcolm" },
  ]);
  assert.equal(parsed.mode, "by_industry");
}

{
  const rows = toManualAssignments(splitEven(accounts, ["u1", "u2"]));
  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => r.company_id && r.user_id));
}

console.log("split-campaign-data.test.mjs: ok");
