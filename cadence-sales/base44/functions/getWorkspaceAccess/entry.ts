import { resolveTenant } from '../../shared/tenantAuth.ts';
import { resolveSubscription, trialDaysRemaining } from '../../shared/entitlements.ts';

const TRIAL_USE_LIMIT = 50;

export default async function(req) {
  try {
    const { base44, profile, org } = await resolveTenant(req);
    const subscription = await resolveSubscription(base44, org);
    const now = Date.now();

    const trialExpired = subscription?.status === 'trialing'
      && subscription?.trial_end
      && new Date(subscription.trial_end).getTime() <= now;

    // Count calls made during the trial period (the core "use" of the workspace)
    let usageCount = 0;
    if (subscription?.status === 'trialing') {
      const calls = await base44.asServiceRole.entities.CallLog.filter(
        { organisation_id: org.id }, '-created_date', 5000
      );
      const trialStart = subscription.trial_start;
      usageCount = (calls || []).filter(c => {
        const ts = c.started_at || c.created_date;
        return ts && (!trialStart || ts >= trialStart);
      }).length;
    }
    const usageLimitReached = subscription?.status === 'trialing' && usageCount >= TRIAL_USE_LIMIT;

    // Hard lock only for suspended/cancelled accounts.
    // Trial expiry and usage limit show a subscription pop-up instead.
    const inactiveStatus = subscription && ['suspended', 'cancelled'].includes(subscription.status);
    const readOnly = Boolean(inactiveStatus);
    const subscriptionRequired = Boolean(trialExpired || usageLimitReached);

    return Response.json({
      read_only: readOnly,
      subscription_required: subscriptionRequired,
      reason: readOnly
        ? (subscription?.status || 'inactive')
        : trialExpired
          ? 'trial_expired'
          : usageLimitReached
            ? 'usage_limit_reached'
            : null,
      trial_end: subscription?.trial_end || null,
      trial_start: subscription?.trial_start || null,
      plan_code: subscription?.plan_code || null,
      subscription_status: subscription?.status || 'none',
      // Authoritative identity for the UI. Never render permissions from the
      // legacy built-in User.app_role claim.
      app_role: profile.app_role,
      capabilities: profile.capabilities || [],
      membership_id: profile.membership_id,
      membership_version: profile.membership_version || 1,
      can_manage_billing: ['platform_owner', 'organisation_admin'].includes(profile.app_role),
      exports_available: true,
      trial_usage_count: usageCount,
      trial_usage_limit: TRIAL_USE_LIMIT,
      trial_days_remaining: subscription?.status === 'trialing' ? trialDaysRemaining(subscription) : 0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}