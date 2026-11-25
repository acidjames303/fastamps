import { resolveTenant } from '../../shared/tenantAuth.ts';
import { resolveSubscription } from '../../shared/entitlements.ts';

// Creates a Stripe Checkout session for upgrading/changing a subscription plan.
// Returns { url } — the frontend must check for iframe context before redirecting.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (!['platform_owner', 'organisation_admin'].includes(profile.app_role)) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { plan_code } = body;
    if (!plan_code) return Response.json({ error: 'plan_code required' }, { status: 400 });

    // Find the plan with its Stripe price ID
    const plans = await base44.asServiceRole.entities.SubscriptionPlan.filter(
      { code: plan_code, status: 'active' }, 'display_order', 1
    );
    const plan = plans?.[0];
    if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 });
    if (!plan.external_price_id) {
      return Response.json({ error: 'This plan is not configured for online billing. Contact support.' }, { status: 400 });
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const appId = Deno.env.get('BASE44_APP_ID') || '';
    const stripeHeaders = {
      'Authorization': `Bearer ${stripeKey}`,
      'Stripe-Version': '2025-10-29.clover',
    };

    // Get or create Stripe customer
    const subscription = await resolveSubscription(base44, org);
    let customerId = subscription?.billing_customer_id;

    if (!customerId) {
      const customerParams = new URLSearchParams();
      customerParams.append('email', user.email || '');
      customerParams.append('name', org.name);
      customerParams.append('metadata[base44_app_id]', appId);
      customerParams.append('metadata[organisation_id]', org.id);

      const customerRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: { ...stripeHeaders, 'Idempotency-Key': crypto.randomUUID() },
        body: customerParams,
      });
      const customer = await customerRes.json();
      if (!customer.id) {
        console.error('Stripe customer creation failed:', customer.error);
        return Response.json({ error: customer.error?.message || 'Failed to create customer' }, { status: 502 });
      }
      customerId = customer.id;
    }

    // Create checkout session
    const origin = req.headers.get('origin') || 'https://evasive-dial-flow-go.base44.app';
    const params = new URLSearchParams();
    params.append('customer', customerId);
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', plan.external_price_id);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${origin}/usage-billing?checkout=success`);
    params.append('cancel_url', `${origin}/usage-billing?checkout=cancelled`);
    params.append('metadata[base44_app_id]', appId);
    params.append('metadata[organisation_id]', org.id);
    params.append('metadata[plan_code]', plan_code);
    params.append('subscription_data[metadata][base44_app_id]', appId);
    params.append('subscription_data[metadata][organisation_id]', org.id);
    params.append('subscription_data[metadata][plan_code]', plan_code);

    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { ...stripeHeaders, 'Idempotency-Key': crypto.randomUUID() },
      body: params,
    });
    const session = await sessionRes.json();

    if (!sessionRes.ok) {
      console.error('Stripe checkout session creation failed:', session.error);
      return Response.json({ error: session.error?.message || 'Failed to create checkout session' }, { status: 502 });
    }

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('stripeCheckout error:', error.message);
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}