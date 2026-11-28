import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertListOwned } from '../../shared/ownership.ts';

// Assigns / splits campaign companies across callers.
// Methods: manual, even_distribution, round_robin, by_territory, by_industry, ai_instructed.
// Creates or updates CampaignAssignment records within the organisation only.

const WRITE_CHUNK = 100;

function chunks<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function normaliseCompanyName(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(ltd|limited|plc|llp|inc|the|group|holdings|uk|co)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');
}

const UK_TERRITORIES = [
  { id: 'northwest', match: /\b(north\s*west|manchester|liverpool|lancashire|cheshire|cumbria|merseyside|preston|blackpool|bolton|wigan)\b/i },
  { id: 'northeast', match: /\b(north\s*east|newcastle|durham|tyne|teesside|sunderland|middlesbrough)\b/i },
  { id: 'yorkshire', match: /\b(yorkshire|humber|leeds|sheffield|bradford|hull|york|wakefield)\b/i },
  { id: 'midlands', match: /\b(midlands|birmingham|nottingham|leicester|derby|coventry|stoke|wolverhampton)\b/i },
  { id: 'southeast', match: /\b(south\s*east|london|surrey|kent|sussex|essex|hampshire|berkshire|buckingham|oxford|reading|brighton|southampton)\b/i },
  { id: 'southwest', match: /\b(south\s*west|bristol|cornwall|devon|somerset|dorset|wiltshire|gloucester|plymouth|exeter)\b/i },
  { id: 'scotland', match: /\b(scotland|glasgow|edinburgh|aberdeen|dundee)\b/i },
  { id: 'wales', match: /\b(wales|cardiff|swansea|newport)\b/i },
  { id: 'northern_ireland', match: /\b(northern\s*ireland|belfast|antrim)\b/i },
];

function classifyTerritory(location = '') {
  const text = String(location || '');
  for (const territory of UK_TERRITORIES) {
    if (territory.match.test(text)) return territory.id;
  }
  return 'unknown';
}

function industryKey(value = '') {
  const text = String(value || '').trim();
  if (!text) return 'unspecified';
  return text.split(/[>|/•]/)[0].trim().toLowerCase() || 'unspecified';
}

