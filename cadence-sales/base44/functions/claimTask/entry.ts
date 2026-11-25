import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertTaskOwned, isReadOnly } from '../../shared/taskLogic.ts';

// Claim (lock) an unassigned or available task for the current user.
// Prevents two users working the same task simultaneously. Fails if the
// task is already locked by another user.
export default async function (req) {
  const { base44, user, profile, org } = await resolveTenant(req);
  if (isReadOnly(profile)) {
    return Response.json({ error: 'Reporting users cannot claim tasks.' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { task_id } = body || {};
  if (!task_id) return Response.json({ error: 'task_id is required.' }, { status: 400 });

  const task = await assertTaskOwned(base44, org, task_id);

  if (task.status === 'completed' || task.status === 'cancelled') {
    return Response.json({ error: 'Task is already closed.' }, { status: 409 });
  }
  if (task.locked_by_user_id && task.locked_by_user_id !== user.id) {
    return Response.json({ error: 'Task is already claimed by another user.' }, { status: 409 });
  }

  const now = new Date().toISOString();
  await base44.asServiceRole.entities.Task.update(task_id, {
    locked_by_user_id: user.id,
    locked_at: now,
    assigned_user_id: task.assigned_user_id || user.id,
    started_at: task.started_at || now,
  });

  return Response.json({ claimed: true, task_id, locked_by_user_id: user.id });
}