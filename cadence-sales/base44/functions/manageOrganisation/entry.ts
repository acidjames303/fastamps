import { resolveTenant } from '../../shared/tenantAuth.ts';
import { CANONICAL_ORGANISATION_ID, isCanonicalOrganisation } from '../../shared/tenantConfig.ts';

// Platform-owner-only organisation management.
// Organisation admins can only ever operate within their own organisation (every
// other function derives org_id from the trusted UserProfile). Cross-organisation
// moves and new-organisation creation are restricted to the platform owner here.
//
// Actions:
//  - list_orgs:  returns all organisations (id/name/slug/status)
//  - list_users: returns all UserProfiles (user_id/full_name/email/app_role/org/status)
//  - create_org: { name } → creates an active Organisation
//  - move_user:  { user_id, target_org_id, app_role? } → moves a user's UserProfile
//                to the target org and mirrors organisation_id + app_role + role
//                onto the built-in User record so RLS re-evaluates on next login.
async function createTrialSubscription(base44, organisationId) {
  const plans = await base44.asServiceRole.entities.SubscriptionPlan.filter(
    { code: 'trial', status: 'active' }, 'display_order', 1
  );
  const plan = plans?.[0];
  if (!plan) throw new Error('Active trial plan is not configured.');

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + Number(plan.trial_days || 14));

  return base44.asServiceRole.entities.OrganisationSubscription.create({
    organisation_id: organisationId,
    plan_id: plan.id,
    plan_code: plan.code,
    status: 'trialing',
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    trial_start: now.toISOString(),
    trial_end: periodEnd.toISOString(),
    included_limits_snapshot: {
      included_users: plan.included_users,
      maximum_users: plan.maximum_users,
      included_admins: plan.included_admins || 1,
      included_sdrs: plan.included_sdrs || 0,
      additional_sdr_price_gbp: plan.additional_sdr_price_gbp || 35,
      included_smart_actions: plan.included_smart_actions,
      included_storage_mb: plan.included_storage_mb,
      maximum_contacts: plan.maximum_contacts,
      maximum_active_lists: plan.maximum_active_lists,
      default_retention_days: plan.default_retention_days,
      core_workflow_policy: plan.core_workflow_policy || 'unlimited_fair_use',
      provider_billing_model: plan.provider_billing_model || 'customer_owned',
      feature_flags: plan.feature_flags || {},
      overage_policy: plan.overage_policy || 'block',
    },
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
}

export default async function (req) {
  try {
    const { base44, user, profile } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body || {};

    // Organisation admins can change a user's role within their own org.
    // All other actions remain platform_owner-only.
    if (action === 'change_role') {
      if (profile.app_role !== 'platform_owner' && profile.app_role !== 'organisation_admin') {
        return Response.json({ error: 'Only organisation admins can change user roles.' }, { status: 403 });
      }
      const { user_id, app_role } = body || {};
      if (!user_id || !app_role) {
        return Response.json({ error: 'user_id and app_role required' }, { status: 400 });
      }
      const validRoles = ['organisation_admin', 'sales_manager', 'bdm', 'reporting_user'];
      if (!validRoles.includes(app_role)) {
        return Response.json({ error: 'Invalid role. Allowed: ' + validRoles.join(', ') }, { status: 400 });
      }
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id });
      if (!profiles.length) return Response.json({ error: 'UserProfile not found.' }, { status: 404 });
      const up = profiles[0];
      // Org admins can only change users within their own organisation.
      if (profile.app_role !== 'platform_owner' && up.organisation_id !== profile.organisation_id) {
        return Response.json({ error: 'You can only manage users in your own organisation.' }, { status: 403 });
      }
      // The authoritative role lives on Internal User Access, not on the profile.
      if (!isCanonicalOrganisation(up.organisation_id)) {
        return Response.json({ error: 'That user belongs to a retired workspace.' }, { status: 403 });
      }
      const memberships = await base44.asServiceRole.entities.OrganisationMembership.filter({ user_id });
      const target = (memberships || []).find((m) => isCanonicalOrganisation(m.organisation_id));
      if (!target) return Response.json({ error: 'No internal access record for that user.' }, { status: 404 });
      if (target.user_id === user.id) {
        return Response.json({ error: 'You cannot change your own role.' }, { status: 403 });
      }
      if (target.role === 'platform_owner' && profile.app_role !== 'platform_owner') {
        return Response.json({ error: 'Only the platform owner may change a platform owner.' }, { status: 403 });
      }
      await base44.asServiceRole.entities.OrganisationMembership.update(target.id, {
        role: app_role,
        capabilities: [],
        version: (target.version || 1) + 1,
        updated_at: new Date().toISOString(),
      });
      await base44.asServiceRole.entities.UserProfile.update(up.id, { app_role });
      await base44.asServiceRole.entities.AuditLog.create({
        organisation_id: CANONICAL_ORGANISATION_ID,
        actor_user_id: user.id,
        action: 'membership_changed',
        entity_type: 'OrganisationMembership',
        entity_id: target.id,
        previous_value: JSON.stringify({ role: target.role }),
        new_value: JSON.stringify({ role: app_role }),
        timestamp: new Date().toISOString(),
      }).catch(() => {});
      return Response.json({ ok: true, user_id, app_role });
    }

    // Everything below is platform-owner-only.
    if (profile.app_role !== 'platform_owner') {
      return Response.json({ error: 'Only the platform owner can manage organisations.' }, { status: 403 });
    }

    if (action === 'list_orgs') {
      const orgs = await base44.asServiceRole.entities.Organisation.list('-created_date', 100);
      return Response.json({
        ok: true,
        orgs: orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug, status: o.status })),
      });
    }

    if (action === 'list_users') {
      const all = await base44.asServiceRole.entities.UserProfile.list('-created_date', 200);
      // Org admins only see their own org's users.
      const profiles = profile.app_role === 'platform_owner'
        ? all
        : all.filter((p) => p.organisation_id === profile.organisation_id);
      return Response.json({
        ok: true,
        users: profiles.map((p) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          app_role: p.app_role,
          organisation_id: p.organisation_id,
          status: p.status,
        })),
      });
    }

    // Cadence is one production organisation. Creating customer organisations,
    // moving users between them and workspace switching are not product features:
    // access is invite-only inside B2B Sales Leads.
    if (['create_org', 'create_org_and_move_user', 'move_user'].includes(action)) {
      return Response.json({
        error: 'Cadence uses a single production organisation. Organisation creation and workspace switching are disabled.',
      }, { status: 403 });
    }



    return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}