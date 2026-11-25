import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveTenant } from '../../shared/tenantAuth.ts';
import { saveProviderPriorityConfig, getProviderOrder, getTargetRoles, getPreferredSeniority } from '../../shared/providerResolution.ts';
import { getConnectionStatus } from '../../shared/providerCredentials.ts';

// Saves the organisation's enrichment provider priority order, target roles,
// and preferred seniority. Only organisation admins can call this.
// Also returns the current connection status so the UI can update immediately.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);

    // Only admins can change provider priorities.
    const isAdmin = ['platform_owner', 'organisation_admin'].includes(profile.app_role);
    if (!isAdmin) {
      return Response.json({ error: 'Only administrators can change provider priorities.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { providers, target_roles, preferred_seniority } = body || {};

    if (!providers || !Array.isArray(providers)) {
      return Response.json({ error: 'providers array required' }, { status: 400 });
    }

    // Validate provider names.
    const validProviders = ['apollo', 'lusha', 'fullenrich'];
    for (const p of providers) {
      if (!validProviders.includes(p.provider)) {
        return Response.json({ error: `Unknown provider: ${p.provider}` }, { status: 400 });
      }
    }

    const config = await saveProviderPriorityConfig(base44, org, {
      providers,
      target_roles,
      preferred_seniority,
    });

    // Return the updated config and connection status.
    const connStatus = await getConnectionStatus(base44, org);
    const order = getProviderOrder(org);

    return Response.json({
      ok: true,
      config,
      provider_order: order,
      target_roles: getTargetRoles(org),
      preferred_seniority: getPreferredSeniority(org),
      connected: connStatus.connected,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}