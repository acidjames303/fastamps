import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertTaskOwned, isReadOnly } from '../../shared/taskLogic.ts';
import { laterToday, tomorrowAt9, nextWorkingDay, orgTimezone } from '../../shared/taskTime.ts';

// Snooze a task until a chosen time. Options: later_today, tomorrow,
// next_working_day, custom (requires due_at ISO string).
// The task stays pending but is hidden from the queue until snoozed_until.
export default async function (req) {
  const { base44, user, profile, org } = await resolveTenant(req);
  if (isReadOnly(profile)) {
    return Response.json({ error: 'Reporting users cannot snooze tasks.' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { task_id, option, due_at } = body || {};
  if (!task_id) return Response.json({ error: 'task_id is required.' }, { status: 400 });

  const task = await assertTaskOwned(base44, org, task_id);
  const tz = orgTimezone(org);
  const now = new Date();

  let snoozedUntil;
  switch (option) {
    case 'later_today':
      snoozedUntil = laterToday(tz, now); break;
    case 'tomorrow':
      snoozedUntil = tomorrowAt9(tz, now); break;
    case 'next_working_day':
      snoozedUntil = nextWorkingDay(tz, now); break;
    case 'custom':
      if (!due_at) return Response.json({ error: 'due_at is required for custom snooze.' }, { status: 400 });
      snoozedUntil = new Date(due_at); break;
    default:
      return Response.json({ error: 'Invalid snooze option. Use later_today, tomorrow, next_working_day, or custom.' }, { status: 400 });
  }

  if (snoozedUntil.getTime() <= now.getTime()) {
    return Response.json({ error: 'Snooze time must be in the future.' }, { status: 400 });
  }

  const iso = snoozedUntil.toISOString();
  await base44.asServiceRole.entities.Task.update(task_id, {
    status: 'pending',
    snoozed_until: iso,
    due_at: task.due_at || iso,
    locked_by_user_id: '',
    locked_at: undefined,
  });

  return Response.json({ snoozed: true, task_id, snoozed_until: iso });
}