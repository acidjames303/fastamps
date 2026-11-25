// Ownership validators — every backend function must reject cross-organisation IDs.
// All lookups use the service-role client resolved by resolveTenant; org.id is
// the trusted organisation, never taken from the request body.

export async function assertListOwned(base44, org, target_list_id) {
  if (!target_list_id) throw Object.assign(new Error('target_list_id required'), { status: 400 });
  const list = await base44.asServiceRole.entities.Campaign.get(target_list_id).catch(() => null);
  if (!list) throw Object.assign(new Error('Target list not found'), { status: 404 });
  if (list.organisation_id !== org.id) throw Object.assign(new Error('Target list does not belong to your organisation'), { status: 403 });
  return list;
}

export async function assertCompanyOwned(base44, org, company_id) {
  if (!company_id) throw Object.assign(new Error('company_id required'), { status: 400 });
  const company = await base44.asServiceRole.entities.Company.get(company_id).catch(() => null);
  if (!company) throw Object.assign(new Error('Company not found'), { status: 404 });
  if (company.organisation_id !== org.id) throw Object.assign(new Error('Company does not belong to your organisation'), { status: 403 });
  return company;
}

export async function assertContactOwned(base44, org, contact_id) {
  if (!contact_id) throw Object.assign(new Error('contact_id required'), { status: 400 });
  const contact = await base44.asServiceRole.entities.Contact.get(contact_id).catch(() => null);
  if (!contact) throw Object.assign(new Error('Contact not found'), { status: 404 });
  if (contact.organisation_id !== org.id) throw Object.assign(new Error('Contact does not belong to your organisation'), { status: 403 });
  return contact;
}