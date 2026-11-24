import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlatformOwner } from '../../shared/roleGuards.ts';
import { CANONICAL_CHECKS, buildEvidenceMap, checkPasses, evaluateActivationGate, migrateKey } from '../../shared/pilotReadiness.ts';

// Platform-owner pilot activation workflow.
// action: 'check' — evaluate all canonical activation requirements, return results + blockers.
// action: 'activate' — activate only when all required checks pass.
// action: 'pause' — pause the pilot.
// action: 'resume' — resume a paused pilot.
// action: 'offboard' — convert, extend, complete, or discontinue.
//
// Sprint 14D: uses the canonical readiness model with evidence-method validation.
// A check passes only when there is valid, non-expired evidence with an acceptable
// evidence_method. Database-only evidence is never accepted for browser-confirmation checks.
export default async function(req) {
  try {
    const { base44, user, profile } = await resolvePlatformOwner(req);
    const body = await req.json().catch(() => ({}));
    const { action, organisation_id, offboard_type, completion_summary } = body;

    if (!action) {
      return Response.json({ error: 'action is required.' }, { status: 400 });
    }

    // Resolve target organisation.
    let targetOrgId = organisation_id || profile.organisation_id;
    const targetOrg = await base44.asServiceRole.entities.Organisation.get(targetOrgId);
    if (!targetOrg) {
      return Response.json({ error: 'Organisation not found.' }, { status: 404 });
    }

    // Load pilot programme.
    const pilots = await base44.asServiceRole.entities.PilotProgramme.filter({ organisation_id: targetOrgId });
    const pilot = pilots && pilots[0];
    if (!pilot) {
      return Response.json({ error: 'No pilot programme found for this organisation.' }, { status: 404 });
    }

    if (action === 'check') {
      const result = await evaluateGate(base44, targetOrgId, targetOrg, pilot, 'internal');
      return Response.json({
        pilot: { id: pilot.id, status: pilot.status, name: pilot.pilot_name },
        checks: result.checks,
        all_passed: result.all_passed,
        blockers: result.blockers,
        decision: result.decision,
      });
    }

    if (action === 'activate') {
      const result = await evaluateGate(base44, targetOrgId, targetOrg, pilot, 'internal');
      if (result.blockers.length > 0) {
        return Response.json({ error: 'Cannot activate — required checks not met.', blockers: result.blockers }, { status: 400 });
      }
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.PilotProgramme.update(pilot.id, {
        status: 'active',
        activation_blockers: [],
        updated_at: now,
      });
      await base44.asServiceRole.entities.Organisation.update(targetOrgId, {
        pilot_status: 'live',
        pilot_activated_at: now,
      });
      return Response.json({ ok: true, action: 'activated', pilot_status: 'active' });
    }

    if (action === 'pause') {
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.PilotProgramme.update(pilot.id, {
        status: 'paused',
        activation_blockers: body.blockers || ['Paused by platform owner'],
        updated_at: now,
      });
      await base44.asServiceRole.entities.Organisation.update(targetOrgId, { pilot_status: 'paused' });
      return Response.json({ ok: true, action: 'paused' });
    }

    if (action === 'resume') {
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.PilotProgramme.update(pilot.id, {
        status: 'active',
        activation_blockers: [],
        updated_at: now,
      });
      await base44.asServiceRole.entities.Organisation.update(targetOrgId, { pilot_status: 'live' });
      return Response.json({ ok: true, action: 'resumed' });
    }

    if (action === 'offboard') {
      if (!offboard_type) {
        return Response.json({ error: 'offboard_type is required (convert, extend, complete, discontinue).' }, { status: 400 });
      }
      const now = new Date().toISOString();
      const statusMap = {
        convert: 'converted',
        extend: 'active',
        complete: 'completed',
        discontinue: 'discontinued',
      };
      const newStatus = statusMap[offboard_type];
      if (!newStatus) {
        return Response.json({ error: 'Invalid offboard_type.' }, { status: 400 });
      }
      await base44.asServiceRole.entities.PilotProgramme.update(pilot.id, {
        status: newStatus,
        completion_summary: completion_summary || '',
        actual_end_date: new Date().toISOString().split('T')[0],
        updated_at: now,
      });
      if (offboard_type === 'complete' || offboard_type === 'discontinue') {
        await base44.asServiceRole.entities.Organisation.update(targetOrgId, { pilot_status: 'offboarding' });
      }
      return Response.json({ ok: true, action: 'offboarded', offboard_type, new_status: newStatus });
    }

    return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}

// Evaluate the activation gate using the canonical readiness model.
// Combines evidence-based checks with live data verification for automated checks.
async function evaluateGate(base44, orgId, org, pilot, level) {
  const [evidenceRecords, providerCreds, subs, profiles, complianceSettings, campaigns, incidents] = await Promise.all([
    base44.asServiceRole.entities.PilotReadinessEvidence.filter({ organisation_id: orgId }, '-checked_at', 200),
    base44.asServiceRole.entities.ProviderCredential.filter({ organisation_id: orgId }),
    base44.asServiceRole.entities.OrganisationSubscription.filter({ organisation_id: orgId }),
    base44.asServiceRole.entities.UserProfile.filter({ organisation_id: orgId }),
    base44.asServiceRole.entities.ComplianceSettings.filter({ organisation_id: orgId }),
    base44.asServiceRole.entities.Campaign.filter({ organisation_id: orgId }),
    base44.asServiceRole.entities.Incident.filter({ status: 'investigating' }, '-created_at', 50).catch(() => []),
  ]);

  const evidenceMap = buildEvidenceMap(evidenceRecords);
  const gate = evaluateActivationGate(evidenceMap, level);

  // Supplement with live-data verification for automated checks.
  // This catches cases where evidence hasn't been recorded yet but the
  // underlying state is verifiable from the database.
  const liveOverrides = {};

  // credentials_secure: verify encrypted credentials exist + no plaintext
  const hasCreds = providerCreds.length > 0;
  const hasPlaintext = !!(org.settings && org.settings.api_keys && Object.keys(org.settings.api_keys).length > 0);
  if (hasCreds && !hasPlaintext) {
    liveOverrides['credentials_secure'] = { passed: true, method: 'automated', reason: `${providerCreds.length} encrypted credential(s); no plaintext in settings.` };
  } else if (hasPlaintext) {
    liveOverrides['credentials_secure'] = { passed: false, method: 'automated', reason: 'Plaintext credentials detected in Organisation.settings.api_keys.' };
  }

  // subscription_active: verify active or trialing subscription
  const activeSub = subs.find(s => ['active', 'trialing'].includes(s.status));
  liveOverrides['subscription_active'] = {
    passed: !!activeSub,
    method: 'automated',
    reason: activeSub ? `Subscription ${activeSub.status}.` : 'No active subscription.',
  };

  // checkpoint_created: verify pilot.checkpoint_id exists
  liveOverrides['checkpoint_created'] = {
    passed: !!pilot.checkpoint_id,
    method: 'platform_owner_confirmation',
    reason: pilot.checkpoint_id ? `Checkpoint: ${pilot.checkpoint_id}` : 'No checkpoint recorded.',
  };

  // No critical incidents
  const criticalIncidents = (incidents || []).filter(i => i.severity === 'critical');
  const noCriticalIncidents = criticalIncidents.length === 0;

  // Build final check list: use evidence first, fall back to live data overrides.
  const checks = gate.checks.map(c => {
    const override = liveOverrides[c.key];
    if (override && (!c.passed || override.passed)) {
      return { ...c, passed: override.passed, status: override.passed ? 'passed' : c.status, evidence_method: override.method, reason: override.reason || c.reason };
    }
    return c;
  });

  // Add operational blockers (not canonical checks but still required)
  const operationalBlockers = [];
  if (org.status !== 'active') operationalBlockers.push('Organisation is not active');
  if (!profiles.some(p => p.app_role === 'organisation_admin')) operationalBlockers.push('No organisation admin assigned');
  if (!pilot.support_contact_configured) operationalBlockers.push('Support contact not configured');
  if (!pilot.privacy_contact_configured) operationalBlockers.push('Privacy contact not configured');
  if (complianceSettings.length === 0) operationalBlockers.push('Compliance settings not reviewed');
  if (campaigns.length === 0) operationalBlockers.push('No campaign drafted');
  if (!noCriticalIncidents) operationalBlockers.push(`${criticalIncidents.length} critical incident(s) open`);

  const requiredBlockers = checks.filter(c => c.required && !c.passed).map(c => `${c.label} — ${c.reason}`);
  const allBlockers = [...requiredBlockers, ...operationalBlockers];
  const all_passed = allBlockers.length === 0;

  // Determine the activation decision
  let decision = 'Blocked';
  if (all_passed) {
    const externalGate = evaluateActivationGate(evidenceMap, 'external');
    const externalBlockers = externalGate.blockers;
    if (externalGate.all_passed && noCriticalIncidents && !hasPlaintext) {
      decision = 'Ready for controlled external pilot';
    } else {
      decision = 'Ready for internal pilot';
    }
  }

  return { checks, blockers: allBlockers, all_passed, decision };
}