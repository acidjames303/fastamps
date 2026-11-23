/**
 * Authorised production QA cycle helper (feature-freeze / external harness).
 * Requires CONNECT_QA_MODE=production-authorised + CONNECT_QA_CONFIRM=QA-LAUNCH-2026
 * and admin/installer secrets in the environment.
 *
 * Default action: smoke + verify app id (no mutations).
 * Pass --import-25 to import a 25-row QA batch (admin).
 * Pass --claim N to submit N claims with the installer account (max 5 per run unless OVERRIDE).
 */
import { assertSafeMode } from './env-guard.mjs';
import { assertTargetApp, baseUrl, expectedAppId } from './target-app.mjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

assertSafeMode('authorised-cycle');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const appId = expectedAppId();
const api = `${baseUrl()}/api/apps/${appId}`;

async function login(email, password) {
  const res = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`login failed: ${res.status}`);
  return data.access_token;
}

async function invoke(token, name, payload) {
  const res = await fetch(`${api}/functions/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const target = await assertTargetApp();
const summary = {
  ok: target.ok,
  mode: process.env.CONNECT_QA_MODE || 'dry-run',
  appId,
  target,
  mutations: [],
};

if (!target.ok) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(1);
}

if (args.has('--import-25')) {
  const adminEmail = process.env.CONNECT_QA_ADMIN_EMAIL;
  const adminPassword = process.env.CONNECT_QA_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) throw new Error('admin secrets missing');
  const token = await login(adminEmail, adminPassword);
  const rows = JSON.parse(readFileSync(join(root, 'fixtures/chargers.json'), 'utf8')).chargers.slice(
    0,
    25,
  );
  const batch = `QA-LAUNCH-2026-CYCLE-${new Date().toISOString().slice(0, 10)}`;
  const result = await invoke(token, 'import-charger-batch', {
    action: 'import',
    batch_reference: batch,
    rows,
    qr_generated: true,
  });
  summary.mutations.push({
    type: 'import',
    http: result.status,
    created: result.data.created_count,
    batch,
    success: result.data.success === true,
  });
}

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok || summary.mutations.some((m) => m.success === false)) process.exit(1);
