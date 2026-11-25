// Frontend mirror of base44/shared/outcomeRules.ts.
// Single source of truth for the Dialer, Today page, and analytics.
// Keep in sync with the backend module.

export const OUTCOMES = {
  connected_interested: { code: 'connected_interested', label: 'Interested', category: 'connected', requires_follow_up: true, requires_follow_up_date: true, notes_required: false },
  connected_callback: { code: 'connected_callback', label: 'Callback', category: 'connected', requires_follow_up: true, requires_follow_up_date: true, notes_required: false },
  connected_not_interested: { code: 'connected_not_interested', label: 'Not interested', category: 'connected', requires_follow_up: false, requires_follow_up_date: false, notes_required: false },
  connected_wrong_person: { code: 'connected_wrong_person', label: 'Wrong person', category: 'connected', requires_follow_up: true, requires_follow_up_date: false, notes_required: false },
  connected_information_requested: { code: 'connected_information_requested', label: 'Info requested', category: 'connected', requires_follow_up: true, requires_follow_up_date: true, notes_required: false },
  connected_qualified: { code: 'connected_qualified', label: 'Qualified', category: 'connected', requires_follow_up: true, requires_follow_up_date: true, notes_required: false, qualification_effect: 'create_opportunity' },
  no_answer: { code: 'no_answer', label: 'No answer', category: 'no_answer', requires_follow_up: true, requires_follow_up_date: false, notes_required: false },
  voicemail: { code: 'voicemail', label: 'Voicemail', category: 'no_answer', requires_follow_up: true, requires_follow_up_date: false, notes_required: false },
  busy: { code: 'busy', label: 'Busy', category: 'no_answer', requires_follow_up: true, requires_follow_up_date: false, notes_required: false },
  gatekeeper: { code: 'gatekeeper', label: 'Gatekeeper', category: 'connected', requires_follow_up: true, requires_follow_up_date: false, notes_required: false },
  invalid_number: { code: 'invalid_number', label: 'Invalid number', category: 'invalid', requires_follow_up: true, requires_follow_up_date: false, notes_required: false, suppresses_contact: true },
  do_not_call: { code: 'do_not_call', label: 'Do not call', category: 'suppressed', requires_follow_up: false, requires_follow_up_date: false, notes_required: true, suppresses_contact: true },
  other: { code: 'other', label: 'Other', category: 'other', requires_follow_up: false, requires_follow_up_date: false, notes_required: true },
  // Granular caller-facing reasons — each records its canonical `primary` outcome.
  connected_send_info: { code: 'connected_send_info', label: 'Send info', category: 'connected', primary: 'connected_information_requested', requires_follow_up: true, requires_follow_up_date: true, notes_required: false },
  connected_future_potential: { code: 'connected_future_potential', label: 'Future potential', category: 'connected', primary: 'connected_interested', requires_follow_up: true, requires_follow_up_date: true, notes_required: false },
  connected_not_suitable: { code: 'connected_not_suitable', label: 'Not suitable', category: 'connected', primary: 'connected_not_interested', requires_follow_up: false, requires_follow_up_date: false, notes_required: false },
  connected_contact_left: { code: 'connected_contact_left', label: 'Contact has left', category: 'connected', primary: 'connected_wrong_person', requires_follow_up: true, requires_follow_up_date: false, notes_required: false },
  gatekeeper_pa_screened: { code: 'gatekeeper_pa_screened', label: 'PA screened', category: 'connected', primary: 'gatekeeper', requires_follow_up: true, requires_follow_up_date: false, notes_required: false },
  away_from_desk: { code: 'away_from_desk', label: 'Away from desk', category: 'no_answer', primary: 'no_answer', requires_follow_up: true, requires_follow_up_date: false, notes_required: false },
  in_a_meeting: { code: 'in_a_meeting', label: 'In a meeting', category: 'no_answer', primary: 'no_answer', requires_follow_up: true, requires_follow_up_date: false, notes_required: false },
  no_reply: { code: 'no_reply', label: 'No reply', category: 'no_answer', primary: 'no_answer', requires_follow_up: true, requires_follow_up_date: false, notes_required: false },
  out_of_office: { code: 'out_of_office', label: 'Out of the office', category: 'no_answer', primary: 'no_answer', requires_follow_up: true, requires_follow_up_date: false, notes_required: false },
  on_holiday: { code: 'on_holiday', label: 'On holiday', category: 'no_answer', primary: 'no_answer', requires_follow_up: true, requires_follow_up_date: false, notes_required: false },
  wrong_number: { code: 'wrong_number', label: 'Incorrect number', category: 'invalid', primary: 'invalid_number', requires_follow_up: true, requires_follow_up_date: false, notes_required: false },
  dead_number: { code: 'dead_number', label: 'Dead number', category: 'invalid', primary: 'invalid_number', requires_follow_up: true, requires_follow_up_date: false, notes_required: false },
  unobtainable: { code: 'unobtainable', label: 'Unobtainable', category: 'invalid', primary: 'invalid_number', requires_follow_up: true, requires_follow_up_date: false, notes_required: false },
  email_only: { code: 'email_only', label: 'Email only', category: 'other', primary: 'other', requires_follow_up: false, requires_follow_up_date: false, notes_required: true },
  gone_digital: { code: 'gone_digital', label: 'Gone digital', category: 'other', primary: 'other', requires_follow_up: false, requires_follow_up_date: false, notes_required: false },
  duplicate_record: { code: 'duplicate_record', label: 'Duplicate record', category: 'other', primary: 'other', requires_follow_up: false, requires_follow_up_date: false, notes_required: true },
  customer_service_number: { code: 'customer_service_number', label: 'Customer service number', category: 'other', primary: 'other', requires_follow_up: false, requires_follow_up_date: false, notes_required: true },
  no_sales_calls: { code: 'no_sales_calls', label: 'No sales calls', category: 'suppressed', primary: 'do_not_call', requires_follow_up: false, requires_follow_up_date: false, notes_required: true },
};

