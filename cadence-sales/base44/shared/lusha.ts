// Single Lusha API client for the whole app.
//
// The v3 Search-and-Enrich endpoint accepts a contact identified by ANY ONE of:
//   - Lusha contact id
//   - linkedinUrl
//   - email
//   - firstName + lastName + (companyName OR companyDomain)
// It does NOT accept `fullName`. Sending an unknown field fails the whole
// request with HTTP 400, which is why Lusha lookups silently returned nothing
// for every contact. Every caller must go through this module so the payload,
// matching order, response mapping and error reporting stay consistent.

export const LUSHA_BASE = 'https://api.lusha.com/v3';

import { classifyUkPhone } from './ukPhone.ts';

export type LushaReveal = 'phones' | 'emails';

export interface LushaInputContact {
  name?: string;
  title?: string;
  linkedin?: string;
  email?: string;
  lusha_id?: string;
}

export interface LushaCompany {
  name?: string;
  domain?: string;
}

export interface LushaPhone {
  number: string;
  normalised: string;
  type: string;        // mobile | direct | work | unknown
  isMobile: boolean;
  isDirect: boolean;
  isSwitchboard: boolean;
  doNotCall: boolean;
  raw: any;            // provider value retained for provenance
  // Deterministic classification — the provider's label is only a claim.
  uk_type: string;     // mobile | geographic | non_geographic | freephone | ...
  type_label: string;
  area_code: string;
  valid: boolean;
  // True when the provider called it a mobile but the numbering plan disagrees.
  provider_type_conflict: boolean;
}

export interface LushaEmail {
  email: string;
  type: string;
  confidence: string;
}

// Honest, user-facing outcome categories. Never collapse these into
// "no information found".
export type LushaStatus =
  | 'revealed'
  | 'matched_no_number'
  | 'matched_no_email'
  | 'contact_not_matched'
  | 'company_not_matched'
  | 'company_mismatch'
  | 'invalid_request'
  | 'auth_failed'
  | 'permission_failed'
  | 'quota_exhausted'
  | 'rate_limited'
  | 'plan_restricted'
  | 'provider_error'
  | 'no_identifier'
  | 'not_called';

export interface LushaPersonResult {
  index: number;
  status: LushaStatus;
  message: string;
  matched: boolean;
  lusha_id: string;
  matched_name: string;
  job_title: string;
  linkedin: string;
  phones: LushaPhone[];
  emails: LushaEmail[];
  partial_profile: boolean;
  // Current-employer evidence. A name match alone never establishes that the
  // number belongs to this person at the company on the campaign.
  company_name: string;
  company_domain: string;
  location: string;
  employment_check: 'confirmed' | 'mismatch' | 'unconfirmed';
}

export interface LushaCompanyContext {
  name?: string;
  domain?: string;
}

export interface LushaResponse {
  ok: boolean;
  http_status: number;
  error_category: string;
  retryable: boolean;
  message: string;
  credits_charged: number;
  results_returned: number;
  results: LushaPersonResult[];
}

const LUSHA_STATUS_MESSAGE: Record<LushaStatus, string> = {
  revealed: 'Lusha returned contact details.',
  matched_no_number: 'Contact matched in Lusha but no mobile number was returned. Lusha may hold it in its web platform, but the connected API did not make the number available.',
  matched_no_email: 'Contact matched in Lusha but no email was returned. Lusha may hold it in its web platform, but the connected API did not make the email available.',
  contact_not_matched: 'Contact not matched by Lusha.',
  company_not_matched: 'Company not matched by Lusha.',
  company_mismatch: 'Lusha matched this name at a different company — not applied.',
  invalid_request: 'Lusha rejected the request as invalid.',
  auth_failed: 'Lusha authentication failed. Check the Lusha API key.',
  permission_failed: 'Lusha permission failed. The connected API key is not allowed to make this call.',
  quota_exhausted: 'Lusha quota exhausted. No credits remain on the connected plan.',
  rate_limited: 'Lusha rate limit reached. Try again shortly.',
  plan_restricted: 'The connected Lusha API plan does not expose this field.',
  provider_error: 'Lusha returned an unexpected error.',
  no_identifier: 'Not enough identifying detail to ask Lusha for this contact (needs a LinkedIn URL, email, Lusha ID, or first and last name with the company).',
  not_called: 'Lusha was not called.',
};

