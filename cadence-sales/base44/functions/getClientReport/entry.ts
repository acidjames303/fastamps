import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveTenant } from '../../shared/roleGuards.ts';
import { isConversation, isDecisionMakerConversation, isGatekeeperConversation } from '../../shared/campaignMetrics.ts';
import { LEAD_HEADERS, buildLeadRow, normaliseName, toCsv } from '../../shared/leadReport.ts';

// Tenant-scoped client report for a date range.
// Available to org admins and managers. Never exposes internal notes, AI strategy,
// credentials, or data from another organisation.
export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (!['platform_owner', 'organisation_admin', 'sales_manager', 'reporting_user'].includes(profile.app_role)) {
      return Response.json({ error: 'Only BDMs, admins, and reporting users can download client reports.' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));

    // Date range (default: last 7 days)
    const endDate = body.end_date ? new Date(body.end_date) : new Date();
    const startDate = body.start_date ? new Date(body.start_date) : new Date(endDate.getTime() - 7 * 86400000);
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    const [callLogs, tasks, meetings, opportunities, campaigns, userProfiles] = await Promise.all([
      base44.asServiceRole.entities.CallLog.filter({ organisation_id: org.id }, '-created_date', 1000),
      base44.asServiceRole.entities.Task.filter({ organisation_id: org.id }, '-created_date', 1000),
      base44.asServiceRole.entities.Meeting.filter({ organisation_id: org.id }, '-created_date', 500),
      base44.asServiceRole.entities.Opportunity.filter({ organisation_id: org.id }, '-created_date', 500),
      base44.asServiceRole.entities.Campaign.filter({ organisation_id: org.id }, '-created_date', 200),
      base44.asServiceRole.entities.UserProfile.filter({ organisation_id: org.id }),
    ]);

    // Filter to date range
    const inRange = (record) => {
      const ts = record.created_date || record.started_at || record.outcome_saved_at;
      return ts && ts >= startISO && ts <= endISO;
    };

    let periodLogs = callLogs.filter(inRange);

    // A single-campaign report also covers calls dialled from that campaign's
    // list, even where the log itself carries no campaign id.
    if (body.campaign_id) {
      const members = await base44.asServiceRole.entities.TargetListMember
        .filter({ organisation_id: org.id, target_list_id: body.campaign_id }, '-created_date', 2000)
        .catch(() => []);
      const listCompanies = new Set((members || []).map((m) => m.company_id).filter(Boolean));
      periodLogs = periodLogs.filter((l) => (
        l.campaign_id ? l.campaign_id === body.campaign_id : listCompanies.has(l.company_id)
      ));
    }

    const periodMeetings = meetings.filter(inRange);
    const periodTasks = tasks.filter(inRange);

    // Core metrics
    const callsAttempted = periodLogs.length;
    const conversations = periodLogs.filter(isConversation);
    const decisionMakerConversations = periodLogs.filter(isDecisionMakerConversation);
    const gatekeeperConversations = periodLogs.filter(isGatekeeperConversation);

    const interested = periodLogs.filter(l => {
      const oc = l.primary_outcome || l.outcome;
      return ['connected_interested', 'connected_qualified', 'connected_information_requested', 'interested', 'lead', 'send_info', 'future_potential'].includes(oc);
    });

    // IR dedupe: recalls (same contact/company) inflate raw counts — report unique + raw.
    const irLogs = periodLogs.filter(l => {
      const oc = l.primary_outcome || l.outcome;
      return oc === 'connected_information_requested' || oc === 'send_info';
    });
    const irUniqueKeys = new Set();
    let irRecalls = 0;
    for (const log of irLogs) {
      const key = log.contact_id || log.company_id || log.id;
      if (log.is_info_recall || irUniqueKeys.has(key)) irRecalls += 1;
      irUniqueKeys.add(key);
    }

    const notInterested = periodLogs.filter(l => {
      const oc = l.primary_outcome || l.outcome;
      return ['connected_not_interested', 'not_interested', 'not_suitable', 'no_sales_calls'].includes(oc);
    });

    const noAnswer = periodLogs.filter(l => {
      const oc = l.primary_outcome || l.outcome;
      return ['no_answer', 'no_pickup', 'no_reply'].includes(oc);
    });

    const voicemail = periodLogs.filter(l => {
      const oc = l.primary_outcome || l.outcome;
      return oc === 'voicemail';
    });

    const invalidNumbers = periodLogs.filter(l => {
      const oc = l.primary_outcome || l.outcome;
      return ['bad_number', 'invalid_number'].includes(oc);
    });

    const callbacks = periodTasks.filter(t => t.task_type === 'callback' || t.task_type === 'follow_up');
    const connected = periodLogs.filter(l =>
      l.call_connected === true || (l.call_connected === undefined && isConversation(l))
    );

    // Rates
    const conversationRate = callsAttempted > 0 ? Math.round((conversations.length / callsAttempted) * 100) : 0;
    const meetingCount = periodMeetings.length;
    const meetingConversionRate = conversations.length > 0 ? Math.round((meetingCount / conversations.length) * 100) : 0;

    // Activity by caller
    const callerMap = new Map();
    for (const log of periodLogs) {
      const uid = log.user_id || log.assigned_user_id || 'unknown';
      if (!callerMap.has(uid)) {
        const up = userProfiles.find(p => p.user_id === uid);
        callerMap.set(uid, {
          caller_name: up?.full_name || 'Unknown',
          calls: 0, conversations: 0, callbacks: 0, interested: 0,
        });
      }
      const c = callerMap.get(uid);
      c.calls++;
      if (isConversation(log)) c.conversations++;
      if (['connected_interested', 'connected_qualified', 'connected_information_requested', 'interested', 'lead', 'send_info', 'future_potential'].includes(log.primary_outcome || log.outcome)) c.interested++;
    }
    for (const t of callbacks) {
      const uid = t.assigned_user_id || 'unknown';
      if (callerMap.has(uid)) callerMap.get(uid).callbacks++;
    }

    // Activity by campaign
    const campaignMap = new Map();
    for (const log of periodLogs) {
      const cid = log.campaign_id || 'uncategorised';
      if (!campaignMap.has(cid)) {
        const camp = campaigns.find(c => c.id === cid);
        campaignMap.set(cid, {
          campaign_name: camp?.name || 'Uncategorised',
          calls: 0, conversations: 0, interested: 0,
        });
      }
      const c = campaignMap.get(cid);
      c.calls++;
      if (isConversation(log)) c.conversations++;
      if (['connected_interested', 'connected_qualified', 'connected_information_requested', 'interested', 'lead', 'send_info', 'future_potential'].includes(log.primary_outcome || log.outcome)) c.interested++;
    }

    const whoLabel = (l) => {
      const t = l.conversation_type || '';
      if (t === 'decision_maker') return 'Decision-maker';
      if (t === 'gatekeeper') return 'Gatekeeper';
      if (t === 'wrong_person') return 'Wrong person';
      if (t === 'other') return 'Other person';
      return l.conversation_held ? 'Connected' : '—';
    };

    // Client-safe highlight rows: date only, client notes only, no call times / internal notes.
    const highlights = periodLogs
      .filter(l => {
        const oc = l.primary_outcome || l.outcome;
        return ['connected_interested', 'connected_qualified', 'connected_information_requested', 'interested', 'lead', 'send_info', 'connected_callback'].includes(oc)
          || l.conversation_held === true;
      })
      .slice(0, 200)
      .map(l => ({
        date: (l.started_at || l.created_date || '').toString().slice(0, 10),
        company: l.company || '',
        contact: l.contact_name || '',
        who_spoken_to: whoLabel(l),
        outcome: l.primary_outcome || l.outcome || '',
        topic: l.info_request_topic || '',
        notes: l.client_notes || l.outcome_notes || '',
        next_step: l.next_action_type || '',
        next_step_date: (l.next_action_at || '').toString().slice(0, 10),
        territory: l.territory || '',
        account_manager: l.account_manager_name || '',
        is_recall: !!l.is_info_recall,
      }));

    const report = {
      organisation_name: org.name,
      period: { start: startISO.slice(0, 10), end: endISO.slice(0, 10) },
      summary: {
        calls_attempted: callsAttempted,
        calls_connected: connected.length,
        conversations: conversations.length,
        decision_maker_conversations: decisionMakerConversations.length,
        gatekeeper_conversations: gatekeeperConversations.length,
        callbacks: callbacks.length,
        meetings: meetingCount,
        interested: interested.length,
        information_requests_raw: irLogs.length,
        information_requests_unique: irUniqueKeys.size,
        information_request_recalls: irRecalls,
        not_interested: notInterested.length,
        no_answer: noAnswer.length,
        voicemail: voicemail.length,
        invalid_numbers: invalidNumbers.length,
        conversation_rate: conversationRate,
        meeting_conversion_rate: meetingConversionRate,
      },
      activity_by_caller: [...callerMap.values()],
      activity_by_campaign: [...campaignMap.values()],
      highlights,
      generated_at: new Date().toISOString().slice(0, 10),
    };

    if (body.format === 'csv') {
      // The client's own lead-activity layout: one row per call, with that
      // account's enrichment research pulled into Comments.
      const chunksOf = (list) => {
        const out = [];
        for (let i = 0; i < list.length; i += 100) out.push(list.slice(i, i + 100));
        return out;
      };
      const contactIds = [...new Set(periodLogs.map((l) => l.contact_id).filter(Boolean))];
      const companyIds = [...new Set(periodLogs.map((l) => l.company_id).filter(Boolean))];
      const contactMap = new Map();
      const companyMap = new Map();
      for (const ids of chunksOf(contactIds)) {
        const found = await base44.asServiceRole.entities.Contact
          .filter({ id: { $in: ids } }, '-created_date', 500).catch(() => []);
        (found || []).forEach((c) => contactMap.set(c.id, c));
      }
      for (const ids of chunksOf(companyIds)) {
        const found = await base44.asServiceRole.entities.Company
          .filter({ id: { $in: ids } }, '-created_date', 500).catch(() => []);
        (found || []).forEach((c) => companyMap.set(c.id, c));
      }

      const [researchRows, intelligenceRows] = await Promise.all([
        base44.asServiceRole.entities.AccountResearch
          .filter({ organisation_id: org.id }, '-created_date', 1000).catch(() => []),
        base44.asServiceRole.entities.CompanyIntelligence
          .filter({ organisation_id: org.id }, '-created_date', 1000).catch(() => []),
      ]);
      const researchByCompany = new Map();
      for (const r of researchRows || []) {
        const key = normaliseName(r.company_name);
        if (key && !researchByCompany.has(key)) researchByCompany.set(key, r);
      }
      const intelligenceByCompany = new Map();
      for (const ci of intelligenceRows || []) {
        if (ci.company_id && !intelligenceByCompany.has(ci.company_id)) intelligenceByCompany.set(ci.company_id, ci);
      }

      // Oldest first, as the client's own sheet reads.
      const ordered = periodLogs.slice().sort((a, b) => {
        const ta = new Date(a.started_at || a.created_date || 0).getTime();
        const tb = new Date(b.started_at || b.created_date || 0).getTime();
        return ta - tb;
      });

      const reportCampaignName = body.campaign_id
        ? (campaigns.find((c) => c.id === body.campaign_id)?.name || '')
        : '';

      const rows = ordered.map((log) => {
        const company = companyMap.get(log.company_id) || null;
        const research = researchByCompany.get(normaliseName(log.company))
          || researchByCompany.get(normaliseName(company?.name))
          || null;
        return buildLeadRow(log, {
          contact: contactMap.get(log.contact_id) || null,
          company,
          campaignName: campaigns.find((c) => c.id === log.campaign_id)?.name || reportCampaignName,
          research,
          intelligence: intelligenceByCompany.get(log.company_id) || null,
        });
      });

      const csv = toCsv(LEAD_HEADERS, rows);
      return new Response(csv, {
        status: 200,
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="client-report-${org.slug}-${startISO.slice(0,10)}.csv"` }
      });
    }

    return Response.json(report);
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}