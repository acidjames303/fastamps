// Decision-maker candidate scoring engine — ranks contacts by ICP relevance
// so the enrichment waterfall enriches only the best-matched candidates,
// saving provider credits and improving call quality.
//
// Scoring factors (from Sprint 17 spec):
//   Exact target-title match      +100
//   Target department match       +60
//   Preferred seniority            +40
//   Confirmed current company      +30
//   Apollo indicates email avail   +20
//   UK/selected geography match    +15
//   Generic leadership role only    +5
//   Irrelevant department          -50
//   Former employee               -100
//   Excluded role               Disqualify

export interface ScoringOptions {
  targetTitles: string[];
  targetDepartments: string[];
  preferredSeniority: string[];
  excludedTitles: string[];
  permittedCountryCodes: string[];
  contactCountryCode?: string;
  apolloHasEmail?: boolean;
  apolloHasPhone?: boolean;
  existingEmail?: boolean;
  existingPhone?: boolean;
  companyName?: string;
  apolloCompanyName?: string;
}

export interface ScoredCandidate {
  contact: any;
  score: number;
  explanation: string;
  disqualified: boolean;
  disqualifyReason?: string;
}

// Department keywords for matching contact titles to departments.
const DEPARTMENT_KEYWORDS: Record<string, string[]> = {
  commercial: ['commercial', 'sales', 'business development', 'revenue', 'growth', 'quantity surveyor', 'quantity surveying', 'estimator', 'estimating', 'qs', 'cost'],
  development: ['development', 'land', 'planning', 'technical'],
  procurement: ['procurement', 'purchasing', 'buying', 'buyer', 'buyers', 'supply chain'],
  finance: ['finance', 'financial', 'accounting', 'cfo'],
  operations: ['operations', 'operational', 'coo'],
  construction: ['construction', 'build', 'delivery'],
  recruitment: ['recruitment', 'talent', 'hr', 'human resources', 'people'],
  marketing: ['marketing', 'communications', 'brand'],
};

// Abbreviation/synonym expansion so title variants match consistently.
// e.g. "QS" → "quantity surveyor", "Purchasing" → "procurement".
const TITLE_SYNONYMS: Record<string, string> = {
  'qs': 'quantity surveyor',
  'purchasing': 'procurement',
  'buyer': 'buyer',
  'buying': 'buyer',
  'purchasing manager': 'procurement manager',
  'head of procurement': 'procurement director',
  'head of commercial': 'commercial director',
  'head of development': 'development director',
  'commercial manager': 'commercial manager',
};

