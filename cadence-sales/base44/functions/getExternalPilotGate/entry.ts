import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlatformOwner } from '../../shared/roleGuards.ts';
import { CANONICAL_CHECKS, buildEvidenceMap, checkPasses } from '../../shared/pilotReadiness.ts';
import { resolveSubscription, isOrganisationActive } from '../../shared/entitlements.ts';

// Final external pilot gate — combines all readiness checks with live data
// verification. Used before first unsupervised external calling session.
// Platform-owner only.
export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolvePlatformOwner(req);
    const body = await req.json().catch(() => ({}));
    const targetOrgId = body.organisation_id || org.id;
    const targetOrg = targetOrgId === org.id ? org : await base44.asServiceRole.entities.Organisation.get(targetOrgId);

    const [evidenceRecords, providerCreds, subs, pilots, callLogs, tasks, incidents, supportReqs] = await Promise.all([
      base44.asServiceRole.entities.PilotReadinessEvidence.filter({ organisation_id: targetOrgId }, '-checked_at', 200),
      base44.asServiceRole.entities.ProviderCredential.filter({ organisation_id: targetOrgId }),
      resolveSubscription(base44, targetOrg),
      base44.asServiceRole.entities.PilotProgramme.filter({ organisation_id: targetOrgId }),
      base44.asServiceRole.entities.CallLog.filter({ organisation_id: targetOrgId }, '-created_date', 500),
      base44.asServiceRole.entities.Task.filter({ organisation_id: targetOrgId }, '-created_date', 500),
      base44.asServiceRole.entities.Incident.filter({ status: 'investigating' }),
      base44.asServiceRole.entities.SupportRequest.filter({ organisation_id: targetOrgId }),
    ]);

    const pilot = pilots?.[0];
    const evidenceMap = buildEvidenceMap(evidenceRecords);
    const now = new Date().toISOString();

    // Build gate checks with live overrides
    const gateChecks = [];

    for (const check of CANONICAL_CHECKS) {
      if (!check.required_for_external) continue;
      const result = checkPasses(check.key, evidenceMap);
      let passed = result.passed;
      let notes = result.reason;

      // Live data overrides
      if (check.key === 'credentials_secure') {
        const hasCreds = providerCreds.length > 0;
        const hasPlaintext = !!(targetOrg?.settings?.api_keys && Object.keys(targetOrg.settings.api_keys).length > 0);
        passed = hasCreds && !hasPlaintext;
        notes = hasPlaintext ? 'Plaintext credentials in settings.' : `${providerCreds.length} encrypted credential(s).`;
      } else if (check.key === 'subscription_active') {
        passed = subs ? isOrganisationActive(subs) : false;
        notes = subs ? `Subscription ${subs.status}.` : 'No subscription.';
      } else if (check.key === 'checkpoint_created') {
        passed = !!pilot?.checkpoint_id;
        notes = pilot?.checkpoint_id ? `Checkpoint: ${pilot.checkpoint_id}` : 'No checkpoint.';
      } else if (check.key === 'test_call') {
        passed = callLogs.length > 0;
        notes = `${callLogs.length} call log(s).`;
      } else if (check.key === 'callback_creation') {
        const callbacks = tasks.filter(t => t.task_type === 'callback');
        passed = callbacks.length > 0;
        notes = `${callbacks.length} callback task(s).`;
      } else if (check.key === 'results_accuracy') {
        // Verify no review_required logs remain unclassified
        const unclassified = callLogs.filter(l => l.classification_status === 'review_required');
        passed = unclassified.length === 0 && callLogs.length > 0;
        notes = unclassified.length > 0 ? `${unclassified.length} log(s) need classification review.` : 'All logs classified.';
      }

      gateChecks.push({
        key: check.key,
        label: check.label,
        category: check.category,
        passed,
        evidence_method: result.evidence_method || check.acceptable_evidence[0],
        required_evidence: check.acceptable_evidence,
        notes,
      });
    }

    // Additional external-specific checks
    const criticalIncidents = incidents.filter(i =>
      i.severity === 'critical' &&
      (!i.affected_organisation_ids || i.affected_organisation_ids.length === 0 || i.affected_organisation_ids.includes(targetOrgId))
    );

    gateChecks.push({
      key: 'no_critical_incidents',
      label: 'No critical incidents',
      category: 'critical',
      passed: criticalIncidents.length === 0,
      evidence_method: 'automated',
      required_evidence: ['automated'],
      notes: criticalIncidents.length === 0 ? 'No critical incidents.' : `${criticalIncidents.length} critical incident(s) open.`,
    });

    gateChecks.push({
      key: 'usage_limits_active',
      label: 'Usage limits active',
      category: 'operational',
      passed: !!subs,
      evidence_method: 'automated',
      required_evidence: ['automated'],
      notes: subs ? 'Subscription with usage tracking active.' : 'No subscription — usage limits not enforced.',
    });

    const blockers = gateChecks.filter(c => !c.passed).map(c => `${c.label} — ${c.notes}`);
    const allPassed = blockers.length === 0;

    return Response.json({
      organisation_id: targetOrgId,
      organisation_name: targetOrg?.name || '',
      gate_passed: allPassed,
      blockers,
      checks: gateChecks,
      total_checks: gateChecks.length,
      passed_checks: gateChecks.filter(c => c.passed).length,
      checked_at: now,
      decision: allPassed ? 'ready_for_controlled_external_pilot' : 'blocked',
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}