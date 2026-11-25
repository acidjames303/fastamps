// Standardised call outcome model — single source of truth for the outcome loop.
// Used by completeCallOutcome, taskLogic, and todayWork.
// The frontend mirror lives in src/lib/outcomeRules.js — keep them in sync.

export const OUTCOMES = {
  connected_interested: {
    code: 'connected_interested',
    label: 'Interested',
    category: 'connected',
    requires_follow_up: true,
    requires_follow_up_date: true,
    default_follow_up_delay_minutes: null,
    closes_current_task: true,
    suppresses_future_calls: false,
    qualification_effect: 'none',
    notes_required: false,
    follow_up_task_type: 'follow_up',
  },
  connected_callback: {
    code: 'connected_callback',
    label: 'Callback',
    category: 'connected',
    requires_follow_up: true,
    requires_follow_up_date: true,
    default_follow_up_delay_minutes: null,
    closes_current_task: true,
    suppresses_future_calls: false,
    qualification_effect: 'none',
    notes_required: false,
    follow_up_task_type: 'callback',
  },
  connected_not_interested: {
    code: 'connected_not_interested',
    label: 'Not interested',
    category: 'connected',
    requires_follow_up: false,
    requires_follow_up_date: false,
    default_follow_up_delay_minutes: null,
    closes_current_task: true,
    suppresses_future_calls: false,
    qualification_effect: 'none',
    notes_required: false,
  },
  connected_wrong_person: {
    code: 'connected_wrong_person',
    label: 'Wrong person',
    category: 'connected',
    requires_follow_up: true,
    requires_follow_up_date: false,
    default_follow_up_delay_minutes: 1440,
    closes_current_task: true,
    suppresses_future_calls: false,
    qualification_effect: 'none',
    notes_required: false,
    follow_up_task_type: 'research_review',
  },
  connected_information_requested: {
    code: 'connected_information_requested',
    label: 'Info requested',
    category: 'connected',
    requires_follow_up: true,
    requires_follow_up_date: true,
    default_follow_up_delay_minutes: 2880,
    closes_current_task: true,
    suppresses_future_calls: false,
    qualification_effect: 'none',
    notes_required: false,
    follow_up_task_type: 'follow_up',
  },
  connected_qualified: {
    code: 'connected_qualified',
    label: 'Qualified',
    category: 'connected',
    requires_follow_up: true,
    requires_follow_up_date: true,
    default_follow_up_delay_minutes: 4320,
    closes_current_task: true,
    suppresses_future_calls: false,
    qualification_effect: 'create_opportunity',
    notes_required: false,
    follow_up_task_type: 'opportunity_review',
  },
  no_answer: {
    code: 'no_answer',
    label: 'No answer',
    category: 'no_answer',
    requires_follow_up: true,
    requires_follow_up_date: false,
    default_follow_up_delay_minutes: 180,
    closes_current_task: true,
    suppresses_future_calls: false,
    qualification_effect: 'none',
    notes_required: false,
    follow_up_task_type: 'new_call',
  },
  voicemail: {
    code: 'voicemail',
    label: 'Voicemail',
    category: 'no_answer',
    requires_follow_up: true,
    requires_follow_up_date: false,
    default_follow_up_delay_minutes: 1440,
    closes_current_task: true,
    suppresses_future_calls: false,
    qualification_effect: 'none',
    notes_required: false,
    follow_up_task_type: 'new_call',
  },
  busy: {
    code: 'busy',
    label: 'Busy',
    category: 'no_answer',
    requires_follow_up: true,
    requires_follow_up_date: false,
    default_follow_up_delay_minutes: 30,
    closes_current_task: true,
    suppresses_future_calls: false,
    qualification_effect: 'none',
    notes_required: false,
    follow_up_task_type: 'new_call',
  },
  gatekeeper: {
    code: 'gatekeeper',
    label: 'Gatekeeper',
    category: 'connected',
    requires_follow_up: true,
    requires_follow_up_date: false,
    default_follow_up_delay_minutes: 1440,
    closes_current_task: true,
    suppresses_future_calls: false,
    qualification_effect: 'none',
    notes_required: false,
    follow_up_task_type: 'follow_up',
  },
  invalid_number: {
    code: 'invalid_number',
    label: 'Invalid number',
    category: 'invalid',
    requires_follow_up: true,
    requires_follow_up_date: false,
    default_follow_up_delay_minutes: 4320,
    closes_current_task: true,
    suppresses_future_calls: true,
    qualification_effect: 'none',
    notes_required: false,
    follow_up_task_type: 'data_review',
    suppresses_contact: true,
  },
  do_not_call: {
    code: 'do_not_call',
    label: 'Do not call',
    category: 'suppressed',
    requires_follow_up: false,
    requires_follow_up_date: false,
    default_follow_up_delay_minutes: null,
    closes_current_task: true,
    suppresses_future_calls: true,
    qualification_effect: 'none',
    notes_required: true,
    suppresses_contact: true,
  },
  other: {
    code: 'other',
    label: 'Other',
    category: 'other',
    requires_follow_up: false,
    requires_follow_up_date: false,
    default_follow_up_delay_minutes: null,
    closes_current_task: true,
    suppresses_future_calls: false,
    qualification_effect: 'none',
    notes_required: true,
  },
  // ── Granular caller-facing reasons ──────────────────────────────────────
  // Each records a canonical `primary` outcome so classification, reporting
  // and task creation stay consistent, plus the legacy CallLog.outcome label.
  connected_send_info: {
    code: 'connected_send_info', label: 'Send info', category: 'connected',
    primary: 'connected_information_requested', legacy: 'send_info',
    requires_follow_up: true, requires_follow_up_date: true, default_follow_up_delay_minutes: 2880,
    closes_current_task: true, suppresses_future_calls: false, qualification_effect: 'none',
    notes_required: false, follow_up_task_type: 'follow_up',
  },
  connected_future_potential: {
    code: 'connected_future_potential', label: 'Future potential', category: 'connected',
    primary: 'connected_interested', legacy: 'future_potential',
    requires_follow_up: true, requires_follow_up_date: true, default_follow_up_delay_minutes: null,
    closes_current_task: true, suppresses_future_calls: false, qualification_effect: 'none',
    notes_required: false, follow_up_task_type: 'follow_up',
  },
  connected_not_suitable: {
    code: 'connected_not_suitable', label: 'Not suitable', category: 'connected',
    primary: 'connected_not_interested', legacy: 'not_suitable',
    requires_follow_up: false, requires_follow_up_date: false, default_follow_up_delay_minutes: null,
    closes_current_task: true, suppresses_future_calls: false, qualification_effect: 'none',
    notes_required: false,
  },
  connected_contact_left: {
    code: 'connected_contact_left', label: 'Contact has left', category: 'connected',
    primary: 'connected_wrong_person', legacy: 'wrong_person',
    requires_follow_up: true, requires_follow_up_date: false, default_follow_up_delay_minutes: 1440,
    closes_current_task: true, suppresses_future_calls: false, qualification_effect: 'none',
    notes_required: false, follow_up_task_type: 'research_review',
  },
  gatekeeper_pa_screened: {
    code: 'gatekeeper_pa_screened', label: 'PA screened', category: 'connected',
    primary: 'gatekeeper', legacy: 'pa_screened',
    requires_follow_up: true, requires_follow_up_date: false, default_follow_up_delay_minutes: 1440,
    closes_current_task: true, suppresses_future_calls: false, qualification_effect: 'none',
    notes_required: false, follow_up_task_type: 'follow_up',
  },
  away_from_desk: {
    code: 'away_from_desk', label: 'Away from desk', category: 'no_answer',
    primary: 'no_answer', legacy: 'no_answer',
    requires_follow_up: true, requires_follow_up_date: false, default_follow_up_delay_minutes: 180,
    closes_current_task: true, suppresses_future_calls: false, qualification_effect: 'none',
    notes_required: false, follow_up_task_type: 'new_call',
  },
  in_a_meeting: {
    code: 'in_a_meeting', label: 'In a meeting', category: 'no_answer',
    primary: 'no_answer', legacy: 'no_answer',
    requires_follow_up: true, requires_follow_up_date: false, default_follow_up_delay_minutes: 180,
    closes_current_task: true, suppresses_future_calls: false, qualification_effect: 'none',
    notes_required: false, follow_up_task_type: 'new_call',
  },
  no_reply: {
    code: 'no_reply', label: 'No reply', category: 'no_answer',
    primary: 'no_answer', legacy: 'no_reply',
    requires_follow_up: true, requires_follow_up_date: false, default_follow_up_delay_minutes: 180,
    closes_current_task: true, suppresses_future_calls: false, qualification_effect: 'none',
    notes_required: false, follow_up_task_type: 'new_call',
  },
  out_of_office: {
    code: 'out_of_office', label: 'Out of the office', category: 'no_answer',
    primary: 'no_answer', legacy: 'no_answer',
    requires_follow_up: true, requires_follow_up_date: false, default_follow_up_delay_minutes: 1440,
    closes_current_task: true, suppresses_future_calls: false, qualification_effect: 'none',
    notes_required: false, follow_up_task_type: 'new_call',
  },
  on_holiday: {
    code: 'on_holiday', label: 'On holiday', category: 'no_answer',
    primary: 'no_answer', legacy: 'no_answer',
    requires_follow_up: true, requires_follow_up_date: false, default_follow_up_delay_minutes: 4320,
    closes_current_task: true, suppresses_future_calls: false, qualification_effect: 'none',
    notes_required: false, follow_up_task_type: 'new_call',
  },
  wrong_number: {
    code: 'wrong_number', label: 'Incorrect number', category: 'invalid',
    primary: 'invalid_number', legacy: 'bad_number',
    requires_follow_up: true, requires_follow_up_date: false, default_follow_up_delay_minutes: 4320,
    closes_current_task: true, suppresses_future_calls: true, qualification_effect: 'none',
    notes_required: false, follow_up_task_type: 'data_review', suppresses_contact: true,
  },
  dead_number: {
    code: 'dead_number', label: 'Dead number', category: 'invalid',
    primary: 'invalid_number', legacy: 'bad_number',
    requires_follow_up: true, requires_follow_up_date: false, default_follow_up_delay_minutes: 4320,
    closes_current_task: true, suppresses_future_calls: true, qualification_effect: 'none',
    notes_required: false, follow_up_task_type: 'data_review', suppresses_contact: true,
  },
  unobtainable: {
    code: 'unobtainable', label: 'Unobtainable', category: 'invalid',
    primary: 'invalid_number', legacy: 'bad_number',
    requires_follow_up: true, requires_follow_up_date: false, default_follow_up_delay_minutes: 4320,
    closes_current_task: true, suppresses_future_calls: true, qualification_effect: 'none',
    notes_required: false, follow_up_task_type: 'data_review', suppresses_contact: true,
  },
  email_only: {
    code: 'email_only', label: 'Email only', category: 'other',
    primary: 'other', legacy: 'other',
    requires_follow_up: false, requires_follow_up_date: false, default_follow_up_delay_minutes: null,
    closes_current_task: true, suppresses_future_calls: false, qualification_effect: 'none',
    notes_required: true,
  },
  gone_digital: {
    code: 'gone_digital', label: 'Gone digital', category: 'other',
    primary: 'other', legacy: 'other',
    requires_follow_up: false, requires_follow_up_date: false, default_follow_up_delay_minutes: null,
    closes_current_task: true, suppresses_future_calls: false, qualification_effect: 'none',
    notes_required: false,
  },
  duplicate_record: {
    code: 'duplicate_record', label: 'Duplicate record', category: 'other',
    primary: 'other', legacy: 'duplicate',
    requires_follow_up: false, requires_follow_up_date: false, default_follow_up_delay_minutes: null,
    closes_current_task: true, suppresses_future_calls: false, qualification_effect: 'none',
    notes_required: true,
  },
  customer_service_number: {
    code: 'customer_service_number', label: 'Customer service number', category: 'other',
    primary: 'other', legacy: 'customer_service_number',
    requires_follow_up: false, requires_follow_up_date: false, default_follow_up_delay_minutes: null,
    closes_current_task: true, suppresses_future_calls: false, qualification_effect: 'none',
    notes_required: true,
  },
  no_sales_calls: {
    code: 'no_sales_calls', label: 'No sales calls', category: 'suppressed',
    primary: 'do_not_call', legacy: 'no_sales_calls',
    requires_follow_up: false, requires_follow_up_date: false, default_follow_up_delay_minutes: null,
    closes_current_task: true, suppresses_future_calls: true, qualification_effect: 'none',
    notes_required: true, suppresses_contact: true,
  },
};

