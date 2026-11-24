import { resolveTenant } from '../../shared/tenantAuth.ts';
import { getConnectionStatus } from '../../shared/providerCredentials.ts';
import { getProviderOrder, getTargetRoles, getPreferredSeniority } from '../../shared/providerResolution.ts';

// Returns the connected status of all provider credentials for the caller's
// organisation, plus the enrichment provider priority config. Uses the
// service-role client (via resolveTenant). Returns booleans + masked
// identifiers only — never the key values themselves.
export default async function (req) {
  try {
    const { base44, org } = await resolveTenant(req);
    const status = await getConnectionStatus(base44, org);
    // Include enrichment config so the Settings UI can load/save provider priority.
    const enrichment_config = {
      providers: (org?.settings?.enrichment_config?.providers) || [],
      target_roles: getTargetRoles(org),
      preferred_seniority: getPreferredSeniority(org),
    };
    return Response.json({ ...status, enrichment_config, provider_order: getProviderOrder(org) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}