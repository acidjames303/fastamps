/**
 * Phase 11 prep: import W2 QA chargers + ensure installer 21–50 can register.
 * External harness only. Requires CONNECT_QA_MODE=production-authorised + CONFIRM.
 *
 *   node src/stress-50-prepare.mjs --import-chargers 650
 *   node src/stress-50-prepare.mjs --register-from 21 --register-to 50
 */
import { assertSafeMode } from './env-guard.mjs';
import { expectedAppId, baseUrl } from './target-app.mjs';
import {
  installerEmail,
  mailosaurConfigured,
  resolveServerId,
  waitForOtp,
} from './otp-mailosaur.mjs';

assertSafeMode('stress-50-prepare');

const appId = expectedAppId();
const api = `${baseUrl()}/api/apps/${appId}`;
const password = process.env.CONNECT_QA_INSTALLER_PASSWORD_TEMPLATE || 'QA-Launch-2026!Pass';
const PREFIX = 'QA-LAUNCH-2026-W2';

function argNum(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

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

async function importChargers(count, { startIndex = 1, pinBase = 800000 } = {}) {
  const adminToken = await login(process.env.CONNECT_QA_ADMIN_EMAIL, process.env.CONNECT_QA_ADMIN_PASSWORD);
  const rows = Array.from({ length: count }, (_, i) => {
    const n = startIndex + i;
    return {
      serial_number: `${PREFIX}-S${String(n).padStart(5, '0')}`,
      pin_code: String(pinBase + n).padStart(6, '0'),
      product_model: 'Alpha 7',
      supplied_to_type: 'wholesaler',
      supplied_to_name_raw: 'QA-LAUNCH-2026 Northbridge Electrical Supplies',
      supplied_to_branch_raw: 'Pilot Branch',
      source_batch_identifier: `${PREFIX}-BATCH`,
    };
  });
  // Import in chunks of 100
  const created = [];
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { status, data } = await http(
      'POST',
      '/functions/import-charger-batch',
      {
        action: 'import',
        batch_reference: `${PREFIX}-${new Date().toISOString().slice(0, 10)}`,
        qr_generated: true,
        rows: chunk,
      },
      adminToken,
    );
    created.push({
      status,
      success: data.success === true,
      created_count: data.created_count,
      error: data.error || null,
    });
    if (!data.success) break;
  }
  // Patch demo flags on W2 chargers
  const all = [];
  for (let skip = 0; ; skip += 200) {
    const { data } = await http('GET', `/entities/Charger?limit=200&skip=${skip}`, undefined, adminToken);
    if (!Array.isArray(data) || !data.length) break;
    all.push(...data);
    if (data.length < 200) break;
  }
  const w2 = all.filter((c) => String(c.serial_number || '').startsWith(PREFIX));
  let patched = 0;
  for (const c of w2) {
    if (c.is_demo && c.excluded_from_reporting) continue;
    const { status } = await http(
      'PUT',
      `/entities/Charger/${c.id}`,
      {
        is_demo: true,
        demo_label: 'QA-LAUNCH-2026',
        excluded_from_reporting: true,
        exclusion_reason: 'QA-LAUNCH-2026 W2 stress cohort charger',
      },
      adminToken,
    );
    if (status < 400) patched += 1;
    await new Promise((r) => setTimeout(r, 50));
  }
  return { importChunks: created, w2Count: w2.length, patched };
}

async function registerRange(from, to) {
  if (!mailosaurConfigured()) throw new Error('Mailosaur not configured');
  const serverId = await resolveServerId();
  const results = [];
  for (let n = from; n <= to; n++) {
    const email = installerEmail(n, serverId);
    const entry = { n, email };
    try {
      const reg = await http('POST', '/auth/register', { email, password });
      entry.register = reg.status;
      if (reg.status >= 400 && !/already|exist/i.test(JSON.stringify(reg.data))) {
        entry.ok = false;
        entry.error = reg.data;
        results.push(entry);
        continue;
      }
      const otpResult = await waitForOtp({ email, timeoutMs: 180_000 });
      if (!otpResult.ok) {
        entry.ok = false;
        entry.otp = otpResult.error;
        results.push(entry);
        continue;
      }
      const ver = await http('POST', '/auth/verify-otp', { email, otp_code: otpResult.otp });
      const token = ver.data.access_token;
      if (!token) {
        entry.ok = false;
        entry.verify = ver.data;
        results.push(entry);
        continue;
      }
      const profile = await http(
        'POST',
        '/functions/register-installer',
        {
          action: 'register',
          full_name: `QA-LAUNCH-2026 Installer ${n}`,
          business_name: `QA-LAUNCH-2026 Electrical Ltd ${n}`,
          mobile: `0789${String(n).padStart(7, '0')}`, // unique 11-digit 07…
          email,
          nominated_wholesaler: 'QA-LAUNCH-2026 Northbridge Electrical Supplies',
          nominated_branch: 'Pilot Branch',
          region: n % 2 === 0 ? 'North West' : 'South East',
          terms_accepted: true,
          programme_terms_version: '2026-10-v1',
          demo: true,
        },
        token,
      );
      // Force demo/excluded on installer record
      const adminToken = await login(process.env.CONNECT_QA_ADMIN_EMAIL, process.env.CONNECT_QA_ADMIN_PASSWORD);
      const installers = await http('GET', '/entities/Installer?limit=250', undefined, adminToken);
      const hit = (installers.data || []).find((i) => String(i.user_email || i.email || '').toLowerCase() === email.toLowerCase());
      if (hit) {
        await http(
          'PUT',
          `/entities/Installer/${hit.id}`,
          {
            is_demo: true,
            demo_label: 'QA-LAUNCH-2026',
            excluded_from_reporting: true,
            exclusion_reason: 'QA-LAUNCH-2026 W2 stress installer',
          },
          adminToken,
        );
      }
      entry.ok = true;
      entry.profile = profile.status;
    } catch (error) {
      entry.ok = false;
      entry.error = error.message;
    }
    results.push(entry);
  }
  return results;
}

const summary = { ok: true };
if (process.argv.includes('--import-chargers')) {
  summary.import = await importChargers(argNum('--import-chargers', 650), {
    startIndex: argNum('--start-index', 1),
    pinBase: argNum('--pin-base', 800000),
  });
}
if (process.argv.includes('--register-from')) {
  const from = argNum('--register-from', 21);
  const to = argNum('--register-to', 50);
  summary.register = await registerRange(from, to);
  summary.ok = summary.register.every((r) => r.ok);
}
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);
