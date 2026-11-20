/**
 * Locate Playground-related files in the SmartFunction Base44 sandbox.
 *
 * Requires:
 *   BASE44_API_KEY=b44k_...
 *   BASE44_APP_ID=6afb374c91d1c9194f9d6554
 *
 *   node scripts/sandbox-grep.mjs
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const appId = process.env.BASE44_APP_ID || "6afb374c91d1c9194f9d6554";
const outDir = path.join(root, "artifacts");
fs.mkdirSync(outDir, { recursive: true });

if (!process.env.BASE44_API_KEY && !process.env.BASE44_ACCESS_TOKEN) {
  console.error(
    "Missing BASE44_API_KEY (or BASE44_ACCESS_TOKEN + BASE44_REFRESH_TOKEN). Add via Cursor secrets, then re-run.",
  );
  process.exit(2);
}

function run(args) {
  const res = spawnSync("npx", ["base44", "--app-id", appId, "--json", ...args], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.status !== 0) {
    throw new Error(`base44 ${args.join(" ")} failed (${res.status})`);
  }
  try {
    return res.stdout ? JSON.parse(res.stdout) : null;
  } catch {
    return res.stdout;
  }
}

const queries = [
  "Draw how your business works",
  "Make it smarter",
  "Sales follow-up",
  "Smart Builder",
  "playground-templates",
];

const results = {};
for (const q of queries) {
  console.error(`grep: ${q}`);
  results[q] = run([
    "sandbox",
    "grep",
    q,
    "--glob",
    "*.{js,jsx,ts,tsx,mdx}",
    "--max-results",
    "20",
  ]);
}

const outPath = path.join(outDir, "sandbox-grep-playground.json");
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
console.error(`Wrote ${outPath}`);
