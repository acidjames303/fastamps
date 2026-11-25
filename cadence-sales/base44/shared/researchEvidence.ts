// Evidence gate for research output.
//
// A research run can produce a plausible-but-invented person, job title or
// number. Nothing derived from research may become CRM data (Contact record,
// callable field, dialable queue entry) unless the evidence behind it is known
// and acceptable.
//
// Statuses, strongest first:
//   confirmed_provider      returned by a paid provider and attributed to it
//   confirmed_public        found on a named public source (source URL present)
//   organisation_supplied   entered or imported by the organisation itself
//   requires_review         a name exists but nothing supports the relationship
//   inferred_unverified     derived (e.g. email pattern) — never callable
//   unsupported             placeholder, not a person, or no evidence at all

export type EvidenceStatus =
  | 'confirmed_provider'
  | 'confirmed_public'
  | 'organisation_supplied'
  | 'requires_review'
  | 'inferred_unverified'
  | 'unsupported';

const PROVIDER_SOURCES = ['lusha', 'fullenrich', 'apollo'];
const PLACEHOLDER_NAME = /contact details|company reception|^reception$|sales team|info@|no name|^unknown$|n\/a|switchboard|^company$|^the company$/i;
const ADDRESS_LIKE = /\b(street|road|rd|avenue|ave|lane|close|drive|way|unit|works|estate|court|place|industrial)\b/i;

const clean = (v: any) => String(v ?? '').trim();
const digits = (v: any) => clean(v).replace(/[^\d]/g, '');

export function isPlaceholderName(name: any): boolean {
  const v = clean(name);
  if (!v) return true;
  if (PLACEHOLDER_NAME.test(v)) return true;
  if (/\d/.test(v)) return true;
  return v.split(/\s+/).length < 2;
}

export function looksLikeAddress(value: any): boolean {
  const v = clean(value);
  if (!v) return false;
  return ADDRESS_LIKE.test(v) || (v.split(/\s+/).length > 3 && /\d/.test(v));
}

// Provider attribution must belong to THIS person. A prospect-level
// `provider_used` value says which provider last ran, not that this person or
// number came from it, so it is never evidence on its own.
function providerFor(person: any, prospect: any, field: 'phone' | 'email'): string {
  const direct = clean(person?.[field === 'phone' ? 'phone_source' : 'email_source']).toLowerCase();
  if (direct) return direct;
  if (clean(person?.lusha_id)) return 'lusha';
  if (clean(person?.apollo_id)) return 'apollo';

  // The prospect's own primary person may inherit the prospect's provenance,
  // but only where a provenance record actually exists.
  const sameAsPrimary = clean(person?.name) && clean(person?.name).toLowerCase() === clean(prospect?.full_name).toLowerCase();
  if (sameAsPrimary) {
    const provenance = prospect?.field_provenance || {};
    const entry = provenance[field];
    const fromProvenance = clean(entry?.source_provider || entry?.source).toLowerCase();
    if (fromProvenance) return fromProvenance;
    if (field === 'phone') return clean(prospect?.phone_source).toLowerCase();
  }
  return '';
}

// Assess one named person for promotion into a Contact record.
export function assessPerson(person: any, prospect: any): { status: EvidenceStatus; promotable: boolean; reason: string; callable: boolean } {
  const name = clean(person?.name);
  const phone = clean(person?.phone) || clean(person?.mobile) || clean(person?.direct_dial);
  const email = clean(person?.email);
  const sourceUrl = clean(person?.source_url) || clean(person?.evidence_url) || clean(prospect?.source_url);

  if (!name) return { status: 'unsupported', promotable: false, reason: 'no_name', callable: false };
  if (PLACEHOLDER_NAME.test(name) || /\d/.test(name) || name.split(/\s+/).length < 2) {
    return { status: 'unsupported', promotable: false, reason: 'placeholder_or_not_a_person', callable: false };
  }

  const phoneProvider = providerFor(person, prospect, 'phone');
  const emailProvider = providerFor(person, prospect, 'email');
  const fromProvider = PROVIDER_SOURCES.includes(phoneProvider) || PROVIDER_SOURCES.includes(emailProvider);

  if (fromProvider && (phone || email)) {
    return { status: 'confirmed_provider', promotable: true, reason: `provider:${phoneProvider || emailProvider}`, callable: true };
  }
  if (sourceUrl && (phone || email)) {
    return { status: 'confirmed_public', promotable: true, reason: 'public_source_url', callable: true };
  }
  if (person?.source === 'manual' || person?.source === 'import' || prospect?.source === 'manual' || prospect?.source === 'import') {
    return { status: 'organisation_supplied', promotable: true, reason: 'organisation_supplied', callable: true };
  }
  if (person?.email_status === 'inferred' || prospect?.email_verification_status === 'inferred') {
    return { status: 'inferred_unverified', promotable: false, reason: 'pattern_inferred_without_source', callable: false };
  }
  if (phone || email) {
    return { status: 'requires_review', promotable: false, reason: 'contact_details_without_source', callable: false };
  }
  return { status: 'requires_review', promotable: false, reason: 'name_without_contact_data', callable: false };
}

// A number may only reach a dialable field when its provenance supports it.
export function assessNumber(value: any, source: any): { callable: boolean; status: EvidenceStatus; reason: string } {
  const v = clean(value);
  if (!v || digits(v).length < 10) return { callable: false, status: 'unsupported', reason: 'no_number' };
  const s = clean(source).toLowerCase();
  if (PROVIDER_SOURCES.includes(s)) return { callable: true, status: 'confirmed_provider', reason: `provider:${s}` };
  if (s === 'manual' || s === 'import') return { callable: true, status: 'organisation_supplied', reason: 'organisation_supplied' };
  return { callable: false, status: 'requires_review', reason: `unsourced_number:${s || 'unknown'}` };
}