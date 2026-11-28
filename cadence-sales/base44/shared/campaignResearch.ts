// One account's web research, shared by the prompt-driven research function and
// the bulk campaign research run so both produce identical, sourced records.
//
// Evidence discipline: only published findings are recorded here. Anything the
// customer confirms is toggled separately by the team, never claimed by the model.
import { secrets } from 'base44:runtime';
import { checkAllowance, recordUsage } from './costControl.ts';
import { clean, normaliseFindings, promptHash } from './researchFindings.ts';

// Gemini is the default because it is the only model family with internet
// context on the Core integration. OpenAI web search is opt-in and falls back.
const GEMINI_MODEL = 'gemini_3_flash';
const OPENAI_MODEL = 'gpt-4.1-mini';
const OPENAI_TIMEOUT_MS = 90000;
export const MAX_FINDINGS = 16;

export const RESEARCH_PROVIDERS = ['gemini', 'openai_web'];

export function normaliseProvider(value) {
  return RESEARCH_PROVIDERS.includes(value) ? value : 'gemini';
}

export function researchInstructionPrompt({ prompt, context, prospect }) {
  return `You are a B2B account researcher for a sales team. Apply the team's instruction to one company and record what public sources actually show.

Team instruction:
"""
${prompt}
"""

Company: ${prospect.company_name}${prospect.website ? ` (website: ${prospect.website})` : ''}${prospect.location ? ` — ${prospect.location}` : ''}

Campaign context (for relevance only):
"""
${context || '(none supplied)'}
"""

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
- summary: start with a headline naming the company and the subject reviewed, e.g. "Merton – Telecare Contract Review", then two sentences on what the published record shows and what remains unverified.`;
}

export const FINDINGS_SCHEMA = {
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
};

// OpenAI's structured output requires a closed schema: every property listed in
// `required` and no additional keys.
export const STRICT_FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          value: { type: 'string' },
          source_url: { type: 'string' },
          source_date: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['label', 'value', 'source_url', 'source_date', 'confidence'],
      },
    },
    target_roles: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'findings', 'target_roles'],
};

function responseText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim();
  const parts = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

// Opt-in provider: OpenAI Responses API with live web search. Uses the existing
// Candence_Voice secret; the key never leaves this server-side module.
async function openAiWebResearch(prompt) {
  const apiKey = (secrets.get('Candence_Voice') || '').trim();
  if (!apiKey) throw new Error('OpenAI web research is not configured.');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      tools: [{ type: 'web_search_preview' }],
      input: prompt,
      text: {
        format: {
          type: 'json_schema',
          name: 'account_research',
          schema: STRICT_FINDINGS_SCHEMA,
          strict: true,
        },
      },
    }),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const code = payload?.error?.code || payload?.error?.type || 'unknown';
    console.error('openAiWebResearch: OpenAI error', response.status, code);
    throw new Error(`OpenAI web search failed (${response.status}).`);
  }

  const payload = await response.json().catch(() => ({}));
  const text = responseText(payload);
  if (!text) throw new Error('OpenAI web search returned no content.');
  try {
    return JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
  } catch {
    throw new Error('OpenAI web search returned an unexpected format.');
  }
}

export async function researchAccount({
  base44,
  org,
  user,
  list,
  prospect,
  prompt,
  provider = 'gemini',
  sourceFunction = 'researchAccountsPrompted',
}) {
  await checkAllowance(base44, org, 'ai_action', 1);

  const context = [String(list?.brief || '').slice(0, 800), String(list?.icp || '').slice(0, 800)]
    .filter(Boolean)
    .join('\n\n');
  const fullPrompt = researchInstructionPrompt({ prompt, context, prospect });
  const wanted = normaliseProvider(provider);

  let result = null;
  let providerUsed = 'ai_web';

  if (wanted === 'openai_web') {
    try {
      result = await openAiWebResearch(fullPrompt);
      providerUsed = 'openai_web';
    } catch (error) {
      console.error(
        'researchAccount: OpenAI web search unavailable, falling back to Gemini —',
        error?.message || 'unknown',
      );
      result = null;
    }
  }

  if (!result) {
    result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: GEMINI_MODEL,
      add_context_from_internet: true,
      prompt: fullPrompt,
      response_json_schema: FINDINGS_SCHEMA,
    });
    providerUsed = 'ai_web';
  }

  const findings = normaliseFindings(result?.findings, MAX_FINDINGS);
  const targetRoles = (Array.isArray(result?.target_roles) ? result.target_roles : [])
    .map(clean)
    .filter(Boolean)
    .slice(0, 4);
  const hash = promptHash(prompt);

  const record = {
    organisation_id: org.id,
    prospect_list_id: list.id,
    prospect_id: prospect.id,
    company_name: prospect.company_name,
    prompt,
    prompt_hash: hash,
    summary: clean(result?.summary).slice(0, 800),
    findings,
    target_roles: targetRoles,
    source_count: new Set(findings.map((item) => item.source_url).filter(Boolean)).size,
    status: 'complete',
    error_summary: '',
    created_by_user_id: user.id,
    researched_at: new Date().toISOString(),
  };

  const existing = await base44.asServiceRole.entities.AccountResearch.filter(
    { prospect_id: prospect.id, prompt_hash: hash, organisation_id: org.id },
    '-created_date',
    1,
  ).catch(() => []);

  const saved = existing?.[0]
    ? await base44.asServiceRole.entities.AccountResearch.update(existing[0].id, record)
    : await base44.asServiceRole.entities.AccountResearch.create(record);

  await recordUsage(base44, {
    organisation_id: org.id,
    user_id: user.id,
    target_list_id: list.id,
    event_type: 'ai_action',
    provider: providerUsed,
    quantity: 1,
    estimated_cost: 1,
    actual_cost: 1,
    related_record_id: prospect.id,
    source_function: sourceFunction,
  });

  return {
    research_id: saved?.id || '',
    findings_count: findings.length,
    sources: record.source_count,
    target_roles: targetRoles,
    provider_used: providerUsed,
  };
}