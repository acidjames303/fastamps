import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertTaskOwned, isReadOnly, isManager } from '../../shared/taskLogic.ts';
import { assertListOwned, assertCompanyOwned, assertContactOwned } from '../../shared/ownership.ts';

// General task update. Validates any new referenced IDs. Enforces role rules:
// reporting users cannot update; only managers can reassign to another user;
// users cannot complete another user's locked task unless they are a manager.
export default async function (req) {
  const { base44, user, profile, org } = await resolveTenant(req);
  if (isReadOnly(profile)) {
    return Response.json({ error: 'Reporting users cannot update tasks.' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { task_id, ...updates } = body || {};
  if (!task_id) return Response.json({ error: 'task_id is required.' }, { status: 400 });

  const task = await assertTaskOwned(base44, org, task_id);

  // Validate any newly referenced IDs.
  if (updates.target_list_id) await assertListOwned(base44, org, updates.target_list_id);
  if (updates.company_id) await assertCompanyOwned(base44, org, updates.company_id);
  if (updates.contact_id) await assertContactOwned(base44, org, updates.contact_id);

  // Prevent cross-organisation reassignment via organisation_id tampering.
  delete updates.organisation_id;
  delete updates.idempotency_key;
  delete updates.task_id;

  // Reassignment rules.
  if (updates.assigned_user_id !== undefined) {
    if (updates.assigned_user_id && updates.assigned_user_id !== user.id && !isManager(profile)) {
      return Response.json({ error: 'Only managers can reassign tasks.' }, { status: 403 });
    }
  }

  // Lock ownership: cannot modify a task locked by another user unless manager.
  if (task.locked_by_user_id && task.locked_by_user_id !== user.id && !isManager(profile)) {
    return Response.json({ error: 'Task is locked by another user.' }, { status: 409 });
  }

  // Non-managers can only update tasks assigned to them or unassigned.
  if (!isManager(profile) && task.assigned_user_id && task.assigned_user_id !== user.id) {
    return Response.json({ error: 'You can only update tasks assigned to you.' }, { status: 403 });
  }

  const updated = await base44.asServiceRole.entities.Task.update(task_id, updates);
  return Response.json({ updated: true, task: updated });
}