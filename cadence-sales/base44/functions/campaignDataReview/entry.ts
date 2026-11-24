import { resolveTenant } from '../../shared/tenantAuth.ts';
import { CAPABILITIES, can } from '../../shared/capabilities.ts';
import { loadCampaignDataset, clean } from '../../shared/campaignDataset.ts';
import { reviewQueue, readiness } from '../../shared/campaignReviewModel.ts';
import { recordCampaignDecision } from '../../shared/campaignReviewWrite.ts';
import { saveCampaignBrief, briefDetails } from '../../shared/campaignBrief.ts';
export default async function(req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    const body = await req.json().catch(()=>({})), action = body.action || 'readiness';
    const campaignId = clean(body.campaign_id);
    if (!campaignId) return Response.json({error:'campaign_id is required'},{status:400});
    const manager = can(profile,CAPABILITIES.campaigns);
    if (!manager && action !== 'request_research') return Response.json({error:'Only campaign managers may inspect or change unrestricted campaign data.'},{status:403});
    if (!manager) {
      if (!can(profile,CAPABILITIES.research_request)) return Response.json({error:'Research requests are not permitted.'},{status:403});
      const assigned = await base44.asServiceRole.entities.CampaignAssignment.count({organisation_id:org.id,campaign_id:campaignId,assigned_user_id:user.id});
      if (!assigned) return Response.json({error:'This campaign is not assigned to you.'},{status:403});
    }
    const data = await loadCampaignDataset(base44,org,campaignId);
    if (action==='details') return Response.json(briefDetails(data));
    if (action==='save_details') return Response.json(await saveCampaignBrief(base44,data,body));
    if (action==='queue') {
      const all=reviewQueue(data), status=clean(body.status) || 'unresolved';
      const filtered=all.filter(x=>status==='all' || (status==='unresolved'?['pending','clarification_requested'].includes(x.status):x.status===status));
      const offset=Math.max(0,Number(body.offset)||0), items=filtered.slice(offset,offset+25);
      return Response.json({items,total_items:filtered.length,has_more:offset+25<filtered.length,next_offset:offset+25,list_id:data.lists[0]?.id,can_enrich:can(profile,CAPABILITIES.providers)});
    }
    if (action==='resolve') {
      const item=reviewQueue(data).find(x=>x.key===body.item?.key);
      if(!item) return Response.json({error:'This review item no longer exists on this campaign.'},{status:404});
      return Response.json(await recordCampaignDecision(base44,org,user,data,item,body));
    }
    if (action==='request_research') {
      const ids=Array.isArray(body.prospect_ids)?[...new Set(body.prospect_ids)].slice(0,50):[];
      if(!ids.length || ids.some(id=>!data.prospects.some(p=>p.id===id))) return Response.json({error:'Select records belonging to this campaign.'},{status:400});
      if(!manager) {
        const assignments=await base44.asServiceRole.entities.CampaignAssignment.filter({organisation_id:org.id,campaign_id:campaignId,assigned_user_id:user.id},'-created_date',500);
        const allowed=new Set(assignments.map(a=>a.company_id));
        if(ids.some(id=>!data.companies.some(c=>allowed.has(c.id) && c.name===data.prospects.find(p=>p.id===id)?.company_name))) return Response.json({error:'Only assigned companies may be requested.'},{status:403});
      }
      await base44.asServiceRole.entities.ReviewItem.bulkCreate(ids.map(id=>({organisation_id:org.id,campaign_id:campaignId,prospect_id:id,reason:'employment_unconfirmed',field_name:'research_request',review_action:'request_research',review_notes:clean(body.notes) || 'Caller research requested.',status:'clarification_requested',created_by_user_id:user.id,created_at:new Date().toISOString()})));
      return Response.json({ok:true,recorded:ids.length,message:'Research request recorded for a manager. No provider or AI calls were made.'});
    }
    const result=readiness(data);
    if(action==='records') {
      const bucket=clean(body.bucket)||'target_companies', q=clean(body.search).toLowerCase();
      const rows=result.records.filter(p=>p.readiness[bucket] && (!q || JSON.stringify([p.company_name,p.full_name,p.email,p.generic_email,p.contacts]).toLowerCase().includes(q)));
      const offset=Math.max(0,Number(body.offset)||0);
      return Response.json({items:rows.slice(offset,offset+25),total:rows.length,has_more:offset+25<rows.length,next_offset:offset+25,list_id:data.lists[0]?.id,can_enrich:can(profile,CAPABILITIES.providers)});
    }
    if(action==='readiness') return Response.json({buckets:result.buckets,totals:Object.fromEntries(result.buckets.map(b=>[b.key,b.count])),prospects_loaded:data.prospects.length,list_id:data.lists[0]?.id});
    return Response.json({error:'Unknown action'},{status:400});
  } catch(error) { console.error('Campaign review failed',error.message,error.data || error.response?.data || ''); return Response.json({error:error.message},{status:error.status || 500}); }
}