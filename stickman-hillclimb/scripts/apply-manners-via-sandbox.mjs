/**
 * Apply iteration-001 manners patch to SmartFunction via Base44 sandbox.
 *
 * Requires env:
 *   BASE44_API_KEY=b44k_...   (or ACCESS+REFRESH tokens)
 *   BASE44_APP_ID=6afb374c91d1c9194f9d6554
 *
 * Usage:
 *   node scripts/apply-manners-via-sandbox.mjs [--dry-run]
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dry = process.argv.includes('--dry-run');
const appId = process.env.BASE44_APP_ID || '6afb374c91d1c9194f9d6554';

function run(args, input) {
  const res = spawnSync('npx', ['base44', '--app-id', appId, '--json', ...args], {
    cwd: root,
    encoding: 'utf8',
    input,
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.status !== 0) {
    throw new Error(`base44 ${args.join(' ')} failed (${res.status})`);
  }
  try {
    return res.stdout ? JSON.parse(res.stdout) : null;
  } catch {
    return res.stdout;
  }
}

if (!process.env.BASE44_API_KEY && !process.env.BASE44_ACCESS_TOKEN) {
  console.error(
    'Missing BASE44_API_KEY (or BASE44_ACCESS_TOKEN + BASE44_REFRESH_TOKEN). Add via Cursor secrets, then re-run.',
  );
  process.exit(2);
}

console.error(`App ${appId} · searching sandbox for stickman timing constants…`);
const grep = run(['sandbox', 'grep', 'mt=3e3', '--glob', '*.{js,jsx,ts,tsx}', '--max-results', '20']);

// Grep JSON shape may vary; also try literal CONSTANTS from source files
const candidates = [];
const dump = typeof grep === 'string' ? grep : JSON.stringify(grep, null, 2);
fs.writeFileSync(path.join(root, 'artifacts', 'sandbox-grep-mt.json'), dump);
console.error('Wrote artifacts/sandbox-grep-mt.json');

// Surgical constant replacements (minified or source-like)
const edits = [
  { old_text: 'mt=3e3', new_text: 'mt=9e3', replace_all: true },
  { old_text: 'ht=2600', new_text: 'ht=9e3', replace_all: true },
  { old_text: 'Ot=7e3', new_text: 'Ot=1/0', replace_all: true }, // Infinity while playing
  { old_text: 'xt=270', new_text: 'xt=420', replace_all: true },
  // source-style fallbacks
  { old_text: 'const mt = 3000', new_text: 'const mt = 9000', replace_all: true },
  { old_text: 'const ht = 2600', new_text: 'const ht = 9000', replace_all: true },
  { old_text: 'const Ot = 7000', new_text: 'const Ot = Infinity', replace_all: true },
  { old_text: 'const xt = 270', new_text: 'const xt = 420', replace_all: true },
];

// Prefer explicit path if grep found one
let targetPath = process.env.STICKMAN_SANDBOX_PATH || null;
if (!targetPath && grep && typeof grep === 'object') {
  const text = JSON.stringify(grep);
  const m = text.match(/[\w./-]*Stickman[\w./-]*/i) || text.match(/["']([^"']+\.(tsx?|jsx?))["']/);
  if (m) targetPath = m[1] || m[0];
}

if (!targetPath) {
  // Probe common paths
  for (const p of [
    'src/components/StickmanOverlay.tsx',
    'src/components/StickmanOverlay.jsx',
    'src/components/stickman/StickmanOverlay.tsx',
    'components/StickmanOverlay.tsx',
  ]) {
    const ls = spawnSync(
      'npx',
      ['base44', '--app-id', appId, 'sandbox', 'read', p],
      { cwd: root, encoding: 'utf8', env: process.env },
    );
    if (ls.status === 0 && ls.stdout && /mt\s*=\s*3e3|mt\s*=\s*3000|Ot\s*=\s*7e3/.test(ls.stdout)) {
      targetPath = p;
      break;
    }
  }
}

if (!targetPath) {
  console.error(
    'Could not locate StickmanOverlay path automatically. Set STICKMAN_SANDBOX_PATH and re-run.',
  );
  console.error('Also paste prompts/NEXT_BASE44.md into the Base44 builder as a fallback.');
  process.exit(3);
}

console.error(`Editing ${targetPath}${dry ? ' (dry-run)' : ''}…`);
const editArgs = ['sandbox', 'edit', targetPath, '--edits-json', JSON.stringify(edits)];
if (dry) editArgs.push('--dry-run');
run(editArgs);

if (!dry) {
  console.error('Checkpointing…');
  run(['sandbox', 'checkpoint', '-m', 'stickman manners: idle 9s, persistent dpad, fly window 420ms']);
}

console.error('Done. Publish/deploy from Base44 if needed, then: npm run playtest');
