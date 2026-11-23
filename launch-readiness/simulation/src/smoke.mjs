import { assertSafeMode } from './env-guard.mjs';
import {
  assertTargetApp,
  baseUrl,
  expectedAppId,
  CONNECT_APP_NAME,
} from './target-app.mjs';

assertSafeMode('smoke');

const base = baseUrl();
const targetId = expectedAppId();
const paths = ['/', '/login', '/register', '/privacy', '/terms', '/manifest.json'];

const target = await assertTargetApp();

const results = [];
for (const path of paths) {
  const url = new URL(path, base + '/').toString();
  const started = Date.now();
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    results.push({
      url,
      status: res.status,
      ms: Date.now() - started,
      looksLikeConnect: /FastAmps Connect|fastamps/i.test(text),
      pageNotFound: /Page Not Found|could not be found in this application/i.test(text),
      base44Icon: /base44\.com\/logo_v2\.svg/i.test(text),
      hasTargetAppId: text.includes(targetId),
      contentType: res.headers.get('content-type') || '',
      body: text,
    });
  } catch (error) {
    results.push({ url, error: error.message, ms: Date.now() - started });
  }
}

const home = results.find((r) => r.url === `${base}/` || r.url === `${base}`);
const manifest = results.find((r) => r.url.endsWith('/manifest.json'));

/** Live Connect is a Vite SPA — route content lives in the JS bundle, not the HTML shell. */
let bundle = {
  asset: target.asset,
  privacyCopy: false,
  termsRoute: false,
  alpha7: false,
  defaultAppId: target.bundleDefaultAppId,
  error: null,
};
try {
  const html = home?.body || '';
  const assetMatch = html.match(/assets\/index-[^"']+\.js/);
  if (assetMatch) {
    bundle.asset = assetMatch[0];
    const assetUrl = new URL(bundle.asset, base + '/').toString();
    const assetRes = await fetch(assetUrl, { redirect: 'follow' });
    const js = await assetRes.text();
    bundle.privacyCopy = /Open FastAmps privacy|fastamps\.com\/privacy-policy/i.test(js);
    bundle.termsRoute = /programme-terms|\/terms/i.test(js) && /Terms of (Use|Service)/i.test(js);
    bundle.alpha7 = /Alpha\s*7/i.test(js);
    bundle.status = assetRes.status;
    bundle.bytes = js.length;
    bundle.mentionsTargetAppId = js.includes(targetId);
  } else {
    bundle.error = 'no_index_asset_in_shell';
  }
} catch (error) {
  bundle.error = error.message;
}

const publishBlockers = [
  !target.ok ? 'wrong_or_unverified_base44_app_id' : null,
  !bundle.privacyCopy ? 'privacy_terms_not_in_live_bundle' : null,
  manifest?.base44Icon ? 'pwa_icon_still_base44' : null,
  bundle.alpha7 ? 'alpha_7_still_in_live_bundle' : null,
].filter(Boolean);

const slim = results.map(({ body, ...rest }) => rest);

console.log(
  JSON.stringify(
    {
      ok: slim.every((r) => r.status && r.status < 500) && publishBlockers.length === 0,
      targetApp: {
        id: targetId,
        name: CONNECT_APP_NAME,
        verified: target.ok,
        loginInfo: target.loginInfo,
        evidence: {
          htmlHasAppId: target.htmlHasAppId,
          bundleDefaultAppId: target.bundleDefaultAppId,
          errors: target.errors,
        },
      },
      publishBlockers,
      bundle,
      results: slim,
      note: `Pinned to Base44 app ${targetId}. SPA shells return HTTP 200; publish detection uses JS bundle + manifest + login-info.`,
    },
    null,
    2,
  ),
);

if (!target.ok) process.exit(1);
