/**
 * Submit QA-LAUNCH-2026 install claims with concurrency ramp (1→20).
 * Marks each claim held / demo / excluded_from_reporting after create.
 *
 * Usage:
 *   CONNECT_QA_MODE=production-authorised CONNECT_QA_CONFIRM=QA-LAUNCH-2026 \
 *     node src/claim-wave.mjs [--per-installer 20] [--concurrency-max 20]
 */
import { assertSafeMode } from './env-guard.mjs';
import { expectedAppId, baseUrl } from './target-app.mjs';
import { installerEmail, resolveServerId } from './otp-mailosaur.mjs';

assertSafeMode('claim-wave');

const perArg = process.argv.indexOf('--per-installer');
const perInstaller = perArg >= 0 ? Number(process.argv[perArg + 1] || 20) : 20;
const concArg = process.argv.indexOf('--concurrency-max');
const concurrencyMax = concArg >= 0 ? Number(process.argv[concArg + 1] || 20) : 20;
const password = process.env.CONNECT_QA_INSTALLER_PASSWORD_TEMPLATE || 'QA-Launch-2026!Pass';
const photoUrl =
  process.env.CONNECT_QA_PHOTO_URL || 'https://connect.fastamps.com/apple-touch-icon.png';
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
  const { status, data } = await http('POST', '/auth/login', {
    email,
    password: passwordValue,
  });
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
      exclusion_reason:
        'QA-LAUNCH-2026 synthetic stress-test claim — exclude from live rewards/reporting.',
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
const adminEmail = process.env.CONNECT_QA_ADMIN_EMAIL;
const adminPassword = process.env.CONNECT_QA_ADMIN_PASSWORD;
if (!adminEmail || !adminPassword) throw new Error('CONNECT_QA_ADMIN_EMAIL/PASSWORD required');

const adminToken = await login(adminEmail, adminPassword);
const chargers = (await listAll(adminToken, 'Charger')).filter(
  (c) =>
    String(c.serial_number || '').startsWith('QA-LAUNCH-2026') && c.claim_status === 'available',
);
const claims = await listAll(adminToken, 'InstallClaim');

const tokens = {};
const counts = {};
for (let n = 1; n <= 20; n++) {
  const email = installerEmail(n, serverId);
  tokens[n] = await login(email, password);
  counts[n] = claims.filter((c) => String(c.installer_email || '').toLowerCase() === email).length;
}

const chargerQ = [...chargers];
const work = [];
for (let n = 1; n <= 20; n++) {
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
  const claim = data?.claim;
  const claimId = claim?.id;
  const createdProtected =
    claim?.is_demo === true &&
    claim?.excluded_from_reporting === true &&
    claim?.reward_status === 'held';
  let patched = false;
  if (data?.success && claimId && !createdProtected) {
    const hold = await holdClaim(adminToken, claimId);
    patched = hold.status < 400;
  }
  return {
    installer,
    serial: charger.serial_number,
    ok: Boolean(data?.success),
    status,
    claim_id: claimId,
    created_protected: Boolean(createdProtected),
    patched,
    error: data?.error,
    ms: Date.now() - t0,
  };
}

const ramps = [1, 2, 5, 10, concurrencyMax].filter((v, i, a) => a.indexOf(v) === i && v > 0);
let idx = 0;
const results = [];
const started = Date.now();
for (const conc of ramps) {
  if (idx >= work.length) break;
  const chunkSize =
    conc < concurrencyMax
      ? Math.min(work.length - idx, Math.max(conc * 4, 20))
      : work.length - idx;
  const batch = work.slice(idx, idx + chunkSize);
  console.error(`RAMP concurrency=${conc} batch=${batch.length}`);
  const batchResults = await mapPool(batch, conc, submitOne);
  results.push(...batchResults);
  const ok = batchResults.filter((r) => r.ok).length;
  console.error(`  done ${batch.length} ok=${ok}`);
  idx += batch.length;
}

const summary = {
  ok: results.filter((r) => r.ok).length,
  total_attempted: results.length,
  fails: results.filter((r) => !r.ok),
  elapsed_s: Math.round((Date.now() - started) / 1000),
  per_installer_target: perInstaller,
  starting_counts: counts,
  remaining_available_chargers: chargerQ.length,
};
console.log(JSON.stringify(summary, null, 2));
if (summary.fails.length) process.exit(1);
