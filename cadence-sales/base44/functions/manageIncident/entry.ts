import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlatformOwner } from '../../shared/roleGuards.ts';

// Platform-owner incident management.
// Customer users see only safe notices via getOrgNotices, never the internal Incident entity.
export default async function(req) {
  try {
    const { base44, user, profile } = await resolvePlatformOwner(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'list') {
      const incidents = await base44.asServiceRole.entities.Incident.list('-created_at', 100);
      return Response.json({ incidents });
    }

    if (action === 'create') {
      const { title, safe_summary, severity, affected_organisation_ids, affected_features, customer_impact, started_at } = body;
      if (!title || !safe_summary) {
        return Response.json({ error: 'title and safe_summary are required.' }, { status: 400 });
      }
      const now = new Date().toISOString();
      const incident = await base44.asServiceRole.entities.Incident.create({
        title,
        safe_summary,
        severity: severity || 'normal',
        status: 'investigating',
        affected_organisation_ids: affected_organisation_ids || [],
        affected_features: affected_features || [],
        customer_impact: customer_impact || '',
        started_at: started_at || now,
        detected_at: now,
        acknowledged_at: now,
        incident_owner_user_id: user.id,
        status_notice_published: false,
        post_mortem_completed: false,
        created_at: now,
        updated_at: now,
      });
      return Response.json({ ok: true, action: 'created', id: incident.id });
    }

    if (action === 'update') {
      const { incident_id, ...fields } = body;
      if (!incident_id) {
        return Response.json({ error: 'incident_id is required.' }, { status: 400 });
      }
      const allowed = ['title', 'safe_summary', 'severity', 'status', 'affected_organisation_ids', 'affected_features', 'customer_impact', 'workaround', 'root_cause_category', 'resolution_summary', 'follow_up_actions', 'status_notice_published', 'post_mortem_completed', 'post_mortem', 'acknowledged_at', 'mitigated_at', 'resolved_at'];
      const updates = { updated_at: new Date().toISOString() };
      for (const key of allowed) {
        if (fields[key] !== undefined) updates[key] = fields[key];
      }
      // Auto-set timestamps based on status.
      if (fields.status === 'monitoring' && !fields.mitigated_at) {
        updates.mitigated_at = new Date().toISOString();
      }
      if (fields.status === 'resolved' && !fields.resolved_at) {
        updates.resolved_at = new Date().toISOString();
        updates.post_mortem_completed = !!fields.post_mortem;
      }
      await base44.asServiceRole.entities.Incident.update(incident_id, updates);
      return Response.json({ ok: true, action: 'updated' });
    }

    if (action === 'resolve') {
      const { incident_id, resolution_summary, root_cause_category, follow_up_actions, post_mortem } = body;
      if (!incident_id) {
        return Response.json({ error: 'incident_id is required.' }, { status: 400 });
      }
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.Incident.update(incident_id, {
        status: 'resolved',
        resolution_summary: resolution_summary || '',
        root_cause_category: root_cause_category || 'unknown',
        follow_up_actions: follow_up_actions || '',
        resolved_at: now,
        post_mortem_completed: !!post_mortem,
        post_mortem: post_mortem || null,
        updated_at: now,
      });
      return Response.json({ ok: true, action: 'resolved' });
    }

    if (action === 'publish_notice') {
      const { incident_id, published } = body;
      if (!incident_id) {
        return Response.json({ error: 'incident_id is required.' }, { status: 400 });
      }
      await base44.asServiceRole.entities.Incident.update(incident_id, {
        status_notice_published: !!published,
        updated_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, action: 'publish_notice', published: !!published });
    }

    return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}