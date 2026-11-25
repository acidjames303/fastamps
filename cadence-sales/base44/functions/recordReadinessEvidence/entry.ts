import { resolvePlatformOwner } from '../../shared/roleGuards.ts';
import { isAcceptableEvidence, migrateKey, CANONICAL_CHECKS } from '../../shared/pilotReadiness.ts';

// Records structured readiness evidence for a pilot activation check.
// Platform-owner only. organisation_id and pilot_programme_id are resolved
// server-side — never trusted from the client. A pass must include checked_at,
// checked_by_user_id, test_run_id, related record IDs, and an evidence summary.
//
// Sprint 14D: now requires evidence_method, validated against the canonical
// check's acceptable_evidence list. Legacy check_keys are auto-migrated.
export default async function (req) {
  const { base44, user, profile } = await resolvePlatformOwner(req);
  const body = await req.json().catch(() => ({}));
  const {
    check_key, status, evidence_method, test_run_id,
    related_entity_type, related_entity_ids,
    evidence_summary, automated = false,
    browser_session_required = false,
    expires_at, failure_reason,
    organisation_id,
  } = body || {};

  if (!check_key) {
    return Response.json({ error: 'check_key is required.' }, { status: 400 });
  }

  // Migrate legacy key to canonical key
  const canonicalKey = migrateKey(check_key);
  const check = CANONICAL_CHECKS.find(c => c.key === canonicalKey);
  if (!check) {
    return Response.json({ error: `Unknown check_key: ${check_key}. Not in canonical readiness model.` }, { status: 400 });
  }

  if (!['not_tested', 'running', 'passed', 'failed', 'blocked', 'expired'].includes(status)) {
    return Response.json({ error: 'Invalid status.' }, { status: 400 });
  }

  // evidence_method is required for all records in Sprint 14D.
  // Infer from legacy `automated` flag if not provided.
  const resolvedMethod = evidence_method || (automated ? 'automated' : 'database_verification');
  if (!['automated', 'database_verification', 'user_browser_confirmation', 'platform_owner_confirmation'].includes(resolvedMethod)) {
    return Response.json({ error: 'Invalid evidence_method.' }, { status: 400 });
  }

  if (status === 'passed') {
    if (!evidence_summary) {
      return Response.json({ error: 'A pass requires an evidence_summary with real record IDs.' }, { status: 400 });
    }
    if (!related_entity_ids?.length && resolvedMethod !== 'automated') {
      return Response.json({ error: 'A non-automated pass requires related_entity_ids.' }, { status: 400 });
    }
    // Validate evidence method is acceptable for this check
    if (!isAcceptableEvidence(canonicalKey, resolvedMethod)) {
      return Response.json({
        error: `Evidence method "${resolvedMethod}" is not acceptable for check "${canonicalKey}". Acceptable: ${check.acceptable_evidence.join(', ')}.`,
      }, { status: 400 });
    }
  }

  if ((status === 'failed' || status === 'blocked') && !failure_reason) {
    return Response.json({ error: 'A failed/blocked status requires a failure_reason.' }, { status: 400 });
  }

  // Resolve target organisation
  const targetOrgId = organisation_id || profile.organisation_id;
  const targetOrg = await base44.asServiceRole.entities.Organisation.get(targetOrgId);
  if (!targetOrg) {
    return Response.json({ error: 'Organisation not found.' }, { status: 404 });
  }

  // Load pilot programme
  const pilots = await base44.asServiceRole.entities.PilotProgramme.filter({ organisation_id: targetOrgId });
  const pilot = pilots && pilots[0];
  if (!pilot) {
    return Response.json({ error: 'No pilot programme found for this organisation.' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const evidence = await base44.asServiceRole.entities.PilotReadinessEvidence.create({
    organisation_id: targetOrgId,
    pilot_programme_id: pilot.id,
    check_key: canonicalKey,
    status,
    evidence_method: resolvedMethod,
    test_run_id: test_run_id || '',
    checked_by_user_id: user.id,
    checked_at: now,
    related_entity_type: related_entity_type || '',
    related_entity_ids: related_entity_ids || [],
    evidence_summary: evidence_summary || '',
    automated: !!automated,
    browser_session_required: !!browser_session_required,
    expires_at: expires_at || '',
    failure_reason: failure_reason || '',
    app_version: 'sprint-14d',
  });

  return Response.json({
    ok: true,
    evidence: {
      id: evidence.id,
      check_key: evidence.check_key,
      status: evidence.status,
      evidence_method: evidence.evidence_method,
      checked_at: evidence.checked_at,
      checked_by_user_id: evidence.checked_by_user_id,
      test_run_id: evidence.test_run_id,
      related_entity_ids: evidence.related_entity_ids,
      expires_at: evidence.expires_at,
    },
  });
}