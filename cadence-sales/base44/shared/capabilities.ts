// Capability model — the single source of truth for what a role may do.
//
// Roles are labels; capabilities are what the backend enforces. Every gate in a
// backend function asks "can this profile do X?", never "is this role named bdm?".
//
//   platform_owner      JP/Aileen permanent co-owners with full administration
//   organisation_admin  delegated campaign administrator (not a co-owner)
//   internal_bd         Malcolm   internal business development (own pipeline)
//   sales_manager       legacy    manager capability set (kept for existing accounts)
//   bdm                 SDR/BDR   delivery caller — no provider or AI spend
//   reporting_user      read-only reporting/export
//
// `bdm` is deliberately NOT reused for internal business development: delivery
// callers and internal new-business owners have different spending rights.

export const CAPABILITIES = {
  platform: 'platform',
  clients: 'clients',
  campaigns: 'campaigns',
  providers: 'providers',
  prospecting: 'prospecting',
  export: 'export',
  calling: 'calling',
  meetings: 'meetings',
  meeting_approval: 'meeting_approval',
  reporting: 'reporting',
  assignment: 'assignment',
  team_management: 'team_management',
  own_pipeline: 'own_pipeline',
  convert_client: 'convert_client',
  research_request: 'research_request',
} as const;

const ALL = Object.values(CAPABILITIES);

export const ROLE_CAPABILITIES: Record<string, string[]> = {
  platform_owner: ALL,
  // Campaign administrator: runs client delivery. User administration is the
  // platform owner's alone, so this role deliberately holds no team_management.
  organisation_admin: [
    CAPABILITIES.clients, CAPABILITIES.campaigns, CAPABILITIES.providers,
    CAPABILITIES.prospecting, CAPABILITIES.export, CAPABILITIES.calling,
    CAPABILITIES.meetings, CAPABILITIES.meeting_approval, CAPABILITIES.reporting,
    CAPABILITIES.assignment, CAPABILITIES.research_request,
  ],
  sales_manager: [
    CAPABILITIES.clients, CAPABILITIES.campaigns, CAPABILITIES.providers,
    CAPABILITIES.prospecting, CAPABILITIES.export, CAPABILITIES.calling,
    CAPABILITIES.meetings, CAPABILITIES.meeting_approval, CAPABILITIES.reporting,
    CAPABILITIES.assignment, CAPABILITIES.research_request,
  ],
  // Internal business development: runs B2B Sales Leads' own new business, spends
  // on approved providers, books meetings and may convert a win into a client.
  // No organisation administration, no platform configuration.
  internal_bd: [
    CAPABILITIES.own_pipeline, CAPABILITIES.providers, CAPABILITIES.prospecting,
    CAPABILITIES.calling, CAPABILITIES.meetings, CAPABILITIES.reporting,
    CAPABILITIES.convert_client, CAPABILITIES.research_request,
  ],
  // Delivery SDR/BDR: assigned work only.
  bdm: [
    CAPABILITIES.calling, CAPABILITIES.meetings, CAPABILITIES.research_request,
  ],
  reporting_user: [CAPABILITIES.reporting, CAPABILITIES.export],
};

export function capabilitiesFor(profile: any): string[] {
  const role = profile && profile.app_role;
  return (role && ROLE_CAPABILITIES[role]) || [];
}

export function can(profile: any, capability: string): boolean {
  return capabilitiesFor(profile).includes(capability);
}

export function assertCapability(profile: any, capability: string, message?: string): void {
  if (!can(profile, capability)) {
    const e: any = new Error(message || 'Your role does not permit this action.');
    e.status = 403;
    throw e;
  }
}