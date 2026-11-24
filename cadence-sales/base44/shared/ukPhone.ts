// Deterministic UK telephone classification.
//
// Providers label numbers inconsistently: Lusha returned a Coventry 024
// geographic landline typed "direct", and the app then called it a mobile and
// marked it "good" for dialling. Provider metadata is evidence, never truth.
// Everything that decides what a number IS goes through this module, so
// "+4424..." can never be labelled a mobile anywhere in the app.

export type UkPhoneType =
  | 'mobile'
  | 'geographic'
  | 'non_geographic'
  | 'freephone'
  | 'premium'
  | 'corporate'
  | 'voip'
  | 'invalid';

export interface UkPhone {
  raw: string;
  e164: string;        // +447700900123
  national: string;    // 07700 900123
  digits: string;      // 447700900123 (for comparison)
  type: UkPhoneType;
  isMobile: boolean;
  isGeographic: boolean;
  areaCode: string;    // 024, 01455, 07700
  label: string;       // human wording used across the UI
  valid: boolean;
  reason: string;
}

const TYPE_LABEL: Record<UkPhoneType, string> = {
  mobile: 'Mobile',
  geographic: 'Geographic landline',
  non_geographic: 'Non-geographic business number',
  freephone: 'Freephone',
  premium: 'Premium rate',
  corporate: 'Corporate number',
  voip: 'VoIP number',
  invalid: 'Invalid or malformed number',
};

export const PHONE_TYPE_LABELS = TYPE_LABEL;

// Comparison form: digits only, UK country code stripped.
export function phoneDigits(raw: string): string {
  return String(raw || '').replace(/[^\d]/g, '').replace(/^44/, '').replace(/^0/, '');
}

function toNational(raw: string): string {
  let digits = String(raw || '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+44')) digits = '0' + digits.slice(3);
  else if (digits.startsWith('0044')) digits = '0' + digits.slice(4);
  else if (digits.startsWith('44') && !digits.startsWith('440')) digits = '0' + digits.slice(2);
  else if (!digits.startsWith('0')) digits = '0' + digits;
  return digits.replace(/\D/g, '');
}

export function formatNational(national: string): string {
  const n = String(national || '');
  if (!n) return '';
  if (/^07\d{9}$/.test(n)) return `${n.slice(0, 5)} ${n.slice(5)}`;
  if (/^02\d{9}$/.test(n)) return `${n.slice(0, 3)} ${n.slice(3, 7)} ${n.slice(7)}`;
  if (/^01\d{8,9}$/.test(n)) {
    // 4-digit area codes (01xxx) carry 6 or 7 subscriber digits.
    if (/^01[1-9]1/.test(n)) return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
    return `${n.slice(0, 5)} ${n.slice(5)}`;
  }
  if (/^0[38]\d{8,9}$/.test(n)) return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
  return n;
}

// The one function that decides what a UK number is.
export function classifyUkPhone(raw: string): UkPhone {
  const national = toNational(raw);
  const base: UkPhone = {
    raw: String(raw || ''),
    e164: '',
    national: '',
    digits: '',
    type: 'invalid',
    isMobile: false,
    isGeographic: false,
    areaCode: '',
    label: TYPE_LABEL.invalid,
    valid: false,
    reason: '',
  };
  if (!national) return { ...base, reason: 'No digits found.' };

  const len = national.length;
  const done = (type: UkPhoneType, areaCode: string, reason: string): UkPhone => ({
    ...base,
    e164: '+44' + national.slice(1),
    national: formatNational(national),
    digits: national.slice(1),
    type,
    isMobile: type === 'mobile',
    isGeographic: type === 'geographic',
    areaCode,
    label: TYPE_LABEL[type],
    valid: type !== 'invalid',
    reason,
  });

  // Mobile: 071-075 and 077-079 are mobile. 070 is personal numbering and 076
  // is pagers — neither is a mobile that a sales team should treat as one.
  if (/^07[1-5]\d{8}$/.test(national) || /^07[7-9]\d{8}$/.test(national)) {
    return done('mobile', national.slice(0, 5), 'UK mobile range 07.');
  }
  if (/^07[06]\d{8}$/.test(national)) {
    return done('non_geographic', national.slice(0, 5), '07 personal numbering / pager range — not a mobile.');
  }
  if (/^07/.test(national)) {
    return { ...base, national: formatNational(national), reason: `07 number with ${len} digits — not a valid UK mobile length.` };
  }
  // Geographic: 01 and 02.
  if (/^02\d{9}$/.test(national)) return done('geographic', national.slice(0, 3), 'Geographic 02 area code.');
  if (/^01\d{9}$/.test(national)) return done('geographic', national.slice(0, 5), 'Geographic 01 area code.');
  if (/^01\d{8}$/.test(national)) return done('geographic', national.slice(0, 4), 'Geographic 01 area code.');
  if (/^01/.test(national) || /^02/.test(national)) {
    return { ...base, national: formatNational(national), reason: `Geographic number with ${len} digits — not a valid UK length.` };
  }
  if (/^03\d{9}$/.test(national)) return done('non_geographic', national.slice(0, 3), '03 UK-wide non-geographic range.');
  if (/^0800\d{6,7}$/.test(national) || /^0808\d{6,7}$/.test(national)) {
    return done('freephone', national.slice(0, 4), '08 freephone range.');
  }
  if (/^08[47]\d{7,8}$/.test(national)) return done('non_geographic', national.slice(0, 4), '08 business-rate range.');
  if (/^09\d{8,9}$/.test(national)) return done('premium', national.slice(0, 3), '09 premium-rate range.');
  if (/^055\d{7,8}$/.test(national)) return done('corporate', national.slice(0, 3), '055 corporate range.');
  if (/^056\d{8}$/.test(national)) return done('voip', national.slice(0, 3), '056 VoIP range.');
  if (/^05\d{8,9}$/.test(national)) return done('corporate', national.slice(0, 3), '05 corporate range.');

  return { ...base, national: formatNational(national), reason: `Unrecognised UK numbering plan prefix (${national.slice(0, 3)}…).` };
}

