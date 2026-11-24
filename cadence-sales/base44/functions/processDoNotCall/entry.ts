import { resolveTenant } from '../../shared/tenantAuth.ts';
import { processDoNotCall, overrideSuppression } from '../../shared/doNotCall.ts';

// Handles the immediate do-not-call workflow and admin suppression overrides.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    switch (action) {
      case 'do_not_call': {
        const { contact_id, reason, source } = body;
        if (!contact_id) return Response.json({ error: 'contact_id required' }, { status: 400 });
        const result = await processDoNotCall(base44, user, org, contact_id, reason, source || 'caller');
        return Response.json(result);
      }

      case 'override': {
        if (!['platform_owner', 'organisation_admin'].includes(profile.app_role)) {
          return Response.json({ error: 'Only organisation admins may override suppression' }, { status: 403 });
        }
        const { suppression_entry_id, reason } = body;
        if (!suppression_entry_id) return Response.json({ error: 'suppression_entry_id required' }, { status: 400 });
        if (!reason) return Response.json({ error: 'A clear reason is required for suppression override' }, { status: 400 });
        const result = await overrideSuppression(base44, user, org, suppression_entry_id, reason);
        return Response.json(result);
      }

      default:
        return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}