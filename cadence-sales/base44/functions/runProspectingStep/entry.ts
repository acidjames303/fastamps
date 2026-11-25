import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { checkAllowance, recordUsage } from '../../shared/costControl.ts';
import { fetchPublicText } from '../../shared/webhookSecurity.ts';

const WEB_MODEL = 'gemini_3_8_flash';
const QUALIFY_THRESHOLD = 60;
const STEP_STATUSES = ['queued', 'researching', 'discovering', 'saving', 'failed'];

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000);
}

// Reads the seed page through the shared SSRF-safe fetcher: public URLs only,
// no redirects followed, response body capped.
async function readSite(url) {
  if (!url) return { text: '', status: 'skipped' };
  const res = await fetchPublicText(url, {
    timeoutMs: 10000,
    maxBytes: 200000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CadenceProspecting/1.0)' },
  });
  if (!res.ok) return { text: '', status: res.status };
  return { text: stripHtml(res.text), status: 'ok' };
}

function normaliseAccounts(accounts, limit) {
  const seen = new Set();
  const out = [];
  for (const a of accounts || []) {
    const name = String(a?.name || '').trim();
    if (!name) continue;
    const key = String(a?.domain || name).toLowerCase().replace(/^www\./, '');
    if (seen.has(key)) continue;
    seen.add(key);
    const score = Math.max(0, Math.min(100, Number(a?.fit_score) || 0));
    out.push({
      name,
      domain: String(a?.domain || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, ''),
      website: String(a?.website || a?.domain || ''),
      industry: String(a?.industry || ''),
      employee_range: String(a?.employee_range || ''),
      location: String(a?.location || ''),
      country_code: String(a?.country_code || '').toUpperCase().slice(0, 2),
      why_fits: String(a?.why_fits || ''),
      fit_score: score,
      fit_reason: String(a?.fit_reason || a?.why_fits || ''),
      evidence_url: String(a?.evidence_url || a?.website || ''),
      signals: Array.isArray(a?.signals) ? a.signals.map(String).slice(0, 5) : [],
      verdict: score >= QUALIFY_THRESHOLD ? 'accepted' : 'rejected',
      prospect_id: '',
    });
    if (out.length >= limit) break;
  }
  return out;
}

function profileSummary(run, profile) {
  return [
    profile?.summary,
    profile?.industries?.length ? `Industries: ${profile.industries.join(', ')}` : '',
    profile?.company_sizes?.length ? `Sizes: ${profile.company_sizes.join(', ')}` : '',
    profile?.buyer_roles?.length ? `Buyer roles: ${profile.buyer_roles.join(', ')}` : '',
    profile?.buying_signals?.length ? `Signals: ${profile.buying_signals.join(', ')}` : '',
    profile?.disqualifiers?.length ? `Disqualifiers: ${profile.disqualifiers.join(', ')}` : '',
    run.seed_url ? `Reference account: ${run.seed_url}` : '',
    run.permitted_countries?.length ? `Geography: ${run.permitted_countries.join(', ')}` : '',
  ].filter(Boolean).join('\n');
}

