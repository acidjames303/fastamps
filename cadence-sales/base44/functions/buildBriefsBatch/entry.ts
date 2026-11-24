import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { upsertCompanyIntelligence, findReusableCompanyIntelligence, attachCachedIntelligence, findActiveResearchLock, companyCanonicalKey, isCurrentIntelligence } from '../../shared/companyIntelligence.ts';
import { checkAllowance, recordUsage, COMPANY_FACT_EXPIRY_DAYS } from '../../shared/costControl.ts';
import { CAPABILITIES } from '../../shared/capabilities.ts';
import { requireCapability } from '../../shared/authorization.ts';

// Researches COMPANIES once (not contacts) and stores reusable intelligence in
// CompanyIntelligence. One LLM request per company; the result is shared by
// every contact at that company. Legacy Contact.ai_brief values are preserved
// as a fallback and never overwritten here.
//
// Runs as a service role iterating ACTIVE organisations resolved server-side
// (no app-user session required), so it works correctly from a scheduled
// workflow. organisation_id is never trusted from a request body — it comes
// from the Organisation record itself. Bounded batch per run.
const LIMIT = 4;
const STALE_DAYS = COMPANY_FACT_EXPIRY_DAYS;

function isoPlusDays(days) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // Background AI spend runs on the service identity, but only for a caller whose
  // authoritative membership still grants the provider capability.
  try {
    await requireCapability(base44, user, CAPABILITIES.providers);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status || 403 });
  }
  const summary = { orgs: 0, scanned: 0, researched: 0, failed: [], skipped_current: 0 };

  try {
    const orgs = await base44.asServiceRole.entities.Organisation.filter({ status: 'active' });
    summary.orgs = orgs.length;

    for (const org of orgs) {
      // Scheduled AI is opt-in. New organisations never consume background
      // Smart Actions until an organisation administrator enables it.
      if (org.settings?.automatic_company_research !== true) continue;

      const companies = await base44.asServiceRole.entities.Company.filter(
        { organisation_id: org.id },
        '-created_date',
        300
      );
      const ciAll = await base44.asServiceRole.entities.CompanyIntelligence.filter(
        { organisation_id: org.id }
      );
      const ciByCompany = new Map(ciAll.map((c) => [c.company_id, c]));

      // A company needs research if it has no intelligence, or its intelligence
      // is stale/failed/pending. 'current' and 'researching' are skipped — the
      // latter prevents concurrent duplicate research.
      const pending = companies.filter((co) => {
        const ci = ciByCompany.get(co.id);
        if (!ci) return true;
        if (isCurrentIntelligence(ci) || (ci.status === 'researching' && ci.research_lock_expires_at && new Date(ci.research_lock_expires_at) > new Date())) {
          summary.skipped_current++;
          return false;
        }
        return true;
      }).slice(0, LIMIT);

      summary.scanned += companies.length;

      for (const co of pending) {
        const existing = ciByCompany.get(co.id);
        try {
          const cached = await findReusableCompanyIntelligence(base44, org.id, co);
          if (cached) {
            await attachCachedIntelligence(base44, org.id, co, cached);
            summary.skipped_current++;
            continue;
          }
          const activeLock = await findActiveResearchLock(base44, org.id, co);
          if (activeLock) {
            summary.skipped_current++;
            continue;
          }

          await checkAllowance(base44, org, 'company_research', 1);

          // Canonical lock stops another list/batch researching this company.
          await upsertCompanyIntelligence(base44, co.id, co.name, {
            organisation_id: org.id,
            canonical_key: companyCanonicalKey(co),
            status: 'researching',
            generated_at: new Date().toISOString(),
            research_lock_expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
          });

          const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `You are a UK B2B sales research assistant. Research the company "${co.name}" (domain: ${co.domain || 'unknown'}, website: ${co.website || 'unknown'}, industry: ${co.industry || 'unknown'}).
Return factual, current JSON.
CRITICAL: Every field value must be PLAIN TEXT ONLY. Do NOT include source URLs, markdown links, bracketed citations, or references like [Source Name](https://...) anywhere in any field. If you found info from a source, just state the fact — never cite the URL.

- "summary": 1-2 plain sentences describing the company and its core business. No URLs, no markdown.
- "what_they_do": array of 3-6 strings, each formatted as "Capability — short description" (using an em dash). Example: "Managed IT Support — 24/7 monitoring and helpdesk for SMEs". No URLs, no markdown.
- "who_they_target": array of 3-6 strings, each formatted as "Segment — short reason" (using an em dash). Example: "SMEs — typically lack in-house IT teams". No URLs, no markdown.
- "turnover_estimate": estimated annual turnover/revenue in GBP as a short band (e.g. "£1M-£5M"). "Unknown" only if unfindable.
- "tech_stack": array of detected technologies/platforms (strings), empty if none.
- "news": one short sentence on a recent development, or "".
- "buyer_signals": one short sentence on purchase-intent triggers, or "".
- "target_roles": array of 2-5 senior job titles to target.
- "icp_fit_score": integer 0-100.
- "icp_fit_reason": one short sentence.
- "employee_range": headcount band (one of: "1-10","11-50","51-200","201-500","501-1000","1000+"). "Unknown" only if unfindable.
- "location": HQ city, country. "Unknown" only if unfindable.
- "industry": primary industry. "Unknown" only if unfindable.
Be specific and factual. Never invent phone numbers or people. Never include URLs or markdown in any field value.`,
            add_context_from_internet: true,
            model: 'gemini_3_flash',
            response_json_schema: {
              type: 'object',
              properties: {
                summary: { type: 'string' },
                what_they_do: { type: 'array', items: { type: 'string' } },
                who_they_target: { type: 'array', items: { type: 'string' } },
                turnover_estimate: { type: 'string' },
                tech_stack: { type: 'array', items: { type: 'string' } },
                news: { type: 'string' },
                buyer_signals: { type: 'string' },
                target_roles: { type: 'array', items: { type: 'string' } },
                icp_fit_score: { type: 'number' },
                icp_fit_reason: { type: 'string' },
                employee_range: { type: 'string' },
                location: { type: 'string' },
                industry: { type: 'string' },
              },
            },
          });

          const aiSummary = JSON.stringify({
            summary: res.summary,
            what_they_do: res.what_they_do || [],
            who_they_target: res.who_they_target || [],
          });

          await upsertCompanyIntelligence(base44, co.id, co.name, {
            organisation_id: org.id,
            ai_summary: aiSummary,
            turnover_estimate: res.turnover_estimate && res.turnover_estimate !== 'Unknown' ? res.turnover_estimate : '',
            tech_stack: res.tech_stack || [],
            news: res.news || '',
            buyer_signals: res.buyer_signals || '',
            target_roles: res.target_roles || [],
            icp_fit_score: res.icp_fit_score ?? 0,
            icp_fit_reason: res.icp_fit_reason || '',
            source: 'ai_web',
            status: 'current',
            generated_at: new Date().toISOString(),
            expires_at: isoPlusDays(STALE_DAYS),
            confidence: 80,
            intelligence_version: (existing?.intelligence_version || 0) + 1,
            model_provider: 'google',
            model_name: 'gemini_3_flash',
            estimated_cost: 1,
            error_message: '',
            research_lock_expires_at: null,
          });

          // Backfill the Company record with discovered firmographics (folds in
          // the old enrichCompanyDataBatch concern — one research pass).
          const patch = {};
          if (res.employee_range && res.employee_range !== 'Unknown' && !co.employee_range) patch.employee_range = res.employee_range;
          if (res.location && res.location !== 'Unknown' && !co.location) patch.location = res.location;
          if (res.industry && res.industry !== 'Unknown' && !co.industry) patch.industry = res.industry;
          if (Object.keys(patch).length) {
            await base44.asServiceRole.entities.Company.update(co.id, patch).catch(() => {});
          }

          await recordUsage(base44, {
            organisation_id: org.id,
            user_id: null,
            event_type: 'company_research',
            provider: 'ai_web',
            quantity: 1,
            estimated_cost: 1,
            actual_cost: 1,
            related_record_id: co.id,
            idempotency_key: `company_research:${org.id}:${companyCanonicalKey(co)}:${Math.floor(Date.now() / (STALE_DAYS * 86400000))}`,
            source_function: 'buildBriefsBatch',
          });
          summary.researched++;
        } catch (e) {
          if (e?.status === 429) {
            summary.failed.push({ company: co.name, error: 'Smart Actions allowance reached; background research paused.' });
            break;
          }
          await upsertCompanyIntelligence(base44, co.id, co.name, {
            organisation_id: org.id,
            status: 'failed',
            error_message: (e && e.message || String(e)).slice(0, 500),
            generated_at: new Date().toISOString(),
          }).catch(() => {});
          summary.failed.push({ company: co.name, error: e && e.message });
        }
      }
    }

    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message, ...summary }, { status: 500 });
  }
}