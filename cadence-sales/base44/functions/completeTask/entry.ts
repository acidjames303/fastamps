import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertTaskOwned, isReadOnly } from '../../shared/taskLogic.ts';

// Mark a task completed. Rejects if the task is locked by another user
// (unless the caller is a manager). Sets completed_at and clears any lock.
export default async function (req) {
  const { base44, user, profile, org } = await resolveTenant(req);
  if (isReadOnly(profile)) {
    return Response.json({ error: 'Reporting users cannot complete tasks.' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { task_id } = body || {};
  if (!task_id) return Response.json({ error: 'task_id is required.' }, { status: 400 });

  const task = await assertTaskOwned(base44, org, task_id);

  if (task.locked_by_user_id && task.locked_by_user_id !== user.id && !['organisation_admin', 'sales_manager', 'platform_owner'].includes(profile.app_role)) {
    return Response.json({ error: 'Task is locked by another user.' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const updated = await base44.asServiceRole.entities.Task.update(task_id, {
    status: 'completed',
    completed_at: now,
    locked_by_user_id: '',
    locked_at: undefined,
  });

  return Response.json({ completed: true, task_id, completed_at: now });
}