import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { checkAllowance, recordUsage } from '../../shared/costControl.ts';

const WEB_MODEL = 'gemini_3_8_flash';
const MAX_PER_CALL = 5;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normaliseDomain(value) {
  return clean(value)
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

// A person's name must have at least two words — single-name entries are
// usually AI hallucinations that repeat across unrelated companies.
function usableName(name) {
  const text = clean(name);
  return text.split(/\s+/).length >= 2 ? text : '';
}

// AI account research only — no provider credits are spent here. It runs
// before provider enrichment so Lusha/Apollo are asked for the right people
// at the right company, rather than guessing.
export default async function (req) {
  try {
    const { base44, user, org, profile } = await resolveTenant(req);
    assertProviderAccess(profile);
    const body = await req.json().catch(() => ({}));
    const prospect_list_id = clean(body?.prospect_list_id);
    const requestIds = Array.isArray(body?.prospect_ids)
      ? body.prospect_ids.filter((id) => typeof id === 'string').slice(0, MAX_PER_CALL)
      : [];

    if (!prospect_list_id) {
      return Response.json({ error: 'prospect_list_id is required.' }, { status: 400 });
    }

    const list = await base44.asServiceRole.entities.ProspectList
      .get(prospect_list_id)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!list || list.organisation_id !== org.id) {
      return Response.json({ error: 'Prospect list not found.' }, { status: 404 });
    }

    const all = await base44.asServiceRole.entities.Prospect.filter(
      { list_id: prospect_list_id, organisation_id: org.id }, '-created_date', 300,
    ).catch(() => []);

    const pool = requestIds.length
      ? all.filter((p) => requestIds.includes(p.id))
      : all.filter((p) => !p.company_found);
    const targets = pool.slice(0, MAX_PER_CALL);
    if (!targets.length) {
      return Response.json({ researched: 0, failed: 0, remaining: 0, results: [] });
    }

    const countries = (list.permitted_countries || ['GB']).join(', ');
    const brief = String(list.brief || '').slice(0, 1200);
    const icp = String(list.icp || '').slice(0, 1200);
    const results = [];

    for (const prospect of targets) {
      try {
        await checkAllowance(base44, org, 'company_research', 1);

        const prompt = `You are a B2B account researcher. Research the real company "${prospect.company_name}"${prospect.website ? ` (website: ${prospect.website})` : ''} using Google, its own website and Companies House. Return factual data only — never invent a domain, phone number or person.

Campaign brief:
"""
${brief || '(none supplied)'}
"""

Ideal customer profile:
"""
${icp || '(none supplied)'}
"""

Permitted geography: ${countries || 'United Kingdom'}

Return JSON:
- confirmed: true only if you actually found this company trading today.
- legal_name, domain (bare, e.g. acme.co.uk), website, industry, employee_range ("1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"), location (city, country), country_code (ISO 3166-1 alpha-2).
- landline: the main switchboard number from the company's Contact page or Google Business. Empty string if not found.
- summary: two sentences on what the company does and who it serves.
- buying_signals: up to 4 concrete signals (growth, hiring, funding, new site, regulation, technology change).
- target_roles: 2-4 job titles from the ICP that this campaign should call here.
- decision_makers: named people currently holding those roles. Only include someone you can verify exists with a two-word name. Emails and phones are revealed later by a data provider, so leave them out.`;

        const research = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt,
          model: WEB_MODEL,
          add_context_from_internet: true,
          response_json_schema: {
            type: 'object',
            properties: {
              confirmed: { type: 'boolean' },
              legal_name: { type: 'string' },
              domain: { type: 'string' },
              website: { type: 'string' },
              industry: { type: 'string' },
              employee_range: { type: 'string' },
              location: { type: 'string' },
              country_code: { type: 'string' },
              landline: { type: 'string' },
              summary: { type: 'string' },
              buying_signals: { type: 'array', items: { type: 'string' } },
              target_roles: { type: 'array', items: { type: 'string' } },
              decision_makers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { name: { type: 'string' }, title: { type: 'string' } },
                },
              },
            },
            required: ['confirmed', 'industry', 'target_roles'],
          },
        });

        const patch = {};
        const fill = (field, value) => {
          const text = clean(value);
          if (text && !prospect[field]) patch[field] = text;
        };

        fill('industry', research?.industry);
        fill('employee_range', research?.employee_range);
        fill('location', research?.location);
        fill('website', research?.website && research.website.startsWith('http') ? research.website : (research?.website ? `https://${normaliseDomain(research.website)}` : ''));
        fill('domain', normaliseDomain(research?.domain));
        fill('landline', research?.landline);
        if (!prospect.target_role && clean(research?.target_roles?.[0])) {
          patch.target_role = clean(research.target_roles[0]);
        }
        if (!prospect.fit_reason && clean(research?.summary)) {
          patch.fit_reason = clean(research.summary);
        }

        const countryCode = clean(research?.country_code).toUpperCase().slice(0, 2);
        if (countryCode && !prospect.country_code) {
          patch.country_code = countryCode;
          const permitted = (list.permitted_countries || ['GB']).map((c) => String(c).toUpperCase());
          const matched = !permitted.length || permitted.includes(countryCode);
          patch.geography_status = matched ? 'matched' : 'out_of_scope';
          patch.geography_reason = matched
            ? `AI research placed the company in ${countryCode}.`
            : `AI research placed the company in ${countryCode}, outside the permitted geography.`;
        }

        const existingContacts = Array.isArray(prospect.contacts) ? [...prospect.contacts] : [];
        const seen = new Set(existingContacts.map((c) => (c?.name || '').toLowerCase()).filter(Boolean));
        let addedContacts = 0;
        for (const person of research?.decision_makers || []) {
          const name = usableName(person?.name);
          if (!name || seen.has(name.toLowerCase())) continue;
          seen.add(name.toLowerCase());
          existingContacts.push({
            name,
            title: clean(person?.title),
            phone: '',
            email: '',
            linkedin: '',
            email_status: 'unknown',
          });
          addedContacts++;
        }
        if (addedContacts) patch.contacts = existingContacts;

        if (research?.confirmed === true && !prospect.company_found) patch.company_found = true;
        patch.provider_used = 'ai_web';
        patch.last_attempted_at = new Date().toISOString();

        await base44.asServiceRole.entities.Prospect.update(prospect.id, patch);

        await recordUsage(base44, {
          organisation_id: org.id,
          user_id: user.id,
          target_list_id: prospect_list_id,
          event_type: 'company_research',
          provider: 'ai_web',
          quantity: 1,
          estimated_cost: 1,
          actual_cost: 1,
          related_record_id: prospect.id,
          source_function: 'researchAccountsBatch',
        });

        results.push({
          prospect_id: prospect.id,
          company_name: prospect.company_name,
          confirmed: research?.confirmed === true,
          contacts_added: addedContacts,
          target_roles: (research?.target_roles || []).map(clean).filter(Boolean).slice(0, 4),
          summary: clean(research?.summary),
        });
      } catch (error) {
        results.push({
          prospect_id: prospect.id,
          company_name: prospect.company_name,
          error: error.message || 'Account research failed.',
        });
        if (error?.status === 429) break;
      }
    }

    const researched = results.filter((r) => !r.error).length;
    return Response.json({
      researched,
      failed: results.length - researched,
      remaining: Math.max(0, pool.length - researched),
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}