import { resolveTenant } from '../../shared/tenantAuth.ts';

// Manual subscription management for platform owners and org admins.
// When Stripe is not connected, this provides the internal entitlement framework.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    const now = new Date().toISOString();

    // Helper: fetch the current active subscription for an org
    async function getActiveSub(orgId) {
      const subs = await base44.asServiceRole.entities.OrganisationSubscription.filter(
        { organisation_id: orgId }, '-created_date', 10
      );
      return subs?.find(s => ['trialing', 'active', 'past_due', 'grace_period'].includes(s.status)) || subs?.[0] || null;
    }

    // Helper: snapshot plan limits
    async function snapshotPlan(planId) {
      const plan = await base44.asServiceRole.entities.SubscriptionPlan.get(planId).catch(() => null);
      if (!plan) return null;
      return {
        included_users: plan.included_users,
        maximum_users: plan.maximum_users,
        included_admins: plan.included_admins || 1,
        included_sdrs: plan.included_sdrs || 0,
        additional_sdr_price_gbp: plan.additional_sdr_price_gbp || 35,
        founding_price_protected: plan.founding_price_protected === true,
        included_smart_actions: plan.included_smart_actions,
        core_workflow_policy: plan.core_workflow_policy || 'unlimited_fair_use',
        provider_billing_model: plan.provider_billing_model || 'customer_owned',
        included_call_minutes: plan.included_call_minutes,
        included_integration_actions: plan.included_integration_actions,
        included_message_actions: plan.included_message_actions,
        included_enrichment_requests: plan.included_enrichment_requests,
        included_research_requests: plan.included_research_requests,
        included_ai_actions: plan.included_ai_actions,
        included_storage_mb: plan.included_storage_mb,
        maximum_contacts: plan.maximum_contacts || 0,
        maximum_active_lists: plan.maximum_active_lists || 0,
        default_retention_days: plan.default_retention_days || 365,
        feature_flags: plan.feature_flags || {},
        overage_policy: plan.overage_policy,
      };
    }

    switch (action) {
      case 'start_trial': {
        if (!['platform_owner', 'organisation_admin'].includes(profile.app_role)) {
          return Response.json({ error: 'Access denied' }, { status: 403 });
        }
        const { plan_id } = body;
        if (!plan_id) return Response.json({ error: 'plan_id required' }, { status: 400 });

        const plan = await base44.asServiceRole.entities.SubscriptionPlan.get(plan_id).catch(() => null);
        if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 });

        const existing = await getActiveSub(org.id);
        if (existing) return Response.json({ error: 'Organisation already has a subscription' }, { status: 409 });

        const limits = await snapshotPlan(plan_id);
        const trialDays = plan.trial_days || 14;
        const trialEnd = new Date(Date.now() + trialDays * 86400000).toISOString();

        const sub = await base44.asServiceRole.entities.OrganisationSubscription.create({
          organisation_id: org.id,
          plan_id: plan.id,
          plan_code: plan.code,
          status: 'trialing',
          billing_interval: plan.billing_interval || 'monthly',
          current_period_start: now,
          current_period_end: trialEnd,
          trial_start: now,
          trial_end: trialEnd,
          included_limits_snapshot: limits,
          last_payment_status: 'none',
          created_at: now,
          updated_at: now,
        });

        // Audit log
        await base44.asServiceRole.entities.AuditLog.create({
          organisation_id: org.id,
          actor_user_id: user.id,
          action: 'credential_updated',
          entity_type: 'OrganisationSubscription',
          entity_id: sub.id,
          new_value: 'trial_started',
          timestamp: now,
        });

        return Response.json({ subscription: sub });
      }

      case 'update_plan': {
        if (!['platform_owner', 'organisation_admin'].includes(profile.app_role)) {
          return Response.json({ error: 'Access denied' }, { status: 403 });
        }
        const { plan_id } = body;
        if (!plan_id) return Response.json({ error: 'plan_id required' }, { status: 400 });

        const plan = await base44.asServiceRole.entities.SubscriptionPlan.get(plan_id).catch(() => null);
        if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 });

        const sub = await getActiveSub(org.id);
        if (!sub) return Response.json({ error: 'No active subscription' }, { status: 404 });

        const limits = await snapshotPlan(plan_id);
        const updated = await base44.asServiceRole.entities.OrganisationSubscription.update(sub.id, {
          plan_id: plan.id,
          plan_code: plan.code,
          billing_interval: plan.billing_interval || sub.billing_interval,
          included_limits_snapshot: limits,
          updated_at: now,
        });

        return Response.json({ subscription: updated });
      }

      case 'cancel': {
        if (!['platform_owner', 'organisation_admin'].includes(profile.app_role)) {
          return Response.json({ error: 'Access denied' }, { status: 403 });
        }
        const sub = await getActiveSub(org.id);
        if (!sub) return Response.json({ error: 'No active subscription' }, { status: 404 });

        const updated = await base44.asServiceRole.entities.OrganisationSubscription.update(sub.id, {
          cancel_at_period_end: true,
          cancellation_requested_at: now,
          updated_at: now,
        });

        return Response.json({ subscription: updated });
      }

      case 'reactivate': {
        if (!['platform_owner', 'organisation_admin'].includes(profile.app_role)) {
          return Response.json({ error: 'Access denied' }, { status: 403 });
        }
        const sub = await getActiveSub(org.id);
        if (!sub) return Response.json({ error: 'No active subscription' }, { status: 404 });

        const updated = await base44.asServiceRole.entities.OrganisationSubscription.update(sub.id, {
          cancel_at_period_end: false,
          cancellation_requested_at: null,
          status: sub.status === 'suspended' ? 'active' : sub.status,
          updated_at: now,
        });

        return Response.json({ subscription: updated });
      }

      case 'suspend': {
        if (profile.app_role !== 'platform_owner') {
          return Response.json({ error: 'Platform owner access required' }, { status: 403 });
        }
        const { organisation_id } = body;
        const targetOrgId = organisation_id || org.id;

        const targetOrg = await base44.asServiceRole.entities.Organisation.get(targetOrgId).catch(() => null);
        if (!targetOrg) return Response.json({ error: 'Organisation not found' }, { status: 404 });

        await base44.asServiceRole.entities.Organisation.update(targetOrgId, { status: 'suspended' });

        const sub = await getActiveSub(targetOrgId);
        if (sub) {
          await base44.asServiceRole.entities.OrganisationSubscription.update(sub.id, {
            status: 'suspended',
            updated_at: now,
          });
        }

        await base44.asServiceRole.entities.AuditLog.create({
          organisation_id: targetOrgId,
          actor_user_id: user.id,
          action: 'credential_removed',
          entity_type: 'Organisation',
          entity_id: targetOrgId,
          new_value: 'suspended',
          timestamp: now,
        });

        return Response.json({ status: 'suspended' });
      }

      case 'reactivate_org': {
        if (profile.app_role !== 'platform_owner') {
          return Response.json({ error: 'Platform owner access required' }, { status: 403 });
        }
        const { organisation_id } = body;
        const targetOrgId = organisation_id || org.id;

        await base44.asServiceRole.entities.Organisation.update(targetOrgId, { status: 'active' });

        const sub = await getActiveSub(targetOrgId);
        if (sub && sub.status === 'suspended') {
          await base44.asServiceRole.entities.OrganisationSubscription.update(sub.id, {
            status: 'active',
            updated_at: now,
          });
        }

        return Response.json({ status: 'active' });
      }

      case 'apply_override': {
        if (profile.app_role !== 'platform_owner') {
          return Response.json({ error: 'Platform owner access required' }, { status: 403 });
        }
        const { organisation_id, override_limits, reason, expires_at } = body;
        if (!reason) return Response.json({ error: 'reason required' }, { status: 400 });

        const targetOrgId = organisation_id || org.id;
        const sub = await getActiveSub(targetOrgId);
        if (!sub) return Response.json({ error: 'No active subscription' }, { status: 404 });

        const updated = await base44.asServiceRole.entities.OrganisationSubscription.update(sub.id, {
          override_limits,
          override_reason: reason,
          override_applied_by: user.id,
          override_applied_at: now,
          override_expires_at: expires_at || null,
          updated_at: now,
        });

        await base44.asServiceRole.entities.AuditLog.create({
          organisation_id: targetOrgId,
          actor_user_id: user.id,
          action: 'integration_changed',
          entity_type: 'OrganisationSubscription',
          entity_id: sub.id,
          new_value: 'override_applied',
          timestamp: now,
        });

        return Response.json({ subscription: updated });
      }

      case 'extend_trial': {
        if (profile.app_role !== 'platform_owner') {
          return Response.json({ error: 'Platform owner access required' }, { status: 403 });
        }
        const { organisation_id, additional_days } = body;
        if (!additional_days) return Response.json({ error: 'additional_days required' }, { status: 400 });

        const targetOrgId = organisation_id || org.id;
        const sub = await getActiveSub(targetOrgId);
        if (!sub) return Response.json({ error: 'No active subscription' }, { status: 404 });
        if (sub.status !== 'trialing') return Response.json({ error: 'Subscription is not in trial' }, { status: 400 });

        const currentEnd = new Date(sub.trial_end || now).getTime();
        const newEnd = new Date(Math.max(currentEnd, Date.now()) + additional_days * 86400000).toISOString();

        const updated = await base44.asServiceRole.entities.OrganisationSubscription.update(sub.id, {
          trial_end: newEnd,
          current_period_end: newEnd,
          updated_at: now,
        });

        return Response.json({ subscription: updated });
      }

      default:
        return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}