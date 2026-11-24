import { isPlaceholderName, assessPerson } from './researchEvidence.ts';
import { classifyUkPhone } from './ukPhone.ts';
export const SYNTHETIC_COMPANY_ID = '6afae4e7d0f2f6f3809b0e91';
export const SYNTHETIC_CONTACT_ID = '6afae4e89382d5a14f4bcae0';
export const clean = value => String(value ?? '').trim();
export const key = value => clean(value).toLowerCase();
export async function allRecords(entity, query) {
  const rows = []; let cursor;
  do {
    const page = await entity.filter(query, { sort: 'id', limit: 200, ...(cursor ? { cursor } : {}) });
    rows.push(...page.items); cursor = page.has_more ? page.next_cursor : null;
    if (rows.length > 10000) throw Object.assign(new Error('Narrow this export to a smaller campaign.'), { status: 400 });
  } while (cursor);
  return rows;
}
export async function loadCampaignDataset(base44, org, campaignId, listId = '') {
  const E = base44.asServiceRole.entities;
  const list = listId ? await E.ProspectList.get(listId).catch(e => e.status === 404 ? null : Promise.reject(e)) : null;
  if (listId && (!list || list.organisation_id !== org.id)) throw Object.assign(new Error('Prospect list not found.'), { status: 404 });
  const resolvedId = campaignId || list?.campaign_id;
  const campaign = resolvedId ? await E.Campaign.get(resolvedId).catch(e => e.status === 404 ? null : Promise.reject(e)) : null;
  if (resolvedId && (!campaign || campaign.organisation_id !== org.id || (list?.campaign_id && list.campaign_id !== resolvedId))) throw Object.assign(new Error('Campaign not found.'), { status: 404 });
  if (!campaign && !list) throw Object.assign(new Error('Choose a campaign or prospect list.'), { status: 400 });
  const lists = list ? [list] : await allRecords(E.ProspectList, { organisation_id: org.id, campaign_id: campaign.id });
  const [prospects, members, reviews, profiles] = await Promise.all([
    lists.length ? allRecords(E.Prospect, { organisation_id: org.id, list_id: { $in: lists.map(l => l.id) } }) : [],
    campaign ? allRecords(E.TargetListMember, { organisation_id: org.id, target_list_id: campaign.id }) : [],
    campaign ? allRecords(E.ReviewItem, { organisation_id: org.id, campaign_id: campaign.id }) : [],
    allRecords(E.UserProfile, { organisation_id: org.id }),
  ]);
  const ids = [...new Set(members.map(m => m.company_id).filter(id => id && id !== SYNTHETIC_COMPANY_ID))];
  const contactIds = members.map(m => m.contact_id).filter(Boolean);
  const [companies, contacts] = await Promise.all([
    ids.length ? allRecords(E.Company, { organisation_id: org.id, id: { $in: ids } }) : [],
    campaign ? allRecords(E.Contact, {
      organisation_id: org.id,
      id: { $ne: SYNTHETIC_CONTACT_ID },
      $or: [
        { campaign_id: campaign.id },
        ...(ids.length ? [{ company_id: { $in: ids } }] : []),
        ...(contactIds.length ? [{ id: { $in: contactIds } }] : []),
      ],
    }) : [],
  ]);
  return { campaign: campaign || {}, lists, prospects, members, reviews, profiles, companies, contacts };
}
export function peopleOf(p) {
  const rows = (p.contacts || []).map((c, index) => ({ ...c, index, name: clean(c.name), title: clean(c.title) }));
  if (p.full_name && !rows.some(c => key(c.name) === key(p.full_name))) rows.push({ name: p.full_name, title: p.job_title, email: p.email, phone: p.phone, index: -1 });
  return rows;
}
export const genericEmail = value => /^(info|sales|contact|enquiries|enquiry|admin|office|hello|support|shop|orders|ordering|dataprivacy|solutions|example)@/i.test(clean(value));
export function effectivePeople(p, reviews) {
  return peopleOf(p).map(c => {
    const latest = reviews.filter(r => r.prospect_id === p.id && r.existing_source === `queue:${p.id}:person:${c.index}`).sort((a,b) => clean(b.reviewed_at).localeCompare(clean(a.reviewed_at)))[0];
    const accepted = latest && ['approved','corrected'].includes(latest.status) ? latest : null;
    return accepted ? { ...c, name: accepted.corrected_value || c.name, source: 'organisation_supplied', employment_check: 'confirmed' } : c;
  });
}
export function accountState(p, data) {
  const people = effectivePeople(p, data.reviews).filter(c => !isPlaceholderName(c.name));
  const company = data.companies.find(c => key(c.name) === key(p.company_name));
  const contacts = data.contacts.filter(c => c.company_id === company?.id || (!c.company_id && key(c.company) === key(p.company_name)));
  const confirmed = people.filter(c => c.employment_check === 'confirmed' && (assessPerson(c,p).promotable || c.source === 'organisation_supplied'));
  const phone = [p.mobile, p.direct_dial, ...contacts.map(c => c.mobile || c.direct_dial || c.phone)].find(n => n && classifyUkPhone(n).valid);
  const ready = contacts.some(c => !c.do_not_call && !['dnc','bad','wrong_person'].includes(c.number_status) && ['verified','manually_confirmed'].includes(c.phone_status) && classifyUkPhone(c.phone).valid && !isPlaceholderName(c.full_name));
  const reasons = [!people.length && 'Needs a decision-maker', people.length && !confirmed.length && 'Employment requires verification', !p.email && !p.generic_email && !contacts.some(c=>c.email) && 'Needs an email', !phone && 'Needs a mobile or direct dial', p.geography_status === 'out_of_scope' && 'Outside permitted geography', company?.suppression_status === 'active' && 'Company suppressed'].filter(Boolean);
  return { people, contacts, company, confirmed, ready: !!ready && !reasons.includes('Outside permitted geography') && !reasons.includes('Company suppressed'), reasons };
}