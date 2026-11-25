// Replaceable provider interfaces for research and enrichment.
// All external API calls live behind these; the app never depends permanently
// on one provider, and secrets are never returned to the browser.
//
// `base44` is the tenant-resolved service-role client (has .asServiceRole).
// `secrets` is the base44:runtime secrets handle (or an withOrgKeys wrapper).

import { lushaSearchAndEnrich, pickPersonNumber, pickWorkEmail } from './lusha.ts';

const FULLENRICH = 'https://app.fullenrich.com/api/v2';

const SENIOR_TITLES = [
  'Managing Director', 'CEO', 'Finance Director', 'Facilities Manager',
  'Operations Manager', 'Property Manager', 'Director', 'Head of',
];

function splitName(full) {
  const parts = (full || '').trim().split(/\s+/);
  if (parts.length < 2) return { first: parts[0] || '', last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

// ---------------------------------------------------------------------------
// CompanyResearchProvider — AI web research into a single company.
// Returns verified facts + AI inference, clearly separated. Never invents
// people, phone numbers, turnover or news.
// ---------------------------------------------------------------------------
export const CompanyResearchProvider = {
  async researchCompany(base44, { company, domain, website, brief, icp }) {
    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a UK B2B sales research assistant. Research the company "${company}" (domain: ${domain || 'unknown'}, website: ${website || 'unknown'}).
Use the company website, Google, and UK Companies House. Return factual JSON.
CRITICAL: Every field value must be PLAIN TEXT ONLY. Do NOT include source URLs, markdown links, bracketed citations, or references like [Source Name](https://...) anywhere in any field. State the fact — never cite the URL inline. The only field that may contain URLs is the "sources" array.

- canonical_name: proper registered/trading name
- domain: primary website domain, no protocol, no www
- website: full homepage URL
- industry: primary industry
- employee_range: one of "1-10","11-50","51-200","201-500","501-1000","1000+" (or "Unknown")
- turnover_estimate: annual turnover band in GBP (e.g. "£1M-£5M"), or "Unknown"
- location: HQ city, country (or "Unknown")
- landline: the company's main public switchboard number as published on their site or Google Business. Digits, spaces and + only. Empty string "" if you cannot find a real one — never invent a number.
- business_description: 1-2 plain sentences on what the company does. No URLs, no markdown.
- products_services: array of 3-6 strings, each formatted as "Capability — short description" (em dash). No URLs, no markdown.
- target_markets: array of 3-6 strings, each formatted as "Segment — short reason" (em dash). No URLs, no markdown.
- tech_stack: array of detected technologies/platforms (empty if none reliably identified)
- news: one short sentence on a recent development, or ""
- buyer_signals: one short sentence on purchase-intent triggers, or ""
- target_roles: array of 2-5 senior job titles to target
- why_matches: one sentence on why this company matches the campaign brief
- why_needs_offer: one sentence on why they may need the offer
- sources: array of public source URLs used (company site, LinkedIn, Companies House, news)
- verified_facts: array of concise factual statements you could confirm from a primary source
- ai_inferences: array of concise statements that are your inference, not a verified fact
- confidence: integer 0-100 confidence in this research
Be specific and factual. Never invent a phone number, a person, turnover or news. Never include URLs or markdown in any field value except the "sources" array.`,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          canonical_name: { type: 'string' }, domain: { type: 'string' }, website: { type: 'string' },
          industry: { type: 'string' }, employee_range: { type: 'string' },
          turnover_estimate: { type: 'string' }, location: { type: 'string' }, landline: { type: 'string' },
          business_description: { type: 'string' },
          products_services: { type: 'array', items: { type: 'string' } },
          target_markets: { type: 'array', items: { type: 'string' } },
          tech_stack: { type: 'array', items: { type: 'string' } },
          news: { type: 'string' }, buyer_signals: { type: 'string' },
          target_roles: { type: 'array', items: { type: 'string' } },
          why_matches: { type: 'string' }, why_needs_offer: { type: 'string' },
          sources: { type: 'array', items: { type: 'string' } },
          verified_facts: { type: 'array', items: { type: 'string' } },
          ai_inferences: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number' },
        },
      },
    });
    return res;
  },

  // ICP-based company discovery. Bounded number of candidates, with sources.
  // Candidates are never auto-approved — the caller decides which proceed.
  async discoverCompanies(base44, { icp, brief, count, existingDomains }) {
    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a UK B2B prospecting researcher. Given this ideal customer profile and campaign brief, suggest up to ${count} real UK companies that fit it.
Ideal customer profile:
${icp || '(not provided)'}

Campaign brief:
${brief || '(not provided)'}

Return JSON: an array "companies" of objects {name, domain, website, industry, employee_range, location, why_fits, source_url}.
Only include REAL companies you can verify exist (use Google, Companies House, the company website). Never invent companies, domains or people. source_url should be the company website or a public listing. If you cannot reliably find ${count}, return fewer.`,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          companies: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' }, domain: { type: 'string' }, website: { type: 'string' },
                industry: { type: 'string' }, employee_range: { type: 'string' },
                location: { type: 'string' }, why_fits: { type: 'string' }, source_url: { type: 'string' },
              },
            },
          },
        },
      },
    });
    // Dedup against existing domains before returning.
    const have = new Set((existingDomains || []).map((d) => (d || '').toLowerCase().replace(/^www\./, '')));
    return (res.companies || []).filter((c) => {
      const d = (c.domain || '').toLowerCase().replace(/^www\./, '');
      if (d && have.has(d)) return false;
      if (d) have.add(d);
      return true;
    });
  },
};

