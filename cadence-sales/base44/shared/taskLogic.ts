// Deterministic task priority engine — no AI, no integration credits.
// Given a task and its resolved context (contact, company, fit, list, intel),
// returns { score, band, reason } or { excluded: true, reason }.

import { isOverdue, isToday } from './taskTime.ts';

const HOUR = 3600000;
const DAY = 86400000;

// Outcome categories (mirrors src/lib/targetLists.js).
const CONVERSATION = new Set([
  'connected', 'interested', 'not_interested', 'callback', 'lead', 'send_info',
  'future_potential', 'identify_new_contact', 'pa_screened',
  'connected_interested', 'connected_callback', 'connected_not_interested',
  'connected_wrong_person', 'connected_information_requested', 'connected_qualified',
  'gatekeeper',
]);
const INTERESTED = new Set(['lead', 'future_potential', 'interested']);
const SPOKE = new Set([
  'connected', 'interested', 'not_interested', 'callback', 'lead', 'send_info',
  'future_potential', 'identify_new_contact', 'wrong_person', 'duplicate',
  'not_suitable', 'no_sales_calls', 'pa_screened', 'customer_service_number',
  'connected_interested', 'connected_callback', 'connected_not_interested',
  'connected_wrong_person', 'connected_information_requested', 'connected_qualified',
  'gatekeeper',
]);

export { CONVERSATION, INTERESTED, SPOKE };

// Hard exclusion: returns { excluded, reason } or null if eligible.
export function checkExclusion(task, ctx) {
  const contact = ctx.contact;
  const list = ctx.list;
  const org = ctx.org;

  if (org && org.status !== 'active') return { excluded: true, reason: 'Organisation suspended' };
  if (ctx.profile && ctx.profile.status === 'suspended') return { excluded: true, reason: 'User suspended' };

  if (['completed', 'cancelled'].includes(task.status)) return { excluded: true, reason: 'Task closed' };

  if (contact) {
    if (contact.number_status === 'dnc') return { excluded: true, reason: 'Do-not-contact' };
    if (contact.number_status === 'bad' && !ctx.hasAlternativeNumber) return { excluded: true, reason: 'Bad number, no alternative' };
    if (!contact.phone) return { excluded: true, reason: 'No usable number' };
  }

  // Paused target list suppresses new-call work, but callbacks must be honoured.
  if (list && list.status === 'paused' && task.task_type === 'new_call') {
    return { excluded: true, reason: 'Target list paused' };
  }

  // Locked by another user.
  if (task.locked_by_user_id && task.locked_by_user_id !== ctx.userId) {
    return { excluded: true, reason: 'Locked by another user' };
  }

  return null;
}

// Has a direct/verified number vs switchboard-only.
function numberType(ctx) {
  const c = ctx.contact;
  if (!c || !c.phone) return 'none';
  if (c.number_status === 'good') return 'direct';
  // Direct mobile vs switchboard is inferred from source/landline presence.
  if (ctx.company && ctx.company.landline && c.phone === ctx.company.landline) return 'switchboard';
  return 'other';
}

