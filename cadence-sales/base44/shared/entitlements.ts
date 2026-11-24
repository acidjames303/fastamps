// Core entitlement service — single source of truth for feature access, usage limits,
// and subscription state. All protected backend functions must use this module.
// Frontend checks are display-only; backend functions enforce entitlements.

// Feature flag keys — used in plan.feature_flags and subscription.override_limits
export const FEATURES = {
  browser_calling: 'browser_calling',
  external_device_calling: 'external_device_calling',
  research: 'research',
  contact_enrichment: 'contact_enrichment',
  ai_summaries: 'ai_summaries',
  client_reports: 'client_reports',
  pdf_exports: 'pdf_exports',
  team_assignment: 'team_assignment',
  meetings: 'meetings',
  generic_webhooks: 'generic_webhooks',
  crm_integrations: 'crm_integrations',
  advanced_reporting: 'advanced_reporting',
};

// Usage limit types — map to plan included_* fields
export const USAGE_TYPES = {
  smart_actions: 'included_smart_actions',
  storage_mb: 'included_storage_mb',
};

// Map usage types to UsageEvent event_types for counting
const USAGE_TYPE_TO_EVENTS = {
  // Only Cadence-funded platform work is metered. Calls, enrichment and CRM
  // requests use the customer's own provider account and never reduce this pool.
  included_smart_actions: ['research_request', 'company_research', 'company_discovery', 'fit_scoring', 'ai_action'],
  included_storage_mb: ['storage_added'],
};

// High-cost features subject to hard limits
export const HIGH_COST_FEATURES = [
  FEATURES.ai_summaries,
  FEATURES.research,
];

// Active subscription statuses that allow access
const ACTIVE_STATUSES = ['trialing', 'active', 'past_due', 'grace_period'];

function now() { return new Date().toISOString(); }

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

// Resolve the current subscription for an organisation
export async function resolveSubscription(base44, org) {
  const subs = await base44.asServiceRole.entities.OrganisationSubscription.filter(
    { organisation_id: org.id },
    '-created_date', 10
  );
  // Return the most recent non-cancelled subscription, or the most recent overall
  const active = subs?.find(s => ACTIVE_STATUSES.includes(s.status));
  return active || subs?.[0] || null;
}

// Check if the subscription allows access
export function isOrganisationActive(subscription) {
  if (!subscription) return false;
  return ACTIVE_STATUSES.includes(subscription.status);
}

export function isTrialValid(subscription) {
  if (!subscription || subscription.status !== 'trialing') return false;
  if (!subscription.trial_end) return false;
  return new Date(subscription.trial_end).getTime() > Date.now();
}

export function isInGracePeriod(subscription) {
  if (!subscription || subscription.status !== 'grace_period') return false;
  if (!subscription.grace_period_end) return false;
  return new Date(subscription.grace_period_end).getTime() > Date.now();
}

