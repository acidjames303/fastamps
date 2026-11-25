import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { upsertCompanyIntelligence, findReusableCompanyIntelligence, findActiveResearchLock, companyCanonicalKey } from '../../shared/companyIntelligence.ts';
import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { checkAllowance, recordUsage, isoPlusDays, COMPANY_FACT_EXPIRY_DAYS } from '../../shared/costControl.ts';

// Enriches contacts missing company size, turnover estimate, or location.
// Invoked by the nightly "Enrich Company Data Overnight" workflow so the
// dashboard and dialer show complete company data. Bounded batch keeps
// each run within execution limits; remaining contacts build on later runs.
// Authenticated + org-scoped: only the caller's organisation's contacts are processed.
export default async function(req) {
  try {
    const { base44, user, org, profile } = await resolveTenant(req);
    assertProviderAccess(profile);
    const limit = 8;
    const all = await base44.asServiceRole.entities.Contact.filter({ organisation_id: org.id }, '-created_date', 300);
    const pending = all.filter((c) => {
      const missingSize = !c.employee_range || c.employee_range === "size n/a";
      const missingTurnover = !c.turnover_estimate;
      const missingLocation = !c.location || c.location === "—";
      return missingSize || missingTurnover || missingLocation;
    }).slice(0, limit);

    let enriched = 0;
    const failed = [];
    for (const contact of pending) {
      try {
        const company = contact.company_id
          ? await base44.asServiceRole.entities.Company.get(contact.company_id).catch(() => null)
          : null;

        // Reuse organisation-scoped company intelligence before spending.
        const cached = company
          ? await findReusableCompanyIntelligence(base44, org.id, company)
          : null;
        if (cached) {
          const cachedPatch = {};
          if (cached.turnover_estimate && !contact.turnover_estimate) cachedPatch.turnover_estimate = cached.turnover_estimate;
          if (company?.employee_range && (!contact.employee_range || contact.employee_range === 'size n/a')) cachedPatch.employee_range = company.employee_range;
          if (company?.location && (!contact.location || contact.location === '—')) cachedPatch.location = company.location;
          if (Object.keys(cachedPatch).length) {
            await base44.asServiceRole.entities.Contact.update(contact.id, cachedPatch);
            enriched++;
          }
          continue;
        }

        if (company && await findActiveResearchLock(base44, org.id, company)) continue;

        await checkAllowance(base44, org, 'company_research', 1);
        if (company) {
          await upsertCompanyIntelligence(base44, company.id, company.name, {
            organisation_id: org.id,
            canonical_key: companyCanonicalKey(company),
            status: 'researching',
            generated_at: new Date().toISOString(),
            research_lock_expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
          });
        }
        const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are a business research assistant. Research the company "${contact.company || "unknown"}" (website: ${contact.website || "unknown"}, industry: ${contact.industry || "unknown"}).
Return factual, current company data as JSON:
- "employee_range": an employee-count band, e.g. "1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10000+". Use "Unknown" only if genuinely unfindable.
- "turnover_estimate": estimated annual turnover/revenue in GBP, as a short band string e.g. "£1M-£5M", "£10M-£50M", "£100M-£500M". Use "Unknown" only if genuinely unfindable.
- "location": the company's headquarters city and country, e.g. "London, United Kingdom". Use "Unknown" only if genuinely unfindable.

Be concise. No explanation, just the JSON.`,
          add_context_from_internet: true,
          model: "gemini_3_flash",
          response_json_schema: {
            type: "object",
            properties: {
              employee_range: { type: "string" },
              turnover_estimate: { type: "string" },
              location: { type: "string" },
            },
          },
        });
        const patch = {};
        if (res.employee_range && res.employee_range !== "Unknown" && (!contact.employee_range || contact.employee_range === "size n/a")) {
          patch.employee_range = res.employee_range;
        }
        if (res.turnover_estimate && res.turnover_estimate !== "Unknown" && !contact.turnover_estimate) {
          patch.turnover_estimate = res.turnover_estimate;
        }
        if (res.location && res.location !== "Unknown" && (!contact.location || contact.location === "—")) {
          patch.location = res.location;
        }
        if (Object.keys(patch).length) {
          await base44.asServiceRole.entities.Contact.update(contact.id, patch);
          enriched++;
        }
        if (company) {
          const companyPatch = {};
          if (patch.location && !company.location) companyPatch.location = patch.location;
          if (patch.employee_range && !company.employee_range) companyPatch.employee_range = patch.employee_range;
          if (Object.keys(companyPatch).length) {
            await base44.asServiceRole.entities.Company.update(company.id, companyPatch).catch(() => {});
          }
          await upsertCompanyIntelligence(base44, company.id, company.name, {
            turnover_estimate: res.turnover_estimate !== 'Unknown' ? (res.turnover_estimate || '') : '',
            source: 'ai_web',
            organisation_id: org.id,
            status: 'current',
            generated_at: new Date().toISOString(),
            expires_at: isoPlusDays(COMPANY_FACT_EXPIRY_DAYS),
            confidence: 75,
            intelligence_version: 1,
            model_provider: 'google',
            model_name: 'gemini_3_flash',
            estimated_cost: 1,
            error_message: '',
            research_lock_expires_at: null,
          });
        }
        await recordUsage(base44, {
          organisation_id: org.id,
          user_id: user.id,
          event_type: 'company_research',
          provider: 'ai_web',
          quantity: 1,
          estimated_cost: 1,
          actual_cost: 1,
          related_record_id: contact.company_id || contact.id,
          idempotency_key: company
            ? `company_research:${org.id}:${companyCanonicalKey(company)}:${Math.floor(Date.now() / (COMPANY_FACT_EXPIRY_DAYS * 86400000))}`
            : `company_research:${org.id}:contact:${contact.id}`,
          source_function: 'enrichCompanyDataBatch',
        });
      } catch (e) {
        failed.push({ id: contact.id, error: e.message });
        if (e?.status === 429) break;
      }
    }
    const orgs = new Set(all.map((c) => c.organisation_id).filter(Boolean));
    return Response.json({ enriched, pending_before: pending.length, scanned: all.length, orgs_processed: orgs.size, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}