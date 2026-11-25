import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { assertListOwned, assertCompanyOwned } from '../../shared/ownership.ts';
import { PeopleSearchProvider } from '../../shared/providers.ts';
import { checkAllowance, recordUsage } from '../../shared/costControl.ts';
import { getOrgCredentials } from '../../shared/providerCredentials.ts';
import { createJob, startJob, completeJob, recordAttempt } from '../../shared/researchJob.ts';

function normName(s) {
  return (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

// Find decision-makers at a company. Returns several possible contacts (names,
// titles, LinkedIn) WITHOUT revealing paid direct numbers. Deduplicates against
// existing Contacts via a 4-tier match so no Contact is ever duplicated.
export default async function (req) {
  const { base44, user, org, profile } = await resolveTenant(req);
  assertProviderAccess(profile);
  const body = await req.json().catch(() => ({}));
  const { target_list_id, company_id } = body || {};
  const list = await assertListOwned(base44, org, target_list_id);
  const company = await assertCompanyOwned(base44, org, company_id);

  await checkAllowance(base44, org, 'people_search', 1);

  const job = await createJob(base44, {
    organisation_id: org.id, target_list_id, requested_by_user_id: user.id,
    job_type: 'decision_maker_search', total_records: 1, estimated_cost: 1,
  });
  await startJob(base44, job);

  try {
    const creds = await getOrgCredentials(base44, org);
    const found = await PeopleSearchProvider.findDecisionMakers(base44, creds, {
      company: company.name, domain: company.domain, target_roles: list.target_roles,
    });

    // Existing contacts at this company (org + company scoped).
    const existing = company_id
      ? await base44.asServiceRole.entities.Contact.filter({ company_id, organisation_id: org.id }, '-created_date', 200)
      : [];
    const byLinkedin = new Map(existing.map((c) => [((c.linkedin || '').toLowerCase().trim()), c]).filter(([k]) => k));
    const byName = new Map(existing.map((c) => [normName(c.full_name), c]).filter(([k]) => k));

    let created = 0;
    const contacts = [];
    for (const dm of found) {
      const li = (dm.linkedin || '').toLowerCase().trim();
      const nn = normName(dm.name);
      let contact = (li && byLinkedin.get(li)) || (nn && byName.get(nn)) || null;
      if (!contact) {
        contact = await base44.asServiceRole.entities.Contact.create({
          full_name: dm.name, job_title: dm.title, company: company.name, company_id: company.id,
          linkedin: dm.linkedin || '', industry: company.industry, employee_range: company.employee_range,
          website: company.website, number_status: 'untested', call_status: 'new',
          source: dm.provider, organisation_id: org.id, owner_user_id: user.id,
        });
        byName.set(nn, contact);
        if (li) byLinkedin.set(li, contact);
        created++;
      }
      contacts.push({ id: contact.id, full_name: contact.full_name, job_title: contact.job_title, linkedin: contact.linkedin, provider: dm.provider, confidence: dm.confidence });
    }

    await recordAttempt(base44, {
      organisation_id: org.id, target_list_id, company_id, research_job_id: job.id,
      provider: found[0]?.provider || 'ai_web', enrichment_type: 'people_search',
      status: found.length ? 'successful' : 'not_found',
      fields_returned: contacts.map((c) => c.full_name), estimated_cost: 1, actual_cost: 1,
    });
    await recordUsage(base44, {
      organisation_id: org.id, user_id: user.id, target_list_id,
      event_type: 'people_search', provider: found[0]?.provider || 'ai_web', quantity: 1,
      estimated_cost: 1, actual_cost: 1, related_record_id: company_id,
    });

    await completeJob(base44, job, { processed: 1, successful: 1, failed: 0, skipped: 0, actualCost: 1, errorSummary: '' });
    return Response.json({ job_id: job.id, found: found.length, created, contacts });
  } catch (e) {
    await completeJob(base44, job, { processed: 1, successful: 0, failed: 1, skipped: 0, actualCost: 0, errorSummary: e.message });
    return Response.json({ error: e.message }, { status: 500 });
  }
}