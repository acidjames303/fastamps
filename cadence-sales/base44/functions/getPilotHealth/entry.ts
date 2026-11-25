import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlatformOwner } from '../../shared/roleGuards.ts';
import { calculatePilotHealth } from '../../shared/pilotHealth.ts';
import { resolveSubscription, getUsageMetrics } from '../../shared/entitlements.ts';

// Deterministic pilot health for a target organisation.
// Replaces "unknown" with transparent, factor-based health.
// Platform-owner only — used by Pilot Console and first-week operating loop.
export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolvePlatformOwner(req);
    const body = await req.json().catch(() => ({}));
    const targetOrgId = body.organisation_id || org.id;
    const targetOrg = targetOrgId === org.id ? org : await base44.asServiceRole.entities.Organisation.get(targetOrgId);

    const [pilots, userProfiles, callLogs, tasks, supportReqs, incidents, pulses, subs] = await Promise.all([
      base44.asServiceRole.entities.PilotProgramme.filter({ organisation_id: targetOrgId }),
      base44.asServiceRole.entities.UserProfile.filter({ organisation_id: targetOrgId }),
      base44.asServiceRole.entities.CallLog.filter({ organisation_id: targetOrgId }, '-created_date', 500),
      base44.asServiceRole.entities.Task.filter({ organisation_id: targetOrgId }, '-created_date', 500),
      base44.asServiceRole.entities.SupportRequest.filter({ organisation_id: targetOrgId }),
      base44.asServiceRole.entities.Incident.filter({ status: 'investigating' }),
      base44.asServiceRole.entities.PilotPulse.filter({ organisation_id: targetOrgId }, '-submitted_at', 10),
      resolveSubscription(base44, targetOrg),
    ]);

    const pilot = pilots?.[0];
    const now = Date.now();

    // Active callers: users with bdm role who have made at least one call this week
    const bdmProfiles = userProfiles.filter(p => p.app_role === 'bdm');
    const weekAgo = now - 7 * 86400000;
    const activeCallers = new Set(
      callLogs.filter(l => l.user_id && new Date(l.created_date).getTime() > weekAgo).map(l => l.user_id)
    ).size;

    // Onboarding progress
    const onboardingMap = targetOrg?.onboarding_progress || {};
    const onboardingSteps = Object.keys(onboardingMap);
    const completedSteps = onboardingSteps.filter(k => onboardingMap[k] === true).length;
    const onboardingProgress = onboardingSteps.length > 0 ? Math.round((completedSteps / onboardingSteps.length) * 100) : 0;
    const onboardingComplete = targetOrg?.onboarding_completed_at || pilot?.onboarding_status === 'completed';

    // Calls
    const totalCalls = callLogs.length;
    const conversations = callLogs.filter(l =>
      l.conversation_held === true || (l.conversation_held === undefined && l.outcome && ['connected', 'interested', 'not_interested', 'callback', 'lead', 'send_info', 'future_potential', 'wrong_person', 'pa_screened'].includes(l.outcome))
    ).length;

    // Callbacks
    const callbackTasks = tasks.filter(t => t.task_type === 'callback' || t.task_type === 'follow_up');
    const callbacksCompleted = callbackTasks.filter(t => t.status === 'completed').length;
    const overdueCallbacks = callbackTasks.filter(t => t.status === 'pending' && t.due_at && new Date(t.due_at).getTime() < now).length;

    // Support
    const highPriorityOpen = supportReqs.filter(s =>
      ['critical', 'high'].includes(s.priority) && !['resolved', 'closed'].includes(s.status)
    ).length;

    // Incidents
    const orgIncidents = incidents.filter(i =>
      !i.affected_organisation_ids || i.affected_organisation_ids.length === 0 || i.affected_organisation_ids.includes(targetOrgId)
    );
    const criticalIncidents = orgIncidents.filter(i => i.severity === 'critical').length;

    // Usage
    let usagePercentage = 0;
    if (subs) {
      const metrics = await getUsageMetrics(base44, subs);
      if (metrics) {
        const percentages = Object.values(metrics).map(m => m.percentage || 0);
        usagePercentage = Math.max(...percentages, 0);
      }
    }

    // Pulse
    const latestPulse = pulses?.[0];
    const pulseScore = latestPulse?.calling_ease_score ?? null;

    const result = calculatePilotHealth({
      onboarding_complete: !!onboardingComplete,
      onboarding_progress: onboardingProgress,
      active_callers: activeCallers,
      expected_callers: pilot?.expected_callers || 2,
      successful_calls: conversations,
      total_calls: totalCalls,
      callbacks_total: callbackTasks.length,
      callbacks_completed: callbacksCompleted,
      overdue_callbacks: overdueCallbacks,
      high_priority_support_open: highPriorityOpen,
      open_incidents: orgIncidents.length,
      critical_incidents: criticalIncidents,
      usage_percentage: usagePercentage,
      pulse_score: pulseScore,
      pilot_status: pilot?.status || targetOrg?.pilot_status || 'setup',
    });

    // Persist health to pilot programme
    if (pilot && pilot.pilot_health !== result.health) {
      await base44.asServiceRole.entities.PilotProgramme.update(pilot.id, {
        pilot_health: result.health,
        updated_at: new Date().toISOString(),
      });
    }

    return Response.json({
      organisation_id: targetOrgId,
      organisation_name: targetOrg?.name || '',
      health: result.health,
      factors: result.factors,
      summary: result.summary,
      calculated_at: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}