// Canonical classification code for a granular caller-facing option.
export function resolvePrimaryOutcomeCode(code) {
  return OUTCOMES[code]?.primary || code;
}

export function getOutcome(code) {
  return OUTCOMES[code] || null;
}

export function getOutcomeLabel(code) {
  return OUTCOMES[code]?.label || code;
}

// Map standardised outcome to legacy CallLog.outcome enum for backward compat.
export function mapToLegacyOutcome(code) {
  const explicit = OUTCOMES[code]?.legacy;
  if (explicit) return explicit;
  const map = {
    connected_interested: 'interested',
    connected_callback: 'callback',
    connected_not_interested: 'not_interested',
    connected_wrong_person: 'wrong_person',
    connected_information_requested: 'send_info',
    connected_qualified: 'lead',
    no_answer: 'no_answer',
    voicemail: 'voicemail',
    busy: 'busy',
    gatekeeper: 'pa_screened',
    invalid_number: 'bad_number',
    do_not_call: 'dnc',
    other: 'not_suitable',
  };
  return map[code] || 'no_answer';
}

export function getFollowUpTaskType(outcome) {
  if (outcome.follow_up_task_type) return outcome.follow_up_task_type;
  if (outcome.category === 'connected') return 'follow_up';
  if (outcome.category === 'no_answer') return 'new_call';
  if (outcome.category === 'invalid') return 'data_review';
  return 'follow_up';
}

