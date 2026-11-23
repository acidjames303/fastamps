/**
 * Register N QA-LAUNCH-2026 installers via genuine Base44 auth + Mailosaur OTP.
 * Usage: CONNECT_QA_MODE=production-authorised CONNECT_QA_CONFIRM=QA-LAUNCH-2026 \
 *   node src/register-qa-installers.mjs [--count 2]
 */
import { assertSafeMode } from './env-guard.mjs';
import {
  describeMailosaurPlan,
  installerEmail,
  mailosaurConfigured,
  resolveServerId,
  waitForOtp,
} from './otp-mailosaur.mjs';
import { expectedAppId, baseUrl } from './target-app.mjs';

assertSafeMode('register-qa-installers');

const countArg = process.argv.indexOf('--count');
const count = countArg >= 0 ? Number(process.argv[countArg + 1] || 2) : 2;
const password = process.env.CONNECT_QA_INSTALLER_PASSWORD_TEMPLATE || 'QA-Launch-2026!Pass';
const appId = expectedAppId();
const api = `${baseUrl()}/api/apps/${appId}`;

async function register(email) {
  const res = await fetch(`${api}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function verifyOtp(email, otp) {
  const res = await fetch(`${api}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, otp_code: otp }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function completeInstallerProfile(accessToken, n, email) {
  // Best-effort onboarding via register-installer function if available
  const res = await fetch(`${api}/functions/register-installer`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      action: 'register',
      full_name: `QA-LAUNCH-2026 Installer ${n}`,
      business_name: `QA-LAUNCH-2026 Electrical Ltd ${n}`,
      mobile: `07${String(700000000 + n).slice(0, 9)}`,
      email,
      nominated_wholesaler: 'QA-LAUNCH-2026 Northbridge Electrical Supplies',
      nominated_branch: 'Pilot Branch',
      region: n % 2 === 0 ? 'North West' : 'South East',
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const plan = await describeMailosaurPlan();
if (!plan.ok || !mailosaurConfigured()) {
  console.log(JSON.stringify({ ok: false, plan }, null, 2));
  process.exit(2);
}

const serverId = await resolveServerId();
const results = [];

for (let n = 1; n <= count; n++) {
  const email = installerEmail(n, serverId);
  const entry = { n, email, steps: {} };
  try {
    const reg = await register(email);
    entry.steps.register = { status: reg.status, message: reg.data.message || reg.data.error || null };
    if (reg.status >= 400 && !/already|exist/i.test(JSON.stringify(reg.data))) {
      entry.ok = false;
      entry.error = reg.data;
      results.push(entry);
      continue;
    }
    const otpResult = await waitForOtp({ email, timeoutMs: 180_000 });
    entry.steps.otp = {
      ok: otpResult.ok,
      error: otpResult.error || null,
      otpLength: otpResult.otpLength || null,
    };
    if (!otpResult.ok) {
      entry.ok = false;
      results.push(entry);
      continue;
    }
    const ver = await verifyOtp(email, otpResult.otp);
    const token = ver.data.access_token;
    entry.steps.verify = {
      status: ver.status,
      success: Boolean(token),
      userId: ver.data.user?.id || ver.data.id || null,
    };
    if (!token) {
      entry.ok = false;
      entry.error = ver.data;
      results.push(entry);
      continue;
    }
    const profile = await completeInstallerProfile(token, n, email);
    entry.steps.profile = {
      status: profile.status,
      ok: profile.status < 400,
      error: profile.data.error || null,
    };
    entry.ok = entry.steps.verify.success === true;
  } catch (error) {
    entry.ok = false;
    entry.error = error.message;
  }
  results.push(entry);
}

const summary = {
  ok: results.every((r) => r.ok),
  serverId,
  count,
  verified: results.filter((r) => r.ok).length,
  results: results.map((r) => ({
    n: r.n,
    email: r.email,
    ok: r.ok,
    steps: r.steps,
    error: r.error || null,
  })),
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);
