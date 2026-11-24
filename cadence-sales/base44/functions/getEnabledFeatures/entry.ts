import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveTenant, hashString } from '../../shared/roleGuards.ts';

// Returns only enabled feature flag keys applicable to the current organisation
// and role. Never trusts role or organisation values supplied by the browser.
export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);

    const flags = await base44.asServiceRole.entities.FeatureFlag.list('-created_at', 200);
    const now = Date.now();

    const enabled = flags.filter(f => {
      if (f.status === 'draft' || f.status === 'retired') return false;
      if (f.start_date && new Date(f.start_date).getTime() > now) return false;
      if (f.end_date && new Date(f.end_date).getTime() < now) return false;

      switch (f.rollout_type) {
        case 'global':
          return true;
        case 'organisation':
          return (f.allowed_organisation_ids || []).includes(org.id);
        case 'role':
          return (f.allowed_roles || []).includes(profile.app_role);
        case 'allowlist':
          return (f.allowed_organisation_ids || []).includes(org.id);
        case 'percentage':
          return (hashString(org.id) % 100) < (f.rollout_percentage || 0);
        default:
          return false;
      }
    });

    return Response.json({
      flags: enabled.map(f => ({ flag_key: f.flag_key, description: f.description || '' })),
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}