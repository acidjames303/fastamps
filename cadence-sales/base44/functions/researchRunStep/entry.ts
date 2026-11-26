import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { clean } from '../../shared/researchFindings.ts';
import { researchAccount, normaliseProvider } from '../../shared/campaignResearch.ts';

// Accounts researched per call. Two keeps each invocation comfortably inside
// the function timeout while still moving a 60-account campaign along quickly.
const MAX_PER_STEP = 2;
const MAX_ATTEMPTS = 2;

// Advances a research run by a couple of accounts and returns the whole run, so
// the workspace can show per-account progress and retries as they happen.
export default async function (req) {
  try {
    const { base44, user, org, profile } = await resolveTenant(req);
    assertProviderAccess(profile);

    const body = await req.json().catch(() => ({}));
    const run_id = clean(body?.run_id);
    const retry = body?.retry === true;
    const cancel = body?.cancel === true;

    if (!run_id) return Response.json({ error: 'run_id is required.' }, { status: 400 });

    const run = await base44.asServiceRole.entities.ResearchRun
      .get(run_id)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!run || run.organisation_id !== org.id) {
      return Response.json({ error: 'Research run not found.' }, { status: 404 });
    }

    if (cancel) {
      const items = (run.items || []).map((item) =>
        item.status === 'pending' || item.status === 'processing' ? { ...item, status: 'skipped' } : item,
      );
      const cancelled = await base44.asServiceRole.entities.ResearchRun.update(run.id, {
        status: 'cancelled',
        items,
        completed_at: new Date().toISOString(),
      });
      return Response.json({ run: cancelled });
    }

    if (run.status === 'completed' || run.status === 'partially_completed' || run.status === 'cancelled') {
      if (!retry) return Response.json({ run });
    }

    const list = await base44.asServiceRole.entities.ProspectList
      .get(run.prospect_list_id)
      .catch(() => null);
    if (!list || list.organisation_id !== org.id) {
      return Response.json({ error: 'Prospect list not found.' }, { status: 404 });
    }

    const items = (run.items || []).map((item) => ({ ...item }));

    // Retry re-queues accounts that ran out of attempts.
    if (retry) {
      items.forEach((item) => {
        if (item.status === 'failed') {
          item.status = 'pending';
          item.attempts = 0;
          item.error = '';
        }
      });
    }

    const queue = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) =>
        item.status === 'pending' || (item.status === 'failed' && (item.attempts || 0) < MAX_ATTEMPTS),
      )
      .slice(0, MAX_PER_STEP);

    if (!queue.length) {
      const remaining = items.filter((item) => item.status === 'pending' || item.status === 'processing').length;
      const failed = items.filter((item) => item.status === 'failed').length;
      const done = items.filter((item) => item.status === 'complete').length;
      const finished = await base44.asServiceRole.entities.ResearchRun.update(run.id, {
        items,
        status: remaining ? 'processing' : failed ? 'partially_completed' : 'completed',
        completed_accounts: done,
        failed_accounts: failed,
        completed_at: remaining ? null : new Date().toISOString(),
        error_summary: failed ? `${failed} account${failed === 1 ? '' : 's'} could not be researched.` : '',
      });
      return Response.json({ run: finished });
    }

    for (const { item, index } of queue) {
      const prospect = await base44.asServiceRole.entities.Prospect
        .get(item.prospect_id)
        .catch(() => null);
      if (!prospect || prospect.organisation_id !== org.id || prospect.list_id !== run.prospect_list_id) {
        items[index] = {
          ...item,
          status: 'failed',
          error: 'This account is no longer in the campaign.',
          completed_at: new Date().toISOString(),
        };
        continue;
      }

      items[index] = {
        ...item,
        status: 'processing',
        attempts: (item.attempts || 0) + 1,
        started_at: new Date().toISOString(),
        error: '',
      };

      try {
        const result = await researchAccount({
          base44,
          org,
          user,
          list,
          prospect,
          prompt: run.instruction,
          provider: normaliseProvider(run.provider),
          sourceFunction: 'researchRunStep',
        });
        items[index] = {
          ...items[index],
          status: 'complete',
          research_id: result.research_id,
          findings_count: result.findings_count,
          sources: result.sources,
          completed_at: new Date().toISOString(),
        };
      } catch (error) {
        items[index] = {
          ...items[index],
          status: 'failed',
          error: clean(error?.message).slice(0, 300) || 'Research failed for this account.',
          completed_at: new Date().toISOString(),
        };
      }
    }

    const done = items.filter((item) => item.status === 'complete').length;
    const failed = items.filter((item) => item.status === 'failed').length;
    const remaining = items.filter((item) => item.status === 'pending' || item.status === 'processing').length;
    const retryable = items.some(
      (item) => item.status === 'failed' && (item.attempts || 0) < MAX_ATTEMPTS,
    );

    const updated = await base44.asServiceRole.entities.ResearchRun.update(run.id, {
      items,
      status: remaining || retryable ? 'processing' : failed ? 'partially_completed' : 'completed',
      completed_accounts: done,
      failed_accounts: failed,
      completed_at: remaining || retryable ? null : new Date().toISOString(),
      error_summary: failed ? `${failed} account${failed === 1 ? '' : 's'} could not be researched.` : '',
    });

    return Response.json({ run: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}