// Email quality classifier — distinguishes personal work emails from generic
// company inboxes. Used by the enrichment waterfall to decide whether a provider
// result satisfies a "personal work email" request or whether the waterfall
// must continue to the next provider.

// Role-based / generic inbox prefixes that are NOT a specific person's email.
const GENERIC_PREFIXES = [
  'hello', 'info', 'sales', 'enquiries', 'inquiries', 'contact', 'admin',
  'office', 'reception', 'support', 'help', 'general', 'mail', 'team',
  'accounts', 'billing', 'marketing', 'press', 'media', 'careers', 'jobs',
  'hr', 'recruitment', 'lettings', 'property', 'estates', 'facilities',
  'maintenance', 'enquiry', 'bookings', 'reservations', 'service', 'services',
  'noreply', 'no-reply', 'donotreply', 'do-not-reply', 'postmaster',
  'webmaster', 'abuse', 'spam', 'security', 'privacy', 'dpo', 'legal',
  'customer', 'customers', 'customerservice', 'customerserviceteam',
  'customercare', 'client', 'clients', 'investor', 'investors',
];

// Disposable email domains that should never be stored.
const DISPOSABLE_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  '10minutemail.com', 'yopmail.com', 'trashmail.com', 'getnada.com',
];

// Classification result types
export type EmailType =
  | 'personal_work'    // firstname.lastname@company.com — a specific person
  | 'role_based_work'  // sales@company.com — a role, not a person
  | 'generic_company'  // info@company.com — generic inbox
  | 'personal_non_work' // someone@gmail.com — personal, not work
  | 'invalid';          // malformed or suspicious

export interface EmailClassification {
  type: EmailType;
  isPersonal: boolean;       // true only for personal_work
  isGeneric: boolean;        // true for generic_company or role_based_work
  isValid: boolean;          // true unless invalid
  reason: string;
}

// Normalises an email for deduplication: lowercase, trim, remove dots in
// the local part for Gmail-like domains (not applied to corporate domains).
export function normaliseEmail(email: string): string {
  if (!email) return '';
  return email.toLowerCase().trim();
}

// Basic email format validation.
export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const e = email.trim();
  if (e.length < 5 || e.length > 254) return false;
  // Must have exactly one @, a local part, and a domain with a dot.
  const at = e.indexOf('@');
  if (at < 1) return false;
  if (e.lastIndexOf('@') !== at) return false;
  const domain = e.slice(at + 1);
  if (!domain || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return false;
  // No spaces or control characters.
  if (/\s/.test(e)) return false;
  return true;
}

// Extracts the domain from an email address (without @).
export function emailDomain(email: string): string {
  if (!email || !email.includes('@')) return '';
  return email.split('@')[1].toLowerCase().trim();
}

// Extracts the local part (before @).
export function emailLocalPart(email: string): string {
  if (!email || !email.includes('@')) return '';
  return email.split('@')[0].toLowerCase().trim();
}

// Checks if the email domain matches or is a subdomain of the company domain.
export function domainMatchesCompany(email: string, companyDomain: string): boolean {
  const d = emailDomain(email);
  if (!d || !companyDomain) return false;
  const cd = companyDomain.toLowerCase().replace(/^www\./, '').trim();
  // Exact match or subdomain (e.g. mail.company.com matches company.com).
  return d === cd || d.endsWith('.' + cd);
}

