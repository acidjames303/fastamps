import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { enrichCompany } from '../../shared/prospectEnrichment.ts';
import { getOrgCredentials } from '../../shared/providerCredentials.ts';

// Server-side batch enrichment for a prospect list. Processes prospects that are
// still pending or have retryable failures, enriching each via the shared
// enrichCompany logic and writing results directly to the Prospect records.
// Respects the list's permitted_countries — out-of-scope companies are never
// sent to paid people-enrichment providers. Runs up to ~4.5 minutes.
export default async function (req) {
  const { base44, org, profile } = await resolveTenant(req);
  assertProviderAccess(profile);
  const body = await req.json().catch(() => ({}));
  const { list_id, limit } = body || {};
  if (!list_id) return Response.json({ error: 'list_id required' }, { status: 400 });

  // Service-role reads must still be explicitly tenant-bound.
  const list = await base44.asServiceRole.entities.ProspectList.get(list_id).catch(() => null);
  if (!list || list.organisation_id !== org.id) {
    return Response.json({ error: 'Prospect list not found in your organisation.' }, { status: 404 });
  }
  let brief = list.brief || body.brief || '';
  if (list.icp) brief = `${brief}\n\nIdeal customer profile:\n${list.icp}`;

  const permitted_countries = list.permitted_countries || [];

  // Process prospects that are pending, not_found (past cooldown), or have
  // retryable failures. Genuine not-found results within the 7-day cooldown
  // are skipped to avoid wasting credits.
  const statuses = ['pending', 'not_found', 'failed', 'provider_unavailable'];
  const prospects = await base44.asServiceRole.entities.Prospect.filter(
    { organisation_id: org.id, list_id }, 'created_date', limit || 50
  ).catch(() => []);

  const eligible = prospects.filter((p) => {
    if (!statuses.includes(p.enrichment_status)) return false;
    if (p.enrichment_status === 'not_found' && p.retry_cooldown_expires_at) {
      return new Date(p.retry_cooldown_expires_at) < new Date();
    }
    return true;
  });

  const creds = await getOrgCredentials(base44, org);
  const startedAt = Date.now();
  const TIME_BUDGET_MS = 270000;
  const CHUNK = 6;
  let enriched = 0;
  let failed = 0;
  let outOfScope = 0;
  let done = 0;

  for (let i = 0; i < eligible.length; i += CHUNK) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    const slice = eligible.slice(i, i + CHUNK);
    const outcomes = await Promise.all(slice.map(async (p) => {
      try {
        const out = await enrichCompany(base44, creds, {
          company_name: p.company_name, brief, permitted_countries,
          list_id, prospect_id: p.id, org,
          existing: {
            company_name: p.company_name,
            domain: p.domain || '',
            website: p.website || '',
            industry: p.industry || '',
            employee_range: p.employee_range || '',
            location: p.location || '',
            country_code: p.country_code || '',
            geography_status: p.geography_status || 'unknown',
            geography_reason: p.geography_reason || '',
            landline: p.landline || '',
            contacts: p.contacts || [],
            full_name: p.full_name || '',
            job_title: p.job_title || '',
            email: p.email || '',
            phone: p.phone || '',
            linkedin: p.linkedin || '',
            source: p.source || '',
            retry_cooldown_expires_at: p.retry_cooldown_expires_at || null,
            fit_score: p.fit_score ?? 0,
            fit_reason: p.fit_reason || '',
            target_role: p.target_role || '',
          },
        });
        if (out && !out.error) {
          const patch = { ...out };
          delete patch.error;
          await base44.asServiceRole.entities.Prospect.update(p.id, patch);
          if (out.enrichment_status === 'out_of_scope') outOfScope++;
          return { ok: true, company: p.company_name, status: out.enrichment_status, source: out.source, phone: out.phone, geography: out.geography_status };
        }
        return { ok: false, company: p.company_name };
      } catch (error) {
        await base44.asServiceRole.entities.Prospect.update(p.id, {
          enrichment_status: 'failed', provider_error: error.message || 'provider_error', last_attempted_at: new Date().toISOString(),
        }).catch(() => {});
        return { ok: false, company: p.company_name, reason: error.message || 'provider_error' };
      }
    }));
    for (const o of outcomes) { if (o.ok) enriched++; else failed++; done++; }
  }

  return Response.json({
    processed: eligible.length,
    enriched,
    failed,
    out_of_scope: outOfScope,
    truncated: done < eligible.length,
    skipped_cooldown: prospects.length - eligible.length,
  });
}