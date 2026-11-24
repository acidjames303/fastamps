/**
 * Post-deploy verification: one QA claim, read create response BEFORE any harness patch.
 * Must see is_demo + excluded_from_reporting + reward_status=held immediately.
 */
import { assertSafeMode } from './env-guard.mjs';
import { expectedAppId, baseUrl } from './target-app.mjs';
import { installerEmail, resolveServerId } from './otp-mailosaur.mjs';

assertSafeMode('verify-create-time-protections');

const appId = expectedAppId();
const api = `${baseUrl()}/api/apps/${appId}`;
const password = process.env.CONNECT_QA_INSTALLER_PASSWORD_TEMPLATE || 'QA-Launch-2026!Pass';
const photoUrl = process.env.CONNECT_QA_PHOTO_URL || 'https://connect.fastamps.com/apple-touch-icon.png';

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

const serverId = await resolveServerId();
const adminToken = await login(process.env.CONNECT_QA_ADMIN_EMAIL, process.env.CONNECT_QA_ADMIN_PASSWORD);
const installerToken = await login(installerEmail(1, serverId), password);

const chargers = (await listAll(adminToken, 'Charger')).filter(
  (c) => String(c.serial_number || '').startsWith('QA-LAUNCH-2026') && c.claim_status === 'available',
);
if (!chargers.length) throw new Error('No available QA chargers');
const charger = chargers[0];

const submit = await http(
  'POST',
  '/functions/submit-install-claim-v2',
  {
    claim_token: charger.claim_token,
    serial_number: charger.serial_number,
    pin_code: charger.pin_code,
    serial_photo_url: photoUrl,
    install_photo_url: photoUrl,
    install_date: new Date().toISOString().slice(0, 10),
    site_postcode: 'NG1 1AA',
    wholesaler: 'QA-LAUNCH-2026 Northbridge Electrical Supplies',
    wholesaler_branch: 'Pilot Branch',
    consent_confirmed: true,
  },
  installerToken,
);

const claimFromCreate = submit.data?.claim;
// Intentionally NO harness patch before reading create payload / refetch.
const refetch = claimFromCreate?.id
  ? await http('GET', `/entities/InstallClaim/${claimFromCreate.id}`, undefined, adminToken)
  : { status: 0, data: {} };
const claim = refetch.data?.id ? refetch.data : claimFromCreate;

const createdProtected =
  claim?.is_demo === true &&
  claim?.excluded_from_reporting === true &&
  claim?.reward_status === 'held';

// Voucher eligibility check: request-voucher must not treat this claim as payable.
const voucherProbe = await http('POST', '/functions/request-voucher-v2', {}, installerToken);

const summary = {
  ok: Boolean(submit.data?.success) && createdProtected,
  serial: charger.serial_number,
  claim_id: claim?.id,
  create_http: submit.status,
  create_success: Boolean(submit.data?.success),
  created_protected_from_create_payload: Boolean(
    claimFromCreate?.is_demo === true &&
      claimFromCreate?.excluded_from_reporting === true &&
      claimFromCreate?.reward_status === 'held',
  ),
  created_protected_after_refetch_no_patch: createdProtected,
  protections: {
    is_demo: claim?.is_demo,
    demo_label: claim?.demo_label,
    excluded_from_reporting: claim?.excluded_from_reporting,
    exclusion_reason: claim?.exclusion_reason,
    reward_status: claim?.reward_status,
    reward_amount: claim?.reward_amount,
    status: claim?.status,
  },
  harness_patch_applied: false,
  voucher_probe: {
    status: voucherProbe.status,
    error: voucherProbe.data?.error,
    message: voucherProbe.data?.message,
    success: voucherProbe.data?.success,
  },
  wholesaler_blank_probe: null,
};

// Wholesaler blank probe (no claim created)
const blank = await http(
  'POST',
  '/functions/submit-install-claim-v2',
  {
    claim_token: 'x',
    serial_number: 'QA',
    pin_code: '000000',
    serial_photo_url: photoUrl,
    install_photo_url: photoUrl,
    install_date: new Date().toISOString().slice(0, 10),
    site_postcode: 'NG1 1AA',
    wholesaler: '   ',
    wholesaler_branch: 'Shrewsbury',
    consent_confirmed: true,
  },
  installerToken,
);
summary.wholesaler_blank_probe = {
  status: blank.status,
  error: blank.data?.error,
  ok: blank.status === 400,
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok || !summary.wholesaler_blank_probe.ok) process.exit(1);
