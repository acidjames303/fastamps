import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { assertListOwned } from '../../shared/ownership.ts';
import { CompanyResearchProvider } from '../../shared/providers.ts';
import { checkAllowance, recordUsage } from '../../shared/costControl.ts';
import { createJob, startJob, completeJob, recordAttempt } from '../../shared/researchJob.ts';

// ICP-based company discovery for a Target List. Returns a bounded list of
// candidate companies (deduplicated against existing Companies by domain).
// Candidates are NEVER auto-approved — the user selects which proceed to full
// research. If discovery is limited, that is reported honestly, not fabricated.
export default async function (req) {
  const { base44, user, org, profile } = await resolveTenant(req);
  assertProviderAccess(profile);
  const body = await req.json().catch(() => ({}));
  const { target_list_id, count } = body || {};
  const list = await assertListOwned(base44, org, target_list_id);

  const max = Math.min(Math.max(parseInt(count, 10) || 10, 1), 25);
  await checkAllowance(base44, org, 'company_discovery', 1);

  const job = await createJob(base44, {
    organisation_id: org.id, target_list_id, requested_by_user_id: user.id,
    job_type: 'company_discovery', total_records: 1, estimated_cost: 1,
  });
  await startJob(base44, job);

  try {
    // Existing company domains in this org (RLS-scoped via service role + org id).
    const existing = await base44.asServiceRole.entities.Company.filter(
      { organisation_id: org.id }, '-created_date', 1000
    );
    const existingDomains = existing.map((c) => c.domain).filter(Boolean);

    const icp = list.icp || [
      `Industries: ${(list.target_industries || []).join(', ')}`,
      `Sizes: ${(list.target_company_sizes || []).join(', ')}`,
      `Locations: ${(list.target_locations || []).join(', ')}`,
      `Roles: ${(list.target_roles || []).join(', ')}`,
    ].join('\n');

    const candidates = await CompanyResearchProvider.discoverCompanies(base44, {
      icp, brief: list.offer || '', count: max, existingDomains,
    });

    await recordAttempt(base44, {
      organisation_id: org.id, target_list_id, research_job_id: job.id,
      provider: 'ai_web', enrichment_type: 'company', status: candidates.length ? 'successful' : 'not_found',
      fields_returned: candidates.map((c) => c.name), estimated_cost: 1, actual_cost: 1,
      source_url: (candidates[0] || {}).source_url || '',
    });
    await recordUsage(base44, {
      organisation_id: org.id, user_id: user.id, target_list_id,
      event_type: 'company_discovery', provider: 'ai_web', quantity: 1,
      estimated_cost: 1, actual_cost: 1,
    });

    await completeJob(base44, job, { processed: 1, successful: 1, failed: 0, skipped: 0, actualCost: 1, errorSummary: '' });
    return Response.json({
      job_id: job.id, candidates,
      limited: candidates.length < max,
      note: candidates.length < max ? `Only ${candidates.length} verifiable candidates found — discovery is limited for this ICP.` : '',
    });
  } catch (e) {
    await completeJob(base44, job, { processed: 1, successful: 0, failed: 1, skipped: 0, actualCost: 0, errorSummary: e.message });
    return Response.json({ error: e.message, candidates: [], limited: true, note: 'Discovery unavailable — use manual or spreadsheet entry.' }, { status: 500 });
  }
}