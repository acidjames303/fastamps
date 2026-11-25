import { clean, key, peopleOf, effectivePeople, genericEmail } from './campaignDataset.ts';
import { classifyUkPhone } from './ukPhone.ts';
import { isPlaceholderName } from './researchEvidence.ts';
export async function recordCampaignDecision(base44, org, user, data, item, body) {
  const E=base44.asServiceRole.entities,decision=clean(body.decision),value=decision==='correct'?clean(body.corrected_value):item.original_value;
  const choices=['accept_org_supplied','correct','reject','attach_source','request_research','leave_unresolved'];
  if(!choices.includes(decision)) throw Object.assign(new Error('Unknown decision.'),{status:400});
  if(decision==='correct' && !value) throw Object.assign(new Error('Enter the corrected value.'),{status:400});
  const source=clean(body.source_url);
  if(decision==='attach_source' && !/^https?:\/\/[^\s]+$/i.test(source)) throw Object.assign(new Error('Enter an http or https evidence URL.'),{status:400});
  if(['accept_org_supplied','correct'].includes(decision) && !clean(body.notes)) throw Object.assign(new Error('Record why this information is being confirmed or corrected.'),{status:400});
  const p=data.prospects.find(p=>p.id===item.prospect_id),person=effectivePeople(p,data.reviews).find(c=>c.index===item.contact_index) || {name:p.full_name,title:p.job_title};
  const accepting=['accept_org_supplied','correct'].includes(decision);
  const classification=item.field==='switchboard'?'switchboard':clean(body.classification);
  const uk=['phone','switchboard'].includes(item.field)?classifyUkPhone(value):null;
  if(accepting && uk && (!uk.valid || classification==='unknown' || !classification || (classification==='mobile' && !uk.isMobile) || (classification==='direct_dial' && uk.isMobile))) throw Object.assign(new Error('Choose a valid number classification matching the UK numbering plan.'),{status:400});
  if(accepting && ['email','generic_email'].includes(item.field) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw Object.assign(new Error('Enter a valid email address.'),{status:400});
  if(accepting && item.field==='person' && isPlaceholderName(value)) throw Object.assign(new Error('Supply a real full name, not a placeholder.'),{status:400});
  const now=new Date().toISOString(), status=decision==='reject'?'rejected':decision==='request_research'?'clarification_requested':decision==='leave_unresolved'||decision==='attach_source'?'pending':decision==='correct'?'corrected':'approved';
  const saved=await E.ReviewItem.create({organisation_id:org.id,campaign_id:data.campaign.id,prospect_id:p.id,reason:item.reason,field_name:item.field,existing_source:`queue:${item.key}`,original_value:item.original_value,existing_value:item.original_value,corrected_value:decision==='correct'?value:'',new_value:value,source_url:source,phone_type:classification==='direct_dial'?uk?.type:classification,value_origin:'organisation_supplied',review_action:decision,review_notes:clean(body.notes),review_reason_text:item.review_reason,reviewed_by_user_id:user.id,reviewed_at:now,created_at:now,created_by_user_id:user.id,status:accepting?'pending':status});
  // Attaching evidence alone is not verification. Never change the original Prospect.
  if(!accepting) return {ok:true,review_item_id:saved.id,status,applied:false};
  const company=data.companies.find(c=>key(c.name)===key(p.company_name));
  if(!company) return {ok:true,review_item_id:saved.id,status:'pending',applied:false,message:'Decision retained; the company must be linked before promotion.'};
  if(item.field==='switchboard' || classification==='switchboard') {
    if(company.landline && company.landline!==value && decision!=='correct') throw Object.assign(new Error('A different switchboard is already confirmed. Choose Correct and give a reason.'),{status:409});
    await E.Company.update(company.id,{landline:value});
  } else if(['email','generic_email'].includes(item.field) && (item.field==='generic_email' || genericEmail(value) || p.email_type==='generic_company')) {
    if(company.generic_email && company.generic_email!==value && decision!=='correct') throw Object.assign(new Error('A different company email exists. Choose Correct.'),{status:409});
    await E.Company.update(company.id,{generic_email:value,email_source:source || 'organisation_supplied'});
  } else {
    const name=item.field==='person'?value:person.name;
    if(isPlaceholderName(name)) return {ok:true,review_item_id:saved.id,status:'pending',applied:false,message:'Confirm a real person before promoting personal contact details.'};
    let contact=data.contacts.find(c=>c.company_id===company.id && key(c.full_name)===key(name));
    const patch={source:'organisation_supplied',data_source:'organisation_supplied',source_reference:saved.id,source_url:source,source_collected_at:now};
    if(item.field==='job_title') patch.job_title=value;
    if(item.field==='email') patch.email=value;
    if(item.field==='phone') Object.assign(patch,{phone:value,phone_type:uk.type,phone_status:'manually_confirmed',phone_source:'organisation_supplied',phone_verified_at:now,number_status:'untested',...(uk.isMobile?{mobile:value}:{direct_dial:value})});
    if(contact) {
      const field=item.field==='phone'?'phone':item.field==='email'?'email':item.field==='job_title'?'job_title':'';
      if(field && contact[field] && contact[field]!==value && decision!=='correct') throw Object.assign(new Error('A confirmed value already exists. Choose Correct with a reason.'),{status:409});
      await E.Contact.update(contact.id,patch);
    } else await E.Contact.create({...patch,full_name:name,job_title:item.field==='job_title'?value:person.title || '',phone:patch.phone || '',email:patch.email || '',company_id:company.id,company:company.name,campaign_id:data.campaign.id,organisation_id:org.id,owner_user_id:data.campaign.owner_user_id,company_phone:company.landline || ''});
  }
  await E.ReviewItem.update(saved.id,{status,company_id:company.id});
  return {ok:true,review_item_id:saved.id,status,applied:true};
}