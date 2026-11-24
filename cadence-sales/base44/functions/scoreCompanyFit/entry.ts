import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { assertListOwned } from '../../shared/ownership.ts';
import { deterministicScore, aiInterpretReason } from '../../shared/fitScoring.ts';
import { checkAllowance, recordUsage } from '../../shared/costControl.ts';
import { createJob, startJob, completeJob } from '../../shared/researchJob.ts';

// Target-List-specific fit scoring. Deterministic rules first (industry,
// geography, size, roles, signals); AI only refines the reason for borderline
// cases. A hard exclusion is never overridden by AI.
//
// `exclusion_reason` may be passed per-company to enforce a hard exclusion.
export default async function (req) {
  const { base44, user, org, profile } = await resolveTenant(req);
  assertProviderAccess(profile);
  const body = await req.json().catch(() => ({}));
  const { target_list_id, company_ids, exclusions } = body || {};
  const list = await assertListOwned(base44, org, target_list_id);

  const members = await base44.asServiceRole.entities.TargetListMember.filter(
    { target_list_id, organisation_id: org.id }, '-created_date', 500
  );
  let companyIds = [...new Set(members.map((m) => m.company_id).filter(Boolean))];
  if (company_ids && company_ids.length) {
    const allowed = new Set(company_ids);
    companyIds = companyIds.filter((id) => allowed.has(id));
  }

  const job = await createJob(base44, {
    organisation_id: org.id, target_list_id, requested_by_user_id: user.id,
    job_type: 'fit_scoring', total_records: companyIds.length, estimated_cost: 0,
  });
  await startJob(base44, job);

  const counts = { processed: 0, successful: 0, failed: 0, skipped: 0, actualCost: 0, errorSummary: '' };
  const exclMap = new Map((exclusions || []).map((e) => [e.company_id, e.reason]));

  for (const id of companyIds) {
    counts.processed++;
    try {
      const co = await base44.asServiceRole.entities.Company.get(id).catch(() => null);
      if (!co) { counts.skipped++; continue; }
      const intelList = await base44.asServiceRole.entities.CompanyIntelligence.filter(
        { company_id: id, organisation_id: org.id }
      );
      const intel = intelList && intelList[0];

      const exclusionReason = exclMap.get(id) || '';
      const det = deterministicScore(co, intel, list, exclusionReason);

      // AI refines the reason only for borderline non-excluded companies.
      let reason = det.reason;
      let usedAI = false;
      if (det.band !== 'excluded' && intel && (det.band === 'medium' || det.band === 'low')) {
        try {
          await checkAllowance(base44, org, 'fit_scoring', 1);
          reason = await aiInterpretReason(base44, co, intel, list, det);
          usedAI = true;
        } catch {}
      }

      const existing = await base44.asServiceRole.entities.TargetListCompanyFit.filter(
        { target_list_id, company_id: id, organisation_id: org.id }
      );
      const fields = {
        fit_score: det.score, fit_band: det.band, fit_reason: reason,
        positive_matches: det.positives, negative_matches: det.negatives,
        exclusion_reason: det.exclusion_reason, scoring_version: (existing[0]?.scoring_version || 0) + 1,
        scored_at: new Date().toISOString(),
      };
      if (existing[0]) {
        // Preserve an existing review decision unless the company was newly excluded.
        await base44.asServiceRole.entities.TargetListCompanyFit.update(existing[0].id, fields);
      } else {
        await base44.asServiceRole.entities.TargetListCompanyFit.create({
          ...fields, organisation_id: org.id, target_list_id, company_id: id,
          review_status: det.band === 'excluded' ? 'rejected' : 'pending',
        });
      }
      if (usedAI) {
        counts.actualCost++;
        await recordUsage(base44, {
          organisation_id: org.id, user_id: user.id, target_list_id,
          event_type: 'fit_scoring', provider: 'ai_web', quantity: 1,
          estimated_cost: 1, actual_cost: 1, related_record_id: id,
        });
      }
      counts.successful++;
    } catch (e) {
      counts.failed++;
      counts.errorSummary += `${id}: ${e.message}; `;
    }
  }

  await completeJob(base44, job, counts);
  return Response.json({
    job_id: job.id, processed: counts.processed, scored: counts.successful,
    failed: counts.failed, ai_used: counts.actualCost,
  });
}