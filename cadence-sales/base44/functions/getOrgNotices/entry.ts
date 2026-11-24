import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveTenant } from '../../shared/roleGuards.ts';

// Customer-facing incident notices. Returns only safe fields from incidents
// that have status_notice_published=true and affect the current organisation.
// Does not expose internal Incident records — only safe summaries.
export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);

    const incidents = await base44.asServiceRole.entities.Incident.list('-created_at', 50);
    const notices = incidents.filter(i =>
      i.status_notice_published === true &&
      (i.affected_organisation_ids || []).includes(org.id)
    );

    return Response.json({
      notices: notices.map(i => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        status: i.status,
        customer_impact: i.customer_impact || '',
        workaround: i.workaround || '',
        started_at: i.started_at || '',
        resolved_at: i.resolved_at || '',
      })),
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}