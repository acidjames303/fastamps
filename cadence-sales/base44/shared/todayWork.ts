// Shared today-work aggregation for getTodayWork + prepareCallingSession.
// Loads all active tasks for the org, resolves their related records,
// calculates deterministic priority, groups into sections, and computes
// daily performance stats. No AI, no integration credits.

import { calculatePriority, SPOKE, CONVERSATION, INTERESTED } from './taskLogic.ts';
import { todayRangeUTC, isToday, orgTimezone } from './taskTime.ts';

const OPPORTUNITY = new Set(['lead']);

// Load all records needed to evaluate today's work for one organisation.
async function loadContext(base44, org) {
  const orgId = org.id;
  const [tasks, contacts, companies, fits, lists, intel, logs] = await Promise.all([
    base44.asServiceRole.entities.Task.filter({ organisation_id: orgId }, '-created_date', 1000).catch(() => []),
    base44.asServiceRole.entities.Contact.filter({ organisation_id: orgId, id: { $ne: '6afae4e89382d5a14f4bcae0' } }, '-updated_date', 1000).catch(() => []),
    base44.asServiceRole.entities.Company.filter({ organisation_id: orgId, id: { $ne: '6afae4e7d0f2f6f3809b0e91' } }, '-created_date', 1000).catch(() => []),
    base44.asServiceRole.entities.TargetListCompanyFit.filter({ organisation_id: orgId }, '-scored_at', 1000).catch(() => []),
    base44.asServiceRole.entities.Campaign.filter({ organisation_id: orgId }, '-created_date', 200).catch(() => []),
    base44.asServiceRole.entities.CompanyIntelligence.filter({ organisation_id: orgId }, '-researched_at', 1000).catch(() => []),
    base44.asServiceRole.entities.CallLog.filter({ organisation_id: orgId }, '-created_date', 500).catch(() => []),
  ]);
  return {
    tasks: tasks || [],
    contacts: contacts || [],
    companies: companies || [],
    fits: fits || [],
    lists: lists || [],
    intel: intel || [],
    logs: logs || [],
    byContact: new Map((contacts || []).map((c) => [c.id, c])),
    byCompany: new Map((companies || []).map((c) => [c.id, c])),
    byFit: new Map((fits || []).map((f) => [`${f.target_list_id}:${f.company_id}`, f])),
    byList: new Map((lists || []).map((l) => [l.id, l])),
    intelByCompany: new Map((intel || []).map((i) => [i.company_id, i])),
    logsByContact: groupLogsByContact(logs || []),
  };
}

function groupLogsByContact(logs) {
  const m = new Map();
  for (const l of logs) {
    if (!l.contact_id) continue;
    if (!m.has(l.contact_id)) m.set(l.contact_id, []);
    m.get(l.contact_id).push(l);
  }
  return m;
}

