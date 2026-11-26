#!/usr/bin/env node
/**
 * Zero-AI production health check for FastAmps Connect.
 * Safe for scheduled CI / cron. No secrets required for the public checks.
 *
 * Optional env:
 *   BASE44_APP_ID, BASE44_API_KEY — deeper API/schema checks
 *   CONNECT_QA_ADMIN_EMAIL, CONNECT_QA_ADMIN_PASSWORD — authenticated smoke (CI secrets only)
 *   EXPECTED_SPA_JS — e.g. assets/index-Ct1Q8Oqd.js (fail if live differs)
 *   HEALTH_WEBHOOK_URL — POST JSON summary on failure (optional)
 *
 * Exit 0 = healthy / degraded-but-ok thresholds
 * Exit 1 = unhealthy
 * Exit 2 = misconfigured
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const opsRoot = join(__dirname, '..');
const statePath = join(opsRoot, 'maintenance-state.json');
const historyPath = join(opsRoot, 'deployment-history.jsonl');
const baseUrl = (process.env.CONNECT_PRODUCTION_URL || 'https://connect.fastamps.com').replace(/\/$/, '');
const appId = process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID || '';
const apiKey = process.env.BASE44_API_KEY || '';

const started = Date.now();
const report = {
  ok: false,
  status: 'unknown',
  checked_at: new Date().toISOString(),
  production_url: baseUrl,
  checks: {},
  alerts: [],
};

async function fetchText(url, init = {}) {
  const t0 = Date.now();
  const res = await fetch(url, {
    ...init,
    headers: {
      'User-Agent': 'FastAmps-Connect-HealthCheck/1.0',
      Accept: '*/*',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  return { status: res.status, ok: res.ok, text, ms: Date.now() - t0, headers: res.headers };
}

function loadState() {
  if (!existsSync(statePath)) return {};
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(patch) {
  const prev = loadState();
  const next = {
    ...prev,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  mkdirSync(opsRoot, { recursive: true });
  writeFileSync(statePath, JSON.stringify(next, null, 2));
  return next;
}

// 1) Public homepage
const home = await fetchText(`${baseUrl}/`);
report.checks.homepage = {
  http: home.status,
  ms: home.ms,
  ok: home.status === 200 && /<!doctype html|<html/i.test(home.text),
};
if (!report.checks.homepage.ok) report.alerts.push('homepage_unavailable');

const spaMatch = home.text.match(/assets\/index-[A-Za-z0-9_-]+\.js/);
const spaAsset = spaMatch ? spaMatch[0] : null;
report.checks.spa_asset = { asset: spaAsset, ok: Boolean(spaAsset) };
if (!spaAsset) report.alerts.push('spa_asset_missing');

const expectedSpa = process.env.EXPECTED_SPA_JS || '';
if (expectedSpa) {
  report.checks.spa_expected = {
    expected: expectedSpa,
    actual: spaAsset,
    ok: spaAsset === expectedSpa || spaAsset === expectedSpa.replace(/^\//, ''),
  };
  if (!report.checks.spa_expected.ok) report.alerts.push('spa_version_mismatch');
}

// 2) SPA JS reachable + marker probe
if (spaAsset) {
  const js = await fetchText(`${baseUrl}/${spaAsset}`);
  const markers = {
    welcome: js.text.includes('/welcome'),
    pre_register: js.text.includes('/pre-register'),
    admin_programmes: js.text.includes('/admin/programmes'),
  };
  report.checks.spa_js = {
    http: js.status,
    ms: js.ms,
    bytes: js.text.length,
    markers,
    ok: js.status === 200 && js.text.length > 100_000 && markers.welcome && markers.pre_register,
  };
  if (!report.checks.spa_js.ok) report.alerts.push('spa_js_unhealthy');
}

// 3) Public invite (unauthenticated programme status) — must stay inactive for genuine Links
{
  const path = appId
    ? `${baseUrl}/api/apps/${appId}/functions/manage-incentive-programme`
    : null;
  if (path) {
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'FastAmps-Connect-HealthCheck/1.0',
      },
      body: JSON.stringify({ action: 'public_invite', programme_code: 'links-electrical-shrewsbury' }),
    });
    const data = await res.json().catch(() => ({}));
    report.checks.genuine_links_invite = {
      http: res.status,
      active: data.active === true,
      status: data.status || null,
      ok: res.ok && data.active === false && data.status === 'draft',
    };
    if (data.active === true) report.alerts.push('genuine_links_unexpectedly_active');
    if (!report.checks.genuine_links_invite.ok && res.ok === false) {
      report.alerts.push('invite_endpoint_error');
    }
  } else {
    report.checks.genuine_links_invite = { ok: null, skipped: 'BASE44_APP_ID not set' };
  }
}

