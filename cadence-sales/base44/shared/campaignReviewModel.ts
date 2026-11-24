import { clean, key, peopleOf, genericEmail, accountState } from './campaignDataset.ts';
import { isPlaceholderName, looksLikeAddress } from './researchEvidence.ts';
import { classifyUkPhone } from './ukPhone.ts';
export function reviewQueue(data) {
  const rows=[];
  const add=(p,field,index,value,reason,problem,person={})=>{
    const itemKey=`${p.id}:${field}:${index}`;
    const prior=data.reviews.filter(r=>r.existing_source===`queue:${itemKey}`).sort((a,b)=>clean(b.reviewed_at).localeCompare(clean(a.reviewed_at)))[0];
    rows.push({ key:itemKey,prospect:p,prospect_id:p.id,contact_index:index,company:p.company_name,person:person.name || p.full_name || '',job_title:person.title || p.job_title || '',email:person.email || p.email || p.generic_email || '',phone:person.phone || p.phone || p.landline || '',field,original_value:clean(value),reason,review_reason:problem,source:person.phone_source || person.email_source || p.phone_source || p.field_provenance?.email?.source_provider || '',evidence_url:prior?.source_url || person.source_url || '',suggested_action:'Confirm as organisation supplied, correct, attach evidence or request research.',status:prior?.status || 'pending',last_decision:prior?.review_action || '',review_notes:prior?.review_notes || '' });
  };
  for(const p of data.prospects) {
    for(const c of peopleOf(p)) {
      add(p,'person',c.index,c.name,isPlaceholderName(c.name)?'placeholder_name':'employment_unconfirmed',isPlaceholderName(c.name)?'Placeholder or unsupported person.':'Confirm this person and their current employment before promotion.',c);
      if(looksLikeAddress(c.title)) add(p,'job_title',c.index,c.title,'address_as_job_title','This job title appears to be an address.',c);
      if(c.email) add(p,'email',c.index,c.email,'unsupported_email','Email needs source and employment review.',c);
      if(c.phone || c.mobile || c.direct_dial) add(p,'phone',c.index,c.phone || c.mobile || c.direct_dial,'unsourced_number','Number ownership and type need review.',c);
    }
    if(p.email) add(p,'email',-1,p.email,'unsupported_email','Stored email is preserved; confirm its classification and source.');
    if(p.generic_email && p.generic_email !== p.email) add(p,'generic_email',-1,p.generic_email,'unsupported_email','Company inbox requires a source.');
    const board=p.company_phone || p.landline;
    if(board) add(p,'switchboard',-1,board,'unsourced_number','Company switchboard is not a personal number.');
    if(p.phone && p.phone!==board && !peopleOf(p).some(c=>c.phone===p.phone)) add(p,'phone',-1,p.phone,'unsourced_number','Telephone needs ownership and source review.');
  }
  return rows;
}
export function readiness(data) {
  const groups=[['target_companies','Target companies'],['named_contacts_confirmed','Confirmed people'],['named_contacts_review','Stored person entries requiring review'],['personal_emails','Stored personal-labelled emails'],['company_emails','Stored company emails'],['mobiles','Detected mobile numbers (review status applies)'],['direct_dials','Direct dials'],['switchboards','Switchboards'],['missing_decision_makers','Needs a decision-maker'],['missing_email','Needs an email'],['missing_direct_phone','Needs a mobile or direct dial'],['employment_verification','Employment verification'],['ready_to_call','Ready to call / assign'],['not_ready_to_call','Blocked from calling']];
  const buckets=Object.fromEntries(groups.map(([key,label])=>[key,{key,label,count:0,ids:[]}]));
  const records=data.prospects.map(p=>{
    const state=accountState(p,data),people=peopleOf(p);
    const flags={target_companies:true,named_contacts_confirmed:state.confirmed.length>0 || state.contacts.some(c=>c.source==='organisation_supplied'),named_contacts_review:people.length>0 && !state.confirmed.length,personal_emails:!!p.email && p.email_type!=='generic_company',company_emails:!!p.generic_email || (!!p.email && p.email_type==='generic_company'),mobiles:[p.mobile,p.phone,...people.flatMap(c=>[c.mobile,c.phone])].some(n=>n && classifyUkPhone(n).isMobile),direct_dials:!!p.direct_dial || people.some(c=>c.direct_dial),switchboards:!!(p.company_phone || p.landline),missing_decision_makers:!state.people.length,missing_email:!p.email && !p.generic_email && !people.some(c=>c.email),missing_direct_phone:!p.mobile && !p.direct_dial && !people.some(c=>c.mobile||c.direct_dial),employment_verification:state.people.length>0 && !state.confirmed.length,ready_to_call:state.ready,not_ready_to_call:!state.ready};
    for(const [name,yes] of Object.entries(flags)) if(yes){buckets[name].count+=name==='named_contacts_review'?people.length:1;buckets[name].ids.push(p.id);}
    return {...p,detected_mobile:[p.mobile,p.phone,...people.flatMap(c=>[c.mobile,c.phone])].find(n=>n && classifyUkPhone(n).isMobile) || '',readiness:flags,blocked_reasons:state.reasons,ready_to_call:state.ready};
  });
  return {buckets:Object.values(buckets),records};
}