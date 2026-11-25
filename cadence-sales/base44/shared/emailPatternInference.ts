// Email pattern inference — learns the email format used by a company from
// known named employees with same-domain emails, then infers emails for
// other named contacts without consuming provider credits.
//
// Rules:
// - Learn ONLY from a named employee with a same-domain personal work email.
// - Never learn from generic addresses (info@, sales@).
// - Never learn from an already-inferred address.
// - Never overwrite an existing email.
// - Every inferred email is labelled "pattern_inferred" (unverified).
// - Store rejection so the same incorrect candidate is not regenerated.
// - Does NOT consume provider or Base44 integration credits.

import { classifyEmail, emailDomain, emailLocalPart, normaliseEmail, isValidEmailFormat } from './emailQuality.ts';

export type EmailPattern =
  | 'firstname.lastname'
  | 'firstname'
  | 'firstinitiallastname'
  | 'firstnamelastinitial'
  | 'firstnamelastname'
  | 'lastname.firstname'
  | 'lastnamefirstname'
  | 'unknown';

export interface PatternDetectionResult {
  pattern: EmailPattern;
  separator: string; // '.', '_', '-', ''
  sourceEmail: string;
  sourceName: string;
}

// Normalises a name into first and last parts, handling apostrophes, hyphens
// and accented characters consistently.
export function splitNameParts(fullName: string): { first: string; last: string } {
  if (!fullName) return { first: '', last: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return { first: parts[0] || '', last: '' };
  // Use the final token as the surname. Joining every token after the first
  // produced bad candidates for middle names (e.g. Mark Alastair Wall).
  return { first: parts[0], last: parts[parts.length - 1] };
}

// Removes accents and normalises for email local-part generation.
function asciiify(s: string): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-zA-Z0-9._-]/g, '') // strip anything not alphanumeric/._-
    .toLowerCase()
    .trim();
}

// Detects the email pattern from a known email + name + domain.
export function detectPattern(email: string, fullName: string, domain: string): PatternDetectionResult | null {
  if (!email || !fullName || !domain) return null;
  const e = normaliseEmail(email);
  const d = domain.toLowerCase().replace(/^www\./, '').trim();
  const ed = emailDomain(e);
  if (ed !== d && !ed.endsWith('.' + d)) return null;

  const localPart = emailLocalPart(e);
  if (!localPart) return null;

  // Must not be a generic inbox.
  const class_ = classifyEmail(e, domain);
  if (class_.isGeneric) return null;

  const { first, last } = splitNameParts(fullName);
  const f = asciiify(first);
  const l = asciiify(last);
  if (!f || !l) return null;

  // Try each pattern with each separator.
  const separators = ['.', '_', '-', ''];
  const patterns: Array<{ pattern: EmailPattern; candidate: string; sep: string }> = [
    ...separators.map(sep => ({ pattern: 'firstname.lastname' as EmailPattern, candidate: `${f}${sep}${l}`, sep })),
    ...separators.map(sep => ({ pattern: 'firstname' as EmailPattern, candidate: f, sep: '' })),
    ...separators.map(sep => ({ pattern: 'firstinitiallastname' as EmailPattern, candidate: `${f[0]}${sep}${l}`, sep })),
    ...separators.map(sep => ({ pattern: 'firstnamelastinitial' as EmailPattern, candidate: `${f}${sep}${l[0]}`, sep })),
    ...separators.map(sep => ({ pattern: 'firstnamelastname' as EmailPattern, candidate: `${f}${l}`, sep: '' })),
    ...separators.map(sep => ({ pattern: 'lastname.firstname' as EmailPattern, candidate: `${l}${sep}${f}`, sep })),
    ...separators.map(sep => ({ pattern: 'lastnamefirstname' as EmailPattern, candidate: `${l}${f}`, sep: '' })),
  ];

  for (const p of patterns) {
    if (localPart === p.candidate) {
      return { pattern: p.pattern, separator: p.sep, sourceEmail: e, sourceName: fullName };
    }
  }

  return null;
}

