// Frontend mirror of base44/shared/qualificationRules.ts.
// Single source of truth for qualification panel UI.
// Keep in sync with the backend module.

export const QUALIFICATION_REQUIRED_FIELDS = [
  'company_id',
  'primary_contact_id',
  'need_summary',
  'authority_status',
  'next_step',
  'timing',
  'owner_user_id',
  'source_call_log_id',
];

export const QUALIFICATION_PROGRESS_FIELDS = [
  'need_summary', 'pain_points', 'current_solution', 'business_impact',
  'timing', 'budget_status', 'authority_status', 'decision_process', 'next_step',
];

export function isFieldFilled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return value !== 0;
  return true;
}

export function getQualificationState(opp) {
  if (opp?.qualification_status === 'disqualified') return 'disqualified';
  const requiredFilled = QUALIFICATION_REQUIRED_FIELDS.filter((f) => isFieldFilled(opp?.[f]));
  if (requiredFilled.length === QUALIFICATION_REQUIRED_FIELDS.length) return 'qualified';
  const progressFilled = QUALIFICATION_PROGRESS_FIELDS.filter((f) => isFieldFilled(opp?.[f]));
  if (progressFilled.length > 0) return 'qualifying';
  return 'incomplete';
}

export function canSubmitForReview(opp) {
  return getQualificationState(opp) === 'qualified' && opp?.manager_review_status === 'not_submitted';
}

export function getMissingRequiredFields(opp) {
  return QUALIFICATION_REQUIRED_FIELDS.filter((f) => !isFieldFilled(opp?.[f]));
}