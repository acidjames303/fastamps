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

console.log("spreadsheet-accounts-merge.test.mjs: ok");
