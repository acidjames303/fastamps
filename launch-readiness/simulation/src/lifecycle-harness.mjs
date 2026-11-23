/**
 * Isolated QA lifecycle harness — approval / wallet / redemption boundary.
 *
 * Does NOT lift is_demo or excluded_from_reporting on QA-LAUNCH-2026 records.
 * Admin approve mirrors AdminInstalls.jsx: status=approved while reward_status
 * stays held when already held. Production voucher path must reject the cohort.
 *
 * Usage:
 *   CONNECT_QA_MODE=production-authorised CONNECT_QA_CONFIRM=QA-LAUNCH-2026 \
 *     node src/lifecycle-harness.mjs
 */
import { assertSafeMode } from './env-guard.mjs';
import { expectedAppId, baseUrl } from './target-app.mjs';

assertSafeMode('lifecycle-harness');

const appId = expectedAppId();
const api = `${baseUrl()}/api/apps/${appId}`;
const server =
  (process.env.MAILOSAUR_SMTP_USER || '').split('@')[0] ||
  (process.env.MAILOSAUR_SERVER_ID?.length <= 12 ? process.env.MAILOSAUR_SERVER_ID : '') ||
  '8deitqir';
const password = process.env.CONNECT_QA_INSTALLER_PASSWORD_TEMPLATE || 'QA-Launch-2026!Pass';
const PREFIX = 'QA-LAUNCH-2026';

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
  if (!data.access_token) throw new Error(`login failed ${email}: ${status} ${data.message || data.error || ''}`);
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

function isQaClaim(claim) {
  return String(claim.serial_number || '').startsWith(PREFIX);
}

/** Mirror AdminInstalls approve: keep held/rejected reward_status. */
function approvePatch(claim, adminUser) {
  return {
    status: 'approved',
    warranty_status: 'registered',
    reward_status: ['held', 'rejected'].includes(claim.reward_status)
      ? claim.reward_status
      : 'approved',
    review_note: claim.review_note || 'QA-LAUNCH-2026 admin photo/serial review (lifecycle harness)',
    reviewed_by_name: adminUser.full_name || adminUser.email,
    reviewed_by_email: adminUser.email,
    reviewed_at: new Date().toISOString(),
    // Preserve safety flags explicitly
    is_demo: true,
    demo_label: 'QA-LAUNCH-2026',
    excluded_from_reporting: true,
  };
}

function walletFromClaims(claims, installer) {
  // Mirror Earnings.jsx activeClaims filter
  const active = claims.filter((c) => !c.excluded_from_reporting && !c.is_demo);
  const approved = active.filter(
    (c) =>
      c.reward_status === 'approved' &&
      c.status === 'approved' &&
      c.serial_photo_url &&
      c.install_photo_url,
  );
  const eligibleValue = approved.reduce((s, c) => s + Number(c.reward_amount || 0), 0);
  const accountHeld = ['held', 'blocked'].includes(installer.reward_account_status);
  return {
    activeCount: active.length,
    approvedCount: approved.length,
    eligibleValue,
    availableValue: accountHeld ? 0 : eligibleValue,
    accountHeld,
  };
}

const adminEmail = process.env.CONNECT_QA_ADMIN_EMAIL;
const adminPassword = process.env.CONNECT_QA_ADMIN_PASSWORD;
if (!adminEmail || !adminPassword) throw new Error('admin secrets required');

const adminToken = await login(adminEmail, adminPassword);
const { data: adminMe } = await http('GET', '/auth/me', undefined, adminToken);
const adminUser = adminMe?.email ? adminMe : { email: adminEmail, full_name: 'QA Admin' };

const allClaims = await listAll(adminToken, 'InstallClaim');
const qaClaims = allClaims.filter(isQaClaim);
const installers = (await listAll(adminToken, 'Installer')).filter(
  (i) => String(i.demo_label || '') === 'QA-LAUNCH-2026' || String(i.user_email || '').includes('qa-launch-2026-installer'),
);

const report = {
  ok: true,
  cohort: {
    claims: qaClaims.length,
    installers: installers.length,
    demo_claims: qaClaims.filter((c) => c.is_demo).length,
    excluded_claims: qaClaims.filter((c) => c.excluded_from_reporting).length,
    held_rewards: qaClaims.filter((c) => c.reward_status === 'held').length,
  },
  approval: {},
  samples: {},
  wallets: [],
  voucher_blocks: [],
  safety: {},
};

// --- 1) Sample reject + needs_information (2 claims each) before bulk approve ---
const submitted = qaClaims.filter((c) => c.status === 'submitted' && c.serial_photo_url && c.install_photo_url);
const rejectTargets = submitted.slice(0, 2);
const infoTargets = submitted.slice(2, 4);

for (const claim of rejectTargets) {
  const { status, data } = await http(
    'PUT',
    `/entities/InstallClaim/${claim.id}`,
    {
      status: 'rejected',
      warranty_status: 'declined',
      reward_status: 'rejected',
      rejection_reason: 'unclear_serial_photo',
      review_note: 'QA-LAUNCH-2026 harness rejection sample — unclear serial photo',
      reviewed_by_name: adminUser.full_name || adminUser.email,
      reviewed_by_email: adminUser.email,
      reviewed_at: new Date().toISOString(),
      is_demo: true,
      demo_label: 'QA-LAUNCH-2026',
      excluded_from_reporting: true,
    },
    adminToken,
  );
  report.samples.reject = report.samples.reject || [];
  report.samples.reject.push({ id: claim.id, serial: claim.serial_number, http: status, status: data.status, reward: data.reward_status });
  if (claim.charger_record_id) {
    await http('PUT', `/entities/Charger/${claim.charger_record_id}`, { claim_status: 'available', install_claim_id: '' }, adminToken);
  }
}

