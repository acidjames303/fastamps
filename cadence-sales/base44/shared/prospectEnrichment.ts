// Shared prospect-enrichment logic used by both the single-company
// enrichProspect HTTP function and the server-side enrichProspectBatch job.
// Keeping it here avoids duplicating ~200 lines across the two entry points.

import {
  classifyHttpError, computeEnrichmentStatus, countryNameToCode, checkGeography,
  recordAttempt, recordUsage, cooldownExpiry, generateCorrelationId, isWithinCooldown,
} from './enrichmentDiagnostics.ts';

import {
  lushaSearchAndEnrich, pickPersonNumber, pickSwitchboardNumber, pickWorkEmail,
} from './lusha.ts';

const FULLENRICH = 'https://app.fullenrich.com/api/v2';
const APOLLO = 'https://api.apollo.io/api/v1';

const SENIOR_TITLES = [
  'Managing Director', 'CEO', 'Commercial Director', 'Development Director',
  'Sales Director', 'Procurement Director', 'Finance Director', 'Operations Director',
  'Director', 'Head of',
];

const ROLE_PRIORITY = [
  'managing director', 'ceo', 'finance director', 'facilities manager',
  'operations manager', 'property manager', 'director', 'manager', 'head',
];

function pickBestPhone(phones) {
  if (!phones || !phones.length) return '';
  const order = ['mobile', 'direct', 'work', 'unknown'];
  const usable = phones.filter((p) => p && p.number && !p.doNotCall);
  if (!usable.length) return '';
  usable.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return usable[0].number;
}

function pickBestEmail(emails) {
  if (!emails || !emails.length) return '';
  const work = emails.find((e) => e.email && (e.type === 'work' || e.confidence === 'A+'));
  return (work || emails.find((e) => e.email) || {}).email || '';
}

