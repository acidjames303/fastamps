import { resolveTenant } from '../../shared/tenantAuth.ts';
import { checkSuppression } from '../../shared/suppressionCheck.ts';

// Server-side suppression check endpoint.
// Called before creating tasks, adding to queues, claiming assignments, or initiating calls.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const { contact_id, campaign_id } = body;

    if (!contact_id) return Response.json({ error: 'contact_id required' }, { status: 400 });

    const contact = await base44.asServiceRole.entities.Contact.get(contact_id).catch(() => null);
    if (!contact) return Response.json({ error: 'Contact not found' }, { status: 404 });
    if (contact.organisation_id !== org.id) return Response.json({ error: 'Access denied' }, { status: 403 });

    const company = contact.company_id
      ? await base44.asServiceRole.entities.Company.get(contact.company_id).catch(() => null)
      : null;

    const result = await checkSuppression(base44, org, contact, company, campaign_id);

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}