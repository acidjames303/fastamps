import { resolveTenant } from '../../shared/tenantAuth.ts';
import { ALL_SECRET_FIELDS } from '../../shared/providerCredentials.ts';

// Automated regression check for Sprint 14C: proves that saving/testing a
// provider connection leaves NO plaintext credentials on Organisation.settings
// and that an encrypted ProviderCredential record exists for the org.
//
// Run after a save + test cycle. Returns booleans only — never secret values.
export default async function (req) {
  try {
    const { base44, profile, org } = await resolveTenant(req);
    const allowed = ['platform_owner', 'organisation_admin'];
    if (!allowed.includes(profile.app_role)) {
      return Response.json({ error: 'Only admins can run this check.' }, { status: 403 });
    }

    // 1. Re-read the Organisation fresh and confirm no plaintext secrets remain.
    const fresh = await base44.asServiceRole.entities.Organisation.get(org.id);
    const apiKeys = (fresh.settings && fresh.settings.api_keys) || {};
    const leaked = ALL_SECRET_FIELDS.filter((f) => !!apiKeys[f]);
    const plaintextAbsent = leaked.length === 0;

    // 2. Confirm an encrypted ProviderCredential record exists for this org.
    const creds = await base44.asServiceRole.entities.ProviderCredential.filter(
      { organisation_id: org.id }, '-updated_date', 50,
    ).catch(() => []);
    const providers = (creds || []).map((c) => c.provider);

    return Response.json({
      ok: plaintextAbsent,
      organisation_id: org.id,
      organisation_name: org.name,
      plaintextAbsent,
      leakedFields: leaked,
      apiKeysPropertyAbsent: !fresh.settings || !fresh.settings.api_keys,
      encryptedProviders: providers,
      encryptedRecordCount: providers.length,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}