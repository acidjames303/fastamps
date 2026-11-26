// Field-level waterfall enrichment — replaces the all-or-nothing approach.
// For each prospect, inspects existing data, determines which fields are
// missing, and tries providers in the organisation's configured priority order.
// Stops requesting a field once an acceptable result is found.
// Uses the email quality classifier to ensure generic emails don't satisfy
// a personal-email request.

import {
  classifyHttpError, computeEnrichmentStatus, countryNameToCode, checkGeography,
  recordAttempt, recordUsage, cooldownExpiry, generateCorrelationId, isWithinCooldown,
} from './enrichmentDiagnostics.ts';
import { classifyEmail, pickBestEmail, normaliseEmail } from './emailQuality.ts';
import { shouldReplaceField, mergeContacts, CONFIDENCE, buildProvenance } from './nonDestructiveMerge.ts';
import { checkOrgEnrichmentMemory, checkProspectMemory } from './orgEnrichmentMemory.ts';
import { directCompanyLookup } from './directWebLookup.ts';
import { inferCompanyEmailPattern, applyPatternToContacts } from './emailPatternInference.ts';
import { rankCandidates } from './candidateScoring.ts';
import {
  lushaSearchAndEnrich, pickPersonNumber, pickSwitchboardNumber, pickWorkEmail,
  type LushaReveal, type LushaStatus,
} from './lusha.ts';
import {
  classifyUkPhone, evaluateProviderPhone, phoneDigits, isUkMobile,
} from './ukPhone.ts';
import { upsertContactPhoneCandidate } from './contactPhoneCandidates.ts';

const FULLENRICH = 'https://app.fullenrich.com/api/v2';
const APOLLO = 'https://api.apollo.io/api/v1';

// Lusha reports one status per contact. These precise categories are what the
// UI shows, so "no information found" never hides a real reason.
const LUSHA_STATUS_TO_RESULT: Record<string, string> = {
  revealed: 'contact_matched_mobile_returned',
  matched_no_number: 'contact_matched_no_phone',
  plan_restricted: 'field_not_available_on_api_plan',
  contact_not_matched: 'contact_not_matched',
  company_not_matched: 'contact_not_matched',
  company_mismatch: 'contact_not_matched',
  no_identifier: 'contact_not_matched',
  auth_failed: 'authentication_failed',
  permission_failed: 'permission_failed',
  quota_exhausted: 'quota_exhausted',
  rate_limited: 'rate_limited',
  invalid_request: 'temporary_provider_failure',
  provider_error: 'temporary_provider_failure',
};

const PHONE_RESULT_MESSAGES: Record<string, string> = {
  contact_not_matched: 'Lusha could not match this named contact.',
  contact_matched_no_phone: 'Lusha matched this contact but did not return a mobile or direct number through the API.',
  field_not_available_on_api_plan: "A number may be visible in Lusha's web product but was not available through the connected API.",
  authentication_failed: 'Lusha authentication failed. Check the connected API key.',
  permission_failed: 'Lusha refused this request for the connected API key.',
  quota_exhausted: 'Lusha quota exhausted — no credits remain on the connected plan.',
  rate_limited: 'Lusha rate limit reached. Try again shortly.',
  temporary_provider_failure: 'Lusha returned an unexpected error. Try again shortly.',
  contact_matched_mobile_returned: 'A UK mobile number was returned for this contact and passed format validation.',
  contact_matched_direct_dial_unverified: 'A direct line was returned, but it is not a mobile. It is stored as a direct dial, unverified, and needs review before use.',
  contact_matched_direct_dial_returned: 'A direct number was returned for this contact.',
  provider_not_called: 'Lusha was not called because this run used Free inference.',
  duplicate_lookup_prevented: 'This contact was already checked in this run. No duplicate request was made.',
  cooldown_prevented: 'Cadence is cooling down after a recent Lusha not-found result for this company, so no lookup was made.',
  existing_number_reused: 'Cadence reused an existing number. No provider lookup was required.',
};

const SENIOR_TITLES = [
  'Managing Director', 'CEO', 'Commercial Director', 'Development Director',
  'Sales Director', 'Procurement Director', 'Finance Director', 'Operations Director',
  'Director', 'Head of',
];

