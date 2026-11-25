import { resolveTenant } from '../../shared/tenantAuth.ts';

// Releases the lock on a campaign assignment.
// Called after outcome submission, deliberate skip, or session exit.
// Managers can also release stale locks on assignments they don't own.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const { assignment_id, force } = body;
    if (!assignment_id) return Response.json({ error: 'assignment_id required' }, { status: 400 });

    const assignment = await base44.asServiceRole.entities.CampaignAssignment.get(assignment_id).catch(() => null);
    if (!assignment) return Response.json({ error: 'Assignment not found' }, { status: 404 });
    if (assignment.organisation_id !== org.id) return Response.json({ error: 'Assignment does not belong to your organisation' }, { status: 403 });

    // Only the locker or a manager can release
    const isLocker = assignment.locked_by_user_id === user.id;
    const isManager = ['platform_owner', 'organisation_admin', 'sales_manager'].includes(profile.app_role);

    if (!isLocker && !isManager) {
      return Response.json({ error: 'You can only release your own locks' }, { status: 403 });
    }

    // Managers can force-release stale locks
    if (!isLocker && isManager && !force) {
      return Response.json({ error: 'Force release requires explicit confirmation' }, { status: 400 });
    }

    const update = {
      locked_by_user_id: '',
      locked_at: '',
      lock_version: (assignment.lock_version || 1) + 1,
    };

    // If the assignment was in_progress and not completed, revert to assigned
    if (assignment.status === 'in_progress') {
      update.status = 'assigned';
    }

    await base44.asServiceRole.entities.CampaignAssignment.update(assignment_id, update);

    return Response.json({ released: true, assignment_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}