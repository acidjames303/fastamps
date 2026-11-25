import { resolveTenant } from "../../shared/tenantAuth.ts";
import {companyMatchToken,hasUnresolvedCompanyFlag} from "../../shared/outreachIdentity.ts";

// Planning service only. Intentionally has ZERO send, retry, or provider dispatch paths.
// A scheduled_hold is never executable; delivery stays disabled at the platform level.
const roles = ["platform_owner","organisation_admin","sales_manager","internal_bd","bdm"];
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const emailList = (value:unknown)=>String(value||"").split(/[\s,;]+/).map(x=>x.trim().toLowerCase()).filter(Boolean);
const digest = async(value:string)=>{
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,"0")).join("");
};
function snapshot(d:any,sig=""){
  return JSON.stringify({
    sender_user_id:d.owner_user_id,brand_key:d.brand_key,provider:d.provider||"none",
    to:emailList(d.recipient_to),cc:emailList(d.recipient_cc),bcc:emailList(d.recipient_bcc),
    subject:d.subject||"",body_text:d.body_text||"",quoted_text:d.quoted_text||"",
    signature_id:d.signature_id||"",signature_text:sig,
  });
}

export default async function(req:Request){
  try{
    const {base44,user,org,profile}=await resolveTenant(req);
    if(!roles.includes(profile.app_role))return Response.json({error:"Outreach access denied."},{status:403});
    const input:any=await req.json().catch(()=>({}));
    const action=input.action;
    if(!["hold","plan"].includes(action))return Response.json({error:"Unsupported schedule action."},{status:400});
    const ids=Array.isArray(input.drafts)?[...new Set(input.drafts.map((x:any)=>String(x.id||"").slice(0,100)))]:[];
    if(ids.length<1||ids.length>50)return Response.json({error:"Choose 1–50 drafts per operation."},{status:400});
    if(!Array.isArray(input.drafts)||input.drafts.length!==ids.length)return Response.json({error:"Duplicate draft identifiers are not allowed."},{status:400});
    const svc=base44.asServiceRole.entities;
    const scope={organisation_id:org.id,owner_user_id:user.id};
    const all=await svc.OutreachDraft.filter({...scope,id:{$in:ids}},"-created_at",50);
    if((all||[]).length!==ids.length)return Response.json({error:"A selected draft was not found or is not owned by you."},{status:403});
    const sigIds=[...new Set(all.map((d:any)=>d.signature_id).filter(Boolean))];
    const sigs=sigIds.length ? await svc.OutreachSignature.filter({...scope,id:{$in:sigIds}},"-updated_at",100):[];
    const sigMap=new Map((sigs||[]).map((s:any)=>[s.id,s]));
    let parsed=[];
    if(action==="plan"){
      if(all.some((d:any)=>d.status!=="approved_hold"||d.identity_warning))
        return Response.json({error:"Draft approval is missing or a company identity was flagged. Regenerate the affected draft."},{status:403});
      const linkedIds=[...new Set(all.map((d:any)=>d.source_lead_id).filter(Boolean))];
      if(linkedIds.length){
        const linked=await svc.OutreachLead.filter({...scope,id:{$in:linkedIds}},'-created_at',50);
        if(linked.length!==linkedIds.length||linked.some((v:any)=>v.review_status!=='approved'||v.company_match_status==='ambiguous')){
          return Response.json({error:"A linked company or person has unresolved review flags."},{status:403});
        }
        const tokens=[...new Set(linked.map((l:any)=>l.company_match_token||companyMatchToken(l.company_name)).filter(Boolean))];
        const flagged=tokens.length?await svc.OutreachLead.filter({...scope,
          company_match_token:{$in:tokens},review_status:'flagged_company'
        },'-updated_at',500):[];
        if(linked.some((l:any)=>hasUnresolvedCompanyFlag(l,flagged,flagged.length===500))){
          return Response.json({error:"A newly identified company identity conflict blocks this schedule."},{status:403});
        }
      }
      const emails=[...new Set(all.flatMap((d:any)=>[
        ...emailList(d.recipient_to),...emailList(d.recipient_cc),...emailList(d.recipient_bcc)
      ]))];
      if(!emails.length||emails.some((x:string)=>!EMAIL.test(x)))return Response.json({error:"Invalid recipients."},{status:400});
      const stops=await svc.SuppressionEntry.filter({
        organisation_id:org.id,normalised_email_hash:{$in:await Promise.all(emails.map(digest))},status:"active",
      },"-recorded_at",200);
      if(stops?.length)return Response.json({error:"At least one selected draft is suppressed."},{status:403});
      const now=Date.now();
      for(const item of input.drafts){
        const time=new Date(item.scheduled_at||"");
        if(!Number.isFinite(time.getTime())||time.getTime()<now+60000||time.getTime()>now+365*86400000){
          return Response.json({error:"Every planned time must be between one minute and one year in the future."},{status:400});
        }
        const row=all.find((d:any)=>d.id===item.id);
        const signature=row.signature_id?sigMap.get(row.signature_id):null;
        if(row.signature_id && (!signature||signature.brand_key!==row.brand_key))return Response.json({error:"Signature mismatch."},{status:403});
        const fingerprint=await digest(snapshot(row,signature?.signature_text||""));
        if(row.approval_hash!==fingerprint)return Response.json({error:"Draft content or signature changed since approval; review again."},{status:409});
        parsed.push({id:item.id,time:time.toISOString()});
      }
    }
    const zone=String(input.timezone||"UTC").slice(0,75);
    if(!/^[a-zA-Z0-9_\/+-]{1,75}$/.test(zone))return Response.json({error:"Invalid timezone."},{status:400});
    for(const row of (action==="hold"?all.map((d:any)=>({id:d.id})):parsed)){
      await svc.OutreachDraft.update(row.id,{
        delivery_lock:action==="hold"?"held":"scheduled_hold",
        scheduled_at:action==="hold"?"":row.time,
        schedule_timezone:action==="hold"?"":zone,
        updated_at:new Date().toISOString(),
      });
    }
    return Response.json({ok:true,updated:ids.length,
      delivery_enabled:false,
      message:action==="plan"?"Schedule plan saved on HOLD. No message will be delivered.":"Selected messages are held and will not be delivered."});
  }catch(e:any){return Response.json({error:String(e.message||"Schedule planning failed.").slice(0,300)},{status:e.status||500});}
}
