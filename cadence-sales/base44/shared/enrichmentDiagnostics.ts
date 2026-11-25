// Shared enrichment diagnostics, usage recording, and error classification.
// Used by enrichProspect, enrichProspectBatch, and the enrichment shared logic
// to record provider attempts, classify errors, and meter paid usage.

import { secrets } from 'base44:runtime';

// Maps an HTTP status code to an error category.
export function classifyHttpError(status, body) {
  if (!status) return { category: 'network_error', retryable: true };
  if (status === 401 || status === 403) return { category: 'auth_error', retryable: false };
  if (status === 429) return { category: 'rate_limit', retryable: true };
  if (status === 404) return { category: 'not_found', retryable: false };
  if (status >= 500) return { category: 'server_error', retryable: true };
  if (status === 408) return { category: 'timeout', retryable: true };
  return { category: 'unknown', retryable: true };
}

// Determines the new granular enrichment_status from the enrichment output.
// A company name alone must not count as fully enriched.
export function computeEnrichmentStatus(out) {
  if (!out) return 'failed';
  if (out.geography_status === 'out_of_scope') return 'out_of_scope';
  if (!out.company_found) return 'not_found';
  // A generic email alone must not satisfy a personal-email requirement.
  // Only a personal work email or a mobile counts as direct contact.
  const hasPersonalEmail = out.work_email_found ||
    (out.email && out.email_type === 'personal_work');
  const hasMobile = out.mobile_found;
  const hasLandline = out.landline_found;
  const hasDms = out.decision_makers_found;
  if ((hasPersonalEmail || hasMobile) && hasDms) return 'complete';
  if (hasPersonalEmail || hasMobile || hasLandline || hasDms) return 'partially_enriched';
  return 'no_contact_details';
}

// Maps a full country name to ISO 3166-1 alpha-2 code.
const COUNTRY_MAP = {
  'united kingdom': 'GB', 'uk': 'GB', 'england': 'GB', 'scotland': 'GB', 'wales': 'GB', 'northern ireland': 'GB',
  'ireland': 'IE', 'united states': 'US', 'usa': 'US', 'us': 'US',
  'canada': 'CA', 'australia': 'AU', 'new zealand': 'NZ',
  'germany': 'DE', 'france': 'FR', 'spain': 'ES', 'italy': 'IT', 'netherlands': 'NL',
  'belgium': 'BE', 'switzerland': 'CH', 'austria': 'AT', 'sweden': 'SE', 'norway': 'NO',
  'denmark': 'DK', 'finland': 'FI', 'poland': 'PL', 'portugal': 'PT', 'greece': 'GR',
  'india': 'IN', 'china': 'CN', 'japan': 'JP', 'singapore': 'SG', 'uae': 'AE',
  'south africa': 'ZA', 'brazil': 'BR', 'mexico': 'MX',
};

export function countryNameToCode(name) {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  if (lower.length === 2) return lower.toUpperCase();
  return COUNTRY_MAP[lower] || '';
}

// Checks if a country code is within the permitted countries list.
// Empty/null permitted_countries means no restriction.
export function checkGeography(countryCode, permittedCountries) {
  if (!permittedCountries || permittedCountries.length === 0) {
    return { status: 'matched', reason: 'No geographical restriction on this list.' };
  }
  if (!countryCode) {
    return { status: 'unknown', reason: 'Company country could not be determined — manual review required.' };
  }
  if (permittedCountries.includes(countryCode)) {
    return { status: 'matched', reason: `Company is in ${countryCode}.` };
  }
  return {
    status: 'out_of_scope',
    reason: `Excluded because the company is outside the permitted geography (in ${countryCode}, permitted: ${permittedCountries.join(', ')}).`,
  };
}

// Records a single provider enrichment attempt with safe diagnostics.
export async function recordAttempt(base44, org, params) {
  try {
    const {
      provider, enrichment_type, status, prospect_id, list_id,
      http_status, error_category, correlation_id, fields_returned,
      estimated_cost, actual_cost, retry_eligible, retry_reason,
      cooldown_expires_at,
    } = params;
    return await base44.asServiceRole.entities.EnrichmentAttempt.create({
      organisation_id: org.id,
      provider,
      enrichment_type,
      status: status || 'failed',
      prospect_id: prospect_id || '',
      target_list_id: list_id || '',
      http_status: http_status || null,
      error_category: error_category || 'none',
      correlation_id: correlation_id || '',
      fields_returned: fields_returned || [],
      estimated_cost: estimated_cost || 0,
      actual_cost: actual_cost || 0,
      retry_eligible: !!retry_eligible,
      retry_reason: retry_reason || '',
      retry_cooldown_expires_at: cooldown_expires_at || null,
      attempted_at: new Date().toISOString(),
    });
  } catch { return null; }
}

// Records a paid usage event with idempotency protection.
export async function recordUsage(base44, org, params) {
  try {
    const {
      event_type, provider, quantity, unit, source_function,
      idempotency_key, estimated_cost, actual_cost, related_record_id, metadata,
    } = params;
    // Check for existing usage with same idempotency key to prevent duplicate charges.
    if (idempotency_key) {
      const existing = await base44.asServiceRole.entities.UsageEvent.filter(
        { organisation_id: org.id, idempotency_key }, '-created_date', 1,
      ).catch(() => []);
      if (existing && existing.length) return existing[0];
    }
    return await base44.asServiceRole.entities.UsageEvent.create({
      organisation_id: org.id,
      event_type,
      provider: provider || '',
      quantity: quantity || 1,
      unit: unit || 'action',
      source_function: source_function || '',
      idempotency_key: idempotency_key || '',
      estimated_cost: estimated_cost || 0,
      actual_cost: actual_cost || 0,
      related_record_id: related_record_id || '',
      metadata: metadata || {},
      occurred_at: new Date().toISOString(),
    });
  } catch { return null; }
}

// Checks if a prospect's not-found result is still within the 7-day cooldown.
export function isWithinCooldown(prospect) {
  if (!prospect?.retry_cooldown_expires_at) return false;
  return new Date(prospect.retry_cooldown_expires_at) > new Date();
}

// Computes the cooldown expiry (7 days from now) for a genuine not-found.
export function cooldownExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}

// Generates a correlation ID for linking attempts and usage events.
export function generateCorrelationId() {
  return 'corr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}