// Infers an email from a name + domain + detected pattern.
export function inferEmail(fullName: string, domain: string, detection: PatternDetectionResult): string {
  if (!fullName || !domain || !detection) return '';
  const { first, last } = splitNameParts(fullName);
  const f = asciiify(first);
  const l = asciiify(last);
  if (!f || !l) return '';

  const d = domain.toLowerCase().replace(/^www\./, '').trim();
  const sep = detection.separator;
  let localPart = '';

  switch (detection.pattern) {
    case 'firstname.lastname': localPart = `${f}${sep}${l}`; break;
    case 'firstname': localPart = f; break;
    case 'firstinitiallastname': localPart = `${f[0]}${sep}${l}`; break;
    case 'firstnamelastinitial': localPart = `${f}${sep}${l[0]}`; break;
    case 'firstnamelastname': localPart = `${f}${l}`; break;
    case 'lastname.firstname': localPart = `${l}${sep}${f}`; break;
    case 'lastnamefirstname': localPart = `${l}${f}`; break;
    default: return '';
  }

  if (!localPart) return '';
  const email = `${localPart}@${d}`;
  return isValidEmailFormat(email) ? email : '';
}

// Learns the email pattern from a list of contacts that have personal work
// emails at the same domain. Returns the first valid detection.
export function learnPatternFromContacts(contacts: any[], domain: string): PatternDetectionResult | null {
  if (!contacts || !domain) return null;
  const d = domain.toLowerCase().replace(/^www\./, '').trim();

  for (const c of contacts) {
    if (!c.name || !c.email) continue;
    // Skip contacts whose email is already pattern-inferred.
    if (c.email_source === 'pattern_inferred') continue;
    const ec = classifyEmail(c.email, d);
    if (!ec.isPersonal) continue;
    const detection = detectPattern(c.email, c.name, d);
    if (detection) return detection;
  }
  return null;
}

// Applies a learned pattern to contacts that lack an email.
// Returns the contacts with inferred emails added (non-destructive).
// Stores rejections so the same incorrect candidate is not regenerated.
export function applyPatternToContacts(
  contacts: any[],
  domain: string,
  detection: PatternDetectionResult,
  rejectedEmails: string[] = [],
): { updated: any[]; inferredCount: number; inferredEmails: string[] } {
  if (!contacts || !detection) return { updated: contacts || [], inferredCount: 0, inferredEmails: [] };

  const d = domain.toLowerCase().replace(/^www\./, '').trim();
  const rejectedSet = new Set((rejectedEmails || []).map(e => normaliseEmail(e)));
  let inferredCount = 0;
  const inferredEmails: string[] = [];

  const updated = contacts.map((c) => {
    // Skip contacts that already have an email.
    if (c.email && classifyEmail(c.email, d).isValid) return c;
    // Skip contacts without a name.
    if (!c.name || splitNameParts(c.name).last === '') return c;
    // Skip reception/switchboard entries.
    if (c.name === 'Company Reception') return c;

    const inferred = inferEmail(c.name, d, detection);
    if (!inferred) return c;
    if (rejectedSet.has(normaliseEmail(inferred))) return c;

    inferredCount++;
    inferredEmails.push(inferred);
    return {
      ...c,
      email: inferred,
      email_source: 'pattern_inferred',
      email_status: 'inferred',
      email_pattern: detection.pattern,
      email_verified: false,
    };
  });

  return { updated, inferredCount, inferredEmails };
}

// High-level wrapper: learns the pattern from contacts with known personal
// work emails, then applies it to contacts without emails. Returns the
// updated contacts array and pattern metadata. Does NOT overwrite existing
// emails and does NOT consume provider credits.
export function inferCompanyEmailPattern(
  contacts: any[],
  domain: string,
): { contacts: any[]; inferred_count: number; pattern: string; source_email: string } {
  if (!contacts || !contacts.length || !domain) {
    return { contacts: contacts || [], inferred_count: 0, pattern: '', source_email: '' };
  }
  const detection = learnPatternFromContacts(contacts, domain);
  if (!detection) {
    return { contacts, inferred_count: 0, pattern: '', source_email: '' };
  }
  const result = applyPatternToContacts(contacts, domain, detection, []);
  return {
    contacts: result.updated,
    inferred_count: result.inferredCount,
    pattern: detection.pattern,
    source_email: detection.sourceEmail,
  };
}

// Describes a detected pattern in human-readable form.
export function describePattern(detection: PatternDetectionResult): string {
  if (!detection) return '';
  const sepLabel = detection.separator === '' ? 'no separator' : `'${detection.separator}'`;
  return `${detection.pattern.replace(/\./g, sepLabel + ' → ').replace(/→ $/, '')} (learned from ${detection.sourceName})`;
}