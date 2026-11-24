// Cost and usage control. Every paid/research action must:
//   1. resolveTenant (caller does this)
//   2. checkAllowance — reject if the org's monthly limit is reached
//   3. perform the action
//   4. recordUsage — attribute success or failure to the correct org
//
// No Stripe billing here. Limits come from Organisation fields; absence means
// no limit enforced (treat as unlimited until billing is wired).

import { getOrgCredentials } from './providerCredentials.ts';
import { resolveSubscription, hasReachedHardLimit, USAGE_TYPES } from './entitlements.ts';
import { recordUsageEvent } from './usageLedger.ts';

// EnrichmentAttempt cooldown for failed/not_found lookups — do not retry until
// this has elapsed.
export const FAILED_ENRICH_COOLDOWN_DAYS = 7;
export const COMPANY_FACT_EXPIRY_DAYS = 180; // 6 months
export const NEWS_EXPIRY_DAYS = 14;
export const CONTACT_EMPLOYMENT_EXPIRY_DAYS = 180;

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export function getOrgLimits(org) {
  return {
    research: org?.monthly_research_limit || 0,        // 0 = unlimited
    enrichment: org?.monthly_enrichment_limit || 0,
  };
}

// Count an organisation's usage events of a type this calendar month.
export async function monthUsageCount(base44, organisation_id, event_type) {
  const events = await base44.asServiceRole.entities.UsageEvent.filter({
    organisation_id, event_type,
  }, '-created_date', 1000);
  const since = monthStart();
  return events.filter((e) => e.created_at && e.created_at >= since).length;
}

// Throws if the org is over its allowance for the given event type.
export async function checkAllowance(base44, org, event_type, qty = 1) {
  const researchEvents = ['company_research', 'company_discovery', 'research_request', 'fit_scoring', 'ai_action'];
  if (researchEvents.includes(event_type)) {
    const subscription = await resolveSubscription(base44, org);
    if (subscription) {
      const reached = await hasReachedHardLimit(base44, subscription, USAGE_TYPES.smart_actions, qty);
      if (reached) {
        const e = new Error('Your organisation has reached its monthly Smart Actions allowance. Core workflow remains available.');
        e.status = 429;
        throw e;
      }
      return;
    }
  }

  // Legacy operational limit retained for customer-funded enrichment as a
  // safety control; it is not presented or sold as a Cadence allowance.
  const limits = getOrgLimits(org);
  const limit = event_type === 'phone_enrichment' || event_type === 'email_enrichment'
    ? limits.enrichment
    : limits.research;
  if (!limit) return;
  const used = await monthUsageCount(base44, org.id, event_type);
  if (used + qty > limit) {
    const e = new Error(`Monthly ${event_type} safety limit reached (${limit}).`);
    e.status = 429;
    throw e;
  }
}

export async function recordUsage(base44, {
  organisation_id, user_id, target_list_id, event_type, provider,
  quantity = 1, estimated_cost = 0, actual_cost = 0, related_record_id,
  idempotency_key, source_function, metadata,
}) {
  try {
    return await recordUsageEvent(base44, {
      organisation_id, user_id, target_list_id, event_type, provider,
      quantity, estimated_cost, actual_cost, related_record_id,
      idempotency_key, source_function, metadata,
    });
  } catch {
    return { recorded: false, event: null };
  }
}

// Has a failed/not_found enrichment attempt for this target cooled down yet?
export function isCoolingDown(attempt) {
  if (!attempt) return false;
  if (attempt.status !== 'failed' && attempt.status !== 'not_found') return false;
  const attemptedAt = attempt.attempted_at ? new Date(attempt.attempted_at).getTime() : 0;
  return Date.now() - attemptedAt < FAILED_ENRICH_COOLDOWN_DAYS * 86400000;
}

export function isoPlusDays(days) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

// Resolve org-scoped provider keys (org-level encrypted keys override app secrets).
export async function resolveSecrets(base44, org) {
  return await getOrgCredentials(base44, org);
}