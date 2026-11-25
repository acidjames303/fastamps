import { resolveTenant } from '../../shared/tenantAuth.ts';
import { requireCapability, pickSelfEditable, capabilitiesForMembership } from '../../shared/authorization.ts';
import { CANONICAL_ORGANISATION_ID } from '../../shared/tenantConfig.ts';

// Isolated authorisation matrix. Runs against SYNTHETIC users and a synthetic
// organisation only — never against a live operational account. Exercises the
// canonical authorisation module directly. Callable by a platform owner only.
// Synthetic access records are written against the single production
// organisation, so the canonical check is exercised exactly as in production.
const ORG = CANONICAL_ORGANISATION_ID;
const OTHER_ORG = '6a86323360382f610979ea98'; // retired isolation-test workspace

async function expectDenied(fn: () => Promise<any>) {
  try {
    await fn();
    return 'ALLOWED - PROBLEM';
  } catch (e) {
    return `denied (${e.status || 'error'})`;
  }
}

async function expectAllowed(fn: () => Promise<any>) {
  try {
    await fn();
    return 'allowed';
  } catch (e) {
    return `DENIED - PROBLEM (${e.message})`;
  }
}

export default async function (req) {
  let createdIds = [];
  let service = null;
  try {
    const { base44, membership, profile } = await resolveTenant(req);
    service = base44.asServiceRole.entities;
    if (membership.role !== 'platform_owner') {
      return Response.json({ error: 'Only a platform owner may run the security self-test.' }, { status: 403 });
    }
    const now = new Date().toISOString();
    const expired = new Date(Date.now() - 86400000).toISOString();

    const mk = async (id, role, patch = {}) => {
      const rec = await service.OrganisationMembership.create({
        user_id: id,
        organisation_id: ORG,
        role,
        capabilities: [],
        status: 'active',
        created_by_user_id: 'security-self-test',
        approved_by_user_id: 'security-self-test',
        created_at: now,
        updated_at: now,
        version: 1,
        notes: 'synthetic_security_test',
        ...patch,
      });
      createdIds.push(rec.id);
      return rec;
    };

    await mk('sec-test-sdr', 'bdm');
    await mk('sec-test-admin', 'organisation_admin');
    await mk('sec-test-owner', 'platform_owner');
    await mk('sec-test-disabled', 'organisation_admin', { status: 'disabled' });
    await mk('sec-test-expired', 'organisation_admin', { expires_at: expired });

    const asUser = (id: string) => ({ id });

    const results = {
      'SDR changes own role to platform owner': await expectDenied(() =>
        requireCapability(base44, asUser('sec-test-sdr'), 'providers')),
      'SDR supplies another organisation': await expectDenied(() =>
        requireCapability(base44, asUser('sec-test-sdr'), 'calling', OTHER_ORG)),
      'SDR requests provider enrichment (Lusha/Apollo)': await expectDenied(() =>
        requireCapability(base44, asUser('sec-test-sdr'), 'providers')),
      'SDR requests public/AI research': await expectDenied(() =>
        requireCapability(base44, asUser('sec-test-sdr'), 'prospecting')),
      'SDR requests CSV export': await expectDenied(() =>
        requireCapability(base44, asUser('sec-test-sdr'), 'export')),
      'SDR requests platform capability': await expectDenied(() =>
        requireCapability(base44, asUser('sec-test-sdr'), 'platform')),
      'SDR requests team management': await expectDenied(() =>
        requireCapability(base44, asUser('sec-test-sdr'), 'team_management')),
      'Disabled membership attempts access': await expectDenied(() =>
        requireCapability(base44, asUser('sec-test-disabled'), 'reporting')),
      'Expired membership attempts access': await expectDenied(() =>
        requireCapability(base44, asUser('sec-test-expired'), 'reporting')),
      'Unknown user with no membership': await expectDenied(() =>
        requireCapability(base44, asUser('sec-test-unknown'), 'calling')),
      'SDR records a call outcome': await expectAllowed(() =>
        requireCapability(base44, asUser('sec-test-sdr'), 'calling')),
      'Campaign administrator exports': await expectAllowed(() =>
        requireCapability(base44, asUser('sec-test-admin'), 'export')),
      'Campaign administrator grants platform owner': await expectDenied(() =>
        requireCapability(base44, asUser('sec-test-admin'), 'platform')),
      'Platform owner performs platform operation': await expectAllowed(() =>
        requireCapability(base44, asUser('sec-test-owner'), 'platform')),
      'Profile self-edit of app_role rejected': await expectDenied(async () =>
        pickSelfEditable({ app_role: 'platform_owner', full_name: 'x' })),
      'Profile self-edit of organisation rejected': await expectDenied(async () =>
        pickSelfEditable({ organisation_id: OTHER_ORG })),
      'Safe profile preference edit accepted': await expectAllowed(async () =>
        pickSelfEditable({ full_name: 'Synthetic Tester' })),
    };

    const caps = {
      sdr: capabilitiesForMembership({ role: 'bdm' }),
      admin: capabilitiesForMembership({ role: 'organisation_admin' }),
    };

    return Response.json({
      ok: true,
      scope: 'synthetic identities only',
      caller: { role: profile.app_role, organisation_id: profile.organisation_id },
      results,
      capabilities: caps,
      failures: Object.entries(results).filter(([, v]) => String(v).includes('PROBLEM')).map(([k]) => k),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  } finally {
    // Synthetic test memberships never outlive the run.
    if (service) {
      for (const id of createdIds) {
        try { await service.OrganisationMembership.delete(id); } catch (_) { /* already gone */ }
      }
    }
  }
}