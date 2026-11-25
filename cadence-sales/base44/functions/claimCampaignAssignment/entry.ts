import { resolveTenant } from '../../shared/tenantAuth.ts';

const LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Claims (locks) a campaign assignment for the calling user.
// Prevents two users from calling the same assignment simultaneously.
// Abandoned locks expire after 30 minutes.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const { assignment_id } = body;
    if (!assignment_id) return Response.json({ error: 'assignment_id required' }, { status: 400 });

    const assignment = await base44.asServiceRole.entities.CampaignAssignment.get(assignment_id).catch(() => null);
    if (!assignment) return Response.json({ error: 'Assignment not found' }, { status: 404 });
    if (assignment.organisation_id !== org.id) return Response.json({ error: 'Assignment does not belong to your organisation' }, { status: 403 });

    // Check assignment is in a claimable state
    if (['completed', 'suppressed', 'removed'].includes(assignment.status)) {
      return Response.json({ error: 'This assignment is no longer active' }, { status: 400 });
    }

    // Check if assignment is assigned to this user (or unassigned)
    if (assignment.assigned_user_id && assignment.assigned_user_id !== user.id && profile.app_role === 'bdm') {
      return Response.json({ error: 'This assignment is assigned to another caller' }, { status: 403 });
    }

    const now = Date.now();

    // Check for existing lock
    if (assignment.locked_by_user_id) {
      const lockedAt = assignment.locked_at ? new Date(assignment.locked_at).getTime() : 0;
      const isExpired = now - lockedAt > LOCK_TTL_MS;

      if (assignment.locked_by_user_id === user.id) {
        // Already locked by this user — refresh the lock
        await base44.asServiceRole.entities.CampaignAssignment.update(assignment_id, {
          locked_at: new Date(now).toISOString(),
          status: assignment.status === 'assigned' ? 'in_progress' : assignment.status,
        });
        return Response.json({ claimed: true, assignment_id, already_locked_by_me: true });
      }

      if (!isExpired) {
        // Locked by another user, still valid
        const lockerProfiles = await base44.asServiceRole.entities.UserProfile.filter(
          { organisation_id: org.id, user_id: assignment.locked_by_user_id }, '-created_date', 1
        ).catch(() => []);
        const lockerName = lockerProfiles[0]?.full_name || 'another user';
        return Response.json({
          claimed: false,
          error: `This assignment is currently being called by ${lockerName}`,
          locked_by: assignment.locked_by_user_id,
          locked_by_name: lockerName,
        }, { status: 409 });
      }
      // Lock expired — fall through to claim
    }

    // Claim it
    const lockVersion = (assignment.lock_version || 1) + 1;
    await base44.asServiceRole.entities.CampaignAssignment.update(assignment_id, {
      locked_by_user_id: user.id,
      locked_at: new Date(now).toISOString(),
      status: 'in_progress',
      lock_version: lockVersion,
      started_at: assignment.started_at || new Date(now).toISOString(),
    });

    return Response.json({ claimed: true, assignment_id, lock_version: lockVersion });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}