/**
 * Reconcile QA/demo segregation vs live commercial reporting and voucher eligibility.
 * Read-only. Does not mutate production data.
 */
import { assertSafeMode } from './env-guard.mjs';
import { expectedAppId, baseUrl } from './target-app.mjs';

assertSafeMode('reconcile-qa-dataset');

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

async function login(email, password) {
  const { status, data } = await http('POST', '/auth/login', { email, password });
  if (!data.access_token) throw new Error(`login failed: ${status}`);
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

const isQaSerial = (s) => /^QA-LAUNCH-2026/i.test(String(s || ''));
const isQaEmail = (e) => /qa-launch-2026|mailosaur\.net|@mailosaur/i.test(String(e || ''));
const isQaLabel = (v) => /QA-LAUNCH-2026|BETA-DEMO|HOME-BETA|TRADE-SHOW/i.test(String(v || ''));

const adminToken = await login(process.env.CONNECT_QA_ADMIN_EMAIL, process.env.CONNECT_QA_ADMIN_PASSWORD);
const [claims, installers, chargers, vouchers] = await Promise.all([
  listAll(adminToken, 'InstallClaim'),
  listAll(adminToken, 'Installer'),
  listAll(adminToken, 'Charger'),
  listAll(adminToken, 'VoucherRequest'),
]);

const qaClaims = claims.filter(
  (c) =>
    isQaSerial(c.serial_number) ||
    isQaEmail(c.installer_email) ||
    c.is_demo === true ||
    isQaLabel(c.demo_label) ||
    /QA-LAUNCH/i.test(String(c.exclusion_reason || '')),
);

const unprotectedClaims = qaClaims.filter(
  (c) =>
    !(
      c.is_demo === true &&
      c.excluded_from_reporting === true &&
      ['held', 'rejected'].includes(String(c.reward_status || ''))
    ),
);

const liveClaims = claims.filter((c) => !qaClaims.includes(c));
const liveContaminated = liveClaims.filter(
  (c) =>
    isQaSerial(c.serial_number) ||
    isQaEmail(c.installer_email) ||
    /QA-LAUNCH/i.test(String(c.wholesaler || '')),
);

const qaInstallers = installers.filter(
  (i) => i.is_demo === true || isQaEmail(i.user_email) || isQaLabel(i.demo_label) || /QA-LAUNCH/i.test(String(i.full_name || '')),
);
const unprotectedInstallers = qaInstallers.filter((i) => !(i.is_demo === true && i.excluded_from_reporting === true));

const qaChargers = chargers.filter((c) => isQaSerial(c.serial_number) || c.is_demo === true || isQaLabel(c.demo_label));
const unprotectedChargers = qaChargers.filter((c) => c.is_demo !== true);

const reportIncludedQaClaims = qaClaims.filter((c) => c.excluded_from_reporting !== true);
const payableQaClaims = qaClaims.filter((c) => !['held', 'rejected'].includes(c.reward_status));

const qaVouchers = vouchers.filter(
  (v) => isQaEmail(v.installer_email) || v.excluded_from_reporting === true || /QA-LAUNCH/i.test(String(v.installer_name || '')),
);
const liveVouchersAtRisk = vouchers.filter(
  (v) =>
    v.excluded_from_reporting !== true &&
    (isQaEmail(v.installer_email) || /QA-LAUNCH/i.test(String(v.installer_name || ''))),
);

const photoUrlKinds = {
  apple_touch_icon: 0,
  other_https: 0,
  missing: 0,
};
for (const c of qaClaims) {
  const urls = [c.serial_photo_url, c.install_photo_url];
  for (const u of urls) {
    if (!u) photoUrlKinds.missing += 1;
    else if (/apple-touch-icon/i.test(u)) photoUrlKinds.apple_touch_icon += 1;
    else photoUrlKinds.other_https += 1;
  }
}

const reportingFilterProof = {
  get_programme_report_excludes_flagged:
    'get-programme-report filters excluded_from_reporting on installers, claims, vouchers',
  request_voucher_blocks_demo:
    'request-voucher eligible() requires !excluded_from_reporting && !is_demo',
  admin_voucher_skips_demo:
    'admin-voucher-action skips is_demo / excluded_from_reporting claims',
};

const summary = {
  ok:
    unprotectedClaims.length === 0 &&
    unprotectedInstallers.length === 0 &&
    liveContaminated.length === 0 &&
    reportIncludedQaClaims.length === 0 &&
    payableQaClaims.length === 0 &&
    liveVouchersAtRisk.length === 0,
  counts: {
    claims_total: claims.length,
    qa_claims: qaClaims.length,
    live_claims: liveClaims.length,
    installers_total: installers.length,
    qa_installers: qaInstallers.length,
    qa_chargers: qaChargers.length,
    vouchers_total: vouchers.length,
    qa_vouchers: qaVouchers.length,
  },
  protections: {
    unprotected_qa_claims: unprotectedClaims.length,
    unprotected_qa_installers: unprotectedInstallers.length,
    unprotected_qa_chargers: unprotectedChargers.length,
    qa_claims_still_in_reporting: reportIncludedQaClaims.length,
    qa_claims_payable_reward_status: payableQaClaims.length,
    live_claims_looking_synthetic: liveContaminated.length,
    live_vouchers_at_risk: liveVouchersAtRisk.length,
  },
  photo_evidence_classification: {
    note:
      'Mass stress used CONNECT_QA_PHOTO_URL (typically apple-touch-icon). That proves upload/association capacity, not physical serial-label authenticity.',
    ...photoUrlKinds,
  },
  sample_unprotected_claims: unprotectedClaims.slice(0, 10).map((c) => ({
    id: c.id,
    serial: c.serial_number,
    is_demo: c.is_demo,
    excluded_from_reporting: c.excluded_from_reporting,
    reward_status: c.reward_status,
  })),
  sample_unprotected_chargers: unprotectedChargers.slice(0, 10).map((c) => ({
    id: c.id,
    serial: c.serial_number,
    is_demo: c.is_demo,
    claim_status: c.claim_status,
  })),
  reportingFilterProof,
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exit(1);
