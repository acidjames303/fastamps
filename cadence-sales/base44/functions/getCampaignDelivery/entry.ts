import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertListOwned } from '../../shared/ownership.ts';
import { computeCampaignDelivery, computeCallerWorkload } from '../../shared/campaignMetrics.ts';

// Returns full campaign delivery metrics for managers.
// Uses the shared campaignMetrics module so numbers match Results, Team, and client reports.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (!['platform_owner', 'organisation_admin', 'sales_manager', 'reporting_user', 'bdm'].includes(profile.app_role)) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { campaign_id } = body;
    if (!campaign_id) return Response.json({ error: 'campaign_id required' }, { status: 400 });

    const campaign = await assertListOwned(base44, org, campaign_id);

    // Fetch all data for this campaign
    const [assignments, callLogs, tasks, opportunities] = await Promise.all([
      base44.asServiceRole.entities.CampaignAssignment.filter(
        { organisation_id: org.id, campaign_id }, '-created_date', 500
      ).catch(() => []),
      base44.asServiceRole.entities.CallLog.filter(
        { organisation_id: org.id, campaign_id }, '-created_date', 500
      ).catch(() => []),
      base44.asServiceRole.entities.Task.filter(
        { organisation_id: org.id, target_list_id: campaign_id }, '-created_date', 500
      ).catch(() => []),
      base44.asServiceRole.entities.Opportunity.filter(
        { organisation_id: org.id, campaign_id }, '-created_date', 100
      ).catch(() => []),
    ]);

    const metrics = computeCampaignDelivery(campaign, assignments, callLogs, tasks, opportunities);

    // Compute per-caller workload
    const assignedUserIds = [...new Set(assignments.filter((a) => a.assigned_user_id).map((a) => a.assigned_user_id))];
    const userProfiles = assignedUserIds.length > 0
      ? await base44.asServiceRole.entities.UserProfile.filter(
          { organisation_id: org.id }, '-created_date', 100
        ).catch(() => [])
      : [];

    const callerWorkload = assignedUserIds.map((uid) => {
      const profile = userProfiles.find((p) => p.user_id === uid);
      const workload = computeCallerWorkload(assignments, callLogs, tasks, uid, campaign_id);
      return {
        user_id: uid,
        name: profile?.full_name || 'Unknown',
        role: profile?.app_role || '',
        ...workload,
      };
    });

    return Response.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        client_name: campaign.client_name,
        status: campaign.status,
        start_date: campaign.start_date,
        end_date: campaign.end_date,
        daily_call_target: campaign.daily_call_target,
        total_call_target: campaign.total_call_target,
      },
      metrics,
      callers: callerWorkload,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}