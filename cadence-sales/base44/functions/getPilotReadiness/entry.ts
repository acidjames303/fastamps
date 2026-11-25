import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlatformOwner } from '../../shared/roleGuards.ts';
import { CANONICAL_CHECKS, buildEvidenceMap, checkPasses } from '../../shared/pilotReadiness.ts';

// Returns pilot readiness using the canonical 13-check model.
// Used by the PilotReadiness page. Combines evidence-based status with
// live data verification for automated checks.
export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolvePlatformOwner(req);
    const body = await req.json().catch(() => ({}));
    const targetOrgId = body.organisation_id || org.id;

    const targetOrg = targetOrgId === org.id ? org : await base44.asServiceRole.entities.Organisation.get(targetOrgId);

    const [evidenceRecords, providerCreds, subs, complianceSettings, pilots, callLogs, tasks] = await Promise.all([
      base44.asServiceRole.entities.PilotReadinessEvidence.filter({ organisation_id: targetOrgId }, '-checked_at', 200),
      base44.asServiceRole.entities.ProviderCredential.filter({ organisation_id: targetOrgId }),
      base44.asServiceRole.entities.OrganisationSubscription.filter({ organisation_id: targetOrgId }),
      base44.asServiceRole.entities.ComplianceSettings.filter({ organisation_id: targetOrgId }),
      base44.asServiceRole.entities.PilotProgramme.filter({ organisation_id: targetOrgId }),
      base44.asServiceRole.entities.CallLog.filter({ organisation_id: targetOrgId }, '-created_date', 500),
      base44.asServiceRole.entities.Task.filter({ organisation_id: targetOrgId }, '-created_date', 500),
    ]);

    const pilot = pilots?.[0];
    const evidenceMap = buildEvidenceMap(evidenceRecords);
    const now = new Date().toISOString();
    const checks = {};

    for (const check of CANONICAL_CHECKS) {
      const result = checkPasses(check.key, evidenceMap);
      let status = result.passed ? 'pass' : result.status;
      let notes = result.reason;

      // Live data overrides for automated checks
      if (check.key === 'credentials_secure') {
        const hasCreds = providerCreds.length > 0;
        const hasPlaintext = !!(targetOrg?.settings && targetOrg.settings.api_keys && Object.keys(targetOrg.settings.api_keys).length > 0);
        status = (hasCreds && !hasPlaintext) ? 'pass' : 'fail';
        notes = hasPlaintext ? 'Plaintext credentials in settings.' : `${providerCreds.length} encrypted credential(s).`;
      } else if (check.key === 'subscription_active') {
        const activeSub = subs.find(s => ['active', 'trialing'].includes(s.status));
        status = activeSub ? 'pass' : 'fail';
        notes = activeSub ? `Subscription ${activeSub.status}.` : 'No active subscription.';
      } else if (check.key === 'checkpoint_created') {
        status = pilot?.checkpoint_id ? 'pass' : 'pending';
        notes = pilot?.checkpoint_id ? `Checkpoint: ${pilot.checkpoint_id}` : 'No checkpoint recorded.';
      } else if (check.key === 'test_call') {
        status = callLogs.length > 0 ? 'pass' : 'pending';
        notes = `${callLogs.length} call log(s).`;
      } else if (check.key === 'callback_creation') {
        const callbacks = tasks.filter(t => t.task_type === 'callback');
        status = callbacks.length > 0 ? 'pass' : 'pending';
        notes = `${callbacks.length} callback task(s).`;
      }

      checks[check.key] = {
        status,
        checked_at: result.evidence?.checked_at || now,
        notes,
        evidence_method: result.evidence_method || (check.acceptable_evidence[0]),
        acceptable_evidence: check.acceptable_evidence,
      };
    }

    const passed = Object.values(checks).filter(c => c.status === 'pass').length;
    const failed = Object.values(checks).filter(c => c.status === 'fail').length;
    const pending = Object.values(checks).filter(c => c.status !== 'pass' && c.status !== 'fail').length;

    return Response.json({
      organisation_id: targetOrgId,
      organisation_name: targetOrg?.name || '',
      pilot_status: targetOrg?.pilot_status || 'setup',
      ready: failed === 0 && pending === 0,
      summary: { total: CANONICAL_CHECKS.length, passed, failed, pending },
      checks,
      checked_at: now,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}