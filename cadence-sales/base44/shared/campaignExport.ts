import { clean, key, genericEmail, peopleOf, accountState } from './campaignDataset.ts';
import { classifyUkPhone, PHONE_STATUS_LABELS } from './ukPhone.ts';
import { splitPersonName } from './lusha.ts';

// Prospecting / campaign CSV: one row per person so uploads know which phone
// and email belong to whom. Person + company + phone + email lead the sheet.
export const CAMPAIGN_EXPORT_HEADERS = [
  'First name',
  'Last name',
  'Company',
  'Phone',
  'Personal email',
  'Job title',
  'Mobile',
  'Direct dial',
  'Switchboard',
  'Target list',
  'Date',
  'Website',
  'Client',
  'Campaign',
  'Company email',
  'Email status',
  'Email source',
  'Phone type',
  'Phone status',
  'Phone source',
  'Evidence URL',
  'Review status',
  'Owner',
  'Last activity',
  'Next action',
  'Notes',
];

const human = (value) => clean(value).replace(/_/g, ' ');
const dateOnly = (value) =>
  value ? new Date(value).toLocaleDateString('en-GB', { timeZone: 'Europe/London' }) : '';

function cell(value) {
  let text = String(value ?? '');
  // A tab forces spreadsheet text without adding an apostrophe to data.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = '\t' + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function personKey(person) {
  return key(
    person?.name ||
      person?.full_name ||
      [person?.first_name, person?.last_name].filter(Boolean).join(' '),
  );
}

function matchEmailForPerson(person, emailEntries) {
  const { firstName, lastName } = splitPersonName(person?.name || person?.full_name || '');
  const first = key(firstName).replace(/[^a-z]/g, '');
  const last = key(lastName).replace(/[^a-z]/g, '');
  const direct = clean(person?.email);
  if (direct) {
    const hit = emailEntries.find((e) => key(e.value) === key(direct));
    if (hit) return hit;
  }
  let best = null;
  for (const entry of emailEntries) {
    const localRaw = key(entry.value).split('@')[0];
    const local = localRaw.replace(/[^a-z0-9]/g, '');
    let score = 0;
    if (first && last && local.includes(first) && local.includes(last)) score = 6;
    else if (
      first &&
      last &&
      localRaw.startsWith(`${first}.`) &&
      (localRaw === `${first}.${last[0]}` || localRaw.endsWith(`.${last[0]}`))
    ) {
      score = 6;
    } else if (first && last && local === `${first[0]}${last}`) score = 5;
    else if (last && local.includes(last) && (!first || local.includes(first[0]))) score = 4;
    else if (first && last && local === `${first[0]}${last[0]}`) score = 4;
    else if (first && local === first) score = 2;
    if (score && (!best || score > best.score)) best = { score, entry };
  }
  return best?.entry || null;
}

function pickPersonPhones(person, boardSet) {
  const candidates = [person?.mobile, person?.direct_dial, person?.phone, person?.company_phone]
    .map(clean)
    .filter(Boolean);
  const mobiles = [];
  const directs = [];
  const other = [];
  for (const number of candidates) {
    if (boardSet.has(number)) continue;
    const classified = classifyUkPhone(number);
    if (classified.isMobile) {
      if (!mobiles.includes(number)) mobiles.push(number);
    } else if (classified.valid && !classified.isMobile) {
      if (!directs.includes(number)) directs.push(number);
    } else if (!other.includes(number)) {
      other.push(number);
    }
  }
  return { mobiles, directs, other };
}

function buildPeopleForAccount(prospect, state) {
  const people = peopleOf(prospect);
  const approved = state.contacts || [];
  const merged = [
    ...people.map((c) => ({
      ...c,
      name: c.name || c.full_name || '',
      title: c.title || c.job_title || '',
    })),
    ...approved.map((c) => ({
      ...c,
      name: c.full_name || c.name || '',
      title: c.job_title || c.title || '',
    })),
  ];
  const seen = new Set();
  const unique = [];
  for (const person of merged) {
    const name = clean(person.name);
    if (!name) continue;
    const id = personKey(person);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(person);
  }
  return unique;
}