function splitName(full: string) {
  const parts = (full || '').trim().split(/\s+/);
  if (parts.length < 2) return { first: parts[0] || '', last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

// A company switchboard is not a person's number, and a geographic landline is
// not a mobile. Both decisions are made by the deterministic UK classifier.
export function hasDirectNumber(phone: string, landline: string): boolean {
  const uk = classifyUkPhone(phone);
  if (!uk.valid) return false;
  const board = phoneDigits(landline);
  return !board || uk.digits !== board;
}

// True only for a number the numbering plan classifies as a UK mobile.
export function hasMobileNumber(phone: string): boolean {
  return isUkMobile(phone);
}

// Writes a review item so provider-returned data that cannot be promoted is
// visible to a human instead of being silently dropped or silently applied.
async function raisePhoneReview(
  base44: any,
  org: any,
  opts: {
    reason: string;
    prospect_id: string;
    list_id: string;
    company_name: string;
    contact_name: string;
    existing_value: string;
    existing_source: string;
    new_value: string;
    new_source: string;
    phone_type: string;
    confidence: number;
    explanation: string;
  },
) {
  try {
    const existing = await base44.asServiceRole.entities.ReviewItem.filter({
      organisation_id: org.id,
      prospect_id: opts.prospect_id,
      reason: opts.reason,
      status: 'pending',
    }, '-created_date', 5).catch(() => []);
    // One open review per prospect and reason — repeated runs must not flood
    // the queue with the same question.
    if (existing && existing.length) return;
    await base44.asServiceRole.entities.ReviewItem.create({
      organisation_id: org.id,
      prospect_id: opts.prospect_id,
      campaign_id: opts.list_id || '',
      reason: opts.reason,
      status: 'pending',
      field_name: 'phone',
      existing_value: opts.existing_value || '',
      existing_source: opts.existing_source || '',
      new_value: opts.new_value || '',
      new_source: opts.new_source || '',
      new_retrieved_at: new Date().toISOString(),
      phone_type: opts.phone_type || '',
      phone_confidence: opts.confidence || 0,
      review_reason_text: `${opts.contact_name || opts.company_name}: ${opts.explanation}`,
      created_at: new Date().toISOString(),
    });
  } catch {
    // A review write must never break the enrichment run itself.
  }
}

// Reject placeholder strings that providers/AI return when no real data exists.
const PLACEHOLDER_RE = /^(not\s*(available|found|known|public)|n\/?a|unknown|null|none|na|—|-)$/i;
function sanitizeValue(val: any): string {
  if (!val) return '';
  const s = String(val).trim();
  if (!s || PLACEHOLDER_RE.test(s)) return '';
  return s;
}

// Drop AI/page-scrape junk before it burns Lusha credits or pollutes exports
// (e.g. "Silos Passivation After", "Case Studies Contact", "Sales Team").
const NON_PERSON_NAME_RE = /^(company reception|switchboard|contact details|customer service|sales team|general enquiries|reception|main office|case studies|contact us|about us|our team|leadership team)$/i;
const NON_PERSON_TOKEN_RE = /\b(passivation|case studies|whitepaper|brochure|download|newsletter|privacy|cookie|linkedin|follow us|silos after|solutions contact)\b/i;
const TITLE_ONLY_RE = /^(managing director|director|manager|engineer|consultant|ceo|cfo|cto|coo|president|vp|vice president|head of .+|chief .+ officer)$/i;
function isPlausiblePersonName(raw: any): boolean {
  const name = String(raw || '').trim();
  if (!name) return false;
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  if (parts.length > 5) return false;
  if (NON_PERSON_NAME_RE.test(name) || NON_PERSON_TOKEN_RE.test(name) || TITLE_ONLY_RE.test(name)) return false;
  if (/^contact details\b/i.test(name) || /\b(switchboard|reception)\b/i.test(name)) return false;
  // Require at least one token that looks like a personal name (letter-led, not all caps acronym soup).
  const nameLike = parts.filter((p) => /^[A-Za-z][A-Za-z'’\-]*$/.test(p) && p.length >= 2);
  return nameLike.length >= 2;
}

// Apollo people search — finds decision-makers by domain, returns contacts with emails/phones.
// Tries multiple search strategies: domain+titles → domain only → company name+titles → company name only.
// This ensures we find the company even when the title filter is too restrictive or
// Apollo has the company under a different domain than what we have stored.
async function apolloSearch(out: any, targetRoles: string[], key: string) {
  const contacts: any[] = [];
  let companyPhone = '';
  try {
    const titles = (targetRoles && targetRoles.length ? targetRoles : SENIOR_TITLES);
    // Build search strategies in priority order. Each entry is a body fragment.
    const strategies: any[] = [];
    if (out.domain) {
      strategies.push({ q_organization_domains_list: [out.domain], person_titles: titles });
      strategies.push({ q_organization_domains_list: [out.domain] }); // no title filter — broader
    }
    strategies.push({ q_organization_name: out.company_name, person_titles: titles });
    strategies.push({ q_organization_name: out.company_name }); // no title filter — broadest

    let httpStatus = 200;
    let errorCategory = 'none';
    let retryable = false;
    let providerError = '';

    for (const strategy of strategies) {
      const body: any = { per_page: 25, page: 1, ...strategy };
      const res = await fetch(`${APOLLO}/mixed_people/api_search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': key },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const diag = classifyHttpError(res.status);
        const errBody = await res.json().catch(() => ({}));
        const errMsg = errBody?.error || '';
        if (res.status === 403 && errMsg.includes('Free plan')) {
          return { contacts, companyPhone, http_status: 403, error_category: 'auth_error', retryable: false, provider_error: 'Apollo Free plan does not include API access. Upgrade at apollo.io/pricing.' };
        }
        httpStatus = res.status; errorCategory = diag.category; retryable = diag.retryable;
        continue; // try next strategy
      }
      const data = await res.json().catch(() => ({}));
      const people = data.people || [];
      // If this strategy found people, use them and stop trying.
      if (people.length) {
        // Extract location/country from Apollo org data to avoid needing AI research just for geography.
        const orgLoc = data.organizations?.[0];
        if (orgLoc) {
          if (!out.location && (orgLoc.city || orgLoc.state)) out.location = orgLoc.city ? `${orgLoc.city}${orgLoc.state ? ', ' + orgLoc.state : ''}` : orgLoc.state;
          if (!out.country_code && orgLoc.country_code) out.country_code = String(orgLoc.country_code).toUpperCase();
        }
        for (const p of people) {
          const name = p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || '';
          if (!name) continue;
          const rawEmail = p.email && p.email !== 'null' ? p.email : '';
          const email = rawEmail && !classifyEmail(rawEmail, out.domain).isGeneric ? rawEmail : '';
          const phone = (p.phone && p.phone !== 'null') || (p.sanitized_phone && p.sanitized_phone !== 'null')
            ? (p.phone || p.sanitized_phone || '') : '';
          contacts.push({
            name,
            title: p.title || p.headline || '',
            email,
            phone,
            linkedin: p.linkedin_url || '',
            apollo_id: p.id || '',
            apollo_has_email: p.has_email === true,
          });
        }
        const org = data.organizations?.[0];
        if (org) {
          companyPhone = org.primary_phone?.number || org.phone || '';
          if (!out.domain && org.primary_domain) out.domain = org.primary_domain.replace(/^www\./, '');
          if (!out.website && org.website_url) out.website = org.website_url;
          if (!out.industry && org.industry) out.industry = org.industry;
        }
        return { contacts, companyPhone, http_status: 200, error_category: 'none', retryable: false };
      }
      // 0 people — try next strategy.
    }
    return { contacts, companyPhone, http_status: httpStatus, error_category: errorCategory, retryable, provider_error: providerError };
  } catch {
    return { contacts, companyPhone, http_status: 0, error_category: 'network_error', retryable: true };
  }
}

// Apollo people match — enriches a specific named contact.
// Credits are only consumed when Apollo returns an email, but match calls on
// companies Apollo doesn't have are wasteful — caller must gate this.
async function apolloMatch(list: any[], out: any, key: string) {
  let enriched = 0;
  let matched = 0;
  let creditsUsed = 0;
  try {
    for (const c of list) {
      if (!c.name && !c.apollo_id) continue;
      // Skip only if we already have a personal email AND a phone.
      const hasPersonalEmail = c.email && classifyEmail(c.email, out.domain).isPersonal;
      if (hasPersonalEmail && c.phone) continue;
      const { first, last } = splitName(c.name || '');
      // Apollo search deliberately obfuscates surnames and returns no email.
      // Enrich by the stable Apollo person ID whenever it is available; using
      // the displayed/obfuscated name caused valid people to be skipped.
      if (!c.apollo_id && (!first || !last)) continue;
      const body: any = c.apollo_id
        ? { id: c.apollo_id, reveal_personal_emails: false }
        : { first_name: first, last_name: last, organization_name: out.company_name, reveal_personal_emails: false };
      if (out.domain && !c.apollo_id) body.domain = out.domain;
      const res = await fetch(`${APOLLO}/people/match`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': key },
        body: JSON.stringify(body),
      });
      if (!res.ok) continue;
      matched++;
      const p = await res.json().catch(() => ({}));
      if (!p?.person) continue;
      const person = p.person;
      const resolvedName = person.name || [person.first_name, person.last_name].filter(Boolean).join(' ');
      if (resolvedName && resolvedName.trim().split(/\s+/).length >= 2) c.name = resolvedName;
      // Replace empty or generic emails with a personal email when found.
      if (person.email && person.email !== 'null') {
        creditsUsed++;
        const ec = classifyEmail(person.email, out.domain);
        if (ec.isPersonal && (!c.email || classifyEmail(c.email, out.domain).isGeneric)) {
          c.email = person.email; enriched++;
        }
      }
      if (!c.phone && person.phone && person.phone !== 'null') c.phone = person.phone;
      else if (!c.phone && person.sanitized_phone && person.sanitized_phone !== 'null') c.phone = person.sanitized_phone;
      if (!c.linkedin && person.linkedin_url) c.linkedin = person.linkedin_url;
      if (!c.title && person.title) c.title = person.title;
    }
    return { http_status: 200, error_category: 'none', retryable: false, emails_found: enriched, matched, credits_used: creditsUsed };
  } catch {
    return { http_status: 0, error_category: 'network_error', retryable: true, emails_found: enriched, matched, credits_used: creditsUsed };
  }
}

// Lusha reveal — only the fields actually asked for. A mobile-only retry must
// not spend email credits, and a switchboard number is never written into a
// person's mobile field.
async function lushaEnrich(
  base44: any,
  org: any,
  list: any[],
  out: any,
  key: string,
  opts: { prospect_id: string; list_id: string; correlation_id: string; wantPhones: boolean; wantEmails: boolean },
) {
  const reveal: LushaReveal[] = [];
  if (opts.wantPhones) reveal.push('phones');
  if (opts.wantEmails) reveal.push('emails');

  const empty = {
    http_status: 0, error_category: 'none', retryable: false, message: '', credits: 0,
    phones_applied: 0, emails_applied: 0, direct_applied: 0, statuses: [] as LushaStatus[],
    attempted: false, phone_reviews: [] as any[],
  };
  if (!reveal.length) return empty;

  const response = await lushaSearchAndEnrich(key, {
    contacts: list.map((c: any) => ({
      name: c.name, title: c.title, linkedin: c.linkedin, email: c.email, lusha_id: c.lusha_id || c.apollo_id || '',
    })),
    company: { name: out.company_name, domain: out.email_domain || out.domain },
    reveal,
  });

  const now = new Date().toISOString();
  let phonesApplied = 0;
  let emailsApplied = 0;
  let directApplied = 0;
  const phoneReviews: any[] = [];

  for (const r of response.results) {
    const c = list[r.index];
    if (!c || !r.matched) continue;
    // Never attach a number from a different employer.
    if (r.status === 'company_mismatch') continue;

    if (opts.wantPhones) {
      const person = pickPersonNumber(r.phones);
      if (person) {
        const decision = evaluateProviderPhone({
          rawNumber: person.number,
          providerType: person.type,
          companyLandline: out?.landline,
          employment: r.employment_check,
          employerName: out?.company_name,
          returnedCompany: r.company_name,
        });
        const existingDigits = phoneDigits(c?.phone || c?.mobile);
        const alreadyPersonNumber = !!existingDigits && existingDigits !== phoneDigits(out?.landline);
        const stamp = {
          phone_type: decision.type,
          phone_status: decision.status,
          phone_source: 'lusha',
          phone_retrieved_at: now,
          phone_confidence: decision.confidence,
          phone_review_reason: decision.reviewReason || '',
          employment_check: r.employment_check,
        };
        if (decision.promote && !alreadyPersonNumber) {
          // Only a mobile for a confirmed current employer may become the
          // person's number. Nothing weaker is ever written to `phone`.
          c.phone = decision.uk.national;
          c.mobile = decision.uk.national;
          Object.assign(c, stamp, { phone_type: 'mobile' });
          phonesApplied++;
          out.field_provenance = {
            ...(out.field_provenance || {}),
            phone: {
              source_provider: 'lusha', confidence: decision.confidence, enriched_at: now,
              verified_at: null,
              provider_value: person.number || person.normalised || '',
              phone_type: 'mobile',
              normalised: decision.uk.e164, phone_status: decision.status,
              employment_check: r.employment_check, returned_company: r.company_name || '',
            },
          };
        } else if (alreadyPersonNumber && decision.promote && decision.uk.valid
          && phoneDigits(decision.uk.national) !== existingDigits) {
          // Imported / existing number stays primary. Lusha is kept beside it
          // for export and review — never an overwrite.
          c.lusha_mobile = decision.uk.national;
          c.lusha_phone_status = decision.status;
          c.lusha_phone_retrieved_at = now;
          // Also mirror onto the prospect root so exports always see it.
          if (!out.lusha_mobile) {
            out.lusha_mobile = decision.uk.national;
            out.lusha_phone_status = decision.status;
            out.lusha_phone_retrieved_at = now;
          }
          await upsertContactPhoneCandidate(base44, org, {
            list_id: opts.list_id,
            prospect_id: opts.prospect_id,
            person_name: c?.name || out.full_name || '',
            person_title: c?.title || '',
            value: decision.uk.national,
            phone_type: 'mobile',
            source: 'lusha',
            source_column: 'lusha_reveal',
          });
          // Keep import provenance on the primary number.
          if (!c.phone_source) c.phone_source = out.phone_source || 'import';
          phonesApplied++;
          phoneReviews.push({
            reason: 'phone_additional_provider_number',
            contact_name: c?.name || '',
            new_value: decision.uk.national,
            phone_type: 'mobile',
            confidence: decision.confidence,
            explanation: 'An existing number was kept. Lusha returned an additional mobile stored separately for export.',
            employment_check: r.employment_check,
            returned_company: r.company_name || '',
          });
        } else if (!alreadyPersonNumber && decision.uk.valid && !decision.isSwitchboard && r.employment_check !== 'mismatch') {
          // A landline, or a match we could not confirm, is preserved and
          // labelled — stored as a direct line, never as a mobile.
          c.direct_dial = c.direct_dial || decision.uk.national;
          Object.assign(c, stamp);
          directApplied++;
        } else if (decision.uk.valid && r.employment_check === 'mismatch') {
          directApplied += 0;
        }
        if (decision.review) {
          phoneReviews.push({
            reason: decision.status === 'employment_mismatch' ? 'phone_employment_mismatch'
              : decision.status === 'contact_match_requires_review' ? 'phone_match_unconfirmed'
                : 'phone_provider_returned',
            contact_name: c?.name || '',
            new_value: decision.uk.national || person.number,
            phone_type: decision.type,
            confidence: decision.confidence,
            explanation: decision.reviewReason,
            employment_check: r.employment_check,
            returned_company: r.company_name || '',
          });
        }
      }
      // A switchboard belongs to the company, never to the person.
      const board = pickSwitchboardNumber(r.phones);
      if (board && !out.landline) {
        out.landline = board.number;
        out.company_phone = board.number;
        out.field_provenance = {
          ...(out.field_provenance || {}),
          landline: {
            source_provider: 'lusha', confidence: 70, enriched_at: now, verified_at: null,
            provider_value: board.raw, phone_type: board.uk_type, normalised: board.normalised,
          },
        };
      }
    }

    if (opts.wantEmails) {
      const work = pickWorkEmail(r.emails);
      if (work && (!c.email || classifyEmail(c.email, out.domain).isGeneric)) {
        c.email = work.email;
        c.email_status = 'provider_returned';
        c.email_source = 'lusha';
        emailsApplied++;
        out.field_provenance = {
          ...(out.field_provenance || {}),
          email: {
            source_provider: 'lusha', confidence: work.confidence === 'A+' ? 90 : 80,
            enriched_at: now, verified_at: null, provider_value: work.email,
          },
        };
      }
    }

    if (!c.linkedin && r.linkedin) c.linkedin = r.linkedin;
    if (!c.title && r.job_title) c.title = r.job_title;
    if (r.lusha_id) c.lusha_id = r.lusha_id;
  }

  const fieldsReturned = [
    ...(phonesApplied ? ['mobile'] : []),
    ...(directApplied ? ['direct_dial'] : []),
    ...(emailsApplied ? ['personal_email'] : []),
  ];
  const statuses = response.results.map((r) => r.status);
  const anyMatched = response.results.some((r) => r.matched);
  // A "not found" is only ever a definitive answer from a successful call.
  // A crash, a timeout or a rejected request must never start a cooldown.
  const definitiveMiss = !anyMatched && response.ok && (response.http_status === 200);
  const appliedSomething = phonesApplied > 0 || directApplied > 0 || emailsApplied > 0;

  await recordAttempt(base44, org, {
    provider: 'lusha',
    enrichment_type: opts.wantPhones ? 'direct_phone' : 'email',
    status: appliedSomething ? 'successful' : definitiveMiss ? 'not_found' : response.ok ? 'skipped' : 'failed',
    prospect_id: opts.prospect_id,
    list_id: opts.list_id,
    correlation_id: opts.correlation_id,
    http_status: response.http_status || null,
    error_category: response.error_category || 'none',
    fields_returned: fieldsReturned,
    actual_cost: response.credits_charged,
    retry_eligible: response.retryable,
    retry_reason: response.message,
    cooldown_expires_at: definitiveMiss ? cooldownExpiry() : null,
  });

  return {
    http_status: response.http_status,
    error_category: response.error_category,
    retryable: response.retryable,
    message: response.message,
    credits: response.credits_charged,
    phones_applied: phonesApplied,
    emails_applied: emailsApplied,
    direct_applied: directApplied,
    phone_reviews: phoneReviews,
    statuses,
    attempted: true,
    definitive_miss: definitiveMiss,
  };
}

// FullEnrich bulk enrichment — PHONES ONLY.
// This Cadence org holds a limited FullEnrich balance. Never request emails,
// never people-search, never spend on contacts that already have a dialable number.
const FULLENRICH_MAX_PER_COMPANY = 3;
async function fullenrichEnrich(list: any[], out: any, key: string) {
  try {
    const data = list.map((c) => {
      const { first, last } = splitName(c.name);
      return {
        first_name: first,
        last_name: last,
        company_name: out.company_name,
        ...(out.domain ? { domain: out.domain } : {}),
        ...(c.linkedin ? { linkedin_url: c.linkedin } : {}),
        enrich_fields: ['contact.phones'],
      };
    });
    const start = await fetch(`${FULLENRICH}/contact/enrich/bulk`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Prospect ${out.company_name}`.slice(0, 80), data }),
    });
    if (!start.ok) return { http_status: start.status, error_category: 'auth_error', retryable: false, phones_applied: 0 };
    const eid = (await start.json().catch(() => ({}))).enrichment_id;
    if (!eid) return { http_status: 200, error_category: 'none', retryable: false, phones_applied: 0 };
    let result: any = null;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      const g = await fetch(`${FULLENRICH}/contact/enrich/bulk/${eid}`, { headers: { Authorization: `Bearer ${key}` } });
      if (!g.ok) continue;
      result = await g.json().catch(() => null);
      if (result && result.status === 'FINISHED') break;
    }
    if (!result || result.status !== 'FINISHED') {
      const g = await fetch(`${FULLENRICH}/contact/enrich/bulk/${eid}?forceResults=true`, { headers: { Authorization: `Bearer ${key}` } });
      if (g.ok) result = await g.json().catch(() => result);
    }
    let phonesApplied = 0;
    for (const row of (result?.data || [])) {
      const ci = row.contact_info || {};
      const phone = ci.most_probable_phone?.number || ci.phones?.[0]?.number || '';
      if (!phone) continue;
      const first = (row.input?.first_name || '').toLowerCase();
      const last = (row.input?.last_name || '').toLowerCase();
      const match = list.find((c) => {
        const { first: f, last: l } = splitName(c.name);
        return f.toLowerCase() === first && l.toLowerCase() === last;
      });
      if (match) {
        if (isUkMobile(phone)) {
          match.mobile = phone;
          match.phone = phone;
          phonesApplied += 1;
        } else if (!match.phone && !match.direct_dial) {
          match.direct_dial = phone;
          match.phone = phone;
          phonesApplied += 1;
        }
      }
    }
    return { http_status: 200, error_category: 'none', retryable: false, phones_applied: phonesApplied };
  } catch {
    return { http_status: 0, error_category: 'network_error', retryable: true, phones_applied: 0 };
  }
}

// AI/Google email fallback — targeted web search for publicly visible work emails.
// Also retries contacts that only have a generic inbox (info@, mail@) to find
// their personal/direct work email instead.
async function aiEmailFallback(base44: any, out: any, contacts: any[], brief: string): Promise<number> {
  try {
    const names = contacts.filter((c) => {
      if (!c.email) return true; // no email at all
      const ec = classifyEmail(c.email, out.domain);
      return ec.isGeneric; // only a generic inbox — try to find personal
    }).slice(0, 5).map((c) => `${c.name} (${c.title})`);
    if (!names.length) return 0;
    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a UK B2B prospecting researcher. Search Google and the company website for publicly visible DIRECT/PERSONAL work email addresses for these decision-makers at "${out.company_name}" (domain: ${out.domain || 'unknown'}, website: ${out.website || 'unknown'}):
${names.join('\n')}
Campaign brief for context:
${brief || '(not provided)'}

CRITICAL: You are looking for each person's DIRECT work email (e.g. maurice@lilyford.co.uk, grant.wilson@company.com), NOT generic company inboxes. If the only email you can find is a generic inbox (info@, mail@, sales@, enquiries@, contact@), do NOT include it — omit that person from the results.
Return JSON: { "emails": [{ "name": "Person Name", "email": "their.direct@company.com" }] }
Only include REAL, publicly visible personal emails found on the company website, LinkedIn, or other public sources. Never invent or guess email addresses. If you cannot find a personal email for someone, omit them from the array.`,
      add_context_from_internet: true, model: 'gemini_3_flash',
      response_json_schema: { type: 'object', properties: { emails: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' } } } } } },
    });
    for (const e of (res.emails || [])) {
      const match = contacts.find((c) => c.name.toLowerCase().includes((e.name || '').toLowerCase()) || (e.name || '').toLowerCase().includes(c.name.toLowerCase()));
      if (match && e.email) {
        // Replace empty or generic email with a personal one.
        const ec = classifyEmail(e.email, out.domain);
        if (ec.isPersonal && (!match.email || classifyEmail(match.email, out.domain).isGeneric)) {
          match.email = e.email;
        }
      }
    }
    return 1;
  } catch { return 1; }
}

// Ranks contacts by ICP relevance using the candidate scoring engine.
// Scoring factors: exact title match (+100), department (+60), seniority (+40),
// current company (+30), Apollo email indicator (+20), geography (+15),
// generic leadership (+5), irrelevant department (-50), former employee (-100),
// excluded role (disqualify).
function rankByIcp(
  contacts: any[],
  targetRoles: string[],
  preferredSeniority: string[],
  opts?: {
    excludedTitles?: string[];
    targetDepartments?: string[];
    permittedCountryCodes?: string[];
    companyName?: string;
  },
): any[] {
  const scored = rankCandidates(contacts, {
    targetTitles: targetRoles || [],
    targetDepartments: opts?.targetDepartments || [],
    preferredSeniority: preferredSeniority || [],
    excludedTitles: opts?.excludedTitles || [],
    permittedCountryCodes: opts?.permittedCountryCodes || [],
    companyName: opts?.companyName,
  });
  return scored.map((s) => ({
    ...s.contact,
    _rankScore: s.score,
    _rankExplanation: s.explanation,
  }));
}

// Determines which fields are missing on a prospect record.
export function getMissingFields(prospect: any, requestedFields: string[]): string[] {
  const missing: string[] = [];
  for (const field of requestedFields) {
    switch (field) {
      case 'personal_email':
        // Missing if no email, or only a generic email. A company's employee
        // email domain can legitimately differ from its website domain.
        if (!prospect.email) { missing.push(field); break; }
        const emailClass = classifyEmail(prospect.email, prospect.email_domain || prospect.domain);
        if (!emailClass.isPersonal) missing.push(field);
        break;
      case 'alternative_email':
        // Missing if fewer than 2 unique emails across contacts.
        const allEmails = [prospect.email, ...(prospect.contacts || []).map((c: any) => c.email)].filter(Boolean).map(normaliseEmail);
        if (new Set(allEmails).size < 2) missing.push(field);
        break;
      case 'mobile':
        // Only a real UK mobile satisfies this field — a landline, switchboard,
        // or empty phone must not stop further mobile lookups.
        {
          const candidate = prospect.mobile || prospect.phone || '';
          const board = prospect.landline || '';
          if (!isUkMobile(candidate) || (board && phoneDigits(candidate) === phoneDigits(board))) {
            missing.push(field);
          }
        }
        break;
      case 'direct_dial':
        if (!prospect.direct_dial && !prospect.phone) missing.push(field);
        break;
      case 'company_phone':
        if (!prospect.landline) missing.push(field);
        break;
      case 'decision_maker_role':
        if (!prospect.contacts?.length && !prospect.full_name) missing.push(field);
        break;
      case 'company_intelligence':
        if (!prospect.industry || !prospect.domain) missing.push(field);
        break;
    }
  }
  return missing;
}

// Field-level waterfall enrichment for a single prospect.
// `providerOrder` is the ordered list of enabled, connected provider IDs.
// `requestedFields` is the list of fields to look for.
// `existing` is the current prospect record.
// Returns { patch, fields_found, fields_missing, fields_cached, provider_used, conflicts }.
export async function enrichProspectWaterfall(
  base44: any,
  org: any,
  opts: {
    prospect: any;
    brief: string;
    icp?: string;
    permitted_countries: string[];
    requestedFields: string[];
    providerOrder: string[];
    credentials: { get: (name: string) => string };
    targetRoles: string[];
    preferredSeniority: string[];
    excludedTitles?: string[];
    targetDepartments?: string[];
    correlationId: string;
    prospect_id: string;
    list_id: string;
    onlyMissing: boolean;
    forceRefresh?: boolean;
    emailOnly?: boolean;
    singleBestContact?: boolean;
    widenMobileSearch?: boolean;
    skipAiResearch?: boolean;
    inferEmailPattern?: boolean;
    strictZeroCredit?: boolean;
    cooldownOverride?: boolean;
    // Revalidates the originating user's permission immediately before each
    // chargeable provider or Smart Action call.
    authoriseCall?: () => Promise<any>;
  }
): Promise<{
  patch: any;
  fields_found: string[];
  fields_missing: string[];
  fields_cached: string[];
  provider_used: string;
  conflicts: any[];
  smart_actions_used?: number;
}> {
  const { prospect, brief, icp, permitted_countries, requestedFields, providerOrder, credentials, targetRoles, preferredSeniority, correlationId, prospect_id, list_id, onlyMissing, forceRefresh } = opts;
  const excludedTitles = opts.excludedTitles || [];
  const targetDepartments = opts.targetDepartments || [];
  const emailOnly = opts.emailOnly === true;
  const skipAiResearch = opts.skipAiResearch === true || emailOnly;
  const inferEmailPattern = opts.inferEmailPattern === true;
  const strictZeroCredit = opts.strictZeroCredit === true;
  const cooldownOverride = opts.cooldownOverride === true;
  const singleBestContact = opts.singleBestContact === true;
  // Mobile widening: when the chosen people have no mobile, look further down
  // the list at this company for someone who does.
  const widenMobileSearch = opts.widenMobileSearch === true;
  // Unlimited-Lusha posture: check every named person we already hold (up to 8).
  const WIDEN_EXTRA = 8;
  // Only a number the numbering plan calls a mobile counts as a mobile.
  const hasDialableMobile = (c: any) => isUkMobile(c?.mobile || c?.phone);
  // A contact whose only number is the company switchboard has no person number
  // yet — that gap must still be offered to the phone providers.
  const hasPersonNumber = (c: any) => hasDirectNumber(c?.mobile || c?.direct_dial || c?.phone, out?.landline);
  // Phone and email probes are tracked separately. Marking an email-only Lusha
  // call as a phone probe previously blocked mobile widen for those people —
  // the Oxi-Tech pattern of "emails for many, mobile for one/none".
  const probedPhoneNames = new Set<string>();
  const probedEmailNames = new Set<string>();
  // Single-best is the only credit-saving mode; default runs reveal up to 8
  // people per company so emails and mobiles stay aligned.
  const maxContacts = singleBestContact ? 1 : 8;
  // Apollo person-match/reveal can consume credits. Permit at most one reveal
  // attempt per company in a run; once one confirmed email is returned, the
  // remaining named contacts use credit-free pattern inference.
  let apolloRevealAttempted = false;
  let smartActionsUsed = 0;

  // Authorisation is re-read immediately before EVERY chargeable provider or
  // Smart Action call — not once per prospect. A revoked user stops here, before
  // any credit is spent, and the error is flagged so the caller pauses the job.
  const beforeCharge = async () => {
    if (!opts.authoriseCall) return;
    try {
      await opts.authoriseCall();
    } catch (e: any) {
      // Only a deliberate access decision counts as a revocation; a throttled or
      // transient read failure is retried, not treated as withdrawn permission.
      if (e) e.authorisationRevoked = e.securityDenial === true;
      throw e;
    }
  };

  // Precise phone-lookup outcome, stored on the prospect's phone provenance so
  // the UI can always explain why a number was or was not returned.
  const phoneRequested = requestedFields.includes('mobile') || requestedFields.includes('direct_dial');
  let phoneLookupResult = '';
  let phoneLookupMessage = '';
  const setPhoneLookup = (result: string, message: string) => {
    phoneLookupResult = result;
    phoneLookupMessage = message;
  };

  // Runs that cannot call a provider still record a precise reason.
  const withPhoneProvenance = (target: any, reused: boolean) => {
    if (!phoneRequested) return target;
    const existing = target?.field_provenance || {};
    return {
      ...target,
      field_provenance: {
        ...existing,
        phone: {
          ...(existing.phone || {}),
          lookup_result: reused ? 'existing_number_reused' : 'provider_not_called',
          lookup_message: reused
            ? PHONE_RESULT_MESSAGES.existing_number_reused
            : PHONE_RESULT_MESSAGES.provider_not_called,
          lookup_at: now,
        },
      },
    };
  };

  // Converts a Lusha response into the precise result the user sees.
  const applyLushaPhoneResult = (lushaResult: any, target: any) => {
    if (lushaResult.phones_applied > 0) {
      setPhoneLookup('contact_matched_mobile_returned', PHONE_RESULT_MESSAGES.contact_matched_mobile_returned);
      return;
    }
    // A landline or an unconfirmed match is reported as exactly that — it is
    // never presented as a mobile.
    if (lushaResult.direct_applied > 0) {
      setPhoneLookup('contact_matched_direct_dial_unverified', PHONE_RESULT_MESSAGES.contact_matched_direct_dial_unverified);
      return;
    }
    const mapped = (lushaResult.statuses || [])
      .map((status: string) => LUSHA_STATUS_TO_RESULT[status])
      .filter(Boolean);
    const result = mapped[0] || 'temporary_provider_failure';
    setPhoneLookup(result, PHONE_RESULT_MESSAGES[result] || PHONE_RESULT_MESSAGES.temporary_provider_failure);
  };

  const now = new Date().toISOString();
  const apolloKey = (credentials.get('APOLLO_API_KEY') || '').trim();
  const lushaKey = (credentials.get('LUSHA_API_KEY') || '').trim();
  const fullKey = (credentials.get('FULLENRICH_API_KEY') || '').trim();

  // 1. Determine missing fields (cache check).
  const missing = getMissingFields(prospect, requestedFields);
  const cached = requestedFields.filter((f) => !missing.includes(f));

  if (missing.length === 0 && !forceRefresh) {
    return {
      patch: withPhoneProvenance({
        enrichment_status: 'complete',
        last_attempted_at: now,
        field_provenance: prospect.field_provenance || {},
      }, true),
      fields_found: requestedFields,
      fields_missing: [],
      fields_cached: cached,
      provider_used: 'cache',
      conflicts: [],
    };
  }

  // Declare the working record FIRST so org memory merge can populate it.
  let out: any = {
    company_name: prospect.company_name,
    domain: prospect.domain || '',
    email_domain: prospect.email_domain || '',
    website: prospect.website || '',
    industry: prospect.industry || '',
    employee_range: prospect.employee_range || '',
    location: prospect.location || '',
    country_code: prospect.country_code || '',
    geography_status: prospect.geography_status || 'unknown',
    geography_reason: prospect.geography_reason || '',
    landline: prospect.landline || '',
    contacts: (prospect.contacts || []).map((c: any) => ({ ...c })),
    target_role: prospect.target_role || '',
    fit_score: prospect.fit_score ?? 0,
    fit_reason: prospect.fit_reason || '',
    full_name: prospect.full_name || '',
    job_title: prospect.job_title || '',
    phone: prospect.phone || '',
    mobile: prospect.mobile || '',
    direct_dial: prospect.direct_dial || '',
    phone_source: prospect.phone_source || '',
    phone_status: prospect.phone_status || '',
    lusha_mobile: prospect.lusha_mobile || '',
    lusha_phone_status: prospect.lusha_phone_status || '',
    lusha_phone_retrieved_at: prospect.lusha_phone_retrieved_at || '',
    email: prospect.email || '',
    linkedin: prospect.linkedin || '',
    field_provenance: { ...(prospect.field_provenance || {}) },
  };
  let conflicts: any[] = [];
  let providerUsed = 'cache';

  const applyFreeEmailPattern = () => {
    if (!inferEmailPattern || !(out.email_domain || out.domain) || !out.contacts.length) return 0;
    if (out.full_name && out.email && !out.contacts.some((c: any) => c.name?.toLowerCase() === out.full_name.toLowerCase())) {
      out.contacts.push({ name: out.full_name, title: out.job_title || '', email: out.email, phone: out.phone || '', linkedin: out.linkedin || '' });
    }
    const patternDomain = out.email_domain || out.domain;
    let inferred: any;
    if (out.email_pattern && out.email_pattern_source) {
      const separator = ['firstname.lastname', 'lastname.firstname'].includes(out.email_pattern) ? '.' : '';
      const applied = applyPatternToContacts(out.contacts, patternDomain, {
        pattern: out.email_pattern,
        separator,
        sourceEmail: out.email_pattern_source,
        sourceName: 'manual pattern evidence',
      });
      inferred = {
        contacts: applied.updated,
        inferred_count: applied.inferredCount,
        pattern: out.email_pattern,
        source_email: out.email_pattern_source,
      };
    } else {
      inferred = inferCompanyEmailPattern(out.contacts, patternDomain);
    }
    out.contacts = inferred.contacts;
    if (inferred.inferred_count <= 0) return 0;

    out.email_pattern = inferred.pattern;
    out.email_pattern_source = inferred.source_email;
    out.inferred_email_count = (out.inferred_email_count || 0) + inferred.inferred_count;
    const ranked = rankByIcp(out.contacts, targetRoles, preferredSeniority, {
      excludedTitles,
      targetDepartments,
      permittedCountryCodes: permitted_countries || [],
      companyName: prospect.company_name,
    });
    const best = ranked.find((c: any) => c.email_source === 'pattern_inferred' && c.email);
    if (best && (!out.email || classifyEmail(out.email, out.domain).isGeneric)) {
      out.email = best.email;
      out.full_name = out.full_name || best.name;
      out.job_title = out.job_title || best.title;
      out.email_source = 'pattern_inferred';
      out.email_status = 'inferred';
      out.email_verified = false;
    }
    providerUsed = 'pattern_inference';
    return inferred.inferred_count;
  };

  // Apollo not-found cooldown: a prior definitive miss must not spend again
  // in another session for seven days. A manual confirmed email naturally
  // satisfies the field before this guard is relevant.
  if (apolloKey && providerOrder.includes('apollo') && !strictZeroCredit) {
    const previousMisses = await base44.asServiceRole.entities.EnrichmentAttempt.filter({
      organisation_id: org.id,
      prospect_id,
      provider: 'apollo',
      enrichment_type: 'email',
      status: 'not_found',
    }, '-created_date', 1).catch(() => []);
    const lastMiss = previousMisses?.[0];
    const lastMissAt = lastMiss?.attempted_at || lastMiss?.created_date;
    if (lastMissAt && Date.now() - new Date(lastMissAt).getTime() < 7 * 24 * 60 * 60 * 1000) {
      apolloRevealAttempted = true;
      out.provider_error = 'apollo_recent_not_found_cooldown';
    }
  }

  // 1b. Organisation enrichment memory — check existing Company, Contact and
  // Prospect records in the same org before calling any provider or AI.
  // This reuses valid data without consuming Smart Actions or provider credits.
  // Organisation memory is always loaded, including refresh runs. Refresh may
  // search for additional data, but must never discard reusable evidence or
  // spend again for a field that memory/pattern inference already satisfies.
  const orgCompanyMemory = await checkOrgEnrichmentMemory(base44, org, {
    company_name: prospect.company_name, domain: prospect.domain, website: prospect.website,
  });
  const orgProspectMemory = await checkProspectMemory(base44, org, {
    company_name: prospect.company_name, domain: prospect.domain, exclude_prospect_id: prospect_id,
  });

  // Merge intelligence from org memory (non-destructive — only fills empty fields).
  const allMemory = [orgCompanyMemory, orgProspectMemory];
  for (const mem of allMemory) {
    if (!mem.reused) continue;
    const intel = mem.intelligence;
    if (intel.domain && !out.domain) out.domain = intel.domain.replace(/^www\./, '');
    if (intel.website && !out.website) out.website = intel.website;
    if (intel.industry && !out.industry) out.industry = intel.industry;
    if (intel.employee_range && !out.employee_range) out.employee_range = intel.employee_range;
    if (intel.location && !out.location) out.location = intel.location;
    if (intel.landline && !out.landline) out.landline = intel.landline;
    // Merge contacts non-destructively.
    if (mem.contacts?.length) {
      const merged = mergeContacts(out.contacts, mem.contacts, out.domain);
      out.contacts = merged.merged;
      conflicts.push(...merged.conflicts);
    }
  }

  // Learn and apply a same-domain format before any chargeable reveal.
  applyFreeEmailPattern();

  // Re-check missing fields after org memory merge — may have filled everything.
  const missingAfterMemory = getMissingFields(out, requestedFields);
  if (missingAfterMemory.length === 0) {
    // All fields satisfied from org memory — no provider call needed.
    const result: any = {
      ...out,
      company_found: !!(out.domain || out.website),
      landline_found: !!out.landline,
      decision_makers_found: out.contacts.length > 0,
      work_email_found: out.contacts.some((c: any) => {
        const ec = classifyEmail(c.email, out.domain);
        return ec.isPersonal;
      }) || (out.email ? classifyEmail(out.email, out.domain).isPersonal : false),
      mobile_found: out.contacts.some((c: any) => isUkMobile(c.mobile || c.phone)),
      linkedin_found: out.contacts.some((c: any) => c.linkedin) || !!out.linkedin,
      provider_used: 'org_memory',
      provider_error: '',
      last_attempted_at: now,
    };
    result.enrichment_status = computeEnrichmentStatus(result);
    Object.assign(result, withPhoneProvenance(result, true));
    return {
      patch: result,
      fields_found: requestedFields,
      fields_missing: [],
      fields_cached: cached,
      provider_used: 'org_memory',
      conflicts,
    };
  }

  // Strict zero-credit is a backend security boundary, not a UI preference.
  // Once organisation memory and deterministic email-pattern inference have run,
  // return immediately. Nothing below this point (Apollo, Lusha, FullEnrich,
  // public-web fetches or Base44 AI) is permitted in this mode.
  if (strictZeroCredit) {
    const result: any = {
      ...out,
      company_found: !!(out.domain || out.website),
      landline_found: !!out.landline,
      decision_makers_found: out.contacts.length > 0,
      work_email_found: out.contacts.some((c: any) => classifyEmail(c.email, out.email_domain || out.domain).isPersonal) ||
        (out.email ? classifyEmail(out.email, out.email_domain || out.domain).isPersonal : false),
      mobile_found: out.contacts.some((c: any) => isUkMobile(c.mobile || c.phone)),
      linkedin_found: out.contacts.some((c: any) => c.linkedin) || !!out.linkedin,
      provider_used: providerUsed === 'pattern_inference' ? 'pattern_inference' : 'org_memory',
      provider_error: '',
      last_attempted_at: now,
      zero_credit_enforced: true,
    };
    result.enrichment_status = computeEnrichmentStatus(result);
    Object.assign(
      result,
      withPhoneProvenance(result, !!(out.phone && hasDirectNumber(out.phone, out.landline))),
    );
    const strictMissing = getMissingFields(result, requestedFields);
    return {
      patch: result,
      fields_found: requestedFields.filter((f) => !strictMissing.includes(f)),
      fields_missing: strictMissing,
      fields_cached: cached,
      provider_used: result.provider_used,
      conflicts,
    };
  }

  // Check what fields we need.
  const needsContacts = forceRefresh || missingAfterMemory.includes('personal_email') || missingAfterMemory.includes('mobile') || missingAfterMemory.includes('direct_dial') || missingAfterMemory.includes('decision_maker_role') || missingAfterMemory.includes('company_phone');

  // 2. Provider-first waterfall — run connected providers and direct web lookup
  // BEFORE the slow (20s) AI research. Apollo search returns domain, industry,
  // company phone, and contacts with emails/phones in a single fast call (2-5s).
  // Direct web lookup scrapes the company website for landline and contacts (2-5s).
  // If these find enough data, AI research is skipped entirely — cutting
  // enrichment from ~35s to ~5-10s for most companies.
  let apolloQuickSearchDone = false;
  // Track whether Apollo has this company in its database. If the search
  // returns 0 people, match calls on AI-found contacts are skipped — Apollo
  // doesn't have the company, so matching individuals wastes credits.
  let apolloHasCompanyData = false;

  // 2a. Quick Apollo search — finds domain, contacts, company phone.
  let apolloProviderError = '';
  // Lusha failures are reported in their own right — never folded into
  // "no information found".
  let lushaProviderError = '';
  let lushaStatuses: LushaStatus[] = [];
  // A conclusive Lusha "contact not matched" starts a cooldown so the same
  // definitive answer is not paid for again. A crash or a rejected request
  // never counts as a no-result.
  const lushaCooldownActive = !forceRefresh && !cooldownOverride && isWithinCooldown(prospect);
  if (apolloKey && providerOrder.includes('apollo') && needsContacts) {
    await beforeCharge();
    const quickSearch = await apolloSearch(out, targetRoles.length ? targetRoles : SENIOR_TITLES, apolloKey);
    if (quickSearch.provider_error) apolloProviderError = quickSearch.provider_error;
    if (quickSearch.companyPhone && !out.landline) out.landline = quickSearch.companyPhone;
    if (quickSearch.contacts.length) {
      apolloHasCompanyData = true;
      const merged = mergeContacts(out.contacts, quickSearch.contacts, out.domain);
      out.contacts = merged.merged;
      conflicts.push(...merged.conflicts);
      if (inferEmailPattern) {
        const inferred = inferCompanyEmailPattern(out.contacts, out.email_domain || out.domain);
        out.contacts = inferred.contacts;
        if (inferred.inferred_count > 0) {
          out.email_pattern = inferred.pattern;
          out.email_pattern_source = inferred.source_email;
          out.inferred_email_count = (out.inferred_email_count || 0) + inferred.inferred_count;
        }
      }
      // People search results are discovery, not one chargeable email reveal
      // per returned contact. Usage is recorded only by person-match below.
      providerUsed = 'apollo';
    }
    apolloQuickSearchDone = true;
    await recordAttempt(base44, org, {
      provider: 'apollo', enrichment_type: 'people_search',
      status: quickSearch.contacts.length ? 'successful' : 'not_found',
      prospect_id, list_id, correlation_id: correlationId,
      http_status: quickSearch.http_status || null,
      error_category: quickSearch.error_category || 'none',
      fields_returned: quickSearch.contacts.length ? ['decision_maker_role'] : [],
    });
    // Rank before choosing the single reveal candidate so the one paid lookup
    // is spent on the strongest ICP match, not whichever person Apollo returned first.
    out.contacts = rankByIcp(out.contacts, targetRoles, preferredSeniority, {
      excludedTitles,
      targetDepartments,
      permittedCountryCodes: permitted_countries,
      companyName: prospect.company_name,
    });

    // Reveal personal emails/phones for contacts found by the quick search.
    // Only match contacts that Apollo itself returned — matching AI-found
    // contacts when Apollo has no company data wastes credits.
    const quickNeedMatch = out.contacts.filter((c: any) => {
      if (!c.name && !c.apollo_id) return false;
      const emailMissing = !c.email || classifyEmail(c.email, out.domain).isGeneric;
      if (emailOnly) return emailMissing;
      if (emailMissing || !c.phone) return true;
      return false;
    }).slice(0, maxContacts);
    if (quickNeedMatch.length && !apolloRevealAttempted) {
      apolloRevealAttempted = true;
      const ctx = { company_name: out.company_name, domain: out.domain };
      await beforeCharge();
      const matchResult = await apolloMatch(quickNeedMatch.slice(0, 1), ctx, apolloKey);
      // Only record usage for credits actually consumed (emails returned).
      if (matchResult.credits_used) {
        await recordUsage(base44, org, {
          event_type: 'email_enrichment', provider: 'apollo', quantity: matchResult.credits_used,
          unit: 'contact', source_function: 'enrichProspectWaterfall',
          idempotency_key: `${correlationId}_apollo_quick_match`, related_record_id: prospect_id,
          metadata: { correlation_id: correlationId },
        });
      }
      applyFreeEmailPattern();
      await recordAttempt(base44, org, {
        provider: 'apollo', enrichment_type: 'email',
        status: matchResult.emails_found ? 'successful' : 'not_found',
        prospect_id, list_id, correlation_id: correlationId,
        fields_returned: matchResult.emails_found ? ['personal_email'] : [],
        retry_reason: `Matched ${matchResult.matched} contacts, found ${matchResult.emails_found} emails`,
      });
    }
  }

  // 2b. Direct web lookup — fast fallback for landline and contacts (2-5s).
  const needsDirectLookup = !strictZeroCredit && !emailOnly && (!out.landline || !out.contacts.length);
  if (needsDirectLookup) {
    const webResult = await directCompanyLookup(prospect.company_name, out.domain).catch(() => ({}));
    if (webResult.domain && !out.domain) { out.domain = webResult.domain; if (!out.website) out.website = webResult.website; }
    if (webResult.website && !out.website) out.website = webResult.website;
    if (webResult.landline && !out.landline) out.landline = webResult.landline;
    if (webResult.email && !out.email) out.email = webResult.email;
    if (webResult.alternative_phones?.length) {
      for (const altPhone of webResult.alternative_phones) {
        if (!altPhone || altPhone === out.landline) continue;
        const exists = out.contacts.find((c: any) => c.phone === altPhone);
        if (!exists) {
          out.contacts.push({ name: 'Company Reception', title: 'Switchboard', phone: altPhone, email: '', linkedin: '' });
        }
      }
    }
    if (webResult.contacts?.length) {
      out.contacts = mergeContacts(out.contacts, webResult.contacts, out.domain).merged;
      applyFreeEmailPattern();
    }
    if (webResult.website) providerUsed = providerUsed === 'cache' ? 'ai_web' : providerUsed;
  }

  // Re-check missing fields after providers + direct lookup.
  const missingAfterProviders = getMissingFields(out, requestedFields);

  // 3. AI web research — fallback only, when providers didn't find enough.
  // Wrapped in a timeout to prevent a single slow AI call from blocking the entire
  // enrichment session (which causes items to get stuck in 'processing').
  const needsAiFallback = !skipAiResearch && (forceRefresh ||
    missingAfterProviders.includes('company_intelligence') ||
    missingAfterProviders.includes('decision_maker_role') ||
    (missingAfterProviders.includes('company_phone') && !out.landline));
  if (needsAiFallback) {
    await beforeCharge();
    smartActionsUsed += 1;
    const aiPromise = base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a UK B2B prospecting researcher. A sales rep gave the company name "${prospect.company_name}" and this campaign brief:
"""
${brief || '(no brief provided)'}
"""

Ideal Customer Profile (ICP):
"""
${icp || '(not provided — infer target roles from the brief)'}
"""

CRITICAL: The ICP above defines which specific roles to target at this company. You MUST search for decision-makers who hold those specific roles (e.g. Commercial Director, Development Director, Sales Director, Procurement Director, etc.) — NOT just whoever appears first on the website. Search LinkedIn, the company "About/Team/Leadership" page, and Companies House directors specifically for people holding those ICP-defined roles.

Find the real company this refers to (very likely a UK company — use Google, the company website, and Companies House). Research it and return JSON:
- canonical_name, domain, website, industry, employee_range, location, country_code (ISO 3166-1 alpha-2)
- landline: CRITICAL — search the company website (Contact, About, Footer pages) AND Google Business for the main phone/switchboard number.
- target_roles: array of 2-5 specific job titles drawn from the ICP that this campaign should target here. If the ICP says "Commercial Director", include that — do NOT default to "Managing Director" unless the ICP asks for it.
- decision_makers: array of {name, title, email} for named people holding the ICP target roles. Search the company "About/Team/Leadership" page, LinkedIn, and Companies House directors. Prioritise people whose titles match the ICP roles. For email, ONLY include a direct/personal work email for that specific person (e.g. firstname@company.com, firstname.lastname@company.com). NEVER use a generic inbox like info@, mail@, sales@, enquiries@ as a person's email — if you cannot find their personal email, leave the email field empty.
- fit_score: integer 0-100, fit_reason: one short sentence
Be factual. Never invent a phone number or person's name. If you cannot find someone in the ICP target roles, return an empty decision_makers array rather than filling it with whoever else you found.`,
      add_context_from_internet: true, model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          canonical_name: { type: 'string' }, domain: { type: 'string' }, website: { type: 'string' },
          industry: { type: 'string' }, employee_range: { type: 'string' }, location: { type: 'string' },
          country_code: { type: 'string' }, landline: { type: 'string' },
          target_roles: { type: 'array', items: { type: 'string' } },
          decision_makers: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, title: { type: 'string' }, email: { type: 'string' } } } },
          fit_score: { type: 'number' }, fit_reason: { type: 'string' },
        },
      },
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI research timed out')), 30000)
    );
    const ai: any = await Promise.race([aiPromise, timeoutPromise]).catch(() => ({}));

    await recordUsage(base44, org, {
      event_type: 'research_request', provider: 'ai_web', quantity: 1, unit: 'request',
      source_function: 'enrichProspectWaterfall', idempotency_key: `${correlationId}_ai`,
      related_record_id: prospect_id, metadata: { company_name: prospect.company_name, correlation_id: correlationId },
    });

    // Non-destructive merge — only fill empty fields (sanitized).
    const aiLandline = sanitizeValue(ai.landline);
    if (ai.canonical_name && !out.company_name) out.company_name = ai.canonical_name;
    if (ai.domain && !out.domain) out.domain = sanitizeValue(ai.domain).replace(/^www\./, '');
    if (ai.website && !out.website) out.website = sanitizeValue(ai.website);
    if (ai.industry && !out.industry) out.industry = sanitizeValue(ai.industry);
    if (ai.employee_range && !out.employee_range) out.employee_range = sanitizeValue(ai.employee_range);
    if (ai.location && !out.location) out.location = sanitizeValue(ai.location);
    if (ai.country_code) { out.country_code = sanitizeValue(ai.country_code).toUpperCase(); }
    if (aiLandline && !out.landline) out.landline = aiLandline;
    if (ai.target_roles?.[0] && !out.target_role) out.target_role = sanitizeValue(ai.target_roles[0]);
    if (ai.fit_score != null && !out.fit_score) out.fit_score = ai.fit_score;
    if (ai.fit_reason && !out.fit_reason) out.fit_reason = sanitizeValue(ai.fit_reason);

    // Merge decision-makers non-destructively (sanitized).
    // Only accept contacts with a full name (first + last) — single-name
    // entries like "Mikhail" are likely AI hallucinations that repeat across
    // unrelated companies. Require at least 2 words in the name.
    for (const dm of (ai.decision_makers || [])) {
      const dmName = sanitizeValue(dm.name);
      const dmEmail = sanitizeValue(dm.email);
      if (!isPlausiblePersonName(dmName)) continue;
      const exists = out.contacts.find((c: any) => c.name.toLowerCase() === dmName.toLowerCase());
      if (!exists) {
        out.contacts.push({ name: dmName, title: sanitizeValue(dm.title) || '', phone: '', email: dmEmail, linkedin: '' });
      } else {
        if (!exists.email && dmEmail) {
          const ec = classifyEmail(dmEmail, out.domain);
          if (ec.isValid) exists.email = dmEmail;
        }
        if (!exists.title && dm.title) exists.title = sanitizeValue(dm.title);
      }
    }
    providerUsed = 'ai_web';
  }

  // Geography check.
  if (out.country_code) {
    const geo = checkGeography(out.country_code, permitted_countries);
    out.geography_status = geo.status;
    out.geography_reason = geo.reason;
    if (geo.status === 'out_of_scope') {
      out.enrichment_status = 'out_of_scope';
      return {
        patch: { ...out, enrichment_status: 'out_of_scope', last_attempted_at: now },
        fields_found: ['company_intelligence'],
        fields_missing: missingAfterMemory,
        fields_cached: cached,
        provider_used: providerUsed,
        conflicts,
        smart_actions_used: smartActionsUsed,
      };
    }
  }

  // 3. Provider waterfall for contacts (emails, phones, decision-makers).
  // Entry condition: we need contacts AND we have something to search with —
  // existing contacts to enrich, a domain to search, or at minimum a company
  // name (Apollo supports q_organization_name search). This ensures providers
  // still run even when AI research timed out or returned nothing, which was
  // causing companies to be skipped entirely with no provider search at all.
  if (needsContacts && (out.contacts.length > 0 || out.domain || out.company_name)) {
    // Rank contacts by ICP relevance.
    out.contacts = rankByIcp(out.contacts, targetRoles, preferredSeniority, {
      excludedTitles,
      targetDepartments,
      permittedCountryCodes: permitted_countries,
      companyName: prospect.company_name,
    });

    for (const provider of providerOrder) {
      const stillMissing = getMissingFields(out, requestedFields);
      if (!forceRefresh && !stillMissing.some((f) => ['personal_email', 'mobile', 'direct_dial', 'alternative_email'].includes(f))) break;

      if (provider === 'apollo' && apolloKey) {
        // If we have named contacts but they lack emails/phones, use match.
        // Apollo's match endpoint can find individuals even when the search
        // endpoint returns 0 people — match works by person name + company,
        // not by company domain search. Credits are only consumed when an
        // email is successfully returned.
        const contactsNeedingData = out.contacts.filter((c: any) => {
          if (!c.name && !c.apollo_id) return false;
          const emailMissing = !c.email || classifyEmail(c.email, out.domain).isGeneric;
          if (emailOnly) return emailMissing;
          if (emailMissing || !c.phone) return true;
          return false;
        }).slice(0, maxContacts);
        if (contactsNeedingData.length && !apolloRevealAttempted) {
          apolloRevealAttempted = true;
          const ctx = { company_name: out.company_name, domain: out.domain };
          await beforeCharge();
          const matchResult = await apolloMatch(contactsNeedingData.slice(0, 1), ctx, apolloKey);
          // Only record usage for credits actually consumed (emails returned).
          if (matchResult.credits_used) {
            await recordUsage(base44, org, {
              event_type: 'email_enrichment', provider: 'apollo', quantity: matchResult.credits_used,
              unit: 'contact', source_function: 'enrichProspectWaterfall',
              idempotency_key: `${correlationId}_apollo_match`, related_record_id: prospect_id,
              metadata: { correlation_id: correlationId },
            });
          }
          applyFreeEmailPattern();
          providerUsed = 'apollo';
        }
        // If we need more contacts or personal emails, do a search.
        const needsMoreContacts = forceRefresh || (stillMissing.includes('decision_maker_role') && out.contacts.length < 2);
        const needsEmailsFromSearch = forceRefresh || (stillMissing.includes('personal_email') &&
          !out.contacts.some((c: any) => c.email && classifyEmail(c.email, out.domain).isPersonal));
        const needsLandlineFromSearch = forceRefresh || (stillMissing.includes('company_phone') && !out.landline);
        if ((needsMoreContacts || needsEmailsFromSearch || needsLandlineFromSearch) && !apolloQuickSearchDone) {
          await beforeCharge();
          const result = await apolloSearch(out, targetRoles.length ? targetRoles : SENIOR_TITLES, apolloKey);
          if (result.companyPhone && !out.landline) out.landline = result.companyPhone;
          const merged = mergeContacts(out.contacts, result.contacts, out.domain);
          out.contacts = merged.merged;
          conflicts.push(...merged.conflicts);
          if (result.contacts.length) {
            apolloHasCompanyData = true;
            // Search discovery is not recorded as one paid reveal per contact.
            providerUsed = 'apollo';
          }
          // After search, match any new contacts that still lack personal emails.
          const newContactsNeedingMatch = out.contacts.filter((c: any) => {
            if (!c.name) return false;
            if (!c.email) return true;
            return classifyEmail(c.email, out.domain).isGeneric;
          }).slice(0, maxContacts);
          if (newContactsNeedingMatch.length && !apolloRevealAttempted) {
            apolloRevealAttempted = true;
            const ctx = { company_name: out.company_name, domain: out.domain };
            await beforeCharge();
            const matchResult = await apolloMatch(newContactsNeedingMatch.slice(0, 1), ctx, apolloKey);
            if (matchResult.credits_used) {
              await recordUsage(base44, org, {
                event_type: 'email_enrichment', provider: 'apollo', quantity: matchResult.credits_used,
                unit: 'contact', source_function: 'enrichProspectWaterfall',
                idempotency_key: `${correlationId}_apollo_match_2`, related_record_id: prospect_id,
                metadata: { correlation_id: correlationId },
              });
            }
            applyFreeEmailPattern();
          }
        }
      }

      if (provider === 'lusha' && lushaKey && !emailOnly) {
        // Contact-level phone gaps matter even after the company already has
        // one mobile — otherwise siblings with emails never get a phone ask.
        // forceRefresh (per-row / selected re-enrich) also seeks an *extra*
        // Lusha mobile beside an existing import number — never an overwrite.
        const mobileRequested = requestedFields.includes('mobile') || requestedFields.includes('direct_dial');
        const contactsMissingMobile = out.contacts.some((c: any) => isPlausiblePersonName(c?.name) && !hasDialableMobile(c));
        // Re-enrich (forceRefresh) asks Lusha even when an import mobile exists,
        // so a second candidate can sit beside the first — never overwrite.
        const seekAdditiveMobiles = !!forceRefresh;
        const needsAdditiveMobile = (c: any) =>
          seekAdditiveMobiles
          && hasDialableMobile(c)
          && !String(c?.lusha_mobile || '').trim();
        const wantPhones = mobileRequested && (
          forceRefresh
          || stillMissing.some((f) => f === 'mobile' || f === 'direct_dial')
          || contactsMissingMobile
        );
        const wantEmails = forceRefresh || stillMissing.includes('personal_email')
          || out.contacts.some((c: any) => isPlausiblePersonName(c?.name) && (!c.email || classifyEmail(c.email, out.domain).isGeneric));
        const need = out.contacts.filter((c: any) => {
          if (!isPlausiblePersonName(c?.name)) return false;
          // Prefer UK mobile when mobile was requested — a landline must not
          // silence further mobile reveals for that person.
          if (wantPhones && mobileRequested && !hasDialableMobile(c)) return true;
          if (wantPhones && mobileRequested && needsAdditiveMobile(c)) return true;
          if (wantPhones && !mobileRequested && !hasPersonNumber(c)) return true;
          if (wantEmails && (!c.email || classifyEmail(c.email, out.domain).isGeneric)) return true;
          return false;
        }).slice(0, maxContacts);
        // Never ask Lusha for the same person+field twice in one run.
        const unprobed = need.filter((c: any) => {
          const key = String(c.name || '').toLowerCase();
          const needsPhone = wantPhones && (!hasDialableMobile(c) || needsAdditiveMobile(c));
          const needsEmail = wantEmails && (!c.email || classifyEmail(c.email, out.domain).isGeneric);
          if (needsPhone && !probedPhoneNames.has(key)) return true;
          if (needsEmail && !probedEmailNames.has(key)) return true;
          return false;
        });
        if (need.length && !unprobed.length) {
          if (wantPhones) setPhoneLookup('duplicate_lookup_prevented', PHONE_RESULT_MESSAGES.duplicate_lookup_prevented);
        } else if (unprobed.length && (wantPhones || wantEmails)) {
          if (lushaCooldownActive) {
            const expiry = prospect.retry_cooldown_expires_at
              ? new Date(prospect.retry_cooldown_expires_at).toLocaleDateString('en-GB') : 'in 7 days';
            const lastTry = prospect.last_attempted_at
              ? new Date(prospect.last_attempted_at).toLocaleDateString('en-GB') : 'a previous run';
            lushaProviderError = `Lusha phone lookup skipped: a lookup on ${lastTry} returned no match for this contact. Cooldown ends ${expiry}. An administrator can override it for one run.`;
            if (wantPhones) {
              setPhoneLookup('cooldown_prevented', lushaProviderError);
              out.phone_cooldown = {
                provider: 'lusha',
                field: wantEmails ? 'phone and email' : 'phone',
                previous_outcome: 'contact_not_matched',
                expires_at: prospect.retry_cooldown_expires_at || '',
                override_allowed: true,
              };
            }
          } else {
            const askPhones = wantPhones && unprobed.some((c: any) => {
              const key = String(c.name || '').toLowerCase();
              if (probedPhoneNames.has(key)) return false;
              return !hasDialableMobile(c) || needsAdditiveMobile(c);
            });
            const askEmails = wantEmails && unprobed.some((c: any) => {
              const key = String(c.name || '').toLowerCase();
              return (!c.email || classifyEmail(c.email, out.domain).isGeneric) && !probedEmailNames.has(key);
            });
            unprobed.forEach((c: any) => {
              const key = String(c.name || '').toLowerCase();
              if (askPhones && (!hasDialableMobile(c) || needsAdditiveMobile(c))) probedPhoneNames.add(key);
              if (askEmails && (!c.email || classifyEmail(c.email, out.domain).isGeneric)) probedEmailNames.add(key);
            });
            await beforeCharge();
            const lushaResult = await lushaEnrich(base44, org, unprobed, out, lushaKey, {
              prospect_id, list_id, correlation_id: correlationId, wantPhones: askPhones, wantEmails: askEmails,
            });
            lushaStatuses = lushaResult.statuses;
            if (askPhones) applyLushaPhoneResult(lushaResult, out);
            if (lushaResult.message && (!lushaResult.phones_applied && !lushaResult.emails_applied)) {
              lushaProviderError = lushaResult.message;
            }
            if (lushaResult.definitive_miss) {
              out.retry_cooldown_expires_at = cooldownExpiry();
            }
            // Usage is recorded only for credits Lusha actually charged.
            if (lushaResult.credits > 0) {
              await recordUsage(base44, org, {
                event_type: 'phone_enrichment', provider: 'lusha', quantity: lushaResult.credits,
                unit: 'credit', source_function: 'enrichProspectWaterfall',
                idempotency_key: `${correlationId}_lusha`, related_record_id: prospect_id,
                metadata: { correlation_id: correlationId, http_status: lushaResult.http_status },
              });
            }
            if (lushaResult.phones_applied || lushaResult.direct_applied || lushaResult.emails_applied) providerUsed = 'lusha';
            for (const review of (lushaResult.phone_reviews || [])) {
              await raisePhoneReview(base44, org, {
                ...review,
                prospect_id,
                list_id,
                company_name: out.company_name,
                existing_value: out.phone || out.landline || '',
                existing_source: out.phone_source || '',
                new_source: 'lusha',
              });
            }
          }
        }
      }

      if (provider === 'fullenrich' && fullKey && !emailOnly) {
        // Limited FullEnrich: only named people still missing a phone, and only
        // when this run asked for a mobile/direct. Never emails. Cap spend hard.
        const phoneRequested = requestedFields.includes('mobile') || requestedFields.includes('direct_dial');
        if (phoneRequested) {
          const need = out.contacts
            .filter((c: any) => {
              if (!isPlausiblePersonName(c?.name)) return false;
              if (hasDialableMobile(c) || hasPersonNumber(c)) return false;
              if (probedPhoneNames.has(String(c.name || '').toLowerCase())) return false;
              return true;
            })
            .sort((a: any, b: any) => {
              const aEmail = a.email && classifyEmail(a.email, out.domain).isPersonal ? 1 : 0;
              const bEmail = b.email && classifyEmail(b.email, out.domain).isPersonal ? 1 : 0;
              return bEmail - aEmail;
            })
            .slice(0, FULLENRICH_MAX_PER_COMPANY);
          if (need.length) {
            const ctx = { company_name: out.company_name, domain: out.domain };
            need.forEach((c: any) => probedPhoneNames.add(String(c.name || '').toLowerCase()));
            await beforeCharge();
            const fe = await fullenrichEnrich(need, ctx, fullKey);
            await recordUsage(base44, org, {
              event_type: 'phone_enrichment', provider: 'fullenrich', quantity: need.length,
              unit: 'contact', source_function: 'enrichProspectWaterfall',
              idempotency_key: `${correlationId}_fullenrich`, related_record_id: prospect_id,
              metadata: {
                correlation_id: correlationId,
                purpose: 'phone_only_missing_contacts',
                phones_applied: fe?.phones_applied || 0,
              },
            });
            if (fe?.phones_applied) {
              providerUsed = 'fullenrich';
              if (!out.phone) {
                const withPhone = need.find((c: any) => c.mobile || c.phone);
                if (withPhone) {
                  out.phone = withPhone.mobile || withPhone.phone;
                  out.phone_source = 'fullenrich';
                }
              }
            }
          }
        }
      }
    }
  }

  // 3b. Mobile widening — when the run asks to check other known people, keep
  // revealing mobiles for named contacts who still lack one. Do NOT stop after
  // the first success: emails often cover several people while only the lead
  // previously received a number.
  if (widenMobileSearch && !emailOnly && out.contacts.length) {
    const phoneWanted = requestedFields.some((f) => f === 'mobile' || f === 'direct_dial');
    if (phoneWanted) {
      const others = out.contacts
        .filter((c: any) => {
          const name = String(c.name || '').trim();
          if (!isPlausiblePersonName(name)) return false;
          if (probedPhoneNames.has(name.toLowerCase())) return false;
          return !hasDialableMobile(c);
        })
        // People who already have a personal email are the highest-yield
        // mobile reveals — Lusha can match them more reliably.
        .sort((a: any, b: any) => {
          const aEmail = a.email && classifyEmail(a.email, out.domain).isPersonal ? 1 : 0;
          const bEmail = b.email && classifyEmail(b.email, out.domain).isPersonal ? 1 : 0;
          return bEmail - aEmail;
        })
        .slice(0, WIDEN_EXTRA);
      if (others.length) {
        for (const provider of providerOrder) {
          const need = others.filter((c: any) => !hasDialableMobile(c) && !probedPhoneNames.has(String(c.name || '').toLowerCase()));
          if (!need.length) break;
          const ctx = { company_name: out.company_name, domain: out.domain };
          if (provider === 'lusha' && lushaKey && !lushaCooldownActive) {
            await beforeCharge();
            need.forEach((c: any) => probedPhoneNames.add(String(c.name || '').toLowerCase()));
            const lushaResult = await lushaEnrich(base44, org, need, out, lushaKey, {
              prospect_id, list_id, correlation_id: correlationId, wantPhones: true, wantEmails: false,
            });
            lushaStatuses = lushaStatuses.concat(lushaResult.statuses);
            if (lushaResult.phones_applied) applyLushaPhoneResult(lushaResult, out);
            if (lushaResult.message && !lushaResult.phones_applied) lushaProviderError = lushaResult.message;
            // A widen miss must not cool down the whole company when another
            // person already has a usable mobile — that blocked re-tries.
            if (lushaResult.definitive_miss && !out.contacts.some(hasDialableMobile)) {
              out.retry_cooldown_expires_at = cooldownExpiry();
            }
            if (lushaResult.credits > 0) {
              await recordUsage(base44, org, {
                event_type: 'phone_enrichment', provider: 'lusha', quantity: lushaResult.credits,
                unit: 'credit', source_function: 'enrichProspectWaterfall',
                idempotency_key: `${correlationId}_lusha_widen`, related_record_id: prospect_id,
                metadata: { correlation_id: correlationId, purpose: 'mobile_widen_all_known' },
              });
            }
            if (lushaResult.phones_applied) providerUsed = 'lusha';
            for (const review of (lushaResult.phone_reviews || [])) {
              await raisePhoneReview(base44, org, {
                ...review,
                prospect_id,
                list_id,
                company_name: out.company_name,
                existing_value: out.phone || out.landline || '',
                existing_source: out.phone_source || '',
                new_source: 'lusha',
              });
            }
          }
          if (provider === 'fullenrich' && fullKey) {
            // After Lusha: only the remaining phoneless contacts, hard-capped.
            const feNeed = need
              .filter((c: any) => !hasDialableMobile(c) && !hasPersonNumber(c))
              .slice(0, FULLENRICH_MAX_PER_COMPANY);
            if (feNeed.length) {
              await beforeCharge();
              feNeed.forEach((c: any) => probedPhoneNames.add(String(c.name || '').toLowerCase()));
              const fe = await fullenrichEnrich(feNeed, ctx, fullKey);
              await recordUsage(base44, org, {
                event_type: 'phone_enrichment', provider: 'fullenrich', quantity: feNeed.length,
                unit: 'contact', source_function: 'enrichProspectWaterfall',
                idempotency_key: `${correlationId}_fullenrich_widen`, related_record_id: prospect_id,
                metadata: {
                  correlation_id: correlationId,
                  purpose: 'phone_only_missing_after_lusha',
                  phones_applied: fe?.phones_applied || 0,
                },
              });
              if (fe?.phones_applied) providerUsed = 'fullenrich';
            }
          }
        }
      }
    }
  }

  // 4. Google email fallback — if personal email is still missing.
  // Skip if Apollo match already tried and found no emails — the AI web search
  // is unlikely to find something Apollo's B2B database couldn't, and each
  // InvokeLLM call costs integration credits regardless of the result.
  const emailStillMissing = forceRefresh || getMissingFields(out, requestedFields).includes('personal_email');
  const apolloMatchFailed = apolloQuickSearchDone && apolloHasCompanyData &&
    !out.contacts.some((c: any) => c.email && classifyEmail(c.email, out.domain).isPersonal);
  const needsEmailSearch = !skipAiResearch && emailStillMissing && !apolloMatchFailed && out.contacts.some((c: any) =>
    !c.email || classifyEmail(c.email, out.domain).isGeneric
  );
  if (needsEmailSearch) {
    await beforeCharge();
    const emailSearchActions: any = await Promise.race([
      aiEmailFallback(base44, out, out.contacts, brief),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Email fallback timed out')), 8000)),
    ]).catch(() => 1);
    smartActionsUsed += Number(emailSearchActions || 0);
    applyFreeEmailPattern();
    providerUsed = providerUsed === 'cache' ? 'ai_web' : providerUsed;
  }

  // 4b. Last-resort people search — if we still have no contacts after all
  // providers, AI research, and email fallback, run a focused, shorter AI
  // call that just searches for named decision-makers. This catches cases
  // where the main AI research timed out or returned no decision_makers.
  if (!skipAiResearch && out.contacts.length === 0) {
    await beforeCharge();
    try {
      smartActionsUsed += 1;
      const peopleRes: any = await Promise.race([
        base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Search public web results, the company website and publicly indexed LinkedIn pages for decision-makers at "${prospect.company_name}" (domain: ${out.domain || 'unknown'}, website: ${out.website || 'unknown'}).

The campaign's target roles are: ${(targetRoles || []).join(', ') || 'commercial, procurement, buying and quantity surveying leaders'}.
Find 1-5 named CURRENT employees whose job titles most closely match those roles. Prioritise Commercial Directors, Procurement Directors/Heads, Buyers/Buying Directors, Quantity Surveyors/Commercial Managers and Development Directors when present. Do not default to the Managing Director merely because that person is easier to find.

Return JSON: { "people": [{ "name": "Full Name", "title": "Job Title" }] }
Only include REAL people with their full name (first and last). Never invent names. If you can't find anyone, return an empty array.`,
          add_context_from_internet: true, model: 'gemini_3_flash',
          response_json_schema: {
            type: 'object',
            properties: {
              people: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, title: { type: 'string' } } } },
            },
          },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('People search timed out')), 25000)),
      ]).catch(() => ({}));

      for (const person of (peopleRes.people || [])) {
        const pName = sanitizeValue(person.name);
        if (!isPlausiblePersonName(pName)) continue;
        out.contacts.push({ name: pName, title: sanitizeValue(person.title) || '', phone: '', email: '', linkedin: '' });
      }
      if (out.contacts.length) {
        applyFreeEmailPattern();
        providerUsed = providerUsed === 'cache' ? 'ai_web' : providerUsed;
      }
    } catch {}
  }

  // 5. Select best contact and apply email quality classification.
  // Final validation: filter out contacts with single-name entries (less than
  // 2 words) — these are low-quality data that repeat across unrelated companies
  // (likely AI hallucinations or partial scrapes). Also drop entries with no
  // name at all.
  out.contacts = out.contacts.filter((c: any) => {
    const title = String(c.title || '').trim();
    if (!isPlausiblePersonName(c?.name)) return false;
    if (NON_PERSON_NAME_RE.test(title) || /\b(switchboard|reception)\b/i.test(title)) return false;
    return true;
  });
  out.contacts = rankByIcp(out.contacts, targetRoles, preferredSeniority, {
    excludedTitles,
    targetDepartments,
    permittedCountryCodes: permitted_countries,
    companyName: prospect.company_name,
  });
  // "Company Reception" entries are alternative switchboard numbers, not real
  // decision-makers — exclude them from the primary contact selection so they
  // don't override full_name / job_title when no named contact is found.
  const isReception = (c: any) => c.name === 'Company Reception';
  let best = out.contacts.find((c: any) => !isReception(c) && c.email && classifyEmail(c.email, out.domain).isPersonal)
    || out.contacts.find((c: any) => !isReception(c) && c.phone)
    || out.contacts.find((c: any) => !isReception(c) && c.email)
    || out.contacts.find((c: any) => !isReception(c))
    || out.contacts[0];

  // Widened mobile: lead with the person who actually has a mobile, unless
  // doing so would drop a personal work email the chosen contact already had.
  if (widenMobileSearch && best) {
    const mobileHolder = out.contacts.find((c: any) => !isReception(c) && hasDialableMobile(c));
    if (mobileHolder && mobileHolder !== best && !hasDialableMobile(best)) {
      const bestPersonal = best.email && classifyEmail(best.email, out.domain).isPersonal;
      const holderPersonal = mobileHolder.email && classifyEmail(mobileHolder.email, out.domain).isPersonal;
      if (!bestPersonal || holderPersonal) best = mobileHolder;
    }
  }

  // Single-best-contact mode decides WHO is primary on the account (and caps how
  // many people the providers are asked to reveal) — it never discards people
  // we already hold. Everyone found stays on the record, best match first.
  if (singleBestContact && best) {
    out.contacts = [best, ...out.contacts.filter((c: any) => c !== best)];
  }

  let genericEmail = '';
  if (best) {
    if (!out.full_name || onlyMissing) out.full_name = best.name || out.full_name;
    if (!out.job_title || onlyMissing) out.job_title = best.title || out.job_title;

    // Email quality classification.
    if (best.email) {
      const emailClass = classifyEmail(best.email, out.domain);
      if (emailClass.isPersonal) {
        // Only replace if existing email is empty or generic.
        const decision = shouldReplaceField(out.email, best.email, {
          field: 'email', existingConfidence: CONFIDENCE.EXISTING,
          newConfidence: best.email_status === 'inferred' ? CONFIDENCE.PATTERN : CONFIDENCE.PROVIDER,
          companyDomain: out.domain, onlyMissing,
        });
        if (decision.action === 'replace') out.email = best.email;
        else if (decision.action === 'review') conflicts.push({ field: 'email', existing_value: out.email, new_value: best.email, provider: providerUsed });
      } else if (emailClass.isGeneric) {
        // Store as generic email, don't replace personal email.
        genericEmail = best.email;
        if (!out.email) out.email = best.email; // only set if no email at all
      }
    }

    if (!out.linkedin || onlyMissing) out.linkedin = best.linkedin || out.linkedin;
    // Phone: don't replace mobile with switchboard.
    if (best.phone) {
      // Only a deterministically-classified mobile may become the dialling
      // number. A landline never replaces a working number, and a verified or
      // manually confirmed number always stays primary.
      const bestMobile = isUkMobile(best.mobile || best.phone) ? (best.mobile || best.phone) : '';
      const previousPhone = out.phone || out.mobile;
      if (bestMobile) {
        const sameAsPrevious = phoneDigits(previousPhone) === phoneDigits(bestMobile);
        // Any existing dialling number is protected — provider values are additive.
        const previousProtected = !!previousPhone && isUkMobile(previousPhone) && !sameAsPrevious;
        if (!sameAsPrevious && previousProtected) {
          conflicts.push({ field: 'phone', existing_value: previousPhone, new_value: bestMobile, provider: providerUsed });
          out.lusha_mobile = bestMobile;
          out.lusha_phone_status = best.phone_status || 'provider_returned_unverified';
          out.lusha_phone_retrieved_at = best.phone_retrieved_at || now;
          if (!out.phone_source) out.phone_source = 'import';
          await upsertContactPhoneCandidate(base44, org, {
            list_id, prospect_id,
            person_name: best.name || out.full_name || '',
            person_title: best.title || out.job_title || '',
            value: bestMobile,
            phone_type: 'mobile',
            source: best.phone_source || providerUsed || 'lusha',
            source_column: 'provider_merge',
          });
          await raisePhoneReview(base44, org, {
            reason: 'phone_conflict',
            prospect_id, list_id, company_name: out.company_name,
            contact_name: best.name || '', existing_value: previousPhone,
            existing_source: out.phone_source || 'import', new_value: bestMobile,
            phone_type: 'mobile', confidence: best.phone_confidence || 0,
            new_source: best.phone_source || providerUsed,
            explanation: `An existing number was kept. ${providerUsed || 'Provider'} returned an additional mobile stored as Lusha/provider phone for export.`,
          });
        } else if (!previousPhone) {
          out.phone = bestMobile;
          out.mobile = bestMobile;
          out.phone_type = 'mobile';
          out.phone_status = best.phone_status || 'provider_returned_unverified';
          out.phone_source = best.phone_source || providerUsed;
          out.phone_retrieved_at = best.phone_retrieved_at || now;
          out.phone_confidence = best.phone_confidence || 0;
          out.phone_review_reason = best.phone_review_reason || '';
        } else if (sameAsPrevious) {
          out.phone_source = out.phone_source || best.phone_source || providerUsed;
          out.phone_retrieved_at = best.phone_retrieved_at || out.phone_retrieved_at || now;
        }
      } else if (best.direct_dial) {
        // A direct line is stored beside the dialling number, never as it.
        out.direct_dial = out.direct_dial || best.direct_dial;
        if (!out.phone_type || out.phone_type === 'unknown') out.phone_type = best.phone_type || 'unknown';
        out.phone_status = out.phone_status && out.phone_status !== 'unknown'
          ? out.phone_status
          : (best.phone_status || 'provider_returned_unverified');
        out.phone_review_reason = out.phone_review_reason || best.phone_review_reason || '';
      }
    }
  }

  // Phone fallback to landline (only if landline is a real number, not a placeholder).
  if (!out.phone && out.landline) {
    out.phone = out.landline;
    // A switchboard is a legitimate fallback, but it must never be presented
    // as the contact's mobile or direct line.
    out.phone_type = 'switchboard';
    out.phone_status = 'switchboard_fallback';
    out.company_phone = out.company_phone || out.landline;
  }
  // Record the company switchboard separately whenever we hold one.
  if (out.landline && !out.company_phone) out.company_phone = out.landline;

  // Build provider error summary when email is still missing — surfaces
  // silent failures so the user can see which providers were tried.
  const hasPersonalEmailFinal = !!(out.email && classifyEmail(out.email, out.domain).isPersonal);
  const phoneStillMissingFinal = getMissingFields(out, requestedFields).some((f) => f === 'mobile' || f === 'direct_dial');
  {
    const parts: string[] = [];
    // Provider failures are always named, so "no number found" never hides a
    // rejected request, an expired key or a plan restriction.
    if (lushaProviderError && (phoneStillMissingFinal || !hasPersonalEmailFinal)) parts.push(lushaProviderError);
    if (lushaStatuses.includes('plan_restricted') && !parts.some((p) => p.startsWith('Lusha'))) {
      parts.push('Lusha: the connected API plan did not make the number available, though Lusha may hold it in its web platform.');
    }
    if (!hasPersonalEmailFinal) {
      if (apolloProviderError) parts.push(apolloProviderError);
      if (apolloKey && out.contacts.length > 0 && !out.contacts.some((c: any) => c.email && classifyEmail(c.email, out.domain).isPersonal)) {
        parts.push('Apollo: no personal email found for matched contacts');
      }
      if (apolloKey && out.contacts.length === 0) {
        parts.push('Apollo: company not found in database');
      }
      if (needsAiFallback) {
        parts.push('AI web research: no public email found on company website or LinkedIn');
      }
      if (needsEmailSearch) {
        parts.push('AI email search: no publicly visible email found');
      }
    }
    if (parts.length) apolloProviderError = parts.join('; ');
  }

  // 5b. Phone outcome — always precise, never "no information found".
  if (phoneRequested) {
    if (!phoneLookupResult) {
      if (out.phone && hasDirectNumber(out.phone, out.landline)) {
        setPhoneLookup('existing_number_reused', PHONE_RESULT_MESSAGES.existing_number_reused);
      } else if (!out.contacts.length) {
        // Providers reveal numbers for named people — without a name there was
        // nothing to ask about, so say that rather than implying a failure.
        setPhoneLookup(
          'provider_not_called',
          'No named contact was available to look up. Enable contact discovery to find one first.',
        );
      } else if (!providerOrder.includes('lusha')) {
        setPhoneLookup(
          'provider_not_called',
          providerOrder.length === 0
            ? PHONE_RESULT_MESSAGES.provider_not_called
            : 'Lusha was not called because it is not enabled for this run.',
        );
      } else {
        setPhoneLookup(
          'temporary_provider_failure',
          'Lusha was called but returned no number for this contact.',
        );
      }
    }
    out.field_provenance = {
      ...(out.field_provenance || {}),
      phone: {
        ...((out.field_provenance || {}).phone || {}),
        lookup_result: phoneLookupResult,
        lookup_message: phoneLookupMessage,
        lookup_at: now,
        cooldown: out.phone_cooldown || null,
      },
    };
  }

  // 6. Compute enrichment status and email type.
  const finalEmailClass = out.email ? classifyEmail(out.email, out.domain) : null;
  const result: any = {
    ...out,
    company_found: !!(out.domain || out.website),
    landline_found: !!out.landline,
    decision_makers_found: out.contacts.length > 0,
    work_email_found: out.contacts.some((c: any) => {
      const ec = classifyEmail(c.email, out.domain);
      return ec.isPersonal;
    }) || (finalEmailClass?.isPersonal || false),
    mobile_found: out.contacts.some((c: any) => isUkMobile(c.mobile || c.phone)),
    linkedin_found: out.contacts.some((c: any) => c.linkedin) || !!out.linkedin,
    generic_email: genericEmail,
    email_type: finalEmailClass?.type || 'unknown',
    email_verification_status: (best?.email_status === 'inferred' || out.email_status === 'inferred')
      ? 'inferred'
      : (finalEmailClass?.isPersonal ? 'provider_returned' : 'unknown'),
    provider_used: providerUsed,
    provider_error: apolloProviderError || '',
    last_attempted_at: now,
  };
  result.enrichment_status = computeEnrichmentStatus(result);

  // Determine which fields were found vs still missing.
  const finalMissing = getMissingFields(result, requestedFields);
  const fieldsFound = requestedFields.filter((f) => !finalMissing.includes(f));

  return {
    patch: result,
    fields_found: fieldsFound,
    fields_missing: finalMissing,
    fields_cached: cached,
    provider_used: providerUsed,
    conflicts,
    smart_actions_used: smartActionsUsed,
  };
}