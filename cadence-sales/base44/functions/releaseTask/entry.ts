import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertTaskOwned, isReadOnly } from '../../shared/taskLogic.ts';

// Release a task lock. Only the locking user or a manager can release.
// The task returns to the available pool (pending, unclaimed).
export default async function (req) {
  const { base44, user, profile, org } = await resolveTenant(req);
  if (isReadOnly(profile)) {
    return Response.json({ error: 'Reporting users cannot release tasks.' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { task_id } = body || {};
  if (!task_id) return Response.json({ error: 'task_id is required.' }, { status: 400 });

  const task = await assertTaskOwned(base44, org, task_id);

  if (task.locked_by_user_id && task.locked_by_user_id !== user.id && !['organisation_admin', 'sales_manager', 'platform_owner'].includes(profile.app_role)) {
    return Response.json({ error: 'Only the locking user or a manager can release this task.' }, { status: 403 });
  }

  await base44.asServiceRole.entities.Task.update(task_id, {
    locked_by_user_id: '',
    locked_at: undefined,
  });

  return Response.json({ released: true, task_id });
}