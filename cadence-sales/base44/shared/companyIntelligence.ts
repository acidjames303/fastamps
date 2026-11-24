// Organisation-scoped reusable company-intelligence cache.
//
// The canonical key prefers a normalised domain, then falls back to a
// normalised company name. This means duplicate Company rows in different
// lists reuse one paid research result. The cache never crosses organisations.

export function normaliseCompanyDomain(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
    .replace(/:\d+$/, '');
}

export function normaliseCompanyName(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(limited|ltd|plc|llp|incorporated|inc|company|co)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

export function companyCanonicalKey(company = {}) {
  const domain = normaliseCompanyDomain(company.domain || company.website || '');
  if (domain) return `domain:${domain}`;
  const name = normaliseCompanyName(company.name || company.company_name || company.company || '');
  return name ? `name:${name}` : '';
}

export function isCurrentIntelligence(record, at = new Date()) {
  if (!record || record.status !== 'current') return false;
  if (!record.expires_at) return false;
  return new Date(record.expires_at).getTime() > at.getTime();
}

export async function findReusableCompanyIntelligence(base44, organisationId, company) {
  if (!organisationId || !company) return null;

  const direct = company.id
    ? await base44.asServiceRole.entities.CompanyIntelligence.filter(
        { organisation_id: organisationId, company_id: company.id },
        '-generated_at', 5
      ).catch(() => [])
    : [];
  const directCurrent = direct.find((item) => isCurrentIntelligence(item));
  if (directCurrent) return directCurrent;

  const canonicalKey = companyCanonicalKey(company);
  if (!canonicalKey) return null;
  const matches = await base44.asServiceRole.entities.CompanyIntelligence.filter(
    { organisation_id: organisationId, canonical_key: canonicalKey },
    '-generated_at', 20
  ).catch(() => []);
  const canonicalMatch = matches.find((item) => isCurrentIntelligence(item));
  if (canonicalMatch) return canonicalMatch;

  // Backward-compatible fallback for intelligence created before canonical_key
  // existed. This makes historical research reusable immediately; successful
  // reuse/upsert gradually backfills the canonical cache without paid calls.
  const legacyName = normaliseCompanyName(company.name || company.company_name || company.company || '');
  if (!legacyName) return null;
  const legacyRows = await base44.asServiceRole.entities.CompanyIntelligence.filter(
    { organisation_id: organisationId, status: 'current' },
    '-generated_at', 500
  ).catch(() => []);
  return legacyRows.find((item) =>
    isCurrentIntelligence(item) && normaliseCompanyName(item.company_name) === legacyName
  ) || null;
}

function reusableFields(source) {
  return {
    canonical_key: source.canonical_key,
    turnover_estimate: source.turnover_estimate || '',
    tech_stack: source.tech_stack || [],
    news: source.news || '',
    buyer_signals: source.buyer_signals || '',
    icp_fit_score: source.icp_fit_score || 0,
    icp_fit_reason: source.icp_fit_reason || '',
    target_roles: source.target_roles || [],
    ai_summary: source.ai_summary || '',
    source: source.source || 'cache',
    status: 'current',
    generated_at: source.generated_at,
    expires_at: source.expires_at,
    confidence: source.confidence || 0,
    intelligence_version: source.intelligence_version || 1,
    model_provider: source.model_provider || '',
    model_name: source.model_name || '',
    estimated_cost: 0,
    error_message: '',
    research_lock_expires_at: null,
  };
}

export async function attachCachedIntelligence(base44, organisationId, company, cached) {
  if (!cached || !isCurrentIntelligence(cached)) return null;
  if (cached.company_id === company.id) return cached;
  return upsertCompanyIntelligence(base44, company.id, company.name, {
    organisation_id: organisationId,
    ...reusableFields(cached),
  });
}

export async function findActiveResearchLock(base44, organisationId, company) {
  const canonicalKey = companyCanonicalKey(company);
  if (!canonicalKey) return null;
  const rows = await base44.asServiceRole.entities.CompanyIntelligence.filter(
    { organisation_id: organisationId, canonical_key: canonicalKey, status: 'researching' },
    '-generated_at', 10
  ).catch(() => []);
  const now = Date.now();
  return rows.find((row) => row.research_lock_expires_at && new Date(row.research_lock_expires_at).getTime() > now) || null;
}

// Upserts a CompanyIntelligence record after validating tenant ownership.
export async function upsertCompanyIntelligence(base44, companyId, companyName, fields) {
  if (!companyId) return null;
  const organisation_id = fields && fields.organisation_id;
  if (!organisation_id) throw new Error('organisation_id is required to upsert company intelligence');
  const { organisation_id: _omit, ...rest } = fields;

  const company = await base44.asServiceRole.entities.Company.get(companyId).catch(() => null);
  if (!company) return null;
  if (company.organisation_id !== organisation_id) {
    throw new Error('Company does not belong to the authenticated organisation');
  }

  const existing = await base44.asServiceRole.entities.CompanyIntelligence.filter({
    company_id: companyId,
    organisation_id,
  });
  const now = new Date().toISOString();
  const canonical_key = rest.canonical_key || companyCanonicalKey(company);

  if (existing.length) {
    return base44.asServiceRole.entities.CompanyIntelligence.update(existing[0].id, {
      ...rest,
      canonical_key,
      company_name: companyName || company.name,
      researched_at: now,
    });
  }
  return base44.asServiceRole.entities.CompanyIntelligence.create({
    company_id: companyId,
    company_name: companyName || company.name,
    canonical_key,
    organisation_id,
    researched_at: now,
    ...rest,
  });
}
