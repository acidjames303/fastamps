import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { clean, promptHash } from '../../shared/researchFindings.ts';
import { normaliseProvider } from '../../shared/campaignResearch.ts';

const MAX_SCOPE = 500;

// Starts one bulk research pass over a campaign's accounts. The run keeps
// per-account progress in the database, so it survives navigation and can be
// resumed or retried from the Research workspace.
export default async function (req) {
  try {
    const { base44, user, org, profile } = await resolveTenant(req);
    assertProviderAccess(profile);

    const body = await req.json().catch(() => ({}));
    const prospect_list_id = clean(body?.prospect_list_id);
    const instruction = clean(body?.instruction).slice(0, 1500);
    const scope = ['all', 'selected', 'missing'].includes(body?.scope) ? body.scope : 'missing';
    const provider = normaliseProvider(body?.provider);
    const brief_id = clean(body?.brief_id);
    const requestedIds = Array.isArray(body?.prospect_ids)
      ? body.prospect_ids.filter((id) => typeof id === 'string').slice(0, MAX_SCOPE)
      : [];

    if (!prospect_list_id) {
      return Response.json({ error: 'prospect_list_id is required.' }, { status: 400 });
    }
    if (!instruction) {
      return Response.json({ error: 'Tell the researcher what to look for.' }, { status: 400 });
    }

    const list = await base44.asServiceRole.entities.ProspectList
      .get(prospect_list_id)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!list || list.organisation_id !== org.id) {
      return Response.json({ error: 'Prospect list not found.' }, { status: 404 });
    }

    const prospects = await base44.asServiceRole.entities.Prospect.filter(
      { list_id: prospect_list_id, organisation_id: org.id },
      '-created_date',
      MAX_SCOPE,
    ).catch(() => []);

    if (!prospects.length) {
      return Response.json({ run: null, total_accounts: 0, message: 'This campaign has no accounts to research yet.' });
    }

    const hash = promptHash(instruction);
    let targets = prospects;

    if (scope === 'selected') {
      targets = prospects.filter((prospect) => requestedIds.includes(prospect.id));
      if (!targets.length) {
        return Response.json({ error: 'Select at least one account in this campaign.' }, { status: 400 });
      }
    } else if (scope === 'missing') {
      const covered = await base44.asServiceRole.entities.AccountResearch.filter(
        { prospect_list_id, prompt_hash: hash, organisation_id: org.id },
        '-researched_at',
        500,
      ).catch(() => []);
      const done = new Set(covered.map((record) => record.prospect_id));
      targets = prospects.filter((prospect) => !done.has(prospect.id));
      if (!targets.length) {
        return Response.json({
          run: null,
          total_accounts: 0,
          message: 'Every account in this campaign already has research for this instruction.',
        });
      }
    }

    // Resume rather than duplicate: an unfinished run for the same instruction
    // is handed straight back.
    const active = await base44.asServiceRole.entities.ResearchRun.filter(
      { prospect_list_id, organisation_id: org.id, status: { $in: ['queued', 'processing'] } },
      '-created_date',
      5,
    ).catch(() => []);
    const sameWork = (active || []).find((run) => run.prompt_hash === hash && run.status !== 'cancelled');
    if (sameWork) {
      return Response.json({ run: sameWork, total_accounts: sameWork.total_accounts || 0, resumed: true });
    }

    const now = new Date().toISOString();
    const run = await base44.asServiceRole.entities.ResearchRun.create({
      organisation_id: org.id,
      prospect_list_id,
      campaign_id: clean(list.campaign_id),
      brief_id,
      instruction,
      prompt_hash: hash,
      scope,
      provider,
      status: 'queued',
      total_accounts: targets.length,
      completed_accounts: 0,
      failed_accounts: 0,
      items: targets.map((prospect) => ({
        prospect_id: prospect.id,
        company_name: prospect.company_name || '',
        status: 'pending',
        attempts: 0,
        error: '',
        research_id: '',
        findings_count: 0,
        sources: 0,
      })),
      error_summary: '',
      started_by_user_id: user.id,
      started_at: now,
    });

    return Response.json({ run, total_accounts: targets.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}