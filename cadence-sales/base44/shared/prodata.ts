import { secrets } from 'base44:runtime';
import { getOrgCredentials } from './providerCredentials.ts';
import { isCanonicalOrganisation } from './tenantConfig.ts';
import { normalisePhone, hashValue } from './complianceUtils.ts';

// 121 Prodata TPS / CTPS screening client.
//
// One place owns the provider contract: the bulk screening POST, the credits
// GET, error classification and response validation. Callers never see the
// token, and nothing here logs a request URL (the credits URL carries the token
// in its query string).
//
// Docs: https://121prodata.co.uk/tps-services/tps-ctps-api-documentation-multiple
//       https://121prodata.co.uk/tps-services/api-documentation-credits

export const PRODATA_SCREEN_URL = 'https://www.121prodata.co.uk/api/';
export const PRODATA_CREDITS_URL = 'https://121prodata.co.uk/api/credits/';
export const PRODATA_FIELD = 'PRODATA_API_TOKEN';
// App-level key. Used ONLY for the canonical owner organisation — never as a
// fallback for any other organisation.
export const PRODATA_APP_SECRET = '121Data';

const TIMEOUT_MS = 20000;

export const PRODATA_MESSAGES = {
  no_token: 'No 121 Prodata API token is saved for this organisation.',
  invalid_token: '121 Prodata rejected the API token. Check the token in your 121 Prodata account, then save it again.',
  no_credit: 'The 121 Prodata account has no screening credits left. Top up the account, then run the check again.',
  maintenance: '121 Prodata is synchronising its TPS/CTPS registers. Try again in about 30 minutes.',
  invalid_input: '121 Prodata could not read the numbers that were sent.',
  unreachable: 'Could not reach 121 Prodata. Nothing was saved — try again.',
  provider_error: '121 Prodata returned an error. Nothing was saved.',
  response_invalid: '121 Prodata returned a response that could not be verified. Nothing was saved.',
};

// UK form used for de-duplication and for matching our own suppression hashes.
export function normaliseUkNumber(raw) {
  if (!raw) return '';
  let d = String(raw).replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (d.startsWith('0044')) d = d.slice(4);
  else if (d.startsWith('44') && d.length > 10) d = d.slice(2);
  if (!d.startsWith('0')) d = '0' + d;
  d = d.replace(/\D/g, '');
  return d.length >= 9 && d.length <= 11 ? d : '';
}

export function maskToken(token) {
  const s = String(token || '');
  if (!s) return '';
  return s.length <= 4 ? '••••' : '••••' + s.slice(-4);
}

// Tenant credential first. The app secret is only readable for the canonical
// owner organisation, so no other organisation can ever spend the platform key.
export async function resolveProdataToken(base44, org) {
  const creds = await getOrgCredentials(base44, org).catch(() => ({ get: () => '' }));
  const orgToken = String(creds.get(PRODATA_FIELD) || '').trim();
  if (orgToken) return { token: orgToken, source: 'organisation', masked: maskToken(orgToken) };

  if (isCanonicalOrganisation(org?.id)) {
    let appToken = '';
    try {
      appToken = String(secrets.get(PRODATA_APP_SECRET) || '').trim();
    } catch {
      appToken = '';
    }
    if (!appToken && typeof Deno !== 'undefined' && Deno.env) {
      appToken = String(Deno.env.get(PRODATA_APP_SECRET) || '').trim();
    }
    if (appToken) return { token: appToken, source: 'platform', masked: maskToken(appToken) };
  }

  return { token: '', source: '', masked: '' };
}

function classifyFailure(status, body) {
  const t = String(body || '').toLowerCase();
  if (t.includes('failed to validate token') || t.includes('token required')) return 'invalid_token';
  if (t.includes('not enough credit')) return 'no_credit';
  if (t.includes('maintenance mode')) return 'maintenance';
  if (t.includes('invalid input data') || t.includes('input data required')) return 'invalid_input';
  if (!status) return 'unreachable';
  return 'provider_error';
}

