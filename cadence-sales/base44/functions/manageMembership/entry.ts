import { resolveTenant } from '../../shared/tenantAuth.ts';
import { auditSecurity, forbidden, capabilitiesForMembership } from '../../shared/authorization.ts';

// Server-side administration of OrganisationMembership — the authoritative
// security record. Direct entity writes are blocked by entity permissions;
// every privileged change goes through this function, which verifies the actor.
const PLATFORM_ONLY = ['platform_owner'];

export default async function (req) {
  try {
    const { base44, user, profile, membership: actor } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const service = base44.asServiceRole.entities;
    const now = new Date().toISOString();
    const isPlatform = actor.role === 'platform_owner';
    const canManageTeam = isPlatform || capabilitiesForMembership(actor).includes('team_management');

    const targetMembership = async () => {
      if (!body.membership_id) throw forbidden('membership_id is required.', 400);
      const rows = await service.OrganisationMembership.filter({ id: body.membership_id });
      const m = rows && rows[0];
      if (!m) throw forbidden('Membership not found.', 404);
      return m;
    };

    const assertActorMayManage = (target: any, { allowPlatformGrant = false } = {}) => {
      if (target.user_id === user.id && !isPlatform) {
        throw forbidden('You cannot change your own role, organisation or capabilities.');
      }
      if (target.user_id === user.id) {
        throw forbidden('You cannot change your own role, organisation or capabilities. Ask another platform owner.');
      }
      if (isPlatform) return;
      if (!canManageTeam) throw forbidden('Your role does not permit membership management.');
      if (target.organisation_id !== actor.organisation_id) {
        throw forbidden('That member belongs to another organisation.');
      }
      if (target.role === 'platform_owner') {
        throw forbidden('Only a platform owner may manage a platform owner.');
      }
      if (allowPlatformGrant) throw forbidden('Only a platform owner may grant platform owner status.');
    };

    const writeMembership = async (target: any, patch: any, auditAction: string, previous: string) => {
      const updated = await service.OrganisationMembership.update(target.id, {
        ...patch,
        updated_at: now,
        version: (target.version || 1) + 1,
      });
      await auditSecurity(base44, {
        organisationId: updated.organisation_id,
        actorUserId: user.id,
        action: auditAction,
        entityType: 'OrganisationMembership',
        entityId: target.id,
        previousValue: previous,
        newValue: JSON.stringify({ role: updated.role, status: updated.status, organisation_id: updated.organisation_id }),
      });
      return updated;
    };

    // Mirrors the authoritative values onto the display profile and the built-in
    // User record. These copies are never used to authorise anything.
    const mirror = async (userId: string, values: any) => {
      const profiles = await service.UserProfile.filter({ user_id: userId });
      const p = profiles && profiles[0];
      if (p) await service.UserProfile.update(p.id, values);
    };

    if (action === 'list') {
      if (!canManageTeam) throw forbidden('Your role does not permit viewing memberships.');
      const rows = isPlatform
        ? await service.OrganisationMembership.list('-created_date', 500)
        : await service.OrganisationMembership.filter({ organisation_id: actor.organisation_id });
      return Response.json({ ok: true, memberships: rows || [] });
    }

    if (action === 'invite') {
      if (!canManageTeam) throw forbidden('Your role does not permit inviting users.');
      const email = String(body.email || '').trim().toLowerCase();
      const role = String(body.role || 'bdm');
      if (!email) throw forbidden('An email address is required.', 400);
      if (role === 'platform_owner' && !isPlatform) throw forbidden('Only a platform owner may grant platform owner status.');
      const orgId = isPlatform && body.organisation_id ? String(body.organisation_id) : actor.organisation_id;

      const created = await service.OrganisationMembership.create({
        user_id: String(body.user_id || ''),
        organisation_id: orgId,
        role,
        capabilities: [],
        status: 'invited',
        created_by_user_id: user.id,
        approved_by_user_id: user.id,
        created_at: now,
        updated_at: now,
        version: 1,
        notes: String(body.notes || ''),
      });
      await service.UserProfile.create({
        organisation_id: orgId,
        email,
        full_name: String(body.full_name || email),
        app_role: role,
        status: 'invited',
        created_at: now,
      });
      await auditSecurity(base44, {
        organisationId: orgId,
        actorUserId: user.id,
        action: 'membership_created',
        entityType: 'OrganisationMembership',
        entityId: created.id,
        newValue: JSON.stringify({ email, role }),
      });
      return Response.json({ ok: true, membership: created });
    }

    if (action === 'assign_organisation') {
      if (!isPlatform) throw forbidden('Only a platform owner may move a member between organisations.');
      const target = await targetMembership();
      assertActorMayManage(target, { allowPlatformGrant: true });
      if (!body.organisation_id) throw forbidden('organisation_id is required.', 400);
      const org = await service.Organisation.get(String(body.organisation_id));
      if (!org) throw forbidden('Organisation not found.', 404);
      const updated = await writeMembership(
        target,
        { organisation_id: org.id },
        'membership_changed',
        JSON.stringify({ organisation_id: target.organisation_id, role: target.role }),
      );
      await mirror(target.user_id, { organisation_id: org.id });
      return Response.json({ ok: true, membership: updated });
    }

    if (action === 'change_role') {
      const target = await targetMembership();
      assertActorMayManage(target, { allowPlatformGrant: true });
      const role = String(body.role || '');
      if (!role) throw forbidden('role is required.', 400);
      if (role === 'platform_owner' && !isPlatform) throw forbidden('Only a platform owner may grant platform owner status.');
      if (target.role === 'platform_owner' && !isPlatform) throw forbidden('Only a platform owner may change a platform owner.');
      const updated = await writeMembership(
        target,
        { role, capabilities: [] },
        'membership_changed',
        JSON.stringify({ role: target.role }),
      );
      await mirror(target.user_id, { app_role: role });
      return Response.json({ ok: true, membership: updated });
    }

    if (action === 'grant_capability' || action === 'revoke_capability') {
      const target = await targetMembership();
      assertActorMayManage(target, { allowPlatformGrant: true });
      const capability = String(body.capability || '');
      if (!capability) throw forbidden('capability is required.', 400);
      if (capability === 'platform' && !isPlatform) throw forbidden('Only a platform owner may grant platform authority.');
      const current = capabilitiesForMembership(target);
      const next = action === 'grant_capability'
        ? [...new Set([...current, capability])]
        : current.filter((c: string) => c !== capability);
      const updated = await writeMembership(
        target,
        { capabilities: next },
        'membership_changed',
        JSON.stringify({ capabilities: current }),
      );
      return Response.json({ ok: true, membership: updated });
    }

    if (action === 'disable' || action === 'restore') {
      const target = await targetMembership();
      assertActorMayManage(target, { allowPlatformGrant: true });
      const updated = await writeMembership(
        target,
        action === 'disable'
          ? { status: 'disabled', disabled_at: now }
          : { status: 'active', disabled_at: null },
        action === 'disable' ? 'membership_disabled' : 'membership_restored',
        JSON.stringify({ status: target.status }),
      );
      return Response.json({ ok: true, membership: updated });
    }

    if (action === 'remove_membership') {
      if (!isPlatform) throw forbidden('Only a platform owner may remove a membership.');
      const target = await targetMembership();
      if (target.user_id === user.id) throw forbidden('You cannot remove your own membership.');
      await service.OrganisationMembership.delete(target.id);
      await auditSecurity(base44, {
        organisationId: target.organisation_id,
        actorUserId: user.id,
        action: 'membership_disabled',
        entityType: 'OrganisationMembership',
        entityId: target.id,
        previousValue: JSON.stringify({ role: target.role, status: target.status }),
        newValue: 'removed',
      });
      return Response.json({ ok: true, removed: target.id });
    }

    throw forbidden('Unknown membership action.', 400);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}