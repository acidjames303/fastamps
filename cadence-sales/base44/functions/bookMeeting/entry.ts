import { resolveTenant } from '../../shared/tenantAuth.ts';
import { createMeetingPrepTask } from '../../shared/meetingTasks.ts';

export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const {
      opportunity_id, meeting_type, title, starts_at, ends_at, timezone,
      location_type, location, meeting_url,
      attendee_names, attendee_emails, client_attendee_names, client_attendee_emails,
      preparation_notes, client_visible_notes, source_call_log_id, source_task_id,
      assigned_user_ids, description,
    } = body;

    if (!opportunity_id || !starts_at) {
      return Response.json({ error: 'opportunity_id and starts_at are required' }, { status: 400 });
    }

    // Validate opportunity exists and belongs to org
    const opp = await base44.entities.Opportunity.get(opportunity_id);
    if (!opp || opp.organisation_id !== org.id) {
      return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    // Check for existing active meeting (prevent duplicates)
    const existing = await base44.asServiceRole.entities.Meeting.filter(
      { opportunity_id }, '-created_date', 1,
    ).catch(() => []);
    if (existing && existing.length > 0 && existing[0].status !== 'cancelled') {
      return Response.json({ error: 'An active meeting already exists for this opportunity' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const endAt = ends_at || new Date(new Date(starts_at).getTime() + 60 * 60 * 1000).toISOString();

    // Create the meeting
    const meeting = await base44.asServiceRole.entities.Meeting.create({
      organisation_id: org.id,
      campaign_id: opp.campaign_id || '',
      opportunity_id,
      company_id: opp.company_id,
      contact_id: opp.primary_contact_id || '',
      organiser_user_id: user.id,
      assigned_user_ids: assigned_user_ids || [],
      title: title || `Meeting: ${opp.name}`,
      description: description || '',
      meeting_type: meeting_type || 'discovery_call',
      status: 'booked',
      starts_at: starts_at,
      ends_at: endAt,
      timezone: timezone || org.timezone || 'Europe/London',
      location_type: location_type || 'online',
      location: location || '',
      meeting_url: meeting_url || '',
      attendee_names: attendee_names || [],
      attendee_emails: attendee_emails || [],
      client_attendee_names: client_attendee_names || [],
      client_attendee_emails: client_attendee_emails || [],
      source_call_log_id: source_call_log_id || opp.source_call_log_id || '',
      source_task_id: source_task_id || '',
      preparation_notes: preparation_notes || '',
      client_visible_notes: client_visible_notes || '',
      created_at: now,
      updated_at: now,
    });

    // Create preparation task (idempotent — won't duplicate)
    const prepTask = await createMeetingPrepTask(
      base44.asServiceRole, { ...meeting, organiser_user_id: user.id },
      org.id, org.timezone || 'Europe/London',
    ).catch(() => null);

    // Update opportunity
    await base44.entities.Opportunity.update(opportunity_id, {
      meeting_id: meeting.id,
      meeting_status: 'booked',
      stage: 'meeting_booked',
      updated_at: now,
    });

    // Audit log
    await base44.asServiceRole.entities.AuditLog.create({
      organisation_id: org.id,
      actor_user_id: user.id,
      action: 'meeting_booked',
      entity_type: 'Meeting',
      entity_id: meeting.id,
      new_value: 'booked',
      timestamp: now,
    });

    return Response.json({
      meeting,
      prep_task_id: prepTask?.id || null,
      calendar_status: 'ics_available',
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}