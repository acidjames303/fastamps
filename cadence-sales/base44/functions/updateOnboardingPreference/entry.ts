import { resolveTenant } from '../../shared/tenantAuth.ts';

// Lets an organisation admin defer optional provider setup during onboarding.
// Skipping never marks the provider connected; the UI continues to show that
// workspace setup is incomplete while core calling/list workflow remains usable.
export default async function(req) {
  try {
    const { base44, profile, org } = await resolveTenant(req);
    if (!['platform_owner', 'organisation_admin'].includes(profile.app_role)) {
      return Response.json({ error: 'Only an organisation admin can change workspace setup.' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const skipped = body.skipped === true;
    await base44.asServiceRole.entities.Organisation.update(org.id, {
      settings: {
        ...(org.settings || {}),
        onboarding_api_skipped: skipped,
        onboarding_api_preference_updated_at: new Date().toISOString(),
      },
    });
    return Response.json({ ok: true, skipped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