// Classifies an email address into one of the defined types.
export function classifyEmail(email: string, companyDomain?: string): EmailClassification {
  const e = (email || '').toLowerCase().trim();

  if (!e) {
    return { type: 'invalid', isPersonal: false, isGeneric: false, isValid: false, reason: 'Empty email.' };
  }

  if (e === 'null' || e === 'none' || e === 'undefined') {
    return { type: 'invalid', isPersonal: false, isGeneric: false, isValid: false, reason: 'Null-like placeholder.' };
  }

  if (!isValidEmailFormat(e)) {
    return { type: 'invalid', isPersonal: false, isGeneric: false, isValid: false, reason: 'Malformed email format.' };
  }

  const domain = emailDomain(e);
  const localPart = emailLocalPart(e);

  // Disposable domain check.
  if (DISPOSABLE_DOMAINS.includes(domain)) {
    return { type: 'invalid', isPersonal: false, isGeneric: false, isValid: false, reason: 'Disposable email domain.' };
  }

  // Generic inbox check — role-based prefixes.
  const baseLocal = localPart.split('+')[0].split('.')[0]; // remove +tags and dots
  if (GENERIC_PREFIXES.includes(baseLocal)) {
    return {
      type: 'generic_company',
      isPersonal: false,
      isGeneric: true,
      isValid: true,
      reason: 'Generic company inbox (e.g. info@, sales@, hello@).',
    };
  }

  // Role-based pattern: starts with a department keyword.
  const roleKeywords = ['sales', 'marketing', 'support', 'admin', 'hr', 'it', 'finance', 'ops', 'dev'];
  if (roleKeywords.some((kw) => baseLocal === kw || baseLocal.startsWith(kw + '.'))) {
    return {
      type: 'role_based_work',
      isPersonal: false,
      isGeneric: true,
      isValid: true,
      reason: 'Role-based work email, not a specific person.',
    };
  }

  // Check if the domain matches the company domain — if so, it's a work email.
  const isWorkDomain = companyDomain ? domainMatchesCompany(e, companyDomain) : true;

  // If it looks like firstname.lastname@company-domain, it's a personal work email.
  // Personal emails have a name-like local part (at least 2 chars, contains a letter,
  // and doesn't look like a role).
  const looksLikeName = /^[a-z][a-z0-9._-]{1,}$/i.test(baseLocal) && /[a-z]/i.test(baseLocal);

  if (isWorkDomain && looksLikeName) {
    return {
      type: 'personal_work',
      isPersonal: true,
      isGeneric: false,
      isValid: true,
      reason: 'Personal work email — specific person at company domain.',
    };
  }

  // If the domain doesn't match the company, it might be a personal (non-work) email.
  if (!isWorkDomain) {
    // Common personal email providers.
    const personalProviders = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'live.com', 'aol.com'];
    if (personalProviders.includes(domain)) {
      return {
        type: 'personal_non_work',
        isPersonal: false,
        isGeneric: false,
        isValid: true,
        reason: 'Personal (non-work) email address.',
      };
    }
  }

  // Default: treat as personal work if domain matches, otherwise unknown work.
  if (isWorkDomain && looksLikeName) {
    return {
      type: 'personal_work',
      isPersonal: true,
      isGeneric: false,
      isValid: true,
      reason: 'Personal work email.',
    };
  }

  // Fallback: if it has a name-like local part at a non-generic domain, assume personal work.
  if (looksLikeName && !GENERIC_PREFIXES.includes(baseLocal)) {
    return {
      type: 'personal_work',
      isPersonal: true,
      isGeneric: false,
      isValid: true,
      reason: 'Likely personal work email (name-like local part).',
    };
  }

  return {
    type: 'role_based_work',
    isPersonal: false,
    isGeneric: true,
    isValid: true,
    reason: 'Could not confirm as personal — treating as role-based.',
  };
}

// Picks the best personal work email from a list of email strings.
// Returns the first personal_work email, or '' if none found.
// Also returns the best generic email as a fallback.
export function pickBestEmail(emails: string[], companyDomain?: string): {
  personal: string;
  generic: string;
} {
  let personal = '';
  let generic = '';
  for (const e of emails) {
    if (!e || e === 'null') continue;
    const c = classifyEmail(e, companyDomain);
    if (c.type === 'personal_work' && !personal) {
      personal = e;
    } else if (c.isGeneric && !generic) {
      generic = e;
    }
  }
  return { personal, generic };
}

// Deduplicates a list of emails by normalised value.
export function dedupeEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const e of emails) {
    if (!e || e === 'null') continue;
    const n = normaliseEmail(e);
    if (seen.has(n)) continue;
    seen.add(n);
    result.push(e);
  }
  return result;
}