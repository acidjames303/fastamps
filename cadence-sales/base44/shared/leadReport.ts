// Client lead-activity report rows — the client's own "B2B SalesLeads Activity"
// layout (Area, Date, Company, Address3, Contact_Job_title, Contact, Telephone,
// Contact_Telephone, Contact_Email_address, Response, Customerstatus, Comments).
// Comments carries the call notes plus the account research for that account.
import { getOutcomeLabel } from './outcomeRules.ts';

export const LEAD_HEADERS = [
  'Area', 'Date', 'Company', 'Address3', 'Contact_Job_title', 'Contact',
  'Telephone', 'Contact_Telephone', 'Contact_Email_address',
  'Response', 'Customerstatus', 'Comments',
];

const pad = (n) => String(n).padStart(2, '0');

export const normaliseName = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

// Date only (YYYY-MM-DD) — the client report never carries call times.
export function csvDate(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw).slice(0, 10);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Full timestamp (YYYY-MM-DD HH:mm:ss), used by the in-app CSV export.
export function csvStamp(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw).slice(0, 19);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const NEXT_STEP_LABELS = {
  callback: 'Call back',
  follow_up: 'Follow up',
  revisit: 'Revisit',
  new_call: 'New call',
  research_review: 'Research review',
  data_review: 'Data review',
  opportunity_review: 'Opportunity review',
  manual: 'Manual',
};

export function customerStatus(log) {
  const label = getOutcomeLabel(log?.primary_outcome || log?.outcome || 'other');
  return NEXT_STEP_LABELS[log?.next_action_type] || label;
}

// Never export internal notes — clients only ever see what was written for them.
export function clientSafeNotes(log) {
  if (!log) return '';
  return String(log.client_notes || log.outcome_notes || log.notes || '').trim();
}

// One published research record, rendered the way the client's report shows it.
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

// Fallback when an account has company intelligence but no published research.
export function intelligenceNote(intelligence) {
  if (!intelligence) return '';
  const headline = [
    intelligence.company_name || '',
    'Company research',
    intelligence.researched_at ? `(${csvStamp(intelligence.researched_at).slice(0, 10)})` : '',
  ].filter(Boolean).join(' ');
  const parts = [headline];
  if (intelligence.ai_summary) parts.push(String(intelligence.ai_summary).slice(0, 1200));
  if (intelligence.news) parts.push(`News: ${intelligence.news}`);
  if (intelligence.buyer_signals) parts.push(`Buying signals: ${intelligence.buyer_signals}`);
  return parts.join('\n\n');
}

// One call, laid out as one client report row.
export function buildLeadRow(log, context) {
  const { contact, company, campaignName, research, intelligence } = context || {};
  const comments = [
    clientSafeNotes(log),
    research ? researchNote(research) : intelligenceNote(intelligence),
  ].filter(Boolean).join('\n\n');

  return [
    campaignName || log.territory || '',
    csvDate(log.started_at || log.created_date),
    log.company || company?.name || '',
    company?.location || contact?.location || '',
    contact?.job_title || '',
    log.contact_name || contact?.full_name || '',
    contact?.company_phone || company?.landline || '',
    contact?.mobile || contact?.direct_dial || contact?.phone || log.phone || '',
    contact?.email || '',
    getOutcomeLabel(log.primary_outcome || log.outcome || 'other'),
    customerStatus(log),
    comments,
  ];
}

export function toCsv(headers, rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\n');
}