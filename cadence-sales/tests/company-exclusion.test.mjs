import assert from "node:assert/strict";
import {
  parseExcludedCompaniesFromSheet,
  isCompanyExcluded,
  filterExcludedCompanies,
  industriesFromAccounts,
} from "../src/lib/companyExclusion.js";

{
  const names = parseExcludedCompaniesFromSheet([
    ["Gaming & Gambling, Banking & Finance, Energy & Insurance"],
    ["Tesco"],
    ["Bet365"],
    ["Lloyds Banking Group"],
    ["Perkbox Ltd"],
    ["Perkbox Ltd"],
    [""],
  ]);
  assert.ok(!names.includes("Gaming & Gambling, Banking & Finance, Energy & Insurance"));
  assert.ok(names.includes("Tesco"));
  assert.ok(names.includes("Bet365"));
  assert.equal(names.filter((n) => n === "Perkbox Ltd").length, 1);
}

{
  assert.equal(isCompanyExcluded("Lloyds Banking Group", ["Lloyds Banking Group"]), true);
  assert.equal(isCompanyExcluded("Acme Ltd", ["Tesco", "Bet365"]), false);
}

{
  const { kept, blocked } = filterExcludedCompanies(
    [{ company_name: "Tesco" }, { company_name: "Fresh Co" }],
    ["Tesco"],
  );
  assert.equal(kept.length, 1);
  assert.equal(kept[0].company_name, "Fresh Co");
  assert.equal(blocked.length, 1);
}

{
  const industries = industriesFromAccounts([
    { industry: "Finance" },
    { industry: "Finance" },
    { industry: "Energy, Utilities & Waste" },
  ]);
  assert.equal(industries[0].name, "Finance");
  assert.equal(industries[0].count, 2);
}

console.log("company-exclusion.test.mjs: ok");
