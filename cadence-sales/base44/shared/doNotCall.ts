// Immediate do-not-call workflow.
// When a prospect asks not to be called, this suppresses the contact,
// creates a SuppressionEntry, closes open Tasks, suppresses CampaignAssignments,
// and creates an AuditLog entry — all server-side, before another user can claim.
import { normalisePhone, hashValue } from './complianceUtils.ts';

export async function processDoNotCall(base44, user, org, contactId, reason, source = 'caller') {
  const now = new Date().toISOString();

  // 1. Fetch and verify the contact
  const contact = await base44.asServiceRole.entities.Contact.get(contactId).catch(() => null);
  if (!contact) throw new Error('Contact not found');
  if (contact.organisation_id !== org.id) throw new Error('Contact does not belong to this organisation');

  // 2. Capture the hashes before anything is erased, so the number and address
  // stay blocked with no personal data left in plain text.
  const phoneHash = contact.phone ? await hashValue(normalisePhone(contact.phone)) : '';
  const emailHash = contact.email ? await hashValue(String(contact.email).trim().toLowerCase()) : '';

  // 3. Suppression marker — the one record that says this person asked not to be
  // called. It holds hashes only: never the name, number or address.
  await base44.asServiceRole.entities.SuppressionEntry.create({
    organisation_id: org.id,
    suppression_type: 'do_not_call',
    subject_type: 'contact',
    contact_id: contactId,
    company_id: contact.company_id || '',
    campaign_id: contact.campaign_id || '',
    normalised_phone_hash: phoneHash,
    normalised_email_hash: emailHash,
    source,
    reason: 'Do not call request — details erased',
    scope: 'contact',
    status: 'active',
    recorded_by_user_id: user.id,
    recorded_at: now,
    effective_at: now,
    override_allowed: true,
    created_at: now,
    updated_at: now,
  });

  // 4. Close open Tasks for this contact
  const openTasks = await base44.asServiceRole.entities.Task.filter(
    { organisation_id: org.id, contact_id: contactId, status: { $in: ['pending', 'in_progress'] } },
    '-created_date', 100
  ).catch(() => []);
  for (const task of openTasks) {
    await base44.asServiceRole.entities.Task.update(task.id, {
      status: 'cancelled',
      completed_at: now,
      skip_reason: 'Contact suppressed (do not call)',
      title: ERASED_NAME,
      description: '',
    });
  }

  // 5. Suppress CampaignAssignments
  const assignments = await base44.asServiceRole.entities.CampaignAssignment.filter(
    { organisation_id: org.id, contact_id: contactId, status: { $in: ['assigned', 'in_progress', 'follow_up', 'unassigned'] } },
    '-created_date', 50
  ).catch(() => []);
  for (const assignment of assignments) {
    await base44.asServiceRole.entities.CampaignAssignment.update(assignment.id, {
      status: 'suppressed',
    });
  }

  // 6. Erase the person's data — removed from the contact, their call history,
  // the matching prospect record and any open task, keeping only the flag.
  await erasePersonalData(base44, org, contact, now);

  // 7. Audit log — the entry itself holds no personal data.
  await base44.asServiceRole.entities.AuditLog.create({
    organisation_id: org.id,
    actor_user_id: user.id,
    action: 'contact_suppressed',
    entity_type: 'Contact',
    entity_id: contactId,
    new_value: 'do_not_call_erased',
    timestamp: now,
  });

  return {
    suppressed: true,
    erased: true,
    contact_id: contactId,
    tasks_closed: openTasks.length,
    assignments_suppressed: assignments.length,
  };
}

const ERASED_NAME = 'Removed contact';

const digits = (value) => String(value || '').replace(/\D/g, '');
const nameKey = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