export function lushaStatusMessage(status: LushaStatus): string {
  return LUSHA_STATUS_MESSAGE[status] || LUSHA_STATUS_MESSAGE.provider_error;
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const NAME_TITLES = /^(mr|mrs|ms|miss|mx|dr|prof|professor|sir|dame|lord|lady)\.?\s+/i;
const NAME_SUFFIXES = new Set(['obe', 'mbe', 'cbe', 'kbe', 'phd', 'ceng', 'frics', 'bsc', 'msc', 'ba', 'ma', 'fca']);

// Splits a display name into the first/last pair Lusha matches on. Middle
// names, titles and post-nominals are dropped, and curly apostrophes are
// straightened — "Dr. Siân O'Neil-Mbeki MBE" becomes first "Siân", last "O'Neil-Mbeki".
export function splitPersonName(full: string): { firstName: string; lastName: string } {
  let value = String(full || '')
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  value = value.replace(NAME_TITLES, '');
  const parts = value.split(' ').filter(Boolean);
  while (parts.length > 2 && NAME_SUFFIXES.has(parts[parts.length - 1].replace(/\./g, '').toLowerCase())) {
    parts.pop();
  }
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

export function normaliseDomain(raw: string): string {
  let value = String(raw || '').trim().toLowerCase();
  if (!value) return '';
  value = value.replace(/^https?:\/\//, '').replace(/^www\./, '');
  value = value.split('/')[0].split('?')[0].split('#')[0];
  value = value.replace(/\.$/, '');
  return /\./.test(value) ? value : '';
}

// LinkedIn profile URLs are the strongest identifier Lusha accepts, so keep the
// canonical /in/<slug> form and drop query strings.
export function normaliseLinkedinUrl(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  const match = value.match(/linkedin\.com\/(?:[a-z]{2}\/)?in\/([^/?#]+)/i);
  if (!match) return '';
  return `https://www.linkedin.com/in/${match[1]}`;
}

export function normalisePhone(raw: string): string {
  let digits = String(raw || '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = '+' + digits.slice(2);
  if (digits.startsWith('0')) return '+44' + digits.slice(1);
  if (digits.startsWith('44')) return '+' + digits;
  if (digits.startsWith('+')) return digits;
  return '+' + digits;
}

// Readable UK display format while the normalised value is kept for dialling.
export function formatUkPhone(raw: string): string {
  const value = normalisePhone(raw);
  if (!value) return String(raw || '').trim();
  const uk = value.match(/^\+44(\d+)$/);
  if (!uk) return value;
  const national = uk[1];
  if (national.length === 10 && national.startsWith('7')) {
    return `+44 ${national.slice(0, 4)} ${national.slice(4)}`;
  }
  if (national.length === 10) {
    return `+44 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
  }
  if (national.length === 9) return `+44 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
  return `+44 ${national}`;
}

function mapPhone(raw: any): LushaPhone | null {
  const number = raw?.number || raw?.internationalNumber || raw?.nationalNumber || '';
  if (!number) return null;
  const rawType = String(raw?.type || raw?.phoneType || 'unknown').toLowerCase();
  const uk = classifyUkPhone(number);
  const providerSaysMobile = rawType === 'mobile' || rawType === 'cell' || rawType === 'cellphone';
  const providerSaysDirect = rawType === 'direct' || rawType === 'directdial' || rawType === 'direct_dial';
  // The numbering plan decides. A 024 geographic number is never a mobile,
  // whatever the provider's type field claims.
  const isMobile = uk.isMobile;
  const isDirect = !isMobile && uk.valid && (providerSaysDirect || uk.isGeographic || uk.type === 'non_geographic');
  return {
    number: uk.e164 ? formatUkPhone(number) : String(number),
    normalised: normalisePhone(number),
    type: isMobile ? 'mobile' : providerSaysDirect ? 'direct' : uk.valid ? uk.type : rawType || 'unknown',
    isMobile,
    isDirect,
    isSwitchboard: !isMobile && !isDirect,
    doNotCall: raw?.doNotCall === true,
    raw,
    uk_type: uk.type,
    type_label: uk.label,
    area_code: uk.areaCode,
    valid: uk.valid,
    provider_type_conflict: providerSaysMobile && !uk.isMobile,
  };
}

function mapEmail(raw: any): LushaEmail | null {
  const email = raw?.email || raw?.address || '';
  if (!email) return null;
  return { email, type: raw?.type || 'unknown', confidence: raw?.confidence || '' };
}

// Builds the `contacts[]` entries. Each entry uses the strongest identifier we
// hold, in the documented priority order.
export function buildRequestContacts(
  list: LushaInputContact[],
  company: LushaCompany,
): { body: any[]; missing: number[] } {
  const companyName = String(company?.name || '').trim();
  const companyDomain = normaliseDomain(company?.domain || '');
  const body: any[] = [];
  const missing: number[] = [];

  list.forEach((contact, index) => {
    const entry: any = { clientReferenceId: `c${index}` };
    const lushaId = String(contact?.lusha_id || '').trim();
    const linkedin = normaliseLinkedinUrl(contact?.linkedin || '');
    const email = String(contact?.email || '').trim();
    const { firstName, lastName } = splitPersonName(contact?.name || '');

    if (lushaId) entry.id = lushaId;
    else if (linkedin) entry.linkedinUrl = linkedin;
    else if (email && /@/.test(email)) entry.email = email;
    else if (firstName && lastName && (companyDomain || companyName)) {
      entry.firstName = firstName;
      entry.lastName = lastName;
      if (companyDomain) entry.companyDomain = companyDomain;
      if (companyName) entry.companyName = companyName;
    } else {
      missing.push(index);
      return;
    }

    // Company context helps Lusha disambiguate common names even when we
    // matched on a stronger identifier.
    if (!entry.companyDomain && companyDomain) entry.companyDomain = companyDomain;
    if (!entry.companyName && companyName) entry.companyName = companyName;
    body.push(entry);
  });

  return { body, missing };
}

const LEGAL_WORDS = /\b(ltd|limited|plc|llp|co|company|group|holdings|holding|uk|the|and)\b/g;

function companyTokens(name: string): string[] {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(LEGAL_WORDS, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

// Guards against attaching a stranger's number: a common name can match at the
// wrong employer. Only an obvious mismatch is flagged — a rebrand or trading
// name still shares a significant word.
export function isSameCompany(requested: string, returned: string): boolean {
  const wanted = companyTokens(requested);
  if (!wanted.length || !returned) return true;
  const got = new Set(companyTokens(returned));
  if (!got.size) return true;
  return wanted.some((t) => got.has(t));
}

function classifyHttpFailure(status: number): { status: LushaStatus; category: string; retryable: boolean } {
  if (status === 401) return { status: 'auth_failed', category: 'auth_error', retryable: false };
  if (status === 403) return { status: 'permission_failed', category: 'auth_error', retryable: false };
  if (status === 402) return { status: 'quota_exhausted', category: 'quota_exceeded', retryable: false };
  if (status === 429) return { status: 'rate_limited', category: 'rate_limit', retryable: true };
  if (status === 400 || status === 422) return { status: 'invalid_request', category: 'invalid_response', retryable: false };
  if (status >= 500) return { status: 'provider_error', category: 'server_error', retryable: true };
  return { status: 'provider_error', category: 'unknown', retryable: false };
}

// ---------------------------------------------------------------------------
// The call
// ---------------------------------------------------------------------------

export async function lushaSearchAndEnrich(
  apiKey: string,
  opts: { contacts: LushaInputContact[]; company: LushaCompany; reveal: LushaReveal[] },
): Promise<LushaResponse> {
  const { body, missing } = buildRequestContacts(opts.contacts || [], opts.company || {});
  const reveal = (opts.reveal && opts.reveal.length ? opts.reveal : ['phones']) as LushaReveal[];

  const base: LushaResponse = {
    ok: false,
    http_status: 0,
    error_category: 'none',
    retryable: false,
    message: '',
    credits_charged: 0,
    results_returned: 0,
    results: (opts.contacts || []).map((_, index) => ({
      index,
      status: 'not_called' as LushaStatus,
      message: lushaStatusMessage('not_called'),
      matched: false,
      lusha_id: '',
      matched_name: '',
      job_title: '',
      linkedin: '',
      phones: [],
      emails: [],
      partial_profile: false,
      company_name: '',
      company_domain: '',
      location: '',
      employment_check: 'unconfirmed' as const,
    })),
  };

  // Nothing identifiable — report it rather than spending a request.
  if (!body.length) {
    base.error_category = 'invalid_response';
    base.message = lushaStatusMessage('no_identifier');
    base.results = base.results.map((r) => ({ ...r, status: 'no_identifier', message: lushaStatusMessage('no_identifier') }));
    return base;
  }

  if (!apiKey) {
    base.error_category = 'auth_error';
    base.message = lushaStatusMessage('auth_failed');
    base.results = base.results.map((r) => ({ ...r, status: 'auth_failed', message: lushaStatusMessage('auth_failed') }));
    return base;
  }

  let res: Response;
  try {
    res = await fetch(`${LUSHA_BASE}/contacts/search-and-enrich`, {
      method: 'POST',
      headers: { api_key: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts: body, reveal, options: { includePartialProfiles: true } }),
    });
  } catch {
    base.error_category = 'network_error';
    base.retryable = true;
    base.message = 'Lusha could not be reached (network error).';
    base.results = base.results.map((r) => ({ ...r, status: 'provider_error', message: base.message }));
    return base;
  }

  base.http_status = res.status;

  if (!res.ok) {
    const failure = classifyHttpFailure(res.status);
    let providerDetail = '';
    try {
      const err = await res.json();
      providerDetail = String(err?.message || err?.errors?.[0]?.message || err?.error || '').slice(0, 200);
    } catch { /* body is not JSON — the status alone is the diagnosis */ }
    base.error_category = failure.category;
    base.retryable = failure.retryable;
    base.message = providerDetail
      ? `Lusha: ${lushaStatusMessage(failure.status)} (${providerDetail})`
      : `Lusha: ${lushaStatusMessage(failure.status)} (HTTP ${res.status})`;
    base.results = base.results.map((r) => ({ ...r, status: failure.status, message: base.message }));
    return base;
  }

  const payload: any = await res.json().catch(() => null);
  if (!payload) {
    base.error_category = 'invalid_response';
    base.message = 'Lusha returned a response that could not be read.';
    base.results = base.results.map((r) => ({ ...r, status: 'provider_error', message: base.message }));
    return base;
  }

  base.ok = true;
  base.credits_charged = Number(payload?.billing?.creditsCharged || 0);
  base.results_returned = Array.isArray(payload?.results) ? payload.results.length : 0;

  // Match by clientReferenceId, never by array position — Lusha may return
  // fewer results than it was sent, or in a different order.
  const byRef = new Map<string, any>();
  for (const row of (payload?.results || [])) {
    if (row?.clientReferenceId) byRef.set(String(row.clientReferenceId), row);
  }

  const wantedPhones = reveal.includes('phones');
  const wantedEmails = reveal.includes('emails');

  base.results = (opts.contacts || []).map((contact, index) => {
    const row = byRef.get(`c${index}`);
    if (!row || row.error) {
      // Lusha reports a definitive per-contact reason here (for example
      // NOT_FOUND). Never collapse it into "no information found".
      const code = String(row?.error?.code || '').toUpperCase();
      const detail = String(row?.error?.message || '').slice(0, 160);
      let status: LushaStatus = 'contact_not_matched';
      if (code.includes('COMPANY')) status = 'company_not_matched';
      else if (code.includes('LIMIT') || code.includes('QUOTA')) status = 'quota_exhausted';
      else if (code.includes('AUTH') || code.includes('KEY')) status = 'auth_failed';
      else if (code.includes('PERMISSION') || code.includes('PLAN') || code.includes('FORBIDDEN')) status = 'plan_restricted';
      else if (code && !code.includes('NOT_FOUND')) status = 'provider_error';
      return {
        index,
        status,
        message: detail ? `${lushaStatusMessage(status)} (${detail})` : lushaStatusMessage(status),
        matched: false,
        lusha_id: '',
        matched_name: '',
        job_title: '',
        linkedin: '',
        phones: [],
        emails: [],
        partial_profile: false,
        company_name: '',
        company_domain: '',
        location: '',
        employment_check: 'unconfirmed' as const,
      };
    }

    const phones = (row.phones || []).map(mapPhone).filter(Boolean) as LushaPhone[];
    const emails = (row.emails || []).map(mapEmail).filter(Boolean) as LushaEmail[];
    const matched = !!row.id || !!row.fullName;
    const partial = row.partialProfile === true;
    const linkedin = normaliseLinkedinUrl(row?.socialLinks?.linkedin || row?.linkedinUrl || '');

    const matchedCompany = String(row?.company?.name || '');
    const matchedDomain = normaliseDomain(row?.company?.domain || row?.company?.website || '');
    const requestedDomain = normaliseDomain(String(opts.company?.domain || ''));
    const wrongCompany = matched && !!matchedCompany && !isSameCompany(String(opts.company?.name || ''), matchedCompany);
    // A returned domain that contradicts the one we asked about is a stronger
    // signal than a name that happens to share a word.
    const domainConflict = !!matchedDomain && !!requestedDomain && matchedDomain !== requestedDomain;
    // "Confirmed" needs positive evidence of the current employer; silence is
    // never treated as confirmation.
    const employment_check: 'confirmed' | 'mismatch' | 'unconfirmed' = !matched
      ? 'unconfirmed'
      : (wrongCompany || domainConflict) ? 'mismatch'
        : (matchedCompany || matchedDomain) ? 'confirmed'
          : 'unconfirmed';

    let status: LushaStatus;
    if (!matched) status = 'contact_not_matched';
    else if (employment_check === 'mismatch') status = 'company_mismatch';
    else if (wantedPhones && !phones.some((p) => p.isMobile)) status = partial ? 'plan_restricted' : 'matched_no_number';
    else if (wantedEmails && !emails.length && !wantedPhones) status = 'matched_no_email';
    else status = 'revealed';

    return {
      index,
      status,
      message: lushaStatusMessage(status),
      matched,
      lusha_id: row.id || '',
      matched_name: row.fullName || [row.firstName, row.lastName].filter(Boolean).join(' '),
      job_title: row?.jobTitle?.title || row?.jobTitle || '',
      linkedin,
      phones,
      emails,
      partial_profile: partial,
      company_name: matchedCompany,
      company_domain: matchedDomain,
      location: String(row?.location?.name || row?.location || ''),
      employment_check,
    };
  });

  for (const index of missing) {
    base.results[index] = {
      ...base.results[index],
      status: 'no_identifier',
      message: lushaStatusMessage('no_identifier'),
    };
  }

  const failures = base.results.filter((r) => ['auth_failed', 'permission_failed', 'quota_exhausted', 'rate_limited', 'invalid_request', 'provider_error'].includes(r.status));
  if (failures.length && failures.length === base.results.length) {
    base.ok = false;
    base.error_category = classifyHttpFailure(base.http_status || 0).category;
    base.message = failures[0].message;
  } else if (failures.length) {
    base.message = failures[0].message;
  } else {
    const revealed = base.results.filter((r) => r.status === 'revealed').length;
    const noNumber = base.results.filter((r) => r.status === 'matched_no_number' || r.status === 'plan_restricted').length;
    const notMatched = base.results.filter((r) => r.status === 'contact_not_matched').length;
    const parts: string[] = [];
    if (revealed) parts.push(`${revealed} contact${revealed === 1 ? '' : 's'} returned with details`);
    if (noNumber) parts.push(`${noNumber} matched but no number available through the API`);
    if (notMatched) parts.push(`${notMatched} not matched`);
    base.message = parts.join('; ') || 'Lusha returned no usable result.';
  }

  return base;
}

// Picks the best number for a named contact: a personal mobile first, then a
// direct dial. A company switchboard is never treated as a person's mobile.
export function pickPersonNumber(phones: LushaPhone[]): LushaPhone | null {
  const usable = (phones || []).filter((p) => p && p.normalised && p.valid && !p.doNotCall);
  const mobile = usable.find((p) => p.isMobile);
  if (mobile) return mobile;
  const direct = usable.find((p) => p.isDirect);
  if (direct) return direct;
  return null;
}

// Strictly mobile-only selection, for callers that must not receive a landline.
export function pickMobileNumber(phones: LushaPhone[]): LushaPhone | null {
  return (phones || []).find((p) => p && p.normalised && p.valid && p.isMobile && !p.doNotCall) || null;
}

export function pickSwitchboardNumber(phones: LushaPhone[]): LushaPhone | null {
  return (phones || []).find((p) => p && p.normalised && p.valid && !p.isMobile && !p.isDirect && !p.doNotCall) || null;
}

export function pickWorkEmail(emails: LushaEmail[]): LushaEmail | null {
  const list = emails || [];
  return list.find((e) => e.type === 'work' || e.confidence === 'A+') || list[0] || null;
}