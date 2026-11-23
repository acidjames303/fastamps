import { assertSafeMode } from './env-guard.mjs';

assertSafeMode('smoke');

const base = process.env.CONNECT_BASE_URL || 'https://connect.fastamps.com';
const paths = ['/', '/login', '/register', '/privacy', '/terms', '/manifest.json'];

const results = [];
for (const path of paths) {
  const url = new URL(path, base).toString();
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
      contentType: res.headers.get('content-type') || '',
      body: text,
    });
  } catch (error) {
    results.push({ url, error: error.message, ms: Date.now() - started });
  }
}

const home = results.find((r) => r.url.replace(/\/$/, '').endsWith(base.replace(/\/$/, '')) || r.url.endsWith('/'));
const privacy = results.find((r) => r.url.endsWith('/privacy'));
const terms = results.find((r) => r.url.endsWith('/terms'));
const manifest = results.find((r) => r.url.endsWith('/manifest.json'));

/** Live Connect is a Vite SPA — route content lives in the JS bundle, not the HTML shell. */
let bundle = { asset: null, privacyCopy: false, termsRoute: false, alpha7: false, error: null };
try {
  const html = home?.body || '';
  const assetMatch = html.match(/assets\/index-[^"']+\.js/);
  if (assetMatch) {
    bundle.asset = assetMatch[0];
    const assetUrl = new URL(bundle.asset, base).toString();
    const assetRes = await fetch(assetUrl, { redirect: 'follow' });
    const js = await assetRes.text();
    bundle.privacyCopy = /Open FastAmps privacy|fastamps\.com\/privacy-policy/i.test(js);
    bundle.termsRoute = /programme-terms|\/terms/i.test(js) && /Terms of (Use|Service)/i.test(js);
    bundle.alpha7 = /Alpha\s*7/i.test(js);
    bundle.status = assetRes.status;
    bundle.bytes = js.length;
  } else {
    bundle.error = 'no_index_asset_in_shell';
  }
} catch (error) {
  bundle.error = error.message;
}

const publishBlockers = [
  !bundle.privacyCopy ? 'privacy_terms_not_in_live_bundle' : null,
  manifest?.base44Icon ? 'pwa_icon_still_base44' : null,
  bundle.alpha7 ? 'alpha_7_still_in_live_bundle' : null,
].filter(Boolean);

const slim = results.map(({ body, ...rest }) => rest);

console.log(
  JSON.stringify(
    {
      ok: slim.every((r) => r.status && r.status < 500) && publishBlockers.length === 0,
      publishBlockers,
      bundle,
      results: slim,
      note: 'SPA shells always return HTTP 200; publish detection uses the live JS bundle + manifest.',
    },
    null,
    2,
  ),
);
