// Meeting task management — creates, updates, and closes Tasks linked to Meetings.
// Uses source_reference pattern: `meeting:<meetingId>` and idempotency keys to prevent duplicates.

const PREP_IDEMPOTENCY = (meetingId: string) => `meeting-prep-${meetingId}`;
const POST_MEETING_IDEMPOTENCY = (meetingId: string) => `meeting-post-${meetingId}`;

// Create the preparation task when a meeting is booked or rescheduled.
export async function createMeetingPrepTask(
  client: any,
  meeting: any,
  orgId: string,
  timezone: string,
  assignedUserId?: string,
) {
  const startsAt = new Date(meeting.starts_at);
  // Preparation due 24h before the meeting (or now if sooner).
  const dueAt = new Date(Math.min(startsAt.getTime() - 24 * 60 * 60 * 1000, Date.now()));
  // Don't set due in the past if meeting is soon — use now + 1h as floor.
  const floor = new Date(Date.now() + 60 * 60 * 1000);
  const finalDue = dueAt < floor ? floor : dueAt;

  return client.entities.Task.create({
    organisation_id: orgId,
    assigned_user_id: assignedUserId || meeting.organiser_user_id || '',
    created_by_user_id: meeting.organiser_user_id || '',
    company_id: meeting.company_id,
    contact_id: meeting.contact_id || '',
    task_type: 'follow_up',
    title: `Meeting preparation: ${meeting.title}`,
    description: meeting.preparation_notes || `Prepare for ${meeting.meeting_type} meeting.`,
    status: 'pending',
    priority: 'high',
    source: 'manager',
    source_reference: `meeting:${meeting.id}:prep`,
    due_at: finalDue.toISOString(),
    due_date: finalDue.toISOString().split('T')[0],
    timezone,
    idempotency_key: PREP_IDEMPOTENCY(meeting.id),
  });
}

// Create a post-meeting action task when a meeting is completed.
export async function createPostMeetingTask(
  client: any,
  meeting: any,
  orgId: string,
  timezone: string,
  assignedUserId?: string,
) {
  const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Due 24h after meeting completion.

  return client.entities.Task.create({
    organisation_id: orgId,
    assigned_user_id: assignedUserId || meeting.organiser_user_id || '',
    created_by_user_id: meeting.organiser_user_id || '',
    company_id: meeting.company_id,
    contact_id: meeting.contact_id || '',
    task_type: 'follow_up',
    title: `Post-meeting follow-up: ${meeting.title}`,
    description: `Record meeting outcome and agreed next steps for ${meeting.title}.`,
    status: 'pending',
    priority: 'high',
    source: 'manager',
    source_reference: `meeting:${meeting.id}:post`,
    due_at: dueAt.toISOString(),
    due_date: dueAt.toISOString().split('T')[0],
    timezone,
    idempotency_key: POST_MEETING_IDEMPOTENCY(meeting.id),
  });
}

// Close all open meeting-related tasks (used on cancellation).
export async function closeMeetingTasks(client: any, meetingId: string, reason: string) {
  const [prepTasks, postTasks] = await Promise.all([
    client.entities.Task.filter({ source_reference: `meeting:${meetingId}:prep` }, '-created_date', 10).catch(() => []),
    client.entities.Task.filter({ source_reference: `meeting:${meetingId}:post` }, '-created_date', 10).catch(() => []),
  ]);
  const tasks = [...(prepTasks || []), ...(postTasks || [])];

  const open = tasks.filter((t: any) => t.status === 'pending' || t.status === 'in_progress');
  for (const t of open) {
    await client.entities.Task.update(t.id, {
      status: 'cancelled',
      skip_reason: `Meeting ${reason}`,
      completed_at: new Date().toISOString(),
    });
  }
}

// Update preparation task due date when a meeting is rescheduled.
export async function rescheduleMeetingTasks(client: any, meeting: any) {
  const tasks = await client.entities.Task
    .filter({ source_reference: `meeting:${meeting.id}:prep` }, '-created_date', 10)
    .catch(() => []);

  const startsAt = new Date(meeting.starts_at);
  const prepDueAt = new Date(Math.min(startsAt.getTime() - 24 * 60 * 60 * 1000, Date.now()));
  const floor = new Date(Date.now() + 60 * 60 * 1000);
  const finalDue = prepDueAt < floor ? floor : prepDueAt;

  for (const t of tasks || []) {
    if (t.source_reference?.endsWith(':prep') && t.status === 'pending') {
      await client.entities.Task.update(t.id, {
        due_at: finalDue.toISOString(),
        due_date: finalDue.toISOString().split('T')[0],
      });
    }
  }
}