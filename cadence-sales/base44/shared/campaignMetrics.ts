// Single source of truth for campaign delivery and reporting metrics.
// Imported by getCampaignDelivery, getTeamWorkload, Results, and client reports.
// Every metric defined here so numbers can never disagree between views.
//
// Metric definitions:
//   Call attempted          — one persisted CallLog
//   Conversation            — CallLog with primary_outcome in the connected category
//   Unique company contacted — distinct company_id with at least one CallLog
//   Qualified opportunity    — distinct Opportunity with qualification_status = qualified
//   Callback scheduled       — follow-up Task created from a call outcome (source = call_outcome)
//   Follow-up completed on time — Task completed no later than due_at + tolerance (default 1h)

import { OUTCOMES } from './outcomeRules.ts';

const HOUR = 3600000;
const ON_TIME_TOLERANCE_MS = HOUR; // 1 hour grace period

// Outcomes that count as "connected" (a conversation took place).
export const CONNECTED_OUTCOMES = new Set(
  Object.values(OUTCOMES).filter((o) => o.category === 'connected').map((o) => o.code)
);

// Outcomes that indicate interest.
export const INTERESTED_OUTCOMES = new Set([
  'connected_interested',
  'connected_qualified',
  'connected_information_requested',
]);

// Outcomes that suppress future calls.
export const SUPPRESSED_OUTCOMES = new Set(
  Object.values(OUTCOMES).filter((o) => o.suppresses_contact).map((o) => o.code)
);

// --- Core metric helpers (pure functions, no SDK calls) ---

export function isConversation(log) {
  if (!log) return false;
  if (log.conversation_held !== undefined && log.conversation_held !== null) {
    return log.conversation_held === true;
  }
  if (log.primary_outcome) return CONNECTED_OUTCOMES.has(log.primary_outcome);
  // Legacy fallback
  return CONNECTED_OUTCOMES.has(log.outcome);
}

export function isDecisionMakerConversation(log) {
  return isConversation(log) && (log.conversation_type || '') === 'decision_maker';
}

export function isGatekeeperConversation(log) {
  return isConversation(log) && (log.conversation_type || '') === 'gatekeeper';
}

export function isInterested(log) {
  if (!log) return false;
  if (log.primary_outcome) return INTERESTED_OUTCOMES.has(log.primary_outcome);
  return INTERESTED_OUTCOMES.has(log.outcome);
}

export function isSuppressed(log) {
  if (!log) return false;
  if (log.primary_outcome) return SUPPRESSED_OUTCOMES.has(log.primary_outcome);
  return SUPPRESSED_OUTCOMES.has(log.outcome);
}

// Compute full campaign delivery metrics from raw data arrays.
// All arrays should be pre-filtered to the campaign's organisation.
export function computeCampaignDelivery(campaign, assignments, callLogs, tasks, opportunities) {
  const campaignId = campaign?.id;
  const campaignLogs = callLogs.filter((l) => l.campaign_id === campaignId);
  const campaignTasks = tasks.filter((t) => t.target_list_id === campaignId);
  const campaignOpps = opportunities.filter((o) => o.campaign_id === campaignId);
  const campaignAssignments = assignments.filter((a) => a.campaign_id === campaignId);

  const totalCompanies = new Set(campaignAssignments.map((a) => a.company_id)).size;
  const contactedCompanyIds = new Set(campaignLogs.map((l) => l.company_id).filter(Boolean));
  const conversations = campaignLogs.filter(isConversation);
  const interested = campaignLogs.filter(isInterested);
  const suppressed = campaignLogs.filter(isSuppressed);

  const callbacksScheduled = campaignTasks.filter(
    (t) => t.source === 'call_outcome' && (t.task_type === 'callback' || t.task_type === 'follow_up')
  );
  const callbacksCompleted = callbacksScheduled.filter((t) => t.status === 'completed');
  const now = Date.now();
  const overdueFollowUps = callbacksScheduled.filter(
    (t) => t.status !== 'completed' && t.due_at && new Date(t.due_at).getTime() < now
  );

  const qualifiedOpps = campaignOpps.filter((o) => o.qualification_status === 'qualified');

  const invalidData = campaignAssignments.filter((a) => a.status === 'suppressed').length;
  const suppressedContacts = suppressed.length;
  const completed = campaignAssignments.filter((a) => a.status === 'completed').length;

  return {
    totalCompanies,
    companiesContacted: contactedCompanyIds.size,
    companiesRemaining: totalCompanies - contactedCompanyIds.size,
    callsAttempted: campaignLogs.length,
    conversations: conversations.length,
    callbacks: callbacksScheduled.length,
    interested: interested.length,
    qualifiedOpportunities: qualifiedOpps.length,
    completedFollowUps: callbacksCompleted.length,
    overdueFollowUps: overdueFollowUps.length,
    invalidData,
    suppressedContacts,
    completed,
    progressPercent: totalCompanies > 0 ? Math.round((contactedCompanyIds.size / totalCompanies) * 100) : 0,
    callTargetProgress: campaign?.total_call_target
      ? Math.round((campaignLogs.length / campaign.total_call_target) * 100)
      : null,
  };
}

// Compute per-caller workload for a campaign (or all campaigns if campaignId is null).
export function computeCallerWorkload(assignments, callLogs, tasks, userId, campaignId) {
  const userAssignments = assignments.filter(
    (a) => a.assigned_user_id === userId && (!campaignId || a.campaign_id === campaignId)
  );
  const userLogs = callLogs.filter(
    (l) => l.assigned_user_id === userId && (!campaignId || l.campaign_id === campaignId)
  );
  const userTasks = tasks.filter(
    (t) => t.assigned_user_id === userId && (!campaignId || t.target_list_id === campaignId)
  );

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return {
    assigned: userAssignments.length,
    completed: userAssignments.filter((a) => a.status === 'completed').length,
    dueToday: userTasks.filter(
      (t) => t.status === 'pending' && t.due_at && new Date(t.due_at).getTime() >= todayStart.getTime() && new Date(t.due_at).getTime() < now + 86400000
    ).length,
    overdue: userTasks.filter(
      (t) => t.status === 'pending' && t.due_at && new Date(t.due_at).getTime() < now
    ).length,
    callbacks: userTasks.filter((t) => t.task_type === 'callback' && t.status === 'pending').length,
    conversations: userLogs.filter(isConversation).length,
    qualified: userLogs.filter(isInterested).length,
  };
}

// Validate campaign activation prerequisites.
// Returns { valid: boolean, errors: string[] }.
export function validateActivation(campaign, assignments, contacts) {
  const errors = [];

  if (!campaign.name) errors.push('Campaign name is required');
  if (!campaign.client_name) errors.push('Client name is required');
  if (!campaign.start_date) errors.push('Start date is required');

  const activeAssignments = assignments.filter(
    (a) => a.campaign_id === campaign.id && a.status !== 'removed' && a.status !== 'suppressed'
  );
  if (activeAssignments.length === 0) errors.push('No companies assigned to this campaign');

  const assigned = activeAssignments.filter((a) => a.assigned_user_id);
  if (assigned.length === 0) errors.push('No callers assigned to this campaign');

  // Check for at least one dialable contact.
  const dialable = contacts.filter((c) => c.phone && c.number_status !== 'dnc' && c.number_status !== 'bad');
  if (dialable.length === 0) errors.push('No dialable contacts found — add companies with valid phone numbers');

  return { valid: errors.length === 0, errors };
}