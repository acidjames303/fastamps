import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Stripe webhook handler — receives billing events and updates subscriptions.
// This endpoint is called by Stripe, not by app users. Signature is verified
// using the STRIPE_WEBHOOK_SECRET stored as an app secret.
export default async function (req) {
  try {
    const sig = req.headers.get('stripe-signature');
    const rawBody = await req.text();

    if (!sig || !rawBody) {
      return Response.json({ error: 'Missing signature or body' }, { status: 400 });
    }

    // Verify webhook signature
    const event = await verifyStripeSignature(rawBody, sig);

    // A Base44 merchant self-test charge is not a customer order.
    const eventObject = event?.data?.object || {};
    if (eventObject?.metadata?.base44_test_checkout === 'true') {
      return Response.json({ received: true, ignored: 'base44_test_checkout' });
    }

    const base44 = createClientFromRequest(req);

    // Idempotency check — skip if already processed
    const existing = await base44.asServiceRole.entities.BillingEvent.filter(
      { idempotency_key: event.id }, '-created_date', 1
    ).catch(() => []);
    if (existing && existing.length > 0) {
      return Response.json({ received: true, duplicate: true });
    }

    // Process the event
    const orgId = await processStripeEvent(base44, event);

    // Record the billing event
    await base44.asServiceRole.entities.BillingEvent.create({
      organisation_id: orgId || 'unknown',
      event_type: event.type,
      external_event_id: event.id,
      external_subscription_id: extractField(event, 'subscription') || '',
      external_customer_id: extractField(event, 'customer') || '',
      status: 'processed',
      safe_payload_summary: `Stripe event: ${event.type}`,
      processed_at: new Date().toISOString(),
      idempotency_key: event.id,
      created_at: new Date().toISOString(),
    });

    return Response.json({ received: true });
  } catch (error) {
    console.error('stripeWebhook error:', error.message);
    // Audit every rejected delivery (bad signature, stale timestamp, bad payload).
    try {
      const auditClient = createClientFromRequest(req);
      const auditRow = {
        organisation_id: 'unassigned',
        actor_user_id: '',
        entity_type: 'StripeWebhook',
        entity_id: '',
        new_value: String(error.message || 'rejected').slice(0, 200),
        timestamp: new Date().toISOString(),
      };
      try {
        await auditClient.asServiceRole.entities.AuditLog.create({ ...auditRow, action: 'webhook_rejected' });
      } catch (_) {
        await auditClient.asServiceRole.entities.AuditLog.create({ ...auditRow, action: 'security_access_denied' });
      }
    } catch (_) { /* auditing must never change the response */ }
    return Response.json({ error: error.message }, { status: 400 });
  }
}

// Verify the Stripe webhook signature using HMAC-SHA256
async function verifyStripeSignature(payload, sigHeader) {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');

  const parts = sigHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
  const signature = parts.find(p => p.startsWith('v1='))?.split('=')[1];

  if (!timestamp || !signature) throw new Error('Invalid signature header');

  // Replay protection: reject stale or future-dated signatures (5 minutes either way)
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (age > 300) throw new Error('Timestamp too old');
  if (age < -60) throw new Error('Timestamp in the future');

  // Compute expected signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expected = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${timestamp}.${payload}`)
  );
  const expectedHex = Array.from(new Uint8Array(expected))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (expectedHex !== signature) throw new Error('Signature mismatch');

  return JSON.parse(payload);
}

// Map Stripe subscription status to our internal status
function mapSubscriptionStatus(stripeStatus) {
  const map = {
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    canceled: 'cancelled',
    unpaid: 'grace_period',
    incomplete: 'active',
    incomplete_expired: 'cancelled',
  };
  return map[stripeStatus] || 'active';
}

// Extract a field from various event object shapes
function extractField(event, field) {
  const obj = event.data?.object;
  return obj?.[field] || obj?.data?.[field] || '';
}

// Snapshot plan limits for the subscription
async function snapshotPlanLimits(base44, priceId) {
  const plans = await base44.asServiceRole.entities.SubscriptionPlan.filter(
    { external_price_id: priceId }, 'display_order', 1
  ).catch(() => []);
  const plan = plans?.[0];
  if (!plan) return { plan_id: null, plan_code: 'unknown', limits: null };
  return {
    plan_id: plan.id,
    plan_code: plan.code,
    limits: {
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
      maximum_contacts: plan.maximum_contacts,
      maximum_active_lists: plan.maximum_active_lists,
      default_retention_days: plan.default_retention_days,
      feature_flags: plan.feature_flags || {},
      overage_policy: plan.overage_policy,
    },
  };
}

