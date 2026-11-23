/**
 * Canonical FastAmps Connect Base44 app under test.
 * All simulation / smoke probes must target this app only.
 */
export const CONNECT_APP_ID = '6adf6de7ebdb4cb382e8779f';
export const CONNECT_APP_NAME = 'FastAmps Connect';
export const CONNECT_DEFAULT_BASE_URL = 'https://connect.fastamps.com';

export function expectedAppId() {
  return process.env.CONNECT_APP_ID || CONNECT_APP_ID;
}

export function baseUrl() {
  return (process.env.CONNECT_BASE_URL || CONNECT_DEFAULT_BASE_URL).replace(/\/$/, '');
}

/**
 * Verify the host serves the expected Base44 app id.
 * Checks HTML bootstrap, JS defaultValue, and public login-info API.
 */
export async function assertTargetApp({ fetchImpl = fetch } = {}) {
  const id = expectedAppId();
  const root = baseUrl();
  const started = Date.now();
  const evidence = {
    expectedAppId: id,
    baseUrl: root,
    htmlHasAppId: false,
    bundleDefaultAppId: null,
    loginInfo: null,
    asset: null,
    ok: false,
    errors: [],
  };

  try {
    const htmlRes = await fetchImpl(root + '/', { redirect: 'follow' });
    const html = await htmlRes.text();
    evidence.htmlStatus = htmlRes.status;
    evidence.htmlHasAppId = html.includes(id);

    const assetMatch = html.match(/assets\/index-[^"']+\.js/);
    if (assetMatch) {
      evidence.asset = assetMatch[0];
      const js = await (await fetchImpl(new URL(evidence.asset, root + '/').toString())).text();
      const defaults = [...js.matchAll(/defaultValue:"([a-f0-9]{24})"/g)].map((m) => m[1]);
      evidence.bundleDefaultAppId = defaults.find((d) => d === id) || defaults[0] || null;
      evidence.bundleMentionsTarget = js.includes(id);
    } else {
      evidence.errors.push('no_index_asset');
    }
  } catch (error) {
    evidence.errors.push(`html_bundle:${error.message}`);
  }

  try {
    const loginUrl = `${root}/api/apps/public/login-info/by-id/${id}`;
    const loginRes = await fetchImpl(loginUrl, {
      headers: { Accept: 'application/json' },
      redirect: 'follow',
    });
    const ctype = loginRes.headers.get('content-type') || '';
    if (ctype.includes('application/json')) {
      const info = await loginRes.json();
      evidence.loginInfo = {
        id: info.id,
        name: info.name,
        slug: info.slug,
        status: loginRes.status,
      };
      if (info.id !== id) evidence.errors.push(`login_info_id_mismatch:${info.id}`);
      if (!/FastAmps Connect/i.test(info.name || '')) {
        evidence.errors.push(`login_info_name_unexpected:${info.name}`);
      }
    } else {
      evidence.errors.push(`login_info_not_json:${loginRes.status}`);
    }
  } catch (error) {
    evidence.errors.push(`login_info:${error.message}`);
  }

  evidence.ok =
    evidence.htmlHasAppId &&
    evidence.bundleDefaultAppId === id &&
    evidence.loginInfo?.id === id &&
    evidence.errors.length === 0;
  evidence.elapsedMs = Date.now() - started;
  return evidence;
}

if (process.argv[1]?.endsWith('target-app.mjs')) {
  const result = await assertTargetApp();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
