// Canonical provider resolution service — the single source of truth for which
// enrichment providers an organisation has connected, in what priority order,
// and which fields each provider is capable of resolving.
//
// SECURITY: Only loads ProviderCredential records belonging to the authenticated
// user's organisation. Never falls back to platform-owner or shared test
// credentials. Never returns API keys to the frontend.

import { getOrgCredentials } from './providerCredentials.ts';

// All enrichment providers Cadence genuinely supports.
export const ENRICHMENT_PROVIDERS = ['apollo', 'lusha', 'fullenrich'] as const;
export type EnrichmentProvider = typeof ENRICHMENT_PROVIDERS[number];

// Fields each provider can resolve.
// FullEnrich is a limited-credit account in Cadence: phone numbers only for
// named contacts who still have no dialable number. Never emails or discovery.
export const PROVIDER_CAPABILITIES: Record<string, string[]> = {
  apollo: ['decision_maker_role', 'personal_email', 'mobile', 'company_intelligence'],
  lusha: ['personal_email', 'mobile', 'direct_dial'],
  fullenrich: ['mobile'],
};

// Human-readable labels for the settings UI.
export const PROVIDER_LABELS: Record<string, string> = {
  apollo: 'Apollo',
  lusha: 'Lusha',
  fullenrich: 'FullEnrich',
};

// Default recommended provider order (used when org hasn't set a custom order).
export const DEFAULT_PROVIDER_ORDER: string[] = ['apollo', 'lusha', 'fullenrich'];

// Fields that can be requested in selective enrichment.
export const ENRICHABLE_FIELDS = [
  { key: 'personal_email', label: 'Personal work email', description: 'Direct work email for a named decision-maker' },
  { key: 'alternative_email', label: 'Alternative email', description: 'Secondary email if the primary was not found' },
  { key: 'mobile', label: 'Mobile number', description: 'Direct mobile for a decision-maker' },
  { key: 'direct_dial', label: 'Direct dial', description: 'Direct landline for a decision-maker' },
  { key: 'company_phone', label: 'Company phone', description: 'Main switchboard / landline' },
  { key: 'decision_maker_role', label: 'Decision-maker role', description: 'Senior contact name and job title' },
  { key: 'company_intelligence', label: 'Company intelligence', description: 'Industry, size, location, website' },
] as const;

// Loads the organisation's provider priority config from Organisation.settings.
// Returns the ordered list of enabled provider IDs.
export function getProviderOrder(org: any): string[] {
  const config = org?.settings?.enrichment_config;
  if (config && Array.isArray(config.providers) && config.providers.length) {
    const enabled = config.providers
      .filter((p: any) => p.enabled !== false)
      .sort((a: any, b: any) => (a.priority || 99) - (b.priority || 99))
      .map((p: any) => p.provider);
    // Include any connected providers not in the config, at the end.
    for (const p of DEFAULT_PROVIDER_ORDER) {
      if (!enabled.includes(p)) enabled.push(p);
    }
    return enabled;
  }
  return [...DEFAULT_PROVIDER_ORDER];
}

// Deterministically extracts supported role phrases from a saved brief/ICP.
// This keeps enrichment aligned with the list even when legacy lists have not yet
// populated their structured target_titles field.
const SUPPORTED_TARGET_ROLES = [
  'Managing Director', 'Operations Director', 'Operations Manager', 'Engineering Director', 'Engineering Manager',
  'Production Director', 'Production Manager', 'Technical Director', 'Technical Manager', 'Site Manager', 'Factory Manager',
  'Facilities Manager', 'Utilities Manager', 'Sustainability Lead', 'Environmental Lead', 'Hygiene Manager', 'CIP Manager',
  'Head Brewer', 'Winemaker', 'Production Lead', 'Commercial Director', 'Procurement Director', 'Head of Procurement',
  'Buyer', 'Senior Buyer', 'Buying Director', 'Quantity Surveyor', 'Senior Quantity Surveyor', 'Commercial Manager',
  'Development Director',
];

export function extractTargetRolesFromText(text: string): string[] {
  const source = String(text || '').toLowerCase();
  const roles = SUPPORTED_TARGET_ROLES.filter((role) => source.includes(role.toLowerCase()));
  const pairedRoles: Array<[string, string[]]> = [
    ['operations director or manager', ['Operations Director', 'Operations Manager']],
    ['engineering director or manager', ['Engineering Director', 'Engineering Manager']],
    ['production director or manager', ['Production Director', 'Production Manager']],
    ['technical director or manager', ['Technical Director', 'Technical Manager']],
    ['site or factory manager', ['Site Manager', 'Factory Manager']],
    ['facilities or utilities manager', ['Facilities Manager', 'Utilities Manager']],
    ['sustainability or environmental lead', ['Sustainability Lead', 'Environmental Lead']],
    ['hygiene or cip manager', ['Hygiene Manager', 'CIP Manager']],
    ['head brewer, winemaker or production lead', ['Head Brewer', 'Winemaker', 'Production Lead']],
  ];
  for (const [phrase, expanded] of pairedRoles) {
    if (source.includes(phrase)) for (const role of expanded) if (!roles.includes(role)) roles.push(role);
  }
  return roles;
}

// Loads the organisation's target role preferences for decision-maker ranking.
export function getTargetRoles(org: any): string[] {
  const config = org?.settings?.enrichment_config;
  if (config && Array.isArray(config.target_roles) && config.target_roles.length) {
    return config.target_roles;
  }
  return [];
}

// Loads the organisation's preferred seniority keywords.
export function getPreferredSeniority(org: any): string[] {
  const config = org?.settings?.enrichment_config;
  if (config && Array.isArray(config.preferred_seniority) && config.preferred_seniority.length) {
    return config.preferred_seniority;
  }
  return ['Managing Director', 'CEO', 'Commercial Director', 'Development Director',
    'Sales Director', 'Procurement Director', 'Finance Director', 'Director', 'Head of'];
}

// Resolves the connected, enabled enrichment providers for an organisation
// in priority order. Returns only provider IDs that have credentials stored.
export async function resolveProviders(base44: any, org: any): Promise<{
  order: string[];
  credentials: { get: (name: string) => string };
  connected: Record<string, boolean>;
}> {
  const creds = await getOrgCredentials(base44, org);
  const configuredOrder = getProviderOrder(org);

  // Filter to only providers that actually have credentials stored.
  const connected: Record<string, boolean> = {};
  const apiKeyMap: Record<string, string> = {
    apollo: 'APOLLO_API_KEY',
    lusha: 'LUSHA_API_KEY',
    fullenrich: 'FULLENRICH_API_KEY',
  };

  const order = configuredOrder.filter((provider) => {
    const keyField = apiKeyMap[provider];
    const has = keyField ? !!creds.get(keyField) : false;
    connected[provider] = has;
    return has;
  });

  return { order, credentials: creds, connected };
}

// Saves the organisation's provider priority config.
// Only callable by organisation admins (enforced by the backend function).
export async function saveProviderPriorityConfig(base44: any, org: any, config: {
  providers: Array<{ provider: string; enabled: boolean; priority: number }>;
  target_roles?: string[];
  preferred_seniority?: string[];
}) {
  const settings = { ...(org.settings || {}) };
  settings.enrichment_config = {
    providers: config.providers,
    target_roles: config.target_roles || getTargetRoles(org),
    preferred_seniority: config.preferred_seniority || getPreferredSeniority(org),
  };
  await base44.asServiceRole.entities.Organisation.update(org.id, { settings });
  return settings.enrichment_config;
}