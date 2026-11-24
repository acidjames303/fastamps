import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertListOwned } from '../../shared/ownership.ts';

// Reassigns campaign assignments from one caller to another.
// Preserves completed Tasks and historical CallLogs (caller identity retained).
// Updates open Tasks, creates AuditLog, and notifies the new owner.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (!['platform_owner', 'organisation_admin', 'sales_manager'].includes(profile.app_role)) {
      return Response.json({ error: 'Only managers can reassign work' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { campaign_id, from_user_id, to_user_id, company_ids, reason } = body;
    if (!campaign_id) return Response.json({ error: 'campaign_id required' }, { status: 400 });
    if (!to_user_id) return Response.json({ error: 'to_user_id required' }, { status: 400 });
    if (!reason) return Response.json({ error: 'A reason is required when reassigning work' }, { status: 400 });

    await assertListOwned(base44, org, campaign_id);

    // Verify target user belongs to org and is active
    const targetProfiles = await base44.asServiceRole.entities.UserProfile.filter(
      { organisation_id: org.id, user_id: to_user_id }, '-created_date', 1
    ).catch(() => []);
    if (!targetProfiles.length || targetProfiles[0].status !== 'active') {
      return Response.json({ error: 'Target user is not an active member of this organisation' }, { status: 400 });
    }

    // Build query for assignments to reassign
    const filter = { organisation_id: org.id, campaign_id };
    if (from_user_id) filter.assigned_user_id = from_user_id;

    const assignments = await base44.asServiceRole.entities.CampaignAssignment.filter(
      filter, '-created_date', 500
    ).catch(() => []);

    // Filter by company_ids if provided
    const toReassign = company_ids
      ? assignments.filter((a) => company_ids.includes(a.company_id))
      : assignments;

    // Only reassign active assignments (not completed/removed)
    const eligible = toReassign.filter((a) => !['completed', 'removed'].includes(a.status));

    const now = new Date().toISOString();
    let reassigned = 0;
    let failed = 0;
    const failures = [];

    for (const assignment of eligible) {
      try {
        // Check for claimed work — require reason (already enforced above)
        const isClaimedByOther = assignment.locked_by_user_id && assignment.locked_by_user_id !== to_user_id;
        const lockVersion = (assignment.lock_version || 1) + 1;

        await base44.asServiceRole.entities.CampaignAssignment.update(assignment.id, {
          assigned_user_id: to_user_id,
          assigned_by_user_id: user.id,
          assignment_method: 'reassigned',
          reassignment_reason: reason,
          lock_version: lockVersion,
          locked_by_user_id: '', // Clear any stale lock
          locked_at: '',
        });
        reassigned++;

        // Update open tasks for this assignment
        const openTasks = await base44.asServiceRole.entities.Task.filter(
          { organisation_id: org.id, target_list_id: campaign_id, company_id: assignment.company_id, status: 'pending' },
          '-created_date', 10
        ).catch(() => []);

        for (const task of openTasks) {
          if (['completed', 'cancelled', 'skipped'].includes(task.status)) continue;
          await base44.asServiceRole.entities.Task.update(task.id, {
            assigned_user_id: to_user_id,
          });
        }

        // Notify new owner if there are promised callbacks
        const callbackTasks = openTasks.filter((t) => t.task_type === 'callback' || t.task_type === 'follow_up');
        if (callbackTasks.length > 0) {
          try {
            await base44.asServiceRole.entities.Notice.create({
              organisation_id: org.id,
              user_id: to_user_id,
              type: 'callback_reassigned',
              title: 'Callback reassigned to you',
              body: `You have ${callbackTasks.length} reassigned callback(s) from a campaign. Reason: ${reason}`,
              related_entity_type: 'Campaign',
              related_entity_id: campaign_id,
              created_at: now,
            });
          } catch {}
        }
      } catch (err) {
        failed++;
        failures.push({ assignment_id: assignment.id, error: err.message });
      }
    }

    // Create audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        organisation_id: org.id,
        actor_user_id: user.id,
        action: 'opportunity_marked_ready_for_handoff',
        entity_type: 'CampaignAssignment',
        entity_id: campaign_id,
        previous_value: from_user_id || 'multiple',
        new_value: to_user_id,
        timestamp: now,
      });
    } catch {}

    return Response.json({
      reassigned,
      failed,
      failures: failures.slice(0, 10),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}