async function resolveCampaignCompanies(base44: any, org: any, campaignId: string) {
  const svc = base44.asServiceRole.entities;
  const [assignments, members, lists] = await Promise.all([
    svc.CampaignAssignment.filter({ organisation_id: org.id, campaign_id: campaignId }, '-created_date', 2000).catch(() => []),
    svc.TargetListMember.filter({ organisation_id: org.id, target_list_id: campaignId }, '-created_date', 2000).catch(() => []),
    svc.ProspectList.filter({ organisation_id: org.id, campaign_id: campaignId }, '-created_date', 20).catch(() => []),
  ]);

  const companyIds = new Set<string>();
  for (const row of assignments || []) if (row.company_id) companyIds.add(row.company_id);
  for (const row of members || []) if (row.company_id) companyIds.add(row.company_id);

  // Prospects on linked lists — ensure seed imports can be split even before a push.
  for (const list of lists || []) {
    const prospects = await svc.Prospect.filter({ list_id: list.id }, '-created_date', 2000).catch(() => []);
    for (const prospect of prospects || []) {
      if (!prospect.company_name) continue;
      const domain = String(prospect.domain || '').trim().toLowerCase();
      const or: any[] = [{ name: { $regex: `^${String(prospect.company_name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }];
      if (domain) or.push({ domain: { $regex: `^${domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
      const matches = await svc.Company.filter({ organisation_id: org.id, $or: or }, '-created_date', 5).catch(() => []);
      let company = matches?.[0];
      if (!company) {
        company = await svc.Company.create({
          name: prospect.company_name,
          domain: prospect.domain || '',
          website: prospect.website || '',
          industry: prospect.industry || '',
          location: prospect.location || '',
          organisation_id: org.id,
          owner_user_id: prospect.owner_user_id || '',
          data_source: 'split_seed',
        }).catch(() => null);
      }
      if (company?.id) companyIds.add(company.id);
    }
  }

  const companies = [];
  const idList = [...companyIds];
  for (let i = 0; i < idList.length; i += 50) {
    const slice = idList.slice(i, i + 50);
    const rows = await Promise.all(slice.map((id) => svc.Company.get(id).catch(() => null)));
    for (const company of rows) {
      if (company && company.organisation_id === org.id) companies.push(company);
    }
  }
  return { companies, assignments: assignments || [] };
}

function buildPiles(method: string, companies: any[], userIds: string[], body: any) {
  if (method === 'even_distribution' || method === 'round_robin') {
    const piles = userIds.map((userId) => ({ userId, companyIds: [] as string[] }));
    companies.forEach((company, index) => {
      piles[index % piles.length].companyIds.push(company.id);
    });
    return piles;
  }

  if (method === 'by_industry') {
    const buckets = new Map<string, string[]>();
    for (const company of companies) {
      const key = industryKey(company.industry);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(company.id);
    }
    const piles = userIds.map((userId) => ({ userId, companyIds: [] as string[] }));
    [...buckets.values()].forEach((ids, index) => {
      piles[index % piles.length].companyIds.push(...ids);
    });
    return piles;
  }

  if (method === 'by_territory') {
    const territoryMap: Array<{ userId: string; territories: string[] }> = Array.isArray(body.territory_map)
      ? body.territory_map.map((row: any) => ({
          userId: row.userId || row.user_id,
          territories: Array.isArray(row.territories) ? row.territories : [],
        }))
      : [];

    if (territoryMap.length && territoryMap.some((row) => row.territories.length)) {
      const piles = territoryMap
        .filter((row) => userIds.includes(row.userId))
        .map((row) => ({ userId: row.userId, companyIds: [] as string[], territories: row.territories }));
      const claimed = new Set<string>();
      for (const company of companies) {
        const territory = classifyTerritory(company.location || company.territory || '');
        const pile = piles.find((row) => row.territories.includes(territory));
        if (pile) {
          pile.companyIds.push(company.id);
          claimed.add(company.id);
        }
      }
      const leftovers = companies.filter((c) => !claimed.has(c.id));
      leftovers.forEach((company, index) => {
        if (!piles.length) return;
        piles[index % piles.length].companyIds.push(company.id);
      });
      return piles;
    }

    // Auto: keep territories together, round-robin buckets across callers.
    const buckets = new Map<string, string[]>();
    for (const company of companies) {
      const key = classifyTerritory(company.location || company.territory || '');
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(company.id);
    }
    const piles = userIds.map((userId) => ({ userId, companyIds: [] as string[] }));
    [...buckets.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([, ids], index) => {
        piles[index % piles.length].companyIds.push(...ids);
      });
    return piles;
  }

  return null;
}

export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (!['platform_owner', 'organisation_admin', 'sales_manager'].includes(profile.app_role)) {
      return Response.json({ error: 'Only managers can assign companies' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      campaign_id,
      method,
      company_ids,
      user_ids,
      manual_assignments,
      instruction,
      reassign_existing = true,
    } = body;
    if (!campaign_id) return Response.json({ error: 'campaign_id required' }, { status: 400 });
    if (!method) {
      return Response.json({
        error: 'method required (manual, even_distribution, round_robin, by_territory, by_industry, ai_instructed)',
      }, { status: 400 });
    }

    const campaign = await assertListOwned(base44, org, campaign_id);
    if (!user_ids || user_ids.length === 0) {
      return Response.json({ error: 'At least one caller must be selected' }, { status: 400 });
    }

    const userProfiles = await base44.asServiceRole.entities.UserProfile.filter(
      { organisation_id: org.id }, '-created_date', 100,
    ).catch(() => []);

    const validUserIds = userProfiles
      .filter((p) => user_ids.includes(p.user_id) && p.status === 'active')
      .map((p) => p.user_id);

    if (validUserIds.length === 0) {
      return Response.json({ error: 'No active callers selected' }, { status: 400 });
    }

    const { companies: resolvedCompanies, assignments: existingAssignments } =
      await resolveCampaignCompanies(base44, org, campaign_id);

    let workingCompanies = resolvedCompanies;
    if (Array.isArray(company_ids) && company_ids.length) {
      const want = new Set(company_ids);
      workingCompanies = resolvedCompanies.filter((c) => want.has(c.id));
    }
    if (!workingCompanies.length) {
      return Response.json({
        error: 'No companies found on this campaign to split. Import or add accounts first.',
      }, { status: 400 });
    }

    const existingByCompany = new Map(
      (existingAssignments || []).map((a: any) => [a.company_id, a]),
    );
    const now = new Date().toISOString();
    let pairs: Array<{ company_id: string; user_id: string }> = [];

    if (method === 'manual' || method === 'ai_instructed') {
      if (Array.isArray(manual_assignments) && manual_assignments.length) {
        pairs = manual_assignments
          .filter((row: any) => row.company_id && validUserIds.includes(row.user_id))
          .map((row: any) => ({ company_id: row.company_id, user_id: row.user_id }));
      } else if (method === 'ai_instructed' && instruction) {
        // Ask Base44 intelligence to propose a split, then apply deterministically.
        const roster = userProfiles
          .filter((p) => validUserIds.includes(p.user_id))
          .map((p) => ({ user_id: p.user_id, name: p.full_name || p.email || p.user_id }));
        const sample = workingCompanies.slice(0, 400).map((c) => ({
          id: c.id,
          name: c.name,
          industry: c.industry || '',
          location: c.location || '',
        }));
        const ai = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You split B2B campaign accounts between callers for a UK sales team.
Instruction from the manager:
${String(instruction).slice(0, 2000)}

Callers (use these exact user_id values):
${JSON.stringify(roster)}

Accounts:
${JSON.stringify(sample)}

Return JSON { assignments: [{ company_id, user_id }] }.
Every company_id must appear exactly once. Only use the provided user_id values.
Prefer the manager's instruction (territories, industries, 50/50, named people).`,
          response_json_schema: {
            type: 'object',
            properties: {
              assignments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    company_id: { type: 'string' },
                    user_id: { type: 'string' },
                  },
                },
              },
            },
          },
        }).catch(() => null);

        const proposed = ai?.assignments || ai?.data?.assignments || [];
        const validCompany = new Set(workingCompanies.map((c) => c.id));
        pairs = (proposed || [])
          .filter((row: any) => validCompany.has(row.company_id) && validUserIds.includes(row.user_id))
          .map((row: any) => ({ company_id: row.company_id, user_id: row.user_id }));

        // Fill any companies the model skipped evenly.
        const covered = new Set(pairs.map((row) => row.company_id));
        const missing = workingCompanies.filter((c) => !covered.has(c.id));
        missing.forEach((company, index) => {
          pairs.push({ company_id: company.id, user_id: validUserIds[index % validUserIds.length] });
        });
      } else {
        return Response.json({ error: 'manual_assignments or instruction required' }, { status: 400 });
      }
    } else {
      const piles = buildPiles(method, workingCompanies, validUserIds, body);
      if (!piles) return Response.json({ error: `Unknown method: ${method}` }, { status: 400 });
      for (const pile of piles) {
        for (const companyId of pile.companyIds) {
          pairs.push({ company_id: companyId, user_id: pile.userId });
        }
      }
    }

    const toCreate: any[] = [];
    const toUpdate: any[] = [];
    const seen = new Set<string>();

    for (const pair of pairs) {
      if (seen.has(pair.company_id)) continue;
      seen.add(pair.company_id);
      const existing = existingByCompany.get(pair.company_id);
      if (!existing) {
        toCreate.push({
          organisation_id: org.id,
          campaign_id,
          company_id: pair.company_id,
          assigned_user_id: pair.user_id,
          assigned_by_user_id: user.id,
          status: 'assigned',
          assignment_method: method,
          assigned_at: now,
          priority: 'normal',
          lock_version: 1,
        });
        continue;
      }
      if (['completed', 'removed', 'suppressed'].includes(existing.status)) continue;
      if (!reassign_existing && existing.assigned_user_id) continue;
      if (existing.assigned_user_id === pair.user_id && existing.status === 'assigned') continue;
      toUpdate.push({
        id: existing.id,
        assigned_user_id: pair.user_id,
        assigned_by_user_id: user.id,
        assignment_method: method === 'ai_instructed' ? 'ai_instructed' : method,
        reassignment_reason: `Split via ${method} by ${profile.full_name || user.email || 'manager'}`,
        status: 'assigned',
        lock_version: (existing.lock_version || 1) + 1,
        locked_by_user_id: '',
        locked_at: '',
        assigned_at: now,
      });
    }

    for (const part of chunks(toCreate, WRITE_CHUNK)) {
      await base44.asServiceRole.entities.CampaignAssignment.bulkCreate(part);
    }
    for (const part of chunks(toUpdate, WRITE_CHUNK)) {
      await base44.asServiceRole.entities.CampaignAssignment.bulkUpdate(part);
    }

    const allAssignedUsers = [...new Set([
      ...(campaign.assigned_user_ids || []),
      ...validUserIds,
    ])];
    await base44.asServiceRole.entities.Campaign.update(campaign_id, {
      assigned_user_ids: allAssignedUsers,
    });

    const perUser: Record<string, number> = {};
    for (const pair of pairs) {
      if (!seen.has(pair.company_id)) continue;
      perUser[pair.user_id] = (perUser[pair.user_id] || 0) + 1;
    }
    // recount unique
    const uniquePairs = [...seen].map((companyId) => pairs.find((p) => p.company_id === companyId)!);
    const counts: Record<string, number> = {};
    for (const pair of uniquePairs) counts[pair.user_id] = (counts[pair.user_id] || 0) + 1;

    return Response.json({
      created: toCreate.length,
      updated: toUpdate.length,
      total: uniquePairs.length,
      method,
      per_user: counts,
      assignments: uniquePairs.slice(0, 50),
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