// ---------------------------------------------------------------------------
// PeopleSearchProvider — find decision-makers at a company.
// Returns several possible contacts. Does NOT reveal paid direct numbers.
// ---------------------------------------------------------------------------
export const PeopleSearchProvider = {
  async findDecisionMakers(base44, secrets, { company, domain, target_roles }) {
    const results = [];
    // FullEnrich people-search is intentionally disabled: this org's FullEnrich
    // balance is reserved for phone reveals on contacts that still have no number.

    // AI — named directors/leaders from public sources (no phones).
    if (!results.length) {
      try {
        const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are a UK B2B prospecting researcher. Find named senior decision-makers at the company "${company}" (domain: ${domain || 'unknown'}).
Use the company "About/Team" page, LinkedIn, and UK Companies House directors. Return JSON { decision_makers: array of {name, title, linkedin} }.
Only include REAL, verifiable people. Empty array if none found. Never invent a person or a phone number.`,
          add_context_from_internet: true,
          model: 'gemini_3_flash',
          response_json_schema: {
            type: 'object',
            properties: {
              decision_makers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { name: { type: 'string' }, title: { type: 'string' }, linkedin: { type: 'string' } },
                },
              },
            },
          },
        });
        for (const d of (res.decision_makers || [])) {
          results.push({ name: d.name, title: d.title, linkedin: d.linkedin, provider: 'ai_web', confidence: 60 });
        }
      } catch {}
    }

    // Dedup by normalised name.
    const seen = new Set();
    return results.filter((c) => {
      const k = (c.name || '').toLowerCase().trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  },
};

// ---------------------------------------------------------------------------
// ContactEnrichmentProvider — paid direct-detail reveal.
// Lusha first, FullEnrich fallback, company switchboard last resort.
// Never overwrites an existing verified direct number with weaker data.
// ---------------------------------------------------------------------------
export const ContactEnrichmentProvider = {
  // Reveal a phone for one contact. Returns { number, type, provider, confidence, source_url } or null.
  async revealPhone(secrets, { contact, company, domain }) {
    const lushaKey = (secrets.get('LUSHA_API_KEY') || '').trim();
    const fullKey = (secrets.get('FULLENRICH_API_KEY') || '').trim();
    // company may arrive as a name or as the company record.
    const companyName = typeof company === 'string' ? company : company?.name || '';
    const landline = typeof company === 'string' ? '' : company?.landline || '';
    const companySite = typeof company === 'string' ? '' : company?.website || '';
    // Kept so callers can report why a provider returned nothing.
    let lastLushaMessage = '';

    // 1. Lusha
    if (lushaKey && contact.name) {
      const response = await lushaSearchAndEnrich(lushaKey, {
        contacts: [{ name: contact.name, title: contact.title, linkedin: contact.linkedin, email: contact.email }],
        company: { name: companyName, domain },
        reveal: ['phones'],
      });
      const person = pickPersonNumber(response.results[0]?.phones || []);
      if (person) {
        return { number: person.number, type: person.type, provider: 'lusha', confidence: 85, source_url: '', message: response.message };
      }
      lastLushaMessage = response.message;
    }

    // 2. FullEnrich fallback
    if (fullKey && contact.name) {
      try {
        const { first, last } = splitName(contact.name);
        const start = await fetch(`${FULLENRICH}/contact/enrich/bulk`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${fullKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Enrich ${company}`.slice(0, 80),
            data: [{
              first_name: first, last_name: last, company_name: companyName,
              ...(domain ? { domain } : {}), ...(contact.linkedin ? { linkedin_url: contact.linkedin } : {}),
              enrich_fields: ['contact.phones'],
            }],
          }),
        });
        if (start.ok) {
          const eid = (await start.json().catch(() => ({}))).enrichment_id;
          if (eid) {
            let result = null;
            const deadline = Date.now() + 30000;
            while (Date.now() < deadline) {
              await new Promise((r) => setTimeout(r, 3000));
              const g = await fetch(`${FULLENRICH}/contact/enrich/bulk/${eid}`, { headers: { Authorization: `Bearer ${fullKey}` } });
              if (!g.ok) continue;
              result = await g.json().catch(() => null);
              if (result && result.status === 'FINISHED') break;
            }
            const row = (result?.data || [])[0];
            const ci = row?.contact_info || {};
            const num = ci.most_probable_phone?.number || ci.phones?.[0]?.number || '';
            if (num) return { number: num, type: 'mobile', provider: 'fullenrich', confidence: 70, source_url: '' };
          }
        }
      } catch {}
    }

    // 3. Company switchboard fallback (not a direct number).
    if (landline) {
      return { number: landline, type: 'switchboard', provider: 'switchboard', confidence: 40, source_url: companySite, message: lastLushaMessage };
    }
    return lastLushaMessage ? { number: '', type: '', provider: '', confidence: 0, source_url: '', message: lastLushaMessage } : null;
  },

  async revealEmail(secrets, { contact, company, domain }) {
    const lushaKey = (secrets.get('LUSHA_API_KEY') || '').trim();
    if (!lushaKey || !contact.name) return null;
    const companyName = typeof company === 'string' ? company : company?.name || '';
    const response = await lushaSearchAndEnrich(lushaKey, {
      contacts: [{ name: contact.name, title: contact.title, linkedin: contact.linkedin, email: contact.email }],
      company: { name: companyName, domain },
      reveal: ['emails'],
    });
    const work = pickWorkEmail(response.results[0]?.emails || []);
    if (work) return { email: work.email, provider: 'lusha', confidence: 80, source_url: '', message: response.message };
    return null;
  },

  // Lightweight verification: a number is "verified" if a provider returned it
  // with confidence >= 70. Re-verification is a no-op here (real verification
  // would call a phone-validation API; we record the date instead).
  verifyPhone({ confidence }) {
    return { verified: (confidence || 0) >= 70, confidence: confidence || 0 };
  },
};