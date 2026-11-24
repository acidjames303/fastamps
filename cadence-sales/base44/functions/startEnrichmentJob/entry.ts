import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { resolveProviders, getTargetRoles, getPreferredSeniority, PROVIDER_CAPABILITIES } from '../../shared/providerResolution.ts';
import { getMissingFields } from '../../shared/enrichmentWaterfall.ts';
import { generateCorrelationId } from '../../shared/enrichmentDiagnostics.ts';

// Starts a background enrichment session. Creates the EnrichmentSession record
// and returns the session ID IMMEDIATELY — it does NOT process any items inline.
// Processing is handled by:
//   1. The frontend's EnrichmentProgressIndicator (polls pollEnrichmentJob every 3s)
//   2. The background worker processEnrichmentBatch (runs every 5 min as backup)
//
// This ensures the dialog closes within seconds, not after a 25s timeout.
//
// SECURITY: organisation_id is derived from the authenticated user, never from
// the client. Only connected providers belonging to the org are used.
export default async function (req) {
  try {
    const { base44, user, org, profile } = await resolveTenant(req);
    assertProviderAccess(profile);
    const body = await req.json().catch(() => ({}));
    const {
      prospect_list_id, prospect_ids, requested_fields,
      only_missing_fields = true, check_newer_info = false,
      force_refresh = false,
      email_only = false,
      single_best_contact = false,
      widen_mobile_search = false,
      search_depth = 'standard',
      find_stronger_decision_maker = false,
      infer_email_pattern = true,
      provider_free_mode = false,
      strict_zero_credit = false,
      manual_pattern_email = '',
      manual_pattern_type = '',
      selected_providers = null,
      idempotency_key = null,
    } = body || {};

    if (!prospect_list_id) return Response.json({ error: 'prospect_list_id required' }, { status: 400 });
    if (!prospect_ids || !prospect_ids.length) return Response.json({ error: 'Select at least one prospect to enrich.' }, { status: 400 });
    if (!requested_fields || !requested_fields.length) return Response.json({ error: 'Select at least one field to enrich.' }, { status: 400 });

    // Idempotency: if the same idempotency_key was used to create a session
    // recently, return that session instead of creating a duplicate.
    if (idempotency_key) {
      const existing = await base44.asServiceRole.entities.EnrichmentSession.filter(
        { correlation_id: idempotency_key, organisation_id: org.id }, '-created_date', 1,
      ).catch(() => []);
      if (existing && existing.length > 0) {
        const dup = existing[0];
        return Response.json({
          session_id: dup.id,
          status: dup.status,
          total_records: dup.total_records,
          cached_count: dup.cached_count,
          completed_count: dup.completed_count,
          partial_count: dup.partial_count,
          failed_count: dup.failed_count,
          queued_count: dup.queued_count,
          message: 'Enrichment session already started — continuing in the background.',
        });
      }
    }

    const allowedSearchDepths = ['standard', 'expanded', 'exhaustive'];
    const effectiveSearchDepth = allowedSearchDepths.includes(search_depth) ? search_depth : 'standard';
    const effectiveEmailOnly = email_only === true || requested_fields.every((field: string) =>
      ['personal_email', 'alternative_email', 'decision_maker_role'].includes(field)
    );
    const effectiveSingleBest = effectiveSearchDepth === 'standard' || single_best_contact === true;
    const effectiveForceRefresh = force_refresh === true || find_stronger_decision_maker === true;

    // Resolve connected providers in priority order.
    const { order: resolvedOrder, credentials, connected } = await resolveProviders(base44, org);
    if (!provider_free_mode && !strict_zero_credit && !resolvedOrder.length) {
      return Response.json({
        error: 'No enrichment providers connected. Connect a provider or choose No provider credits mode.',
      }, { status: 400 });
    }
    // Provider-free mode deliberately snapshots an empty order, guaranteeing
    // the worker cannot call Apollo, Lusha or FullEnrich for this session.
    const order = (provider_free_mode || strict_zero_credit)
      ? []
      : (selected_providers && Array.isArray(selected_providers) && selected_providers.length)
        ? resolvedOrder.filter((p) => selected_providers.includes(p))
        : resolvedOrder;
    if (!provider_free_mode && !strict_zero_credit && !order.length) {
      return Response.json({
        error: 'None of the selected providers are connected. Select a connected provider or choose No provider credits mode.',
      }, { status: 400 });
    }
    // A provider can only reveal fields it supports. Requesting fields no
    // selected provider can serve would create a session that does nothing.
    if (!provider_free_mode && !strict_zero_credit) {
      const supported = new Set<string>();
      for (const provider of order) {
        for (const field of PROVIDER_CAPABILITIES[provider] || []) supported.add(field);
      }
      if (!requested_fields.some((field: string) => supported.has(field))) {
        return Response.json({
          error: 'No provider lookup is required for the selected fields.',
        }, { status: 400 });
      }
    }

    const correlationId = idempotency_key || generateCorrelationId();
    const now = new Date().toISOString();

    // Load prospect list for brief and geography.
    const list = await base44.asServiceRole.entities.ProspectList.get(prospect_list_id).catch(() => null);
    if (!list || list.organisation_id !== org.id) {
      return Response.json({ error: 'Prospect list not found.' }, { status: 404 });
    }

    // Load all selected prospects (org-scoped filter for security).
    const allProspects = await base44.asServiceRole.entities.Prospect.filter(
      { list_id: prospect_list_id, organisation_id: org.id }, '-created_date', 500,
    ).catch(() => []);

    const selectedProspects = allProspects.filter((p: any) => prospect_ids.includes(p.id));

    if (!selectedProspects.length) {
      return Response.json({ error: 'No matching prospects found for this list.' }, { status: 404 });
    }

    // Optional user-supplied pattern evidence for a single company. Store the
    // mail domain separately from the website domain, then let deterministic
    // inference populate named contacts without any external request.
    if (manual_pattern_email && selectedProspects.length === 1) {
      const seed = String(manual_pattern_email).toLowerCase().trim();
      const allowedPatterns = ['firstname.lastname', 'firstname', 'firstinitiallastname', 'firstnamelastinitial', 'firstnamelastname', 'lastname.firstname', 'lastnamefirstname'];
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(seed)) {
        return Response.json({ error: 'Enter a valid known company email.' }, { status: 400 });
      }
      if (!allowedPatterns.includes(manual_pattern_type)) {
        return Response.json({ error: 'Select the known company email format.' }, { status: 400 });
      }
      const emailDomain = seed.split('@')[1];
      await base44.asServiceRole.entities.Prospect.update(selectedProspects[0].id, {
        email_domain: emailDomain,
        email_pattern: manual_pattern_type,
        email_pattern_source: seed,
      });
      selectedProspects[0].email_domain = emailDomain;
      selectedProspects[0].email_pattern = manual_pattern_type;
      selectedProspects[0].email_pattern_source = seed;
    }

    // Build session items with cache analysis.
    const items = selectedProspects.map((p: any) => {
      const missing = getMissingFields(p, requested_fields);
      const cached = requested_fields.filter((f: any) => !missing.includes(f));
      return {
        prospect_id: p.id,
        company_name: p.company_name,
        status: (!effectiveForceRefresh && cached.length === requested_fields.length) ? 'cached' : 'pending',
        fields_found: cached,
        fields_missing: missing,
        fields_cached: cached,
        provider_used: '',
        error: '',
        conflicts: [],
      };
    });

    const cachedCount = items.filter((i: any) => i.status === 'cached').length;
    const toProcess = items.filter((i: any) => i.status === 'pending').length;

    // Create the session — return IMMEDIATELY after this.
    // Processing is handled by pollEnrichmentJob (frontend) and
    // processEnrichmentBatch (background worker).
    const session = await base44.asServiceRole.entities.EnrichmentSession.create({
      organisation_id: org.id,
      created_by_user_id: user.id,
      session_name: list?.name || 'Enrichment session',
      prospect_list_id,
      status: toProcess > 0 ? 'processing' : 'completed',
      requested_fields: requested_fields,
      only_missing_fields: only_missing_fields,
      check_newer_info: check_newer_info,
      force_refresh: effectiveForceRefresh,
      email_only: effectiveEmailOnly,
      single_best_contact: effectiveSingleBest,
      widen_mobile_search: widen_mobile_search === true,
      search_depth: effectiveSearchDepth,
      find_stronger_decision_maker: !!find_stronger_decision_maker,
      infer_email_pattern: infer_email_pattern !== false,
      provider_free_mode: !!provider_free_mode || !!strict_zero_credit,
      strict_zero_credit: !!strict_zero_credit,
      // Large batches normally skip AI research, but an explicit
      // "discover additional contacts" run must still be able to find people.
      skip_ai_research: strict_zero_credit
        ? true
        : (provider_free_mode
          ? false
          : (!!effectiveEmailOnly || (selectedProspects.length > 10 && !find_stronger_decision_maker))),
      provider_order_snapshot: order,
      prospect_ids: prospect_ids,
      items,
      total_records: selectedProspects.length,
      queued_count: toProcess,
      processing_count: 0,
      completed_count: 0,
      partial_count: 0,
      failed_count: 0,
      cached_count: cachedCount,
      smart_actions_estimated: strict_zero_credit ? 0 : (provider_free_mode ? toProcess : (effectiveEmailOnly ? 0 : toProcess)),
      smart_actions_consumed: 0,
      external_provider_requests: 0,
      provider_calls_made: 0,
      pattern_inferred_count: 0,
      spending_paused: false,
      started_at: now,
      last_activity_at: now,
      completed_at: toProcess === 0 ? now : null,
      error_summary: '',
      correlation_id: correlationId,
    });

    // If everything was cached, we're done.
    if (toProcess === 0) {
      return Response.json({
        session_id: session.id,
        status: 'completed',
        total_records: selectedProspects.length,
        cached_count: cachedCount,
        completed_count: 0,
        partial_count: 0,
        failed_count: 0,
        queued_count: 0,
        message: `All ${cachedCount} prospects already had the requested fields. No provider requests needed.`,
      });
    }

    // Return immediately — the session is now "processing" and will be
    // picked up by the frontend's EnrichmentProgressIndicator (polls every
    // 3s) and the background worker processEnrichmentBatch (every 5 min).
    return Response.json({
      session_id: session.id,
      status: 'processing',
      total_records: selectedProspects.length,
      cached_count: cachedCount,
      completed_count: 0,
      partial_count: 0,
      failed_count: 0,
      queued_count: toProcess,
      provider_order: order,
      connected,
      message: `Enrichment session created. ${toProcess} records queued for processing in the background.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}