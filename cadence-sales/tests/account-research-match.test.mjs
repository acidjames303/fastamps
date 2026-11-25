import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

// Load the ESM helper through a light transform so Node can run it without a Vite alias.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/lib/accountResearchMatch.js"), "utf8");
const { code } = transformSync(src, { loader: "js", format: "esm" });
const tmp = join(root, "tests/.account-research-match.tmp.mjs");
writeFileSync(tmp, code);
const mod = await import(pathToFileURL(tmp).href + `?t=${Date.now()}`);
unlinkSync(tmp);

const { normaliseCompanyName, matchAccountResearch, needsCallReadyConfirm } = mod;

assert.equal(normaliseCompanyName("Oxi-Tech Ltd"), normaliseCompanyName("Oxi Tech Limited"));
assert.equal(normaliseCompanyName("Acme & Co"), "acme-and");

const rows = [
  {
    company_name: "Syntegon Technology Ltd",
    summary: "",
    findings: [],
    researched_at: "2026-01-01",
  },
  {
    company_name: "Syntegon Technology Limited",
    summary: "Packaging machinery supplier",
    findings: [{ label: "Supplier", value: "Existing OEM", source_url: "https://example.com", evidence: "published" }],
    researched_at: "2026-11-01",
  },
  {
    company_name: "Other Co",
    summary: "Irrelevant",
    findings: [{ label: "X", value: "Y" }],
    researched_at: "2026-12-01",
  },
];

const best = matchAccountResearch(rows, { name: "Syntegon Technology Ltd" });
assert.ok(best);
assert.equal(best.summary, "Packaging machinery supplier");
assert.equal(best.findings.length, 1);

assert.equal(matchAccountResearch(rows, { name: "Missing Corp" }), null);

assert.equal(needsCallReadyConfirm({ phone: "+447700900123", phone_status: "provider_returned_unverified" }), true);
assert.equal(needsCallReadyConfirm({ phone: "+447700900123", phone_status: "manually_confirmed" }), false);
assert.equal(needsCallReadyConfirm({ phone: "", phone_status: "provider_returned_unverified" }), false);
assert.equal(needsCallReadyConfirm({ phone: "+441234567890", phone_type: "switchboard", phone_status: "provider_returned_unverified" }), false);

console.log("account-research-match: ok");
