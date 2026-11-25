import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertCompanyOwned } from '../../shared/ownership.ts';
import { ContactEnrichmentProvider } from '../../shared/providers.ts';
import { checkAllowance, recordUsage, isoPlusDays } from '../../shared/costControl.ts';
import { getOrgCredentials } from '../../shared/providerCredentials.ts';
import { recordAttempt } from '../../shared/researchJob.ts';

// Add a contact a caller was told about mid-call. Details handed over on the
// call are saved as given; anything missing can then be looked up through the
// configured providers. Never creates a duplicate contact for the same person.
function normName(value) {
  return (value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export default async function (req) {
  try {
    const { base44, user, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));

    const fullName = String(body.full_name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!fullName) {
      return Response.json({ error: 'A contact name is required.' }, { status: 400 });
    }

    const company = await assertCompanyOwned(base44, org, body.company_id);
    const jobTitle = String(body.job_title || '').trim().slice(0, 120);
    const phone = String(body.phone || '').trim().slice(0, 40);
    const email = String(body.email || '').trim().slice(0, 160);
    const linkedin = String(body.linkedin || '').trim().slice(0, 300);
    const contextNote = String(body.context_note || '').trim().slice(0, 1000);
    const campaignId = String(body.campaign_id || '').trim();
    const findDetails = !!body.find_details;

    // Same person already on the company? Fill their gaps instead of duplicating.
    const existing = await base44.asServiceRole.entities.Contact.filter(
      { company_id: company.id, organisation_id: org.id }, '-created_date', 200
    );
    const wanted = normName(fullName);
    const duplicate = existing.find((c) =>
      normName(c.full_name) === wanted
      || (email && (c.email || '').toLowerCase() === email.toLowerCase())
      || (linkedin && (c.linkedin || '').toLowerCase() === linkedin.toLowerCase())
    );

    let contact;
    let created = false;
    if (duplicate) {
      const patch = {};
      if (!duplicate.job_title && jobTitle) patch.job_title = jobTitle;
      if (!duplicate.phone && phone) patch.phone = phone;
      if (!duplicate.email && email) patch.email = email;
      if (!duplicate.linkedin && linkedin) patch.linkedin = linkedin;
      if (contextNote && !duplicate.notes) patch.notes = contextNote;
      contact = Object.keys(patch).length
        ? await base44.asServiceRole.entities.Contact.update(duplicate.id, patch)
        : duplicate;
    } else {
      contact = await base44.asServiceRole.entities.Contact.create({
        full_name: fullName,
        job_title: jobTitle,
        company: company.name,
        company_id: company.id,
        phone,
        email,
        linkedin,
        website: company.website || '',
        industry: company.industry || '',
        employee_range: company.employee_range || '',
        number_status: 'untested',
        call_status: 'new',
        source: 'manual',
        data_source: 'manual',
        notes: contextNote,
        campaign_id: campaignId,
        lawful_basis: 'legitimate_interest',
        organisation_id: org.id,
        owner_user_id: user.id,
      });
      created = true;
    }

    const found = { phone: '', email: '' };
    const messages = [];

    if (findDetails && (!contact.phone || !contact.email)) {
      let creds = null;
      try {
        creds = await getOrgCredentials(base44, org);
      } catch {
        creds = null;
      }
      const providerCompany = {
        name: company.name,
        landline: company.landline || '',
        website: company.website || '',
      };
      const domain = company.domain || '';
      const who = { name: contact.full_name, linkedin: contact.linkedin || '' };

      if (creds && !contact.phone) {
        try {
          await checkAllowance(base44, org, 'phone_enrichment', 1);
          const result = await ContactEnrichmentProvider.revealPhone(creds, { contact: who, company: providerCompany, domain });
          if (result && result.number) {
            const patched = await base44.asServiceRole.entities.Contact.update(contact.id, {
              phone: result.number,
              number_status: result.type === 'switchboard' ? 'untested' : 'good',
              source: result.provider,
            });
            contact = patched || contact;
            found.phone = result.number;
            await recordAttempt(base44, {
              organisation_id: org.id, target_list_id: campaignId, company_id: company.id, contact_id: contact.id,
              provider: result.provider, enrichment_type: 'direct_phone', status: 'successful',
              source_url: result.source_url, confidence: result.confidence, fields_returned: ['phone'],
              estimated_cost: result.provider === 'switchboard' ? 0 : 1,
              actual_cost: result.provider === 'switchboard' ? 0 : 1,
              expires_at: isoPlusDays(180),
            });
            if (result.provider !== 'switchboard') {
              await recordUsage(base44, {
                organisation_id: org.id, user_id: user.id, target_list_id: campaignId,
                event_type: 'phone_enrichment', provider: result.provider, quantity: 1,
                estimated_cost: 1, actual_cost: 1, related_record_id: contact.id,
                source_function: 'addDialerContact',
              });
            }
          } else {
            await recordAttempt(base44, {
              organisation_id: org.id, target_list_id: campaignId, company_id: company.id, contact_id: contact.id,
              provider: 'lusha', enrichment_type: 'direct_phone', status: 'not_found',
              estimated_cost: 1, safe_error_message: 'No phone number found.',
              expires_at: isoPlusDays(7),
            });
            messages.push('No phone number found.');
          }
        } catch (e) {
          messages.push(e.message || 'Phone lookup could not run.');
        }
      }

      if (creds && !contact.email) {
        try {
          await checkAllowance(base44, org, 'email_enrichment', 1);
          const result = await ContactEnrichmentProvider.revealEmail(creds, { contact: who, company: providerCompany, domain });
          if (result && result.email) {
            const patched = await base44.asServiceRole.entities.Contact.update(contact.id, { email: result.email });
            contact = patched || contact;
            found.email = result.email;
            await recordAttempt(base44, {
              organisation_id: org.id, target_list_id: campaignId, company_id: company.id, contact_id: contact.id,
              provider: result.provider, enrichment_type: 'email', status: 'successful',
              source_url: result.source_url, confidence: result.confidence, fields_returned: ['email'],
              estimated_cost: 1, actual_cost: 1, expires_at: isoPlusDays(180),
            });
            await recordUsage(base44, {
              organisation_id: org.id, user_id: user.id, target_list_id: campaignId,
              event_type: 'email_enrichment', provider: result.provider, quantity: 1,
              estimated_cost: 1, actual_cost: 1, related_record_id: contact.id,
              source_function: 'addDialerContact',
            });
          } else {
            messages.push('No email address found.');
          }
        } catch (e) {
          messages.push(e.message || 'Email lookup could not run.');
        }
      }
    }

    return Response.json({ contact_id: contact.id, contact, created, found, messages });
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 500 ? error.status : 500;
    return Response.json({ error: error.message || 'Could not add the contact.' }, { status });
  }
}