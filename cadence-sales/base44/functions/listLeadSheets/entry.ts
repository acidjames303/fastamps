import { resolveTenant } from '../../shared/tenantAuth.ts';
import { CANONICAL_ORGANISATION_ID } from '../../shared/tenantConfig.ts';
import { canReviewRole } from '../../shared/leadSheet.ts';

// The lead sheets folder. A caller sees only their own sheets; a BDM, sales
// manager, internal BD or admin sees the whole organisation's, including the
// review queue. Organisation is always the server-side canonical tenant.
export default async function (req: Request): Promise<Response> {
  try {
    const { base44, user, profile } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const role = profile.app_role;
    const scope = body.scope === 'review' ? 'review' : 'mine';

    if (scope === 'review' && !canReviewRole(role)) {
      return Response.json({ error: 'Your role cannot open the review queue.' }, { status: 403 });
    }

    const query: Record<string, any> = { organisation_id: CANONICAL_ORGANISATION_ID };
    if (scope === 'mine') query.caller_user_id = user.id;
    if (body.status) query.status = String(body.status);
    if (body.campaign_id) query.campaign_id = String(body.campaign_id);
    if (body.from || body.to) {
      query.date_called = {};
      if (body.from) query.date_called.$gte = String(body.from);
      if (body.to) query.date_called.$lte = String(body.to);
    }

    const entities = base44.asServiceRole.entities;
    let items = await entities.LeadSheet.filter(query, '-created_date', 200);

    if (body.missing_only) {
      items = (items || []).filter((item: any) => (item.missing_fields || []).length > 0);
    }

    const counts = (items || []).reduce((acc: Record<string, number>, item: any) => {
      const key = item.status || 'draft';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const incomplete = (items || []).filter((item: any) => (item.missing_fields || []).length > 0).length;

    return Response.json({
      items: items || [],
      counts,
      incomplete,
      scope,
      can_review: canReviewRole(role),
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Could not load lead sheets.' }, { status: error?.status || 500 });
  }
}