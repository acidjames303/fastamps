import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { checkAllowance, recordUsage } from '../../shared/costControl.ts';
import { clean, mergeFindings, normaliseFindings, promptHash } from '../../shared/researchFindings.ts';

// Web-grounded model — this is the only family that supports internet context.
const WEB_MODEL = 'gemini_3_flash';
const MAX_PER_CALL = 4;

function formatPriorFindings(findings) {
  return (Array.isArray(findings) ? findings : [])
    .slice(0, 16)
    .map((f) => `- [${clean(f?.evidence) || 'published'}] ${clean(f?.label)}: ${clean(f?.value)}${f?.source_url ? ` (${f.source_url})` : ''}`)
    .filter((line) => line.length > 8)
    .join('\n');
}

// Prompt-driven account research. Supports a first pass and a dig-deeper pass
// that merges new sourced findings into the existing pack without wiping
// team/customer-confirmed notes.
export default async function (req) {
  try {
    const { base44, user, org, profile } = await resolveTenant(req);
    assertProviderAccess(profile);
    const body = await req.json().catch(() => ({}));
    const prospect_list_id = clean(body?.prospect_list_id);
    const prompt = clean(body?.prompt).slice(0, 1500);
    const focus = clean(body?.focus).slice(0, 600);
    const mode = clean(body?.mode).toLowerCase() === 'deeper' ? 'deeper' : 'standard';
    const requestIds = Array.isArray(body?.prospect_ids)
      ? body.prospect_ids.filter((id) => typeof id === 'string').slice(0, MAX_PER_CALL)
      : [];

    if (!prospect_list_id) {
      return Response.json({ error: 'prospect_list_id is required.' }, { status: 400 });
    }
    if (!prompt) {
      return Response.json({ error: 'Tell the researcher what to look for.' }, { status: 400 });
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
    if (!all.length) {
      return Response.json({ researched: 0, failed: 0, remaining: 0, results: [] });
    }

    const targets = requestIds.length
      ? all.filter((p) => requestIds.includes(p.id))
      : all.slice(0, MAX_PER_CALL);
    if (!targets.length) {
      return Response.json({ researched: 0, failed: 0, remaining: 0, results: [] });
    }

    const hash = promptHash(prompt);
    const context = [String(list.brief || '').slice(0, 800), String(list.icp || '').slice(0, 800)]
      .filter(Boolean)
      .join('\n\n');
    const results = [];

    for (const prospect of targets) {
      try {
        await checkAllowance(base44, org, 'ai_action', 1);

        const existing = await base44.asServiceRole.entities.AccountResearch.filter(
          { prospect_id: prospect.id, prompt_hash: hash, organisation_id: org.id }, '-created_date', 1,
        ).catch(() => []);
        const prior = existing?.[0] || null;
        const priorBlock = formatPriorFindings(prior?.findings);

        const deeperRules = mode === 'deeper'
          ? `
DIG DEEPER MODE:
- We already hold findings for this account. Do NOT repeat them.
- Search further: secondary sources, contract schedules, award notices, annual reports, LinkedIn/company news, Companies House filings, supplier award pages.
- Prefer NEW facts, fresher dates, named contacts, values, extension options, and competing suppliers.
- If the team gave an extra focus, prioritise that focus.
${focus ? `Extra focus from the team:\n"""\n${focus}\n"""` : ''}
${priorBlock ? `Already known (do not repeat):\n${priorBlock}` : '(No prior findings on file.)'}
`
          : '';

        const research = await base44.asServiceRole.integrations.Core.InvokeLLM({
          model: WEB_MODEL,
          add_context_from_internet: true,
          prompt: `You are a B2B account researcher for a sales team. Apply the team's instruction to one company and record what public sources actually show.

Team instruction:
"""
${prompt}
"""

Company: ${prospect.company_name}${prospect.website ? ` (website: ${prospect.website})` : ''}${prospect.location ? ` — ${prospect.location}` : ''}

Campaign context (for relevance only):
"""
${context || '(none supplied)'}
"""
${deeperRules}
Rules:
- Use public sources: the company's own site, council and planning records, procurement portals (Contracts Finder, ProContract, Find a Tender), trade press, Companies House, news, professional profiles.
- Focus: the team instruction and campaign context define the subject that matters. Record only contracts, awards, suppliers and plans relating to that subject. Every unrelated contract at this company is irrelevant — leave it out, however large.
- When a related contract exists, capture it completely: contract title, supplier, scope, reference, award/start/end dates, extension options, awarded value, procurement route.
- Add a "Potential contact" finding when a named procurement or service contact is published (name, email, telephone), and a "Next action" finding with the one question worth asking first.
- Every finding must be supported by a public page. Put that exact page URL in source_url. If you cannot support a finding, leave it out — returning no findings is correct and better than guessing.
- Never invent suppliers, contracts, dates, people or URLs.
- source_date is the date shown on the source (publication or contract date), else an empty string.
- Record only published facts. Anything the customer later confirms is added separately by the team, so never claim a fact is confirmed by the customer.
- label: a short field name, ordered as it should read, e.g. "Contract title", "Supplier", "Contract scope", "Reference", "Awarded", "Start", "End", "Awarded value", "Procurement route", "Potential contact", "Next action", "Note".
- target_roles: up to 4 job titles at this company worth calling given the instruction.
- summary: start with a headline naming the company and the subject reviewed, e.g. "Merton – Telecare Contract Review", then two sentences on what the published record shows and what remains unverified.`,
          response_json_schema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              findings: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    value: { type: 'string' },
                    source_url: { type: 'string' },
                    source_date: { type: 'string' },
                    confidence: { type: 'number' },
                  },
                },
              },
              target_roles: { type: 'array', items: { type: 'string' } },
            },
            required: ['summary', 'findings'],
          },
        });

        const fresh = normaliseFindings(research?.findings, 16);
        const findings = mode === 'deeper' && prior
          ? mergeFindings(prior.findings, fresh, 24)
          : fresh;
        const incomingRoles = (Array.isArray(research?.target_roles) ? research.target_roles : [])
          .map(clean)
          .filter(Boolean);
        const priorRoles = Array.isArray(prior?.target_roles) ? prior.target_roles.map(clean).filter(Boolean) : [];
        const targetRoles = [...new Set([...priorRoles, ...incomingRoles])].slice(0, 6);

        const summaryParts = [
          mode === 'deeper' && prior?.summary ? clean(prior.summary) : '',
          clean(research?.summary),
        ].filter(Boolean);
        const summary = (mode === 'deeper'
          ? summaryParts.slice(-2).join('\n\n')
          : clean(research?.summary)
        ).slice(0, 1200);

        const record = {
          organisation_id: org.id,
          prospect_list_id,
          prospect_id: prospect.id,
          company_name: prospect.company_name,
          prompt,
          prompt_hash: hash,
          summary,
          findings,
          target_roles: targetRoles,
          source_count: new Set(findings.map((f) => f.source_url).filter(Boolean)).size,
          status: 'complete',
          error_summary: '',
          created_by_user_id: user.id,
          researched_at: new Date().toISOString(),
        };

        const saved = prior
          ? await base44.asServiceRole.entities.AccountResearch.update(prior.id, record)
          : await base44.asServiceRole.entities.AccountResearch.create(record);

        // Keep CompanyIntelligence in step when we can resolve a company id.
        if (prospect.company_id) {
          const intel = await base44.asServiceRole.entities.CompanyIntelligence.filter(
            { company_id: prospect.company_id, organisation_id: org.id }, '-updated_date', 1,
          ).catch(() => []);
          const intelPatch = {
            company_id: prospect.company_id,
            company_name: prospect.company_name,
            organisation_id: org.id,
            ai_summary: summary.slice(0, 800),
            target_roles: targetRoles,
            news: findings.find((f) => /news|recent|update/i.test(f.label))?.value || '',
            buyer_signals: findings.find((f) => /signal|trigger|next action/i.test(f.label))?.value || '',
            source: 'ai_web',
            status: 'current',
            researched_at: record.researched_at,
            generated_at: record.researched_at,
            confidence: Math.min(100, 40 + findings.length * 5),
            intelligence_version: (intel?.[0]?.intelligence_version || 0) + 1,
          };
          if (intel?.[0]) {
            await base44.asServiceRole.entities.CompanyIntelligence.update(intel[0].id, intelPatch).catch(() => null);
          } else {
            await base44.asServiceRole.entities.CompanyIntelligence.create(intelPatch).catch(() => null);
          }
        }

        await recordUsage(base44, {
          organisation_id: org.id,
          user_id: user.id,
          target_list_id: prospect_list_id,
          event_type: 'ai_action',
          provider: 'ai_web',
          quantity: 1,
          estimated_cost: 1,
          actual_cost: 1,
          related_record_id: prospect.id,
          source_function: mode === 'deeper' ? 'researchAccountsPrompted:deeper' : 'researchAccountsPrompted',
        });

        results.push({
          prospect_id: prospect.id,
          company_name: prospect.company_name,
          research_id: saved?.id || '',
          findings: findings.length,
          sources: record.source_count,
          target_roles: targetRoles,
          mode,
        });
      } catch (error) {
        results.push({
          prospect_id: prospect.id,
          company_name: prospect.company_name,
          error: error.message || 'Research failed for this account.',
        });
        if (error?.status === 429) break;
      }
    }

    const researched = results.filter((r) => !r.error).length;
    return Response.json({
      researched,
      failed: results.length - researched,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
