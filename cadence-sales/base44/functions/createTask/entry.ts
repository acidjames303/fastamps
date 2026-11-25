import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertListOwned, assertCompanyOwned, assertContactOwned } from '../../shared/ownership.ts';
import { calculatePriority, findActiveByTaskKey, taskIdempotencyKey, isReadOnly, isManager } from '../../shared/taskLogic.ts';
import { orgTimezone } from '../../shared/taskTime.ts';

// Create a task. Supports manual user creation, manager-created tasks, and
// system-sourced tasks (prospect_approval, call_outcome, target_list).
// Idempotent: rejects duplicate active tasks for the same record+type.
// Validates all referenced IDs against the caller's organisation.
// Does not use AI or integration credits.
export default async function (req) {
  const { base44, user, profile, org } = await resolveTenant(req);
  if (isReadOnly(profile)) {
    return Response.json({ error: 'Reporting users cannot create tasks.' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const {
    task_type, title, description,
    target_list_id, company_id, contact_id, prospect_id, call_log_id,
    due_at, due_date, priority, source, source_reference,
    assigned_user_id, maximum_attempts,
  } = body || {};

  if (!task_type) return Response.json({ error: 'task_type is required.' }, { status: 400 });

  // Validate referenced records belong to the caller's organisation.
  let list = null, company = null, contact = null;
  if (target_list_id) list = await assertListOwned(base44, org, target_list_id);
  if (company_id) company = await assertCompanyOwned(base44, org, company_id);
  if (contact_id) contact = await assertContactOwned(base44, org, contact_id);

  // Manager-only: only managers/admins can assign tasks to other users.
  let assignedTo = assigned_user_id || '';
  if (assigned_user_id && assigned_user_id !== user.id && !isManager(profile)) {
    return Response.json({ error: 'Only managers can assign tasks to other users.' }, { status: 403 });
  }

  // Idempotency: prevent duplicate active tasks for the same record + type.
  const refId = contact_id || company_id || target_list_id || call_log_id || source_reference || '';
  const idemKey = body.idempotency_key || taskIdempotencyKey(org.id, task_type, refId);
  const existing = await findActiveByTaskKey(base44, org.id, idemKey);
  if (existing) {
    return Response.json({ created: false, already_exists: true, task_id: existing.id });
  }

  // Compute initial priority.
  const fit = target_list_id && company_id
    ? (await base44.asServiceRole.entities.TargetListCompanyFit.filter(
        { target_list_id, company_id, organisation_id: org.id }).catch(() => []))[0]
    : null;
  const pctx = { org, profile, userId: user.id, contact, company, list, fit, timezone: orgTimezone(org), now: Date.now() };
  const p = calculatePriority({ task_type, status: 'pending', priority: priority || 'normal', attempt_number: 1, locked_by_user_id: '' }, pctx);

  const tz = orgTimezone(org);
  const task = await base44.asServiceRole.entities.Task.create({
    organisation_id: org.id,
    assigned_user_id: assignedTo,
    created_by_user_id: user.id,
    target_list_id: target_list_id || undefined,
    company_id: company_id || undefined,
    contact_id: contact_id || undefined,
    prospect_id: prospect_id || undefined,
    call_log_id: call_log_id || undefined,
    task_type,
    title: title || '',
    description: description || '',
    status: 'pending',
    priority: priority || 'normal',
    priority_score: p.score,
    priority_reason: p.reason,
    due_at: due_at || undefined,
    due_date: due_date || (due_at ? due_at.slice(0, 10) : undefined),
    timezone: tz,
    source: source || 'user',
    source_reference: source_reference || '',
    idempotency_key: idemKey,
    attempt_number: 1,
    maximum_attempts: maximum_attempts || 1,
    locked_by_user_id: '',
  });

  return Response.json({ created: true, task_id: task.id });
}