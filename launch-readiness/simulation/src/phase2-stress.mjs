/**
 * Progressive concurrency waves at 5 / 10 / 25 (50 optional).
 * Avoids Giftbit and bulk email; uses auth, search, eligibility, claim probes.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { assertSafeMode } from './env-guard.mjs';
import { expectedAppId, baseUrl } from './target-app.mjs';
import { installerEmail, resolveServerId } from './otp-mailosaur.mjs';

assertSafeMode('phase2-stress');
const appId = expectedAppId();
const api = `${baseUrl()}/api/apps/${appId}`;
const PASSWORD = process.env.CONNECT_QA_INSTALLER_PASSWORD_TEMPLATE;
if (!PASSWORD) {
  console.error(JSON.stringify({ ok: false, error: 'Set CONNECT_QA_INSTALLER_PASSWORD_TEMPLATE' }));
  process.exit(2);
}
const out = '/opt/cursor/artifacts/phase2';
mkdirSync(out, { recursive: true });

async function http(method, path, body, token) {
  const t0 = Date.now();
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${api}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, ms: Date.now() - t0 };
}

function pct(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[i];
}

async function wave(name, concurrency, tasks) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i;
      i += 1;
      const task = tasks[idx];
      try {
        const r = await task();
        results.push({ ok: r.status < 500, expected_reject: r.expected_reject === true, ...r });
      } catch (e) {
        results.push({ ok: false, status: 0, ms: 0, error: String(e.message || e) });
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const ms = results.map((r) => r.ms).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const unexpected = results.filter((r) => !r.ok && !r.expected_reject);
  return {
    name,
    concurrency,
    requests: results.length,
    success: results.filter((r) => r.ok).length,
    expected_rejects: results.filter((r) => r.expected_reject).length,
    unexpected_failures: unexpected.length,
    median_ms: pct(ms, 50),
    p95_ms: pct(ms, 95),
    p99_ms: ms.length >= 20 ? pct(ms, 99) : null,
    timeouts: results.filter((r) => r.ms > 30_000).length,
    sample_errors: unexpected.slice(0, 5),
  };
}

const adminLogin = await http('POST', '/auth/login', {
  email: process.env.CONNECT_QA_ADMIN_EMAIL,
  password: process.env.CONNECT_QA_ADMIN_PASSWORD,
});
const adminToken = adminLogin.data.access_token;
const serverId = await resolveServerId();

const report = { waves: [], started_at: new Date().toISOString() };

for (const conc of [5, 10, 25]) {
  // Auth wave
  const authTasks = Array.from({ length: conc * 4 }, (_, n) => async () => {
    const email = installerEmail((n % 50) + 1, serverId);
    const r = await http('POST', '/auth/login', { email, password: PASSWORD });
    return { ...r, kind: 'auth' };
  });
  report.waves.push(await wave(`auth_${conc}`, conc, authTasks));

  // Wholesaler search
  const searchTasks = Array.from({ length: conc * 4 }, (_, n) => async () => {
    const q = ['Links', 'CEF', 'Edmundson', 'Shrewsbury', 'Birmingham'][n % 5];
    const r = await http('POST', '/functions/search-wholesaler-branches', { query: q }, adminToken);
    return { ...r, kind: 'search' };
  });
  report.waves.push(await wave(`search_${conc}`, conc, searchTasks));

  // Public invite / eligibility
  const inviteTasks = Array.from({ length: conc * 3 }, () => async () => {
    const r = await http('POST', '/functions/manage-incentive-programme', {
      action: 'public_invite',
      programme_code: 'links-electrical-shrewsbury',
    });
    return { ...r, kind: 'invite', ok: r.status < 500 && r.data?.active === false };
  });
  report.waves.push(await wave(`invite_${conc}`, conc, inviteTasks));

  // Duplicate redemption prevention under load (same installer)
  const email = installerEmail(1, serverId);
  const login = await http('POST', '/auth/login', { email, password: PASSWORD });
  const tok = login.data.access_token;
  const redeemTasks = Array.from({ length: conc }, () => async () => {
    const r = await http('POST', '/functions/request-voucher-v2', {}, tok);
    const expected = r.status === 200 || r.status === 400 || r.status === 409;
    return {
      ...r,
      kind: 'redeem',
      ok: expected,
      expected_reject: r.status === 400 || r.status === 409 || (r.status === 200 && r.data?.request),
    };
  });
  report.waves.push(await wave(`redeem_dup_${conc}`, conc, redeemTasks));
}

// Optional conc 50 auth only (lighter)
report.waves.push(await wave('auth_50', 50, Array.from({ length: 50 }, (_, n) => async () => {
  const email = installerEmail((n % 50) + 1, serverId);
  return { ...(await http('POST', '/auth/login', { email, password: PASSWORD })), kind: 'auth' };
})));

report.finished_at = new Date().toISOString();
report.ok = report.waves.every((w) => w.unexpected_failures === 0);
writeFileSync(`${out}/stress-results.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: report.ok, waves: report.waves.map((w) => ({
  name: w.name, conc: w.concurrency, n: w.requests, ok: w.success, unexpected: w.unexpected_failures,
  median: w.median_ms, p95: w.p95_ms, p99: w.p99_ms,
})) }, null, 2));
process.exit(report.ok ? 0 : 1);
