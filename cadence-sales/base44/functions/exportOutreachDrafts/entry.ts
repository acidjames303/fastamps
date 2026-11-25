import {resolveTenant} from '../../shared/tenantAuth.ts';
import {companyMatchToken,hasUnresolvedCompanyFlag} from '../../shared/outreachIdentity.ts';

// Private, authenticated, owner-only draft export. NO mailbox send.
const allowed=['platform_owner','organisation_admin','sales_manager','internal_bd','bdm'];
const defaults=['fastamps','b2bsalesleads','acidjames','other'];
const PAGE_SIZE=100;
export default async function(req:Request){
  try{
    const {base44,user,org,profile}=await resolveTenant(req);
    if(!allowed.includes(profile.app_role)){
      return Response.json({error:'Not authorised for Outreach.'},{status:403});
    }
    const body:any=await req.json().catch(()=>({}));
    const brand=String(body.brand_key||'').trim();
    const page=Number(body.page||0);
    if(!Number.isInteger(page)||page<0||page>200 || !/^[a-z0-9_]{1,70}$/.test(brand)){
      return Response.json({error:'Invalid page or workspace.'},{status:400});
    }
    const svc=base44.asServiceRole.entities;
    const scope={organisation_id:org.id,owner_user_id:user.id};
    if(!defaults.includes(brand)){
      const custom=await svc.OutreachWorkspace.filter({...scope,brand_key:brand},'-created_at',1);
      if(!custom?.length||custom[0].is_archived)return Response.json({error:'Workspace not found.'},{status:404});
    }
    const drafts=await svc.OutreachDraft.filter({...scope,brand_key:brand},'-updated_at',PAGE_SIZE,page*PAGE_SIZE);
    const signatures=await svc.OutreachSignature.filter(scope,'-updated_at',100);
    const leadIds=[...new Set((drafts||[]).map((d:any)=>d.source_lead_id).filter(Boolean))];
    const relatedLeads=leadIds.length?await svc.OutreachLead.filter({...scope,id:{$in:leadIds}},'-created_at',100):[];
    const leadMap=new Map((relatedLeads||[]).map((l:any)=>[l.id,l]));
    const matchTokens=[...new Set((relatedLeads||[]).map((l:any)=>
      l.company_match_token||companyMatchToken(l.company_name)).filter(Boolean))];
    const flagged=matchTokens.length?await svc.OutreachLead.filter({
      ...scope,company_match_token:{$in:matchTokens},review_status:'flagged_company'
    },'-updated_at',500):[];
    const flagOverflow=(flagged||[]).length===500;
    const senderWorkspaces=await svc.OutreachWorkspace.filter({...scope,brand_key:brand},'-created_at',1);
    const sigById=new Map((signatures||[]).map((s:any)=>[s.id,s]));
    const senderAddress=String(senderWorkspaces?.[0]?.sender_address||'').slice(0,320);
    const safe=(drafts||[]).map((d:any)=>{
      const sig=sigById.get(d.signature_id);
      const linked=d.source_lead_id?leadMap.get(d.source_lead_id):null;
      const blocked=d.identity_warning||
        (d.source_lead_id&&(!linked||linked.review_status!=='approved'||
          hasUnresolvedCompanyFlag(linked,flagged,flagOverflow))?
          'The source contact or company identity is disputed or no longer approved; this draft cannot be prepared for external sending.':'');
      return {
        id:d.id,
        owner_user_id:user.id,
        brand_key:brand,
        recipient_to:d.recipient_to||'',
        recipient_cc:d.recipient_cc||'',
        recipient_bcc:d.recipient_bcc||'',
        subject:d.subject||'',
        body_text:d.body_text||'',
        quoted_text:d.quoted_text||'',
        signature_text:sig?.brand_key===brand?sig.signature_text||'':'',
        sender_address:senderAddress,
        status:d.status||'draft',
        scheduled_at:d.scheduled_at||'',
        delivery_lock:d.delivery_lock||'held',
        identity_warning:blocked||'',
      };
    });
    return Response.json({ok:true,page,has_more:safe.length===PAGE_SIZE,drafts:safe});
  }catch(e:any){return Response.json({error:String(e.message||'Export unavailable').slice(0,240)},{status:e.status||500});}
}