// Core priority calculation. Returns { score, band, reason }.
export function calculatePriority(task, ctx) {
  const now = ctx.now || Date.now();
  const tz = ctx.timezone || 'Europe/London';

  const excl = checkExclusion(task, ctx);
  if (excl) return { score: 0, band: 'excluded', reason: excl.reason, excluded: true };

  let score = 40;
  const reasons = [];
  const t = task.task_type;
  const dueMs = task.due_at ? new Date(task.due_at).getTime() : 0;

  // 1. Timed callback due now
  if (t === 'callback' && dueMs) {
    if (dueMs <= now) { score = 100; reasons.push('Callback due now'); }
    else if (dueMs <= now + HOUR) { score = 96; reasons.push('Callback due soon'); }
    else { score = 72; reasons.push('Scheduled callback'); }
  }
  // 2. Overdue callback / overdue task
  else if (dueMs && dueMs < now) {
    const hours = Math.floor((now - dueMs) / HOUR);
    score = 92;
    reasons.push(hours < 24 ? `${hours}h overdue` : `${Math.floor(hours / 24)}d overdue`);
  }
  // 3. Interested prospect with follow-up due
  else if (t === 'follow_up') {
    score = 86; reasons.push('Interested prospect follow-up');
    if (dueMs && dueMs <= now + DAY) reasons.push('follow-up due today');
  }
  // 4. Previous meaningful conversation (revisit)
  else if (t === 'revisit') {
    score = 80; reasons.push('Previous conversation');
  }
  // 5. Urgent manager task
  else if (task.priority === 'urgent') {
    score = 88; reasons.push('Urgent manager task');
  }
  // 6-8. New call — fit + number based
  else if (t === 'new_call') {
    const band = ctx.fit ? ctx.fit.fit_band : 'low';
    const nt = numberType(ctx);
    if (band === 'high' && nt === 'direct') { score = 76; reasons.push('High-fit, direct number'); }
    else if (band === 'high' && nt === 'switchboard') { score = 66; reasons.push('High-fit, switchboard'); }
    else if (band === 'high') { score = 64; reasons.push('High-fit prospect'); }
    else if (band === 'medium') { score = 56; reasons.push('Medium-fit prospect'); }
    else { score = 46; reasons.push('New prospect'); }
  }
  // 9. Previous unanswered attempt eligible for retry
  else if (t === 'new_call' && ctx.contact && (ctx.contact.call_count || 0) > 0) {
    score -= 6; reasons.push(`${ctx.contact.call_count} previous attempts`);
  }
  // 10. Research / data review
  else if (t === 'research_review' || t === 'data_review') {
    score = 34; reasons.push('Review required');
  }
  // 11. Opportunity review
  else if (t === 'opportunity_review') {
    score = 78; reasons.push('Opportunity review');
  }
  // 12. Low priority / manual
  else {
    score = 30; reasons.push('Low priority');
  }

  // Attempt penalty for retry tasks.
  if ((task.attempt_number || 1) > 1) {
    score -= 4;
    reasons.push(`${task.attempt_number} attempts`);
  }

  // Manual priority boost.
  if (task.priority === 'high' && score < 70) { score = Math.max(score, 70); reasons.push('Manager: high priority'); }
  if (task.priority === 'low') score -= 5;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let band = 'low';
  if (score >= 85) band = 'urgent';
  else if (score >= 68) band = 'high';
  else if (score >= 45) band = 'normal';
  else band = 'low';

  return { score, band, reason: reasons.join('; ') || 'Standard priority' };
}

// Idempotency key for a task: org:type:contact_id (or company_id).
export function taskIdempotencyKey(orgId, taskType, refId) {
  return `${orgId}:${taskType}:${refId || 'none'}`;
}

// Find an existing active (non-terminal) task with the same idempotency key.
export async function findActiveByTaskKey(base44, organisation_id, idempotency_key) {
  if (!idempotency_key) return null;
  const existing = await base44.asServiceRole.entities.Task.filter(
    { organisation_id, idempotency_key }, '-created_date', 10
  ).catch(() => []);
  return (existing || []).find((t) => ['pending', 'in_progress'].includes(t.status)) || null;
}

// Assert task belongs to the caller's organisation.
export async function assertTaskOwned(base44, org, task_id) {
  if (!task_id) throw Object.assign(new Error('task_id required'), { status: 400 });
  const task = await base44.asServiceRole.entities.Task.get(task_id).catch(() => null);
  if (!task) throw Object.assign(new Error('Task not found'), { status: 404 });
  if (task.organisation_id !== org.id) throw Object.assign(new Error('Task does not belong to your organisation'), { status: 403 });
  return task;
}

// Role helpers.
export function isManager(profile) {
  return profile && ['organisation_admin', 'sales_manager', 'platform_owner'].includes(profile.app_role);
}
export function isReadOnly(profile) {
  return profile && profile.app_role === 'reporting_user';
}