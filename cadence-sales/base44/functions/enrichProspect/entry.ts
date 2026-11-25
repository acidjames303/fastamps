import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { resolveProviders, getTargetRoles, getPreferredSeniority } from '../../shared/providerResolution.ts';
import { enrichProspectWaterfall } from '../../shared/enrichmentWaterfall.ts';
import { generateCorrelationId } from '../../shared/enrichmentDiagnostics.ts';
import { syncProspectToCampaign } from '../../shared/prospectCampaignSync.ts';

// Single-prospect enrichment — used by the per-row "Re-enrich company" button.
// Now uses the same field-level waterfall as the background enrichment sessions,
// ensuring Apollo personal email reveal, org memory, and generic email
// replacement all work consistently across both paths.
export default async function (req) {
  try {
    const { base44, org, profile } = await resolveTenant(req);
    assertProviderAccess(profile);

    const body = await req.json().catch(() => ({}));
    const { company_name, brief, icp, existing, permitted_countries, list_id, prospect_id, force_refresh } = body || {};
    if (!company_name) return Response.json({ error: 'company_name required' }, { status: 400 });

    // Load the list to get brief/icp/permitted_countries/ICP preferences if not passed from the client.
    let finalBrief = brief || '';
    let finalIcp = icp || '';
    let finalCountries = permitted_countries || ['GB'];
    let excludedTitles: string[] = [];
    let targetDepartments: string[] = [];
    if (list_id) {
      const list = await base44.asServiceRole.entities.ProspectList.get(list_id).catch(() => null);
      if (list && list.organisation_id !== org.id) return Response.json({ error: 'Prospect list not found.' }, { status: 404 });
      if (list) {
        finalBrief = finalBrief || list.brief || '';
        finalIcp = finalIcp || list.icp || '';
        finalCountries = list.permitted_countries || finalCountries;
        excludedTitles = list.excluded_titles || [];
        targetDepartments = list.target_departments || [];
      }
    }

    // Build the prospect object from the existing data passed by the client.
    const prospect = {
      id: prospect_id || '',
      company_name,
      domain: existing?.domain || '',
      website: existing?.website || '',
      industry: existing?.industry || '',
      employee_range: existing?.employee_range || '',
      location: existing?.location || '',
      country_code: existing?.country_code || '',
      geography_status: existing?.geography_status || 'unknown',
      geography_reason: existing?.geography_reason || '',
      landline: existing?.landline || '',
      contacts: existing?.contacts || [],
      target_role: existing?.target_role || '',
      fit_score: existing?.fit_score ?? 0,
      fit_reason: existing?.fit_reason || '',
      full_name: existing?.full_name || '',
      job_title: existing?.job_title || '',
      phone: existing?.phone || '',
      email: existing?.email || '',
      linkedin: existing?.linkedin || '',
    };

    const { order, credentials } = await resolveProviders(base44, org);
    const targetRoles = getTargetRoles(org);
    const preferredSeniority = getPreferredSeniority(org);
    const correlationId = generateCorrelationId();

    const result = await enrichProspectWaterfall(base44, org, {
      prospect,
      brief: finalBrief,
      icp: finalIcp,
      permitted_countries: finalCountries,
      requestedFields: ['personal_email', 'mobile', 'direct_dial', 'company_phone', 'decision_maker_role', 'company_intelligence'],
      providerOrder: order,
      credentials,
      targetRoles,
      preferredSeniority,
      excludedTitles,
      targetDepartments,
      correlationId,
      prospect_id: prospect_id || '',
      list_id: list_id || '',
      onlyMissing: true,
      forceRefresh: !!force_refresh,
      inferEmailPattern: true,
      // Unlimited Lusha: always chase mobiles for other known people on re-enrich.
      singleBestContact: false,
      widenMobileSearch: true,
    });

    const patch = { ...result.patch, enrichment_status: result.patch.enrichment_status || 'enriched' };

    // Mirror the result into the live campaign (company, contact, list
    // membership) so the new number is dialable without a separate push.
    let campaign_sync = null;
    try {
      campaign_sync = await syncProspectToCampaign(base44, org, { ...prospect, ...patch });
    } catch (e) {
      campaign_sync = { skipped: e.message };
    }

    return Response.json({ ...patch, campaign_sync });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}