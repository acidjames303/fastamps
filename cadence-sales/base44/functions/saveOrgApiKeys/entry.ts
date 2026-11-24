import { resolveTenant } from '../../shared/tenantAuth.ts';
import { saveOrgCredentials, getConnectionStatus, PROVIDER_FIELDS } from '../../shared/providerCredentials.ts';

// Lets an organisation admin save provider API keys. Keys are encrypted with
// AES-GCM and stored in the ProviderCredential entity — never on Organisation
// settings in plaintext. The request body is { keys: { NAME: value } } — only
// keys present in the body are touched; an empty string clears that key.
// Returns booleans only — never the key values.
export default async function (req) {
  try {
    const { base44, profile, org, user } = await resolveTenant(req);
    const allowed = ['platform_owner', 'organisation_admin'];
    if (!allowed.includes(profile.app_role)) {
      return Response.json({ error: 'Only organisation admins can manage API keys.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const incoming = (body && body.keys) || {};

    // Group incoming keys by provider so we save one encrypted record per provider.
    const providerKeyMap = {};
    for (const [name, value] of Object.entries(incoming)) {
      for (const [provider, fields] of Object.entries(PROVIDER_FIELDS)) {
        if (fields.includes(name)) {
          if (!providerKeyMap[provider]) providerKeyMap[provider] = {};
          providerKeyMap[provider][name] = value;
          break;
        }
      }
    }

    // Save each provider's keys.
    for (const [provider, keys] of Object.entries(providerKeyMap)) {
      await saveOrgCredentials(base44, org, user.id, provider, keys);
    }

    // Return the REAL connection status from the database — not just the keys
    // we just saved. This prevents other providers (e.g. FullEnrich when only
    // Lusha was disconnected) from appearing disconnected after a partial save.
    const status = await getConnectionStatus(base44, org);
    return Response.json({ connected: status.connected });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}