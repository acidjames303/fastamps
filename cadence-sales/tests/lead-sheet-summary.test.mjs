import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/lib/leadSheetSummary.js"), "utf8");
const { code } = transformSync(src, { loader: "js", format: "esm" });
const tmp = join(root, "tests/.lead-sheet-summary.tmp.mjs");
writeFileSync(tmp, code);
const { buildLeadSheetSummary } = await import(pathToFileURL(tmp).href + `?t=${Date.now()}`);
unlinkSync(tmp);

const text = buildLeadSheetSummary({
  opportunity: {
    need_summary: "Need packing line support",
    next_step: "Book a demo",
    pain_points: "Downtime",
    estimated_value: 12000,
    qualification_status: "qualified",
  },
  company: { name: "Syntegon Ltd", website: "https://example.com" },
  contact: { full_name: "Alex Buyer", email: "alex@example.com", job_title: "Ops Director" },
  campaign: { client_name: "Oxi-Tech" },
});

assert.match(text, /Company: Syntegon Ltd/);
assert.match(text, /Contact: Alex Buyer/);
assert.match(text, /Need: Need packing line support/);
assert.match(text, /Agreed next step: Book a demo/);
assert.match(text, /Estimated value: £12000/);
assert.doesNotMatch(text, /coaching reminder/i);
assert.doesNotMatch(text, /scratchpad/i);

const emptyish = buildLeadSheetSummary({ opportunity: {} });
assert.match(emptyish, /Cadence lead summary/);
assert.doesNotMatch(emptyish, /Need:/);

console.log("lead-sheet-summary: ok");
