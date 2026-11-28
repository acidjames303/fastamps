import { resolveTenant } from '../../shared/tenantAuth.ts';

// Admin inbox: pending info-request follow-ups from callers for email drafting.
export default async function (req) {
  try {
    const { base44, profile, org } = await resolveTenant(req);
    if (!['platform_owner', 'organisation_admin'].includes(profile.app_role)) {
      return Response.json({ error: 'Only admins can open the information-request inbox.' }, { status: 403 });
    }

    const tasks = await base44.asServiceRole.entities.Task.filter(
      { organisation_id: org.id, task_type: 'info_request_followup', status: 'pending' },
      '-created_date',
      100,
    ).catch(() => []);

    // Admins see all pending org IRs (not only ones assigned to them).
    const mine = tasks || [];

    const callLogIds = [...new Set(mine.map((t) => t.call_log_id).filter(Boolean))];
    const contactIds = [...new Set(mine.map((t) => t.contact_id).filter(Boolean))];
    const companyIds = [...new Set(mine.map((t) => t.company_id).filter(Boolean))];
    const callerIds = [...new Set(mine.map((t) => t.created_by_user_id).filter(Boolean))];

    const [logs, contacts, companies, profiles, campaigns] = await Promise.all([
      callLogIds.length
        ? Promise.all(callLogIds.map((id) => base44.asServiceRole.entities.CallLog.get(id).catch(() => null)))
        : Promise.resolve([]),
      contactIds.length
        ? Promise.all(contactIds.map((id) => base44.asServiceRole.entities.Contact.get(id).catch(() => null)))
        : Promise.resolve([]),
      companyIds.length
        ? Promise.all(companyIds.map((id) => base44.asServiceRole.entities.Company.get(id).catch(() => null)))
        : Promise.resolve([]),
      base44.asServiceRole.entities.UserProfile.filter({ organisation_id: org.id }, '-created_date', 100).catch(() => []),
      // Campaigns carry the offer the draft should refer to.
      base44.asServiceRole.entities.Campaign.filter({ organisation_id: org.id }, '-created_date', 100).catch(() => []),
    ]);

    const logMap = new Map((logs || []).filter(Boolean).map((l) => [l.id, l]));
    const contactMap = new Map((contacts || []).filter(Boolean).map((c) => [c.id, c]));
    const companyMap = new Map((companies || []).filter(Boolean).map((c) => [c.id, c]));
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
    const campaignMap = new Map((campaigns || []).map((c) => [c.id, c]));

    const items = mine.map((t) => {
      const log = logMap.get(t.call_log_id) || null;
      const contact = contactMap.get(t.contact_id) || null;
      const company = companyMap.get(t.company_id) || null;
      const caller = profileMap.get(t.created_by_user_id) || null;
      const campaign = campaignMap.get(t.campaign_id || log?.campaign_id) || null;
      return {
        task_id: t.id,
        created_date: t.created_date,
        due_at: t.due_at || null,
        title: t.title,
        description: t.description || '',
        caller_name: caller?.full_name || 'Caller',
        caller_user_id: t.created_by_user_id || '',
        company_name: company?.name || log?.company || '',
        contact_name: contact?.full_name || log?.contact_name || '',
        contact_email: contact?.email || '',
        conversation_type: log?.conversation_type || '',
        outcome: log?.primary_outcome || '',
        client_notes: log?.client_notes || log?.outcome_notes || '',
        internal_notes: log?.internal_notes || '',
        info_request_topic: log?.info_request_topic || '',
        territory: log?.territory || company?.territory || '',
        account_manager_name: log?.account_manager_name || company?.account_manager_name || '',
        account_manager_email: log?.account_manager_email || company?.account_manager_email || '',
        next_action_at: log?.next_action_at || t.due_at || '',
        campaign_id: t.campaign_id || log?.campaign_id || '',
        campaign_name: campaign?.name || '',
        campaign_offer: campaign?.offer || '',
        call_log_id: t.call_log_id || '',
      };
    });

    return Response.json({ items, count: items.length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}