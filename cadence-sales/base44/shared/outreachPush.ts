import { companyDomain, companyKey, companyMatchToken, personFromRow } from './outreachIdentity.ts';

// Pure planning logic for moving prospect contacts into an outreach campaign.
// Nothing here writes, sends or calls a provider: the backend function loads the
// scoped records, then uses these helpers so every decision is testable offline.

export const MAX_PUSH = 200;
export const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export const ROLE_INBOX =
  /^(info|sales|admin|support|contact|hello|office|enquiries|inquiries|reception|customerservice|service|team|general|marketing|bookings|booking)@/i;

export const cleanText = (value: any, max = 400) => String(value ?? '').trim().slice(0, max);
export const normaliseEmail = (value: any) => cleanText(value, 320).toLowerCase();

export function campaignBrief(campaign: any) {
  const parts = [
    campaign?.objective && `Objective\n${campaign.objective}`,
    campaign?.offer && `Offer\n${campaign.offer}`,
    campaign?.target_profile && `Target profile\n${campaign.target_profile}`,
    campaign?.industry_focus && `Industry focus\n${campaign.industry_focus}`,
    campaign?.internal_notes && `Campaign notes\n${campaign.internal_notes}`,
  ].filter(Boolean);
  return parts.length ? cleanText(parts.join('\n\n'), 4000) : cleanText(campaign?.name, 200);
}

// Choose the recipient and the preserved contact details for one prospect.
export function bestContact(prospect: any) {
  const contacts = Array.isArray(prospect?.contacts)
    ? prospect.contacts.filter((contact: any) => EMAIL.test(normaliseEmail(contact?.email)))
    : [];
  const named = contacts.find((contact: any) => contact?.name && !ROLE_INBOX.test(normaliseEmail(contact.email)));
  const chosen = named || contacts[0] || null;

  const ownEmail = normaliseEmail(prospect?.email);
  const genericFallback = normaliseEmail(prospect?.generic_email);
  let email = '';
  if (ownEmail && !ROLE_INBOX.test(ownEmail)) email = ownEmail;
  else if (chosen) email = normaliseEmail(chosen.email);
  else email = ownEmail || genericFallback;

  const name = cleanText(chosen?.name || prospect?.full_name, 120);
  return {
    email,
    name,
    roleInbox: ROLE_INBOX.test(email),
    jobTitle: cleanText(chosen?.title || prospect?.job_title, 120),
    phone: cleanText(chosen?.phone || prospect?.phone, 40),
    mobile: cleanText(chosen?.mobile || prospect?.mobile, 40),
    directDial: cleanText(chosen?.direct_dial || prospect?.direct_dial, 40),
    companyPhone: cleanText(prospect?.company_phone || prospect?.landline, 40),
  };
}

export function buildResearch(record: any) {
  if (!record) return { fact: '', sourceUrl: '', facts: [] as any[], status: 'none' };
  const facts = (Array.isArray(record.findings) ? record.findings : [])
    .filter((finding: any) => cleanText(finding?.value, 800))
    .slice(0, 8)
    .map((finding: any) => ({
      label: cleanText(finding.label, 80) || 'Finding',
      value: cleanText(finding.value, 800),
      source_url: cleanText(finding.source_url, 500),
      source_date: cleanText(finding.source_date, 40),
      evidence: cleanText(finding.evidence, 30) || 'published',
    }));
  const sourced = facts.find((fact: any) => fact.source_url);
  return {
    fact: cleanText(record.summary, 900) || facts[0]?.value || '',
    sourceUrl: sourced?.source_url || '',
    facts,
    status: facts.length ? (facts.some((f: any) => f.source_url) ? 'sourced' : 'mixed') : 'none',
  };
}