// Canonical classification code for a granular option.
export function resolvePrimaryOutcomeCode(code) {
  return OUTCOMES[code]?.primary || code;
}

export const OUTCOME_CATEGORIES = [
  {
    id: 'connected',
    label: 'Connected',
    tone: 'emerald',
    outcomes: [
      'connected_interested', 'connected_future_potential', 'connected_callback',
      'connected_not_interested', 'connected_not_suitable',
      'connected_wrong_person', 'connected_contact_left',
      'connected_information_requested', 'connected_send_info',
      'connected_qualified', 'gatekeeper', 'gatekeeper_pa_screened',
    ],
  },
  {
    id: 'no_answer',
    label: 'No answer',
    tone: 'amber',
    outcomes: ['no_answer', 'away_from_desk', 'in_a_meeting', 'no_reply', 'out_of_office', 'on_holiday', 'voicemail', 'busy'],
  },
  {
    id: 'other',
    label: 'Other',
    tone: 'rose',
    outcomes: [
      'invalid_number', 'wrong_number', 'dead_number', 'unobtainable',
      'do_not_call', 'no_sales_calls',
      'duplicate_record', 'customer_service_number', 'email_only', 'gone_digital', 'other',
    ],
  },
];

export function getOutcomeLabel(code) {
  return OUTCOMES[code]?.label || code;
}

// Read-only helpers that use server-set classification fields.
// Fall back to category check only for unmigrated legacy records.
export function isConversation(log) {
  if (!log) return false;
  if (log.conversation_held !== undefined && log.conversation_held !== null) {
    return log.conversation_held === true;
  }
  const code = log.primary_outcome;
  if (code) return OUTCOMES[code]?.category === "connected";
  return false;
}

export function isConnectedCall(log) {
  if (!log) return false;
  if (log.call_connected !== undefined && log.call_connected !== null) {
    return log.call_connected === true;
  }
  const code = log.primary_outcome;
  if (code) return OUTCOMES[code]?.category === "connected";
  return false;
}