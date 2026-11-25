import { resolveTenant } from '../../shared/tenantAuth.ts';
import { resolveSubscription, getEffectiveLimits, getUsageMetrics, getSeatAllowance, trialDaysRemaining, isTrialValid } from '../../shared/entitlements.ts';

// Returns subscription, plan, and usage data for the org admin Usage & Billing page.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (!['platform_owner', 'organisation_admin'].includes(profile.app_role)) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    const subscription = await resolveSubscription(base44, org);
    const limits = getEffectiveLimits(subscription);
    const usage = subscription ? await getUsageMetrics(base44, subscription) : null;
    const seatAllowance = getSeatAllowance(subscription);

    // Count active seats
    const activeProfiles = await base44.asServiceRole.entities.UserProfile.filter(
      { organisation_id: org.id, status: 'active' }, '-created_date', 500
    ).catch(() => []);

    // Database records do not consume Smart Actions. Surface capacity separately
    // so teams can see how multiple lists affect their plan.
    const [contacts, prospectLists] = await Promise.all([
      base44.asServiceRole.entities.Contact.filter(
        { organisation_id: org.id }, '-created_date', 5000
      ).catch(() => []),
      base44.asServiceRole.entities.ProspectList.filter(
        { organisation_id: org.id }, '-created_date', 5000
      ).catch(() => []),
    ]);
    const activeLists = prospectLists.filter((list) => list.status !== 'archived');

    // Get plan details if subscription exists
    let plan = null;
    if (subscription?.plan_id) {
      plan = await base44.asServiceRole.entities.SubscriptionPlan.get(subscription.plan_id).catch(() => null);
    }

    return Response.json({
      organisation: {
        id: org.id,
        name: org.name,
        status: org.status,
        onboarding_progress: org.onboarding_progress || {},
        onboarding_completed_at: org.onboarding_completed_at || null,
        automatic_company_research: org.settings?.automatic_company_research === true,
      },
      subscription: subscription ? {
        id: subscription.id,
        plan_id: subscription.plan_id,
        plan_code: subscription.plan_code,
        status: subscription.status,
        billing_interval: subscription.billing_interval,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        trial_start: subscription.trial_start,
        trial_end: subscription.trial_end,
        trial_days_remaining: trialDaysRemaining(subscription),
        is_trial_valid: isTrialValid(subscription),
        cancel_at_period_end: subscription.cancel_at_period_end,
        last_payment_status: subscription.last_payment_status,
        last_payment_error: subscription.last_payment_error,
        override_reason: subscription.override_reason || null,
      } : null,
      plan: plan ? {
        name: plan.name,
        code: plan.code,
        price_gbp: plan.price_gbp,
        billing_interval: plan.billing_interval,
        overage_policy: plan.overage_policy,
        trial_days: plan.trial_days,
      } : null,
      limits,
      usage,
      data_capacity: {
        contacts_used: contacts.length,
        contacts_limit: limits?.maximum_contacts || 0,
        active_lists_used: activeLists.length,
        active_lists_limit: limits?.maximum_active_lists || 0,
        storage_limit_mb: limits?.included_storage_mb || 0,
        retention_days: limits?.default_retention_days || null,
        note: 'Saving and viewing lists does not consume Smart Actions.',
      },
      seats: {
        used: activeProfiles.length,
        included: seatAllowance.included,
        maximum: seatAllowance.maximum,
        admins_used: activeProfiles.filter(p => p.app_role === 'organisation_admin').length,
        admins_included: limits?.included_admins || 1,
        sdrs_used: activeProfiles.filter(p => !['organisation_admin', 'platform_owner'].includes(p.app_role)).length,
        sdrs_included: limits?.included_sdrs || 0,
        additional_sdr_price_gbp: limits?.additional_sdr_price_gbp || 35,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}