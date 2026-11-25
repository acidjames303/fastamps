import { resolveManager } from '../../shared/roleGuards.ts';
import { orgTimezone } from '../../shared/taskTime.ts';
import { getFollowUpSettings, nextValidCallingTime } from '../../shared/outcomeRules.ts';

// Reschedule overdue new_call Tasks across working days.
// Does NOT delete, complete, or create replacement Tasks — only updates due_at/due_date.
// Preserves priority order, user assignment, Contact/Company/campaign links, idempotency keys.
//
// action: 'preview' — return distribution preview without applying.
// action: 'apply'   — apply the rescheduling and create an AuditLog.
export default async function (req) {
  const { base44, user, profile, org } = await resolveManager(req);
  const body = await req.json().catch(() => ({}));
  const { action, daily_limit, start_date } = body || {};

  if (!action || !['preview', 'apply'].includes(action)) {
    return Response.json({ error: 'action must be "preview" or "apply".' }, { status: 400 });
  }

  const tz = orgTimezone(org);
  const settings = getFollowUpSettings(org);
  const limit = Math.max(1, Math.min(50, daily_limit || 10));
  const now = Date.now();

  // Find overdue pending new_call tasks for this org
  const allTasks = await base44.asServiceRole.entities.Task.filter(
    { organisation_id: org.id, task_type: 'new_call', status: 'pending' },
    '-due_at', 500
  ).catch(() => []);

  const overdue = (allTasks || []).filter(t => {
    const dueMs = t.due_at ? new Date(t.due_at).getTime() : (t.due_date ? new Date(t.due_date).getTime() : 0);
    return dueMs > 0 && dueMs < now;
  });

  // Sort by due_at asc to preserve priority order
  overdue.sort((a, b) => {
    const ad = a.due_at ? new Date(a.due_at).getTime() : 0;
    const bd = b.due_at ? new Date(b.due_at).getTime() : 0;
    return ad - bd;
  });

  // Compute the start date: explicit, or next working day
  let startMs;
  if (start_date) {
    startMs = new Date(start_date + 'T00:00:00').getTime();
  } else {
    // Tomorrow in org timezone, then advance to next working day
    const tomorrow = new Date(now + 86400000);
    startMs = tomorrow.getTime();
  }

  // Build the schedule distribution
  const distribution = [];
  let currentDayStart = startMs;
  let taskIndex = 0;

  while (taskIndex < overdue.length) {
    // Advance to next valid calling day
    currentDayStart = nextValidCallingTime(currentDayStart, settings);
    const dayDate = new Date(currentDayStart);
    const dayStr = dayDate.toISOString().split('T')[0];

    const tasksThisDay = Math.min(limit, overdue.length - taskIndex);
    distribution.push({ date: dayStr, count: tasksThisDay });

    // Move to next day
    currentDayStart = new Date(dayDate.getTime() + 86400000).getTime();
    taskIndex += tasksThisDay;
  }

  if (action === 'preview') {
    return Response.json({
      preview: true,
      task_count: overdue.length,
      daily_limit: limit,
      start_date: distribution[0]?.date || '',
      working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      timezone: tz,
      distribution,
    });
  }

  // action === 'apply'
  // Build the update list with distributed due_at times within calling hours
  const updates = [];
  let currentDayMs = startMs;
  let idx = 0;

  while (idx < overdue.length) {
    // Find next valid calling day
    currentDayMs = nextValidCallingTime(currentDayMs, settings);
    const dayStart = new Date(currentDayMs);
    const callingHourStart = settings.calling_hour_start || 9;
    const callingHourEnd = settings.calling_hour_end || 18;
    const hoursSpan = callingHourEnd - callingHourStart;

    const tasksThisDay = Math.min(limit, overdue.length - idx);
    for (let i = 0; i < tasksThisDay; i++) {
      // Distribute within calling hours (e.g. 9:00 to just before 18:00)
      const fraction = tasksThisDay > 1 ? i / (tasksThisDay - 1) : 0;
      const hourOffset = Math.floor(fraction * hoursSpan);
      const minuteOffset = Math.floor((fraction * hoursSpan - hourOffset) * 60);
      const dueAtMs = currentDayMs + hourOffset * 3600000 + minuteOffset * 60000;
      const dueAt = new Date(dueAtMs).toISOString();
      const dueDate = dueAt.split('T')[0];

      updates.push({
        id: overdue[idx].id,
        due_at: dueAt,
        due_date: dueDate,
      });
      idx++;
    }
    // Move to next day
    currentDayMs = new Date(currentDayMs + 86400000).getTime();
  }

  // Apply updates
  let updated = 0;
  let failed = 0;
  for (const u of updates) {
    try {
      await base44.asServiceRole.entities.Task.update(u.id, {
        due_at: u.due_at,
        due_date: u.due_date,
      });
      updated++;
    } catch {
      failed++;
    }
  }

  // Create AuditLog
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      organisation_id: org.id,
      actor_user_id: user.id,
      action: 'callback_rescheduled',
      entity_type: 'Task',
      entity_id: '',
      previous_value: `${overdue.length} overdue new_call tasks`,
      new_value: `Rescheduled ${updated} tasks at ${limit}/day from ${distribution[0]?.date || 'N/A'}`,
      timestamp: new Date().toISOString(),
    });
  } catch { /* non-fatal */ }

  return Response.json({
    ok: true,
    updated,
    failed,
    total: overdue.length,
    distribution,
  });
}