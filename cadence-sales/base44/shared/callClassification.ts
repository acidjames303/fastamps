// Single source of truth for call vs conversation classification.
// Used by completeCallOutcome, migrateCallClassification, todayWork,
// campaignMetrics, Results, Dashboard, and all reporting.
// The frontend must never independently decide whether a call was a conversation.

// Outcomes that count as conversations (caller spoke with a person).
const CONVERSATION_OUTCOMES = new Set([
  'connected_interested',
  'connected_callback',
  'connected_not_interested',
  'connected_wrong_person',
  'connected_information_requested',
  'connected_qualified',
  'gatekeeper',
]);

// Outcomes that count as connected (call was answered by a person).
const CONNECTED_OUTCOMES = new Set([...CONVERSATION_OUTCOMES]);

// Default conversation type implied by each outcome.
const OUTCOME_CONVERSATION_TYPE: Record<string, string> = {
  connected_interested: 'decision_maker',
  connected_callback: 'decision_maker',
  connected_not_interested: 'decision_maker',
  connected_wrong_person: 'wrong_person',
  connected_information_requested: 'decision_maker',
  connected_qualified: 'decision_maker',
  gatekeeper: 'gatekeeper',
};

// Legacy outcome → primary_outcome mapping (for migration and fallback).
const LEGACY_TO_PRIMARY: Record<string, string> = {
  connected: 'connected_not_interested',
  interested: 'connected_interested',
  not_interested: 'connected_not_interested',
  callback: 'connected_callback',
  lead: 'connected_qualified',
  send_info: 'connected_information_requested',
  wrong_person: 'connected_wrong_person',
  pa_screened: 'gatekeeper',
  no_answer: 'no_answer',
  no_pickup: 'no_answer',
  no_reply: 'no_answer',
  voicemail: 'voicemail',
  busy: 'busy',
  bad_number: 'invalid_number',
  dnc: 'do_not_call',
  no_sales_calls: 'do_not_call',
  not_suitable: 'other',
  duplicate: 'other',
  future_potential: 'connected_interested',
  identify_new_contact: 'connected_wrong_person',
  customer_service_number: 'other',
  removed: 'other',
};

export const CONVERSATION_OUTCOME_CODES = CONVERSATION_OUTCOMES;
export const CONNECTED_OUTCOME_CODES = CONNECTED_OUTCOMES;

export function classifyCall(
  primaryOutcome: string | null | undefined,
  conversationTypeInput?: string | null,
) {
  const call_attempted = true;

  if (!primaryOutcome) {
    return {
      call_attempted,
      call_connected: false,
      conversation_held: false,
      conversation_type: 'none',
      classification_status: 'review_required',
    };
  }

  const call_connected = CONNECTED_OUTCOMES.has(primaryOutcome);
  const conversation_held = CONVERSATION_OUTCOMES.has(primaryOutcome);

  let conversation_type = 'none';
  let classification_status = 'classified';

  if (conversation_held) {
    const validTypes = ['decision_maker', 'gatekeeper', 'wrong_person', 'other'];
    if (conversationTypeInput && validTypes.includes(conversationTypeInput)) {
      conversation_type = conversationTypeInput;
    } else {
      conversation_type = OUTCOME_CONVERSATION_TYPE[primaryOutcome] || 'other';
    }
  }

  if (primaryOutcome === 'other') {
    classification_status = 'review_required';
  }

  return {
    call_attempted,
    call_connected,
    conversation_held,
    conversation_type,
    classification_status,
  };
}

export function classifyLegacyCall(legacyOutcome: string | null | undefined) {
  const primary = LEGACY_TO_PRIMARY[legacyOutcome || ''] || null;
  return classifyCall(primary);
}

export function resolvePrimaryOutcome(log: any): string | null {
  if (log?.primary_outcome) return log.primary_outcome;
  if (log?.outcome) return LEGACY_TO_PRIMARY[log.outcome] || null;
  return null;
}

export function isConversation(log: any): boolean {
  if (!log) return false;
  if (log.conversation_held !== undefined && log.conversation_held !== null) {
    return log.conversation_held === true;
  }
  const primary = resolvePrimaryOutcome(log);
  return CONVERSATION_OUTCOMES.has(primary);
}

export function isConnected(log: any): boolean {
  if (!log) return false;
  if (log.call_connected !== undefined && log.call_connected !== null) {
    return log.call_connected === true;
  }
  const primary = resolvePrimaryOutcome(log);
  return CONNECTED_OUTCOMES.has(primary);
}

export function getConversationType(log: any): string {
  if (!log) return 'none';
  if (log.conversation_type) return log.conversation_type;
  const primary = resolvePrimaryOutcome(log);
  if (!primary || !CONVERSATION_OUTCOMES.has(primary)) return 'none';
  return OUTCOME_CONVERSATION_TYPE[primary] || 'other';
}

export function isDecisionMakerConversation(log: any): boolean {
  return isConversation(log) && getConversationType(log) === 'decision_maker';
}

export function isGatekeeperConversation(log: any): boolean {
  return isConversation(log) && getConversationType(log) === 'gatekeeper';
}