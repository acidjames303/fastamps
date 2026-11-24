import { resolveTenant } from '../../shared/tenantAuth.ts';

// Fail-closed login certification. OrganisationMembership is the authoritative
// source of role and capabilities. UserProfile is a display mirror only, and a
// stale built-in User.app_role must never reduce or expand access.
export default async function (req) {
  try {
    const { base44, user, profile, org, membership, capabilities } = await resolveTenant(req);

    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.id });
    const active = (profiles || []).filter((p) => p.status === 'active' || p.status === 'invited');
    if (active.length !== 1) {
      return Response.json({
        error: active.length ? 'This login is linked to more than one display profile. Access is blocked until an administrator resolves it.' : 'No active user profile was found.',
        code: active.length ? 'ambiguous_tenant_assignment' : 'tenant_assignment_required',
      }, { status: 403 });
    }

    if (active[0].organisation_id !== org.id || membership.organisation_id !== org.id) {
      return Response.json({
        error: 'Your authoritative access record and organisation profile do not match. Access is blocked to protect company data.',
        code: 'tenant_assignment_mismatch',
      }, { status: 409 });
    }

    return Response.json({
      ok: true,
      organisation_id: org.id,
      organisation_name: org.name,
      app_role: profile.app_role,
      capabilities,
      membership_id: membership.id,
      membership_version: membership.version || 1,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Tenant verification failed.', code: 'tenant_verification_failed' }, { status: error.status || 500 });
  }
}
