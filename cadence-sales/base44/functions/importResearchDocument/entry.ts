import { resolveTenant } from '../../shared/tenantAuth.ts';
import { checkAllowance, recordUsage } from '../../shared/costControl.ts';
import { clean, normaliseFindings, promptHash } from '../../shared/researchFindings.ts';

const MAX_SECTIONS = 5;
const MAX_TEXT = 6000;
const MAX_FINDINGS = 12;
const MAX_CANDIDATES = 5;

// Company-name matching ignores legal suffixes and filler words so that a
// document heading ("EMH Homes") lines up with the prospect already in the list.
const IGNORED = new Set([
  'ltd', 'limited', 'plc', 'llp', 'inc', 'the', 'and', 'of', 'group', 'holdings',
  'uk', 'cic', 'company', 'co', 'services',
]);

function tokens(name) {
  return clean(name)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !IGNORED.has(token));
}

function normalisedName(name) {
  return tokens(name).join(' ');
}

function documentHash(documentName) {
  return `import-${promptHash(`imported:${clean(documentName)}`)}`;
}

// Ambiguity is surfaced, never guessed: an import only files a section against
// an account when the name is identical, or when a reviewer has named the
// account explicitly. Everything else comes back for review.
function candidateScores(sectionName, prospects) {
  const wanted = tokens(sectionName);
  if (!wanted.length) return [];
  return prospects
    .map((prospect) => {
      const have = new Set(tokens(prospect.company_name));
      if (!have.size) return null;
      const overlap = wanted.filter((token) => have.has(token)).length;
      if (!overlap) return null;
      const score = overlap / Math.max(wanted.length, have.size);
      if (score < 0.4) return null;
      return { id: prospect.id, company_name: prospect.company_name, score: Math.round(score * 100) / 100 };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);
}

function buildPrompt(work) {
  const blocks = work.map((entry, index) =>
    `Account ${index + 1}: ${entry.section.company_name}\n"""\n${entry.section.text}\n"""`,
  ).join('\n\n');

  return `You are filing research a sales team has already gathered into account records. The document passages below are the ONLY source.

Rules:
- Use only what the passages state. Never add outside knowledge and never invent suppliers, contracts, dates, people, values or URLs.
- One entry per account, echoing company_name exactly as written in its passage heading.
- Findings: capture the substance completely (supplier, contract title, scope, reference, award and end dates, value, procurement route, named contact, next action, CRM note). Label each one with a short field name in reading order.
- Label a finding "Customer confirmed" only where the passage says the customer confirmed it.
- source_url only where the passage itself prints that URL for the finding; otherwise leave it empty.
- source_date only where the passage shows a publication or contract date.
- summary: one line beginning with the company name, then a sentence or two on what the passage shows and what remains unverified.
- target_roles: up to 4 job titles at this company worth calling, taken from the passage.
- If a passage contains nothing usable, return the account with an empty findings array and a summary saying so.

Passages:
${blocks}`;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    accounts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          company_name: { type: 'string' },
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
        required: ['company_name', 'summary', 'findings'],
      },
    },
  },
  required: ['accounts'],
};