// Advances a prospecting run by exactly one phase per call: context → discover → save.
export default async function (req) {
  let runId = null;
  try {
    const { base44, user, org, profile } = await resolveTenant(req);
    assertProviderAccess(profile);
    const body = await req.json().catch(() => ({}));
    const run_id = body.run_id;
    runId = run_id;
    if (!run_id) return Response.json({ error: 'run_id is required.' }, { status: 400 });

    const run = await base44.asServiceRole.entities.ProspectingRun
      .get(run_id)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!run || run.organisation_id !== org.id) {
      return Response.json({ error: 'Prospecting run not found.' }, { status: 404 });
    }
    if (!STEP_STATUSES.includes(run.status) || (run.current_phase || 'context') === 'done') {
      return Response.json({ run });
    }

    const patch = {};
    const phase = run.current_phase || 'context';

    // ── Phase 1: understand the context ────────────────────────────────────
    if (phase === 'context') {
      await checkAllowance(base44, org, 'ai_action', 1);
      const site = run.source_type === 'url' ? await readSite(run.seed_url) : { text: '', status: 'skipped' };
      const prompt = `You are a B2B sales researcher building an ideal customer profile.

Source type: ${run.source_type}
Reference URL: ${run.seed_url || '(none)'}
Site content: ${site.text || '(could not be read)'}

Campaign brief:
${run.brief || '(not supplied)'}

Stated ideal customer profile:
${run.icp || '(not supplied — derive it from the source above)'}

Permitted geography: ${(run.permitted_countries || []).join(', ')}

Derive a precise, actionable buyer profile: who buys, why, and how to spot them. Use only what the source supports; where it is thin, infer sensibly and stay conservative.`;

      const profile = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            industries: { type: 'array', items: { type: 'string' } },
            company_sizes: { type: 'array', items: { type: 'string' } },
            geographies: { type: 'array', items: { type: 'string' } },
            buyer_roles: { type: 'array', items: { type: 'string' } },
            buying_signals: { type: 'array', items: { type: 'string' } },
            campaign_angle: { type: 'string' },
            disqualifiers: { type: 'array', items: { type: 'string' } },
          },
          required: ['summary', 'industries', 'buyer_roles', 'campaign_angle'],
        },
      });

      await recordUsage(base44, {
        organisation_id: org.id, user_id: user.id, target_list_id: run.prospect_list_id,
        event_type: 'ai_action', provider: 'base44_ai', quantity: 1,
        source_function: 'runProspectingStep', related_record_id: run.id,
      });

      patch.profile = profile;
      patch.campaign_intel = profile?.campaign_angle || '';
      patch.status = 'discovering';
      patch.current_phase = 'discover';
      patch.smart_actions_used = (run.smart_actions_used || 0) + 1;
    }

    // ── Phase 2: find and score real accounts ──────────────────────────────
    else if (phase === 'discover') {
      const [existingProspects, existingCompanies] = await Promise.all([
        base44.asServiceRole.entities.Prospect.filter(
          { list_id: run.prospect_list_id, organisation_id: org.id }, '-created_date', 300,
        ).catch(() => []),
        base44.asServiceRole.entities.Company.filter(
          { organisation_id: org.id }, '-created_date', 300,
        ).catch(() => []),
      ]);
      const excludeNames = [...existingProspects.map((p) => p.company_name), ...existingCompanies.map((c) => c.name)]
        .filter(Boolean).slice(0, 120);

      // Discovery runs in rounds. Each round verifies a fresh slice, excluding
      // everything already found, so targets of 100+ accounts are reachable
      // without asking one call for an unrealistic volume.
      const target = Math.max(5, Number(run.max_accounts) || 10);
      const found = [...(run.candidates || [])];
      const seen = new Set(
        found.map((c) => String(c.domain || c.name || '').toLowerCase().replace(/^www\./, '')),
      );
      const startingCount = found.length;
      const ROUND_SIZE = 20;
      let rounds = 0;
      let emptyRounds = 0;

      while (found.length < target && rounds < 2 && emptyRounds < 2) {
      const remaining = Math.min(ROUND_SIZE, target - found.length);
      await checkAllowance(base44, org, 'company_discovery', 1);
      const prompt = `You are a B2B prospecting agent. Find ${remaining} REAL, currently operating companies that match this buyer profile.

Buyer profile:
${profileSummary(run, run.profile)}

Hard requirements:
- Only companies operating in: ${(run.permitted_countries || ['GB']).join(', ')}
- Verify each company exists using its website or a public listing. Never invent companies or domains.
- Exclude anything already known: ${[...excludeNames, ...found.map((c) => c.name)].filter(Boolean).slice(-200).join('; ') || '(none)'}
- Score fit 0-100 from evidence, not optimism. Below ${QUALIFY_THRESHOLD} means a weak match.
- For each account, name the concrete buying signal you found (growth, hiring, expansion, funding, new site, contract win, technology change, regulation).

Return fewer than ${remaining} if you cannot verify that many. Accuracy beats volume.`;

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        model: WEB_MODEL,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            accounts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  domain: { type: 'string' },
                  website: { type: 'string' },
                  industry: { type: 'string' },
                  employee_range: { type: 'string' },
                  location: { type: 'string' },
                  country_code: { type: 'string' },
                  why_fits: { type: 'string' },
                  fit_score: { type: 'number' },
                  fit_reason: { type: 'string' },
                  evidence_url: { type: 'string' },
                  signals: { type: 'array', items: { type: 'string' } },
                },
                required: ['name', 'why_fits', 'fit_score'],
              },
            },
          },
          required: ['accounts'],
        },
      });

      await recordUsage(base44, {
        organisation_id: org.id, user_id: user.id, target_list_id: run.prospect_list_id,
        event_type: 'company_discovery', provider: 'base44_ai', quantity: 1,
        source_function: 'runProspectingStep', related_record_id: run.id,
      });

      const batch = normaliseAccounts(result?.accounts, remaining).filter((c) => {
        const key = String(c.domain || c.name).toLowerCase().replace(/^www\./, '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      found.push(...batch);
      rounds += 1;
      emptyRounds = batch.length ? 0 : emptyRounds + 1;
      }

      const candidates = found;
      if (!candidates.length) {
        patch.status = 'failed';
        patch.current_phase = 'done';
        patch.error_summary = 'No verifiable accounts were found for this profile. Try a broader ICP or a different reference URL.';
        patch.completed_at = new Date().toISOString();
      } else {
        patch.candidates = candidates;
        patch.accounts_found = candidates.length;
        patch.accounts_qualified = candidates.filter((c) => c.verdict === 'accepted').length;
        patch.accounts_rejected = candidates.filter((c) => c.verdict === 'rejected').length;
        // Keep discovering across steps while progress is being made. Two
        // consecutive empty steps mean the market is exhausted for this
        // profile, so the verified accounts are saved instead of looping.
        const emptySteps = candidates.length > startingCount ? 0 : (run.empty_discovery_steps || 0) + 1;
        const keepGoing = candidates.length < target && emptySteps < 2;
        patch.status = keepGoing ? 'discovering' : 'saving';
        patch.current_phase = keepGoing ? 'discover' : 'save';
        patch.empty_discovery_steps = keepGoing ? emptySteps : 0;
        patch.smart_actions_used = (run.smart_actions_used || 0) + rounds;
      }
    }

    // ── Phase 3: save qualified accounts into the prospect list ────────────
    else if (phase === 'save') {
      const already = await base44.asServiceRole.entities.Prospect.filter(
        { list_id: run.prospect_list_id, organisation_id: org.id }, '-created_date', 300,
      ).catch(() => []);
      const alreadyNames = new Set((already || []).map((p) => (p.company_name || '').toLowerCase()));

      const accepted = (run.candidates || []).filter(
        (c) => c.verdict === 'accepted' && !alreadyNames.has((c.name || '').toLowerCase()),
      );
      const created = accepted.length
        ? await base44.asServiceRole.entities.Prospect.bulkCreate(
          accepted.map((c) => ({
            list_id: run.prospect_list_id,
            company_name: c.name,
            domain: c.domain || '',
            website: c.website || '',
            industry: c.industry || '',
            employee_range: c.employee_range || '',
            location: c.location || '',
            country_code: c.country_code || '',
            fit_score: c.fit_score || 0,
            fit_reason: c.fit_reason || c.why_fits || '',
            target_role: (run.profile?.buyer_roles || [])[0] || '',
            enrichment_status: 'pending',
            geography_status: (run.permitted_countries || []).includes(c.country_code) ? 'matched' : 'unknown',
            pushed: false,
            call_status: 'new',
            organisation_id: org.id,
          })),
        )
        : [];

      const idByName = new Map(
        [...(already || []), ...(created || [])].map((p) => [(p.company_name || '').toLowerCase(), p.id]),
      );
      patch.candidates = (run.candidates || []).map((c) => ({
        ...c,
        prospect_id: c.verdict === 'accepted' ? (idByName.get((c.name || '').toLowerCase()) || '') : '',
      }));
      patch.prospect_ids = (already || []).map((p) => p.id).concat((created || []).map((p) => p.id));
      patch.status = 'completed';
      patch.current_phase = 'done';
      patch.completed_at = new Date().toISOString();

      if (run.prospect_list_id) {
        await base44.asServiceRole.entities.ProspectList
          .update(run.prospect_list_id, {
            status: 'ready',
            company_count: patch.prospect_ids.length,
          })
          .catch(() => {});
      }
    }

    if (patch.status && patch.status !== 'failed') patch.error_summary = '';
    const updated = await base44.asServiceRole.entities.ProspectingRun.update(run.id, patch);
    return Response.json({ run: updated });
  } catch (error) {
    if (runId) {
      await resolveTenant(req)
        .then(({ base44 }) => base44.asServiceRole.entities.ProspectingRun.update(runId, {
          status: 'failed',
          error_summary: error.message || 'The prospecting agent stopped unexpectedly.',
        }))
        .catch(() => {});
    }
    return Response.json({ error: error.message || 'The prospecting step failed.' }, { status: error.status || 500 });
  }
}