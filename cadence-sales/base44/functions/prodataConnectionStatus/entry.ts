import { resolveTenant } from '../../shared/tenantAuth.ts';
import {
  resolveProdataToken,
  fetchProdataCredits,
  screenProdataNumbers,
  PRODATA_MESSAGES,
} from '../../shared/prodata.ts';

// Authenticated 121 Prodata connection check.
//
// The credits endpoint is a non-screening call, so this is free to run: it proves
// the key works and reports the remaining balance. Never returns the token, and
// never logs a request URL (the credits URL carries the token in its query).
//
// `self_test: true` (admins only) additionally screens two Ofcom drama numbers in
// the provider's test mode, which proves the screening contract end to end
// without touching a real customer number. Test verdicts are never stored.
const SCREENING_CAPABILITIES = ['prospecting', 'calling', 'providers'];
const ADMIN_ROLES = ['platform_owner', 'organisation_admin'];

const TEST_NUMBERS = [
  { number: '07700900123', specific_reference: 't1' },
  { number: '02079460000', specific_reference: 't2' },
];

export default async function (req) {
  try {
    const { base44, profile, org } = await resolveTenant(req);
    const permitted = SCREENING_CAPABILITIES.some((c) => (profile.capabilities || []).includes(c));
    if (!permitted) {
      return Response.json({ error: 'Your role does not permit TPS/CTPS screening.' }, { status: 403 });
    }

    const resolved = await resolveProdataToken(base44, org);
    if (!resolved.token) {
      return Response.json({
        connected: false,
        code: 'no_token',
        source: '',
        credits: null,
        detail: 'No 121 Prodata API token is saved for this organisation, and no platform key is available.',
      });
    }

    const credits = await fetchProdataCredits(resolved.token);
    const result = {
      connected: credits.ok,
      source: resolved.source,
      masked: resolved.masked,
      credits: credits.ok ? credits.credits : null,
      code: credits.ok ? '' : credits.code,
      detail: credits.ok ? 'Connected.' : credits.detail,
    };

    const body = await req.json().catch(() => ({}));
    if (credits.ok && body?.self_test === true) {
      if (!ADMIN_ROLES.includes(profile.app_role)) {
        return Response.json({ ...result, detail: 'Only organisation admins can run the connection self-test.' });
      }
      const test = await screenProdataNumbers(resolved.token, TEST_NUMBERS, { testMode: true });
      result.self_test = test.ok
        ? {
            ok: true,
            numbers_returned: test.rows.size,
            reference_received: !!test.reference,
            validity_received: !!test.valid_until,
            credits_used: test.credits,
            test_mode: true,
          }
        : { ok: false, code: test.code, detail: test.detail || PRODATA_MESSAGES.provider_error };
    }

    return Response.json(result);
  } catch (error) {
    console.error('prodataConnectionStatus failed', error?.message);
    return Response.json(
      { connected: false, code: 'error', detail: error.message },
      { status: error.status || 500 },
    );
  }
}