import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { buildHandoffPayload } from '../../shared/handoffPayload.ts';
import { checkAllowance, recordUsage } from '../../shared/costControl.ts';

export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    assertProviderAccess(profile);
    const body = await req.json().catch(() => ({}));
    const { meeting_id } = body;

    if (!meeting_id) {
      return Response.json({ error: 'meeting_id is required' }, { status: 400 });
    }

    const meeting = await base44.entities.Meeting.get(meeting_id);
    if (!meeting || meeting.organisation_id !== org.id) {
      return Response.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Gather context: company intelligence, contact, call history, qualification
    const [company, contact, intelligence, callLogs, opportunity] = await Promise.all([
      meeting.company_id ? base44.asServiceRole.entities.Company.get(meeting.company_id).catch(() => null) : null,
      meeting.contact_id ? base44.asServiceRole.entities.Contact.get(meeting.contact_id).catch(() => null) : null,
      meeting.company_id ? base44.asServiceRole.entities.CompanyIntelligence.filter({ company_id: meeting.company_id }, '-researched_at', 1).catch(() => []) : [],
      meeting.company_id ? base44.asServiceRole.entities.CallLog.filter({ company_id: meeting.company_id }, '-started_at', 10).catch(() => []) : [],
      meeting.opportunity_id ? base44.asServiceRole.entities.Opportunity.get(meeting.opportunity_id).catch(() => null) : null,
    ]);

    const intel = Array.isArray(intelligence) && intelligence.length > 0 ? intelligence[0] : null;
    const campaign = meeting.campaign_id ? await base44.asServiceRole.entities.Campaign.get(meeting.campaign_id).catch(() => null) : null;

    // Build the prompt — only from organisation-authorised records
    const prompt = `You are preparing a sales representative for an upcoming meeting. Based ONLY on the information below, write a concise meeting preparation summary.

MEETING:
- Title: ${meeting.title}
- Type: ${meeting.meeting_type}
- Starts: ${meeting.starts_at}
- Notes: ${meeting.client_visible_notes || meeting.description || 'N/A'}

COMPANY:
- Name: ${company?.name || 'N/A'}
- Industry: ${company?.industry || 'N/A'}
- Location: ${company?.location || 'N/A'}
- Website: ${company?.website || 'N/A'}

COMPANY INTELLIGENCE:
- Summary: ${intel?.ai_summary || 'N/A'}
- Tech Stack: ${(intel?.tech_stack || []).join(', ') || 'N/A'}
- News: ${intel?.news || 'N/A'}
- Buyer Signals: ${intel?.buyer_signals || 'N/A'}

CONTACT:
- Name: ${contact?.full_name || 'N/A'}
- Title: ${contact?.job_title || 'N/A'}
- LinkedIn: ${contact?.linkedin || 'N/A'}

OPPORTUNITY QUALIFICATION:
- Need: ${opportunity?.need_summary || 'N/A'}
- Pain Points: ${opportunity?.pain_points || 'N/A'}
- Current Solution: ${opportunity?.current_solution || 'N/A'}
- Business Impact: ${opportunity?.business_impact || 'N/A'}
- Timing: ${opportunity?.timing || 'N/A'}
- Budget: ${opportunity?.budget_status || 'N/A'}
- Authority: ${opportunity?.authority_status || 'N/A'}
- Next Step: ${opportunity?.next_step || 'N/A'}

CAMPAIGN PROPOSITION:
- Client: ${campaign?.client_name || 'N/A'}
- Offer: ${campaign?.offer || 'N/A'}
- Talking Points: ${campaign?.talking_points || 'N/A'}
- Qualification Questions: ${campaign?.qualification_questions || 'N/A'}
- Objection Guidance: ${campaign?.objection_guidance || 'N/A'}

RECENT CALL HISTORY:
${(callLogs || []).slice(0, 5).map((cl) => `- ${cl.started_at || 'N/A'}: ${cl.primary_outcome || cl.outcome} — ${cl.outcome_notes || cl.notes || ''}`).join('\n') || 'No previous calls.'}

Write a structured summary with these sections:
1. Company Overview
2. Contact & Authority
3. Key Pain Points & Needs
4. Recommended Talking Points
5. Likely Objections & Responses
6. Suggested Questions
7. Meeting Goal

Keep it practical and concise. Do not include source URLs or citations.`;

    await checkAllowance(base44, org, 'ai_action', 1);
    const now = new Date().toISOString();

    // Generate AI summary only when explicitly requested, never on page load.
    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          company_overview: { type: 'string' },
          contact_and_authority: { type: 'string' },
          pain_points_and_needs: { type: 'string' },
          talking_points: { type: 'string' },
          objections_and_responses: { type: 'string' },
          suggested_questions: { type: 'string' },
          meeting_goal: { type: 'string' },
        },
      },
    });

    // Save to meeting preparation_notes
    const summary = typeof llmResponse === 'string' ? llmResponse : JSON.stringify(llmResponse);
    await base44.asServiceRole.entities.Meeting.update(meeting_id, {
      preparation_notes: summary,
      updated_at: now,
    });
    await recordUsage(base44, {
      organisation_id: org.id,
      user_id: user.id,
      event_type: 'ai_action',
      provider: 'base44_ai',
      quantity: 1,
      estimated_cost: 1,
      actual_cost: 1,
      related_record_id: meeting.id,
    });

    return Response.json({ summary: llmResponse });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}