// Build a priority-evaluated, sorted task row list for one user.
export async function buildTodayWork(base44, { user, profile, org, campaignId = '' }) {
  const ctx = await loadContext(base44, org);
  const tz = orgTimezone(org);
  const now = Date.now();
  const [todayStart, todayEnd] = todayRangeUTC(tz);

  // Resolve which tasks this user can see.
  const isMgr = ['organisation_admin', 'sales_manager', 'platform_owner'].includes(profile.app_role);
  const readOnly = profile.app_role === 'reporting_user';

  const visibleToUser = ctx.tasks.filter((t) => {
    if (['completed', 'cancelled', 'skipped'].includes(t.status)) return false;
    if (t.company_id === '6afae4e7d0f2f6f3809b0e91' || t.contact_id === '6afae4e89382d5a14f4bcae0') return false;
    // Snoozed tasks are hidden until their time arrives.
    if (t.snoozed_until && new Date(t.snoozed_until).getTime() > now) return false;
    // BDMs see assigned-to-me + unassigned.
    if (!isMgr) {
      if (t.assigned_user_id && t.assigned_user_id !== user.id) return false;
    }
    return true;
  });

  // Today works one campaign at a time: the toggle narrows every section, the
  // stats and the calling queue to the campaign being worked.
  const visibleTasks = campaignId
    ? visibleToUser.filter((t) => t.target_list_id === campaignId)
    : visibleToUser;

  // Campaigns this user has work in, for the Today toggle.
  const campaigns = [...new Set(visibleToUser.map((t) => t.target_list_id).filter(Boolean))]
    .map((id) => ({ id, name: ctx.byList.get(id)?.name || '' }))
    .filter((c) => c.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Evaluate priority for each visible task.
  const rows = [];
  for (const task of visibleTasks) {
    const contact = task.contact_id ? ctx.byContact.get(task.contact_id) : null;
    const company = task.company_id ? ctx.byCompany.get(task.company_id) : null;
    const list = task.target_list_id ? ctx.byList.get(task.target_list_id) : null;
    const fit = task.target_list_id && task.company_id ? ctx.byFit.get(`${task.target_list_id}:${task.company_id}`) : null;
    const intel = task.company_id ? ctx.intelByCompany.get(task.company_id) : null;
    const logsForContact = contact ? (ctx.logsByContact.get(contact.id) || []) : [];

    // Alternative number: another dialable contact at the same company.
    let hasAlternativeNumber = false;
    if (contact && contact.number_status === 'bad') {
      const sameCompany = ctx.contacts.filter((c) => c.company_id === contact.company_id && c.id !== contact.id);
      hasAlternativeNumber = sameCompany.some((c) => c.phone && !['bad', 'dnc'].includes(c.number_status));
    }

    const pctx = {
      org, profile, userId: user.id, contact, company, list, fit, intel,
      hasAlternativeNumber, timezone: tz, now,
    };
    const p = calculatePriority(task, pctx);
    if (p.excluded) continue;

    const lastLog = logsForContact[0]; // logs sorted -created_date, so [0] is most recent
    const hasConversation = logsForContact.some((l) =>
      l.conversation_held !== undefined ? l.conversation_held : CONVERSATION.has(l.outcome)
    );
    const bestNumberType = contact?.number_status === 'good' ? 'direct'
      : (contact?.phone && company?.landline && contact.phone === company.landline ? 'switchboard' : 'other');

    rows.push({
      task, contact, company, list, fit, intel,
      priority_score: p.score,
      priority_band: p.band,
      priority_reason: p.reason,
      last_called: contact?.last_called || '',
      last_outcome: lastLog?.outcome || '',
      has_conversation: hasConversation,
      best_number_type: bestNumberType,
      phone: contact?.phone || '',
    });
  }

  // Sort: priority score desc, then due_at asc, then created_date asc.
  rows.sort((a, b) => {
    if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
    const ad = a.task.due_at ? new Date(a.task.due_at).getTime() : Infinity;
    const bd = b.task.due_at ? new Date(b.task.due_at).getTime() : Infinity;
    if (ad !== bd) return ad - bd;
    return 0;
  });

  // Group into sections.
  const sections = groupSections(rows, tz, now);

  // Needs scheduling: contacts with callback/interested status, no active task.
  const taskContactIds = new Set(ctx.tasks.filter((t) => ['pending', 'in_progress'].includes(t.status) && t.contact_id).map((t) => t.contact_id));
  const needsScheduling = ctx.contacts
    .filter((c) => ['callback', 'interested'].includes(c.call_status) && !taskContactIds.has(c.id) && c.number_status !== 'dnc' && (!campaignId || c.campaign_id === campaignId))
    .map((c) => ({
      contact: c,
      company: ctx.byCompany.get(c.company_id) || null,
      call_status: c.call_status,
      last_called: c.last_called || '',
    }))
    .slice(0, 50);

  // Daily performance stats (today, org timezone).
  const todayLogs = ctx.logs.filter((l) => {
    const d = l.created_date ? new Date(l.created_date).getTime() : 0;
    return d >= new Date(todayStart).getTime() && d < new Date(todayEnd).getTime() && l.user_id === user.id && (!campaignId || l.campaign_id === campaignId);
  });
  const completedToday = ctx.tasks.filter((t) => t.status === 'completed' && t.completed_at && isToday(t.completed_at, tz) && (!campaignId || t.target_list_id === campaignId));

  const stats = {
    calls_completed: todayLogs.length,
    calls_answered: todayLogs.filter((l) =>
      l.call_connected !== undefined ? l.call_connected : SPOKE.has(l.outcome)
    ).length,
    conversations: new Set(todayLogs.filter((l) =>
      l.conversation_held !== undefined ? l.conversation_held : CONVERSATION.has(l.outcome)
    ).map((l) => l.contact_id).filter(Boolean)).size,
    interested: todayLogs.filter((l) => INTERESTED.has(l.outcome)).length,
    opportunities: todayLogs.filter((l) => OPPORTUNITY.has(l.outcome)).length,
    remaining_tasks: rows.length,
    completed_today: completedToday.length,
  };

  // Caller day flow: who spoken to, who needs follow-up, which calls went better.
  const spokenToday = todayLogs
    .filter((l) => (l.conversation_held !== undefined ? l.conversation_held : CONVERSATION.has(l.outcome || l.primary_outcome)))
    .map((l) => ({
      call_log_id: l.id,
      contact_name: l.contact_name || '',
      company: l.company || '',
      who_spoken_to: whoSpokenLabel(l),
      outcome: l.primary_outcome || l.outcome || '',
      notes: (l.client_notes || l.outcome_notes || '').slice(0, 160),
      next_step: l.next_action_type || '',
      next_step_date: (l.next_action_at || '').toString().slice(0, 10),
      quality_score: callQualityScore(l),
    }));

  const betterCalls = [...spokenToday]
    .sort((a, b) => b.quality_score - a.quality_score)
    .slice(0, 8);

  const followUpTasks = [
    ...sections.due_now,
    ...sections.overdue,
    ...sections.previous_conversations,
  ].slice(0, 12).map((r) => ({
    task_id: r.task.id,
    contact_name: r.contact?.full_name || '',
    company: r.company?.name || '',
    reason: r.priority_reason || r.task.task_type || 'Follow up',
    due_at: r.task.due_at || '',
    last_outcome: r.last_outcome || '',
  }));

  const day_flow = {
    spoken_today: spokenToday.slice(0, 20),
    needs_follow_up: followUpTasks,
    better_calls: betterCalls,
  };

  return {
    sections,
    campaigns,
    campaign_id: campaignId,
    needs_scheduling: needsScheduling,
    stats,
    day_flow,
    timezone: tz,
    user_name: profile.full_name || user.full_name || '',
    is_manager: isMgr,
    read_only: readOnly,
  };
}

function whoSpokenLabel(l) {
  const t = l.conversation_type || '';
  if (t === 'decision_maker') return 'Decision-maker';
  if (t === 'gatekeeper') return 'Gatekeeper';
  if (t === 'wrong_person') return 'Wrong person';
  if (t === 'other') return 'Other person';
  return l.conversation_held ? 'Connected' : '—';
}

function callQualityScore(l) {
  const oc = l.primary_outcome || l.outcome || '';
  const scores = {
    connected_qualified: 100,
    connected_interested: 85,
    connected_information_requested: 75,
    connected_callback: 65,
    gatekeeper: 40,
    connected_wrong_person: 25,
    connected_not_interested: 15,
    voicemail: 8,
    no_answer: 5,
    busy: 5,
  };
  let score = scores[oc] || (l.conversation_held ? 30 : 0);
  if (l.client_notes && String(l.client_notes).trim().length > 40) score += 5;
  if (l.next_action_at) score += 5;
  if (l.conversation_type === 'decision_maker') score += 10;
  return score;
}

function groupSections(rows, tz, now) {
  const sections = {
    due_now: [],
    overdue: [],
    previous_conversations: [],
    new_prospects: [],
    needs_review: [],
    completed_today: [],
  };
  for (const r of rows) {
    const t = r.task;
    if (t.status === 'completed' || t.status === 'skipped' || t.status === 'cancelled') continue;
    const dueMs = t.due_at ? new Date(t.due_at).getTime() : 0;
    const overdue = dueMs && dueMs < now;

    if (t.task_type === 'callback' && dueMs && dueMs <= now) {
      sections.due_now.push(r);
    } else if (overdue) {
      sections.overdue.push(r);
    } else if (t.task_type === 'revisit' || r.has_conversation) {
      sections.previous_conversations.push(r);
    } else if (['research_review', 'data_review'].includes(t.task_type)) {
      sections.needs_review.push(r);
    } else if (t.task_type === 'new_call' || t.task_type === 'follow_up' || t.task_type === 'callback') {
      sections.new_prospects.push(r);
    } else {
      sections.new_prospects.push(r);
    }
  }
  return sections;
}

// Extract an ordered calling queue from today's work, with callbacks first.
export function buildCallingQueue(todayWork) {
  const ordered = [
    ...todayWork.sections.due_now,
    ...todayWork.sections.overdue,
    ...todayWork.sections.previous_conversations,
    ...todayWork.sections.new_prospects,
  ];
  // De-duplicate by company (avoid consecutive same-company calls unless explicitly selected).
  const seen = new Set();
  const queue = [];
  for (const r of ordered) {
    const key = r.task.company_id || r.task.contact_id;
    if (key && seen.has(key)) continue;
    seen.add(key);
    queue.push(r);
  }
  return queue.map((r, i) => ({ ...r, position: i + 1 }));
}