// Who may spend money with paid data providers (Lusha, FullEnrich, Apollo),
// run AI research or trigger Smart Actions.
//
// Enforced inside backend functions — never by hiding buttons in the UI.
// The decision comes from the capability model, so adding a role never means
// editing every function again.
import { CAPABILITIES, can, assertCapability } from './capabilities.ts';

export const PROVIDER_CAPABILITY = CAPABILITIES.providers;

export function canUseProviders(profile: any): boolean {
  return can(profile, CAPABILITIES.providers);
}

export function assertProviderAccess(profile: any): void {
  assertCapability(
    profile,
    CAPABILITIES.providers,
    'Enrichment providers are not available for your role. Ask a manager to run this research.',
  );
}