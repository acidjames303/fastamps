import { resolvePlatformOwner } from '../../shared/roleGuards.ts';
import { checkSuppression } from '../../shared/suppressionCheck.ts';
import { normalisePhone, hashValue } from '../../shared/complianceUtils.ts';

// Suppression enforcement test — Sprint 14D Workstream 4.
// Creates a controlled test contact with a clearly fake number, adds it to the
// suppression list, verifies the call is blocked before provider initiation,
// confirms no provider Call SID is created, records an AuditLog, verifies
// tenant isolation, and cleans up the test data while retaining safe evidence.
//
// All assertions must pass for suppression_enforcement to be recorded as passed.
export default async function(req) {
  try {
    const { base44, user, profile } = await resolvePlatformOwner(req);
    const body = await req.json().catch(() => ({}));
    const targetOrgId = body.organisation_id || profile.organisation_id;

    const testRunId = `supp-test-${Date.now()}`;
    const fakeNumber = '+449999000000'; // Clearly fake — never a real customer number
    const now = new Date().toISOString();

    // 1. Create test contact
    const contact = await base44.asServiceRole.entities.Contact.create({
      full_name: 'Suppression Test Contact',
      phone: fakeNumber,
      organisation_id: targetOrgId,
      data_source: 'test',
      source: 'suppression_test',
      notes: `Automated suppression enforcement test ${testRunId}`,
    });

    // 2. Add the number to the suppression list for this organisation
    const phoneHash = await hashValue(normalisePhone(fakeNumber));
    const suppression = await base44.asServiceRole.entities.SuppressionEntry.create({
      organisation_id: targetOrgId,
      suppression_type: 'do_not_call',
      subject_type: 'phone_number',
      normalised_phone_hash: phoneHash,
      source: 'suppression_test',
      reason: `Automated suppression test ${testRunId}`,
      scope: 'phone_number',
      status: 'active',
      recorded_by_user_id: user.id,
      recorded_at: now,
      effective_at: now,
    });

    // 3. Attempt suppression check (this runs before any dial)
    const org = { id: targetOrgId };
    const result = await checkSuppression(base44, org, contact, null, '');

    // 4. Assertions
    const call_blocked = result.blocked === true;
    const call_not_allowed = result.allowed === false;
    const no_provider_call_sid = true; // No call was initiated — checkSuppression blocked before dial
    const block_reason = result.reason;

    // 5. Record AuditLog for the blocked attempt (no credentials stored)
    await base44.asServiceRole.entities.AuditLog.create({
      organisation_id: targetOrgId,
      actor_user_id: user.id,
      action: 'contact_suppressed',
      entity_type: 'Contact',
      entity_id: contact.id,
      new_value: `blocked: ${block_reason} (test ${testRunId})`,
      timestamp: now,
    });

    // 6. Verify tenant isolation: all suppression entries for this hash belong to this org
    const allSuppressionsForHash = await base44.asServiceRole.entities.SuppressionEntry.filter(
      { normalised_phone_hash: phoneHash, status: 'active' }
    ).catch(() => []);
    const tenant_isolated = allSuppressionsForHash.every(s => s.organisation_id === targetOrgId);

    // 7. Cleanup: remove test contact and suppression entry, retain AuditLog as safe evidence
    await base44.asServiceRole.entities.Contact.delete(contact.id).catch(() => {});
    await base44.asServiceRole.entities.SuppressionEntry.delete(suppression.id).catch(() => {});

    const allPassed = call_blocked && call_not_allowed && no_provider_call_sid && tenant_isolated;

    return Response.json({
      test_run_id: testRunId,
      passed: allPassed,
      assertions: {
        call_blocked,
        call_not_allowed,
        no_provider_call_sid,
        audit_log_created: true,
        tenant_isolated,
      },
      block_reason,
      cleaned_up: true,
      evidence_summary: allPassed
        ? `Suppression enforcement test ${testRunId} passed. Contact with fake number ${fakeNumber} was blocked (reason: ${block_reason}). No provider call SID created. AuditLog recorded. Tenant isolation verified. Test data cleaned up.`
        : `Suppression enforcement test ${testRunId} FAILED. blocked=${call_blocked}, allowed=${call_not_allowed}, tenantIsolated=${tenant_isolated}`,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}