// Files a research document the team already holds into the accounts it covers.
// Each account's findings are stored against that prospect, so the row's
// "see research" view shows the imported evidence alongside anything researched
// in Cadence.
export default async function (req) {
  try {
    const { base44, user, org } = await resolveTenant(req);
    const body = await req.json().catch(() => ({}));
    const prospect_list_id = clean(body?.prospect_list_id);
    const document_name = clean(body?.document_name).slice(0, 160) || 'Uploaded research';

    // A reviewer's explicit choice wins: sections may carry prospect_id, or a
    // resolutions list may name the account for a heading.
    const resolutions = new Map(
      (Array.isArray(body?.resolutions) ? body.resolutions : [])
        .filter((item) => clean(item?.company_name) && clean(item?.prospect_id))
        .map((item) => [normalisedName(item.company_name), clean(item.prospect_id)]),
    );
    const skips = new Set(
      (Array.isArray(body?.skip) ? body.skip : []).map((name) => normalisedName(name)).filter(Boolean),
    );

    const sections = (Array.isArray(body?.sections) ? body.sections : [])
      .filter((item) => clean(item?.company_name) && clean(item?.text))
      .slice(0, MAX_SECTIONS)
      .map((item) => ({
        company_name: clean(item.company_name).slice(0, 160),
        text: clean(item.text).slice(0, MAX_TEXT),
        prospect_id: clean(item?.prospect_id),
      }));

    if (!prospect_list_id) {
      return Response.json({ error: 'prospect_list_id is required.' }, { status: 400 });
    }
    if (!sections.length) {
      return Response.json({ error: 'No account sections were supplied.' }, { status: 400 });
    }

    const list = await base44.asServiceRole.entities.ProspectList
      .get(prospect_list_id)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!list || list.organisation_id !== org.id) {
      return Response.json({ error: 'Prospect list not found.' }, { status: 404 });
    }

    const prospects = await base44.asServiceRole.entities.Prospect.filter(
      { list_id: prospect_list_id, organisation_id: org.id }, '-created_date', 500,
    ).catch(() => []);
    if (!prospects.length) {
      return Response.json({ imported: 0, ambiguous: [], unmatched: [], needs_review: [], results: [] });
    }

    const byId = new Map(prospects.map((prospect) => [prospect.id, prospect]));
    const byName = new Map(prospects.map((prospect) => [normalisedName(prospect.company_name), prospect]));

    const work = [];
    const ambiguous = [];
    const unmatched = [];
    const skipped = [];

    for (const section of sections) {
      const key = normalisedName(section.company_name);
      if (skips.has(key)) {
        skipped.push(section.company_name);
        continue;
      }

      const chosenId = section.prospect_id || resolutions.get(key) || '';
      if (chosenId) {
        const chosen = byId.get(chosenId);
        if (chosen) {
          work.push({ section, prospect: chosen, explicit: true });
          continue;
        }
      }

      const exact = byName.get(key);
      if (exact) {
        work.push({ section, prospect: exact, explicit: false });
        continue;
      }

      const candidates = candidateScores(section.company_name, prospects);
      if (candidates.length) {
        ambiguous.push({ company_name: section.company_name, candidates });
      } else {
        unmatched.push(section.company_name);
      }
    }

    if (!work.length) {
      return Response.json({
        imported: 0,
        ambiguous,
        unmatched,
        needs_review: [],
        skipped,
        results: [],
      });
    }

    await checkAllowance(base44, org, 'ai_action', work.length);

    const extraction = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: buildPrompt(work),
      response_json_schema: RESPONSE_SCHEMA,
    });

    const accounts = Array.isArray(extraction?.accounts) ? extraction.accounts : [];
    const hash = documentHash(document_name);
    const results = [];
    const needsReview = [];

    for (const entry of work) {
      // Name-only matching against the extraction. There is deliberately no
      // positional fallback: a passage the model did not return by name is
      // reported for review instead of being filed against the wrong account.
      const wanted = normalisedName(entry.section.company_name);
      const extracted = accounts.find((item) => normalisedName(item?.company_name) === wanted);
      if (!extracted) {
        needsReview.push({
          company_name: entry.section.company_name,
          prospect_id: entry.prospect.id,
          reason: 'The document passage was not returned for this account, so nothing was filed.',
        });
        continue;
      }

      const findings = normaliseFindings(extracted?.findings, MAX_FINDINGS);
      const targetRoles = (Array.isArray(extracted?.target_roles) ? extracted.target_roles : [])
        .map(clean)
        .filter(Boolean)
        .slice(0, 4);

      const record = {
        organisation_id: org.id,
        prospect_list_id,
        prospect_id: entry.prospect.id,
        company_name: entry.prospect.company_name,
        prompt: `Imported research: ${document_name}`,
        prompt_hash: hash,
        summary: clean(extracted?.summary).slice(0, 800)
          || `${entry.prospect.company_name} — research imported from ${document_name}.`,
        findings,
        target_roles: targetRoles,
        source_count: new Set(findings.map((item) => item.source_url).filter(Boolean)).size,
        status: 'complete',
        error_summary: '',
        created_by_user_id: user.id,
        researched_at: new Date().toISOString(),
      };

      const existing = await base44.asServiceRole.entities.AccountResearch.filter(
        { prospect_id: entry.prospect.id, prompt_hash: hash, organisation_id: org.id }, '-created_date', 1,
      ).catch(() => []);

      const saved = existing?.[0]
        ? await base44.asServiceRole.entities.AccountResearch.update(existing[0].id, record)
        : await base44.asServiceRole.entities.AccountResearch.create(record);

      results.push({
        prospect_id: entry.prospect.id,
        company_name: entry.prospect.company_name,
        research_id: saved?.id || '',
        findings: findings.length,
        matched_explicitly: entry.explicit,
      });
    }

    if (results.length) {
      await recordUsage(base44, {
        organisation_id: org.id,
        user_id: user.id,
        target_list_id: prospect_list_id,
        event_type: 'ai_action',
        provider: 'ai_web',
        quantity: results.length,
        estimated_cost: results.length,
        actual_cost: results.length,
        source_function: 'importResearchDocument',
      });
    }

    return Response.json({
      imported: results.length,
      ambiguous,
      unmatched,
      needs_review: needsReview,
      skipped,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}