export function trialDaysRemaining(subscription) {
  if (!isTrialValid(subscription)) return 0;
  const ms = new Date(subscription.trial_end).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

// Get effective limits: snapshot from plan + platform-approved overrides
export function getEffectiveLimits(subscription) {
  if (!subscription) return null;
  const snapshot = subscription.included_limits_snapshot || {};
  const overrides = subscription.override_limits || {};

  // Check if override has expired
  if (subscription.override_expires_at && new Date(subscription.override_expires_at).getTime() < Date.now()) {
    return snapshot;
  }
  return { ...snapshot, ...overrides };
}

// Check if a feature is included in the plan
export function isFeatureIncluded(subscription, feature) {
  if (!subscription) return false;
  const limits = getEffectiveLimits(subscription);
  const flags = limits?.feature_flags || {};
  return flags[feature] === true;
}

// Get seat allowance
export function getSeatAllowance(subscription) {
  const limits = getEffectiveLimits(subscription);
  return {
    included: limits?.included_users || 0,
    maximum: limits?.maximum_users || limits?.included_users || 0,
  };
}

// Get usage limit for a limit type (e.g. 'included_call_minutes')
export function getUsageLimit(subscription, limitField) {
  const limits = getEffectiveLimits(subscription);
  return limits?.[limitField] || 0;
}

// Count usage for a set of event types in a billing period
async function countUsageByEventTypes(base44, organisation_id, eventTypes, periodStart) {
  const events = await base44.asServiceRole.entities.UsageEvent.filter(
    { organisation_id },
    '-created_date', 5000
  );
  const periodEvents = events.filter(e => {
    const ts = e.occurred_at || e.created_at || e.created_date;
    return ts && ts >= periodStart && eventTypes.includes(e.event_type);
  });
  // Defensive deduplication: concurrent retries may both pass a pre-create
  // idempotency check. Only one event per idempotency key counts toward billing.
  const seen = new Set();
  return periodEvents.reduce((sum, e) => {
    if (e.idempotency_key) {
      if (seen.has(e.idempotency_key)) return sum;
      seen.add(e.idempotency_key);
    }
    return sum + (e.quantity || 1);
  }, 0);
}

// Get all usage metrics for a subscription in the current billing period
export async function getUsageMetrics(base44, subscription) {
  if (!subscription) return null;
  const periodStart = subscription.current_period_start || monthStart();
  const results = {};

  for (const [limitField, eventTypes] of Object.entries(USAGE_TYPE_TO_EVENTS)) {
    const used = await countUsageByEventTypes(base44, subscription.organisation_id, eventTypes, periodStart);
    const limit = getUsageLimit(subscription, limitField);
    results[limitField] = { used, limit, percentage: limit > 0 ? Math.round((used / limit) * 100) : 0 };
  }

  return results;
}

// Check if the org has reached a hard limit for a usage type
export async function hasReachedHardLimit(base44, subscription, limitField, qty = 1) {
  const limit = getUsageLimit(subscription, limitField);
  if (!limit || limit <= 0) return false; // 0 = unlimited
  const eventTypes = USAGE_TYPE_TO_EVENTS[limitField] || [];
  const periodStart = subscription.current_period_start || monthStart();
  const used = await countUsageByEventTypes(base44, subscription.organisation_id, eventTypes, periodStart);
  const policy = getEffectiveLimits(subscription)?.overage_policy || 'block';
  const enforcedLimit = policy === 'warn' ? Math.ceil(limit * 1.10) : limit;
  return used + qty > enforcedLimit;
}

// Check if org is allowed to use a feature; returns { allowed, reason }
export async function checkEntitlement(base44, org, subscription, feature, qty = 1) {
  if (!org || org.status !== 'active') {
    return { allowed: false, reason: 'Your organisation is not active. Contact your administrator.' };
  }
  if (!subscription) {
    return { allowed: false, reason: 'No active subscription found. Contact your administrator.' };
  }
  if (!isOrganisationActive(subscription)) {
    return { allowed: false, reason: 'Your subscription needs attention. Ask an administrator to review billing.' };
  }

  // Feature flag check
  if (HIGH_COST_FEATURES.includes(feature) && !isFeatureIncluded(subscription, feature)) {
    return { allowed: false, reason: 'This feature is not included in your plan.' };
  }

  // Hard limit check for high-cost features
  const featureToLimit = {
    [FEATURES.research]: USAGE_TYPES.smart_actions,
    [FEATURES.ai_summaries]: USAGE_TYPES.smart_actions,
  };

  const limitField = featureToLimit[feature];
  if (limitField && HIGH_COST_FEATURES.includes(feature)) {
    const reached = await hasReachedHardLimit(base44, subscription, limitField, qty);
    if (reached) {
      return { allowed: false, reason: `Your organisation has reached its monthly ${feature.replace(/_/g, ' ')} allowance.` };
    }
  }

  return { allowed: true };
}