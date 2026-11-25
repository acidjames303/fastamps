import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { saveOrgCredentials, PROVIDER_FIELDS } from '../../shared/providerCredentials.ts';
import { requireCapability } from '../../shared/authorization.ts';

// One-time migration: moves plaintext provider credentials from
// Organisation.settings.api_keys into the encrypted ProviderCredential entity,
// then strips the plaintext values from Organisation.settings so they're no
// longer readable by organisation members. Safe to run repeatedly — if a
// credential is already in the encrypted store, it's skipped.
//
// Must be invoked by a platform admin (RLS on Organisation requires admin).
export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // Platform capability comes from the authoritative membership, never from a
  // writable profile row or the built-in admin flag alone.
  try {
    await requireCapability(base44, user, 'platform');
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status || 403 });
  }
  const summary = { orgs: 0, migrated: 0, cleared: 0, skipped: 0, errors: [] };

  try {
    const orgs = await base44.asServiceRole.entities.Organisation.filter({ status: 'active' });
    summary.orgs = orgs.length;

    for (const org of orgs) {
      const apiKeys = (org.settings && org.settings.api_keys) || {};
      const hasKeys = Object.values(apiKeys).some((v) => v);
      if (!hasKeys) { summary.skipped++; continue; }

      // Group keys by provider and save each to the encrypted store.
      for (const [provider, fields] of Object.entries(PROVIDER_FIELDS)) {
        const providerKeys = {};
        let hasAny = false;
        for (const field of fields) {
          if (apiKeys[field]) {
            providerKeys[field] = apiKeys[field];
            hasAny = true;
          }
        }
        if (hasAny) {
          try {
            await saveOrgCredentials(base44, org, '', provider, providerKeys);
          } catch (e) {
            summary.errors.push({ org: org.name, provider, error: e.message });
          }
        }
      }

      // Strip the plaintext api_keys object from Organisation.settings.
      const settings = { ...org.settings };
      delete settings.api_keys;
      await base44.asServiceRole.entities.Organisation.update(org.id, { settings });
      summary.migrated++;
      summary.cleared++;
    }

    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message, ...summary }, { status: 500 });
  }
}