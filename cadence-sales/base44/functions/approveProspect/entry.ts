import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertListOwned, assertCompanyOwned, assertContactOwned } from '../../shared/ownership.ts';

// Call-ready approval: promotes an approved, researched company + selected
// contact into a Target List's calling queue. Idempotent (re-approval does not
// create duplicate queue entries). Reuses the existing Company and Contact —
// only an organisation-scoped join record is created. Rejects suppressed /
// do-not-contact contacts and unapproved/excluded companies.
export default async function (req) {
  const { base44, user, org } = await resolveTenant(req);
  const body = await req.json().catch(() => ({}));
  const { target_list_id, company_id, contact_id } = body || {};

  await assertListOwned(base44, org, target_list_id);
  const company = await assertCompanyOwned(base44, org, company_id);
  const contact = contact_id ? await assertContactOwned(base44, org, contact_id) : null;

  // Call-ready conditions.
  const fit = await base44.asServiceRole.entities.TargetListCompanyFit.filter(
    { target_list_id, company_id, organisation_id: org.id }
  );
  const fitRec = fit && fit[0];
  if (fitRec && (fitRec.fit_band === 'excluded' || fitRec.review_status === 'rejected')) {
    return Response.json({ error: 'Company is excluded or rejected for this target list.' }, { status: 403 });
  }

  if (contact) {
    if (contact.number_status === 'dnc') {
      return Response.json({ error: 'Contact is marked Do-Not-Contact and cannot become call ready.' }, { status: 403 });
    }
    if (!contact.phone || ['bad', 'dnc'].includes(contact.number_status)) {
      return Response.json({ error: 'Contact has no usable phone number. Enrich a direct number first.' }, { status: 403 });
    }
  } else {
    // No specific contact — require at least one dialable contact at the company.
    const contacts = await base44.asServiceRole.entities.Contact.filter(
      { company_id, organisation_id: org.id }, '-updated_date', 50
    );
    const dialable = contacts.find((c) => c.phone && !['bad', 'dnc'].includes(c.number_status));
    if (!dialable) {
      return Response.json({ error: 'No dialable contact at this company. Find decision-makers and enrich a number first.' }, { status: 403 });
    }
  }

  // Idempotent: if a membership already links this company to the list, don't duplicate.
  const existing = await base44.asServiceRole.entities.TargetListMember.filter(
    { target_list_id, company_id, organisation_id: org.id }
  );
  if (existing && existing.length) {
    return Response.json({ added: false, already_in_list: true, call_ready: true });
  }

  await base44.asServiceRole.entities.TargetListMember.create({
    target_list_id, company_id,
    contact_id: contact?.id || undefined,
    organisation_id: org.id, owner_user_id: user.id,
  });

  return Response.json({ added: true, call_ready: true });
}