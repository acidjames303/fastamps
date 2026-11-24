// Qualification rules — single source of truth for opportunity qualification.
// Used by bookMeeting, manageOpportunityReview, and the QualificationPanel UI.

// Minimum required fields for an opportunity to be "qualified".
// Org admins may override these later via org settings; these are sensible defaults.
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

// Fields that indicate qualifying progress (at least one must be filled to leave "incomplete").
export const QUALIFICATION_PROGRESS_FIELDS = [
  'need_summary',
  'pain_points',
  'current_solution',
  'business_impact',
  'timing',
  'budget_status',
  'authority_status',
  'decision_process',
  'next_step',
];

export function isFieldFilled(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return value !== 0;
  return true;
}

export function getQualificationState(opp: any): 'incomplete' | 'qualifying' | 'qualified' | 'disqualified' {
  if (opp?.qualification_status === 'disqualified') return 'disqualified';

  const requiredFilled = QUALIFICATION_REQUIRED_FIELDS.filter((f) => isFieldFilled(opp?.[f]));
  if (requiredFilled.length === QUALIFICATION_REQUIRED_FIELDS.length) return 'qualified';

  const progressFilled = QUALIFICATION_PROGRESS_FIELDS.filter((f) => isFieldFilled(opp?.[f]));
  if (progressFilled.length > 0) return 'qualifying';

  return 'incomplete';
}

export function canSubmitForReview(opp: any): boolean {
  return getQualificationState(opp) === 'qualified' && opp?.manager_review_status === 'not_submitted';
}

export function getMissingRequiredFields(opp: any): string[] {
  return QUALIFICATION_REQUIRED_FIELDS.filter((f) => !isFieldFilled(opp?.[f]));
}

export function canSelfApprove(org: any): boolean {
  return org?.settings?.allow_self_approved_handoff === true;
}

// Determine the handoff display status from the opportunity's fields.
export function getHandoffDisplayStatus(opp: any): string {
  if (opp?.handoff_status === 'handed_off') return 'Handed off';
  if (opp?.handoff_status === 'sending') return 'Sending';
  if (opp?.handoff_status === 'failed') return 'Failed';
  if (opp?.handoff_status === 'changes_requested') return 'Changes requested';
  if (opp?.handoff_status === 'approved') return 'Approved';
  if (opp?.manager_review_status === 'awaiting_review') return 'Awaiting review';
  return 'Not ready';
}