import { resolveTenant } from '../../shared/tenantAuth.ts';

export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (!['platform_owner', 'organisation_admin'].includes(profile.app_role)) {
      return Response.json({ error: 'Organisation administrator access required.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (typeof body.automatic_company_research !== 'boolean') {
      return Response.json({ error: 'automatic_company_research must be true or false.' }, { status: 400 });
    }

    const settings = {
      ...(org.settings || {}),
      automatic_company_research: body.automatic_company_research,
      automatic_company_research_updated_at: new Date().toISOString(),
      automatic_company_research_updated_by: user.id,
    };
    await base44.asServiceRole.entities.Organisation.update(org.id, { settings });

    return Response.json({
      automatic_company_research: settings.automatic_company_research,
      message: settings.automatic_company_research
        ? 'Background company research enabled. It will use your organisation Smart Actions.'
        : 'Background company research disabled. No scheduled AI research will run.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
