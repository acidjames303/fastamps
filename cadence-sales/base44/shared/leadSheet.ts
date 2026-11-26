// Server-side lead sheet rules: which fields may be written, which status
// changes are legal, and who may review. Mirrors src/lib/leadSheet.js — the
// server copy is what protects the record, the client copy is what draws the UI.

export const LEAD_SHEET_WRITE_FIELDS = [
  'organisation_name', 'lead_status', 'date_called', 'conversation_details', 'next_steps',
  'address_line_1', 'address_line_2', 'address_line_3', 'address_line_4', 'postcode', 'country',
  'organisation_tel', 'industry', 'employees', 'turnover', 'nature_of_business',
  'qualification_interested', 'qualification_current_systems', 'qualification_improvements',
  'qualification_other_companies', 'bant_budget', 'bant_authority', 'bant_need',
  'bant_timescale', 'bant_next_action', 'contact_title', 'contact_name', 'contact_job_title',
  'contact_direct_dial', 'contact_mobile', 'contact_email', 'additional_notes', 'internal_notes',
];

// Never exported, never reported, never sent to a client.
export const INTERNAL_ONLY_FIELDS = ['internal_notes'];

export const CLIENT_VISIBLE_FIELDS = LEAD_SHEET_WRITE_FIELDS.filter(
  (field) => !INTERNAL_ONLY_FIELDS.includes(field),
);

export const REQUIRED_TO_SUBMIT = ['organisation_name', 'contact_name', 'date_called'];

export const EDITABLE_STATUSES = ['draft', 'returned'];

export const LEAD_SHEET_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted'],
  returned: ['submitted'],
  submitted: ['approved', 'returned'],
  approved: ['sent'],
  sent: [],
};

export const REVIEW_ROLES = ['platform_owner', 'organisation_admin', 'sales_manager', 'internal_bd'];

export function canTransition(from: string, to: string): boolean {
  return (LEAD_SHEET_TRANSITIONS[from] || []).includes(to);
}

export function isEditableStatus(status: string): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function canReviewRole(role: string): boolean {
  return REVIEW_ROLES.includes(role);
}

// Only the fields a lead sheet owns are ever written from a request body.
export function pickWritableFields(input: any): Record<string, string> {
  const source = input && typeof input === 'object' ? input : {};
  const out: Record<string, string> = {};
  for (const field of LEAD_SHEET_WRITE_FIELDS) {
    if (!(field in source)) continue;
    const value = source[field];
    if (value == null) continue;
    if (typeof value === 'object') continue;
    out[field] = String(value).slice(0, 20000);
  }
  return out;
}

export function computeMissingFields(sheet: any): string[] {
  const record = sheet || {};
  return CLIENT_VISIBLE_FIELDS.filter((field) => {
    const value = record[field];
    return value == null || String(value).trim() === '';
  });
}

export function changedFieldKeys(before: any, after: any): string[] {
  const a = before || {};
  const b = after || {};
  return LEAD_SHEET_WRITE_FIELDS.filter((field) => String(a[field] || '') !== String(b[field] || ''));
}

export function missingRequiredToSubmit(sheet: any): string[] {
  const record = sheet || {};
  return REQUIRED_TO_SUBMIT.filter((field) => !String(record[field] || '').trim());
}

// A lead sheet's caller owns it; a platform owner may correct any draft.
export function canEditSheet(sheet: any, userId: string, role: string): boolean {
  if (!sheet || !isEditableStatus(sheet.status)) return false;
  return sheet.caller_user_id === userId || role === 'platform_owner';
}

export function canReviewSheet(sheet: any, role: string): boolean {
  if (!sheet) return false;
  if (!canReviewRole(role)) return false;
  if (sheet.status === 'submitted') return true;
  return role === 'platform_owner';
}

export function idempotencyKey(source: string, callLogId: string, opportunityId: string): string {
  const anchor = String(callLogId || '').trim() || String(opportunityId || '').trim();
  return anchor ? `leadsheet:${source}:${anchor}` : '';
}