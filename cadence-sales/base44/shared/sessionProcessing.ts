// Shared enrichment session processing logic.
// Extracted from pollEnrichmentJob and processEnrichmentBatch to eliminate
// code duplication and ensure consistent item processing, count tracking,
// and session finalisation across both the frontend-poll and background-worker paths.

import { resolveProviders, getTargetRoles, getPreferredSeniority, extractTargetRolesFromText } from './providerResolution.ts';
import { enrichProspectWaterfall } from './enrichmentWaterfall.ts';
import { getSpendingControls, checkProviderCallAllowed } from './spendingControls.ts';
import { syncProspectToCampaign } from './prospectCampaignSync.ts';

export interface SessionProcessResult {
  items: any[];
  processed: number;
  completedCount: number;
  partialCount: number;
  failedCount: number;
  stillPending: number;
  finalStatus: string;
  providerCallsMade: number;
  smartActionsConsumed: number;
  externalProviderRequests: number;
  patternInferredCount: number;
  spendingPaused: boolean;
  spendingPauseReason: string;
  authorisationRevoked: boolean;
  authorisationRevokeReason: string;
  message: string;
}

// Processes a batch of pending items from an enrichment session.
// Both pollEnrichmentJob and processEnrichmentBatch call this with their
// own batch size and timeout. Handles prospect lookup, waterfall execution,
// patch application, spending control checks, and count recomputation.
//
// SECURITY: organisation_id is derived from the session record (which was
// created with a server-validated org). Only org-connected providers are used.
export async function processSessionBatch(
  base44: any,
  session: any,
  batch: any[],
  allItems: any[],
  opts: {
    batchSize: number;
    timeoutMs: number;
    isBackgroundWorker: boolean;
    // Revalidates the originating user's authoritative membership immediately
    // before each external enrichment call. Throwing stops the batch.
    authoriseCall?: () => Promise<any>;
  },
): Promise<SessionProcessResult> {
  const org = await base44.asServiceRole.entities.Organisation.get(session.organisation_id).catch(() => null);
  if (!org) {
    // Mark all batch items as failed.
    for (const item of batch) {
      item.status = 'failed';
      item.error = 'Organisation not found';
    }
    return finalise(allItems, batch.length, session);
  }

  const { order: resolvedOrder, credentials } = await resolveProviders(base44, org);
  // Free-inference and zero-credit sessions snapshot no providers. An empty
  // snapshot is a deliberate "no providers", never a fall back to everything
  // connected — including from the background worker.
  const order = (session.provider_free_mode || session.strict_zero_credit)
    ? []
    : (session.provider_order_snapshot && session.provider_order_snapshot.length)
      ? resolvedOrder.filter((p) => session.provider_order_snapshot.includes(p))
      : [];

  const list = await base44.asServiceRole.entities.ProspectList.get(session.prospect_list_id).catch(() => null);
  if (!list || list.organisation_id !== org.id || org.status !== 'active') throw Object.assign(new Error('Session list or organisation is no longer active.'), { status: 403 });
  const brief = list?.brief || '';
  const icp = list?.icp || '';
  const permitted_countries = list?.permitted_countries || ['GB'];
  const rolesFromSavedText = extractTargetRolesFromText(`${brief}\n${icp}`);
  const targetRoles = (list?.target_titles && list.target_titles.length)
    ? list.target_titles
    : (rolesFromSavedText.length ? rolesFromSavedText : getTargetRoles(org));
  const preferredSeniority = (list?.preferred_seniority && list.preferred_seniority.length) ? list.preferred_seniority : getPreferredSeniority(org);
  const excludedTitles = list?.excluded_titles || [];
  const targetDepartments = list?.target_departments || [];

  const controls = getSpendingControls(org);
  // Strict zero-credit sessions must always report zero external consumption.
  // This also prevents a stale/miscounted value from being carried forward.
  let providerCalls = session.strict_zero_credit ? 0 : (session.provider_calls_made || 0);
  let smartActions = session.strict_zero_credit ? 0 : (session.smart_actions_consumed || 0);
  let externalRequests = session.strict_zero_credit ? 0 : (session.external_provider_requests || 0);
  let patternInferred = session.pattern_inferred_count || 0;
  let spendingPaused = false;
  let spendingPauseReason = '';
  let authorisationRevoked = false;
  let authorisationRevokeReason = '';

  for (const item of batch) {
    // Authorisation is re-read before every enrichment call — a revoked job makes
    // no further provider or AI call, and unfinished work stays pending.
    if (opts.authoriseCall) {
      try {
        await opts.authoriseCall();
      } catch (e: any) {
        // A deliberate access decision revokes the job; a throttled or transient
        // read failure just defers the item to the next run.
        if (e?.securityDenial) {
          authorisationRevoked = true;
          authorisationRevokeReason = e?.message || 'authorisation_revoked';
        }
        item.status = 'pending';
        break;
      }
    }
    const prospect = await base44.asServiceRole.entities.Prospect.get(item.prospect_id).catch(() => null);
    if (!prospect || prospect.organisation_id !== org.id || prospect.list_id !== session.prospect_list_id) {
      item.status = 'failed';
      item.error = 'Prospect not found on this organisation and list';
      continue;
    }

    try {
      const waterfallPromise = enrichProspectWaterfall(base44, org, {
        prospect,
        brief,
        icp,
        permitted_countries,
        requestedFields: session.requested_fields,
        providerOrder: order,
        credentials,
        targetRoles,
        preferredSeniority,
        excludedTitles,
        targetDepartments,
        correlationId: session.correlation_id || '',
        prospect_id: prospect.id,
        list_id: session.prospect_list_id,
        onlyMissing: session.only_missing_fields !== false,
        forceRefresh: !!session.force_refresh,
        emailOnly: !!session.email_only,
        strictZeroCredit: !!session.strict_zero_credit,
        singleBestContact: !!session.single_best_contact,
        widenMobileSearch: !!session.widen_mobile_search,
        inferEmailPattern: session.infer_email_pattern !== false,
        skipAiResearch: session.strict_zero_credit ? true : (session.provider_free_mode ? false : (!!session.skip_ai_research || !!session.email_only)),
        // Re-checked immediately before every chargeable provider/Smart Action call.
        authoriseCall: opts.authoriseCall,
      });

      const result = await Promise.race([
        waterfallPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Enrichment timed out (${opts.timeoutMs / 1000}s)`)), opts.timeoutMs)),
      ]);

      const zeroCreditProviders = new Set(['cache', 'org_memory', 'pattern_inference']);
      if (session.strict_zero_credit && !zeroCreditProviders.has(result.provider_used)) {
        throw new Error(`Zero-credit guard blocked unexpected provider path: ${result.provider_used || 'unknown'}`);
      }

      const patch = { ...result.patch, enrichment_status: result.patch.enrichment_status || 'enriched' };
      await base44.asServiceRole.entities.Prospect.update(prospect.id, patch);

      // Keep the live campaign in step: the enriched number must be dialable
      // from the campaign immediately, with no separate push step.
      let campaignSync: any = null;
      try {
        campaignSync = await syncProspectToCampaign(base44, org, { ...prospect, ...patch });
      } catch {
        campaignSync = null;
      }

      item.status = result.fields_missing.length === 0 ? 'complete' : 'partial';
      item.fields_found = result.fields_found;
      item.fields_missing = result.fields_missing;
      item.provider_used = result.provider_used;
      item.conflicts = result.conflicts;
      if (campaignSync) {
        item.campaign_company_id = campaignSync.company_id || '';
        item.campaign_contacts_updated = campaignSync.contacts_updated || 0;
      }

      const paidProviderIds = new Set(['apollo', 'lusha', 'fullenrich']);
      if (paidProviderIds.has(result.provider_used)) providerCalls++;
      if (!zeroCreditProviders.has(result.provider_used)) externalRequests++;
      const actualSmartActions = Number(result.smart_actions_used || 0);
      if ((session.strict_zero_credit || session.skip_ai_research) && actualSmartActions > 0) {
        throw new Error('Session policy blocked an unexpected Smart Action');
      }
      smartActions += actualSmartActions;
      if (result.patch.inferred_email_count) {
        patternInferred += result.patch.inferred_email_count;
      }

      // Spending control check (background worker only — poll path doesn't
      // enforce spending controls since the frontend already showed the estimate).
      if (opts.isBackgroundWorker) {
        const spendCheck = checkProviderCallAllowed(
          { ...session, provider_calls_made: providerCalls },
          controls,
          0,
        );
        if (spendCheck.pauseSession) {
          spendingPaused = true;
          spendingPauseReason = spendCheck.pauseReason;
          break;
        }
      }
    } catch (e) {
      // Permission withdrawn mid-run: stop before any further spend and leave the
      // prospect pending so an administrator can resume it after restoring access.
      if ((e as any)?.authorisationRevoked) {
        authorisationRevoked = true;
        authorisationRevokeReason = e?.message || 'authorisation_revoked';
        item.status = 'pending';
        break;
      }
      // Throttling is temporary: leave the prospect pending so the next run
      // retries it rather than recording a false enrichment failure.
      if ((e as any)?.status === 429 || /rate limit/i.test(e?.message || '')) {
        item.status = 'pending';
        break;
      }
      item.status = 'failed';
      item.error = e.message || 'Enrichment failed';
      await base44.asServiceRole.entities.Prospect.update(prospect.id, {
        enrichment_status: 'failed',
        provider_error: 'timeout',
        last_attempted_at: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  const result = finalise(allItems, batch.length, session);
  result.providerCallsMade = providerCalls;
  result.smartActionsConsumed = smartActions;
  result.externalProviderRequests = externalRequests;
  result.patternInferredCount = patternInferred;
  result.spendingPaused = spendingPaused;
  result.spendingPauseReason = spendingPauseReason;
  result.authorisationRevoked = authorisationRevoked;
  result.authorisationRevokeReason = authorisationRevokeReason;
  return result;
}

// Recomputes item counts and determines the final session status.
function finalise(items: any[], processed: number, session: any): SessionProcessResult {
  const completedCount = items.filter((i: any) => i.status === 'complete').length;
  const partialCount = items.filter((i: any) => i.status === 'partial').length;
  const failedCount = items.filter((i: any) => i.status === 'failed').length;
  const stillPending = items.filter((i: any) => i.status === 'pending' || i.status === 'processing').length;
  const finalStatus = stillPending > 0
    ? 'processing'
    : (failedCount > 0 && completedCount === 0 && partialCount === 0
      ? 'failed'
      : (partialCount > 0 || failedCount > 0 ? 'partially_completed' : 'completed'));

  return {
    items,
    processed,
    completedCount,
    partialCount,
    failedCount,
    stillPending,
    finalStatus,
    providerCallsMade: 0,
    authorisationRevoked: false,
    authorisationRevokeReason: '',
    smartActionsConsumed: 0,
    externalProviderRequests: 0,
    patternInferredCount: 0,
    spendingPaused: false,
    spendingPauseReason: '',
    message: stillPending > 0
      ? `Processed ${processed} prospects. ${stillPending} remaining.`
      : `Enrichment complete. ${completedCount} complete, ${partialCount} partial, ${failedCount} failed.`,
  };
}