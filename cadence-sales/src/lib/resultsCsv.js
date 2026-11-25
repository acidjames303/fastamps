// Lead-activity CSV export: mirrors the client's existing report layout
// (Area, Date, Company, Address3, Contact_Job_title, Contact, Telephone,
// Contact_Telephone, Contact_Email_address, Response, Customerstatus, Comments)
// and appends the account research notes to the Comments column.
import { base44 } from '@/api/base44Client';
import { getOutcomeLabel } from '@/lib/outcomeRules';
import { clientSafeNotes } from '@/lib/reportMetrics';

export const LEAD_HEADERS = [
  'Area', 'Date', 'Company', 'Address3', 'Contact_Job_title', 'Contact',
  'Telephone', 'Contact_Telephone', 'Contact_Email_address',
  'Response', 'Customerstatus', 'Comments',
];

const normalise = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
const pad = (n) => String(n).padStart(2, '0');

// Full timestamp, as the client's sample report uses (YYYY-MM-DD HH:mm:ss).
export function csvStamp(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw).slice(0, 19);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const STATUS_LABELS = {
  callback: 'Call back',
  follow_up: 'Follow up',
  revisit: 'Revisit',
  new_call: 'New call',
  research_review: 'Research review',
  data_review: 'Data review',
  opportunity_review: 'Opportunity review',
  manual: 'Manual',
};

function customerStatus(log) {
  const label = getOutcomeLabel(log.primary_outcome || log.outcome || 'other');
  const next = STATUS_LABELS[log.next_action_type];
  return next || label;
}

// One research record rendered the way the client's sample report shows it.
export function researchNote(research) {
  if (!research) return '';
  const findings = (research.findings || []).filter((f) => f && f.label && f.value);
  const urls = [...new Set((research.findings || []).map((f) => f.source_url).filter(Boolean))];
  const headline = [
    research.company_name || '',
    'Research',
    research.researched_at ? `(${csvStamp(research.researched_at).slice(0, 10)})` : '',
  ].filter(Boolean).join(' ');
  const parts = [headline];
  if (research.summary) parts.push(research.summary);
  if (findings.length) parts.push(findings.map((f) => `${f.label}: ${f.value}`).join('\n'));
  if (urls.length) parts.push(`Sources:\n${urls.join('\n')}`);
  return parts.join('\n\n');
}

const chunks = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

// Everything the rows need: contacts, companies and published research for the
// accounts in this report.
export async function loadLeadContext(calls) {
  const contactIds = [...new Set((calls || []).map((c) => c.contact_id).filter(Boolean))];
  const companyIds = [...new Set((calls || []).map((c) => c.company_id).filter(Boolean))];
  const companyNames = [...new Set((calls || []).map((c) => normalise(c.company)).filter(Boolean))];

  const contactMap = new Map();
  const companyMap = new Map();

  for (const chunk of chunks(companyIds, 100)) {
    const rows = await base44.entities.Contact.filter({ company_id: { $in: chunk } }, '-created_date', 2000).catch(() => []);
    (rows || []).forEach((c) => contactMap.set(c.id, c));
    const cos = await base44.entities.Company.filter({ id: { $in: chunk } }).catch(() => []);
    (cos || []).forEach((c) => companyMap.set(c.id, c));
  }
  // Calls that carry a contact but no company still need that person's details.
  const missing = contactIds.filter((id) => !contactMap.has(id));
  for (const chunk of chunks(missing, 100)) {
    const rows = await base44.entities.Contact.filter({ id: { $in: chunk } }).catch(() => []);
    (rows || []).forEach((c) => contactMap.set(c.id, c));
  }

  const researchByCompany = new Map();
  const research = await base44.entities.AccountResearch.list('-created_date', 500).catch(() => []);
  (research || [])
    .filter((r) => r.company_name && companyNames.includes(normalise(r.company_name)))
    .forEach((r) => {
      const key = normalise(r.company_name);
      const list = researchByCompany.get(key) || [];
      if (list.length < 2) list.push(r);
      researchByCompany.set(key, list);
    });

  return { contactMap, companyMap, researchByCompany };
}

export function buildLeadRows(calls, context) {
  const { contactMap, companyMap, researchByCompany } = context || {};
  return (calls || []).map((log) => {
    const contact = contactMap?.get(log.contact_id) || null;
    const company = companyMap?.get(log.company_id) || null;
    const research = (researchByCompany?.get(normalise(log.company)) || [])
      .map(researchNote)
      .filter(Boolean)
      .join('\n\n');
    const comments = [clientSafeNotes(log).trim(), research].filter(Boolean).join('\n\n');
    return [
      log.campaign_name || log.territory || '',
      csvStamp(log.started_at || log.created_date),
      log.company || company?.name || '',
      contact?.location || company?.location || '',
      contact?.job_title || '',
      log.contact_name || contact?.full_name || '',
      contact?.company_phone || company?.landline || '',
      contact?.mobile || contact?.direct_dial || contact?.phone || log.phone || '',
      contact?.email || '',
      getOutcomeLabel(log.primary_outcome || log.outcome || 'other'),
      customerStatus(log),
      comments,
    ];
  });
}

// Area is the campaign the call belongs to, matching the client's "Area" column.
export function areaName(log, campaigns) {
  const campaign = (campaigns || []).find((c) => c.id === log.campaign_id);
  return campaign?.name || log.territory || '';
}

export function toCsv(headers, rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\n');
}