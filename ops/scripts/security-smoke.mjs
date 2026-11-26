#!/usr/bin/env node
/**
 * Non-destructive security smoke checks for FastAmps Connect.
 * Uses public CONNECT_APP_ID from the repo when CI secrets are not yet set.
 * Credentialed checks are skipped (not failed) when QA secrets are absent.
 */
import { CONNECT_APP_ID } from '../../launch-readiness/simulation/src/target-app.mjs';

const baseUrl = (process.env.CONNECT_PRODUCTION_URL || 'https://connect.fastamps.com').replace(/\/$/, '');
const appId = process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID || process.env.CONNECT_APP_ID || CONNECT_APP_ID;

const api = `${baseUrl}/api/apps/${appId}`;
const report = {
  ok: false,
  checked_at: new Date().toISOString(),
  app_id_source: process.env.BASE44_APP_ID
    ? 'secret'
    : (process.env.VITE_BASE44_APP_ID || process.env.CONNECT_APP_ID ? 'env' : 'repo_public_constant'),
  checks: [],
  skipped: [],
  gaps: [],
};

async function check(name, fn) {
  try {
    const result = await fn();
    report.checks.push({ name, ...result });
  } catch (e) {
    report.checks.push({ name, ok: false, error: String(e.message || e) });
  }
}

function authRejected(res, data) {
  const msg = String(data.error || data.message || data.detail || '').toLowerCase();
  const looksAuth = /auth|sign in|login|unauthor|unauthorized|forbidden|administrator/.test(msg);
  // Base44 currently returns HTTP 500 "Authentication required..." for some anonymous
  // function calls — treat as rejection only when the body clearly indicates auth failure.
  return res.status === 401 || res.status === 403 || (res.status >= 400 && looksAuth);
}

if (!appId) {
  await check('security_headers_homepage', async () => {
    const res = await fetch(`${baseUrl}/`, { headers: { 'User-Agent': 'FastAmps-security-smoke/1.0' } });
    const hsts = res.headers.get('strict-transport-security');
    const xfo = res.headers.get('x-frame-options');
    const xcto = res.headers.get('x-content-type-options');
    return {
      ok: Boolean(hsts) && /DENY|SAMEORIGIN/i.test(String(xfo || '')) && /nosniff/i.test(String(xcto || '')),
      hsts: Boolean(hsts),
      x_frame_options: xfo,
      x_content_type_options: xcto,
    };
  });
  report.skipped.push('api_auth_checks_require_app_id');
  report.ok = report.checks.every((c) => c.ok);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

await check('admin_function_rejects_anonymous', async () => {
  const res = await fetch(`${api}/functions/admin-voucher-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ request_id: 'x', action: 'refresh' }),
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: authRejected(res, data),
    http: res.status,
    detail: data.error || data.message || null,
    note: res.status === 500 ? 'platform_returns_500_for_unauthenticated' : null,
  };
});

await check('import_charger_rejects_anonymous', async () => {
  const res = await fetch(`${api}/functions/import-charger-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ action: 'import', rows: [] }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: authRejected(res, data), http: res.status, detail: data.error || null };
});

await check('claim_submit_rejects_anonymous', async () => {
  const res = await fetch(`${api}/functions/submit-install-claim-v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ claim_token: '0'.repeat(32) }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: authRejected(res, data), http: res.status, detail: data.error || null };
});

await check('security_headers_homepage', async () => {
  const res = await fetch(`${baseUrl}/`, { headers: { 'User-Agent': 'FastAmps-security-smoke/1.0' } });
  const hsts = res.headers.get('strict-transport-security');
  const xfo = res.headers.get('x-frame-options');
  const xcto = res.headers.get('x-content-type-options');
  return {
    ok: Boolean(hsts) && /DENY|SAMEORIGIN/i.test(String(xfo || '')) && /nosniff/i.test(String(xcto || '')),
    hsts: Boolean(hsts),
    x_frame_options: xfo,
    x_content_type_options: xcto,
  };
});

const email = process.env.CONNECT_QA_ADMIN_EMAIL;
const password = process.env.CONNECT_QA_ADMIN_PASSWORD;
const installerEmail = process.env.CONNECT_QA_INSTALLER_EMAIL;
const installerPassword = process.env.CONNECT_QA_INSTALLER_PASSWORD;

if (email && password) {
  await check('admin_login_ok', async () => {
    const res = await fetch(`${api}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && Boolean(data.access_token), http: res.status, role: data.user?.role || null };
  });

  await check('invalid_password_rejected', async () => {
    const res = await fetch(`${api}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password: `wrong-${Date.now()}` }),
    });
    return { ok: res.status >= 400, http: res.status };
  });
} else {
  report.skipped.push('credentialed_admin_checks_require_CONNECT_QA_ADMIN_*_secrets');
}

if (installerEmail && installerPassword) {
  await check('installer_cannot_call_admin_voucher_action', async () => {
    const login = await fetch(`${api}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: installerEmail, password: installerPassword }),
    });
    const tok = (await login.json().catch(() => {})).access_token;
    if (!tok) return { ok: false, error: 'installer_login_failed' };
    const res = await fetch(`${api}/functions/admin-voucher-action`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tok}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ request_id: 'x', action: 'refresh' }),
    });
    return { ok: res.status === 401 || res.status === 403, http: res.status };
  });
} else {
  report.skipped.push('installer_privilege_check_requires_CONNECT_QA_INSTALLER_*_secrets');
}

report.gaps.push(
  'Base44-managed auth rate limiting / lockout controls are not directly configurable from this repo — treat as platform-owned; verify in Base44 dashboard.',
);
report.gaps.push(
  'No project-owned WAF rule set in-repo. Cloudflare is present on responses; custom WAF rules not verified from this audit.',
);
report.gaps.push(
  'Continuous intrusion analytics require Base44/app log export or an external SIEM — not ACTIVE until wired.',
);

report.ok = report.checks.every((c) => c.ok);
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
