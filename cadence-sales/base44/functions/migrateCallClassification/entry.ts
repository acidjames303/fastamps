import { resolveTenant } from '../../shared/tenantAuth.ts';
import { classifyCall, resolvePrimaryOutcome } from '../../shared/callClassification.ts';

// Backfills existing CallLog records with call_attempted, call_connected,
// conversation_held, conversation_type, classification_status, connected_at,
// and outcome_saved_at — all derived server-side from the stored outcome.
//
// Idempotent: skips records that already have conversation_held set.
// Tenant-isolated: only processes records for the caller's organisation.
// Platform-owner only.
export default async function (req) {
  const { base44, profile, org } = await resolveTenant(req);
  if (profile.app_role !== 'platform_owner') {
    return Response.json({ error: 'Platform owner only' }, { status: 403 });
  }

  const logs = await base44.asServiceRole.entities.CallLog.filter(
    { organisation_id: org.id }, '-created_date', 500
  ).catch(() => []);

  const updates = [];
  const summary = {
    total: logs.length,
    already_classified: 0,
    classified: 0,
    review_required: 0,
    conversations: 0,
    connected: 0,
    attempted_only: 0,
    by_type: { decision_maker: 0, gatekeeper: 0, wrong_person: 0, other: 0, none: 0 },
    updated: 0,
    errors: 0,
  };

  for (const log of logs) {
    // Skip if already classified (idempotency).
    if (log.conversation_held !== undefined && log.conversation_held !== null) {
      summary.already_classified++;
      continue;
    }

    const primary = resolvePrimaryOutcome(log);
    const c = classifyCall(primary);

    updates.push({
      id: log.id,
      call_attempted: c.call_attempted,
      call_connected: c.call_connected,
      conversation_held: c.conversation_held,
      conversation_type: c.conversation_type,
      classification_status: c.classification_status,
      connected_at: c.call_connected ? (log.started_at || log.ended_at || log.created_date || '') : '',
      outcome_saved_at: log.ended_at || log.created_date || '',
    });

    if (c.conversation_held) summary.conversations++;
    else if (c.call_connected) summary.connected++;
    else summary.attempted_only++;

    summary.by_type[c.conversation_type] = (summary.by_type[c.conversation_type] || 0) + 1;

    if (c.classification_status === 'review_required') summary.review_required++;
    else summary.classified++;
  }

  if (updates.length > 0) {
    try {
      await base44.asServiceRole.entities.CallLog.bulkUpdate(updates);
      summary.updated = updates.length;
    } catch (e) {
      summary.errors = updates.length;
    }
  }

  return Response.json({ ok: true, summary });
}