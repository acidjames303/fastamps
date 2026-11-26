// Persist every distinct telephone Cadence holds for a person as a ContactPhone
// candidate. Import and Lusha numbers sit side by side — never overwrite.

const clean = (value: any) => String(value ?? '').trim();

export function phoneNormalised(value: any) {
  let digits = clean(value).replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0044')) digits = '44' + digits.slice(4);
  if (digits.startsWith('0') && digits.length === 11) digits = '44' + digits.slice(1);
  return digits;
}

export function personKey(name: any) {
  return clean(name).toLowerCase().replace(/\s+/g, ' ');
}

export async function upsertContactPhoneCandidate(base44: any, org: any, row: {
  list_id?: string;
  prospect_id: string;
  person_name?: string;
  person_title?: string;
  value: string;
  phone_type?: string;
  source?: string;
  source_column?: string;
}) {
  const value = clean(row.value);
  const normalised = phoneNormalised(value);
  if (!org?.id || !row.prospect_id || !normalised) return null;

  const svc = base44.asServiceRole?.entities || base44.entities;
  const keyPerson = personKey(row.person_name);
  const existing = await svc.ContactPhone.filter(
    { organisation_id: org.id, prospect_id: row.prospect_id },
    '-created_date',
    100,
  ).catch(() => []);

  const match = (existing || []).find((phone: any) =>
    phoneNormalised(phone.normalised || phone.value) === normalised
    && personKey(phone.person_name) === keyPerson,
  );
  if (match) return match;

  return svc.ContactPhone.create({
    organisation_id: org.id,
    list_id: row.list_id || '',
    prospect_id: row.prospect_id,
    person_key: keyPerson,
    person_name: clean(row.person_name),
    person_title: clean(row.person_title),
    value,
    normalised,
    country: 'GB',
    phone_type: row.phone_type || 'mobile',
    source: row.source || 'unknown',
    source_column: row.source_column || '',
    status: 'candidate',
    screening_status: 'not_checked',
    retrieved_at: new Date().toISOString(),
    audit: [],
  }).catch(() => null);
}
