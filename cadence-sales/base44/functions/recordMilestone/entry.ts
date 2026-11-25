import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveTenant } from '../../shared/roleGuards.ts';

// Server-side milestone service. Milestones are derived from verified events.
// Idempotent: if the milestone already exists, returns ok without duplicating.
export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const { milestone_key, related_entity_type, related_entity_id } = body;

    if (!milestone_key) {
      return Response.json({ error: 'milestone_key is required.' }, { status: 400 });
    }

    const VALID_KEYS = [
      'org_setup_completed', 'telephony_connected', 'first_test_call',
      'first_campaign_activated', 'first_caller_invited', 'first_real_call',
      'first_conversation', 'first_callback', 'first_callback_completed',
      'first_qualified_opportunity', 'first_meeting', 'first_client_report', 'first_handoff'
    ];
    if (!VALID_KEYS.includes(milestone_key)) {
      return Response.json({ error: 'Invalid milestone key.' }, { status: 400 });
    }

    // Idempotency check.
    const existing = await base44.asServiceRole.entities.PilotMilestone.filter({
      organisation_id: org.id, milestone_key
    });
    if (existing && existing.length > 0) {
      return Response.json({ ok: true, action: 'already_exists', milestone_key });
    }

    // Verify the milestone is warranted.
    const verified = await verifyMilestone(base44, org.id, milestone_key);
    if (!verified) {
      return Response.json({ error: 'Milestone not yet verified — the related event has not occurred.' }, { status: 400 });
    }

    const pilots = await base44.asServiceRole.entities.PilotProgramme.filter({ organisation_id: org.id });
    const pilotId = pilots && pilots[0]?.id;

    const now = new Date().toISOString();
    await base44.asServiceRole.entities.PilotMilestone.create({
      organisation_id: org.id,
      pilot_programme_id: pilotId || '',
      milestone_key,
      achieved_at: now,
      related_entity_type: related_entity_type || '',
      related_entity_id: related_entity_id || '',
      created_at: now,
    });

    return Response.json({ ok: true, action: 'created', milestone_key, achieved_at: now });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}

async function verifyMilestone(base44, orgId, key) {
  switch (key) {
    case 'org_setup_completed':
      return true;
    case 'telephony_connected': {
      const creds = await base44.asServiceRole.entities.ProviderCredential.filter({ organisation_id: orgId });
      return creds.length > 0;
    }
    case 'first_test_call':
    case 'first_real_call': {
      const logs = await base44.asServiceRole.entities.CallLog.filter({ organisation_id: orgId }, '-created_date', 5);
      return logs.length > 0;
    }
    case 'first_campaign_activated': {
      const campaigns = await base44.asServiceRole.entities.Campaign.filter({ organisation_id: orgId });
      return campaigns.some(c => c.status === 'active');
    }
    case 'first_caller_invited': {
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ organisation_id: orgId });
      return profiles.length >= 2;
    }
    case 'first_conversation': {
      const logs = await base44.asServiceRole.entities.CallLog.filter({ organisation_id: orgId }, '-created_date', 50);
      return logs.some(l => {
        const o = l.primary_outcome || l.outcome;
        return o && !['no_answer', 'voicemail', 'busy', 'bad_number', 'invalid_number'].includes(o);
      });
    }
    case 'first_callback': {
      const tasks = await base44.asServiceRole.entities.Task.filter({ organisation_id: orgId, task_type: 'callback' });
      return tasks.length > 0;
    }
    case 'first_callback_completed': {
      const tasks = await base44.asServiceRole.entities.Task.filter({ organisation_id: orgId, task_type: 'callback' });
      return tasks.some(t => t.status === 'completed');
    }
    case 'first_qualified_opportunity': {
      const opps = await base44.asServiceRole.entities.Opportunity.filter({ organisation_id: orgId });
      return opps.length > 0;
    }
    case 'first_meeting': {
      const meetings = await base44.asServiceRole.entities.Meeting.filter({ organisation_id: orgId });
      return meetings.length > 0;
    }
    case 'first_client_report': {
      const campaigns = await base44.asServiceRole.entities.Campaign.filter({ organisation_id: orgId });
      return campaigns.some(c => c.client_visible_summary);
    }
    case 'first_handoff': {
      const handoffs = await base44.asServiceRole.entities.HandoffAttempt.filter({ organisation_id: orgId, status: 'succeeded' });
      return handoffs.length > 0;
    }
    default:
      return false;
  }
}