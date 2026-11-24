// Organisation-aware, user-aware, feature-specific rate limiting.
// Uses UsageEvent counts in a time window to enforce limits.
// Configurable per feature. Enforced server-side only.

const RATE_WINDOWS = {
  login: { window_minutes: 5, max: 10 },
  invitation: { window_minutes: 60, max: 20 },
  test_call: { window_minutes: 5, max: 5 },
  outbound_call: { window_minutes: 1, max: 10 },
  enrichment: { window_minutes: 5, max: 50 },
  research: { window_minutes: 5, max: 20 },
  ai_generation: { window_minutes: 5, max: 30 },
  export: { window_minutes: 10, max: 10 },
  webhook_test: { window_minutes: 5, max: 10 },
  crm_test: { window_minutes: 5, max: 10 },
  report_generation: { window_minutes: 10, max: 5 },
};

// Check rate limit for a feature. Returns { allowed, retryAfterSeconds }
export async function checkRateLimit(base44, organisation_id, user_id, feature) {
  const config = RATE_WINDOWS[feature];
  if (!config) return { allowed: true };

  const windowStart = new Date(Date.now() - config.window_minutes * 60000).toISOString();
  const events = await base44.asServiceRole.entities.UsageEvent.filter(
    { organisation_id, user_id },
    '-created_date', 500
  );

  // Count events in the window — use metadata.rate_limit_feature if available,
  // otherwise fall back to source_function matching.
  const recentCount = events.filter(e => {
    const ts = e.occurred_at || e.created_at || e.created_date;
    return ts && ts >= windowStart && e.metadata?.rate_limit_feature === feature;
  }).length;

  if (recentCount >= config.max) {
    const retryAfterSeconds = config.window_minutes * 60;
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

// Record a rate-limited action for counting
export async function recordRateLimitedAction(base44, organisation_id, user_id, feature) {
  await base44.asServiceRole.entities.UsageEvent.create({
    organisation_id,
    user_id,
    event_type: 'integration_action',
    provider: 'rate_limiter',
    quantity: 1,
    unit: 'action',
    source_function: 'rateLimiter',
    idempotency_key: `rate:${organisation_id}:${user_id}:${feature}:${Date.now()}`,
    metadata: { rate_limit_feature: feature },
    occurred_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });
}

// Combined check + record for convenience
export async function enforceRateLimit(base44, organisation_id, user_id, feature) {
  const check = await checkRateLimit(base44, organisation_id, user_id, feature);
  if (!check.allowed) {
    const e = new Error(`Rate limit reached for ${feature}. Please try again in ${Math.ceil(check.retryAfterSeconds / 60)} minutes.`);
    e.status = 429;
    throw e;
  }
  await recordRateLimitedAction(base44, organisation_id, user_id, feature);
}