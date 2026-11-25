import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlatformOwner } from '../../shared/roleGuards.ts';
import { calculatePilotHealth } from '../../shared/pilotOnboarding.ts';

// Platform-owner pilot dashboard: authenticates, requires platform_owner role,
// accepts a selected_organisation_id only from a platform owner, validates the
// organisation exists, and returns safe aggregated information.
export default async function(req) {
  try {
    const { base44, user, profile } = await resolvePlatformOwner(req);
    const body = await req.json().catch(() => ({}));

    // Platform owner can select any organisation to view.
    let targetOrg;
    if (body.selected_organisation_id) {
      targetOrg = await base44.asServiceRole.entities.Organisation.get(body.selected_organisation_id);
      if (!targetOrg) {
        return Response.json({ error: 'Organisation not found.' }, { status: 404 });
      }
    } else {
      targetOrg = await base44.asServiceRole.entities.Organisation.get(profile.organisation_id);
      if (!targetOrg) {
        return Response.json({ error: 'Your organisation was not found.' }, { status: 404 });
      }
    }

    const orgId = targetOrg.id;

    const [
      pilots, milestones, supportRequests, feedback, pulses, actions,
      contacts, callLogs, tasks, campaigns, opportunities, meetings,
      handoffAttempts, subscriptions, orgs
    ] = await Promise.all([
      base44.asServiceRole.entities.PilotProgramme.filter({ organisation_id: orgId }),
      base44.asServiceRole.entities.PilotMilestone.filter({ organisation_id: orgId }, '-created_at', 100),
      base44.asServiceRole.entities.SupportRequest.filter({ organisation_id: orgId }, '-created_at', 50),
      base44.asServiceRole.entities.ProductFeedback.filter({ organisation_id: orgId }, '-created_at', 50),
      base44.asServiceRole.entities.PilotPulse.filter({ organisation_id: orgId }, '-submitted_at', 20),
      base44.asServiceRole.entities.PilotAction.filter({ organisation_id: orgId }, '-created_at', 50),
      base44.asServiceRole.entities.Contact.filter({ organisation_id: orgId }, '-created_date', 500),
      base44.asServiceRole.entities.CallLog.filter({ organisation_id: orgId }, '-created_date', 500),
      base44.asServiceRole.entities.Task.filter({ organisation_id: orgId }, '-created_date', 500),
      base44.asServiceRole.entities.Campaign.filter({ organisation_id: orgId }, '-created_date', 100),
      base44.asServiceRole.entities.Opportunity.filter({ organisation_id: orgId }, '-created_date', 100),
      base44.asServiceRole.entities.Meeting.filter({ organisation_id: orgId }, '-created_date', 100),
      base44.asServiceRole.entities.HandoffAttempt.filter({ organisation_id: orgId }, '-created_at', 100),
      base44.asServiceRole.entities.OrganisationSubscription.filter({ organisation_id: orgId }),
      base44.asServiceRole.entities.Organisation.list('-created_date', 500),
    ]);

    const milestoneKeys = new Set(milestones.map(m => m.milestone_key));
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const dailyActiveCallers = new Set(
      callLogs.filter(l => l.created_date && new Date(l.created_date).getTime() > oneDayAgo).map(l => l.user_id)
    ).size;
    const weeklyActiveCallers = new Set(
      callLogs.filter(l => l.created_date && new Date(l.created_date).getTime() > oneWeekAgo).map(l => l.user_id)
    ).size;

    const callbacksCreated = tasks.filter(t => t.task_type === 'callback').length;
    const callbacksCompleted = tasks.filter(t => t.task_type === 'callback' && t.status === 'completed').length;
    const overdueCallbacks = tasks.filter(t => t.task_type === 'callback' && t.status === 'open' && t.due_at && new Date(t.due_at).getTime() < now).length;
    const callbackCompletionRate = callbacksCreated > 0 ? callbacksCompleted / callbacksCreated : 0;

    const outcomesSaved = callLogs.filter(l => l.primary_outcome || l.outcome).length;
    const connectedCalls = callLogs.filter(l => {
      const o = l.primary_outcome || l.outcome;
      return o && !['no_answer', 'voicemail', 'busy', 'bad_number', 'invalid_number'].includes(o);
    }).length;

    const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
    const openSupport = supportRequests.filter(s => !['resolved', 'closed'].includes(s.status));
    const openCriticalSupport = openSupport.filter(s => s.priority === 'critical').length;
    const openHighSupport = openSupport.filter(s => s.priority === 'high').length;
    const unresolvedBlockers = actions.filter(a => a.status === 'blocked').length;

    const recentPulses = pulses.slice(0, 5);
    const pulseScore = recentPulses.length > 0
      ? recentPulses.reduce((sum, p) => sum + (p.calling_ease_score || 0), 0) / recentPulses.length
      : null;

    const pilot = pilots[0];
    let health = { status: 'unknown', factors: [] };
    if (pilot) {
      health = calculatePilotHealth({
        onboardingComplete: pilot.onboarding_status === 'completed',
        weeklyActiveUsers: weeklyActiveCallers,
        expectedUsers: pilot.expected_users || 2,
        callbackCompletionRate,
        openCriticalSupport,
        openHighSupport,
        unresolvedBlockers,
        usagePercentOfLimit: 0,
        pulseScore,
        paused: pilot.status === 'paused',
      });
    }

    return Response.json({
      organisations: orgs.map(o => ({ id: o.id, name: o.name, pilot_status: o.pilot_status })),
      organisation: { id: targetOrg.id, name: targetOrg.name, pilot_status: targetOrg.pilot_status },
      pilot: pilot || null,
      health,
      milestones: {
        achieved: Array.from(milestoneKeys),
        total: 13,
        list: [
          'org_setup_completed', 'telephony_connected', 'first_test_call',
          'first_campaign_activated', 'first_caller_invited', 'first_real_call',
          'first_conversation', 'first_callback', 'first_callback_completed',
          'first_qualified_opportunity', 'first_meeting', 'first_client_report', 'first_handoff'
        ].map(key => ({ key, achieved: milestoneKeys.has(key), achieved_at: milestones.find(m => m.milestone_key === key)?.achieved_at })),
      },
      adoption: {
        contacts: contacts.length,
        daily_active_callers: dailyActiveCallers,
        weekly_active_callers: weeklyActiveCallers,
        calls_total: callLogs.length,
        outcomes_saved: outcomesSaved,
        callbacks_created: callbacksCreated,
        callbacks_completed: callbacksCompleted,
        overdue_callbacks: overdueCallbacks,
        callback_completion_rate: Math.round(callbackCompletionRate * 100),
        active_campaigns: activeCampaigns,
        opportunities: opportunities.length,
        meetings: meetings.length,
        handoffs: handoffAttempts.filter(h => h.status === 'succeeded').length,
        reports_generated: 0,
      },
      support: {
        open_count: openSupport.length,
        critical: openCriticalSupport,
        high: openHighSupport,
        recent: supportRequests.slice(0, 5).map(s => ({
          id: s.id, title: s.title, priority: s.priority, status: s.status, category: s.category, created_at: s.created_at,
        })),
      },
      feedback: {
        total: feedback.length,
        new: feedback.filter(f => f.status === 'new').length,
        recent: feedback.slice(0, 5).map(f => ({
          id: f.id, title: f.title, type: f.feedback_type, status: f.status, area: f.product_area,
        })),
      },
      actions: actions.filter(a => a.status !== 'completed' && a.status !== 'cancelled').slice(0, 10).map(a => ({
        id: a.id, title: a.title, status: a.status, priority: a.priority, due_at: a.due_at, owner_type: a.owner_type,
      })),
      subscription: subscriptions[0] ? { status: subscriptions[0].status, plan_code: subscriptions[0].plan_code } : null,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}