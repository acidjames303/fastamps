import { clean, key, genericEmail, peopleOf, accountState } from './campaignDataset.ts';
import { classifyUkPhone, PHONE_STATUS_LABELS } from './ukPhone.ts';
export const CAMPAIGN_EXPORT_HEADERS = ['Client','Campaign','Target list','Company','Website','Contact name','Job title','Personal email','Company email','Email status','Email source','Mobile','Direct dial','Switchboard','Phone type','Phone status','Phone source','Evidence URL','Review status','Owner','Last activity','Next action','Notes'];
const join = values => [...new Set(values.map(clean).filter(Boolean))].join('\n');
const human = value => clean(value).replace(/_/g, ' ');
const dateOnly = value => value ? new Date(value).toLocaleDateString('en-GB', { timeZone: 'Europe/London' }) : '';
function cell(value) {
  let text = String(value ?? '');
  // A tab forces spreadsheet text without adding an apostrophe to data.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = '\t' + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function buildCampaignExport(data, activity = {}) {
  const { campaign, lists, companies, reviews, profiles } = data;
  const records = [...data.prospects];
  for (const company of companies) if (!records.some(p => key(p.company_name) === key(company.name))) records.push({ id: `company:${company.id}`, company_name: company.name, website: company.website, company_phone: company.landline, contacts: [] });
  const rows = records.map(p => {
    const state = accountState(p, data), company = state.company || {}, approved = state.contacts;
    const people = peopleOf(p), allPeople = [...people, ...approved.map(c => ({ ...c, name: c.full_name, title: c.job_title }))];
    const emailEntries = [
      { value: p.email, generic: p.email_type === 'generic_company', status: p.email_verification_status, source: p.field_provenance?.email?.source_provider || p.email_pattern_source },
      { value: p.generic_email, generic: true }, { value: company.generic_email, generic: true, source: company.email_source },
      ...allPeople.map(c => ({ value: c.email, generic: genericEmail(c.email), status: c.email_status, source: c.email_source || c.source_url })),
    ].filter(e => e.value);
    const board = join([p.company_phone, p.landline, company.landline, ...approved.map(c=>c.company_phone)]);
    const mobiles = [p.mobile, ...allPeople.map(c => c.mobile), p.phone, ...allPeople.map(c=>c.phone)].filter(n=>n && classifyUkPhone(n).isMobile);
    const directs = [p.direct_dial, ...allPeople.map(c=>c.direct_dial)].filter(n=>n && classifyUkPhone(n).valid && !classifyUkPhone(n).isMobile && !board.split('\n').includes(n));
    const rawNumbers = [p.phone, ...people.map(c=>c.phone)].filter(Boolean);
    const unclassified = rawNumbers.filter(n=>!mobiles.includes(n) && !directs.includes(n) && !board.split('\n').includes(n));
    const decisions = reviews.filter(r=>r.prospect_id === p.id).sort((a,b)=>clean(b.reviewed_at).localeCompare(clean(a.reviewed_at)));
    const last = (activity.calls || []).filter(c=>c.company_id === company.id).sort((a,b)=>clean(b.started_at||b.created_date).localeCompare(clean(a.started_at||a.created_date)))[0];
    const next = (activity.tasks || []).filter(t=>t.company_id === company.id && ['pending','in_progress'].includes(t.status)).sort((a,b)=>clean(a.due_at).localeCompare(clean(b.due_at)))[0];
    const list = lists.find(l=>l.id===p.list_id) || lists[0] || {};
    const source = join([p.phone_source, ...people.map(c=>c.phone_source), ...approved.map(c=>c.phone_source)]);
    return [campaign.client_name || campaign.name || '', campaign.name || '', list.name || campaign.name || '', p.company_name, p.website || company.website || p.domain, join(allPeople.map(c=>c.name)), join(allPeople.map(c=>c.title)), join(emailEntries.filter(e=>!e.generic).map(e=>e.value)), join(emailEntries.filter(e=>e.generic).map(e=>e.value)), join(emailEntries.map(e=>`${e.value}: ${e.status === 'verified' ? 'Verified' : e.status ? human(e.status) + ' (not independently verified)' : 'Unsupported / requires review'}`)), join(emailEntries.map(e=>`${e.value}: ${e.source || 'No recorded source'}`)), join(mobiles), join(directs), board, join([...mobiles.map(()=> 'Mobile'), ...directs.map(()=> 'Direct dial'), ...(board?['Switchboard']:[]), ...unclassified.map(n=>`${n}: ${classifyUkPhone(n).label} / relationship unconfirmed`)]), join([PHONE_STATUS_LABELS[p.phone_status] || '', ...approved.map(c=>PHONE_STATUS_LABELS[c.phone_status] || human(c.phone_status)), ...rawNumbers.length && !source ? ['Unsupported / requires review'] : []]), source || (rawNumbers.length || board ? 'No recorded source' : ''), join([p.source_url, ...allPeople.map(c=>c.source_url || c.evidence_url), ...decisions.map(r=>r.source_url)]), state.ready ? 'Ready to call' : join([...decisions.map(r=>human(r.status)), ...state.reasons, 'Not ready to call']), profiles.find(x=>x.user_id === (company.owner_user_id || list.owner_user_id || campaign.owner_user_id))?.full_name || '', dateOnly(last?.started_at || p.last_called_at), next ? `${human(next.task_type)} ${dateOnly(next.due_at || next.due_date)}` : '', join([p.notes, p.fit_reason, ...approved.map(c=>c.notes), last?.notes, ...decisions.map(r=>r.review_notes), ...unclassified.map(n=>`Unclassified original telephone: ${n}`), p.email && p.email_type!=='generic_company' && genericEmail(p.email) ? 'Stored as personal email, but resembles a role/company inbox. Classification requires review.' : ''])];
  });
  return { headers: CAMPAIGN_EXPORT_HEADERS, rows, csv: '\ufeff' + [CAMPAIGN_EXPORT_HEADERS,...rows].map(row=>row.map(cell).join(',')).join('\r\n'), target_count: records.length, row_count: rows.length };
}