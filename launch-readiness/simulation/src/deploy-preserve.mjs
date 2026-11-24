/**
 * Reliable Base44 publish that preserves:
 * - backend function code (redeploy-function)
 * - entity schemas (re-push AFTER POST /deploy, which can overwrite from git)
 * - frontend SPA (deploy-dist of local dist/)
 *
 * Usage:
 *   node src/deploy-preserve.mjs [--functions name1,name2] [--skip-build] [--skip-functions]
 *
 * Always verifies SPA markers + Installer.membership_status schema after publish.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createGunzip } from 'node:zlib';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');
const appId = process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID;
const apiKey = process.env.BASE44_API_KEY || process.env.BASE44_API_TOKEN;
const base = (process.env.VITE_BASE44_APP_BASE_URL || 'https://connect.fastamps.com').replace(/\/$/, '');

if (!appId || !apiKey) {
  console.error('BASE44_APP_ID and BASE44_API_KEY required');
  process.exit(2);
}

const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const skipFunctions = args.includes('--skip-functions');
const fnArg = args.indexOf('--functions');
const defaultFns = [
  'search-wholesaler-branches',
  'pre-register-installer',
  'manage-incentive-programme',
  'activate-installer-membership',
  'register-installer',
  'submit-install-claim',
  'submit-install-claim-v2',
  'request-voucher-v2',
  'admin-voucher-action',
  'import-charger-batch',
];
const functions = fnArg >= 0
  ? String(args[fnArg + 1] || '').split(',').filter(Boolean)
  : defaultFns;

const report = {
  ok: false,
  appId,
  stages: {},
  verified: {},
};

async function api(method, path, { json, raw, headers } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'User-Agent': 'FastAmps-deploy-preserve/1.0',
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
    body: raw || (json ? JSON.stringify(json) : undefined),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
  return { status: res.status, ok: res.ok, data };
}

async function redeployFunction(name) {
  const code = readFileSync(join(repoRoot, 'base44/functions', name, 'entry.ts'), 'utf8');
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { status, ok, data } = await api('POST', `/api/apps/${appId}/coding/redeploy-function/${name}`, {
      json: { code },
    });
    if (ok) return { status, ok: true };
    const msg = JSON.stringify(data).toLowerCase();
    if (status === 409 || status === 429 || msg.includes('in progress') || msg.includes('another deploy')) {
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }
    return { status, ok: false, data };
  }
  return { status: 409, ok: false, data: { error: 'redeploy retries exhausted' } };
}

function loadEntitySchema(name) {
  const text = readFileSync(join(repoRoot, 'base44/entities', `${name}.jsonc`), 'utf8');
  return JSON.parse(text);
}

async function pushSchemas() {
  const names = readdirSync(join(repoRoot, 'base44/entities'))
    .filter((f) => f.endsWith('.jsonc'))
    .map((f) => f.replace(/\.jsonc$/, ''));
  const results = {};
  for (const name of names) {
    const schema = loadEntitySchema(name);
    // Try PUT first; on 404 create
    let res = await api('PUT', `/api/apps/${appId}/entity-schemas/${name}`, {
      json: { entity_schema: schema },
    });
    if (res.status === 404) {
      res = await api('POST', `/api/apps/${appId}/entity-schemas`, {
        json: { entity_name: name, entity_schema: schema },
      });
    }
    results[name] = { status: res.status, ok: res.ok };
    if (!res.ok) results[name].error = res.data;
  }
  return results;
}

async function publishApp() {
  return api('POST', `/api/apps/${appId}/deploy`, { json: {} });
}

async function deployDist() {
  const dist = join(repoRoot, 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    throw new Error('dist/index.html missing — run npm run build first');
  }
  const tarPath = `/tmp/connect-dist-${randomUUID()}.tar.gz`;
  execSync(`tar -czf ${tarPath} .`, { cwd: dist });
  const archive = readFileSync(tarPath);
  const boundary = `----cursor${randomUUID().replace(/-/g, '')}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="connect-dist.tar.gz"\r\n` +
      `Content-Type: application/gzip\r\n\r\n`,
    ),
    archive,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  // Prefer app.base44.com host used successfully in prior deploys
  const hosts = ['https://app.base44.com', base];
  for (const host of hosts) {
    const res = await fetch(`${host}/api/apps/${appId}/deploy-dist`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'User-Agent': 'FastAmps-deploy-preserve/1.0',
      },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { status: res.status, ok: true, data, host };
  }
  return { status: 500, ok: false, data: { error: 'deploy-dist failed on all hosts' } };
}

async function verify() {
  const html = await fetch(`${base}/`, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
  const match = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/);
  const asset = match?.[0] || null;
  let spa = { asset, markers: {} };
  if (asset) {
    const js = await fetch(`${base}/${asset}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
    for (const marker of ['/welcome', '/pre-register', '/admin/programmes', 'Pre-register your interest']) {
      spa.markers[marker] = js.includes(marker);
    }
  }
  const schema = await api('GET', `/api/apps/${appId}/entity-schemas/Installer`);
  const props = schema.data?.properties || schema.data?.entity_schema?.properties || {};
  const schemaOk = Boolean(props.membership_status) && String(JSON.stringify(props.welcome_reward_status || '')).includes('deferred');
  const programme = await api('GET', `/api/apps/${appId}/entity-schemas/IncentiveProgramme`);
  return {
    spa,
    installer_schema_ok: schemaOk,
    incentive_programme_schema: programme.ok,
  };
}

if (!skipBuild) {
  execSync('npm run build', { cwd: repoRoot, stdio: 'inherit' });
  report.stages.build = { ok: true };
}

if (!skipFunctions) {
  const fnResults = {};
  for (const name of functions) {
    fnResults[name] = await redeployFunction(name);
    if (!fnResults[name].ok) {
      report.stages.functions = fnResults;
      console.log(JSON.stringify(report, null, 2));
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  report.stages.functions = fnResults;
}

report.stages.publish = await publishApp();
// CRITICAL: POST /deploy can overwrite live schemas from a stale git revision.
report.stages.schemas_after_publish = await pushSchemas();
report.stages.deploy_dist = await deployDist();
await new Promise((r) => setTimeout(r, 2000));
report.verified = await verify();

const spaOk = report.verified.spa?.asset
  && Object.values(report.verified.spa.markers || {}).every(Boolean);
report.ok = Boolean(
  report.stages.publish?.ok
  && report.stages.deploy_dist?.ok
  && report.verified.installer_schema_ok
  && spaOk,
);

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
