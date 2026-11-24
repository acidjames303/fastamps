import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveTenant } from '../../shared/tenantAuth.ts';

export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);

    // Read-only integrity diagnostics — never mutates data.
    const [
      tasks, callLogs, contacts, companies, opportunities,
      meetings, handoffAttempts, campaigns
    ] = await Promise.all([
      base44.asServiceRole.entities.Task.filter({ organisation_id: org.id }, '-created_date', 500),
      base44.asServiceRole.entities.CallLog.filter({ organisation_id: org.id }, '-created_date', 500),
      base44.asServiceRole.entities.Contact.filter({ organisation_id: org.id }, '-created_date', 500),
      base44.asServiceRole.entities.Company.filter({ organisation_id: org.id }, '-created_date', 500),
      base44.asServiceRole.entities.Opportunity.filter({ organisation_id: org.id }, '-created_date', 500),
      base44.asServiceRole.entities.Meeting.filter({ organisation_id: org.id }, '-created_date', 500),
      base44.asServiceRole.entities.HandoffAttempt.filter({ organisation_id: org.id }, '-created_date', 500),
      base44.asServiceRole.entities.Campaign.filter({ organisation_id: org.id }, '-created_date', 500),
    ]);

    const companyIds = new Set(companies.map(c => c.id));
    const contactIds = new Set(contacts.map(c => c.id));
    const campaignIds = new Set(campaigns.map(c => c.id));

    const findings = [];

    // Tasks without organisation
    const tasksNoOrg = tasks.filter(t => !t.organisation_id);
    if (tasksNoOrg.length) findings.push({ check: 'tasks_without_organisation', severity: 'critical', count: tasksNoOrg.length, recommendation: 'Set organisation_id on orphaned tasks or delete them.' });

    // Tasks without valid users (assigned_user_id empty)
    const tasksNoUser = tasks.filter(t => !t.assigned_user_id);
    if (tasksNoUser.length) findings.push({ check: 'tasks_without_assignee', severity: 'warning', count: tasksNoUser.length, recommendation: 'Assign tasks or mark as unassigned.' });

    // CallLogs without organisation
    const logsNoOrg = callLogs.filter(l => !l.organisation_id);
    if (logsNoOrg.length) findings.push({ check: 'calllogs_without_organisation', severity: 'critical', count: logsNoOrg.length, recommendation: 'Set organisation_id on orphaned call logs.' });

    // Callbacks without due dates
    const callbacksNoDate = tasks.filter(t => t.task_type === 'callback' && !t.due_at);
    if (callbacksNoDate.length) findings.push({ check: 'callbacks_without_due_date', severity: 'warning', count: callbacksNoDate.length, recommendation: 'Set due dates on callback tasks.' });

    // CallLogs referencing missing contacts
    const logsMissingContact = callLogs.filter(l => l.contact_id && !contactIds.has(l.contact_id));
    if (logsMissingContact.length) findings.push({ check: 'calllogs_missing_contact', severity: 'warning', count: logsMissingContact.length, recommendation: 'Verify contact references or clean up orphaned logs.' });

    // Contacts referencing missing companies
    const contactsMissingCompany = contacts.filter(c => c.company_id && !companyIds.has(c.company_id));
    if (contactsMissingCompany.length) findings.push({ check: 'contacts_missing_company', severity: 'info', count: contactsMissingCompany.length, recommendation: 'Link contacts to valid company records.' });

    // Assignments referencing inactive campaigns
    const inactiveCampaignIds = campaigns.filter(c => c.status === 'archived' || c.status === 'completed').map(c => c.id);
    const tasksForInactive = tasks.filter(t => t.campaign_id && inactiveCampaignIds.includes(t.campaign_id) && t.status === 'open');
    if (tasksForInactive.length) findings.push({ check: 'tasks_for_inactive_campaigns', severity: 'info', count: tasksForInactive.length, recommendation: 'Close or reassign tasks for completed/archived campaigns.' });

    // Duplicate active tasks (same contact, same type, open)
    const taskKeyMap = {};
    tasks.filter(t => t.status === 'open' && t.contact_id).forEach(t => {
      const key = `${t.contact_id}_${t.type || t.task_type || 'call'}`;
      taskKeyMap[key] = (taskKeyMap[key] || 0) + 1;
    });
    const dupTasks = Object.values(taskKeyMap).filter(v => v > 1).length;
    if (dupTasks) findings.push({ check: 'duplicate_active_tasks', severity: 'warning', count: dupTasks, recommendation: 'Merge duplicate open tasks for the same contact.' });

    // Duplicate opportunities (same company, same name)
    const oppKeyMap = {};
    opportunities.forEach(o => {
      const key = `${o.company_id}_${o.name}`;
      oppKeyMap[key] = (oppKeyMap[key] || 0) + 1;
    });
    const dupOpps = Object.values(oppKeyMap).filter(v => v > 1).length;
    if (dupOpps) findings.push({ check: 'duplicate_opportunities', severity: 'warning', count: dupOpps, recommendation: 'Merge duplicate opportunities for the same company.' });

    // Duplicate handoff attempts (same opportunity, same destination, pending/succeeded)
    const handoffKeyMap = {};
    handoffAttempts.filter(h => ['pending', 'processing', 'succeeded'].includes(h.status)).forEach(h => {
      const key = `${h.opportunity_id}_${h.destination_type}`;
      handoffKeyMap[key] = (handoffKeyMap[key] || 0) + 1;
    });
    const dupHandoffs = Object.values(handoffKeyMap).filter(v => v > 1).length;
    if (dupHandoffs) findings.push({ check: 'duplicate_handoff_attempts', severity: 'warning', count: dupHandoffs, recommendation: 'Cancel duplicate handoff attempts.' });

    return Response.json({
      organisation_id: org.id,
      organisation_name: org.name,
      scanned: {
        tasks: tasks.length,
        call_logs: callLogs.length,
        contacts: contacts.length,
        companies: companies.length,
        opportunities: opportunities.length,
        meetings: meetings.length,
        handoff_attempts: handoffAttempts.length,
        campaigns: campaigns.length,
      },
      findings,
      critical_count: findings.filter(f => f.severity === 'critical').length,
      warning_count: findings.filter(f => f.severity === 'warning').length,
      info_count: findings.filter(f => f.severity === 'info').length,
      clean: findings.length === 0,
      checked_at: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}