// Main event processor — returns the organisation_id affected
async function processStripeEvent(base44, event) {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const stripeHeaders = {
    'Authorization': `Bearer ${stripeKey}`,
    'Stripe-Version': '2025-10-29.clover',
  };

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data?.object;
      const orgId = session?.metadata?.organisation_id;
      const planCode = session?.metadata?.plan_code;
      if (!orgId) return null;

      // Fetch the full subscription from Stripe
      const subId = session.subscription;
      if (!subId) return orgId;

      const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, { headers: stripeHeaders });
      const sub = await subRes.json();

      const priceId = sub?.items?.data?.[0]?.price?.id;
      const { plan_id, plan_code, limits } = await snapshotPlanLimits(base44, priceId);

      const now = new Date().toISOString();

      // Find existing subscription for this org
      const existingSubs = await base44.asServiceRole.entities.OrganisationSubscription.filter(
        { organisation_id: orgId }, '-created_date', 10
      ).catch(() => []);
      const existing = existingSubs?.find(s => ['trialing', 'active', 'past_due', 'grace_period'].includes(s.status));

      const updateData = {
        plan_id: plan_id || undefined,
        plan_code: plan_code || planCode,
        status: mapSubscriptionStatus(sub.status),
        billing_customer_id: sub.customer,
        billing_subscription_id: sub.id,
        current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : undefined,
        current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : undefined,
        cancel_at_period_end: sub.cancel_at_period_end || false,
        last_payment_status: 'succeeded',
        last_payment_at: now,
        updated_at: now,
      };
      if (limits) updateData.included_limits_snapshot = limits;

      if (existing) {
        await base44.asServiceRole.entities.OrganisationSubscription.update(existing.id, updateData);
      } else if (plan_id) {
        await base44.asServiceRole.entities.OrganisationSubscription.create({
          organisation_id: orgId,
          ...updateData,
          created_at: now,
        });
      }

      return orgId;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const sub = event.data?.object;
      const orgId = sub?.metadata?.organisation_id;
      if (!orgId) return null;

      const priceId = sub?.items?.data?.[0]?.price?.id;
      const { plan_id, plan_code, limits } = await snapshotPlanLimits(base44, priceId);

      const now = new Date().toISOString();
      const existingSubs = await base44.asServiceRole.entities.OrganisationSubscription.filter(
        { organisation_id: orgId }, '-created_date', 10
      ).catch(() => []);
      const existing = existingSubs?.[0];

      const updateData = {
        status: mapSubscriptionStatus(sub.status),
        billing_customer_id: sub.customer,
        billing_subscription_id: sub.id,
        current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : undefined,
        current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : undefined,
        cancel_at_period_end: sub.cancel_at_period_end || false,
        cancelled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : undefined,
        updated_at: now,
      };
      if (plan_id) {
        updateData.plan_id = plan_id;
        updateData.plan_code = plan_code;
      }
      if (limits) updateData.included_limits_snapshot = limits;

      if (existing) {
        await base44.asServiceRole.entities.OrganisationSubscription.update(existing.id, updateData);
      }

      return orgId;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data?.object;
      const orgId = sub?.metadata?.organisation_id;
      if (!orgId) return null;

      const existingSubs = await base44.asServiceRole.entities.OrganisationSubscription.filter(
        { organisation_id: orgId, billing_subscription_id: sub.id }, '-created_date', 1
      ).catch(() => []);
      if (existingSubs?.[0]) {
        await base44.asServiceRole.entities.OrganisationSubscription.update(existingSubs[0].id, {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      return orgId;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data?.object;
      const subId = invoice?.subscription;
      if (!subId) return null;

      const existingSubs = await base44.asServiceRole.entities.OrganisationSubscription.filter(
        { billing_subscription_id: subId }, '-created_date', 1
      ).catch(() => []);
      if (existingSubs?.[0]) {
        await base44.asServiceRole.entities.OrganisationSubscription.update(existingSubs[0].id, {
          last_payment_status: 'succeeded',
          last_payment_at: new Date().toISOString(),
          last_payment_error: null,
          status: existingSubs[0].status === 'grace_period' ? 'active' : existingSubs[0].status,
          updated_at: new Date().toISOString(),
        });
        return existingSubs[0].organisation_id;
      }
      return null;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data?.object;
      const subId = invoice?.subscription;
      if (!subId) return null;

      const existingSubs = await base44.asServiceRole.entities.OrganisationSubscription.filter(
        { billing_subscription_id: subId }, '-created_date', 1
      ).catch(() => []);
      if (existingSubs?.[0]) {
        await base44.asServiceRole.entities.OrganisationSubscription.update(existingSubs[0].id, {
          last_payment_status: 'failed',
          last_payment_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        return existingSubs[0].organisation_id;
      }
      return null;
    }

    default:
      return null;
  }
}