export function prepareCandidates({
  prospects,
  researchByProspect,
  campaign,
  brandKey,
  ownerUserId,
  organisationId,
  now,
}: {
  prospects: any[];
  researchByProspect: Record<string, any> | Map<string, any>;
  campaign: any;
  brandKey: string;
  ownerUserId: string;
  organisationId: string;
  now: string;
}) {
  const lookup = researchByProspect instanceof Map ? researchByProspect : new Map(Object.entries(researchByProspect || {}));
  const brief = campaignBrief(campaign);
  const candidates: any[] = [];
  const skipped: any[] = [];
  const seen = new Set<string>();

  for (const prospect of prospects || []) {
    const contact = bestContact(prospect);
    if (!EMAIL.test(contact.email)) {
      skipped.push({ prospect_id: prospect?.id, company_name: prospect?.company_name, reason: 'no_email' });
      continue;
    }
    if (seen.has(contact.email)) {
      skipped.push({ prospect_id: prospect?.id, company_name: prospect?.company_name, reason: 'duplicate_in_selection' });
      continue;
    }
    seen.add(contact.email);

    const person = personFromRow({ full_name: contact.name, email: contact.email });
    const research = buildResearch(lookup.get(prospect.id));
    const domain = cleanText(prospect.domain, 200) || companyDomain(prospect.website);
    const identityUnclear = !domain;
    const companyName = cleanText(prospect.company_name, 180);

    const note = identityUnclear
      ? 'No website or domain on the prospect record: confirm the exact business before drafting'
      : contact.roleInbox
        ? 'Role inbox: use only with explicit review'
        : !person.first_name
          ? 'No confirmed first name: approve a name-free greeting or verify the person'
          : '';

    candidates.push({
      organisation_id: organisationId,
      owner_user_id: ownerUserId,
      brand_key: brandKey,
      campaign_id: campaign?.id || '',
      prospect_id: prospect.id,
      contact_id: cleanText((prospect.contacts || []).find((c: any) => normaliseEmail(c?.email) === contact.email)?.id, 100),
      company_id: cleanText(prospect.company_id, 100),
      account_research_id: cleanText(lookup.get(prospect.id)?.id, 100),
      idempotency_key: [organisationId, ownerUserId, brandKey, campaign?.id || '', contact.email].join('|'),
      push_source: 'prospecting',
      pushed_at: now,
      email: contact.email,
      normalised_email: contact.email,
      full_name: person.full_name || contact.name,
      first_name: person.first_name || '',
      last_name: person.last_name || '',
      name_source: person.first_name ? 'prospect_record' : '',
      name_suggestion: person.name_suggestion || '',
      phone: contact.phone,
      mobile: contact.mobile,
      direct_dial: contact.directDial,
      company_phone: contact.companyPhone,
      company_name: companyName,
      original_company_name: companyName,
      company_name_normalized: companyKey(companyName),
      company_match_token: companyMatchToken(companyName),
      company_domain: domain,
      company_domain_source: prospect.domain ? 'prospect_domain' : domain ? 'prospect_website' : 'missing',
      company_registration_number: cleanText(prospect.company_registration_number, 30),
      company_match_status: identityUnclear ? 'ambiguous' : 'unverified',
      company_match_reason: identityUnclear ? note : '',
      campaign_brief: brief,
      job_title: contact.jobTitle,
      website: cleanText(prospect.website, 300),
      source_url: research.sourceUrl,
      research_fact: research.fact,
      research_source_url: research.sourceUrl,
      research_facts: research.facts,
      research_evidence_status: research.status,
      research_review_status: research.facts.length ? 'unreviewed' : 'none',
      tps_ctps_status: cleanText(prospect.tps_ctps_status, 30) || 'unchecked',
      suppression_status: 'clear',
      verification_status: 'unknown',
      review_status: identityUnclear ? 'flagged_company' : 'needs_review',
      review_note: note,
      created_at: now,
      updated_at: now,
    });
  }

  return { candidates, skipped, brief };
}

export function finalisePlan(
  candidates: any[],
  { existingEmails, suppressedEmails }: { existingEmails: Set<string>; suppressedEmails: Set<string> }
) {
  const items: any[] = [];
  const skipped: any[] = [];
  for (const candidate of candidates) {
    const email = normaliseEmail(candidate.email);
    if (suppressedEmails.has(email)) {
      skipped.push({ email, company_name: candidate.company_name, reason: 'suppressed' });
      continue;
    }
    if (existingEmails.has(email)) {
      skipped.push({ email, company_name: candidate.company_name, reason: 'already_in_outreach' });
      continue;
    }
    items.push(candidate);
  }

  const count = (reason: string) => skipped.filter((row) => row.reason === reason).length;
  return {
    items,
    skipped,
    counts: {
      eligible: items.length,
      already_in_outreach: count('already_in_outreach'),
      suppressed: count('suppressed'),
      no_email: count('no_email'),
      duplicate_in_selection: count('duplicate_in_selection'),
      flagged_company: items.filter((item) => item.review_status === 'flagged_company').length,
      role_inbox: items.filter((item) => ROLE_INBOX.test(normaliseEmail(item.email))).length,
      with_research: items.filter((item) => item.research_evidence_status === 'sourced').length,
    },
  };
}