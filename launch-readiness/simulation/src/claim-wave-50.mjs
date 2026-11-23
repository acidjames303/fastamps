/**
 * Phase 11 claim wave for installers 1–50 using available QA-LAUNCH chargers.
 * Marks claims demo/excluded/held. No Giftbit spend.
 */
import { assertSafeMode } from './env-guard.mjs';
import { expectedAppId, baseUrl } from './target-app.mjs';
import { installerEmail, resolveServerId } from './otp-mailosaur.mjs';

assertSafeMode('claim-wave-50');

const perInstaller = (() => {
  const i = process.argv.indexOf('--per-installer');
  return i >= 0 ? Number(process.argv[i + 1]) : 20;
})();
const from = (() => {
  const i = process.argv.indexOf('--from');
  return i >= 0 ? Number(process.argv[i + 1]) : 1;
})();
const to = (() => {
  const i = process.argv.indexOf('--to');
  return i >= 0 ? Number(process.argv[i + 1]) : 50;
})();
const concurrencyMax = (() => {
  const i = process.argv.indexOf('--concurrency-max');
  return i >= 0 ? Number(process.argv[i + 1]) : 25;
})();

const password = process.env.CONNECT_QA_INSTALLER_PASSWORD_TEMPLATE || 'QA-Launch-2026!Pass';
const photoUrl = process.env.CONNECT_QA_PHOTO_URL || 'https://connect.fastamps.com/apple-touch-icon.png';
const appId = expectedAppId();
const api = `${baseUrl()}/api/apps/${appId}`;

async function http(method, path, body, token) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${api}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login(email, passwordValue) {
  const { status, data } = await http('POST', '/auth/login', { email, password: passwordValue });
  if (!data.access_token) throw new Error(`login failed ${email}: ${status}`);
  return data.access_token;
}

async function listAll(token, entity) {
  const out = [];
  for (let skip = 0; ; skip += 200) {
    const { data } = await http('GET', `/entities/${entity}?limit=200&skip=${skip}`, undefined, token);
    if (!Array.isArray(data) || !data.length) break;
    out.push(...data);
    if (data.length < 200) break;
  }
  return out;
}

async function holdClaim(adminToken, claimId) {
  return http(
    'PUT',
    `/entities/InstallClaim/${claimId}`,
    {
      excluded_from_reporting: true,
      exclusion_reason: 'QA-LAUNCH-2026 synthetic stress-test claim — exclude from live rewards/reporting.',
      reward_status: 'held',
      is_demo: true,
      demo_label: 'QA-LAUNCH-2026',
    },
    adminToken,
  );
}

async function mapPool(items, concurrency, worker) {
  const results = [];
  let index = 0;
  async function run() {
    while (index < items.length) {
      const i = index++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

const serverId = await resolveServerId();
const adminToken = await login(process.env.CONNECT_QA_ADMIN_EMAIL, process.env.CONNECT_QA_ADMIN_PASSWORD);
const chargers = (await listAll(adminToken, 'Charger')).filter(
  (c) => String(c.serial_number || '').startsWith('QA-LAUNCH-2026') && c.claim_status === 'available',
);
const claims = await listAll(adminToken, 'InstallClaim');

const tokens = {};
const counts = {};
for (let n = from; n <= to; n++) {
  const email = installerEmail(n, serverId);
  tokens[n] = await login(email, password);
  counts[n] = claims.filter((c) => String(c.installer_email || '').toLowerCase() === email).length;
}

const chargerQ = [...chargers];
const work = [];
for (let n = from; n <= to; n++) {
  const need = Math.max(0, perInstaller - counts[n]);
  for (let i = 0; i < need; i++) {
    if (!chargerQ.length) break;
    work.push({ installer: n, charger: chargerQ.shift() });
  }
}

const installDate = new Date().toISOString().slice(0, 10);
async function submitOne(item) {
  const { installer, charger } = item;
  const t0 = Date.now();
  const { status, data } = await http(
    'POST',
    '/functions/submit-install-claim-v2',
    {
      claim_token: charger.claim_token,
      serial_number: charger.serial_number,
      pin_code: charger.pin_code,
      serial_photo_url: photoUrl,
      install_photo_url: photoUrl,
      install_date: installDate,
      site_postcode: 'NG1 1AA',
      wholesaler: 'QA-LAUNCH-2026 Northbridge Electrical Supplies',
      wholesaler_branch: 'Pilot Branch',
      consent_confirmed: true,
    },
    tokens[installer],
  );
  const claimId = data?.claim?.id;
  let patched = false;
  if (data?.success && claimId) {
    const hold = await holdClaim(adminToken, claimId);
    patched = hold.status < 400;
    await new Promise((r) => setTimeout(r, 220));
  }
  return {
    installer,
    serial: charger.serial_number,
    ok: Boolean(data?.success),
    status,
    claim_id: claimId,
    patched,
    error: data?.error,
    ms: Date.now() - t0,
  };
}

const ramps = [1, 5, 10, 25, concurrencyMax].filter((v, i, a) => a.indexOf(v) === i && v > 0);
let idx = 0;
const results = [];
const started = Date.now();
for (const conc of ramps) {
  if (idx >= work.length) break;
  const chunkSize =
    conc < concurrencyMax ? Math.min(work.length - idx, Math.max(conc * 4, 20)) : work.length - idx;
  const batch = work.slice(idx, idx + chunkSize);
  console.error(`RAMP concurrency=${conc} batch=${batch.length}`);
  const batchResults = await mapPool(batch, conc, submitOne);
  results.push(...batchResults);
  console.error(`  done ${batch.length} ok=${batchResults.filter((r) => r.ok).length}`);
  idx += batch.length;
}

const byInstaller = {};
for (const r of results) {
  byInstaller[r.installer] = (byInstaller[r.installer] || 0) + (r.ok ? 1 : 0);
}
const latencies = results.filter((r) => r.ok).map((r) => r.ms).sort((a, b) => a - b);
const p = (q) => latencies[Math.min(latencies.length - 1, Math.floor(q * (latencies.length - 1)))] || null;

const summary = {
  ok: results.filter((r) => r.ok).length,
  total_attempted: results.length,
  fails: results.filter((r) => !r.ok).slice(0, 20),
  fail_count: results.filter((r) => !r.ok).length,
  elapsed_s: Math.round((Date.now() - started) / 1000),
  from,
  to,
  per_installer_target: perInstaller,
  starting_counts: counts,
  added_by_installer: byInstaller,
  remaining_available_chargers: chargerQ.length,
  latency_ms: { p50: p(0.5), p95: p(0.95), n: latencies.length },
};
console.log(JSON.stringify(summary, null, 2));
if (summary.fail_count) process.exit(1);
