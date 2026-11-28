import assert from "node:assert/strict";
import { buildRunEstimate } from "../src/lib/enrichmentRun.js";

const prospects = [
  {
    company_name: "Acme",
    phone: "07700900111",
    contacts: [
      { name: "Ann", mobile: "07700900111" },
      { name: "Bob", mobile: "07700900222" },
      { name: "Cara" },
    ],
  },
  {
    company_name: "Beta",
    contacts: [{ name: "Dan" }],
  },
];

{
  // Missing-only: only companies without a usable phone (Beta) drive Lusha.
  const estimate = buildRunEstimate({
    prospects,
    requestedFields: ["mobile", "direct_dial"],
    searchMethod: "providers",
    searchDepth: "exhaustive",
    phoneCoverage: { best: true, otherKnown: true, discover: true },
    selectedProviders: ["lusha"],
    existingInfoMode: "missing",
  });
  assert.equal(estimate.total, 2);
  assert.equal(estimate.recordsNeedingPhone, 1);
  assert.equal(estimate.numbersReused, 1);
  assert.ok(estimate.maxLushaLookups <= 5);
}

{
  // Maximum / newer: every named contact may be checked (missing + no lusha extra).
  const estimate = buildRunEstimate({
    prospects,
    requestedFields: ["mobile", "direct_dial"],
    searchMethod: "providers",
    searchDepth: "exhaustive",
    phoneCoverage: { best: true, otherKnown: true, discover: true },
    selectedProviders: ["lusha"],
    existingInfoMode: "newer",
  });
  assert.equal(estimate.namedContacts, 4);
  assert.equal(estimate.contactsMissingMobile, 2); // Cara + Dan
  assert.equal(estimate.contactsSeekingExtraMobile, 2); // Ann + Bob
  assert.equal(estimate.maxLushaLookups, 4);
}

console.log("enrichment-run-estimate.test.mjs: ok");
