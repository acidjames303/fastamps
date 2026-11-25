import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { assertListOwned, assertContactOwned, assertCompanyOwned } from '../../shared/ownership.ts';
import { ContactEnrichmentProvider } from '../../shared/providers.ts';
import { checkAllowance, recordUsage, isCoolingDown, isoPlusDays, FAILED_ENRICH_COOLDOWN_DAYS } from '../../shared/costControl.ts';
import { getOrgCredentials } from '../../shared/providerCredentials.ts';
import { recordAttempt } from '../../shared/researchJob.ts';

// Paid contact-detail enrichment. Requires EXPLICIT user approval. Provider
// order: existing verified number (skip) → Lusha → FullEnrich fallback →
// company switchboard. Never overwrites a verified direct number with weaker
// data. Respects the failed-enrichment cooldown. Limits paid attempts.
const MAX_PAID_ATTEMPTS_PER_COMPANY = 3;

export default async function (req) {
  const { base44, user, org, profile } = await resolveTenant(req);
  assertProviderAccess(profile);
  const body = await req.json().catch(() => ({}));
  const { target_list_id, contact_id, approved } = body || {};

  if (!approved) {
    return Response.json({ error: 'Explicit approval is required before paid enrichment.' }, { status: 403 });
  }
  const list = await assertListOwned(base44, org, target_list_id);
  const contact = await assertContactOwned(base44, org, contact_id);
  const company = contact.company_id ? await assertCompanyOwned(base44, org, contact.company_id) : null;

  // Never overwrite an existing verified direct number.
  if (contact.phone && contact.number_status === 'good') {
    return Response.json({ skipped: 'Contact already has a verified number.', phone_type: 'existing' });
  }

  // Cooldown: don't retry an unsuccessful attempt until it expires.
  const attempts = await base44.asServiceRole.entities.EnrichmentAttempt.filter(
    { contact_id, organisation_id: org.id, enrichment_type: 'direct_phone' }, '-attempted_at', 10
  );
  const lastFailed = attempts.find((a) => a.status === 'failed' || a.status === 'not_found');
  if (isCoolingDown(lastFailed)) {
    return Response.json({
      error: `Last enrichment for this contact failed and is cooling down (retry after ${FAILED_ENRICH_COOLDOWN_DAYS} days).`,
    }, { status: 429 });
  }

  // Limit paid attempts per company.
  const companyAttempts = company
    ? await base44.asServiceRole.entities.EnrichmentAttempt.filter(
        { company_id: company.id, organisation_id: org.id, enrichment_type: 'direct_phone' }, '-attempted_at', 50
      )
    : [];
  const paidCount = companyAttempts.filter((a) => a.provider === 'lusha' || a.provider === 'fullenrich').length;
  if (paidCount >= MAX_PAID_ATTEMPTS_PER_COMPANY) {
    return Response.json({ error: `Reached the limit of ${MAX_PAID_ATTEMPTS_PER_COMPANY} paid attempts for this company.` }, { status: 429 });
  }

  await checkAllowance(base44, org, 'phone_enrichment', 1);

  try {
    const creds = await getOrgCredentials(base44, org);
    const result = await ContactEnrichmentProvider.revealPhone(creds, {
      contact: { name: contact.full_name, linkedin: contact.linkedin },
      company: company ? { name: company.name, landline: company.landline, website: company.website } : { name: contact.company },
      domain: company?.domain || '',
    });

    if (result && result.number) {
      // Upgrade only if the new data is at least as strong as what we have.
      const stronger = !contact.phone || contact.number_status !== 'good' || ['mobile', 'direct'].includes(result.type);
      if (stronger) {
        await base44.asServiceRole.entities.Contact.update(contact.id, {
          phone: result.number,
          number_status: result.type === 'switchboard' ? (contact.number_status === 'good' ? 'good' : 'untested') : 'good',
          source: result.provider,
        });
      }
      const verified = ContactEnrichmentProvider.verifyPhone({ confidence: result.confidence });
      await recordAttempt(base44, {
        organisation_id: org.id, target_list_id, company_id: company?.id, contact_id,
        provider: result.provider, enrichment_type: 'direct_phone', status: 'successful',
        source_url: result.source_url, confidence: result.confidence,
        fields_returned: ['phone'], estimated_cost: result.provider === 'switchboard' ? 0 : 1, actual_cost: result.provider === 'switchboard' ? 0 : 1,
        expires_at: isoPlusDays(180),
      });
      if (result.provider !== 'switchboard') {
        await recordUsage(base44, {
          organisation_id: org.id, user_id: user.id, target_list_id,
          event_type: 'phone_enrichment', provider: result.provider, quantity: 1,
          estimated_cost: 1, actual_cost: 1, related_record_id: contact.id,
        });
      }
      return Response.json({ enriched: true, phone_type: result.type, provider: result.provider, confidence: result.confidence, verified: verified.verified });
    }

    // Not found — record cooldown without corrupting existing data.
    await recordAttempt(base44, {
      organisation_id: org.id, target_list_id, company_id: company?.id, contact_id,
      provider: 'lusha', enrichment_type: 'direct_phone', status: 'not_found',
      estimated_cost: 1, safe_error_message: 'No number found by any provider.',
      expires_at: isoPlusDays(FAILED_ENRICH_COOLDOWN_DAYS),
    });
    return Response.json({ enriched: false, reason: 'No number found by any provider.' });
  } catch (e) {
    await recordAttempt(base44, {
      organisation_id: org.id, target_list_id, company_id: company?.id, contact_id,
      provider: 'lusha', enrichment_type: 'direct_phone', status: 'failed',
      estimated_cost: 1, safe_error_message: e.message, error_code: 'provider_error',
      expires_at: isoPlusDays(FAILED_ENRICH_COOLDOWN_DAYS),
    });
    return Response.json({ error: 'Enrichment failed — no data was changed.', safe_error: 'Provider error.' }, { status: 502 });
  }
}