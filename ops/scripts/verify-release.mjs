#!/usr/bin/env node
/**
 * Release verification gate for FastAmps Connect.
 * A git push / merge / Base44 save alone is NOT success.
 *
 * Modes:
 *   node ops/scripts/verify-release.mjs              # live vs local dist (build first)
 *   node ops/scripts/verify-release.mjs --live-only  # live fingerprints only
 *   node ops/scripts/verify-release.mjs --record     # append deployment-history on success
 *
 * Exit 0 = VERIFIED
 * Exit 1 = DEPLOYMENT UNVERIFIED
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const opsRoot = join(__dirname, '..');
const liveOnly = process.argv.includes('--live-only');
const record = process.argv.includes('--record');
const skipBuild = process.argv.includes('--skip-build');
const baseUrl = (process.env.CONNECT_PRODUCTION_URL || 'https://connect.fastamps.com').replace(/\/$/, '');

const result = {
  verdict: 'DEPLOYMENT UNVERIFIED',
  ok: false,
  checked_at: new Date().toISOString(),
  production_url: baseUrl,
  repository: {},
  local_build: {},
  live: {},
  schema: {},
  programme: {},
  mismatches: [],
};

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function git(cmd) {
  try {
    return execSync(cmd, { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

result.repository = {
  head: git('git rev-parse HEAD'),
  branch: git('git rev-parse --abbrev-ref HEAD'),
  short: git('git rev-parse --short HEAD'),
  subject: git('git log -1 --pretty=%s'),
};

if (!liveOnly && !skipBuild) {
  try {
    execSync('npm run build', { cwd: repoRoot, stdio: 'inherit' });
    result.local_build.build = 'ok';
  } catch (e) {
    result.local_build.build = 'failed';
    result.mismatches.push('local_build_failed');
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

const distHtmlPath = join(repoRoot, 'dist/index.html');
if (existsSync(distHtmlPath)) {
  const html = readFileSync(distHtmlPath, 'utf8');
  const js = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0] || null;
  const css = html.match(/assets\/index-[A-Za-z0-9_-]+\.css/)?.[0] || null;
  result.local_build = {
    ...result.local_build,
    index_html: true,
    spa_js: js,
    spa_css: css,
  };
  if (js && existsSync(join(repoRoot, 'dist', js))) {
    result.local_build.spa_js_sha256 = sha256(readFileSync(join(repoRoot, 'dist', js))).slice(0, 16);
  }
} else if (!liveOnly) {
  result.mismatches.push('dist_index_missing');
}

const homeRes = await fetch(`${baseUrl}/`, {
  headers: { 'User-Agent': 'FastAmps-verify-release/1.0' },
});
const homeHtml = await homeRes.text();
const liveJs = homeHtml.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0] || null;
const liveCss = homeHtml.match(/assets\/index-[A-Za-z0-9_-]+\.css/)?.[0] || null;
result.live.homepage_http = homeRes.status;
result.live.spa_js = liveJs;
result.live.spa_css = liveCss;

if (homeRes.status !== 200 || !liveJs) {
  result.mismatches.push('live_homepage_or_spa_missing');
} else {
  const jsRes = await fetch(`${baseUrl}/${liveJs}`, {
    headers: { 'User-Agent': 'FastAmps-verify-release/1.0' },
  });
  const jsBuf = Buffer.from(await jsRes.arrayBuffer());
  const jsText = jsBuf.toString('utf8');
  result.live.spa_js_http = jsRes.status;
  result.live.spa_js_sha256 = sha256(jsBuf).slice(0, 16);
  result.live.markers = {
    welcome: jsText.includes('/welcome'),
    pre_register: jsText.includes('/pre-register'),
    admin_programmes: jsText.includes('/admin/programmes'),
  };
  if (!result.live.markers.welcome || !result.live.markers.pre_register) {
    result.mismatches.push('live_spa_missing_expected_routes');
  }
}

if (result.local_build.spa_js && result.live.spa_js && result.local_build.spa_js !== result.live.spa_js) {
  result.mismatches.push('spa_filename_mismatch_local_vs_live');
}
if (
  result.local_build.spa_js_sha256
  && result.live.spa_js_sha256
  && result.local_build.spa_js_sha256 !== result.live.spa_js_sha256
) {
  result.mismatches.push('spa_content_hash_mismatch_local_vs_live');
}

const appId = process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID || '';
const apiKey = process.env.BASE44_API_KEY || '';
if (appId && apiKey) {
  const schemaRes = await fetch(`${baseUrl}/api/apps/${appId}/entity-schemas/Installer`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'User-Agent': 'FastAmps-verify-release/1.0',
    },
  });
  const schema = await schemaRes.json().catch(() => ({}));
  const props = schema.properties || schema.entity_schema?.properties || {};
  result.schema = {
    http: schemaRes.status,
    membership_status: Boolean(props.membership_status),
    qa_financial_lifecycle: Boolean(props.qa_financial_lifecycle),
  };
  if (!result.schema.membership_status) result.mismatches.push('installer_membership_schema_missing');

  // Genuine Links must remain draft unless intentionally activated
  const inviteRes = await fetch(`${baseUrl}/api/apps/${appId}/functions/manage-incentive-programme`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'FastAmps-verify-release/1.0',
    },
    body: JSON.stringify({ action: 'public_invite', programme_code: 'links-electrical-shrewsbury' }),
  });
  const invite = await inviteRes.json().catch(() => ({}));
  result.programme = {
    http: inviteRes.status,
    active: invite.active === true,
    status: invite.status || null,
  };
  if (invite.active === true) result.mismatches.push('genuine_links_active_unexpected');
}

result.ok = result.mismatches.length === 0
  && result.live.homepage_http === 200
  && Boolean(result.live.spa_js);
result.verdict = result.ok ? 'VERIFIED' : 'DEPLOYMENT UNVERIFIED';

if (result.ok) {
  const statePath = join(opsRoot, 'maintenance-state.json');
  let state = {};
  if (existsSync(statePath)) {
    try { state = JSON.parse(readFileSync(statePath, 'utf8')); } catch { /* ignore */ }
  }
  state.last_verified_release = {
    verdict: 'VERIFIED',
    checked_at: result.checked_at,
    git_head: result.repository.head,
    git_branch: result.repository.branch,
    spa_js: result.live.spa_js,
    spa_js_sha256: result.live.spa_js_sha256,
    local_match: !result.mismatches.includes('spa_filename_mismatch_local_vs_live'),
  };
  state.updated_at = new Date().toISOString();
  mkdirSync(opsRoot, { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  if (record) {
    appendFileSync(
      join(opsRoot, 'deployment-history.jsonl'),
      `${JSON.stringify({
        at: result.checked_at,
        verdict: result.verdict,
        git_head: result.repository.head,
        branch: result.repository.branch,
        spa_js: result.live.spa_js,
        spa_js_sha256: result.live.spa_js_sha256,
      })}\n`,
    );
  }
}

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
