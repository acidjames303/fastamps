import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { assertListOwned } from '../../shared/ownership.ts';
import { CompanyResearchProvider } from '../../shared/providers.ts';
import { checkAllowance, recordUsage } from '../../shared/costControl.ts';
import { createJob, startJob, completeJob, recordAttempt } from '../../shared/researchJob.ts';

function normaliseCompanyName(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(ltd|limited|plc|llp|inc|the|group|holdings|uk|co)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');
}

function parseExcludedCompanies(list: any): string[] {
  try {
    const parsed = list?.icp ? JSON.parse(list.icp) : null;
    if (parsed && Array.isArray(parsed.excluded_companies)) {
      return parsed.excluded_companies.map((v: any) => String(v || '').trim()).filter(Boolean);
    }
  } catch {
    /* free-text ICP */
  }
  return [];
}

function isExcluded(name: string, excluded: string[]) {
  const target = normaliseCompanyName(name);
  if (!target || !excluded.length) return false;
  const list = excluded.map(normaliseCompanyName).filter(Boolean);
  return list.some((ex) => ex === target || (ex.length >= 4 && (target.includes(ex) || ex.includes(target))));
}

// ICP-based company discovery for a Target List. Returns a bounded list of
// candidate companies (deduplicated against existing Companies by domain and
// against structured ICP excluded_companies / current clients).
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

    // Seed accounts already on this campaign — search outside them, do not re-find.
    const seedProspects = await base44.asServiceRole.entities.Prospect.filter(
      { list_id: list.id }, '-created_date', 2000
    ).catch(() => []);
    const seedNames = (seedProspects || [])
      .map((p: any) => String(p.company_name || '').trim())
      .filter(Boolean);
    const seedDomains = (seedProspects || [])
      .map((p: any) => String(p.domain || '').trim().toLowerCase())
      .filter(Boolean);

    const excludedCompanies = parseExcludedCompanies(list);
    const blockNames = [...excludedCompanies, ...seedNames];
    const blockNote = [
      excludedCompanies.length
        ? `Do not return these current clients / excluded companies: ${excludedCompanies.join(', ')}`
        : '',
      seedNames.length
        ? `Do not return companies already on this campaign seed list (find similar accounts outside this set): ${seedNames.slice(0, 80).join(', ')}${seedNames.length > 80 ? ' …' : ''}`
        : '',
    ].filter(Boolean).join('\n');

    const icp = (list.icp || [
      `Industries: ${(list.target_industries || []).join(', ')}`,
      `Sizes: ${(list.target_company_sizes || []).join(', ')}`,
      `Locations: ${(list.target_locations || []).join(', ')}`,
      `Roles: ${(list.target_roles || []).join(', ')}`,
    ].join('\n')) + (blockNote ? `\n${blockNote}` : '');

    const rawCandidates = await CompanyResearchProvider.discoverCompanies(base44, {
      icp,
      brief: list.offer || '',
      count: max + Math.min(blockNames.length, 15),
      existingDomains: [...new Set([...existingDomains, ...seedDomains])],
    });
    const skippedExcluded = (rawCandidates || []).filter((c) => isExcluded(c.name, blockNames));
    const candidates = (rawCandidates || []).filter((c) => !isExcluded(c.name, blockNames)).slice(0, max);

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
      skipped_excluded: skippedExcluded.map((c) => c.name),
      limited: candidates.length < max,
      note: candidates.length < max
        ? `Only ${candidates.length} verifiable candidates found — discovery is limited for this ICP.`
        : (skippedExcluded.length
          ? `Skipped ${skippedExcluded.length} excluded or already-seeded compan${skippedExcluded.length === 1 ? 'y' : 'ies'}.`
          : ''),
    });
  } catch (e) {
    await completeJob(base44, job, { processed: 1, successful: 0, failed: 1, skipped: 0, actualCost: 0, errorSummary: e.message });
    return Response.json({ error: e.message, candidates: [], limited: true, note: 'Discovery unavailable — use manual or spreadsheet entry.' }, { status: 500 });
  }
}