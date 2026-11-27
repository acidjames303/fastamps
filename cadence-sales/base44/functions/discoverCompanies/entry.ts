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

function formatIcpText(list: any) {
  if (list?.icp && String(list.icp).trim()) return String(list.icp).trim();
  return [
    `Industries: ${(list?.target_industries || []).join(', ')}`,
    `Sizes: ${(list?.target_company_sizes || []).join(', ')}`,
    `Locations: ${(list?.target_locations || []).join(', ')}`,
    `Roles: ${(list?.target_roles || []).join(', ')}`,
  ].join('\n');
}

// ICP-based lookalike discovery. Accepts prospect_list_id (Find prospects path)
// or target_list_id (Campaign id). Seeds and exclusions come from ProspectList;
// candidates are NEVER auto-added.
export default async function (req) {
  const { base44, user, org, profile } = await resolveTenant(req);
  assertProviderAccess(profile);
  const body = await req.json().catch(() => ({}));
  const { target_list_id, prospect_list_id, count } = body || {};

  let campaign: any = null;
  let prospectList: any = null;

  if (prospect_list_id) {
    prospectList = await base44.asServiceRole.entities.ProspectList.get(prospect_list_id).catch(() => null);
    if (!prospectList || prospectList.organisation_id !== org.id) {
      return Response.json({ error: 'Prospect list not found in your organisation.' }, { status: 404 });
    }
    if (prospectList.campaign_id) {
      campaign = await base44.asServiceRole.entities.Campaign.get(prospectList.campaign_id).catch(() => null);
    }
  } else if (target_list_id) {
    campaign = await assertListOwned(base44, org, target_list_id);
    const lists = await base44.asServiceRole.entities.ProspectList.filter(
      { campaign_id: campaign.id },
      '-created_date',
      5,
    ).catch(() => []);
    prospectList = lists?.[0] || null;
  } else {
    return Response.json({ error: 'prospect_list_id or target_list_id required' }, { status: 400 });
  }

  const jobListId = campaign?.id || prospectList?.id || target_list_id || prospect_list_id;
  const max = Math.min(Math.max(parseInt(count, 10) || 10, 1), 25);
  await checkAllowance(base44, org, 'company_discovery', 1);

  const job = await createJob(base44, {
    organisation_id: org.id,
    target_list_id: jobListId,
    requested_by_user_id: user.id,
    job_type: 'company_discovery',
    total_records: 1,
    estimated_cost: 1,
  });
  await startJob(base44, job);

  try {
    const existing = await base44.asServiceRole.entities.Company.filter(
      { organisation_id: org.id },
      '-created_date',
      1000,
    );
    const existingDomains = existing.map((c) => c.domain).filter(Boolean);

    // Seed accounts live on ProspectList — not on Campaign.id.
    const seedListId = prospectList?.id || '';
    const seedProspects = seedListId
      ? await base44.asServiceRole.entities.Prospect.filter(
          { list_id: seedListId },
          '-created_date',
          2000,
        ).catch(() => [])
      : [];
    const seedNames = (seedProspects || [])
      .map((p: any) => String(p.company_name || '').trim())
      .filter(Boolean);
    const seedDomains = (seedProspects || [])
      .map((p: any) => String(p.domain || '').trim().toLowerCase())
      .filter(Boolean);

    // Structured ICP (incl. excluded_companies) is stored on ProspectList.
    const icpSource = prospectList || campaign;
    const excludedCompanies = [
      ...parseExcludedCompanies(prospectList),
      ...parseExcludedCompanies(campaign),
    ].filter((name, index, all) => all.findIndex((other) => other.toLowerCase() === name.toLowerCase()) === index);

    const blockNames = [...excludedCompanies, ...seedNames];
    const blockNote = [
      excludedCompanies.length
        ? `Do not return these current clients / excluded companies: ${excludedCompanies.join(', ')}`
        : '',
      seedNames.length
        ? `Do not return companies already on this campaign seed list (find similar accounts outside this set): ${seedNames.slice(0, 80).join(', ')}${seedNames.length > 80 ? ' …' : ''}`
        : '',
    ].filter(Boolean).join('\n');

    const icp = `${formatIcpText(icpSource)}${blockNote ? `\n${blockNote}` : ''}`;
    const brief = String(
      prospectList?.brief || campaign?.offer || campaign?.objective || campaign?.name || '',
    ).trim();

    const rawCandidates = await CompanyResearchProvider.discoverCompanies(base44, {
      icp,
      brief,
      count: max + Math.min(blockNames.length, 15),
      existingDomains: [...new Set([...existingDomains, ...seedDomains])],
    });
    const skippedExcluded = (rawCandidates || []).filter((c) => isExcluded(c.name, blockNames));
    const candidates = (rawCandidates || []).filter((c) => !isExcluded(c.name, blockNames)).slice(0, max);

    await recordAttempt(base44, {
      organisation_id: org.id,
      target_list_id: jobListId,
      research_job_id: job.id,
      provider: 'ai_web',
      enrichment_type: 'company',
      status: candidates.length ? 'successful' : 'not_found',
      fields_returned: candidates.map((c) => c.name),
      estimated_cost: 1,
      actual_cost: 1,
      source_url: (candidates[0] || {}).source_url || '',
    });
    await recordUsage(base44, {
      organisation_id: org.id,
      user_id: user.id,
      target_list_id: jobListId,
      event_type: 'company_discovery',
      provider: 'ai_web',
      quantity: 1,
      estimated_cost: 1,
      actual_cost: 1,
    });

    await completeJob(base44, job, {
      processed: 1,
      successful: 1,
      failed: 0,
      skipped: 0,
      actualCost: 1,
      errorSummary: '',
    });
    return Response.json({
      job_id: job.id,
      candidates,
      seed_count: seedNames.length,
      excluded_count: excludedCompanies.length,
      skipped_excluded: skippedExcluded.map((c) => c.name),
      limited: candidates.length < max,
      note: candidates.length < max
        ? `Only ${candidates.length} verifiable candidates found — discovery is limited for this ICP.`
        : (skippedExcluded.length
          ? `Skipped ${skippedExcluded.length} excluded or already-seeded compan${skippedExcluded.length === 1 ? 'y' : 'ies'}.`
          : ''),
    });
  } catch (e) {
    await completeJob(base44, job, {
      processed: 1,
      successful: 0,
      failed: 1,
      skipped: 0,
      actualCost: 0,
      errorSummary: e.message,
    });
    return Response.json({
      error: e.message,
      candidates: [],
      limited: true,
      note: 'Discovery unavailable — use manual or spreadsheet entry.',
    }, { status: 500 });
  }
}
