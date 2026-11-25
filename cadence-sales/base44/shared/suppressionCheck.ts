// Central server-side suppression check.
// Must run before: creating call Tasks, adding to calling queues,
// claiming assignments, initiating calls, manual dialling, reassigning, retry tasks.
import { normalisePhone, hashValue, getComplianceSettings, isWithinCallingHours } from './complianceUtils.ts';

export async function checkSuppression(base44, org, contact, company, campaignId) {
  const settings = await getComplianceSettings(base44, org);
  const result = {
    allowed: true,
    blocked: false,
    review_required: false,
    reason: '',
    explanation: '',
    override_eligible: false,
  };

  // Anonymised or deleted
  if (contact?.anonymised_at || contact?.deleted_at) {
    return block(result, 'anonymised_or_deleted', 'This contact record is no longer active.', false);
  }

  // Contact do-not-call
  if (contact?.do_not_call) {
    return block(result, 'do_not_call', 'This contact has requested not to be called.', true);
  }

  // Contact suppression scope
  if (contact?.suppression_scope && contact.suppression_scope !== 'none') {
    return block(result, 'suppressed', 'This contact is suppressed from calling.', true);
  }

  // Marketing status
  if (contact?.marketing_status === 'suppressed' || contact?.marketing_status === 'objected') {
    return block(result, 'marketing_' + contact.marketing_status,
      'This contact has a marketing ' + (contact.marketing_status === 'objected' ? 'objection' : 'suppression') + ' in place.',
      contact.marketing_status === 'suppressed');
  }

  // Phone hash suppression — check if the phone number itself is suppressed
  if (contact?.phone) {
    const phoneHash = await hashValue(normalisePhone(contact.phone));
    const phoneSuppressions = await base44.asServiceRole.entities.SuppressionEntry.filter(
      { organisation_id: org.id, normalised_phone_hash: phoneHash, status: 'active' },
      '-created_date', 10
    ).catch(() => []);
    if (phoneSuppressions?.length > 0) {
      return block(result, 'phone_suppressed', 'The phone number for this contact is suppressed.',
        phoneSuppressions[0]?.override_allowed || false);
    }
  }

  // Company suppression
  if (company?.suppression_status === 'active') {
    return block(result, 'company_suppressed', 'This company is suppressed from calling.', true);
  }

  // Campaign-specific exclusion
  if (campaignId && contact?.id) {
    const campaignSuppressions = await base44.asServiceRole.entities.SuppressionEntry.filter(
      { organisation_id: org.id, campaign_id: campaignId, contact_id: contact.id, status: 'active' },
      '-created_date', 5
    ).catch(() => []);
    if (campaignSuppressions?.length > 0) {
      return block(result, 'campaign_exclusion', 'This contact is excluded from this campaign.', true);
    }
  }

  // Screening expired or review required
  if (contact?.screening_status === 'check_expired' || contact?.screening_status === 'review_required') {
    return review(result, 'screening_' + contact.screening_status,
      'This contact\u2019s suppression screening has expired and requires review.');
  }

  // Retention review due
  if (contact?.retention_review_at && new Date(contact.retention_review_at).getTime() < Date.now()) {
    return review(result, 'retention_review', 'This contact is due for retention review.');
  }

  // Compliance review required
  if (contact?.compliance_review_status === 'review_required' || contact?.compliance_review_status === 'flagged') {
    return review(result, 'compliance_review', 'This contact requires compliance review before calling.');
  }

  // Calling hours check
  const hoursCheck = isWithinCallingHours(settings);
  if (!hoursCheck.allowed) {
    return review(result, 'outside_calling_hours', hoursCheck.reason);
  }

  return result;
}

function block(result, reason, explanation, overrideEligible) {
  result.allowed = false;
  result.blocked = true;
  result.reason = reason;
  result.explanation = explanation;
  result.override_eligible = overrideEligible;
  return result;
}

function review(result, reason, explanation) {
  result.allowed = false;
  result.review_required = true;
  result.reason = reason;
  result.explanation = explanation;
  return result;
}