import { resolveTenant } from '../../shared/tenantAuth.ts';
import { computeCallerWorkload } from '../../shared/campaignMetrics.ts';

// Per-caller workload + live activity for the BDM Team board.
export default async function (req) {
  try {
    const { base44, profile, org } = await resolveTenant(req);
    if (!['platform_owner', 'organisation_admin', 'sales_manager', 'reporting_user'].includes(profile.app_role)) {
      return Response.json({ error: 'Only managers can view team workload' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { campaign_id } = body;

    const userProfiles = await base44.asServiceRole.entities.UserProfile.filter(
      { organisation_id: org.id }, '-created_date', 100
    ).catch(() => []);

    const assignmentFilter = { organisation_id: org.id };
    if (campaign_id) assignmentFilter.campaign_id = campaign_id;

    const [assignments, callLogs, tasks, campaigns] = await Promise.all([
      base44.asServiceRole.entities.CampaignAssignment.filter(assignmentFilter, '-created_date', 500).catch(() => []),
      base44.asServiceRole.entities.CallLog.filter(
        campaign_id ? { organisation_id: org.id, campaign_id } : { organisation_id: org.id }, '-created_date', 500
      ).catch(() => []),
      base44.asServiceRole.entities.Task.filter(
        campaign_id ? { organisation_id: org.id, target_list_id: campaign_id } : { organisation_id: org.id }, '-created_date', 500
      ).catch(() => []),
      base44.asServiceRole.entities.Campaign.filter({ organisation_id: org.id }, '-created_date', 200).catch(() => []),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const staleMs = 2 * 60 * 1000;

    const team = userProfiles
      .filter((p) => p.status === 'active' && ['bdm', 'sales_manager', 'organisation_admin'].includes(p.app_role))
      .map((p) => {
        const workload = computeCallerWorkload(assignments, callLogs, tasks, p.user_id, campaign_id);
        const lastAt = p.last_activity_at ? new Date(p.last_activity_at).getTime() : 0;
        const fresh = lastAt && (Date.now() - lastAt) < staleMs;
        const liveStatus = fresh ? (p.activity_status || 'idle') : 'offline';
        const todayLogs = callLogs.filter(
          (l) => (l.user_id === p.user_id || l.assigned_user_id === p.user_id)
            && l.started_at && new Date(l.started_at).getTime() >= todayStart.getTime()
        );
        // Active dialling time from logged call durations — never login/session length.
        const talkSecondsToday = todayLogs.reduce(
          (sum, l) => sum + (typeof l.duration_seconds === 'number' && l.duration_seconds > 0 ? l.duration_seconds : 0),
          0,
        );
        const talkHoursToday = talkSecondsToday / 3600;
        const callsToday = todayLogs.length;
        const conversationsToday = todayLogs.filter((l) => l.conversation_held === true).length;
        // Only report attempts/hour once there is a meaningful amount of dial time.
        const attemptsPerTalkHour = talkHoursToday >= (5 / 60)
          ? Math.round((callsToday / talkHoursToday) * 10) / 10
          : null;
        const pendingIrs = tasks.filter(
          (t) => t.created_by_user_id === p.user_id
            && t.task_type === 'info_request_followup'
            && t.status === 'pending'
        ).length;
        const assignedCampaignIds = [...new Set(
          (assignments || []).filter((a) => a.assigned_user_id === p.user_id).map((a) => a.campaign_id).filter(Boolean)
        )];
        return {
          user_id: p.user_id,
          name: p.full_name || 'Unknown',
          email: p.email || '',
          role: p.app_role || '',
          managed_by_user_id: p.managed_by_user_id || '',
          status: p.status,
          daily_call_target: p.daily_call_target || 0,
          ...workload,
          callsToday,
          conversationsToday,
          talk_seconds_today: talkSecondsToday,
          attempts_per_talk_hour: attemptsPerTalkHour,
          pending_irs: pendingIrs,
          live_status: liveStatus,
          activity_detail: fresh ? (p.activity_detail || '') : '',
          last_activity_at: p.last_activity_at || null,
          assigned_campaign_ids: assignedCampaignIds,
          assigned_campaign_names: assignedCampaignIds
            .map((id) => (campaigns || []).find((c) => c.id === id)?.name)
            .filter(Boolean),
        };
      });

    const callers = team.filter((t) => t.role === 'bdm');
    const live = {
      in_call: callers.filter((t) => t.live_status === 'in_call').length,
      logging: callers.filter((t) => t.live_status === 'logging').length,
      idle: callers.filter((t) => t.live_status === 'idle').length,
      offline: callers.filter((t) => t.live_status === 'offline').length,
      pending_irs: callers.reduce((n, t) => n + (t.pending_irs || 0), 0),
    };

    return Response.json({
      team,
      callers,
      live,
      campaigns: (campaigns || []).map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        client_name: c.client_name || '',
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
