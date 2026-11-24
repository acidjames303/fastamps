// Deterministic pilot health calculation — no AI, no invented scores.
// Used by getPilotHealth backend function and the first-week operating loop.
// Factors: onboarding, active callers, successful calls, callback completion,
// overdue callbacks, high-priority support, incidents, usage, weekly pulse.

export interface HealthFactor {
  key: string;
  label: string;
  status: 'good' | 'warning' | 'bad' | 'unknown';
  value: string;
  detail: string;
}

export function calculatePilotHealth(f: {
  onboarding_complete: boolean;
  onboarding_progress: number;
  active_callers: number;
  expected_callers: number;
  successful_calls: number;
  total_calls: number;
  callbacks_total: number;
  callbacks_completed: number;
  overdue_callbacks: number;
  high_priority_support_open: number;
  open_incidents: number;
  critical_incidents: number;
  usage_percentage: number;
  pulse_score: number | null;
  pilot_status: string;
}): { health: string; factors: HealthFactor[]; summary: string } {
  if (f.pilot_status === 'paused') {
    return { health: 'paused', factors: [], summary: 'Pilot is paused.' };
  }

  const factors: HealthFactor[] = [];
  let bad = 0, warn = 0;

  const push = (key, label, status, value, detail) => {
    factors.push({ key, label, status, value, detail });
    if (status === 'bad') bad++;
    else if (status === 'warning' || status === 'unknown') warn++;
  };

  // 1. Onboarding
  push('onboarding', 'Onboarding',
    f.onboarding_complete ? 'good' : (f.onboarding_progress > 50 ? 'warning' : 'bad'),
    f.onboarding_complete ? 'Complete' : `${f.onboarding_progress}%`,
    f.onboarding_complete ? 'Onboarding completed.' : 'Onboarding in progress.');

  // 2. Active callers vs expected
  const callerRatio = f.expected_callers > 0 ? f.active_callers / f.expected_callers : 0;
  push('active_callers', 'Active callers',
    f.active_callers === 0 ? 'bad' : (callerRatio < 0.5 ? 'warning' : 'good'),
    `${f.active_callers}/${f.expected_callers}`,
    `${f.active_callers} of ${f.expected_callers} expected callers active.`);

  // 3. Successful calls
  push('successful_calls', 'Successful calls',
    f.total_calls === 0 ? 'unknown' : (f.successful_calls > 0 ? 'good' : 'bad'),
    `${f.successful_calls}/${f.total_calls}`,
    f.total_calls === 0 ? 'No calls made yet.' : `${f.successful_calls} conversations of ${f.total_calls} calls.`);

  // 4. Callback completion
  const cbRate = f.callbacks_total > 0 ? f.callbacks_completed / f.callbacks_total : 0;
  push('callback_completion', 'Callback completion',
    f.callbacks_total === 0 ? 'unknown' : (cbRate >= 0.5 ? 'good' : 'warning'),
    `${f.callbacks_completed}/${f.callbacks_total}`,
    f.callbacks_total === 0 ? 'No callbacks yet.' : `${Math.round(cbRate * 100)}% completed.`);

  // 5. Overdue callbacks
  push('overdue_callbacks', 'Overdue callbacks',
    f.overdue_callbacks === 0 ? 'good' : (f.overdue_callbacks <= 2 ? 'warning' : 'bad'),
    `${f.overdue_callbacks}`,
    f.overdue_callbacks === 0 ? 'No overdue callbacks.' : `${f.overdue_callbacks} overdue.`);

  // 6. High-priority support
  push('high_priority_support', 'High-priority support',
    f.high_priority_support_open === 0 ? 'good' : (f.high_priority_support_open <= 2 ? 'warning' : 'bad'),
    `${f.high_priority_support_open}`,
    f.high_priority_support_open === 0 ? 'No open high-priority requests.' : `${f.high_priority_support_open} open.`);

  // 7. Incidents
  push('incidents', 'Open incidents',
    f.critical_incidents > 0 ? 'bad' : (f.open_incidents > 0 ? 'warning' : 'good'),
    `${f.open_incidents}`,
    f.critical_incidents > 0 ? `${f.critical_incidents} critical.` : (f.open_incidents === 0 ? 'No open incidents.' : `${f.open_incidents} open.`));

  // 8. Usage vs allowance
  push('usage', 'Usage vs allowance',
    f.usage_percentage >= 100 ? 'bad' : (f.usage_percentage >= 85 ? 'warning' : 'good'),
    `${f.usage_percentage}%`,
    `${f.usage_percentage}% of allowance consumed.`);

  // 9. Weekly pulse
  if (f.pulse_score !== null && f.pulse_score !== undefined) {
    push('pulse', 'Weekly pulse',
      f.pulse_score >= 4 ? 'good' : (f.pulse_score >= 3 ? 'warning' : 'bad'),
      `${f.pulse_score}/5`,
      'Caller satisfaction pulse.');
  }

  // Overall health
  let health = 'healthy';
  if (bad > 0) health = 'at_risk';
  else if (warn > 0) health = 'needs_attention';

  const dataPoints = f.total_calls + f.callbacks_total + f.active_callers;
  if (dataPoints === 0 && f.pulse_score === null && f.pilot_status !== 'active') {
    health = 'unknown';
  }

  return { health, factors, summary: `Health: ${health}. ${bad} critical, ${warn} warning(s).` };
}