async function timedFetch(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function validUntilIso(value) {
  if (!value) return '';
  const t = new Date(String(value)).getTime();
  if (!Number.isFinite(t)) return '';
  return new Date(t).toISOString();
}

// Non-screening authenticated call: returns the account's remaining credits.
export async function fetchProdataCredits(token) {
  if (!token) return { ok: false, code: 'no_token', detail: PRODATA_MESSAGES.no_token };

  let res;
  try {
    res = await timedFetch(`${PRODATA_CREDITS_URL}?token=${encodeURIComponent(token)}&output=json`, { method: 'GET' });
  } catch {
    return { ok: false, code: 'unreachable', detail: PRODATA_MESSAGES.unreachable };
  }

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    const code = classifyFailure(res.status, text);
    console.error('121 Prodata credits check failed', res.status, code);
    return { ok: false, code, http: res.status, detail: PRODATA_MESSAGES[code] || PRODATA_MESSAGES.provider_error };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, code: 'response_invalid', http: res.status, detail: PRODATA_MESSAGES.response_invalid };
  }

  const credits = Number(parsed?.credits);
  if (!Number.isFinite(credits) || credits < 0) {
    return { ok: false, code: 'response_invalid', http: res.status, detail: PRODATA_MESSAGES.response_invalid };
  }
  return { ok: true, credits: Math.floor(credits) };
}

// Bulk screen. `entries` are [{ number, specific_reference }]; the reference is
// echoed back by the provider, which is how each returned verdict is proven to
// belong to the number we asked about. A row whose reference does not match, or
// whose verdict is not safe/listed, is discarded — the caller then treats that
// number as unavailable rather than assuming it is safe.
export async function screenProdataNumbers(token, entries, { testMode = false } = {}) {
  if (!token) return { ok: false, code: 'no_token', detail: PRODATA_MESSAGES.no_token };
  if (!Array.isArray(entries) || !entries.length) return { ok: false, code: 'invalid_input', detail: PRODATA_MESSAGES.invalid_input };

  const expected = new Map();
  for (const e of entries) expected.set(e.number, e.specific_reference);

  const form = new URLSearchParams();
  form.set('token', token);
  form.set('input_format', 'json');
  form.set('output_format', 'json');
  if (testMode) form.set('test_mode', 'yes');
  form.set('reference', 'cadence');
  form.set('data', JSON.stringify({
    data: entries.map((e) => ({ number: e.number, specific_reference: e.specific_reference })),
  }));

  let res;
  try {
    res = await timedFetch(PRODATA_SCREEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
  } catch {
    return { ok: false, code: 'unreachable', detail: PRODATA_MESSAGES.unreachable };
  }

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    const code = classifyFailure(res.status, text);
    console.error('121 Prodata screening rejected', res.status, code);
    return { ok: false, code, http: res.status, detail: PRODATA_MESSAGES[code] || PRODATA_MESSAGES.provider_error };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, code: 'response_invalid', http: res.status, detail: PRODATA_MESSAGES.response_invalid };
  }

  const rawRows = Array.isArray(parsed?.data) ? parsed.data : null;
  if (!rawRows) {
    return { ok: false, code: 'response_invalid', http: res.status, detail: PRODATA_MESSAGES.response_invalid };
  }

  const rows = new Map();
  for (const row of rawRows) {
    const number = normaliseUkNumber(row?.number);
    const reference = String(row?.specific_reference || '');
    const raw = String(row?.result || '').trim().toLowerCase();
    const wasTestVerdict = raw.endsWith(' test');
    const verdict = raw.replace(/\s+test$/, '');
    if (!number) continue;
    if (verdict !== 'safe' && verdict !== 'listed') continue;
    // A test-mode verdict must never be recorded as a real register result.
    if (wasTestVerdict && !testMode) continue;
    const wanted = expected.get(number);
    if (!wanted || reference !== wanted) continue;
    rows.set(number, verdict);
  }

  return {
    ok: true,
    rows,
    reference: String(parsed?.reference || '').trim(),
    valid_until: validUntilIso(parsed?.valid_until),
    credits: Number(parsed?.credits) || 0,
    matches: Number(parsed?.matches) || 0,
    test_mode: testMode,
  };
}

// Hashes of every active suppression entry for the organisation, so screening
// can honour our own do-not-call list in one query instead of one per number.
export async function loadSuppressedHashes(base44, org) {
  const rows = await base44.asServiceRole.entities.SuppressionEntry
    .filter({ organisation_id: org.id, status: 'active' }, '-created_date', 500)
    .catch(() => []);
  return new Set((rows || []).map((r) => r.normalised_phone_hash).filter(Boolean));
}

export async function suppressedNumbers(numbers, hashSet) {
  const found = new Set();
  if (!hashSet || !hashSet.size) return found;
  for (const n of numbers) {
    const hash = await hashValue(normalisePhone(n));
    if (hash && hashSet.has(hash)) found.add(n);
  }
  return found;
}