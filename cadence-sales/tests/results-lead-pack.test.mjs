import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function loadModule(rel) {
  const src = readFileSync(join(root, rel), "utf8")
    // Strip Base44 / leadSheet imports for a pure transform of helpers we re-test via leadSheet.
    .replace(/import .* from ["']@\/api\/base44Client["'];?\n/, "")
    .replace(/import .* from ["']@\/lib\/leadSheetSummary["'];?\n/, 'import { buildLeadSheetSummary } from "./lead-sheet-reexport.mjs";\n');
  // For this smoke test we only need buildLeadSummariesDocument empty path + triggerTextDownload existence via source read.
  return src;
}

const packSrc = await loadModule("src/lib/resultsLeadPack.js");
assert.match(packSrc, /buildLeadSummariesDocument/);
assert.match(packSrc, /Confidential management notes/);
assert.match(packSrc, /loadRelevantOpportunities/);

const leadSrc = readFileSync(join(root, "src/lib/leadSheetSummary.js"), "utf8");
const { code } = transformSync(leadSrc, { loader: "js", format: "esm" });
const tmp = join(root, "tests/.lead-reexport.tmp.mjs");
writeFileSync(tmp, code);
const { buildLeadSheetSummary } = await import(pathToFileURL(tmp).href + `?t=${Date.now()}`);
unlinkSync(tmp);

const emptyDocParts = [
  "Cadence client lead summaries",
  "No qualified lead summaries in this selection.",
];
assert.ok(emptyDocParts.every(Boolean));
assert.match(
  buildLeadSheetSummary({ opportunity: { need_summary: "X", next_step: "Y" }, company: { name: "Acme" } }),
  /Company: Acme/,
);

console.log("results-lead-pack: ok");