function rowForPerson({
  campaign,
  list,
  prospect,
  company,
  person,
  emailEntries,
  board,
  boardSet,
  activity,
  reviews,
  state,
  ownerName,
}) {
  const { firstName, lastName } = splitPersonName(person?.name || '');
  const matched = person ? matchEmailForPerson(person, emailEntries.filter((e) => !e.generic)) : null;
  const personalEmail = matched?.value || (!person ? '' : clean(person.email));
  const companyEmails = emailEntries.filter((e) => e.generic).map((e) => e.value);
  const { mobiles, directs, other } = person
    ? pickPersonPhones(person, boardSet)
    : { mobiles: [], directs: [], other: [] };
  const phone = mobiles[0] || directs[0] || other[0] || board || '';
  const phoneType = mobiles[0]
    ? 'Mobile'
    : directs[0]
      ? 'Direct dial'
      : other[0]
        ? `${other[0]}: ${classifyUkPhone(other[0]).label} / relationship unconfirmed`
        : board
          ? 'Switchboard'
          : '';
  const emailStatus = personalEmail
    ? `${personalEmail}: ${
        matched?.status === 'verified'
          ? 'Verified'
          : matched?.status
            ? `${human(matched.status)} (not independently verified)`
            : 'Unsupported / requires review'
      }`
    : '';
  const emailSource = personalEmail
    ? `${personalEmail}: ${matched?.source || person?.email_source || 'No recorded source'}`
    : '';
  const phoneStatus = [
    PHONE_STATUS_LABELS[person?.phone_status] || human(person?.phone_status),
    !mobiles.length && !directs.length && board ? 'Company switchboard (fallback)' : '',
    state.ready ? '' : 'Unsupported / requires review',
  ]
    .filter(Boolean)
    .join('; ');
  const phoneSource = clean(person?.phone_source) || (phone ? 'No recorded source' : '');
  const evidence = clean(person?.source_url || person?.evidence_url || prospect.source_url);
  const decisions = reviews
    .filter((r) => r.prospect_id === prospect.id)
    .sort((a, b) => clean(b.reviewed_at).localeCompare(clean(a.reviewed_at)));
  const last = (activity.calls || [])
    .filter((c) => c.company_id === company.id || key(c.company) === key(prospect.company_name))
    .sort((a, b) =>
      clean(b.started_at || b.created_date).localeCompare(clean(a.started_at || a.created_date)),
    )[0];
  const next = (activity.tasks || [])
    .filter((t) => t.company_id === company.id && ['pending', 'in_progress'].includes(t.status))
    .sort((a, b) => clean(a.due_at).localeCompare(clean(b.due_at)))[0];
  const activityDate = dateOnly(last?.started_at || prospect.last_called_at || prospect.updated_date || prospect.created_date);
  const reviewStatus = state.ready
    ? 'Ready to call'
    : [...decisions.map((r) => human(r.status)), ...state.reasons, 'Not ready to call']
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .join('; ');
  const notes = [
    person?.notes,
    prospect.notes,
    prospect.fit_reason,
    last?.notes,
    ...decisions.map((r) => r.review_notes),
    ...other.map((n) => `Unclassified original telephone: ${n}`),
    personalEmail && genericEmail(personalEmail)
      ? 'Stored as personal email, but resembles a role/company inbox. Classification requires review.'
      : '',
  ]
    .map(clean)
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join('\n');

  return [
    firstName,
    lastName,
    prospect.company_name,
    phone,
    personalEmail,
    clean(person?.title || person?.job_title || ''),
    mobiles[0] || '',
    directs[0] || '',
    board,
    list.name || campaign.name || '',
    activityDate,
    prospect.website || company.website || prospect.domain || '',
    campaign.client_name || campaign.name || '',
    campaign.name || '',
    companyEmails[0] || '',
    emailStatus,
    emailSource,
    phoneType,
    phoneStatus,
    phoneSource,
    evidence,
    reviewStatus,
    ownerName,
    activityDate,
    next ? `${human(next.task_type)} ${dateOnly(next.due_at || next.due_date)}` : '',
    notes,
  ];
}

export function buildCampaignExport(data, activity = {}) {
  const { campaign, lists, companies, reviews, profiles } = data;
  const records = [...data.prospects];
  for (const company of companies) {
    if (!records.some((p) => key(p.company_name) === key(company.name))) {
      records.push({
        id: `company:${company.id}`,
        company_name: company.name,
        website: company.website,
        company_phone: company.landline,
        contacts: [],
      });
    }
  }

  const rows = [];
  for (const prospect of records) {
    const state = accountState(prospect, data);
    const company = state.company || {};
    const list = lists.find((l) => l.id === prospect.list_id) || lists[0] || {};
    const ownerName =
      profiles.find(
        (x) =>
          x.user_id === (company.owner_user_id || list.owner_user_id || campaign.owner_user_id),
      )?.full_name || '';
    const people = buildPeopleForAccount(prospect, state);
    const emailEntries = [
      {
        value: prospect.email,
        generic: prospect.email_type === 'generic_company',
        status: prospect.email_verification_status,
        source: prospect.field_provenance?.email?.source_provider || prospect.email_pattern_source,
      },
      { value: prospect.generic_email, generic: true },
      { value: company.generic_email, generic: true, source: company.email_source },
      ...people.map((c) => ({
        value: c.email,
        generic: genericEmail(c.email),
        status: c.email_status,
        source: c.email_source || c.source_url,
      })),
    ].filter((e) => e.value);

    const boardValues = [
      prospect.company_phone,
      prospect.landline,
      company.landline,
      ...(state.contacts || []).map((c) => c.company_phone),
    ]
      .map(clean)
      .filter(Boolean);
    const board = [...new Set(boardValues)].join('\n');
    const boardSet = new Set(boardValues);

    const targets = people.length ? people : [null];
    for (const person of targets) {
      rows.push(
        rowForPerson({
          campaign,
          list,
          prospect,
          company,
          person,
          emailEntries,
          board,
          boardSet,
          activity,
          reviews,
          state,
          ownerName,
        }),
      );
    }
  }

  return {
    headers: CAMPAIGN_EXPORT_HEADERS,
    rows,
    csv:
      '\ufeff' +
      [CAMPAIGN_EXPORT_HEADERS, ...rows].map((row) => row.map(cell).join(',')).join('\r\n'),
    target_count: records.length,
    row_count: rows.length,
  };
}
