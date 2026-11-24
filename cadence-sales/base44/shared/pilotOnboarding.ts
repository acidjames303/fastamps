// Pilot onboarding steps, activation gate, and health calculation.

export const ONBOARDING_STEPS = [
  { key: 'confirm_details', label: 'Confirm organisation details', role: 'admin' },
  { key: 'privacy_settings', label: 'Review privacy and calling settings', role: 'admin' },
  { key: 'connect_telephony', label: 'Connect calling provider', role: 'admin' },
  { key: 'test_call', label: 'Make a test call', role: 'admin' },
  { key: 'invite_team', label: 'Invite team', role: 'admin' },
  { key: 'create_campaign', label: 'Create first campaign', role: 'manager' },
  { key: 'add_companies', label: 'Add or import companies', role: 'manager' },
  { key: 'assign_callers', label: 'Assign callers', role: 'manager' },
  { key: 'first_call', label: 'Complete first real call', role: 'caller' },
  { key: 'first_callback', label: 'Schedule first callback', role: 'caller' },
  { key: 'view_results', label: 'View Results', role: 'caller' },
  { key: 'first_report', label: 'Generate first client report', role: 'manager' },
];

export const PILOT_ACTIVATION_REQUIREMENTS = [
  { key: 'active_organisation', label: 'Active organisation' },
  { key: 'subscription_active', label: 'Subscription or authorised trial' },
  { key: 'admin_assigned', label: 'Organisation admin assigned' },
  { key: 'support_contact_configured', label: 'Support contact assigned' },
  { key: 'telephony_configured', label: 'Telephony configured' },
  { key: 'test_call_completed', label: 'Successful test call' },
  { key: 'compliance_settings_reviewed', label: 'Compliance settings reviewed' },
  { key: 'first_campaign_drafted', label: 'First campaign drafted' },
  { key: 'usage_limits_configured', label: 'Usage limits configured' },
  { key: 'tenant_isolation_tested', label: 'Tenant-isolation result recorded' },
  { key: 'privacy_contact_configured', label: 'Privacy contact configured' },
  { key: 'onboarding_session_scheduled', label: 'Onboarding session scheduled' },
  { key: 'checkpoint_available', label: 'Rollback/checkpoint available' },
];

// Calculate pilot health from transparent factors.
// No AI scoring — each factor is explicit.
export function calculatePilotHealth(factors: {
  onboardingComplete: boolean;
  weeklyActiveUsers: number;
  expectedUsers: number;
  callbackCompletionRate: number;
  openCriticalSupport: number;
  openHighSupport: number;
  unresolvedBlockers: number;
  usagePercentOfLimit: number;
  pulseScore: number | null;
  paused: boolean;
}): { status: string; factors: { label: string; value: string; contributing: boolean }[] } {
  if (factors.paused) return { status: 'paused', factors: [] };

  const factorList = [
    { label: 'Onboarding complete', value: factors.onboardingComplete ? 'Yes' : 'No', contributing: !factors.onboardingComplete },
    { label: 'Active users', value: `${factors.weeklyActiveUsers}/${factors.expectedUsers}`, contributing: factors.weeklyActiveUsers === 0 },
    { label: 'Callback completion', value: `${Math.round(factors.callbackCompletionRate * 100)}%`, contributing: factors.callbackCompletionRate < 0.5 },
    { label: 'Critical support requests', value: String(factors.openCriticalSupport), contributing: factors.openCriticalSupport > 0 },
    { label: 'High support requests', value: String(factors.openHighSupport), contributing: factors.openHighSupport > 1 },
    { label: 'Unresolved blockers', value: String(factors.unresolvedBlockers), contributing: factors.unresolvedBlockers > 0 },
    { label: 'Usage vs limit', value: `${Math.round(factors.usagePercentOfLimit)}%`, contributing: factors.usagePercentOfLimit > 90 },
    { label: 'Pulse score', value: factors.pulseScore != null ? String(factors.pulseScore) : 'N/A', contributing: factors.pulseScore != null && factors.pulseScore < 3 },
  ];

  const redFlags = factorList.filter(f => f.contributing).length;
  let status = 'healthy';
  if (redFlags >= 3) status = 'at_risk';
  else if (redFlags >= 1) status = 'needs_attention';

  return { status, factors: factorList };
}

export const SUPPORT_PRIORITIES = {
  critical: { label: 'Critical', ackTargetHours: 1, criteria: ['Tenant-data exposure', 'Credentials exposed', 'Widespread auth failure', 'Calls cannot be ended', 'Outcomes/notes lost', 'Callbacks missing across users', 'Incorrect external handoffs', 'Billing affecting multiple customers'] },
  high: { label: 'High', ackTargetHours: 4, criteria: ['Calling unavailable for one org', 'Repeated callback failures', 'Campaign work inaccessible', 'Client reports materially incorrect', 'Privacy workflow failure'] },
  normal: { label: 'Normal', ackTargetHours: 24, criteria: ['Isolated workflow error', 'Import problem', 'Individual integration problem', 'Confusing behaviour'] },
  low: { label: 'Low', ackTargetHours: null, criteria: ['Cosmetic issue', 'Minor wording', 'Non-blocking feature request'] },
};