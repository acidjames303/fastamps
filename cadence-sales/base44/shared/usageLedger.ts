// Idempotent usage recording and aggregation. Every paid action must call
// recordUsageEvent exactly once. Retried requests use the same idempotency_key
// and will not be double-counted.

function now() { return new Date().toISOString(); }

// Record a usage event idempotently. If an event with the same idempotency_key
// already exists, returns it without creating a duplicate.
export async function recordUsageEvent(base44, params) {
  const {
    organisation_id,
    user_id,
    campaign_id,
    target_list_id,
    event_type,
    provider,
    quantity = 1,
    unit = 'action',
    source_function,
    idempotency_key,
    estimated_cost = 0,
    actual_cost = 0,
    related_record_id,
    metadata,
  } = params;

  // Idempotency check — skip if already recorded
  if (idempotency_key) {
    const existing = await base44.asServiceRole.entities.UsageEvent.filter(
      { organisation_id, idempotency_key },
      '-created_date', 1
    );
    if (existing && existing.length > 0) {
      return { recorded: false, event: existing[0] };
    }
  }

  const event = await base44.asServiceRole.entities.UsageEvent.create({
    organisation_id,
    user_id,
    campaign_id,
    target_list_id,
    event_type,
    provider,
    quantity,
    unit,
    source_function,
    idempotency_key,
    estimated_cost,
    actual_cost,
    related_record_id,
    metadata,
    occurred_at: now(),
    created_at: now(),
  });

  return { recorded: true, event };
}

// Aggregate usage for an organisation in a date range, grouped by event_type
export async function getUsageSummary(base44, organisation_id, startDate, endDate) {
  const events = await base44.asServiceRole.entities.UsageEvent.filter(
    { organisation_id },
    '-created_date', 5000
  );

  const inRange = events.filter(e => {
    const ts = e.occurred_at || e.created_at || e.created_date;
    return ts && ts >= startDate && ts <= endDate;
  });

  const byType = {};
  for (const e of inRange) {
    if (!byType[e.event_type]) {
      byType[e.event_type] = { count: 0, quantity: 0, estimated_cost: 0 };
    }
    byType[e.event_type].count += 1;
    byType[e.event_type].quantity += e.quantity || 1;
    byType[e.event_type].estimated_cost += e.estimated_cost || 0;
  }

  return {
    total_events: inRange.length,
    total_quantity: inRange.reduce((s, e) => s + (e.quantity || 1), 0),
    total_estimated_cost: inRange.reduce((s, e) => s + (e.estimated_cost || 0), 0),
    by_type: byType,
  };
}

// Get usage by organisation (platform-level)
export async function getUsageByOrganisation(base44, startDate) {
  const events = await base44.asServiceRole.entities.UsageEvent.filter(
    {}, '-created_date', 5000
  );

  const byOrg = {};
  for (const e of events) {
    const ts = e.occurred_at || e.created_at || e.created_date;
    if (!ts || ts < startDate) continue;
    if (!byOrg[e.organisation_id]) {
      byOrg[e.organisation_id] = { organisation_id: e.organisation_id, total: 0, by_type: {} };
    }
    byOrg[e.organisation_id].total += e.quantity || 1;
    if (!byOrg[e.organisation_id].by_type[e.event_type]) {
      byOrg[e.organisation_id].by_type[e.event_type] = 0;
    }
    byOrg[e.organisation_id].by_type[e.event_type] += e.quantity || 1;
  }

  return Object.values(byOrg).sort((a, b) => b.total - a.total);
}

// Platform-level credit estimation
// Configurable conversion factors — labelled as estimates
export const CREDIT_CONVERSION = {
  integration_actions_per_credit: 1,
  ai_actions_per_credit: 3,              // Base44 app AI consumes integration credits; actual use varies
  research_requests_per_credit: 3,
};

export const PLATFORM_ALLOWANCES = {
  monthly_integration_credits: 50000,
  monthly_message_credits: 1200,
};

export const PLATFORM_THRESHOLDS = {
  warning: 0.70,
  critical: 0.85,
  emergency: 0.95,
};

// Estimate platform credit consumption for the current month
export async function getPlatformCreditEstimate(base44) {
  const monthStartStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const events = await base44.asServiceRole.entities.UsageEvent.filter(
    {}, '-created_date', 5000
  );

  const inRange = events.filter(e => {
    const ts = e.occurred_at || e.created_at || e.created_date;
    return ts && ts >= monthStartStr;
  });

  let integrationCredits = 0;
  let messageCredits = 0;

  for (const e of inRange) {
    const qty = e.quantity || 1;
    switch (e.event_type) {
      case 'integration_action':
        if (String(e.provider || '').startsWith('base44')) {
          integrationCredits += qty * CREDIT_CONVERSION.integration_actions_per_credit;
        }
        break;
      case 'crm_request':
      case 'webhook_attempt':
        // Customer-owned destinations are diagnostic events, not Base44 credit usage.
        break;
      case 'ai_action':
        integrationCredits += qty * CREDIT_CONVERSION.ai_actions_per_credit;
        break;
      case 'research_request':
      case 'company_research':
      case 'company_discovery':
        integrationCredits += qty * CREDIT_CONVERSION.research_requests_per_credit;
        break;
      case 'enrichment_request':
      case 'phone_enrichment':
      case 'email_enrichment':
      case 'people_search':
      case 'call_started':
      case 'call_connected':
      case 'call_minute':
        // Customer-owned providers: retained for diagnostics, not Cadence credit estimates.
        break;
      default:
        break;
    }
  }

  const integrationPercentage = Math.round((integrationCredits / PLATFORM_ALLOWANCES.monthly_integration_credits) * 100);
  const messagePercentage = Math.round((messageCredits / PLATFORM_ALLOWANCES.monthly_message_credits) * 100);

  const getThreshold = (pct) => {
    if (pct >= PLATFORM_THRESHOLDS.emergency * 100) return 'emergency';
    if (pct >= PLATFORM_THRESHOLDS.critical * 100) return 'critical';
    if (pct >= PLATFORM_THRESHOLDS.warning * 100) return 'warning';
    return 'normal';
  };

  return {
    integration_credits: { used: integrationCredits, allowance: PLATFORM_ALLOWANCES.monthly_integration_credits, percentage: integrationPercentage, threshold: getThreshold(integrationPercentage) },
    message_credits: { used: messageCredits, allowance: PLATFORM_ALLOWANCES.monthly_message_credits, percentage: messagePercentage, threshold: getThreshold(messagePercentage) },
    is_estimate: true,
  };
}