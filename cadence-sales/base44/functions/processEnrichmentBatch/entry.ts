import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
// fullenrich phone-only limited credits
// people-v3 waterfall + search-improve bundle
import { processSessionBatch } from '../../shared/sessionProcessing.ts';
import { CAPABILITIES } from '../../shared/capabilities.ts';
import { loadActiveMembership, capabilitiesForMembership, membershipIsActive, auditSecurity, requireCapability } from '../../shared/authorization.ts';

// Tells an authorised manager that a job stopped because access was withdrawn.
async function notifyManagers(base44: any, session: any, reason: string) {
  try {
    const rows = await base44.asServiceRole.entities.OrganisationMembership.filter({ organisation_id: session.organisation_id });
    const managers = (rows || [])
      .filter((m: any) => membershipIsActive(m) && ['platform_owner', 'organisation_admin', 'sales_manager'].includes(m.role))
      .slice(0, 5);
    for (const m of managers) {
      await base44.asServiceRole.entities.Task.create({
        organisation_id: session.organisation_id,
        assigned_user_id: m.user_id,
        task_type: 'data_review',
        title: 'Enrichment paused: creator access revoked',
        description: `Session "${session.session_name || session.id}" was paused because its creator is no longer authorised (${reason}). No further provider calls were made.`,
        status: 'pending',
        priority: 'high',
        source: 'system',
        due_at: new Date().toISOString(),
        source_reference: session.id,
      }).catch(() => {});
    }
  } catch (_) { /* notification must never grant access */ }
}

