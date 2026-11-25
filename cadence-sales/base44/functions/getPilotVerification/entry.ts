import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlatformOwner } from '../../shared/roleGuards.ts';
import { CANONICAL_CHECKS, buildEvidenceMap, checkPasses, evaluateActivationGate } from '../../shared/pilotReadiness.ts';

// Returns the 13 canonical readiness checks with their current evidence status,
// evidence method, and whether user/platform confirmation is still needed.
// Used by the Pilot Verification workspace in the Pilot Console.
export default async function(req) {
  try {
    const { base44, user, profile } = await resolvePlatformOwner(req);
    const body = await req.json().catch(() => ({}));
    const targetOrgId = body.organisation_id || profile.organisation_id;

    const [org, pilots, evidenceRecords, providerCreds, subs, incidents] = await Promise.all([
      base44.asServiceRole.entities.Organisation.get(targetOrgId),
      base44.asServiceRole.entities.PilotProgramme.filter({ organisation_id: targetOrgId }),
      base44.asServiceRole.entities.PilotReadinessEvidence.filter({ organisation_id: targetOrgId }, '-checked_at', 200),
      base44.asServiceRole.entities.ProviderCredential.filter({ organisation_id: targetOrgId }),
      base44.asServiceRole.entities.OrganisationSubscription.filter({ organisation_id: targetOrgId }),
      base44.asServiceRole.entities.Incident.filter({ status: 'investigating' }, '-created_at', 50).catch(() => []),
    ]);

    const pilot = pilots?.[0];
    const evidenceMap = buildEvidenceMap(evidenceRecords);

    // Live data overrides for automated checks
    const hasCreds = providerCreds.length > 0;
    const hasPlaintext = !!(org?.settings && org.settings.api_keys && Object.keys(org.settings.api_keys).length > 0);
    const activeSub = subs.find(s => ['active', 'trialing'].includes(s.status));
    const criticalIncidents = (incidents || []).filter(i => i.severity === 'critical');

    const checks = CANONICAL_CHECKS.map(check => {
      const result = checkPasses(check.key, evidenceMap);
      let { passed, status, evidence_method, reason } = result;
      const evidence = result.evidence;

      // Live data overrides for automated checks
      if (check.key === 'credentials_secure') {
        if (hasCreds && !hasPlaintext) { passed = true; status = 'passed'; evidence_method = 'automated'; reason = `${providerCreds.length} encrypted credential(s); no plaintext.`; }
        else if (hasPlaintext) { passed = false; status = 'failed'; evidence_method = 'automated'; reason = 'Plaintext credentials in Organisation.settings.'; }
      }
      if (check.key === 'subscription_active') {
        passed = !!activeSub; status = activeSub ? 'passed' : 'failed'; evidence_method = 'automated';
        reason = activeSub ? `Subscription ${activeSub.status}.` : 'No active subscription.';
      }
      if (check.key === 'checkpoint_created') {
        passed = !!pilot?.checkpoint_id; status = pilot?.checkpoint_id ? 'passed' : 'not_tested'; evidence_method = 'platform_owner_confirmation';
        reason = pilot?.checkpoint_id ? `Checkpoint: ${pilot.checkpoint_id}` : 'No checkpoint recorded.';
      }

      const needs_browser_confirmation = check.acceptable_evidence.includes('user_browser_confirmation') && !passed;
      const needs_platform_confirmation = check.acceptable_evidence.includes('platform_owner_confirmation') && !passed;
      const can_run_automated = ['suppression_enforcement', 'production_build', 'provider_test_successful', 'results_accuracy'].includes(check.key) && !passed;

      return {
        key: check.key,
        label: check.label,
        description: check.description,
        category: check.category,
        acceptable_evidence: check.acceptable_evidence,
        required_for_internal: check.required_for_internal,
        required_for_external: check.required_for_external,
        passed,
        status,
        evidence_method,
        reason,
        checked_at: evidence?.checked_at || '',
        checked_by_user_id: evidence?.checked_by_user_id || '',
        needs_browser_confirmation,
        needs_platform_confirmation,
        can_run_automated,
      };
    });

    const internalGate = evaluateActivationGate(evidenceMap, 'internal');
    const externalGate = evaluateActivationGate(evidenceMap, 'external');

    // Determine decision
    let decision = 'Blocked';
    const internalBlockers = internalGate.blockers;
    const externalBlockers = externalGate.blockers;
    if (internalGate.all_passed && criticalIncidents.length === 0 && !hasPlaintext) {
      if (externalGate.all_passed && criticalIncidents.length === 0) {
        decision = 'Ready for controlled external pilot';
      } else {
        decision = 'Ready for internal pilot';
      }
    }

    return Response.json({
      organisation_id: targetOrgId,
      organisation_name: org?.name || '',
      pilot_status: org?.pilot_status || 'setup',
      checkpoint_id: pilot?.checkpoint_id || '',
      checks,
      decision,
      internal: { ready: internalGate.all_passed, blockers: internalBlockers },
      external: { ready: externalGate.all_passed, blockers: externalBlockers },
      critical_incidents: criticalIncidents.length,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}