function feToContact(p) {
  let linkedin = p.social_profiles?.professional_network?.url || '';
  if (!linkedin && Array.isArray(p.social_profiles)) {
    const li = p.social_profiles.find((s) => /linkedin\.com\/in\//.test(s?.url || ''));
    linkedin = li?.url || '';
  }
  return {
    name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || '',
    title: p.employment?.current?.title || p.headline || '',
    phone: '',
    email: '',
    linkedin,
  };
}

function rankContact(c) {
  const t = (c.title || '').toLowerCase();
  let s = 0;
  ROLE_PRIORITY.forEach((kw, i) => { if (t.includes(kw)) s = Math.max(s, ROLE_PRIORITY.length - i); });
  return s;
}

function splitName(full) {
  const parts = (full || '').trim().split(/\s+/);
  if (parts.length < 2) return { first: parts[0] || '', last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

// FullEnrich fallback: PHONES ONLY for decision-makers still missing a number.
// Limited-credit account — never request emails. Mutates `phone` when found.
async function fullenrichEnrich(list, out, key) {
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
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Prospect ${out.company_name}`.slice(0, 80), data }),
    });
    if (!start.ok) return;
    const eid = (await start.json().catch(() => ({}))).enrichment_id;
    if (!eid) return;

    let result = null;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const g = await fetch(`${FULLENRICH}/contact/enrich/bulk/${eid}`, { headers: { Authorization: `Bearer ${key}` } });
      if (!g.ok) continue;
      result = await g.json().catch(() => null);
      if (result && result.status === 'FINISHED') break;
    }
    if (!result || result.status !== 'FINISHED') {
      const g = await fetch(`${FULLENRICH}/contact/enrich/bulk/${eid}?forceResults=true`, { headers: { Authorization: `Bearer ${key}` } });
      if (g.ok) result = await g.json().catch(() => result);
    }
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
      if (match && phone) match.phone = phone;
    }
    return { http_status: 200, error_category: 'none', retryable: false };
  } catch (e) {
    return { http_status: 0, error_category: 'network_error', retryable: true };
  }
}

// Reveal mobile numbers + emails for named decision-makers through the shared
// Lusha client. Mutates each contact's `phone` / `email` when found and returns
// diagnostics that name the real outcome (never a silent "no data").
async function lushaEnrich(list, out, key) {
  const wantPhones = list.some((c) => !c.phone);
  const wantEmails = list.some((c) => !c.email);
  const reveal = [];
  if (wantPhones) reveal.push('phones');
  if (wantEmails) reveal.push('emails');
  if (!reveal.length) {
    return { http_status: 0, error_category: 'none', retryable: false, message: '', credits: 0, phones_applied: 0, emails_applied: 0, statuses: [] };
  }

  const response = await lushaSearchAndEnrich(key, {
    contacts: list.map((c) => ({ name: c.name, title: c.title, linkedin: c.linkedin, email: c.email, lusha_id: c.lusha_id || c.apollo_id || '' })),
    company: { name: out.company_name, domain: out.email_domain || out.domain },
    reveal,
  });

  let phonesApplied = 0;
  let emailsApplied = 0;
  for (const r of response.results) {
    const c = list[r.index];
    if (!c || !r.matched) continue;
    // Never attach a number from a different employer.
    if (r.status === 'company_mismatch') continue;
    if (wantPhones) {
      const person = pickPersonNumber(r.phones);
      if (person && !c.phone) { c.phone = person.number; phonesApplied++; }
      const board = pickSwitchboardNumber(r.phones);
      if (board && !out.landline) out.landline = board.number;
    }
    if (wantEmails) {
      const work = pickWorkEmail(r.emails);
      if (work && !c.email) { c.email = work.email; emailsApplied++; }
    }
    if (!c.linkedin && r.linkedin) c.linkedin = r.linkedin;
    if (!c.title && r.job_title) c.title = r.job_title;
    if (r.lusha_id) c.lusha_id = r.lusha_id;
  }

  return {
    http_status: response.http_status,
    error_category: response.error_category,
    retryable: response.retryable,
    message: response.message,
    credits: response.credits_charged,
    phones_applied: phonesApplied,
    emails_applied: emailsApplied,
    statuses: response.results.map((r) => r.status),
  };
}

// Apollo people search — finds decision-makers at a company by domain and
// reveals their work emails and phone numbers. Costs 1 Apollo credit per email
// revealed. Returns contacts with emails/phones populated. Also returns the
// company's switchboard number if Apollo has it.
async function apolloPeopleSearch(out, targetRoles, key) {
  const contacts = [];
  let companyPhone = '';
  try {
    const titles = (targetRoles && targetRoles.length ? targetRoles : SENIOR_TITLES).slice(0, 5);
    const body = { per_page: 10, page: 1, person_titles: titles };
    if (out.domain) body.q_organization_domain_list = [out.domain];
    else body.q_organization_name = out.company_name;

    const res = await fetch(`${APOLLO}/mixed_people/api_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': key },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const diag = classifyHttpError(res.status);
      return { contacts, companyPhone, http_status: res.status, error_category: diag.category, retryable: diag.retryable };
    }
    const data = await res.json().catch(() => ({}));
    for (const p of (data.people || [])) {
      const name = p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || '';
      if (!name) continue;
      const email = p.email && p.email !== 'null' ? p.email : '';
      const phone = (p.phone && p.phone !== 'null') || (p.sanitized_phone && p.sanitized_phone !== 'null')
        ? (p.phone || p.sanitized_phone || '') : '';
      contacts.push({
        name,
        title: p.title || p.headline || '',
        email,
        phone,
        linkedin: p.linkedin_url || '',
      });
    }
    // Apollo sometimes includes the org's phone in the search response
    const org = data.organizations?.[0];
    if (org) {
      companyPhone = org.primary_phone?.number || org.phone || '';
      if (!out.domain && org.primary_domain) out.domain = org.primary_domain.replace(/^www\./, '');
      if (!out.website && org.website_url) out.website = org.website_url;
      if (!out.industry && org.industry) out.industry = org.industry;
    }
    return { contacts, companyPhone, http_status: 200, error_category: 'none', retryable: false };
  } catch (e) {
    return { contacts, companyPhone, http_status: 0, error_category: 'network_error', retryable: true };
  }
}

// Apollo people match — enriches a specific named contact by name + company.
// Used in the gap-fill path to reveal emails/phones for contacts we already have.
// Costs 1 Apollo credit per email revealed.
async function apolloPeopleMatch(list, out, key) {
  let enriched = 0;
  try {
    for (const c of list) {
      if ((c.email && c.phone) || !c.name) continue;
      const { first, last } = splitName(c.name);
      const body = {
        first_name: first,
        last_name: last,
        organization_name: out.company_name,
      };
      if (out.domain) body.domain = out.domain;
      const res = await fetch(`${APOLLO}/people/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': key },
        body: JSON.stringify(body),
      });
      if (!res.ok) continue;
      const p = await res.json().catch(() => ({}));
      if (!p || !p.person) continue;
      const person = p.person;
      if (!c.email && person.email && person.email !== 'null') { c.email = person.email; enriched++; }
      if (!c.phone && person.phone && person.phone !== 'null') c.phone = person.phone;
      else if (!c.phone && person.sanitized_phone && person.sanitized_phone !== 'null') c.phone = person.sanitized_phone;
      if (!c.linkedin && person.linkedin_url) c.linkedin = person.linkedin_url;
      if (!c.title && person.title) c.title = person.title;
    }
    return { http_status: 200, error_category: 'none', retryable: false, emails_found: enriched };
  } catch (e) {
    return { http_status: 0, error_category: 'network_error', retryable: true, emails_found: enriched };
  }
}

// AI/Google email fallback — if no emails were found after all providers, do a
// targeted web search for publicly visible work emails at the company.
async function aiEmailFallback(base44, out, contacts, brief) {
  try {
    const names = contacts.filter((c) => !c.email).slice(0, 5).map((c) => `${c.name} (${c.title})`);
    if (!names.length) return;
    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a UK B2B prospecting researcher. Search Google and the company website for publicly visible WORK email addresses for these decision-makers at "${out.company_name}" (domain: ${out.domain || 'unknown'}, website: ${out.website || 'unknown'}):
${names.join('\n')}

Campaign brief for context:
${brief || '(not provided)'}

Return JSON: { "emails": [{ "name": "Person Name", "email": "their@work.email" }] }
Only include REAL, publicly visible emails found on the company website, LinkedIn, or other public sources. Never invent or guess email addresses. If you cannot find an email for someone, omit them from the array.`,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          emails: {
            type: 'array',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, email: { type: 'string' } },
            },
          },
        },
      },
    });
    const found = (res.emails || []);
    for (const e of found) {
      const match = contacts.find((c) => c.name.toLowerCase().includes((e.name || '').toLowerCase()) || (e.name || '').toLowerCase().includes(c.name.toLowerCase()));
      if (match && !match.email && e.email) match.email = e.email;
    }
  } catch {}
}

