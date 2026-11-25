import { resolveTenant } from '../../shared/tenantAuth.ts';
import { closeMeetingTasks, rescheduleMeetingTasks, createPostMeetingTask } from '../../shared/meetingTasks.ts';

export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const { meeting_id, action, starts_at, ends_at, cancellation_reason } = body;

    if (!meeting_id || !action) {
      return Response.json({ error: 'meeting_id and action are required' }, { status: 400 });
    }

    const meeting = await base44.entities.Meeting.get(meeting_id);
    if (!meeting || meeting.organisation_id !== org.id) {
      return Response.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updates = { updated_at: now };
    let auditAction = '';

    if (action === 'reschedule') {
      if (!starts_at) return Response.json({ error: 'starts_at is required for reschedule' }, { status: 400 });
      updates.starts_at = starts_at;
      updates.ends_at = ends_at || new Date(new Date(starts_at).getTime() + 60 * 60 * 1000).toISOString();
      updates.status = 'booked';
      auditAction = 'meeting_rescheduled';

      // Update linked opportunity meeting_status
      await base44.entities.Opportunity.update(meeting.opportunity_id, {
        meeting_status: 'rescheduled',
        updated_at: now,
      }).catch(() => {});

      await rescheduleMeetingTasks(base44.asServiceRole, { ...meeting, starts_at: updates.starts_at, ends_at: updates.ends_at });
    }
    else if (action === 'cancel') {
      if (meeting.status === 'cancelled') {
        return Response.json({ error: 'Meeting is already cancelled' }, { status: 409 });
      }
      updates.status = 'cancelled';
      updates.cancelled_at = now;
      updates.cancellation_reason = cancellation_reason || '';
      auditAction = 'meeting_cancelled';

      await closeMeetingTasks(base44.asServiceRole, meeting.id, 'cancelled');

      await base44.entities.Opportunity.update(meeting.opportunity_id, {
        meeting_status: 'cancelled',
        updated_at: now,
      }).catch(() => {});
    }
    else if (action === 'complete') {
      updates.status = 'completed';
      auditAction = 'meeting_completed';

      await base44.entities.Opportunity.update(meeting.opportunity_id, {
        meeting_status: 'completed',
        stage: 'handoff_ready',
        updated_at: now,
      }).catch(() => {});

      // Create post-meeting follow-up task
      await createPostMeetingTask(
        base44.asServiceRole, { ...meeting, organiser_user_id: meeting.organiser_user_id || user.id },
        org.id, org.timezone || 'Europe/London',
      ).catch(() => {});
    }
    else if (action === 'no_show') {
      updates.status = 'no_show';
      auditAction = 'meeting_cancelled';

      await base44.entities.Opportunity.update(meeting.opportunity_id, {
        meeting_status: 'no_show',
        updated_at: now,
      }).catch(() => {});
    }
    else {
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.Meeting.update(meeting_id, updates);

    await base44.asServiceRole.entities.AuditLog.create({
      organisation_id: org.id,
      actor_user_id: user.id,
      action: auditAction,
      entity_type: 'Meeting',
      entity_id: meeting.id,
      previous_value: meeting.status,
      new_value: updates.status || action,
      timestamp: now,
    });

    return Response.json({ meeting: updated });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}