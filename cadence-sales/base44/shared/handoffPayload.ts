// Canonical handoff payload builder — single source of truth for handoff data.
// Transforms through provider adapters; never sends internal IDs externally unless required.

export const PAYLOAD_VERSION = 1;

export const DEFAULT_FIELD_MAPPING = {
  company_name: 'name',
  company_website: 'website',
  contact_first_name: 'firstname',
  contact_last_name: 'lastname',
  contact_email: 'email',
  contact_phone: 'phone',
  contact_job_title: 'jobtitle',
  deal_name: 'dealname',
  value: 'amount',
  currency: 'deal_currency_code',
  qualification_summary: 'cadence_qualification_summary',
  source_campaign: 'cadence_campaign',
  agreed_next_step: 'cadence_next_step',
  meeting_date: 'cadence_meeting_date',
  cadence_opportunity_id: 'cadence_opportunity_id',
};

// Build the canonical handoff payload from an opportunity and its related records.
// client: the Base44 SDK client (asServiceRole or plain).
// Returns a plain object safe to serialise and send externally.
export async function buildHandoffPayload(client: any, opportunityId: string) {
  const opp = await client.entities.Opportunity.get(opportunityId);

  const [company, contact, campaign, meeting, ownerProfile] = await Promise.all([
    opp.company_id ? client.entities.Company.get(opp.company_id).catch(() => null) : null,
    opp.primary_contact_id ? client.entities.Contact.get(opp.primary_contact_id).catch(() => null) : null,
    opp.campaign_id ? client.entities.Campaign.get(opp.campaign_id).catch(() => null) : null,
    opp.meeting_id ? client.entities.Meeting.get(opp.meeting_id).catch(() => null) : null,
    opp.owner_user_id ? client.entities.UserProfile.filter({ user_id: opp.owner_user_id }, '-created_date', 1).catch(() => []) : [],
  ]);

  // Client-safe call history: connected calls only, notes only, no recordings.
  const callLogs = await client.entities.CallLog
    .filter({ company_id: opp.company_id }, '-started_at', 10)
    .catch(() => []);
  const safeCallSummary = (callLogs || [])
    .filter((cl: any) => cl.primary_outcome && cl.primary_outcome.startsWith('connected'))
    .slice(0, 5)
    .map((cl: any) => ({
      date: cl.started_at || cl.created_date,
      outcome: cl.primary_outcome,
      notes: cl.outcome_notes || null,
    }));

  const owner = Array.isArray(ownerProfile) && ownerProfile.length > 0 ? ownerProfile[0] : null;

  return {
    payload_version: PAYLOAD_VERSION,
    cadence_opportunity_id: opp.id,
    campaign_reference: campaign?.client_reference || null,
    client_name: campaign?.client_name || opp.client_name || null,
    company: {
      name: company?.name || null,
      website: company?.website || null,
      domain: company?.domain || null,
      industry: company?.industry || null,
      employee_range: company?.employee_range || null,
      location: company?.location || null,
    },
    primary_contact: {
      full_name: contact?.full_name || null,
      first_name: contact?.full_name?.split(' ')[0] || null,
      last_name: contact?.full_name?.split(' ').slice(1).join(' ') || null,
      job_title: contact?.job_title || null,
      email: contact?.email || null,
      phone: contact?.phone || null,
      linkedin: contact?.linkedin || null,
    },
    qualification: {
      status: opp.qualification_status,
      need_summary: opp.need_summary || null,
      pain_points: opp.pain_points || null,
      current_solution: opp.current_solution || null,
      business_impact: opp.business_impact || null,
      timing: opp.timing || null,
      budget_status: opp.budget_status || null,
      authority_status: opp.authority_status || 'unknown',
      decision_process: opp.decision_process || null,
      decision_makers: opp.decision_makers || null,
    },
    meeting: meeting
      ? {
          title: meeting.title,
          type: meeting.meeting_type,
          starts_at: meeting.starts_at,
          ends_at: meeting.ends_at,
          timezone: meeting.timezone,
          location: meeting.location || null,
          meeting_url: meeting.meeting_url || null,
        }
      : null,
    agreed_next_step: opp.next_step || null,
    estimated_value: opp.estimated_value || 0,
    currency: opp.currency || 'GBP',
    owner: {
      full_name: owner?.full_name || null,
      email: owner?.email || null,
    },
    source: {
      campaign_id: opp.campaign_id || null,
      call_log_id: opp.source_call_log_id || null,
    },
    client_visible_call_summary: safeCallSummary,
    generated_at: new Date().toISOString(),
  };
}

// Validate that the payload has minimum required fields before sending.
export function validatePayload(payload: any): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!payload.company?.name) missing.push('company_name');
  if (!payload.primary_contact?.full_name) missing.push('contact_name');
  if (!payload.primary_contact?.email && !payload.primary_contact?.phone) missing.push('contact_email_or_phone');
  if (!payload.qualification?.need_summary) missing.push('need_summary');
  if (!payload.agreed_next_step) missing.push('next_step');
  return { valid: missing.length === 0, missing };
}