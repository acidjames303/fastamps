/**
 * Apply Playground iteration 001 via Base44 sandbox + publish.
 *
 * Auth (any one):
 *   - `npx base44 login` (device login) on this machine
 *   - BASE44_API_KEY=b44k_... (+ optional BASE44_APP_ID)
 *
 *   node scripts/apply-iter001.mjs [--dry-run] [--no-deploy]
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dry = process.argv.includes("--dry-run");
const noDeploy = process.argv.includes("--no-deploy");
const appId = process.env.BASE44_APP_ID || "6afb374c91d1c9194f9d6554";
const outDir = path.join(root, "artifacts");
fs.mkdirSync(outDir, { recursive: true });

function run(args, { input, allowFail = false } = {}) {
  const res = spawnSync("npx", ["base44", "--app-id", appId, "--json", ...args], {
    cwd: root,
    encoding: "utf8",
    input,
    env: process.env,
    maxBuffer: 40 * 1024 * 1024,
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.status !== 0 && !allowFail) {
    throw new Error(`base44 ${args.join(" ")} failed (${res.status})`);
  }
  try {
    return res.stdout ? JSON.parse(res.stdout) : null;
  } catch {
    return res.stdout;
  }
}

function whoami() {
  return run(["whoami"], { allowFail: true });
}

function grep(pattern) {
  return run(
    ["sandbox", "grep", pattern, "--glob", "*.{js,jsx,ts,tsx}", "--max-results", "30"],
    { allowFail: true },
  );
}

function findPaths(patterns) {
  const hits = new Set();
  for (const p of patterns) {
    const g = grep(p);
    const text = typeof g === "string" ? g : JSON.stringify(g || {});
    fs.writeFileSync(path.join(outDir, `grep-${p.slice(0, 24).replace(/\W+/g, "_")}.json`), text);
    for (const m of text.matchAll(/["']([^"']+\.(?:tsx?|jsx?))["']/g)) hits.add(m[1]);
    for (const m of text.matchAll(/((?:src|app|routes|pages|components)\/[\w./-]+\.(?:tsx?|jsx?))/g)) {
      hits.add(m[1]);
    }
  }
  return [...hits];
}

function read(p) {
  const res = spawnSync("npx", ["base44", "--app-id", appId, "sandbox", "read", p], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 40 * 1024 * 1024,
  });
  if (res.status !== 0) return null;
  return res.stdout || "";
}

function edit(filePath, edits) {
  const args = ["sandbox", "edit", filePath, "--edits-json", JSON.stringify(edits)];
  if (dry) args.push("--dry-run");
  return run(args);
}

const me = whoami();
if (!me || me.error || me.code === "AUTH_REQUIRED") {
  console.error(
    "Not authenticated to Base44. Run: npx base44 login\n" +
      "Or set BASE44_API_KEY (b44k_...) in Cursor secrets / env.",
  );
  process.exit(2);
}
console.error(`Authenticated as ${me.email || me.name || JSON.stringify(me)}`);

console.error("Locating Playground source files…");
const candidates = findPaths([
  "Draw how your business works",
  "One click, plain English",
  "// drag a step",
  "Make it smarter",
  "Your free analysis has been used",
  "Smaller screens build the process",
]);

const probe = [
  "src/routes/playground.tsx",
  "src/routes/playground.jsx",
  "src/routes/_site/playground.tsx",
  "src/pages/Playground.tsx",
  "src/pages/Playground.jsx",
  "src/pages/playground.tsx",
  "src/components/playground/Playground.tsx",
  "src/components/Playground.tsx",
  "src/features/playground/Playground.tsx",
  ...candidates,
];

const files = [];
for (const p of [...new Set(probe)]) {
  const body = read(p);
  if (body && /Draw how your business works|Make it smarter|One click, plain English/.test(body)) {
    files.push({ path: p, body });
    fs.writeFileSync(path.join(outDir, `sandbox-${p.replace(/\//g, "__")}`), body);
  }
}

if (!files.length) {
  // recursive ls fallback
  const ls = run(["sandbox", "ls", "--recursive", "--max-depth", "5"], { allowFail: true });
  fs.writeFileSync(path.join(outDir, "sandbox-ls.json"), JSON.stringify(ls, null, 2));
  console.error("Could not find Playground source. Wrote artifacts/sandbox-ls.json + greps.");
  process.exit(3);
}

console.error(
  `Found ${files.length} file(s):\n` + files.map((f) => ` - ${f.path} (${f.body.length} bytes)`).join("\n"),
);

const stringEdits = [
  {
    old_text:
      "Build your process as boxes and connections, then let Smart Builder propose a better version. One full analysis is free and needs no account.",
    new_text:
      "Map the steps you actually use today — email, spreadsheets, calls, approvals. Smart Builder gives you one free plain-English proposal for a tighter process. If it looks useful, send it to SmartFunction and we’ll show how our apps, automation and services could run it.",
    replace_all: true,
  },
  {
    old_text: "1 · pick a process",
    new_text: "1 · pick a familiar process",
    replace_all: true,
  },
  {
    old_text: "2 · arrange your steps",
    new_text: "2 · map the real steps",
    replace_all: true,
  },
  {
    old_text: "3 · make it smarter",
    new_text: "3 · get one free analysis",
    replace_all: true,
  },
  {
    old_text: "4 · turn it into a project",
    new_text: "4 · talk solutions with us",
    replace_all: true,
  },
  {
    old_text: "One click, plain English",
    new_text: "Free Smart Builder analysis",
    replace_all: true,
  },
  {
    old_text:
      "Smart Builder reads your steps and connections, then proposes the process SmartFunction would build — including where human approval stays.",
    new_text:
      "We’ll read your steps and connections, flag manual work and duplicated data, and propose a clearer process — including where a person should still approve. That map is what we use to advise on the right SmartFunction build or automation.",
    replace_all: true,
  },
  {
    old_text: "drag to arrange · circle to connect · drag canvas to pan",
    new_text: "Drag to arrange · drag the circle to connect · drag canvas to pan",
    replace_all: true,
  },
  {
    old_text: "// drag a step to move it",
    new_text: "Drag a step to move it",
    replace_all: true,
  },
  {
    old_text: "// drag its circle onto another step to connect",
    new_text: "Drag the small circle from one step onto another to connect them",
    replace_all: true,
  },
  {
    old_text: "// click a line to remove a connection",
    new_text: "Click a connection line to remove it",
    replace_all: true,
  },
  {
    old_text:
      "Smaller screens build the process as a list. Each step connects to the next; the map appears once Smart Builder runs.",
    new_text:
      "On phones you edit steps as a list. Connections stay in order; the visual map appears with your Smart Builder result.",
    replace_all: true,
  },
  {
    old_text:
      "Add your name and email to run another one. No account needed, and we will only contact you about this process.",
    new_text:
      "Your free analysis for this visit is used. Add your name and business email to run another — no account, and we’ll only contact you about this process.",
    replace_all: true,
  },
];

let applied = 0;
for (const file of files) {
  const applicable = stringEdits.filter((e) => file.body.includes(e.old_text));
  if (!applicable.length) {
    console.error(`No string matches in ${file.path}`);
    continue;
  }
  console.error(`Editing ${file.path} (${applicable.length} edits)${dry ? " dry-run" : ""}…`);
  edit(file.path, applicable);
  applied += applicable.length;
}

if (!applied) {
  console.error("No edits applied — source strings may have drifted. Inspect artifacts/sandbox-*");
  process.exit(4);
}

if (!dry) {
  console.error("Checkpointing…");
  run([
    "sandbox",
    "checkpoint",
    "--name",
    "Playground iter 001: orientation, connect tips, mobile note, gate copy",
  ]);

  // SEO meta via API if key present; otherwise try api fetch after login
  try {
    console.error("Updating Playground SEO meta…");
    const payload = {
      settings: {
        pages: {
          Playground: {
            title: "SmartFunction Playground — Map your process, then make it smarter",
            description:
              "Draw how your business works as steps and connections. Get one free Smart Builder analysis — no account required — then turn it into a scoped SmartFunction project.",
            noindex: false,
          },
        },
      },
    };
    // Prefer CLI api fetch if available
    const seo = spawnSync(
      "npx",
      [
        "base44",
        "--app-id",
        appId,
        "--json",
        "api",
        "fetch",
        "PATCH",
        `/apps/${appId}/seo/settings`,
        "--body",
        JSON.stringify(payload),
      ],
      { cwd: root, encoding: "utf8", env: process.env, maxBuffer: 10 * 1024 * 1024 },
    );
    fs.writeFileSync(
      path.join(outDir, "seo-patch.json"),
      (seo.stdout || "") + "\n" + (seo.stderr || ""),
    );
    if (seo.status !== 0) console.error("SEO patch via api fetch may have failed — see artifacts/seo-patch.json");
  } catch (e) {
    console.error("SEO meta update skipped:", e.message);
  }

  if (!noDeploy) {
    console.error("Deploying site…");
    // Prefer sandbox-driven deploy used previously
    run(["deploy", "-y", "--no-build"], { allowFail: true });
    // Also try site deploy --publish
    const site = spawnSync(
      "npx",
      ["base44", "--app-id", appId, "site", "deploy", "-y", "--publish", "--no-build"],
      { cwd: root, encoding: "utf8", env: process.env, maxBuffer: 20 * 1024 * 1024 },
    );
    fs.writeFileSync(
      path.join(outDir, "site-deploy.txt"),
      (site.stdout || "") + "\n" + (site.stderr || ""),
    );
    console.error(`site deploy exit ${site.status}`);
  }
}

console.error("Done. Verify https://smartfunction.io/playground");
