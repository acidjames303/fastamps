import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { clean } from '../../shared/researchFindings.ts';
import { researchAccount } from '../../shared/campaignResearch.ts';

const MAX_PER_CALL = 4;

// Prompt-driven account research. The team writes the instruction once; every
// account in the list is researched against it and the sourced findings are
// stored per account, published evidence kept apart from customer confirmation.
// The single-account work lives in shared/campaignResearch so a bulk campaign
// run produces exactly the same records.
export default async function (req) {
  try {
    const { base44, user, org, profile } = await resolveTenant(req);
    assertProviderAccess(profile);
    const body = await req.json().catch(() => ({}));
    const prospect_list_id = clean(body?.prospect_list_id);
    const prompt = clean(body?.prompt).slice(0, 1500);
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

    const results = [];

    for (const prospect of targets) {
      try {
        const outcome = await researchAccount({
          base44,
          org,
          user,
          list,
          prospect,
          prompt,
          provider: 'gemini',
          sourceFunction: 'researchAccountsPrompted',
        });
        results.push({
          prospect_id: prospect.id,
          company_name: prospect.company_name,
          research_id: outcome.research_id,
          findings: outcome.findings_count,
          sources: outcome.sources,
          target_roles: outcome.target_roles,
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