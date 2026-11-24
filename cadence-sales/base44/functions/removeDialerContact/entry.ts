import { resolveTenant } from '../../shared/roleGuards.ts';
import { isReadOnly } from '../../shared/taskLogic.ts';
import { assertContactOwned, assertCompanyOwned } from '../../shared/ownership.ts';

// Secure backend removal of a dialer contact.
// Replaces the frontend CallLog.create + Contact.delete bypass.
// Never counts removal as a sales call or conversation.
export default async function (req) {
  const { base44, user, profile, org } = await resolveTenant(req);
  if (isReadOnly(profile)) {
    return Response.json({ error: 'Reporting users cannot remove contacts.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { contact_id, company_id, campaign_id, removal_reason } = body || {};

  if (!contact_id) {
    return Response.json({ error: 'contact_id is required.' }, { status: 400 });
  }

  const VALID_REASONS = ['no_number', 'bad_data', 'removal_requested'];
  if (!removal_reason || !VALID_REASONS.includes(removal_reason)) {
    return Response.json({ error: 'Invalid removal_reason. Must be one of: ' + VALID_REASONS.join(', ') }, { status: 400 });
  }

  // Verify ownership — prevents cross-tenant access
  const contact = await assertContactOwned(base44, org, contact_id);
  let company = null;
  if (company_id) {
    try { company = await assertCompanyOwned(base44, org, company_id); } catch { /* non-fatal */ }
  }

  const now = new Date().toISOString();

  // Create AuditLog before removing
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      organisation_id: org.id,
      actor_user_id: user.id,
      action: 'contact_suppressed',
      entity_type: 'Contact',
      entity_id: contact.id,
      previous_value: contact.full_name || '',
      new_value: `removed:${removal_reason}`,
      timestamp: now,
    });
  } catch { /* audit failures are non-fatal */ }

  // Create a CallLog record that explicitly does NOT count as a call or conversation
  await base44.asServiceRole.entities.CallLog.create({
    organisation_id: org.id,
    user_id: user.id,
    created_by_user_id: user.id,
    contact_id: contact.id,
    contact_name: contact.full_name || '',
    company: company?.name || contact.company || '',
    company_id: company?.id || contact.company_id || '',
    phone: contact.phone || '',
    campaign_id: campaign_id || '',
    outcome: 'removed',
    primary_outcome: 'other',
    removal_reason,
    notes: `Record removed — ${removal_reason.replace(/_/g, ' ')}.`,
    call_attempted: false,
    call_connected: false,
    conversation_held: false,
    conversation_type: 'none',
    classification_status: 'classified',
    call_provider: 'manual',
    started_at: now,
    ended_at: now,
    outcome_saved_at: now,
  });

  // Remove the contact
  await base44.asServiceRole.entities.Contact.delete(contact.id);

  return Response.json({
    ok: true,
    removed_contact_id: contact.id,
    removal_reason,
  });
}