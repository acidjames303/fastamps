// Backend-enforced spending controls for enrichment sessions.
// These are checked before every provider call and AI research action.
// Frontend warnings are supplementary — the backend is the authoritative gatekeeper.
//
// When a limit is reached, the session is PAUSED (not failed). The user can
// resume after reviewing or adjusting limits.

export interface SpendingControls {
  max_provider_calls_per_session: number;
  max_contacts_per_company: number;
  max_ai_actions_per_session: number;
  max_daily_provider_operations: number;
  pause_at_percentages: number[]; // [50, 80, 100]
  require_admin_above_threshold: number;
  disable_automatic_paid_fallback: boolean;
  disable_force_refresh_for_non_admins: boolean;
}

// Defaults assume a high / unlimited Lusha allowance — Cadence should fill
// mobiles for every known person, not pause after a handful of lookups.
// Orgs can still tighten these in organisation.settings.enrichment_config.
export const DEFAULT_SPENDING_CONTROLS: SpendingControls = {
  max_provider_calls_per_session: 5000,
  max_contacts_per_company: 8,
  max_ai_actions_per_session: 200,
  max_daily_provider_operations: 20000,
  pause_at_percentages: [90, 100],
  require_admin_above_threshold: 5000,
  disable_automatic_paid_fallback: true,
  disable_force_refresh_for_non_admins: true,
};

// Reads spending controls from the organisation's settings.
export function getSpendingControls(org: any): SpendingControls {
  const config = org?.settings?.enrichment_config?.spending_controls;
  if (!config) return { ...DEFAULT_SPENDING_CONTROLS };
  return {
    max_provider_calls_per_session: config.max_provider_calls_per_session ?? DEFAULT_SPENDING_CONTROLS.max_provider_calls_per_session,
    max_contacts_per_company: config.max_contacts_per_company ?? DEFAULT_SPENDING_CONTROLS.max_contacts_per_company,
    max_ai_actions_per_session: config.max_ai_actions_per_session ?? DEFAULT_SPENDING_CONTROLS.max_ai_actions_per_session,
    max_daily_provider_operations: config.max_daily_provider_operations ?? DEFAULT_SPENDING_CONTROLS.max_daily_provider_operations,
    pause_at_percentages: config.pause_at_percentages ?? DEFAULT_SPENDING_CONTROLS.pause_at_percentages,
    require_admin_above_threshold: config.require_admin_above_threshold ?? DEFAULT_SPENDING_CONTROLS.require_admin_above_threshold,
    disable_automatic_paid_fallback: config.disable_automatic_paid_fallback ?? DEFAULT_SPENDING_CONTROLS.disable_automatic_paid_fallback,
    disable_force_refresh_for_non_admins: config.disable_force_refresh_for_non_admins ?? DEFAULT_SPENDING_CONTROLS.disable_force_refresh_for_non_admins,
  };
}

export interface SpendingCheckResult {
  allowed: boolean;
  reason: string;
  pauseSession: boolean;
  pauseReason: string;
  percentUsed: number;
}

// Checks whether a provider call is allowed under the current spending controls.
export function checkProviderCallAllowed(
  session: any,
  controls: SpendingControls,
  dailyProviderCount: number,
): SpendingCheckResult {
  const providerCalls = session.provider_calls_made || 0;
  const maxCalls = controls.max_provider_calls_per_session;

  // Session-level limit.
  if (providerCalls >= maxCalls) {
    const pct = Math.round((providerCalls / maxCalls) * 100);
    return {
      allowed: false,
      reason: `Session provider-call limit reached (${providerCalls}/${maxCalls}).`,
      pauseSession: true,
      pauseReason: `spending_limit_reached: ${providerCalls} of ${maxCalls} provider calls used`,
      percentUsed: pct,
    };
  }

  // Daily limit.
  if (dailyProviderCount >= controls.max_daily_provider_operations) {
    return {
      allowed: false,
      reason: `Daily provider-operation limit reached (${dailyProviderCount}/${controls.max_daily_provider_operations}).`,
      pauseSession: true,
      pauseReason: `daily_limit_reached: ${dailyProviderCount} of ${controls.max_daily_provider_operations} daily operations`,
      percentUsed: 100,
    };
  }

  const percentUsed = Math.round((providerCalls / maxCalls) * 100);
  const shouldPause = controls.pause_at_percentages.includes(percentUsed) && percentUsed >= 50;

  return {
    allowed: true,
    reason: '',
    pauseSession: shouldPause && percentUsed >= 80, // only pause at 80%+ thresholds
    pauseReason: shouldPause && percentUsed >= 80 ? `spending_threshold: ${percentUsed}% of session budget used` : '',
    percentUsed,
  };
}

// Checks whether an AI research action is allowed.
export function checkAiActionAllowed(
  session: any,
  controls: SpendingControls,
): SpendingCheckResult {
  const aiActions = session.smart_actions_consumed || 0;
  const maxAi = controls.max_ai_actions_per_session;

  if (aiActions >= maxAi) {
    return {
      allowed: false,
      reason: `AI research limit reached (${aiActions}/${maxAi}). AI research is disabled for this session.`,
      pauseSession: false,
      pauseReason: '',
      percentUsed: maxAi > 0 ? Math.round((aiActions / maxAi) * 100) : 100,
    };
  }

  const percentUsed = maxAi > 0 ? Math.round((aiActions / maxAi) * 100) : 0;
  return { allowed: true, reason: '', pauseSession: false, pauseReason: '', percentUsed };
}

// Checks if force_refresh should be blocked for non-admin users.
export function isForceRefreshBlocked(controls: SpendingControls, userRole: string): boolean {
  if (!controls.disable_force_refresh_for_non_admins) return false;
  return userRole !== 'admin' && userRole !== 'platform_owner';
}

// Estimates the maximum provider calls for a session preview.
export function estimateMaxProviderCalls(
  prospectCount: number,
  controls: SpendingControls,
  connectedProviders: string[],
  emailOnly: boolean,
): number {
  const maxPerCompany = controls.max_contacts_per_company;
  const providerCount = emailOnly
    ? 1 // email-only uses Apollo only
    : Math.max(1, connectedProviders.length);
  return Math.min(prospectCount * maxPerCompany * providerCount, controls.max_provider_calls_per_session);
}