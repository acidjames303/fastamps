// Organisation-level enrichment memory — before calling any external provider,
// checks existing Company and Contact records belonging to the same organisation.
// Reuses valid data instead of consuming Smart Actions or provider credits.
//
// SECURITY: Only searches records with matching organisation_id. Never crosses
// org boundaries. The org.id is resolved server-side by the calling function.

export interface OrgMemoryResult {
  reused: boolean;
  contacts: any[];
  intelligence: {
    domain?: string;
    website?: string;
    industry?: string;
    employee_range?: string;
    location?: string;
    landline?: string;
  };
  source: string;
}

// Searches the organisation's existing Company and Contact records for data
// matching the prospect being enriched. Returns reusable contacts and intelligence.
export async function checkOrgEnrichmentMemory(
  base44: any,
  org: any,
  opts: {
    company_name: string;
    domain?: string;
    website?: string;
  }
): Promise<OrgMemoryResult> {
  const empty: OrgMemoryResult = { reused: false, contacts: [], intelligence: {}, source: '' };
  if (!org?.id || !opts.company_name) return empty;

  // Search by domain first (most reliable), then by name.
  let existingCompany: any = null;
  if (opts.domain) {
    try {
      const byDomain = await base44.asServiceRole.entities.Company.filter(
        { domain: opts.domain, organisation_id: org.id }, '-updated_date', 1,
      );
      if (byDomain && byDomain[0]) existingCompany = byDomain[0];
    } catch {}
  }
  if (!existingCompany) {
    try {
      const byName = await base44.asServiceRole.entities.Company.filter(
        { name: opts.company_name, organisation_id: org.id }, '-updated_date', 1,
      );
      if (byName && byName[0]) existingCompany = byName[0];
    } catch {}
  }

  if (!existingCompany) return empty;

  // Load contacts for this company.
  let contacts: any[] = [];
  try {
    contacts = await base44.asServiceRole.entities.Contact.filter(
      { company_id: existingCompany.id, organisation_id: org.id }, '-updated_date', 20,
    );
  } catch {}

  const mapped = contacts
    .filter((c: any) => c.full_name || c.email || c.phone)
    .map((c: any) => ({
      name: c.full_name || '',
      title: c.job_title || '',
      phone: c.phone || '',
      email: c.email || '',
      linkedin: c.linkedin || '',
    }));

  return {
    reused: true,
    contacts: mapped,
    intelligence: {
      domain: existingCompany.domain || '',
      website: existingCompany.website || '',
      industry: existingCompany.industry || '',
      employee_range: existingCompany.employee_range || '',
      location: existingCompany.location || '',
      landline: existingCompany.landline || '',
    },
    source: `Reused from organisation data (Company: ${existingCompany.name})`,
  };
}

// Also checks existing Prospect records in the same org for the same company.
// Returns contacts and intelligence from previously enriched prospects.
export async function checkProspectMemory(
  base44: any,
  org: any,
  opts: {
    company_name: string;
    domain?: string;
    exclude_prospect_id?: string;
  }
): Promise<OrgMemoryResult> {
  const empty: OrgMemoryResult = { reused: false, contacts: [], intelligence: {}, source: '' };
  if (!org?.id || !opts.company_name) return empty;

  // Search for other Prospect records with the same company name or domain.
  let matches: any[] = [];
  try {
    if (opts.domain) {
      matches = await base44.asServiceRole.entities.Prospect.filter(
        { domain: opts.domain, organisation_id: org.id }, '-updated_date', 10,
      );
    }
    if (!matches.length) {
      matches = await base44.asServiceRole.entities.Prospect.filter(
        { company_name: opts.company_name, organisation_id: org.id }, '-updated_date', 10,
      );
    }
  } catch {}

  // Exclude the current prospect.
  matches = matches.filter((p: any) => p.id !== opts.exclude_prospect_id);
  if (!matches.length) return empty;

  // Find the best prospect — one with the most contacts and a personal email.
  const best = matches
    .filter((p: any) => p.contacts?.length || p.email || p.phone)
    .sort((a: any, b: any) => (b.contacts?.length || 0) - (a.contacts?.length || 0))[0];

  if (!best) return empty;

  const mapped = (best.contacts || [])
    .filter((c: any) => c.name || c.email || c.phone)
    .map((c: any) => ({
      name: c.name || '',
      title: c.title || '',
      phone: c.phone || '',
      email: c.email || '',
      linkedin: c.linkedin || '',
    }));

  return {
    reused: true,
    contacts: mapped,
    intelligence: {
      domain: best.domain || '',
      website: best.website || '',
      industry: best.industry || '',
      employee_range: best.employee_range || '',
      location: best.location || '',
      landline: best.landline || '',
    },
    source: `Reused from organisation data (Prospect: ${best.company_name})`,
  };
}