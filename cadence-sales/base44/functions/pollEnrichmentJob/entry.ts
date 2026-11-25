import { resolveTenant } from '../../shared/tenantAuth.ts';
// fullenrich phone-only limited credits
// people-v3 waterfall + search-improve bundle
import { assertProviderAccess, canUseProviders } from '../../shared/providerAccess.ts';
import { processSessionBatch } from '../../shared/sessionProcessing.ts';
export default async function(req) {
  try {
    const {base44,user,profile,org}=await resolveTenant(req);
    assertProviderAccess(profile);
    const {session_id}=await req.json().catch(()=>({}));
    if(!session_id) return Response.json({error:'session_id required'},{status:400});
    const E=base44.asServiceRole.entities;
    const session=await E.EnrichmentSession.get(session_id).catch(e=>e.status===404?null:Promise.reject(e));
    if(!session || session.organisation_id!==org.id) return Response.json({error:'Session not found.'},{status:404});
    const creators=await E.UserProfile.filter({user_id:session.created_by_user_id,organisation_id:org.id},'-created_date',2);
    if(creators.length!==1 || creators[0].status!=='active' || !canUseProviders(creators[0])) return Response.json({error:'The session creator no longer has provider permission.'},{status:403});
    const list=await E.ProspectList.get(session.prospect_list_id).catch(e=>e.status===404?null:Promise.reject(e));
    if(!list || list.organisation_id!==org.id) return Response.json({error:'Prospect list not found.'},{status:404});
    if(!['processing','queued'].includes(session.status) || session.spending_paused) return Response.json({...session,session_id:session.id});
    if(session.processing_count>0 && Date.now()-new Date(session.last_activity_at).getTime()<120000) return Response.json({...session,session_id:session.id});
    const items=(session.items || []).map(i=>i.status==='processing'?{...i,status:'pending'}:i);
    const batch=items.filter(i=>i.status==='pending').slice(0,2);
    for(const item of batch)item.status='processing';
    await E.EnrichmentSession.update(session.id,{items,processing_count:batch.length,last_activity_at:new Date().toISOString()});
    const result=await processSessionBatch(base44,session,batch,items,{batchSize:2,timeoutMs:90000,isBackgroundWorker:true});
    const patch={items:result.items,status:result.spendingPaused?'paused':result.finalStatus,queued_count:result.stillPending,processing_count:0,completed_count:result.completedCount,partial_count:result.partialCount,failed_count:result.failedCount,provider_calls_made:result.providerCallsMade,smart_actions_consumed:result.smartActionsConsumed,external_provider_requests:result.externalProviderRequests,pattern_inferred_count:result.patternInferredCount,spending_paused:result.spendingPaused,spending_pause_reason:result.spendingPauseReason,last_activity_at:new Date().toISOString(),completed_at:result.stillPending?null:new Date().toISOString()};
    await E.EnrichmentSession.update(session.id,patch);
    return Response.json({...session,...patch,session_id:session.id,id:session.id,message:result.message});
  } catch(error){return Response.json({error:error.message},{status:error.status || 500});}
}