// Removes the personal data of someone who asked not to be called, everywhere
// it is stored, while leaving the do-not-call flag and audit trail in place.
async function erasePersonalData(base44, org, contact, now) {
  const svc = base44.asServiceRole;

  // Contact: identity and contact details blanked, suppression state kept.
  await svc.entities.Contact.update(contact.id, {
    do_not_call: true,
    do_not_call_at: now,
    do_not_call_reason: 'Asked not to be called — details removed',
    marketing_status: 'suppressed',
    suppression_scope: 'contact',
    number_status: 'dnc',
    call_status: 'not_interested',
    last_compliance_check_at: now,
    anonymised_at: now,
    full_name: ERASED_NAME,
    job_title: '',
    phone: '',
    mobile: '',
    direct_dial: '',
    company_phone: '',
    email: '',
    linkedin: '',
    notes: '',
    ai_brief: '',
    ai_pitch: '',
    phone_source: 'erased',
    phone_review_reason: '',
    source_reference: '',
    source_url: '',
    field_provenance: {},
    compliance_notes: 'Personal data erased after a do-not-call request.',
  });

  // Call history: outcomes and dates stay for reporting, personal detail goes.
  await svc.entities.CallLog.updateMany(
    { organisation_id: org.id, contact_id: contact.id },
    { $set: { contact_name: ERASED_NAME, phone: '', notes: '', outcome_notes: '', recording_url: '' } },
  ).catch(() => null);

  // The same person on the prospecting side, at the same company.
  const company = contact.company_id
    ? await svc.entities.Company.get(contact.company_id).catch(() => null)
    : null;
  let prospects = [];
  if (company?.domain) {
    prospects = await svc.entities.Prospect
      .filter({ organisation_id: org.id, domain: company.domain }, '-created_date', 200)
      .catch(() => []);
  }
  if (!prospects?.length && company?.name) {
    prospects = await svc.entities.Prospect
      .filter({ organisation_id: org.id, company_name: company.name }, '-created_date', 200)
      .catch(() => []);
  }

  const personName = nameKey(contact.full_name);
  const personDigits = digits(contact.phone);
  for (const prospect of prospects || []) {
    const isThisPerson = (personName && nameKey(prospect.full_name) === personName)
      || (personDigits && digits(prospect.phone) === personDigits);
    const remaining = (prospect.contacts || []).filter((person) => {
      const matched = (personName && nameKey(person.name) === personName)
        || (personDigits && (digits(person.phone) === personDigits || digits(person.mobile) === personDigits));
      return !matched;
    });
    const patch = { contacts: remaining };
    if (isThisPerson) {
      Object.assign(patch, {
        full_name: ERASED_NAME,
        job_title: '',
        phone: '',
        mobile: '',
        direct_dial: '',
        company_phone: '',
        email: '',
        generic_email: '',
        linkedin: '',
        phone_source: 'erased',
        phone_review_reason: '',
        field_provenance: {},
        mobile_found: false,
        work_email_found: false,
        linkedin_found: false,
        enrichment_status: 'out_of_scope',
        provider_error: 'Do not call — details removed',
      });
    }
    await svc.entities.Prospect.update(prospect.id, patch).catch(() => null);
  }
}

// True when a number carries an active suppression. Used to block dialling at
// the telephony layer, not just in the dialer, so a removed contact can never
// be called even if their number is typed in by hand.
export async function isNumberSuppressed(base44, orgId, phone) {
  const phoneHash = phone ? await hashValue(normalisePhone(phone)) : '';
  if (!phoneHash) return false;
  const rows = await base44.asServiceRole.entities.SuppressionEntry.filter(
    { organisation_id: orgId, normalised_phone_hash: phoneHash, status: 'active' },
    '-created_date', 1,
  ).catch(() => []);
  return !!(rows && rows.length);
}

// Admin-only override of a suppression — never deletes the original record
export async function overrideSuppression(base44, user, org, suppressionEntryId, reason) {
  const now = new Date().toISOString();

  const entry = await base44.asServiceRole.entities.SuppressionEntry.get(suppressionEntryId).catch(() => null);
  if (!entry) throw new Error('Suppression entry not found');
  if (entry.organisation_id !== org.id) throw new Error('Suppression entry does not belong to this organisation');
  if (!entry.override_allowed) throw new Error('This suppression cannot be overridden');

  // Update the suppression entry — mark as overridden, never delete
  await base44.asServiceRole.entities.SuppressionEntry.update(suppressionEntryId, {
    status: 'overridden',
    override_reason: reason,
    overridden_by_user_id: user.id,
    overridden_at: now,
    updated_at: now,
  });

  // If linked to a contact, clear the suppression scope
  if (entry.contact_id) {
    const contact = await base44.asServiceRole.entities.Contact.get(entry.contact_id).catch(() => null);
    if (contact && contact.organisation_id === org.id) {
      await base44.asServiceRole.entities.Contact.update(entry.contact_id, {
        do_not_call: false,
        suppression_scope: 'none',
        marketing_status: 'permitted',
        number_status: contact.number_status === 'dnc' ? 'untested' : contact.number_status,
        last_compliance_check_at: now,
        compliance_notes: 'Suppression overridden by admin: ' + reason,
      });
    }
  }

  // Audit log
  await base44.asServiceRole.entities.AuditLog.create({
    organisation_id: org.id,
    actor_user_id: user.id,
    action: 'suppression_overridden',
    entity_type: 'SuppressionEntry',
    entity_id: suppressionEntryId,
    new_value: 'overridden',
    timestamp: now,
  });

  return { overridden: true, suppression_entry_id: suppressionEntryId };
}