import { resolveTenant } from '../../shared/tenantAuth.ts';
import { OUTCOMES } from '../../shared/outcomeRules.ts';
import { isConversation, isInterested } from '../../shared/campaignMetrics.ts';

// One caller's account: who they are, what they are doing right now, the calls
// they have made, the campaigns they carry and the info requests they raised.
// Managers only. Everything is read inside the resolved organisation, so a
// manager can never open a caller from another tenant.
const MANAGER_ROLES = ['platform_owner', 'organisation_admin', 'sales_manager', 'reporting_user'];
const DAY = 86400000;
const STALE_MS = 2 * 60 * 1000;
const MAX_CALLS = 40;

const outcomeLabel = (log) => {
  const code = log.primary_outcome || log.outcome || '';
  return OUTCOMES[code]?.label || code || 'Logged';
};

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export default async function (req) {
  try {
    const { base44, profile, org } = await resolveTenant(req);
    if (!MANAGER_ROLES.includes(profile.app_role)) {
      return Response.json({ error: 'Only managers can open a caller account.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const requested = body?.user_id || body?.profile_id;
    if (!requested) return Response.json({ error: 'user_id is required' }, { status: 400 });

    const svc = base44.asServiceRole.entities;
    const orgId = org.id;

    // A team row may point at a login id or at a profile id. Invited profiles
    // often have no login attached yet, so resolve their login by email from the
    // organisation's active memberships before reading any activity.
    const person = (await svc.UserProfile.filter({ organisation_id: orgId, user_id: requested }, '-created_date', 5).catch(() => []))[0]
      || (await svc.UserProfile.filter({ organisation_id: orgId, id: requested }, '-created_date', 5).catch(() => []))[0]
      || null;
    if (!person) return Response.json({ error: 'That caller is not part of this organisation.' }, { status: 404 });

    let userId = person.user_id || '';
    if (!userId && person.email) {
      const matches = await svc.User.filter({ email: person.email }, '-created_date', 5).catch(() => []);
      for (const candidate of matches || []) {
        const membership = (await svc.OrganisationMembership.filter(
          { organisation_id: orgId, user_id: candidate.id }, '-created_date', 1,
        ).catch(() => []))[0];
        if (membership && membership.status === 'active') { userId = candidate.id; break; }
      }
    }

    const [assignments, logsAsUser, logsAsAssignee, irTasks, openTasks, campaigns] = await Promise.all([
      svc.CampaignAssignment.filter({ organisation_id: orgId, assigned_user_id: userId }, '-created_date', 1000).catch(() => []),
      svc.CallLog.filter({ organisation_id: orgId, user_id: userId }, '-created_date', 300).catch(() => []),
      svc.CallLog.filter({ organisation_id: orgId, assigned_user_id: userId }, '-created_date', 300).catch(() => []),
      svc.Task.filter(
        { organisation_id: orgId, created_by_user_id: userId, task_type: 'info_request_followup', status: 'pending' },
        '-created_date', 50,
      ).catch(() => []),
      svc.Task.filter(
        { organisation_id: orgId, assigned_user_id: userId, status: 'pending' },
        '-created_date', 200,
      ).catch(() => []),
      svc.Campaign.filter({ organisation_id: orgId }, '-created_date', 200).catch(() => []),
    ]);

    const logMap = new Map();
    [...logsAsUser, ...logsAsAssignee].forEach((l) => { if (l?.id) logMap.set(l.id, l); });
    const logs = [...logMap.values()].sort((a, b) => {
      const at = new Date(a.started_at || a.created_date || 0).getTime();
      const bt = new Date(b.started_at || b.created_date || 0).getTime();
      return bt - at;
    });

    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const t0 = todayStart.getTime();
    const since7 = now - 7 * DAY;
    const since30 = now - 30 * DAY;
    const when = (l) => new Date(l.started_at || l.created_date || 0).getTime();

    const today = logs.filter((l) => when(l) >= t0);
    const week = logs.filter((l) => when(l) >= since7);
    const month = logs.filter((l) => when(l) >= since30);
    const weekConversations = week.filter(isConversation);

    const daily = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(t0 - i * DAY);
      const key = dayKey(d);
      const rows = logs.filter((l) => dayKey(l.started_at || l.created_date || 0) === key);
      daily.push({
        date: key,
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        calls: rows.length,
        conversations: rows.filter(isConversation).length,
      });
    }

    const campaignMap = new Map((campaigns || []).map((c) => [c.id, c]));
    const callerCampaignIds = [...new Set((assignments || []).map((a) => a.campaign_id).filter(Boolean))];

    const campaignRows = callerCampaignIds.map((id) => {
      const rows = (assignments || []).filter((a) => a.campaign_id === id);
      const campaignLogs = logs.filter((l) => l.campaign_id === id);
      return {
        id,
        name: campaignMap.get(id)?.name || 'Campaign',
        client_name: campaignMap.get(id)?.client_name || '',
        status: campaignMap.get(id)?.status || '',
        assigned: rows.length,
        completed: rows.filter((a) => a.status === 'completed').length,
        calls: campaignLogs.length,
        conversations: campaignLogs.filter(isConversation).length,
        last_call_at: campaignLogs[0] ? (campaignLogs[0].started_at || campaignLogs[0].created_date) : null,
      };
    }).sort((a, b) => b.calls - a.calls);

    // The accounts in this caller's own book: what they carry, where each one is
    // up to, and when they last called it.
    const accountCompanyIds = [...new Set((assignments || []).map((a) => a.company_id).filter(Boolean))];
    const accountCompanies = accountCompanyIds.length
      ? await svc.Company.filter({ organisation_id: orgId, id: { $in: accountCompanyIds } }, '-created_date', 500).catch(() => [])
      : [];
    const accountCompanyMap = new Map((accountCompanies || []).map((c) => [c.id, c]));
    const lastCallByCompany = new Map();
    logs.forEach((l) => {
      if (l.company_id && !lastCallByCompany.has(l.company_id)) lastCallByCompany.set(l.company_id, l);
    });
    const statusRank: Record<string, number> = { in_progress: 0, assigned: 1, follow_up: 2, unassigned: 3, completed: 4 };
    const accounts = (assignments || [])
      .slice()
      .sort((a, b) => (statusRank[a.status] ?? 5) - (statusRank[b.status] ?? 5) || (b.attempt_count || 0) - (a.attempt_count || 0))
      .slice(0, 100)
      .map((a) => {
        const lastCall = lastCallByCompany.get(a.company_id);
        return {
          assignment_id: a.id,
          company_id: a.company_id || '',
          company_name: accountCompanyMap.get(a.company_id)?.name || 'Account',
          campaign_id: a.campaign_id || '',
          campaign_name: campaignMap.get(a.campaign_id)?.name || '',
          status: a.status || 'assigned',
          attempts: a.attempt_count || 0,
          last_called_at: lastCall ? (lastCall.started_at || lastCall.created_date) : (a.completed_at || null),
        };
      });

    // Info requests: the company and contact names live on the tasks/companies.
    const companyIds = [...new Set((irTasks || []).map((t) => t.company_id).filter(Boolean))];
    const companies = companyIds.length
      ? await svc.Company.filter({ organisation_id: orgId, id: { $in: companyIds } }).catch(() => [])
      : [];
    const companyMap = new Map((companies || []).map((c) => [c.id, c]));

    const infoRequests = (irTasks || []).map((t) => ({
      task_id: t.id,
      created_date: t.created_date,
      due_at: t.due_at || null,
      title: t.title || 'Information request',
      description: t.description || '',
      company_name: companyMap.get(t.company_id)?.name || '',
      contact_id: t.contact_id || '',
      campaign_id: t.campaign_id || t.target_list_id || '',
      campaign_name: campaignMap.get(t.campaign_id || t.target_list_id)?.name || '',
      call_log_id: t.call_log_id || '',
    }));

    const lastAt = person.last_activity_at ? new Date(person.last_activity_at).getTime() : 0;
    const fresh = lastAt && (now - lastAt) < STALE_MS;
    const overdue = (openTasks || []).filter((t) => t.due_at && new Date(t.due_at).getTime() < now).length;
    const dueToday = (openTasks || []).filter(
      (t) => t.due_at && new Date(t.due_at).getTime() >= t0 && new Date(t.due_at).getTime() < t0 + DAY,
    ).length;

    return Response.json({
      caller: {
        user_id: userId,
        name: person.full_name || person.email || 'Caller',
        email: person.email || '',
        role: person.app_role || '',
        status: person.status || '',
        job_title: person.job_title || '',
        daily_call_target: person.daily_call_target || 0,
        managed_by_user_id: person.managed_by_user_id || '',
        live_status: fresh ? (person.activity_status || 'idle') : 'offline',
        activity_detail: fresh ? (person.activity_detail || '') : '',
        last_activity_at: person.last_activity_at || null,
      },
      stats: {
        callsToday: today.length,
        conversationsToday: today.filter(isConversation).length,
        calls7d: week.length,
        conversations7d: weekConversations.length,
        connectRate7d: week.length ? Math.round((weekConversations.length / week.length) * 100) : 0,
        interested30d: month.filter(isInterested).length,
        calls30d: month.length,
        pendingIrs: infoRequests.length,
        openTasks: (openTasks || []).length,
        overdue,
        dueToday,
        assignedAccounts: (assignments || []).length,
        completedAccounts: (assignments || []).filter((a) => a.status === 'completed').length,
      },
      daily,
      campaigns: campaignRows,
      accounts,
      info_requests: infoRequests,
      calls: logs.slice(0, MAX_CALLS).map((l) => ({
        id: l.id,
        company: l.company || '',
        contact_name: l.contact_name || '',
        phone: l.phone || '',
        outcome: outcomeLabel(l),
        connected: isConversation(l),
        campaign_id: l.campaign_id || '',
        campaign_name: campaignMap.get(l.campaign_id)?.name || '',
        duration_seconds: l.duration_seconds || 0,
        notes: l.client_notes || l.outcome_notes || '',
        at: l.started_at || l.created_date || null,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}