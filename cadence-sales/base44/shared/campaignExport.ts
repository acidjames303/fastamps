import { clean, key, genericEmail, peopleOf, accountState } from './campaignDataset.ts';
import { classifyUkPhone, PHONE_STATUS_LABELS } from './ukPhone.ts';
export const CAMPAIGN_EXPORT_HEADERS = ['Client','Campaign','Target list','Company','Website','Fit score','Enrichment status','Contact name','Job title','Personal email','Company email','Email status','Email source','Mobile','Lusha','Direct dial','Switchboard','Import mobile','Phone type','Phone status','Phone source','Evidence URL','Review status','Owner','Last activity','Next action','Notes'];
const ENRICHMENT_LABELS = { pending: 'Pending', enriching: 'Enriching', enriched: 'Enriched', complete: 'Complete', partially_enriched: 'Partially enriched', no_contact_details: 'No contact details', not_found: 'Not found', out_of_scope: 'Out of scope', provider_unavailable: 'Provider unavailable', failed: 'Failed' };
// Free text such as "Not publicly listed" lives in phone fields; it must never be
// exported as if it were a dialable number.
const NOT_A_NUMBER = /^(not publicly listed|not available|not found|n\/a|na|none|unknown|null|-+)$/i;
const num = value => { const text = clean(value); return text && !NOT_A_NUMBER.test(text) ? text : ''; };
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
  // Newest first, the same order the Prospecting table lists them in.
  const records = [...data.prospects].sort((a,b)=>clean(b.created_date).localeCompare(clean(a.created_date)));
  for (const company of companies) if (!records.some(p => key(p.company_name) === key(company.name))) records.push({ id: `company:${company.id}`, company_name: company.name, website: company.website, company_phone: company.landline, contacts: [] });
  const rows = records.map(p => {
    const state = accountState(p, data), company = state.company || {}, approved = state.contacts;
    const people = peopleOf(p), allPeople = [...people, ...approved.map(c => ({ ...c, name: c.full_name, title: c.job_title }))];
    const emailEntries = [
      { value: p.email, generic: p.email_type === 'generic_company', status: p.email_verification_status, source: p.field_provenance?.email?.source_provider || p.email_pattern_source },
      { value: p.generic_email, generic: true }, { value: company.generic_email, generic: true, source: company.email_source },
      ...allPeople.map(c => ({ value: c.email, generic: genericEmail(c.email), status: c.email_status, source: c.email_source || c.source_url })),
    ].filter(e => e.value);
    // Every number is attributed to the person it belongs to, exactly as the
    // Prospecting table shows it.
    const personOf = new Map();
    for (const person of allPeople) for (const value of [person.mobile, person.phone, person.direct_dial]) {
      const n = num(value);
      if (n && !personOf.has(n)) personOf.set(n, clean(person.name));
    }
    const who = n => personOf.get(n) ? ` (${personOf.get(n)})` : '';
    const mobiles = [p.mobile, ...allPeople.map(c => c.mobile), p.phone, ...allPeople.map(c=>c.phone)].map(num).filter(n=>n && classifyUkPhone(n).isMobile);
    // A switchboard is never repeated as a mobile or direct dial (and vice versa).
    const boardNumbers = [...new Set([p.company_phone, p.landline, company.landline, ...approved.map(c=>c.company_phone)].map(num).filter(Boolean))].filter(n => !mobiles.includes(n));
    const board = boardNumbers.join('\n');
    const directs = [p.direct_dial, ...allPeople.map(c=>c.direct_dial)].map(num).filter(n=>n && classifyUkPhone(n).valid && !classifyUkPhone(n).isMobile && !boardNumbers.includes(n));
    const importMobiles = [
      p.phone_source === 'import' ? p.mobile || p.phone : '',
      ...allPeople.map((c) => (c.phone_source === 'import' || (!c.lusha_mobile && c.mobile) ? c.mobile || c.phone : '')),
    ].map(num).filter(Boolean);
    const lushaMobiles = [
      p.lusha_mobile,
      p.phone_source === 'lusha' ? p.mobile || p.phone : '',
      ...allPeople.map((c) => c.lusha_mobile || (c.phone_source === 'lusha' ? c.mobile || c.phone : '')),
    ].map(num).filter(Boolean);
    const rawNumbers = [p.phone, ...people.map(c=>c.phone)].map(num).filter(Boolean);
    const unclassified = rawNumbers.filter(n=>!mobiles.includes(n) && !directs.includes(n) && !boardNumbers.includes(n));
    const phoneTypes = [
      ...mobiles.map(n => `${n} — Mobile${who(n)}`),
      ...directs.map(n => `${n} — Direct dial${who(n)}`),
      ...boardNumbers.map(n => `${n} — Switchboard`),
      ...unclassified.map(n=>`${n} — ${classifyUkPhone(n).label} / relationship unconfirmed`),
    ];
    const decisions = reviews.filter(r=>r.prospect_id === p.id).sort((a,b)=>clean(b.reviewed_at).localeCompare(clean(a.reviewed_at)));
    const last = (activity.calls || []).filter(c=>c.company_id === company.id).sort((a,b)=>clean(b.started_at||b.created_date).localeCompare(clean(a.started_at||a.created_date)))[0];
    const next = (activity.tasks || []).filter(t=>t.company_id === company.id && ['pending','in_progress'].includes(t.status)).sort((a,b)=>clean(a.due_at).localeCompare(clean(b.due_at)))[0];
    const list = lists.find(l=>l.id===p.list_id) || lists[0] || {};
    const source = join([p.phone_source, ...people.map(c=>c.phone_source), ...approved.map(c=>c.phone_source)]);
    const fit = clean(p.fit_score);
    const enrichment = ENRICHMENT_LABELS[p.enrichment_status] || human(p.enrichment_status);
    return [campaign.client_name || campaign.name || '', campaign.name || '', list.name || campaign.name || '', p.company_name, p.website || company.website || p.domain, fit, enrichment, join(allPeople.map(c=>c.name)), join(allPeople.map(c=>c.title)), join(emailEntries.filter(e=>!e.generic).map(e=>e.value)), join(emailEntries.filter(e=>e.generic).map(e=>e.value)), join(emailEntries.map(e=>`${e.value}: ${e.status === 'verified' ? 'Verified' : e.status ? human(e.status) + ' (not independently verified)' : 'Unsupported / requires review'}`)), join(emailEntries.map(e=>`${e.value}: ${e.source || 'No recorded source'}`)), join(mobiles), join(lushaMobiles), join(directs), board, join(importMobiles), join(phoneTypes), join([PHONE_STATUS_LABELS[p.phone_status] || '', ...approved.map(c=>PHONE_STATUS_LABELS[c.phone_status] || human(c.phone_status)), ...rawNumbers.length && !source ? ['Unsupported / requires review'] : []]), source || (rawNumbers.length || board ? 'No recorded source' : ''), join([p.source_url, ...allPeople.map(c=>c.source_url || c.evidence_url), ...decisions.map(r=>r.source_url)]), state.ready ? 'Ready to call' : join([...decisions.map(r=>human(r.status)), ...state.reasons, 'Not ready to call']), profiles.find(x=>x.user_id === (company.owner_user_id || list.owner_user_id || campaign.owner_user_id))?.full_name || '', dateOnly(last?.started_at || p.last_called_at), next ? `${human(next.task_type)} ${dateOnly(next.due_at || next.due_date)}` : '', join([p.notes, p.fit_reason, ...approved.map(c=>c.notes), last?.notes, ...decisions.map(r=>r.review_notes), ...unclassified.map(n=>`Unclassified original telephone: ${n}`), p.email && p.email_type!=='generic_company' && genericEmail(p.email) ? 'Stored as personal email, but resembles a role/company inbox. Classification requires review.' : ''])];
  });
  return { headers: CAMPAIGN_EXPORT_HEADERS, rows, csv: '\ufeff' + [CAMPAIGN_EXPORT_HEADERS,...rows].map(row=>row.map(cell).join(',')).join('\r\n'), target_count: records.length, row_count: rows.length };
}