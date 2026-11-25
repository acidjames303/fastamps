import { clean } from './campaignDataset.ts';
export const ICP_KEYS=['target_sectors','target_company_types','company_sizes','locations','target_job_titles','departments','seniority','excluded_roles','excluded_companies','buying_triggers','preferred_contact_order'];
function parseStructuredIcp(value) {
  try {
    const parsed=JSON.parse(clean(value));
    return parsed && !Array.isArray(parsed) && typeof parsed==='object' ? parsed : null;
  } catch {
    return null;
  }
}
export function briefDetails(data) {
  const list=data.lists[0], parsed=parseStructuredIcp(list?.icp);
  const originalBrief=list?.original_brief || list?.brief || '';
  const originalIcp=list?.original_icp || '';
  const legacyIcp=parsed ? originalIcp : (list?.icp || originalIcp || '');
  return {
    list_id:list?.id || '',
    campaign_id:data.campaign.id,
    brief:list?.brief || '',
    icp:list?.icp || '',
    structured_icp:parsed ? JSON.stringify(parsed) : '',
    legacy_icp:legacyIcp,
    target_titles:list?.target_titles || [],
    original_brief:originalBrief,
    original_icp:originalIcp,
    campaign_name:data.campaign.name,
  };
}
export async function saveCampaignBrief(base44,data,body) {
  const list=data.lists[0];
  if(!list) throw Object.assign(new Error('Open this campaign in Prospecting to create its brief workspace first.'),{status:400});
  const patch={};
  if(Object.hasOwn(body,'brief')) {
    if(typeof body.brief!=='string' || body.brief.length>50000) throw Object.assign(new Error('Brief must be text under 50,000 characters.'),{status:400});
    patch.brief=body.brief;
  }
  if(Object.hasOwn(body,'icp')) {
    const icp=typeof body.icp==='string'?JSON.parse(body.icp):body.icp;
    if(!icp || Array.isArray(icp) || typeof icp!=='object') throw Object.assign(new Error('Use the structured ICP fields.'),{status:400});
    for(const field of ICP_KEYS) if(icp[field] && (!Array.isArray(icp[field]) || icp[field].length>100 || icp[field].some(x=>typeof x!=='string'||x.length>1000))) throw Object.assign(new Error(`Invalid ${field.replace(/_/g,' ')}.`),{status:400});
    const max=Number(icp.max_contacts_per_company || list.max_contacts_per_company || 1);
    if(!Number.isInteger(max)||max<1||max>10) throw Object.assign(new Error('Maximum contacts per company must be 1 to 10.'),{status:400});
    patch.icp=JSON.stringify({...icp,max_contacts_per_company:max});
    patch.target_titles=icp.target_job_titles || list.target_titles || [];
    patch.target_departments=icp.departments || list.target_departments || [];
    patch.preferred_seniority=icp.seniority || list.preferred_seniority || [];
    patch.excluded_titles=icp.excluded_roles || list.excluded_titles || [];
    patch.max_contacts_per_company=max;
  }
  if(!list.original_brief) patch.original_brief=list.brief || '';
  if(!list.original_icp) patch.original_icp=list.icp || '';
  await base44.asServiceRole.entities.ProspectList.update(list.id,patch);
  return {ok:true,...briefDetails({...data,lists:[{...list,...patch}]})};
}