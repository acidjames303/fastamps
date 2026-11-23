/**
 * Small representative end-to-end claim using distinct genuine test JPEG uploads
 * (not the stress-test apple-touch-icon URL). Then admin fetch + optional approve.
 *
 * Does NOT claim mass photographic authenticity — one QA charger only.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { assertSafeMode } from './env-guard.mjs';
import { expectedAppId, baseUrl } from './target-app.mjs';
import { installerEmail, resolveServerId } from './otp-mailosaur.mjs';

assertSafeMode('genuine-photo-e2e');

const appId = expectedAppId();
const api = `${baseUrl()}/api/apps/${appId}`;
const password = process.env.CONNECT_QA_INSTALLER_PASSWORD_TEMPLATE || 'QA-Launch-2026!Pass';
const installerN = Number(process.env.CONNECT_QA_E2E_INSTALLER || '1');
const approve = process.env.CONNECT_QA_E2E_APPROVE === '1';

async function http(method, path, body, token, isForm = false) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body !== undefined && !isForm) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${api}${path}`, { method, headers, body: payload });
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

function ensureTestJpegs() {
  const dir = '/tmp/fastamps-genuine-photos';
  mkdirSync(dir, { recursive: true });
  // Reuse files if present from prior step; otherwise write minimal distinct JPEGs with COM labels.
  const serialPath = `${dir}/serial-label-test.jpg`;
  const installPath = `${dir}/install-photo-test.jpg`;
  const make = (path, label) => {
    try {
      readFileSync(path);
      return;
    } catch {
      /* create */
    }
    const base = Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUTEhIVFhUVFRUVFRUVFRUWFxUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAACxP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z',
      'base64',
    );
    // Append unique trailing bytes so hashes differ; JPEG parsers stop at EOI.
    writeFileSync(path, Buffer.concat([base, Buffer.from(`\n${label}\n`)]));
  };
  make(serialPath, 'GENUINE-TEST serial-number-label QA-LAUNCH-2026');
  make(installPath, 'GENUINE-TEST fitted-charger-install QA-LAUNCH-2026');
  return { serialPath, installPath };
}

async function uploadJpeg(token, filePath, fileName) {
  const bytes = readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), fileName);
  const res = await fetch(`${api}/integration-endpoints/Core/UploadFile`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!data.file_url) throw new Error(`upload failed ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data.file_url;
}

const { serialPath, installPath } = ensureTestJpegs();
const serverId = await resolveServerId();
const adminToken = await login(process.env.CONNECT_QA_ADMIN_EMAIL, process.env.CONNECT_QA_ADMIN_PASSWORD);
const installerToken = await login(installerEmail(installerN, serverId), password);

const serialUrl = await uploadJpeg(installerToken, serialPath, 'serial-label-test.jpg');
const installUrl = await uploadJpeg(installerToken, installPath, 'install-photo-test.jpg');

if (serialUrl === installUrl) throw new Error('serial and install uploads returned the same URL');
if (/apple-touch-icon/i.test(serialUrl) || /apple-touch-icon/i.test(installUrl)) {
  throw new Error('upload unexpectedly reused apple-touch-icon URL');
}

const chargers = (await listAll(adminToken, 'Charger')).filter(
  (c) => String(c.serial_number || '').startsWith('QA-LAUNCH-2026') && c.claim_status === 'available',
);
if (!chargers.length) throw new Error('No available QA-LAUNCH-2026 chargers for genuine-photo E2E');
const charger = chargers[0];

const submit = await http(
  'POST',
  '/functions/submit-install-claim-v2',
  {
    claim_token: charger.claim_token,
    serial_number: charger.serial_number,
    pin_code: charger.pin_code,
    serial_photo_url: serialUrl,
    install_photo_url: installUrl,
    install_date: new Date().toISOString().slice(0, 10),
    site_postcode: 'NG1 1AA',
    wholesaler: 'QA-LAUNCH-2026 Northbridge Electrical Supplies',
    wholesaler_branch: 'Shrewsbury Test Branch',
    consent_confirmed: true,
  },
  installerToken,
);

const claim = submit.data?.claim;
if (!submit.data?.success || !claim?.id) {
  console.log(JSON.stringify({ ok: false, submit }, null, 2));
  process.exit(1);
}

const createdProtected =
  claim.is_demo === true && claim.excluded_from_reporting === true && claim.reward_status === 'held';

let patched = false;
if (!createdProtected) {
  const hold = await http(
    'PUT',
    `/entities/InstallClaim/${claim.id}`,
    {
      excluded_from_reporting: true,
      exclusion_reason: 'QA-LAUNCH-2026 genuine-photo E2E — exclude from live rewards/reporting.',
      reward_status: 'held',
      is_demo: true,
      demo_label: 'QA-LAUNCH-2026',
    },
    adminToken,
  );
  patched = hold.status < 400;
}

const fetched = await http('GET', `/entities/InstallClaim/${claim.id}`, undefined, adminToken);
const row = fetched.data;

let approveResult = null;
if (approve) {
  approveResult = await http(
    'PUT',
    `/entities/InstallClaim/${claim.id}`,
    {
      status: 'approved',
      reward_status: 'held',
      is_demo: true,
      excluded_from_reporting: true,
      reviewed_at: new Date().toISOString(),
      reviewed_by_email: process.env.CONNECT_QA_ADMIN_EMAIL,
      review_note: 'Genuine-photo E2E admin review — reward remains held/excluded',
    },
    adminToken,
  );
}

const summary = {
  ok: Boolean(row?.id) && row.serial_photo_url === serialUrl && row.install_photo_url === installUrl,
  photo_kind: 'genuine_test_jpeg_upload',
  not_claimed: 'Mass photographic authenticity or physical serial-label field verification',
  serial: charger.serial_number,
  claim_id: claim.id,
  created_protected: createdProtected,
  patched_after_create: patched,
  note_on_protections: createdProtected
    ? 'Create-time demo/held/excluded already present on live function'
    : 'Live function still returns pending/unexcluded at create — harness patched; deploy submit-install-claim-v2 fix before relying on create-time protections',
  photos: {
    serial_photo_url: row?.serial_photo_url,
    install_photo_url: row?.install_photo_url,
    distinct: row?.serial_photo_url !== row?.install_photo_url,
    not_apple_touch_icon: !/apple-touch-icon/i.test(String(row?.serial_photo_url || '')),
  },
  protections: {
    is_demo: row?.is_demo,
    excluded_from_reporting: row?.excluded_from_reporting,
    reward_status: row?.reward_status,
  },
  admin_review: approve
    ? { requested: true, status: approveResult?.status, claim_status: approveResult?.data?.status }
    : { requested: false },
  wholesaler: { company: row?.wholesaler, branch: row?.wholesaler_branch },
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exit(1);