function expandTitleSynonyms(text: string): string {
  let result = text;
  for (const [abbr, expansion] of Object.entries(TITLE_SYNONYMS)) {
    // Match whole-word abbreviations only.
    const re = new RegExp(`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    result = result.replace(re, expansion);
  }
  return result;
}

function normaliseRole(value: string): string {
  const expanded = expandTitleSynonyms((value || '').toLowerCase());
  return expanded
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word)
    .join(' ');
}

function titleMatchesAny(title: string, keywords: string[]): boolean {
  const t = normaliseRole(title);
  return keywords.some((keyword) => t.includes(normaliseRole(keyword)));
}

function detectDepartment(title: string): string | null {
  const t = (title || '').toLowerCase();
  for (const [dept, keywords] of Object.entries(DEPARTMENT_KEYWORDS)) {
    if (keywords.some(k => t.includes(k))) return dept;
  }
  return null;
}

// Scores a single candidate contact.
export function scoreCandidate(contact: any, opts: ScoringOptions): ScoredCandidate {
  const title = (contact.title || '').toLowerCase();
  const name = contact.name || '';
  const reasons: string[] = [];
  let score = 0;

  // Disqualify: excluded role.
  if (opts.excludedTitles && opts.excludedTitles.length) {
    for (const ex of opts.excludedTitles) {
      if (title.includes(ex.toLowerCase())) {
        return {
          contact,
          score: 0,
          explanation: `Disqualified — title matches excluded role "${ex}".`,
          disqualified: true,
          disqualifyReason: `Excluded role: ${ex}`,
        };
      }
    }
  }

  // +100: Exact target-title match, with priority weighting.
  // The first title in the target list is the highest priority.
  // A match on the first target title gets +100 + (n-1)*10 extra points,
  // so "Commercial Director" (priority 1) ranks above "Quantity Surveyor"
  // (priority 4) when both are in the ICP list.
  let exactMatch = false;
  if (opts.targetTitles && opts.targetTitles.length) {
    for (let i = 0; i < opts.targetTitles.length; i++) {
      const role = opts.targetTitles[i];
      if (titleMatchesAny(title, [role])) {
        const priorityBonus = (opts.targetTitles.length - i) * 10;
        score += 100 + priorityBonus;
        exactMatch = true;
        reasons.push(`title "${contact.title}" matches ICP target role "${role}" (priority ${i + 1})`);
        break;
      }
    }
  }

  // +60: Target department match.
  if (opts.targetDepartments && opts.targetDepartments.length) {
    const contactDept = detectDepartment(contact.title || '');
    if (contactDept && opts.targetDepartments.includes(contactDept)) {
      score += 60;
      reasons.push(`${contactDept} department matches target`);
    }
  }

  // +40: Preferred seniority.
  if (opts.preferredSeniority && opts.preferredSeniority.length) {
    for (const sen of opts.preferredSeniority) {
      if (title.includes(sen.toLowerCase())) {
        score += 40;
        reasons.push(`seniority "${sen}" preferred`);
        break;
      }
    }
  }

  // +30: Confirmed current company.
  if (opts.apolloCompanyName && opts.companyName) {
    const apolloLower = opts.apolloCompanyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const prospectLower = opts.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (apolloLower && prospectLower && (apolloLower.includes(prospectLower) || prospectLower.includes(apolloLower))) {
      score += 30;
      reasons.push('confirmed at target company');
    }
  }

  // +20: Apollo indicates email available.
  if (opts.apolloHasEmail) {
    score += 20;
    reasons.push('Apollo indicates an email is available');
  }

  // +15: UK/selected geography match.
  if (opts.contactCountryCode && opts.permittedCountryCodes && opts.permittedCountryCodes.length) {
    if (opts.permittedCountryCodes.includes(opts.contactCountryCode)) {
      score += 15;
      reasons.push(`located in ${opts.contactCountryCode}`);
    }
  }

  // +5: Generic leadership role only (if no exact match).
  if (!exactMatch) {
    const leadershipKeywords = ['director', 'head of', 'ceo', 'chief', 'managing', 'founder', 'partner', 'chair'];
    if (leadershipKeywords.some(k => title.includes(k))) {
      score += 5;
      reasons.push('senior leadership role');
    }
  }

  // Existing contact data boosts.
  if (opts.existingEmail) {
    score += 10;
    reasons.push('already has an email');
  }
  if (opts.existingPhone) {
    score += 10;
    reasons.push('already has a phone number');
  }

  // -50: Irrelevant department.
  if (opts.targetDepartments && opts.targetDepartments.length) {
    const contactDept = detectDepartment(contact.title || '');
    if (contactDept && !opts.targetDepartments.includes(contactDept)) {
      score -= 50;
      reasons.push(`${contactDept} department is not a target`);
    }
  }

  // -100: Former employee (heuristic — Apollo or AI may flag this).
  if (contact.is_former === true || (contact.status && contact.status.toLowerCase() === 'former')) {
    score -= 100;
    reasons.push('former employee');
  }

  const explanation = reasons.length
    ? `Ranked ${reasons.length > 1 ? 'first' : 'here'} because the contact matches ${reasons.join(', ')}.`
    : 'Included as a candidate.';

  return { contact, score, explanation, disqualified: false };
}

// Ranks a list of contacts by ICP relevance. Disqualified contacts are
// filtered out. Returns sorted contacts with scores and explanations.
export function rankCandidates(contacts: any[], opts: ScoringOptions): ScoredCandidate[] {
  if (!contacts || !contacts.length) return [];

  const scored = contacts
    .map(c => scoreCandidate(c, opts))
    .filter(s => !s.disqualified);

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// Selects the top N candidates that should be enriched by a provider.
// Only includes candidates that:
// - Match the requested company (handled by search context).
// - Meet the ICP role requirements (score > 0).
// - Indicate that Apollo may hold the requested data (has_email if email needed).
// - Do not already have acceptable organisation data.
export function selectForEnrichment(
  contacts: any[],
  opts: ScoringOptions,
  maxContacts: number,
  needsEmail: boolean,
): ScoredCandidate[] {
  const ranked = rankCandidates(contacts, opts);
  if (!ranked.length) return [];

  // Filter: only candidates with score > 0 (some ICP relevance).
  const relevant = ranked.filter(s => s.score > 0);

  // If we need emails, prefer candidates that indicate email availability.
  if (needsEmail) {
    const withEmailIndicator = relevant.filter(s =>
      opts.apolloHasEmail || s.contact.email_status === 'available' || !s.contact.email
    );
    const selected = (withEmailIndicator.length ? withEmailIndicator : relevant).slice(0, maxContacts);
    return selected;
  }

  return relevant.slice(0, maxContacts);
}