// 4) Optional schema integrity (API key)
if (appId && apiKey) {
  const res = await fetch(`${baseUrl}/api/apps/${appId}/entity-schemas/Installer`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'User-Agent': 'FastAmps-Connect-HealthCheck/1.0',
    },
  });
  const data = await res.json().catch(() => ({}));
  const props = data.properties || data.entity_schema?.properties || {};
  report.checks.installer_schema = {
    http: res.status,
    membership_status: Boolean(props.membership_status),
    qa_financial_lifecycle: Boolean(props.qa_financial_lifecycle),
    ok: res.ok && Boolean(props.membership_status),
  };
  if (!report.checks.installer_schema.ok) report.alerts.push('installer_schema_missing_fields');
}

// 5) Optional auth smoke (does not mutate data)
const adminEmail = process.env.CONNECT_QA_ADMIN_EMAIL || '';
const adminPassword = process.env.CONNECT_QA_ADMIN_PASSWORD || '';
if (appId && adminEmail && adminPassword) {
  const t0 = Date.now();
  const res = await fetch(`${baseUrl}/api/apps/${appId}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'FastAmps-Connect-HealthCheck/1.0',
    },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const data = await res.json().catch(() => ({}));
  report.checks.admin_login_smoke = {
    http: res.status,
    ms: Date.now() - t0,
    ok: res.ok && Boolean(data.access_token),
    role_present: Boolean(data.user?.role || data.role),
  };
  if (!report.checks.admin_login_smoke.ok) report.alerts.push('admin_login_failed');

  // Negative: invalid password must fail
  const bad = await fetch(`${baseUrl}/api/apps/${appId}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'FastAmps-Connect-HealthCheck/1.0',
    },
    body: JSON.stringify({ email: adminEmail, password: `invalid-${Date.now()}` }),
  });
  report.checks.invalid_login_rejected = {
    http: bad.status,
    ok: bad.status >= 400,
  };
  if (!report.checks.invalid_login_rejected.ok) report.alerts.push('invalid_login_not_rejected');
}

const hardFails = report.alerts.filter((a) =>
  [
    'homepage_unavailable',
    'spa_asset_missing',
    'spa_js_unhealthy',
    'spa_version_mismatch',
    'genuine_links_unexpectedly_active',
    'installer_schema_missing_fields',
    'admin_login_failed',
  ].includes(a),
);

report.ok = hardFails.length === 0;
report.status = report.ok ? (report.alerts.length ? 'degraded' : 'online') : 'offline';
report.duration_ms = Date.now() - started;

const state = saveState({
  last_health_check: report.checked_at,
  last_health_status: report.status,
  last_spa_asset: spaAsset,
  last_alerts: report.alerts,
  last_verified_release: loadState().last_verified_release || null,
  monitoring: {
    production_health_check: 'ACTIVE',
    mechanism: 'ops/scripts/production-health-check.mjs + GitHub Actions schedule',
    ai_invoked: false,
  },
});

const outDir = process.env.HEALTH_ARTIFACT_DIR || '/opt/cursor/artifacts/ops';
try {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'last-health-check.json'), JSON.stringify(report, null, 2));
} catch {
  // artifacts dir may be unavailable outside cloud agents
  writeFileSync(join(opsRoot, 'last-health-check.json'), JSON.stringify(report, null, 2));
}

if (!report.ok && process.env.HEALTH_WEBHOOK_URL) {
  try {
    await fetch(process.env.HEALTH_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `FastAmps Connect health ${report.status}: ${report.alerts.join(', ') || 'unknown'}`,
        report,
      }),
    });
    report.webhook_notified = true;
  } catch (e) {
    report.webhook_notified = false;
    report.webhook_error = String(e.message || e);
  }
}

console.log(JSON.stringify({ ...report, state_file: statePath }, null, 2));
process.exit(report.ok ? 0 : 1);
