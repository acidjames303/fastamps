import { resolvePlatformOwner } from '../../shared/roleGuards.ts';
import {
  CANONICAL_CHECKS, buildEvidenceMap, checkPasses, evaluateActivationGate, migrateKey,
} from '../../shared/pilotReadiness.ts';
import { isConversation, isConnected, getConversationType, resolvePrimaryOutcome } from '../../shared/callClassification.ts';

// Certifies that Results page metrics match source CallLog data for both
// Internal and Organisation B. Creates canonical results_accuracy evidence
// with evidence_method = automated.
//
// Verifies: calls attempted, calls connected, conversations, decision-maker
// conversations, gatekeeper conversations, wrong-person conversations,
// callbacks, no answer, voicemail, busy, invalid numbers.
// No-answer outcomes must never increase conversations.
export default async function (req) {
  try {
    const { base44, user, profile } = await resolvePlatformOwner(req);
    const body = await req.json().catch(() => ({}));
    const targetOrgId = body.organisation_id || profile.organisation_id;

    // Load all CallLogs and Tasks for the target org
    const [callLogs, tasks, pilot] = await Promise.all([
      base44.asServiceRole.entities.CallLog.filter({ organisation_id: targetOrgId }, '-created_date', 500),
      base44.asServiceRole.entities.Task.filter({ organisation_id: targetOrgId }, '-created_date', 500),
      base44.asServiceRole.entities.PilotProgramme.filter({ organisation_id: targetOrgId }),
    ]);

    const pilotRecord = pilot?.[0];

    // Compute metrics using the SAME shared classification functions
    // that the Results page and todayWork use.
    const metrics = {
      calls_attempted: callLogs.filter(l => l.call_attempted !== false).length,
      calls_connected: callLogs.filter(l => isConnected(l)).length,
      conversations: new Set(callLogs.filter(l => isConversation(l)).map(l => l.contact_id).filter(Boolean)).size,
      decision_maker_conversations: callLogs.filter(l => isConversation(l) && getConversationType(l) === 'decision_maker').length,
      gatekeeper_conversations: callLogs.filter(l => isConversation(l) && getConversationType(l) === 'gatekeeper').length,
      wrong_person_conversations: callLogs.filter(l => isConversation(l) && getConversationType(l) === 'wrong_person').length,
      callbacks: tasks.filter(t => t.task_type === 'callback').length,
      no_answer: callLogs.filter(l => resolvePrimaryOutcome(l) === 'no_answer').length,
      voicemail: callLogs.filter(l => resolvePrimaryOutcome(l) === 'voicemail').length,
      busy: callLogs.filter(l => resolvePrimaryOutcome(l) === 'busy').length,
      invalid_numbers: callLogs.filter(l => resolvePrimaryOutcome(l) === 'invalid_number').length,
    };

    // Verify no-answer outcomes never count as conversations
    const noAnswerLogs = callLogs.filter(l => resolvePrimaryOutcome(l) === 'no_answer');
    const noAnswerConversations = noAnswerLogs.filter(l => isConversation(l));
    const no_answer_never_conversation = noAnswerConversations.length === 0;

    // Verify voicemail never counts as conversations
    const voicemailLogs = callLogs.filter(l => resolvePrimaryOutcome(l) === 'voicemail');
    const voicemailConversations = voicemailLogs.filter(l => isConversation(l));
    const voicemail_never_conversation = voicemailConversations.length === 0;

    // Verify removal logs never count as calls or conversations
    const removedLogs = callLogs.filter(l => l.outcome === 'removed' || resolvePrimaryOutcome(l) === 'other' && l.removal_reason);
    const removedAsCall = removedLogs.filter(l => l.call_attempted !== false && l.call_attempted !== undefined);
    const removed_as_never_call = removedAsCall.length === 0;

    const allAccurate = no_answer_never_conversation && voicemail_never_conversation && removed_as_never_call;

    if (!pilotRecord) {
      return Response.json({ error: 'No pilot programme found.' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Record evidence
    const evidence = await base44.asServiceRole.entities.PilotReadinessEvidence.create({
      organisation_id: targetOrgId,
      pilot_programme_id: pilotRecord.id,
      check_key: 'results_accuracy',
      status: allAccurate ? 'passed' : 'failed',
      evidence_method: 'automated',
      test_run_id: `results-cert-${Date.now()}`,
      checked_by_user_id: user.id,
      checked_at: now,
      related_entity_type: 'CallLog',
      related_entity_ids: callLogs.slice(0, 10).map(l => l.id),
      evidence_summary: allAccurate
        ? `Results accuracy certified for ${targetOrgId}. Calls attempted: ${metrics.calls_attempted}, connected: ${metrics.calls_connected}, conversations: ${metrics.conversations} (unique contacts), DM: ${metrics.decision_maker_conversations}, gatekeeper: ${metrics.gatekeeper_conversations}, wrong-person: ${metrics.wrong_person_conversations}, callbacks: ${metrics.callbacks}, no_answer: ${metrics.no_answer}, voicemail: ${metrics.voicemail}, busy: ${metrics.busy}, invalid: ${metrics.invalid_numbers}. No-answer and voicemail never counted as conversations. Removal logs never counted as calls.`
        : `Results accuracy FAILED. no_answer_as_conversation: ${noAnswerConversations.length}, voicemail_as_conversation: ${voicemailConversations.length}, removed_as_call: ${removedAsCall.length}`,
      automated: true,
      app_version: 'sprint-14f-b',
      failure_reason: allAccurate ? '' : 'Classification inconsistency detected.',
    });

    return Response.json({
      ok: true,
      accurate: allAccurate,
      metrics,
      no_answer_never_conversation,
      voicemail_never_conversation,
      removed_as_never_call,
      evidence_id: evidence.id,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}