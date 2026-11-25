import { resolveTenant } from '../../shared/tenantAuth.ts';
import { can, CAPABILITIES } from '../../shared/capabilities.ts';
import { loadCampaignDataset, allRecords, clean } from '../../shared/campaignDataset.ts';
import { buildCampaignExport } from '../../shared/campaignExport.ts';
export default async function(req) {
  try {
    const { base44, profile, org } = await resolveTenant(req);
    if (!can(profile, CAPABILITIES.export)) return Response.json({ error: 'Your role cannot export campaign data.' }, { status: 403 });
    const body = await req.json().catch(()=>({}));
    const data = await loadCampaignDataset(base44, org, clean(body.campaign_id), clean(body.list_id));
    const E = base44.asServiceRole.entities;
    const [calls, tasks] = data.campaign.id ? await Promise.all([
      allRecords(E.CallLog,{ organisation_id: org.id, campaign_id: data.campaign.id }),
      allRecords(E.Task,{ organisation_id: org.id, target_list_id: data.campaign.id }),
    ]) : [[],[]];
    const result = buildCampaignExport(data,{calls,tasks});
    return Response.json({ ...result, rows: undefined, filename: `${(data.campaign.name || data.lists[0]?.name || 'prospects').replace(/[^a-z0-9_-]+/gi,'-')}.csv`, organisation_id: org.id, campaign_id: data.campaign.id || '', prospect_ids: data.prospects.map(p=>p.id) });
  } catch(error) { console.error('Campaign export failed',error.message,error.data || error.response?.data || ''); return Response.json({ error: error.message },{ status: error.status || 500 }); }
}