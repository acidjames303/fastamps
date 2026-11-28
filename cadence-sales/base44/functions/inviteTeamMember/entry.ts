import { resolveTenant } from '../../shared/tenantAuth.ts';
import { isCanonicalOrganisation } from '../../shared/tenantConfig.ts';
import { resolveSubscription, getEffectiveLimits } from '../../shared/entitlements.ts';

// Secure server-side team invitation.
// - Only platform_owner or organisation_admin may invite.
// - Invites always join the caller's own organisation (org_id comes from the
//   trusted UserProfile, never from the client).
// - platform_owner can never be assigned.
// - Creates an invited UserProfile (status=invited, user_id empty) that
//   provisionUser links when the invitee first logs in.
const ALLOWED_ROLES = ['organisation_admin', 'sales_manager', 'bdm', 'reporting_user'];

export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (profile.app_role !== 'platform_owner' && profile.app_role !== 'organisation_admin') {
      return Response.json({ error: 'You do not have permission to invite users.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { email, app_role, full_name, job_title, organisation_id } = body || {};
    if (!email) return Response.json({ error: 'email required' }, { status: 400 });
    if (app_role === 'platform_owner') {
      return Response.json({ error: 'Cannot assign the platform_owner role.' }, { status: 403 });
    }
    const role = ALLOWED_ROLES.includes(app_role) ? app_role : 'bdm';

    // Cadence has one production organisation. An organisation id supplied by the
    // browser cannot redirect an invitation anywhere else.
    if (organisation_id && !isCanonicalOrganisation(organisation_id)) {
      return Response.json({ error: 'Cadence uses a single production organisation.' }, { status: 403 });
    }
    const targetOrg = org;

    // Enforce commercial seat limits for paying orgs.
    // Platform owners bypass — they need to seed pilot/demo teams regardless of plan.
    if (profile.app_role !== 'platform_owner') {
      const subscription = await resolveSubscription(base44, targetOrg);
      const limits = getEffectiveLimits(subscription) || {};
      const maximumUsers = Number(limits.maximum_users || limits.included_users || 0);
      const adminLimit = Number(limits.included_admins || 1);
      const sdrLimit = Number(limits.included_sdrs ?? Math.max(0, maximumUsers - adminLimit));
      const currentProfiles = await base44.asServiceRole.entities.UserProfile.filter(
        { organisation_id: targetOrg.id }, '-created_date', 500
      );
      const occupied = currentProfiles.filter(p => ['active', 'invited'].includes(p.status));
      // Platform owners don't consume customer seat quotas.
      const billable = occupied.filter(p => p.app_role !== 'platform_owner');
      const admins = billable.filter(p => p.app_role === 'organisation_admin').length;
      const nonAdmins = billable.filter(p => p.app_role !== 'organisation_admin').length;

      if (maximumUsers > 0 && billable.length >= maximumUsers) {
        return Response.json({ error: `Your plan includes ${maximumUsers} account${maximumUsers === 1 ? '' : 's'}. Upgrade or add an SDR seat before inviting another user.`, code: 'seat_limit_reached' }, { status: 409 });
      }
      if (role === 'organisation_admin' && admins >= adminLimit) {
        return Response.json({ error: `Your plan includes ${adminLimit} Operations Admin account${adminLimit === 1 ? '' : 's'}.`, code: 'admin_seat_limit_reached' }, { status: 409 });
      }
      if (role !== 'organisation_admin' && nonAdmins >= sdrLimit) {
        return Response.json({ error: `Your plan includes ${sdrLimit} SDR account${sdrLimit === 1 ? '' : 's'}. Additional SDRs are £${limits.additional_sdr_price_gbp || 35}/month.`, code: 'sdr_seat_limit_reached' }, { status: 409 });
      }
    }

    try {
      await base44.users.inviteUser(email.trim(), 'user');
    } catch (e) {
      return Response.json({ error: 'Could not send invitation: ' + (e.message || 'unknown error') }, { status: 502 });
    }

    // Idempotent: reuse an existing invited profile in the target org by email.
    const existing = await base44.asServiceRole.entities.UserProfile.filter({ email: email.trim(), organisation_id: targetOrg.id });
    let up;
    if (existing.length) {
      up = existing[0];
      await base44.asServiceRole.entities.UserProfile.update(up.id, {
        app_role: role,
        job_title: job_title || up.job_title,
        full_name: full_name || up.full_name,
      });
    } else {
      up = await base44.asServiceRole.entities.UserProfile.create({
        user_id: '',
        organisation_id: targetOrg.id,
        full_name: full_name || '',
        email: email.trim(),
        app_role: role,
        job_title: job_title || '',
        status: 'invited',
        created_at: new Date().toISOString(),
      });
    }

    // New BDMs get a welcome email so they can start their journey straight away.
    // A failed welcome never blocks the invitation itself.
    if (role === 'bdm') {
      const firstName = (full_name || '').trim().split(/\s+/)[0]
        || email.trim().split('@')[0].split(/[._-]/)[0].replace(/^./, (c) => c.toUpperCase());
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email.trim(),
          template_name: 'Welcome',
          category: 'marketing',
          variables: {
            first_name: firstName,
            cta_url: 'https://cadence.smartfunction.io/app',
          },
        });
      } catch (e) {
        console.error('Welcome email failed for', email.trim(), e?.message);
      }
    }

    return Response.json({ ok: true, profile_id: up.id, app_role: role, organisation: targetOrg.name });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}