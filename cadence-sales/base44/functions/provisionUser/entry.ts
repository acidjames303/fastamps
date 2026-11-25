import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { CANONICAL_ORGANISATION_ID, isCanonicalOrganisation } from '../../shared/tenantConfig.ts';

// Access is invite-only. An administrator creates the pending Internal User
// Access record; when the invited person signs in, this function links their
// account to it inside the single B2B Sales Leads organisation.
//
// This function NEVER creates an organisation: Cadence is not a self-service
// product, and an uninvited sign-in is refused outright.
const ALLOWED_ROLES = ['organisation_admin', 'sales_manager', 'internal_bd', 'bdm', 'reporting_user'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const service = base44.asServiceRole.entities;

    const existing = await service.OrganisationMembership.filter({ user_id: user.id });
    if ((existing || []).length) {
      return Response.json({ ok: true, action: 'already_provisioned' });
    }

    // Find the pending invitation created by an administrator.
    let profile = (await service.UserProfile.filter({ user_id: user.id }))[0];
    if (!profile && user.email) {
      const invited = (await service.UserProfile.filter({ email: user.email }))
        .filter((p) => p.status === 'invited');
      if (invited.length > 1) {
        await base44.asServiceRole.entities.AuditLog.create({
          organisation_id: CANONICAL_ORGANISATION_ID,
          actor_user_id: '',
          action: 'security_access_denied',
          entity_type: 'UserProfile',
          entity_id: '',
          new_value: 'duplicate_invitations_require_admin_review',
          timestamp: new Date().toISOString(),
        }).catch(() => {});
        return Response.json({
          ok: false,
          code: 'duplicate_invitations',
          error: 'This email has more than one pending invitation. An administrator must resolve it before access is granted.',
        }, { status: 409 });
      }
      profile = invited[0];
    }

    // No invitation: refuse. No organisation is created and no data is exposed.
    if (!profile) {
      await base44.asServiceRole.entities.AuditLog.create({
        organisation_id: CANONICAL_ORGANISATION_ID,
        actor_user_id: user.id,
        action: 'security_access_denied',
        entity_type: 'UserProfile',
        entity_id: '',
        new_value: 'uninvited_sign_in',
        timestamp: new Date().toISOString(),
      }).catch(() => {});
      return Response.json({
        ok: false,
        code: 'invite_required',
        error: 'Cadence access is invite-only. Ask a B2B Sales Leads administrator to invite you.',
      }, { status: 403 });
    }

    // A legacy invitation from an old test workspace can never grant production access.
    if (profile.organisation_id && !isCanonicalOrganisation(profile.organisation_id)) {
      return Response.json({
        ok: false,
        code: 'invitation_not_in_production',
        error: 'This invitation belongs to a retired workspace. Ask an administrator to invite you to B2B Sales Leads.',
      }, { status: 403 });
    }
    if (profile.status === 'suspended') {
      return Response.json({ ok: false, error: 'Your account is suspended.' }, { status: 403 });
    }

    const org = await service.Organisation.get(CANONICAL_ORGANISATION_ID);
    if (!org || org.status !== 'active') {
      return Response.json({ ok: false, error: 'Production organisation is not available.' }, { status: 403 });
    }

    const now = new Date().toISOString();
    await service.UserProfile.update(profile.id, {
      user_id: user.id,
      organisation_id: CANONICAL_ORGANISATION_ID,
      status: 'active',
      email: profile.email || user.email || '',
    });

    // The role comes from the invitation an administrator wrote, validated
    // against the permitted set. It is never taken from the caller's payload.
    const role = ALLOWED_ROLES.includes(profile.app_role) ? profile.app_role : 'bdm';
    await service.OrganisationMembership.create({
      user_id: user.id,
      organisation_id: CANONICAL_ORGANISATION_ID,
      role,
      capabilities: [],
      status: 'active',
      created_by_user_id: profile.created_by_user_id || user.id,
      approved_by_user_id: user.id,
      created_at: now,
      updated_at: now,
      version: 1,
      notes: 'invitation_accepted',
    });

    await base44.asServiceRole.entities.AuditLog.create({
      organisation_id: CANONICAL_ORGANISATION_ID,
      actor_user_id: user.id,
      action: 'membership_created',
      entity_type: 'OrganisationMembership',
      entity_id: '',
      new_value: JSON.stringify({ role, source: 'invitation_accepted' }),
      timestamp: now,
    }).catch(() => {});

    // Display-only mirror. It grants no authority.
    await base44.auth.updateMe({ organisation_id: CANONICAL_ORGANISATION_ID, app_role: role });

    return Response.json({ ok: true, action: 'provisioned', organisation_id: CANONICAL_ORGANISATION_ID, app_role: role });
  } catch (error) {
    return Response.json({ error: error.message, code: 'provisioning_failed' }, { status: error.status || 500 });
  }
}