for (const claim of infoTargets) {
  const { status, data } = await http(
    'PUT',
    `/entities/InstallClaim/${claim.id}`,
    {
      status: 'needs_information',
      review_note: 'QA-LAUNCH-2026 harness — please re-upload a clearer install photo',
      information_request_count: (claim.information_request_count || 0) + 1,
      reviewed_by_name: adminUser.full_name || adminUser.email,
      reviewed_by_email: adminUser.email,
      reviewed_at: new Date().toISOString(),
      is_demo: true,
      demo_label: 'QA-LAUNCH-2026',
      excluded_from_reporting: true,
      reward_status: 'held',
    },
    adminToken,
  );
  report.samples.needs_information = report.samples.needs_information || [];
  report.samples.needs_information.push({ id: claim.id, serial: claim.serial_number, http: status, status: data.status });
}

// --- 2) Bulk approve remaining submitted QA claims (reward stays held) ---
const toApprove = qaClaims.filter(
  (c) =>
    c.status === 'submitted' &&
    c.serial_photo_url &&
    c.install_photo_url &&
    !rejectTargets.some((t) => t.id === c.id) &&
    !infoTargets.some((t) => t.id === c.id),
);

// Base44 entity_update limit ≈ 350/min per caller — pace updates and honour Retry-After.
let approved = 0;
let approveFailed = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < toApprove.length; i++) {
  const claim = toApprove[i];
  let status;
  let data;
  for (let attempt = 0; attempt < 8; attempt++) {
    ({ status, data } = await http(
      'PUT',
      `/entities/InstallClaim/${claim.id}`,
      approvePatch(claim, adminUser),
      adminToken,
    ));
    if (status !== 429) break;
    const msg = String(data?.message || data?.detail || '');
    const m = msg.match(/Retry after (\d+)s/i);
    await sleep(((m ? Number(m[1]) : 20) + 2) * 1000);
  }
  if (status < 400 && data.status === 'approved') {
    // Re-assert safety flags if the platform echoed a partial body.
    if (data.is_demo !== true || data.excluded_from_reporting !== true || data.reward_status !== 'held') {
      await http(
        'PUT',
        `/entities/InstallClaim/${claim.id}`,
        {
          is_demo: true,
          demo_label: 'QA-LAUNCH-2026',
          excluded_from_reporting: true,
          reward_status: 'held',
        },
        adminToken,
      );
    }
    approved += 1;
  } else {
    approveFailed += 1;
  }
  await sleep(220);
  if ((i + 1) % 50 === 0 || i + 1 === toApprove.length) {
    console.error(`approve progress ${i + 1}/${toApprove.length} ok=${approved} fail=${approveFailed}`);
  }
}
report.approval = { targeted: toApprove.length, approved, failed: approveFailed };

// --- 3) Wallet verification per installer (must be £0 redeemable) ---
for (let n = 1; n <= 20; n++) {
  const email = `qa-launch-2026-installer${String(n).padStart(2, '0')}@${server}.mailosaur.net`;
  const installer = installers.find((i) => String(i.user_email || '').toLowerCase() === email);
  const claims = (await listAll(adminToken, 'InstallClaim')).filter(
    (c) => String(c.installer_email || '').toLowerCase() === email,
  );
  const wallet = walletFromClaims(claims, installer || { reward_account_status: 'held' });
  const token = await login(email, password);
  const voucherAttempt = await http('POST', '/functions/request-voucher-v2', {}, token);
  report.wallets.push({
    installer: n,
    email,
    installs: claims.length,
    approved_status: claims.filter((c) => c.status === 'approved').length,
    ...wallet,
  });
  report.voucher_blocks.push({
    installer: n,
    http: voucherAttempt.status,
    error: voucherAttempt.data?.error || voucherAttempt.data?.message,
    blocked: voucherAttempt.status >= 400 || !voucherAttempt.data?.success || Boolean(voucherAttempt.data?.error),
  });
}

// --- 4) Safety invariants ---
const refreshed = (await listAll(adminToken, 'InstallClaim')).filter(isQaClaim);
report.safety = {
  all_still_demo: refreshed.every((c) => c.is_demo === true),
  all_still_excluded: refreshed.every((c) => c.excluded_from_reporting === true),
  no_payable_reward: refreshed.every((c) => !['approved', 'issued', 'redemption_requested'].includes(c.reward_status) || c.is_demo),
  // held/rejected only for rewards on QA cohort after this harness
  reward_statuses: refreshed.reduce((acc, c) => {
    acc[c.reward_status] = (acc[c.reward_status] || 0) + 1;
    return acc;
  }, {}),
  status_counts: refreshed.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {}),
  wallets_all_zero: report.wallets.every((w) => w.availableValue === 0 && w.eligibleValue === 0),
  voucher_all_blocked: report.voucher_blocks.every((v) => v.blocked),
};

report.ok =
  report.approval.failed === 0 &&
  report.safety.all_still_demo &&
  report.safety.all_still_excluded &&
  report.safety.wallets_all_zero &&
  report.safety.voucher_all_blocked &&
  (report.samples.reject?.length || 0) === 2 &&
  (report.samples.needs_information?.length || 0) === 2;

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
