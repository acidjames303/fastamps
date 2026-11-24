import { resolvePlatformOwner } from '../../shared/roleGuards.ts';
import {
  CANONICAL_CHECKS, buildEvidenceMap, checkPasses, evaluateActivationGate, migrateKey,
} from '../../shared/pilotReadiness.ts';

// Reconciles pilot readiness: recalculates PilotProgramme.pilot_readiness_checks
// using the canonical 13-check model, removes legacy keys, removes contradictory
// not_tested values where valid evidence exists, saves activation_blockers,
// and ensures Pilot Console and Pilot Readiness show identical statuses.
//
// Key rules:
// - Legacy evidence without evidence_method is NOT accepted for browser checks.
// - Never show zero blockers while required checks are pending.
export default async function (req) {
  try {
    const { base44, user, profile } = await resolvePlatformOwner(req);
    const body = await req.json().catch(() => ({}));
    const targetOrgId = body.organisation_id || profile.organisation_id;

    const [org, pilots, evidenceRecords, providerCreds, subs, complianceSettings, campaigns, incidents] = await Promise.all([
      base44.asServiceRole.entities.Organisation.get(targetOrgId),
      base44.asServiceRole.entities.PilotProgramme.filter({ organisation_id: targetOrgId }),
      base44.asServiceRole.entities.PilotReadinessEvidence.filter({ organisation_id: targetOrgId }, '-checked_at', 200),
      base44.asServiceRole.entities.ProviderCredential.filter({ organisation_id: targetOrgId }),
      base44.asServiceRole.entities.OrganisationSubscription.filter({ organisation_id: targetOrgId }),
      base44.asServiceRole.entities.ComplianceSettings.filter({ organisation_id: targetOrgId }),
      base44.asServiceRole.entities.Campaign.filter({ organisation_id: targetOrgId }),
      base44.asServiceRole.entities.Incident.filter({ status: 'investigating' }, '-created_at', 50).catch(() => []),
    ]);

    const pilot = pilots?.[0];
    if (!pilot) {
      return Response.json({ error: 'No pilot programme found.' }, { status: 404 });
    }

    const evidenceMap = buildEvidenceMap(evidenceRecords);
    const gate = evaluateActivationGate(evidenceMap, 'internal');

    // Live data overrides for automated checks
    const hasCreds = providerCreds.length > 0;
    const hasPlaintext = !!(org?.settings && org.settings.api_keys && Object.keys(org.settings.api_keys).length > 0);

    // Build the canonical readiness_checks map
    const readinessChecks = {};
    const checksList = [];

    for (const check of CANONICAL_CHECKS) {
      const result = checkPasses(check.key, evidenceMap);
      let passed = result.passed;
      let status = result.status;
      let evidenceMethod = result.evidence_method;
      let reason = result.reason;

      // Live data overrides for automated checks
      if (check.key === 'credentials_secure') {
        if (hasCreds && !hasPlaintext) { passed = true; status = 'passed'; evidenceMethod = 'automated'; reason = `${providerCreds.length} encrypted credential(s); no plaintext.`; }
        else if (hasPlaintext) { passed = false; status = 'failed'; evidenceMethod = 'automated'; reason = 'Plaintext credentials in settings.'; }
        else { passed = false; status = 'not_tested'; evidenceMethod = 'automated'; reason = 'No credentials configured.'; }
      }
      if (check.key === 'subscription_active') {
        const activeSub = subs.find(s => ['active', 'trialing'].includes(s.status));
        passed = !!activeSub; status = activeSub ? 'passed' : 'failed'; evidenceMethod = 'automated';
        reason = activeSub ? `Subscription ${activeSub.status}.` : 'No active subscription.';
      }
      if (check.key === 'checkpoint_created') {
        passed = !!pilot.checkpoint_id; status = pilot.checkpoint_id ? 'passed' : 'not_tested'; evidenceMethod = 'platform_owner_confirmation';
        reason = pilot.checkpoint_id ? `Checkpoint: ${pilot.checkpoint_id}` : 'No checkpoint recorded.';
      }

      // Only store as passed if the evidence method is acceptable
      const isAcceptable = check.acceptable_evidence.includes(evidenceMethod);
      const finalStatus = (passed && isAcceptable) ? 'passed' : (status === 'passed' && !isAcceptable ? 'not_tested' : status);

      readinessChecks[check.key] = {
        status: finalStatus,
        checked_at: result.evidence?.checked_at || '',
        notes: reason,
        evidence_method: evidenceMethod || '',
      };

      checksList.push({
        key: check.key,
        label: check.label,
        passed: finalStatus === 'passed',
        status: finalStatus,
        evidence_method: evidenceMethod || '',
        reason,
        required: check.required_for_internal,
      });
    }

    // Build blockers list from the canonical gate + operational checks
    const requiredBlockers = checksList.filter(c => c.required && !c.passed).map(c => `${c.label} — ${c.reason}`);

    // Operational blockers
    const operationalBlockers = [];
    if (org?.status !== 'active') operationalBlockers.push('Organisation is not active');
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ organisation_id: targetOrgId }).catch(() => []);
    if (!profiles.some(p => p.app_role === 'organisation_admin')) operationalBlockers.push('No organisation admin assigned');
    if (!pilot.support_contact_configured) operationalBlockers.push('Support contact not configured');
    if (!pilot.privacy_contact_configured) operationalBlockers.push('Privacy contact not configured');
    if (complianceSettings.length === 0) operationalBlockers.push('Compliance settings not reviewed');
    if (campaigns.length === 0) operationalBlockers.push('No campaign drafted');
    const criticalIncidents = (incidents || []).filter(i => i.severity === 'critical');
    if (criticalIncidents.length > 0) operationalBlockers.push(`${criticalIncidents.length} critical incident(s) open`);

    const allBlockers = [...requiredBlockers, ...operationalBlockers];
    const all_passed = allBlockers.length === 0;

    // Determine decision
    let decision = 'Blocked';
    if (all_passed) {
      const externalGate = evaluateActivationGate(evidenceMap, 'external');
      if (externalGate.all_passed && criticalIncidents.length === 0 && !hasPlaintext) {
        decision = 'Ready for controlled external pilot';
      } else {
        decision = 'Ready for internal pilot';
      }
    }

    // Update PilotProgramme with reconciled readiness_checks and blockers
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.PilotProgramme.update(pilot.id, {
      pilot_readiness_checks: readinessChecks,
      activation_blockers: allBlockers,
      updated_at: now,
    });

    return Response.json({
      ok: true,
      organisation_id: targetOrgId,
      organisation_name: org?.name || '',
      pilot_status: pilot.status,
      org_pilot_status: org?.pilot_status || 'setup',
      decision,
      all_passed,
      blockers: allBlockers,
      checks: checksList,
      reconciled_at: now,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}