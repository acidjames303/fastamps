import { resolveTenant } from '../../shared/tenantAuth.ts';

// Live contact counts per campaign for the Campaigns list.
// A campaign's contacts are the people at its member companies (TargetListMember
// holds companies, not people) plus anyone linked to the campaign directly, so
// the stored tally on the campaign record is not a reliable source.
const MAX_ROWS = 6000;

async function readAll(fetchPage: (opts: any) => Promise<any>) {
  const rows: any[] = [];
  let cursor: string | undefined;
  while (rows.length < MAX_ROWS) {
    const page = await fetchPage({ limit: 500, cursor });
    const items = page?.items || [];
    rows.push(...items);
    if (!page?.has_more || !page?.next_cursor || !items.length) break;
    cursor = page.next_cursor;
  }
  return rows;
}

export default async function (req) {
  try {
    const { base44, membership } = await resolveTenant(req);
    const svc = base44.asServiceRole.entities;
    const orgId = membership.organisation_id;

    const [members, contacts, prospectLists, prospects] = await Promise.all([
      readAll((opts) => svc.TargetListMember.filter({ organisation_id: orgId }, opts)),
      readAll((opts) => svc.Contact.filter({ organisation_id: orgId }, opts)),
      readAll((opts) => svc.ProspectList.filter({ organisation_id: orgId }, opts)),
      readAll((opts) => svc.Prospect.filter({ organisation_id: orgId }, opts)),
    ]);

    // company -> the campaigns that include it
    const campaignsByCompany = new Map<string, Set<string>>();
    const companiesByCampaign = new Map<string, Set<string>>();
    for (const m of members) {
      if (!m.target_list_id || !m.company_id) continue;
      if (!campaignsByCompany.has(m.company_id)) campaignsByCompany.set(m.company_id, new Set());
      campaignsByCompany.get(m.company_id)!.add(m.target_list_id);
      if (!companiesByCampaign.has(m.target_list_id)) companiesByCampaign.set(m.target_list_id, new Set());
      companiesByCampaign.get(m.target_list_id)!.add(m.company_id);
    }

    // Deduplicate by contact so a person is counted once per campaign.
    const seen = new Map<string, Set<string>>();
    const add = (campaignId: string, contactId: string) => {
      if (!campaignId || !contactId) return;
      if (!seen.has(campaignId)) seen.set(campaignId, new Set());
      seen.get(campaignId)!.add(contactId);
    };

    for (const c of contacts) {
      if (c.campaign_id) add(c.campaign_id, c.id);
      for (const campaignId of campaignsByCompany.get(c.company_id) || []) add(campaignId, c.id);
    }

    const counts: Record<string, number> = {};
    for (const [campaignId, ids] of seen) counts[campaignId] = ids.size;

    const companies: Record<string, number> = {};
    for (const [campaignId, ids] of companiesByCampaign) companies[campaignId] = ids.size;

    // Preserve visibility of every imported/researched prospect row separately
    // from the unique company count used by calling and assignments.
    const campaignByProspectList = new Map<string, string>();
    for (const list of prospectLists) {
      if (list.id && list.campaign_id) campaignByProspectList.set(list.id, list.campaign_id);
    }

    const prospectRows: Record<string, number> = {};
    for (const prospect of prospects) {
      const campaignId = campaignByProspectList.get(prospect.list_id);
      if (!campaignId) continue;
      prospectRows[campaignId] = (prospectRows[campaignId] || 0) + 1;
    }

    return Response.json({ counts, companies, prospect_rows: prospectRows });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}