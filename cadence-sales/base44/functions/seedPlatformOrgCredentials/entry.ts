import { resolveTenant } from '../../shared/tenantAuth.ts';
import { getOrgCredentials, saveOrgCredentials, PROVIDER_FIELDS } from '../../shared/providerCredentials.ts';
import { secrets } from 'base44:runtime';

// Platform-owner-only one-time seed: copies app-level secrets into the caller's
// own organisation ProviderCredential records. Needed because getConnectionStatus
// and getOrgCredentials no longer fall back to app-level secrets (tenant
// isolation), so the platform owner's org must hold its own credential records
// to keep enrichment/telephony working. Only seeds fields the org does not
// already have — existing org-level values are never overwritten.
export default async function (req) {
  try {
    const { base44, profile, org } = await resolveTenant(req);
    if (profile.app_role !== 'platform_owner') {
      return Response.json({ error: 'Only platform owners may seed credentials.' }, { status: 403 });
    }

    // Org-level creds only (no app fallback) — so we know what's missing.
    const existing = await getOrgCredentials(base44, org);
    const seeded = {};

    for (const [provider, fields] of Object.entries(PROVIDER_FIELDS)) {
      const toSeed = {};
      let hasAny = false;
      for (const field of fields) {
        if (existing.get(field)) continue; // never overwrite an org-level value
        const appVal = secrets && typeof secrets.get === 'function' ? secrets.get(field) : '';
        if (appVal) { toSeed[field] = appVal; hasAny = true; }
      }
      if (hasAny) {
        await saveOrgCredentials(base44, org, profile.user_id || '', provider, toSeed);
        seeded[provider] = Object.keys(toSeed);
      }
    }

    return Response.json({ ok: true, organisation: org.name, seeded });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}