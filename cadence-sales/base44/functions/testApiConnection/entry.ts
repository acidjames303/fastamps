import { resolveTenant } from '../../shared/tenantAuth.ts';
import { getOrgCredentials, PROVIDER_FIELDS, ALL_SECRET_FIELDS } from '../../shared/providerCredentials.ts';

// Verifies a set of API credentials against the live provider before the
// Settings UI saves them. For each provider we make one lightweight authenticated
// request; 2xx => valid, 401/403 => invalid key, anything else => treated as
// "couldn't verify" (non-blocking). `keys` in the body overrides the org's
// stored keys, so this works both for testing a freshly-pasted key and for
// re-checking an already-connected one (omit `keys` to use stored values).
const VERIFY = {
  apollo: {
    needs: ['APOLLO_API_KEY'],
    run: async (k) => {
      const r = await fetch('https://api.apollo.io/api/v1/users/api_profile', { headers: { 'x-api-key': k.APOLLO_API_KEY, 'Cache-Control': 'no-cache' } });
      return { ok: r.ok, status: r.status };
    },
  },
  rocketreach: {
    needs: ['ROCKETREACH_API_KEY'],
    run: async (k) => {
      const r = await fetch('https://api.rocketreach.co/api/v2/account/', { headers: { 'Api-Key': k.ROCKETREACH_API_KEY, accept: 'application/json' } });
      return { ok: r.ok, status: r.status };
    },
  },
  lusha: {
    needs: ['LUSHA_API_KEY'],
    run: async (k) => {
      const r = await fetch('https://api.lusha.com/v3/contacts/search-and-enrich', {
        method: 'POST',
        headers: { api_key: k.LUSHA_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: [], reveal: [] }),
      });
      return { ok: r.status !== 401 && r.status !== 403, status: r.status };
    },
  },
  fullenrich: {
    needs: ['FULLENRICH_API_KEY'],
    run: async (k) => {
      const r = await fetch('https://app.fullenrich.com/api/v2/account/keys/verify', { headers: { Authorization: `Bearer ${k.FULLENRICH_API_KEY}` } });
      return { ok: r.ok, status: r.status };
    },
  },
  yay: {
    needs: ['YAY_RESELLER', 'YAY_USER', 'YAY_PASSWORD'],
    run: async (k) => {
      const r = await fetch('https://api.yay.com/authenticated', {
        headers: {
          'X-Auth-Reseller': k.YAY_RESELLER,
          'X-Auth-User': k.YAY_USER,
          'X-Auth-Password': k.YAY_PASSWORD,
          'User-Agent': 'DialFlow-AI/1.0',
        },
      });
      return { ok: r.ok, status: r.status };
    },
  },
  twilio: {
    needs: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
    run: async (k, all) => {
      // 1. Account SID + Auth Token
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${k.TWILIO_ACCOUNT_SID}.json`, {
        headers: { Authorization: 'Basic ' + btoa(`${k.TWILIO_ACCOUNT_SID}:${k.TWILIO_AUTH_TOKEN}`) },
      });
      if (!r.ok) return { ok: false, status: r.status, detail: `Account/auth token rejected (HTTP ${r.status}).` };

      // 2. API Key SID + Secret pair (used to sign browser Voice SDK tokens).
      // No Twilio REST endpoint accepts API Key auth for self-verification, so
      // we validate presence + format here. The pair is verified functionally
      // by twilioVoiceToken, which signs a JWT using these credentials.
      const sid = (all?.TWILIO_API_KEY_SID || '').trim();
      const secret = (all?.TWILIO_API_KEY_SECRET || '').trim();
      if (sid || secret) {
        if (!sid || !secret) return { ok: false, status: 0, detail: 'API Key SID and Secret must both be provided.' };
        if (!sid.startsWith('SK')) return { ok: false, status: 0, detail: 'API Key SID should start with "SK".' };
      }

      // 3. TwiML App SID exists and is a voice application
      const appSid = (all?.TWILIO_TWIML_APP_SID || '').trim();
      if (appSid) {
        const ar = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${k.TWILIO_ACCOUNT_SID}/Applications/${appSid}.json`, {
          headers: { Authorization: 'Basic ' + btoa(`${k.TWILIO_ACCOUNT_SID}:${k.TWILIO_AUTH_TOKEN}`) },
        });
        if (!ar.ok) return { ok: false, status: ar.status, detail: `TwiML App SID not found (HTTP ${ar.status}).` };
      }

      return { ok: true, status: r.status };
    },
  },
};

export default async function (req) {
  try {
    const { base44, profile, org } = await resolveTenant(req);
    const allowed = ['platform_owner', 'organisation_admin'];
    if (!allowed.includes(profile.app_role)) {
      return Response.json({ ok: false, detail: 'Only organisation admins can manage API keys.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const provider = body?.provider;
    const cfg = VERIFY[provider];
    if (!cfg) return Response.json({ ok: false, detail: 'Unknown provider.' }, { status: 400 });

    // Load stored credentials (decrypted, server-side only).
    const creds = await getOrgCredentials(base44, org);

    const keys = {};
    for (const name of cfg.needs) {
      const v = body?.keys && body.keys[name] !== undefined ? body.keys[name] : creds.get(name);
      keys[name] = (v || '').trim();
    }
    const missing = cfg.needs.find((n) => !keys[n]);
    if (missing) return Response.json({ ok: false, detail: `Missing ${missing}.` });

    // Build the full key set (provided + stored) so the verify function can
    // test optional fields like Twilio API Key pair and TwiML App SID.
    const all = {};
    for (const name of ALL_SECRET_FIELDS) {
      const v = body?.keys && body.keys[name] !== undefined ? body.keys[name] : creds.get(name);
      all[name] = (v || '').trim();
    }

    const res = await cfg.run(keys, all);
    const detail = res.ok
      ? 'Key verified.'
      : (res.detail || `Provider rejected the key (HTTP ${res.status}). Double-check and try again.`);
    return Response.json({ ok: res.ok, detail, status: res.status });
  } catch (error) {
    return Response.json({ ok: false, detail: error.message }, { status: error.status || 500 });
  }
}