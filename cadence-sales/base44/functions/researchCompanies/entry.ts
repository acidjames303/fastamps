import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertListOwned } from '../../shared/ownership.ts';
import { upsertCompanyIntelligence, findReusableCompanyIntelligence, attachCachedIntelligence, findActiveResearchLock, companyCanonicalKey } from '../../shared/companyIntelligence.ts';
import { CompanyResearchProvider } from '../../shared/providers.ts';
import { checkAllowance, recordUsage, isoPlusDays, COMPANY_FACT_EXPIRY_DAYS } from '../../shared/costControl.ts';
import { createJob, startJob, completeJob, recordAttempt, findActiveJob } from '../../shared/researchJob.ts';

// Explicit, organisation-aware company research job for a Target List.
// Researches each member Company ONCE while its intelligence is current;
// reuses CompanyIntelligence across contacts and lists. Idempotent (an active
// job of the same type for the same list blocks a duplicate run). Bounded.
export default async function (req) {
  const { base44, user, org } = await resolveTenant(req);
  const body = await req.json().catch(() => ({}));
  const { target_list_id } = body || {};
  const list = await assertListOwned(base44, org, target_list_id);

  // Prevent simultaneous duplicate jobs.
  const active = await findActiveJob(base44, org.id, target_list_id, 'company_research');
  if (active) {
    return Response.json({ error: 'A company research job is already running for this target list.', job_id: active.id }, { status: 409 });
  }

  const members = await base44.asServiceRole.entities.TargetListMember.filter(
    { target_list_id, organisation_id: org.id }, '-created_date', 500
  );
  const companyIds = [...new Set(members.map((m) => m.company_id).filter(Boolean))];
  const companies = [];
  for (const id of companyIds) {
    const c = await base44.asServiceRole.entities.Company.get(id).catch(() => null);
    if (c) companies.push(c);
  }

  const job = await createJob(base44, {
    organisation_id: org.id, target_list_id, requested_by_user_id: user.id,
    job_type: 'company_research', total_records: companies.length, estimated_cost: companies.length,
  });
  await startJob(base44, job);

  const brief = `${list.offer || ''}\n\nICP: ${list.icp || (list.target_industries || []).join(', ')}`;
  const counts = { processed: 0, successful: 0, failed: 0, skipped: 0, actualCost: 0, errorSummary: '' };

  const TIME_BUDGET_MS = 240000;
  const startedAt = Date.now();

  for (const co of companies) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    counts.processed++;
    try {
      // Reuse current intelligence by organisation + canonical company identity.
      // Duplicate Company rows across lists therefore never consume another action.
      const ci = await findReusableCompanyIntelligence(base44, org.id, co);
      if (ci) {
        await attachCachedIntelligence(base44, org.id, co, ci);
        counts.skipped++;
        continue;
      }

      // A different batch may already be researching this canonical company.
      const activeLock = await findActiveResearchLock(base44, org.id, co);
      if (activeLock) {
        counts.skipped++;
        continue;
      }

      await checkAllowance(base44, org, 'company_research', 1);
      await upsertCompanyIntelligence(base44, co.id, co.name, {
        organisation_id: org.id,
        canonical_key: companyCanonicalKey(co),
        status: 'researching',
        generated_at: new Date().toISOString(),
        research_lock_expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
      });
      const research = await CompanyResearchProvider.researchCompany(base44, {
        company: co.name, domain: co.domain, website: co.website, brief, icp: list.icp,
      });

      const aiSummary = JSON.stringify({
        summary: research.business_description || research.canonical_name,
        what_they_do: research.products_services || [],
        who_they_target: research.target_markets || [],
      });

      await upsertCompanyIntelligence(base44, co.id, co.name, {
        organisation_id: org.id,
        ai_summary: aiSummary,
        turnover_estimate: research.turnover_estimate && research.turnover_estimate !== 'Unknown' ? research.turnover_estimate : '',
        tech_stack: research.tech_stack || [],
        news: research.news || '',
        buyer_signals: research.buyer_signals || '',
        target_roles: research.target_roles || [],
        icp_fit_score: 0,
        icp_fit_reason: research.why_matches || '',
        source: 'ai_web',
        status: 'current',
        generated_at: new Date().toISOString(),
        expires_at: isoPlusDays(COMPANY_FACT_EXPIRY_DAYS),
        confidence: research.confidence || 75,
        intelligence_version: (ci?.intelligence_version || 0) + 1,
        model_provider: 'google',
        model_name: 'gemini_3_flash',
        estimated_cost: 1,
        error_message: '',
        research_lock_expires_at: null,
      });

      // Backfill Company firmographics only where empty (never overwrite user-confirmed).
      const patch = {};
      if (research.industry && research.industry !== 'Unknown' && !co.industry) patch.industry = research.industry;
      if (research.location && research.location !== 'Unknown' && !co.location) patch.location = research.location;
      if (research.employee_range && research.employee_range !== 'Unknown' && !co.employee_range) patch.employee_range = research.employee_range;
      if (research.domain && !co.domain) patch.domain = research.domain;
      if (research.website && !co.website) patch.website = research.website;
      if (research.landline && !co.landline) patch.landline = research.landline;
      if (Object.keys(patch).length) await base44.asServiceRole.entities.Company.update(co.id, patch).catch(() => {});

      await recordAttempt(base44, {
        organisation_id: org.id, target_list_id, company_id: co.id, research_job_id: job.id,
        provider: 'ai_web', enrichment_type: 'company', status: 'successful',
        source_url: (research.sources || [])[0] || '',
        confidence: research.confidence || 75,
        fields_returned: Object.keys(research).filter((k) => research[k]),
        estimated_cost: 1, actual_cost: 1,
        expires_at: isoPlusDays(COMPANY_FACT_EXPIRY_DAYS),
      });
      await recordUsage(base44, {
        organisation_id: org.id, user_id: user.id, target_list_id,
        event_type: 'company_research', provider: 'ai_web', quantity: 1,
        estimated_cost: 1, actual_cost: 1, related_record_id: co.id,
        idempotency_key: `company_research:${org.id}:${companyCanonicalKey(co)}:${Math.floor(Date.now() / (COMPANY_FACT_EXPIRY_DAYS * 86400000))}`,
      });
      counts.successful++;
      counts.actualCost++;
    } catch (e) {
      counts.failed++;
      counts.errorSummary += `${co.name}: ${e.message}; `;
      await recordAttempt(base44, {
        organisation_id: org.id, target_list_id, company_id: co.id, research_job_id: job.id,
        provider: 'ai_web', enrichment_type: 'company', status: 'failed',
        estimated_cost: 1, safe_error_message: e.message, error_code: 'research_failed',
      }).catch(() => {});
      // Failed research must not delete existing intelligence.
      if (e.status !== 429) {
        await upsertCompanyIntelligence(base44, co.id, co.name, {
          organisation_id: org.id, status: 'failed',
          error_message: (e.message || '').slice(0, 500),
          generated_at: new Date().toISOString(),
        }).catch(() => {});
      }
    }
  }

  await completeJob(base44, job, counts);
  return Response.json({
    job_id: job.id, processed: counts.processed, researched: counts.successful,
    skipped: counts.skipped, failed: counts.failed, cost: counts.actualCost,
    truncated: counts.processed < companies.length,
  });
}