// Background enrichment worker — called by the scheduled workflow every 5 minutes.
// Finds sessions with pending items and processes them. This ensures enrichment
// continues even when the user's browser is closed or they are using the Dialler.
//
// SECURITY: organisation_id is resolved server-side. Only org-connected providers are used.
// Auth is required — the scheduled workflow's platform auth context satisfies this check.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Paid provider and AI spend: only a caller whose authoritative membership
    // still grants the provider capability may run the worker. Read-only
    // reporting users and delivery callers are refused here, before any provider
    // call is made. The scheduled workflow's platform context satisfies this.
    try {
      await requireCapability(base44, user, CAPABILITIES.providers);
    } catch (e: any) {
      return Response.json({ error: e.message || 'Forbidden' }, { status: e.status || 403 });
    }

    // Find all sessions with status "processing" that have pending items.
    const sessions = await base44.asServiceRole.entities.EnrichmentSession.filter(
      { status: 'processing' }, '-last_activity_at', 20,
    ).catch(() => []);

    if (!sessions || !sessions.length) {
      return Response.json({ processed: 0, message: 'No active sessions found.' });
    }

    let totalProcessed = 0;
    const results: any[] = [];

    // A background run may only execute work created by a person whose authoritative
    // membership still permits it. The service role authenticates the worker but never
    // overrides the originating user's permissions.
    const creatorIds = [...new Set(sessions.map((s: any) => s.created_by_user_id).filter(Boolean))];
    const creatorMemberships = creatorIds.length
      ? await base44.asServiceRole.entities.OrganisationMembership
        .filter({ user_id: { $in: creatorIds } }).catch(() => [])
      : [];
    const membershipByUserId = new Map((creatorMemberships || []).map((m: any) => [m.user_id, m]));
    const organisations = await base44.asServiceRole.entities.Organisation.list('-created_date', 200).catch(() => []);
    const orgStatusById = new Map(organisations.map((o: any) => [o.id, o.status]));

    for (const session of sessions) {
      const membership = membershipByUserId.get(session.created_by_user_id);
      const skip = (reason: string) => results.push({ session_id: session.id, status: 'skipped', reason });
      // Access withdrawn: pause the job, preserve completed work, make no further
      // provider calls, record the revocation and notify a manager.
      const revoke = async (reason: string) => {
        await base44.asServiceRole.entities.EnrichmentSession.update(session.id, {
          status: 'paused',
          spending_paused: true,
          spending_pause_reason: 'authorisation_revoked',
          authorisation_status: 'revoked',
          processing_count: 0,
          last_activity_at: new Date().toISOString(),
        }).catch(() => {});
        await auditSecurity(base44, {
          organisationId: session.organisation_id,
          actorUserId: session.created_by_user_id,
          action: 'authorisation_revoked',
          entityType: 'EnrichmentSession',
          entityId: session.id,
          newValue: reason,
        });
        await notifyManagers(base44, session, reason);
        results.push({ session_id: session.id, status: 'paused', reason: 'authorisation_revoked', detail: reason });
      };

      if (!membership) { await revoke('membership_missing'); continue; }
      if (!membershipIsActive(membership)) { await revoke(`membership_${membership.status || 'inactive'}`); continue; }
      if (membership.organisation_id !== session.organisation_id) { await revoke('organisation_changed'); continue; }
      const capability = session.required_capability || CAPABILITIES.providers;
      if (!capabilitiesForMembership(membership).includes(capability)) { await revoke('capability_revoked'); continue; }
      if (session.creator_membership_version && (membership.version || 1) < session.creator_membership_version) {
        await revoke('membership_version_regressed'); continue;
      }
      if (orgStatusById.get(session.organisation_id) !== 'active') { skip('organisation_not_active'); continue; }
      if (!Array.isArray(session.provider_order_snapshot) || !session.provider_order_snapshot.length) { skip('provider_order_not_stored'); continue; }

      // Skip sessions that are paused due to spending controls.
      if (session.spending_paused) {
        results.push({ session_id: session.id, status: 'paused', reason: session.spending_pause_reason });
        continue;
      }

      // Skip sessions with a fresh lock (being processed by pollEnrichmentJob).
      const lastActivityMs = session.last_activity_at ? new Date(session.last_activity_at).getTime() : 0;
      const lockIsFresh = (session.processing_count || 0) > 0 && (Date.now() - lastActivityMs) < 120000;
      if (lockIsFresh) {
        results.push({ session_id: session.id, status: 'locked', reason: 'Another processor is active.' });
        continue;
      }

      // Reset stuck "processing" items.
      const items = (session.items || []).map((i: any) =>
        i.status === 'processing' ? { ...i, status: 'pending' } : i
      );
      const pending = items.filter((i: any) => i.status === 'pending');
      if (!pending.length) {
        // All items processed — finalise.
        const completed = items.filter((i: any) => i.status === 'complete').length;
        const partial = items.filter((i: any) => i.status === 'partial').length;
        const failed = items.filter((i: any) => i.status === 'failed').length;
        const finalStatus = failed > 0 && completed === 0 && partial === 0 ? 'failed' : (partial > 0 || failed > 0 ? 'partially_completed' : 'completed');
        await base44.asServiceRole.entities.EnrichmentSession.update(session.id, {
          status: finalStatus, items, queued_count: 0, processing_count: 0,
          completed_count: completed, partial_count: partial, failed_count: failed,
          completed_at: new Date().toISOString(), last_activity_at: new Date().toISOString(),
        }).catch(() => {});
        results.push({ session_id: session.id, status: finalStatus });
        continue;
      }

      // Process up to 2 items per run (within spending limits).
      const BATCH_SIZE = 2;
      const batch = pending.slice(0, BATCH_SIZE);

      // Claim items.
      for (const item of batch) item.status = 'processing';
      await base44.asServiceRole.entities.EnrichmentSession.update(session.id, {
        items, processing_count: batch.length, last_activity_at: new Date().toISOString(),
      }).catch(() => {});

      // Re-read authorisation live before every enrichment call in this batch. A
      // downgraded, disabled, expired or moved membership stops the batch at once.
      const authoriseCall = async () => {
        const fresh = await loadActiveMembership(base44, session.created_by_user_id, { fresh: true });
        if (fresh.organisation_id !== session.organisation_id) throw new Error('organisation_changed');
        if (!capabilitiesForMembership(fresh).includes(capability)) throw new Error('capability_revoked');
        if (session.creator_membership_version && (fresh.version || 1) < session.creator_membership_version) {
          throw new Error('membership_version_regressed');
        }
        return fresh;
      };

      const result = await processSessionBatch(base44, session, batch, items, {
        batchSize: BATCH_SIZE, timeoutMs: 90000, isBackgroundWorker: true, authoriseCall,
      });

      if (result.authorisationRevoked) {
        await base44.asServiceRole.entities.EnrichmentSession.update(session.id, {
          status: 'paused', items: result.items, spending_paused: true,
          spending_pause_reason: 'authorisation_revoked', authorisation_status: 'revoked',
          queued_count: result.stillPending, processing_count: 0,
          provider_calls_made: result.providerCallsMade,
          smart_actions_consumed: result.smartActionsConsumed,
          external_provider_requests: result.externalProviderRequests,
          last_activity_at: new Date().toISOString(),
        }).catch(() => {});
        await auditSecurity(base44, {
          organisationId: session.organisation_id,
          actorUserId: session.created_by_user_id,
          action: 'authorisation_revoked',
          entityType: 'EnrichmentSession',
          entityId: session.id,
          newValue: result.authorisationRevokeReason || 'revoked_mid_batch',
        });
        await notifyManagers(base44, session, result.authorisationRevokeReason || 'revoked_mid_batch');
        results.push({ session_id: session.id, status: 'paused', reason: 'authorisation_revoked', processed: result.processed });
        totalProcessed += result.processed;
        continue;
      }

      // Handle spending pause.
      if (result.spendingPaused) {
        await base44.asServiceRole.entities.EnrichmentSession.update(session.id, {
          status: 'paused', items: result.items, spending_paused: true,
          spending_pause_reason: result.spendingPauseReason,
          queued_count: result.stillPending, processing_count: 0,
          completed_count: result.completedCount, partial_count: result.partialCount,
          failed_count: result.failedCount,
          provider_calls_made: result.providerCallsMade,
          smart_actions_consumed: result.smartActionsConsumed,
          external_provider_requests: result.externalProviderRequests,
          pattern_inferred_count: result.patternInferredCount,
          last_activity_at: new Date().toISOString(),
        }).catch(() => {});
        results.push({ session_id: session.id, status: 'paused', reason: result.spendingPauseReason, processed: result.processed });
        totalProcessed += result.processed;
        continue;
      }

      // Update session with results.
      await base44.asServiceRole.entities.EnrichmentSession.update(session.id, {
        status: result.finalStatus, items: result.items,
        queued_count: result.stillPending, processing_count: 0,
        completed_count: result.completedCount, partial_count: result.partialCount,
        failed_count: result.failedCount,
        provider_calls_made: result.providerCallsMade,
        smart_actions_consumed: result.smartActionsConsumed,
        external_provider_requests: result.externalProviderRequests,
        pattern_inferred_count: result.patternInferredCount,
        last_activity_at: new Date().toISOString(),
        completed_at: result.stillPending === 0 ? new Date().toISOString() : null,
      }).catch(() => {});

      results.push({ session_id: session.id, status: result.finalStatus, processed: result.processed, remaining: result.stillPending });
      totalProcessed += result.processed;
    }

    return Response.json({
      processed: totalProcessed,
      sessions: results,
      message: `Background worker processed ${totalProcessed} items across ${sessions.length} sessions.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}