import { resolveTenant } from '../../shared/tenantAuth.ts';
import { assertProviderAccess } from '../../shared/providerAccess.ts';
import { clean } from '../../shared/researchFindings.ts';

function normalised(name) {
  return clean(name).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Makes any campaign researchable in one step: links (or creates) the campaign's
// research list and copies in the campaign's companies as accounts, without
// duplicating accounts that are already there. Idempotent, so it is safe to run
// again for a campaign that already has a workspace.
export default async function (req) {
  try {
    const { base44, user, org, profile } = await resolveTenant(req);
    assertProviderAccess(profile);

    const body = await req.json().catch(() => ({}));
    const campaign_id = clean(body?.campaign_id);
    if (!campaign_id) return Response.json({ error: 'campaign_id is required.' }, { status: 400 });

    const campaign = await base44.asServiceRole.entities.Campaign
      .get(campaign_id)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!campaign || campaign.organisation_id !== org.id) {
      return Response.json({ error: 'Campaign not found.' }, { status: 404 });
    }

    const existingLists = await base44.asServiceRole.entities.ProspectList.filter(
      { campaign_id, organisation_id: org.id }, '-created_date', 1,
    ).catch(() => []);

    let list = existingLists?.[0] || null;
    if (!list) {
      const brief = [
        campaign.objective && `Objective\n${campaign.objective}`,
        campaign.offer && `Offer\n${campaign.offer}`,
        campaign.target_profile && `Target profile\n${campaign.target_profile}`,
        campaign.industry_focus && `Industry focus\n${campaign.industry_focus}`,
      ].filter(Boolean).join('\n\n') || campaign.name;
      list = await base44.asServiceRole.entities.ProspectList.create({
        name: campaign.name,
        campaign_id,
        brief,
        icp: campaign.icp || campaign.target_profile || '',
        status: 'draft',
        company_count: 0,
        permitted_countries: ['GB'],
        organisation_id: org.id,
        owner_user_id: user.id,
      });
    }

    const existingProspects = await base44.asServiceRole.entities.Prospect.filter(
      { list_id: list.id, organisation_id: org.id }, '-created_date', 500,
    ).catch(() => []);
    const have = new Set(existingProspects.map((prospect) => normalised(prospect.company_name)));

    const members = await base44.asServiceRole.entities.TargetListMember.filter(
      { target_list_id: campaign_id, organisation_id: org.id }, '-created_date', 500,
    ).catch(() => []);
    const companyIds = [...new Set(members.map((member) => member.company_id).filter(Boolean))];

    const companies = companyIds.length
      ? await base44.asServiceRole.entities.Company.filter(
        { organisation_id: org.id, id: { $in: companyIds } }, '-created_date', 500,
      ).catch(() => [])
      : [];

    const missing = companies.filter((company) => company.name && !have.has(normalised(company.name)));

    if (missing.length) {
      await base44.asServiceRole.entities.Prospect.bulkCreate(
        missing.map((company) => ({
          list_id: list.id,
          company_name: company.name,
          domain: company.domain || '',
          website: company.website || '',
          industry: company.industry || '',
          employee_range: company.employee_range || '',
          location: company.location || '',
          enrichment_status: 'pending',
          fit_score: 0,
          pushed: false,
          source: 'campaign',
          organisation_id: org.id,
        })),
      );
    }

    return Response.json({
      prospect_list_id: list.id,
      created_prospects: missing.length,
      total_accounts: existingProspects.length + missing.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}