import { resolveTenant } from '../../shared/tenantAuth.ts';
import { buildTodayWork, buildCallingQueue } from '../../shared/todayWork.ts';

// Prepares an ordered calling session: recalculates eligible tasks, locks the
// first task for the caller, and returns the ordered queue with company +
// contact context for the Company-first Dialer. Callbacks are kept ahead of
// new calls. Excludes suppressed/bad records and respects paused lists.
// Does not auto-dial — that belongs to a future sprint.
export default async function (req) {
  const { base44, user, profile, org } = await resolveTenant(req);
  if (profile.app_role === 'reporting_user') {
    return Response.json({ error: 'Reporting users cannot start calling sessions.' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { target_list_id, campaign_id } = body || {};

  const todayWork = await buildTodayWork(base44, { user, profile, org, campaignId: campaign_id || '' });
  const queue = buildCallingQueue(todayWork);

  if (!queue.length) {
    return Response.json({ session_started: false, queue: [], reason: 'No eligible tasks to call right now.' });
  }

  // Lock the first task for the caller.
  const first = queue[0];
  const now = new Date().toISOString();
  await base44.asServiceRole.entities.Task.update(first.task.id, {
    locked_by_user_id: user.id,
    locked_at: now,
    assigned_user_id: first.task.assigned_user_id || user.id,
    started_at: first.task.started_at || now,
  });

  return Response.json({
    session_started: true,
    session_id: `sess_${user.id}_${Date.now()}`,
    target_list_id: target_list_id || campaign_id || first.task.target_list_id || '',
    queue: queue.map((r) => ({
      position: r.position,
      task_id: r.task.id,
      task_type: r.task.task_type,
      priority_score: r.priority_score,
      priority_reason: r.priority_reason,
      company_id: r.task.company_id || '',
      company_name: r.company?.name || '',
      contact_id: r.task.contact_id || '',
      contact_name: r.contact?.full_name || '',
      job_title: r.contact?.job_title || '',
      phone: r.phone,
      target_list_id: r.task.target_list_id || '',
      intelligence_id: r.intel?.id || '',
    })),
  });
}