// Enriches one company:
//  1. AI web research → company firmographics + the main landline/switchboard +
//     named decision-makers (company site, LinkedIn, UK Companies House) + ICP fit.
//  2. FullEnrich people search → adds more senior decision-makers (names, titles, LinkedIn).
//  3. Lusha reveals mobiles for the top decision-makers (primary number source).
//  4. FullEnrich enrichment fills in mobiles for any Lusha couldn't resolve.
// For small UK firms the AI step is the workhorse (Lusha/FullEnrich often have no coverage).
//
// `base44` is the tenant-resolved client (with .asServiceRole).
// `secrets` is the base44:runtime secrets handle.
export async function enrichCompany(base44, secrets, { company_name, brief, icp, existing, permitted_countries, list_id, prospect_id, org }) {
  if (!company_name) return { error: 'company_name required' };

  const correlationId = generateCorrelationId();
  const now = new Date().toISOString();
  const orgObj = org;

  // Incremental gap-fill: a prior run already saved named decision-makers but
  // Lusha couldn't find mobiles for some. Skip the expensive AI research + people
  // search and just use Lusha → FullEnrich to reveal numbers for the named contacts
  // that still lack one. Existing phones/emails/landline are never overwritten.
  if (existing && Array.isArray(existing.contacts) && existing.contacts.some((c) => c && c.name)) {
    const contacts = existing.contacts
      .filter((c) => c && c.name)
      .map((c) => ({ name: c.name, title: c.title || '', phone: c.phone || '', email: c.email || '', linkedin: c.linkedin || '' }));

    const apolloKey = (secrets.get('APOLLO_API_KEY') || '').trim();
    const lushaKey = (secrets.get('LUSHA_API_KEY') || '').trim();
    const fullKey = (secrets.get('FULLENRICH_API_KEY') || '').trim();
    const ctx = { company_name: existing.company_name || company_name, domain: existing.domain || '' };

    // Apollo first — reveal emails/phones for named contacts we already have.
    if (apolloKey) {
      const need = contacts.filter((c) => !c.email || !c.phone).slice(0, 3);
      if (need.length) {
        await apolloPeopleMatch(need, ctx, apolloKey);
        await recordUsage(base44, orgObj, {
          event_type: 'email_enrichment', provider: 'apollo', quantity: need.length,
          unit: 'contact', source_function: 'enrichCompany',
          idempotency_key: `${correlationId}_apollo_gap`, related_record_id: prospect_id || '',
          metadata: { correlation_id: correlationId },
        });
      }
    }

    // Lusha fallback — reveal mobiles/emails Apollo couldn't resolve.
    if (lushaKey) {
      const need = contacts.filter((c) => !c.phone || !c.email).slice(0, 3);
      if (need.length) {
        const gapDiag = await lushaEnrich(need, ctx, lushaKey);
        if (gapDiag.credits > 0) {
          await recordUsage(base44, orgObj, {
            event_type: 'phone_enrichment', provider: 'lusha', quantity: gapDiag.credits,
            unit: 'credit', source_function: 'enrichCompany',
            idempotency_key: `${correlationId}_lusha_gap`, related_record_id: prospect_id || '',
            metadata: { correlation_id: correlationId, http_status: gapDiag.http_status },
          });
        }
        if (gapDiag.message && !gapDiag.phones_applied && !gapDiag.emails_applied) {
          ctx.provider_error = gapDiag.message;
        }
      }
    }
    const lushaResolved = new Set(contacts.filter((c) => c.phone).map((c) => c.name.toLowerCase()));

    // FullEnrich fallback — phones only for people still missing a number.
    if (fullKey) {
      const need = contacts.filter((c) => !c.phone).slice(0, 3);
      if (need.length) await fullenrichEnrich(need, ctx, fullKey);
    }

    // Google fallback — if still no emails, do a targeted web search.
    if (contacts.some((c) => !c.email)) {
      await aiEmailFallback(base44, ctx, contacts, brief);
    }

    const best = contacts.find((c) => c.name === existing.full_name) || contacts.find((c) => c.phone) || contacts.find((c) => c.email) || contacts[0];
    const result = {
      company_name: existing.company_name || company_name,
      domain: existing.domain || '',
      website: existing.website || '',
      industry: existing.industry || '',
      employee_range: existing.employee_range || '',
      location: existing.location || '',
      country_code: existing.country_code || '',
      geography_status: existing.geography_status || 'unknown',
      geography_reason: existing.geography_reason || '',
      landline: existing.landline || '',
      target_role: existing.target_role || '',
      fit_score: existing.fit_score ?? 0,
      fit_reason: existing.fit_reason || '',
      contacts,
      full_name: existing.full_name || (best ? best.name : ''),
      job_title: existing.job_title || (best ? best.title : ''),
      email: existing.email || (best ? best.email : ''),
      linkedin: existing.linkedin || (best ? best.linkedin : ''),
      phone: (best && best.phone) || existing.phone || existing.landline || '',
      // If no phone was found, at least surface the email so the rep has a contact route.
      email: (best && best.email) || existing.email || contacts.find((c) => c.email)?.email || '',
      source: (best && best.phone)
        ? (lushaResolved.has(best.name.toLowerCase()) ? 'lusha' : 'fullenrich')
        : (existing.source || 'ai_only'),
      company_found: !!(existing.domain || existing.website),
      landline_found: !!existing.landline,
      decision_makers_found: contacts.length > 0,
      work_email_found: contacts.some((c) => c.email) || !!existing.email,
      mobile_found: contacts.some((c) => c.phone),
      linkedin_found: contacts.some((c) => c.linkedin) || !!existing.linkedin,
      provider_used: 'ai_web',
      provider_error: '',
      last_attempted_at: now,
      retry_cooldown_expires_at: existing.retry_cooldown_expires_at || null,
    };
    result.enrichment_status = computeEnrichmentStatus(result);
    if (result.enrichment_status === 'not_found') {
      result.retry_cooldown_expires_at = cooldownExpiry();
    }
    return result;
  }

  // 1. AI web research — include any pre-discovered data so the AI can verify
  // and expand rather than researching from scratch.
  const preData = existing && (existing.domain || existing.website || existing.industry)
    ? `\n\nPre-researched firmographics (verify and expand — do NOT trust blindly, confirm via the company website):
- Domain: ${existing.domain || 'unknown'}
- Website: ${existing.website || 'unknown'}
- Industry: ${existing.industry || 'unknown'}
- Location: ${existing.location || 'unknown'}
- Employee range: ${existing.employee_range || 'unknown'}
Use these as a head start. Focus your web research on finding the main phone/switchboard number and named decision-makers.`
    : '';

  const ai = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are a UK B2B prospecting researcher. A sales rep gave only the company name "${company_name}" and this campaign brief:
"""
${brief || '(no brief provided)'}
"""

Ideal Customer Profile (ICP):
"""
${icp || '(not provided — infer target roles from the brief)'}
"""

CRITICAL: The ICP above defines which specific roles to target at this company. You MUST search for decision-makers who hold those specific roles (e.g. Commercial Director, Development Director, Sales Director, Procurement Director, etc.) — NOT just whoever appears first on the website. Search LinkedIn, the company "About/Team/Leadership" page, and UK Companies House directors specifically for people holding those ICP-defined roles.

Find the real company this refers to (very likely a UK company — use Google, the company website, and Companies House). Research it and return JSON:
- canonical_name: the company's proper registered/trading name
- domain: primary website domain (e.g. "acme.co.uk"), no protocol, no www
- website: full homepage URL
- industry: primary industry
- employee_range: headcount band (one of: "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+")
- location: HQ city, country
- country_code: ISO 3166-1 alpha-2 country code for the company's HQ (e.g. "GB" for United Kingdom, "US" for United States, "DE" for Germany). This is critical for geography filtering.
- landline: CRITICAL — you MUST search the company website (especially Contact, About, Footer pages) AND Google Business listing for the main phone/switchboard number. This is the primary number we need for calling, so search thoroughly. Include digits, spaces and + only. It is almost always published somewhere — check multiple pages if needed.
- target_roles: array of 2-5 specific job titles drawn from the ICP that this campaign should target here. If the ICP says "Commercial Director", include that — do NOT default to "Managing Director" unless the ICP asks for it.
- decision_makers: array of {name, title, email} for named people holding the ICP target roles. Search the company "About/Team/Leadership" page, LinkedIn, and UK Companies House directors. Prioritise people whose titles match the ICP roles. Include the person's work email if it is publicly visible on the company website or LinkedIn. Only include real, verifiable names. Empty array if none found.
- fit_score: integer 0-100 — how well this company fits the brief's ideal customer profile
- fit_reason: one short sentence
Be factual. Never invent a phone number or a person's name.${preData}`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        canonical_name: { type: 'string' },
        domain: { type: 'string' },
        website: { type: 'string' },
        industry: { type: 'string' },
        employee_range: { type: 'string' },
        location: { type: 'string' },
        country_code: { type: 'string' },
        landline: { type: 'string' },
        target_roles: { type: 'array', items: { type: 'string' } },
        decision_makers: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' }, title: { type: 'string' }, email: { type: 'string' } } },
        },
        fit_score: { type: 'number' },
        fit_reason: { type: 'string' },
      },
    },
  });

  // Derive country code from AI response or location string.
  const countryCode = (ai.country_code || '').trim().toUpperCase() || countryNameToCode(ai.location || '');

  // Geography check — companies outside the permitted countries are marked
  // out_of_scope and never sent to paid people-enrichment providers.
  const geo = checkGeography(countryCode, permitted_countries);

  // Record AI research usage (non-paid, but metered for transparency).
  await recordUsage(base44, orgObj, {
    event_type: 'research_request',
    provider: 'ai_web',
    quantity: 1,
    unit: 'request',
    source_function: 'enrichCompany',
    idempotency_key: `${correlationId}_ai`,
    related_record_id: prospect_id || '',
    metadata: { company_name, correlation_id: correlationId },
  });

  const out = {
    company_name: ai.canonical_name || (existing?.company_name) || company_name,
    domain: (ai.domain || existing?.domain || '').replace(/^www\./, ''),
    website: ai.website || existing?.website || '',
    industry: ai.industry || existing?.industry || '',
    employee_range: ai.employee_range || existing?.employee_range || '',
    location: ai.location || existing?.location || '',
    country_code: countryCode,
    geography_status: geo.status,
    geography_reason: geo.reason,
    landline: (ai.landline || (existing?.landline || '')).trim(),
    target_role: (ai.target_roles || [])[0] || '',
    fit_score: ai.fit_score ?? 0,
    fit_reason: ai.fit_reason || '',
    full_name: '',
    job_title: '',
    phone: '',
    email: '',
    linkedin: '',
    contacts: [],
    source: 'ai_only',
    enrichment_status: 'not_found',
    // Transparency fields — each data element tracked separately.
    company_found: !!(ai.canonical_name || ai.domain || existing?.domain || existing?.website),
    landline_found: !!(ai.landline || '').trim(),
    decision_makers_found: (ai.decision_makers || []).length > 0,
    work_email_found: false,
    mobile_found: false,
    linkedin_found: false,
    provider_used: 'ai_web',
    provider_error: '',
    last_attempted_at: now,
  };

  // If the company is out of scope, stop here — do NOT send to paid providers.
  if (geo.status === 'out_of_scope') {
    out.enrichment_status = 'out_of_scope';
    out.retry_cooldown_expires_at = null;
    await recordAttempt(base44, orgObj, {
      provider: 'ai_web', enrichment_type: 'company', status: 'skipped',
      prospect_id, list_id, correlation_id: correlationId,
      fields_returned: ['country_code', 'geography_status'],
      retry_eligible: false, retry_reason: 'Out of permitted geography — not retryable.',
    });
    return out;
  }

  // merge decision-makers (AI first, then FullEnrich), dedup by name
  const contacts = [];
  const seen = new Set();
  const add = (c) => {
    const k = (c.name || '').toLowerCase().trim();
    if (!c.name || seen.has(k)) return;
    seen.add(k);
    contacts.push(c);
  };
  (ai.decision_makers || []).forEach((d) => add({ name: d.name, title: d.title, phone: '', email: d.email || '', linkedin: '' }));

  const apolloKey = (secrets.get('APOLLO_API_KEY') || '').trim();
  const lushaKey = (secrets.get('LUSHA_API_KEY') || '').trim();
  const fullKey = (secrets.get('FULLENRICH_API_KEY') || '').trim();

  // 2. Apollo people search — primary source for emails and phone numbers.
  // Searches by company domain for decision-makers and reveals their work
  // emails and phone numbers. Costs 1 Apollo credit per email revealed.
  let apolloDiag = { http_status: 0, error_category: 'none', retryable: false };
  if (apolloKey) {
    const result = await apolloPeopleSearch(out, ai.target_roles, apolloKey);
    apolloDiag = { http_status: result.http_status, error_category: result.error_category, retryable: result.retryable };
    if (result.companyPhone && !out.landline) out.landline = result.companyPhone;
    result.contacts.forEach((c) => add(c));
    if (result.contacts.length) {
      await recordUsage(base44, orgObj, {
        event_type: 'email_enrichment', provider: 'apollo',
        quantity: result.contacts.filter((c) => c.email).length || result.contacts.length,
        unit: 'contact', source_function: 'enrichCompany',
        idempotency_key: `${correlationId}_apollo`, related_record_id: prospect_id || '',
        metadata: { correlation_id: correlationId, http_status: apolloDiag.http_status },
      });
      await recordAttempt(base44, orgObj, {
        provider: 'apollo', enrichment_type: 'email', status: apolloDiag.error_category === 'none' ? 'successful' : 'failed',
        prospect_id, list_id, http_status: apolloDiag.http_status, error_category: apolloDiag.error_category,
        correlation_id: correlationId,
        fields_returned: result.contacts.filter((c) => c.email || c.phone).map((c) => c.name),
        retry_eligible: apolloDiag.retryable,
        retry_reason: apolloDiag.error_category === 'none' ? '' : `Apollo: ${apolloDiag.error_category}`,
      });
    }
  }

  // FullEnrich people-search disabled — limited credits are reserved for
  // phone reveals on contacts that still have no number.

  // rank so the most senior decision-maker comes first
  contacts.sort((a, b) => rankContact(b) - rankContact(a));

  // 4. Lusha — reveal mobiles for decision-makers Apollo didn't resolve
  let lushaDiag = { http_status: 0, error_category: 'none', retryable: false };
  if (lushaKey && contacts.length) {
    const lushaContacts = contacts.slice(0, 3);
    lushaDiag = await lushaEnrich(lushaContacts, out, lushaKey);
    // Usage is recorded only for credits Lusha actually charged.
    if (lushaDiag.credits > 0) {
      await recordUsage(base44, orgObj, {
        event_type: 'phone_enrichment',
        provider: 'lusha',
        quantity: lushaDiag.credits,
        unit: 'credit',
        source_function: 'enrichCompany',
        idempotency_key: `${correlationId}_lusha`,
        related_record_id: prospect_id || '',
        metadata: { correlation_id: correlationId, http_status: lushaDiag.http_status },
      });
    }
    await recordAttempt(base44, orgObj, {
      provider: 'lusha', enrichment_type: 'direct_phone',
      status: (lushaDiag.phones_applied || lushaDiag.emails_applied) ? 'successful' : (lushaDiag.error_category === 'none' ? 'not_found' : 'failed'),
      prospect_id, list_id, http_status: lushaDiag.http_status, error_category: lushaDiag.error_category,
      correlation_id: correlationId,
      fields_returned: contacts.filter((c) => c.phone).map((c) => c.name),
      retry_eligible: lushaDiag.retryable,
      retry_reason: lushaDiag.error_category === 'none' ? '' : `Lusha: ${lushaDiag.error_category}`,
    });
  }
  const lushaResolved = new Set(contacts.filter((c) => c.phone).map((c) => c.name.toLowerCase()));

  // 5. FullEnrich fallback — phones only for contacts Lusha left without a number
  let feDiag = { http_status: 0, error_category: 'none', retryable: false };
  if (fullKey) {
    const remaining = contacts.slice(0, 3).filter((c) => !c.phone);
    if (remaining.length) {
      feDiag = await fullenrichEnrich(remaining, out, fullKey);
      await recordUsage(base44, orgObj, {
        event_type: 'phone_enrichment',
        provider: 'fullenrich',
        quantity: remaining.length,
        unit: 'contact',
        source_function: 'enrichCompany',
        idempotency_key: `${correlationId}_fullenrich`,
        related_record_id: prospect_id || '',
        metadata: { correlation_id: correlationId, http_status: feDiag.http_status },
      });
      await recordAttempt(base44, orgObj, {
        provider: 'fullenrich', enrichment_type: 'direct_phone', status: feDiag.error_category === 'none' ? 'successful' : 'failed',
        prospect_id, list_id, http_status: feDiag.http_status, error_category: feDiag.error_category,
        correlation_id: correlationId,
        fields_returned: remaining.filter((c) => c.phone).map((c) => c.name),
        retry_eligible: feDiag.retryable,
        retry_reason: feDiag.error_category === 'none' ? '' : `FullEnrich: ${feDiag.error_category}`,
      });
    }
  }

  // 6. Google fallback — if still no emails after all providers, do a targeted
  // web search for publicly visible work emails.
  if (contacts.some((c) => !c.email)) {
    await aiEmailFallback(base44, out, contacts, brief);
  }

  // best contact = the first decision-maker with a phone, else the first with an email
  const best = contacts.find((c) => c.phone) || contacts.find((c) => c.email) || contacts[0];
  let mobileSource = '';
  if (best && best.phone) {
    mobileSource = lushaResolved.has(best.name.toLowerCase()) ? 'lusha' : 'fullenrich';
  }

  out.contacts = contacts;
  if (best) {
    out.full_name = best.name;
    out.job_title = best.title;
    out.email = best.email || '';
    out.linkedin = best.linkedin || '';
  }
  // If no direct mobile was found, fall back to landline; if no number at all,
  // at least surface the email so the rep has a contact route.
  out.phone = (best && best.phone) || out.landline || '';
  out.source = (best && best.phone) ? mobileSource : (out.email ? 'apollo' : 'ai_only');

  // Update transparency fields based on final results.
  out.decision_makers_found = contacts.length > 0;
  out.mobile_found = contacts.some((c) => c.phone);
  out.work_email_found = contacts.some((c) => c.email) || !!out.email;
  out.linkedin_found = contacts.some((c) => c.linkedin) || !!out.linkedin;
  out.landline_found = !!out.landline;
  out.company_found = !!(out.domain || out.website);
  out.provider_used = mobileSource || (out.landline ? 'ai_web' : 'ai_web');
  if (lushaDiag.error_category !== 'none' && feDiag.error_category !== 'none') {
    out.provider_error = `${lushaDiag.error_category}; ${feDiag.error_category}`;
  } else if (lushaDiag.error_category !== 'none') {
    out.provider_error = `lusha: ${lushaDiag.error_category}`;
  } else if (feDiag.error_category !== 'none') {
    out.provider_error = `fullenrich: ${feDiag.error_category}`;
  }

  // Determine granular enrichment status.
  out.enrichment_status = computeEnrichmentStatus(out);

  // Set cooldown for genuine not-found results (7-day retry cooldown).
  if (out.enrichment_status === 'not_found') {
    out.retry_cooldown_expires_at = cooldownExpiry();
  }

  return out;
}

// Returns a secrets-like wrapper whose .get() prefers organisation-level API keys
// (loaded from the encrypted ProviderCredential store) over the app-level runtime
// secrets. Lets each org bring its own Lusha / FullEnrich / Twilio credentials;
// falls back to app secrets when the org hasn't set its own.
import { getOrgCredentials } from './providerCredentials.ts';

export async function withOrgKeys(base44, org) {
  return await getOrgCredentials(base44, org);
}