// Default follow-up settings. Org-level overrides live in org.settings.follow_up.
export const DEFAULT_FOLLOW_UP_SETTINGS = {
  no_answer_retry_delay_minutes: 180,
  voicemail_retry_delay_minutes: 1440,
  busy_retry_delay_minutes: 30,
  max_attempts_per_contact: 8,
  min_minutes_between_attempts: 30,
  timezone: 'Europe/London',
  calling_days: [1, 2, 3, 4, 5],
  calling_hour_start: 9,
  calling_hour_end: 18,
  weekend_follow_up_behaviour: 'next_working_day',
};

export function getFollowUpSettings(org) {
  const fu = org?.settings?.follow_up || {};
  return {
    ...DEFAULT_FOLLOW_UP_SETTINGS,
    timezone: org?.timezone || DEFAULT_FOLLOW_UP_SETTINGS.timezone,
    ...fu,
  };
}

// Get zoned day-of-week and hour for a UTC date in the given timezone.
function getZonedParts(date, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const dayMap = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 0 };
  return {
    dayOfWeek: dayMap[get('weekday')] ?? 0,
    hour: parseInt(get('hour') || '0', 10) % 24,
    minute: parseInt(get('minute') || '0', 10),
  };
}

// Compute the next valid calling time, respecting working hours and days.
export function nextValidCallingTime(fromMs, settings) {
  const tz = settings.timezone || 'Europe/London';
  const callingDays = settings.calling_days || [1, 2, 3, 4, 5];
  const hourStart = settings.calling_hour_start || 9;
  const hourEnd = settings.calling_hour_end || 18;

  let d = new Date(fromMs);
  for (let guard = 0; guard < 336; guard++) {
    const { dayOfWeek, hour } = getZonedParts(d, tz);
    if (callingDays.includes(dayOfWeek) && hour >= hourStart && hour < hourEnd) {
      return d.getTime();
    }
    d = new Date(d.getTime() + 3600000);
  }
  return fromMs;
}

// Check if an opportunity has the minimum required fields to be 'qualified'.
export function isOpportunityQualified(qual) {
  return !!(qual?.need && qual?.next_step);
}

// Check if max attempts reached for a contact.
export function isMaxAttemptsReached(contact, settings) {
  const max = settings?.max_attempts_per_contact || 8;
  return (contact?.call_count || 0) >= max;
}