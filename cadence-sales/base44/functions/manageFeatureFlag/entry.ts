import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlatformOwner } from '../../shared/roleGuards.ts';

// Platform-owner feature flag management — CRUD.
// FeatureFlag RLS blocks all direct client access; this function is the only way
// for platform owners to manage flags.
export default async function(req) {
  try {
    const { base44, user, profile } = await resolvePlatformOwner(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'list') {
      const flags = await base44.asServiceRole.entities.FeatureFlag.list('-created_at', 200);
      return Response.json({ flags });
    }

    if (action === 'create') {
      const { flag_key, description, status, rollout_type, allowed_organisation_ids, allowed_roles, rollout_percentage, start_date, end_date, reason, success_measure, rollback_condition } = body;
      if (!flag_key || !rollout_type) {
        return Response.json({ error: 'flag_key and rollout_type are required.' }, { status: 400 });
      }
      // Check for duplicate key.
      const existing = await base44.asServiceRole.entities.FeatureFlag.filter({ flag_key });
      if (existing && existing.length > 0) {
        return Response.json({ error: 'A flag with this key already exists.' }, { status: 400 });
      }
      const now = new Date().toISOString();
      const flag = await base44.asServiceRole.entities.FeatureFlag.create({
        flag_key,
        description: description || '',
        status: status || 'draft',
        rollout_type,
        allowed_organisation_ids: allowed_organisation_ids || [],
        allowed_roles: allowed_roles || [],
        rollout_percentage: rollout_percentage || 0,
        start_date: start_date || '',
        end_date: end_date || '',
        owner_user_id: user.id,
        reason: reason || '',
        success_measure: success_measure || '',
        rollback_condition: rollback_condition || '',
        rollback_state: 'not_required',
        created_at: now,
        updated_at: now,
      });
      return Response.json({ ok: true, action: 'created', id: flag.id, flag_key });
    }

    if (action === 'update') {
      const { flag_id, ...fields } = body;
      if (!flag_id) {
        return Response.json({ error: 'flag_id is required.' }, { status: 400 });
      }
      const allowed = ['description', 'status', 'rollout_type', 'allowed_organisation_ids', 'allowed_roles', 'rollout_percentage', 'start_date', 'end_date', 'reason', 'success_measure', 'rollback_condition', 'rollback_state', 'linked_release_id'];
      const updates = { updated_at: new Date().toISOString() };
      for (const key of allowed) {
        if (fields[key] !== undefined) updates[key] = fields[key];
      }
      await base44.asServiceRole.entities.FeatureFlag.update(flag_id, updates);
      return Response.json({ ok: true, action: 'updated' });
    }

    if (action === 'delete') {
      const { flag_id } = body;
      if (!flag_id) {
        return Response.json({ error: 'flag_id is required.' }, { status: 400 });
      }
      await base44.asServiceRole.entities.FeatureFlag.delete(flag_id);
      return Response.json({ ok: true, action: 'deleted' });
    }

    return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}