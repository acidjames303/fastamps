import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/lib/spreadsheetAccounts.js"), "utf8");
const { code } = transformSync(src, { loader: "js", format: "esm" });
const tmp = join(root, "tests/.spreadsheet-accounts-merge.tmp.mjs");
writeFileSync(tmp, code);
const mod = await import(pathToFileURL(tmp).href + `?t=${Date.now()}`);
unlinkSync(tmp);

const { accountsFromSheets, mergeAccountLists, toAccounts } = mod;

const sheetA = {
  name: "UK",
  rows: [
    { Company: "Acme Ltd", Website: "https://acme.example", "Contact name": "Ada Lovelace", Email: "ada@acme.example" },
    { Company: "Beta PLC", Website: "beta.example" },
  ],
};
const sheetB = {
  name: "EU",
  rows: [
    { Company: "Acme Ltd", Website: "https://acme.example", "Contact name": "Ben Franklin", Email: "ben@acme.example" },
    { Company: "Gamma GmbH", Website: "gamma.example" },
  ],
};

const merged = accountsFromSheets([sheetA, sheetB]);
assert.equal(merged.sheetsRead, 2);
assert.equal(merged.sheetStats.length, 2);
assert.equal(merged.sheetStats[0].accounts, 2);
assert.equal(merged.sheetStats[1].accounts, 2);

const byName = Object.fromEntries(merged.accounts.map((a) => [a.company_name, a]));
assert.ok(byName["Acme Ltd"], "Acme kept from both sheets");
assert.equal(byName["Acme Ltd"].contacts.length, 2, "contacts from both sheets merge under one company");
assert.ok(byName["Beta PLC"]);
assert.ok(byName["Gamma GmbH"]);
assert.equal(merged.accounts.length, 3, "duplicate company across sheets collapses to one account");

const onlyBestWouldHaveDropped = accountsFromSheets([
  { name: "Tiny", rows: [{ Company: "Solo Co" }] },
  {
    name: "Large empty-ish",
    rows: [
      { Notes: "ignore me" },
      { Notes: "still no company" },
      { Notes: "padding" },
    ],
  },
]);
assert.ok(
  onlyBestWouldHaveDropped.accounts.some((a) => a.company_name === "Solo Co"),
  "tiny sheet with real accounts is not dropped when another sheet is larger",
);

const lists = mergeAccountLists([
  toAccounts(sheetA.rows).accounts,
  toAccounts(sheetB.rows).accounts,
]);
assert.equal(lists.length, 3);
assert.equal(lists.find((a) => a.company_name === "Acme Ltd").contacts.length, 2);

{
  const pilotish = toAccounts([
    {
      "Company Name": "Aberdeen",
      "Primary Industry": "Finance",
      "Primary Sub-Industry": "Investment Banking",
      "Last Name": "Dissanayake",
      "First Name": "Manjula",
      "Job Title": "Head of Data Science",
      "Direct Phone Number": "+44 20 7123 4567",
      "Email Address": "manjula@example.com",
      "Mobile phone": "+44 7967 359567",
      "LinkedIn Contact Profile URL": "https://www.linkedin.com/in/example",
      "Company Country": "United Kingdom",
    },
  ]).accounts;
  assert.equal(pilotish.length, 1);
  assert.equal(pilotish[0].industry, "Finance");
  assert.equal(pilotish[0].location, "United Kingdom");
  assert.equal(pilotish[0].contacts.length, 1);
  assert.equal(pilotish[0].contacts[0].mobile, "+44 7967 359567");
  assert.equal(pilotish[0].contacts[0].direct_dial, "+44 20 7123 4567");
  assert.equal(pilotish[0].contacts[0].phone, "+44 7967 359567");
  assert.equal(pilotish[0].contacts[0].phone_source, "import");
  assert.equal(pilotish[0].contacts[0].linkedin, "https://www.linkedin.com/in/example");
}

console.log("spreadsheet-accounts-merge.test.mjs: ok");