export function isUkMobile(raw: string): boolean {
  return classifyUkPhone(raw).isMobile;
}

// ---------------------------------------------------------------------------
// Provider phone evaluation
// ---------------------------------------------------------------------------

export type PhoneStatus =
  | 'unknown'
  | 'provider_returned_unverified'
  | 'verified'
  | 'manually_confirmed'
  | 'employment_mismatch'
  | 'contact_match_requires_review'
  | 'conflict_review'
  | 'invalid'
  | 'switchboard_fallback';

export const PHONE_STATUS_LABELS: Record<PhoneStatus, string> = {
  unknown: 'Unknown',
  provider_returned_unverified: 'Provider returned — not independently verified',
  verified: 'Verified',
  manually_confirmed: 'Manually confirmed',
  employment_mismatch: 'Employment mismatch — different employer',
  contact_match_requires_review: 'Match needs review',
  conflict_review: 'Conflicts with existing number — in review',
  invalid: 'Invalid number',
  switchboard_fallback: 'Company switchboard (fallback)',
};

export type EmploymentCheck = 'confirmed' | 'mismatch' | 'unconfirmed';

export interface ProviderPhoneInput {
  rawNumber: string;
  providerType: string;         // the provider's own label
  companyLandline?: string;     // the campaign's switchboard for this company
  employment: EmploymentCheck;  // result of current-employer validation
  employerName?: string;
  returnedCompany?: string;
}

export interface ProviderPhoneDecision {
  uk: UkPhone;
  type: UkPhoneType;
  isSwitchboard: boolean;
  status: PhoneStatus;
  confidence: number;
  /** May this number become the campaign's dialling number automatically? */
  promote: boolean;
  /** Send to the review queue even though nothing was promoted. */
  review: boolean;
  reviewReason: string;
  providerTypeConflict: boolean;
}

// Provider-returned data starts unverified. Promotion to the dialler needs a
// named contact, a confirmed current employer, a known number type, a valid
// format and no conflict with stored data — otherwise it goes to review.
export function evaluateProviderPhone(input: ProviderPhoneInput): ProviderPhoneDecision {
  const uk = classifyUkPhone(input.rawNumber);
  const providerType = String(input.providerType || '').toLowerCase();
  const board = phoneDigits(input.companyLandline || '');
  const isSwitchboard = !!uk.digits && !!board && uk.digits === board;
  // A provider label only counts when it agrees with the numbering plan.
  const providerTypeConflict = providerType === 'mobile' && !uk.isMobile;

  if (!uk.valid) {
    return {
      uk, type: uk.type, isSwitchboard, status: 'invalid', confidence: 0,
      promote: false, review: true, providerTypeConflict,
      reviewReason: `Provider returned ${uk.raw || 'a blank number'}, which is not a valid UK number (${uk.reason}).`,
    };
  }

  if (isSwitchboard) {
    return {
      uk, type: uk.type, isSwitchboard, status: 'switchboard_fallback', confidence: 30,
      promote: false, review: false, providerTypeConflict,
      reviewReason: 'Matches the company switchboard already held — kept as the company phone, not the contact\'s number.',
    };
  }

  if (input.employment === 'mismatch') {
    return {
      uk, type: uk.type, isSwitchboard, status: 'employment_mismatch', confidence: 0,
      promote: false, review: true, providerTypeConflict,
      reviewReason: `Provider associates this number with ${input.returnedCompany || 'another employer'}, not ${input.employerName || 'the current company'}.`,
    };
  }

  if (input.employment === 'unconfirmed') {
    return {
      uk, type: uk.type, isSwitchboard, status: 'contact_match_requires_review', confidence: 40,
      promote: false, review: true, providerTypeConflict,
      reviewReason: `The provider did not confirm that this person still works at ${input.employerName || 'this company'}, so the number cannot be promoted automatically.`,
    };
  }

  // Employer confirmed. A mobile can be promoted; a landline or direct office
  // line is a useful secondary number but never a mobile.
  if (uk.isMobile) {
    return {
      uk, type: 'mobile', isSwitchboard: false, status: 'provider_returned_unverified',
      confidence: providerTypeConflict ? 70 : 85, promote: true, review: false, providerTypeConflict,
      reviewReason: '',
    };
  }

  return {
    uk, type: uk.type, isSwitchboard: false, status: 'provider_returned_unverified',
    confidence: 60, promote: false, review: true, providerTypeConflict,
    reviewReason: providerTypeConflict
      ? `The provider labelled this a mobile, but ${uk.national} is ${uk.label.toLowerCase()}. Not promoted.`
      : `${uk.national} is ${uk.label.toLowerCase()}, not a mobile. Stored as a direct line and left for review.`,
  };
}