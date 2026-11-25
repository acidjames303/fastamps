// Non-destructive merge logic — enrichment adds to existing data and never
// silently overwrites useful information. Every merge decision is explicit
// and preserves existing verified values.
//
// Rules:
// - Never replace a populated field with an empty value.
// - Never replace a verified value with a lower-confidence value.
// - Never replace a personal work email with a generic inbox.
// - Never replace a direct/mobile number with a switchboard.
// - Never replace a manually edited field automatically.
// - Conflicting values go to a review queue, never auto-overwrite.

import { classifyEmail, normaliseEmail, type EmailClassification } from './emailQuality.ts';

// Confidence levels (higher = more trustworthy).
export const CONFIDENCE = {
  MANUAL: 100,       // User-entered or user-approved
  VERIFIED: 90,      // Provider-verified
  PROVIDER: 70,      // Provider returned without explicit verification
  AI_RESEARCH: 50,   // AI web research
  PATTERN: 30,       // Derived pattern (unverified)
  EXISTING: 40,      // Pre-existing data with unknown provenance
} as const;

// Determines whether a new value should replace an existing value.
// Returns { action: 'keep' | 'replace' | 'review', reason }.
export function shouldReplaceField(
  existing: any,
  newValue: any,
  opts: {
    field: string;
    existingConfidence?: number;
    newConfidence?: number;
    manuallyEdited?: boolean;
    companyDomain?: string;
    onlyMissing?: boolean;
  }
): { action: 'keep' | 'replace' | 'review'; reason: string } {
  const { field, existingConfidence = CONFIDENCE.EXISTING, newConfidence = CONFIDENCE.PROVIDER, manuallyEdited = false, companyDomain, onlyMissing = true } = opts;

  // A company switchboard is not a person's number. When the phone field is
  // holding the switchboard, a real mobile or direct dial must be allowed to
  // replace it — even in only-missing mode.
  if (
    ['phone', 'mobile', 'direct_dial'].includes(field)
    && existing && String(existing).trim()
    && newValue && String(newValue).trim()
    && isSwitchboardNumber(String(existing))
    && !isSwitchboardNumber(String(newValue))
  ) {
    return { action: 'replace', reason: 'Existing value is a company switchboard — replacing with a direct number.' };
  }

  // If only filling missing fields and this field is populated, never replace.
  // Exception: a generic/role-based email should be upgraded to a personal one
  // even in only-missing mode — the generic inbox is not useful to a sales rep.
  if (onlyMissing && existing && String(existing).trim()) {
    if (field === 'email' || field === 'personal_email') {
      const existingClass = classifyEmail(String(existing), companyDomain);
      const newClass = classifyEmail(String(newValue), companyDomain);
      if (!(existingClass.isGeneric && newClass.type === 'personal_work')) {
        return { action: 'keep', reason: 'Field already populated — only_missing_fields is on.' };
      }
      // Fall through to email-specific rules for the generic→personal upgrade.
    } else {
      return { action: 'keep', reason: 'Field already populated — only_missing_fields is on.' };
    }
  }

  // Never replace a populated field with an empty value.
  if (existing && String(existing).trim() && (!newValue || !String(newValue).trim())) {
    return { action: 'keep', reason: 'New value is empty — preserving existing.' };
  }

  // Never replace a manually edited field automatically.
  if (manuallyEdited && existing && String(existing).trim()) {
    return { action: 'review', reason: 'Field was manually edited — requires approval.' };
  }

  // If existing is empty, always replace (fill the gap).
  if (!existing || !String(existing).trim()) {
    return { action: 'replace', reason: 'Field was empty — filling with new value.' };
  }

  // Email-specific rules.
  if (field === 'email' || field === 'personal_email') {
    const existingClass = classifyEmail(String(existing), companyDomain);
    const newClass = classifyEmail(String(newValue), companyDomain);

    // Never replace a personal work email with a generic inbox.
    if (existingClass.type === 'personal_work' && newClass.isGeneric) {
      return { action: 'keep', reason: 'Existing is a personal work email — new value is only generic.' };
    }

    // If existing is generic and new is personal, replace.
    if (existingClass.isGeneric && newClass.type === 'personal_work') {
      return { action: 'replace', reason: 'Upgrading from generic inbox to personal work email.' };
    }

    // If both are personal work emails, keep existing (don't overwrite a verified email).
    if (existingClass.type === 'personal_work' && newClass.type === 'personal_work') {
      if (normaliseEmail(String(existing)) === normaliseEmail(String(newValue))) {
        return { action: 'keep', reason: 'Same email (normalised) — no change needed.' };
      }
      return { action: 'review', reason: 'Both are personal work emails with different values — review required.' };
    }

    // Confidence-based comparison for other email types.
    if (existingConfidence >= newConfidence) {
      return { action: 'keep', reason: 'Existing value has equal or higher confidence.' };
    }
  }

  // Phone-specific rules.
  if (field === 'phone' || field === 'mobile' || field === 'direct_dial') {
    // Never replace a mobile/direct number with a switchboard.
    const existingIsMobile = isMobileNumber(String(existing));
    const newIsSwitchboard = isSwitchboardNumber(String(newValue));
    if (existingIsMobile && newIsSwitchboard) {
      return { action: 'keep', reason: 'Existing is a mobile/direct number — new value is a switchboard.' };
    }
  }

  // General confidence-based comparison.
  if (existingConfidence > newConfidence) {
    return { action: 'keep', reason: 'Existing value has higher confidence.' };
  }

  if (existingConfidence < newConfidence) {
    return { action: 'replace', reason: 'New value has higher confidence.' };
  }

  // Same confidence — if values differ, send to review.
  if (String(existing).trim() !== String(newValue).trim()) {
    return { action: 'review', reason: 'Same confidence but different values — review required.' };
  }

  return { action: 'keep', reason: 'Values are the same.' };
}

// Heuristic: does this look like a mobile number (UK mobiles start with 07 or +447).
function isMobileNumber(phone: string): boolean {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.startsWith('447') || digits.startsWith('07') || digits.startsWith('00447');
}

// Heuristic: does this look like a switchboard (non-mobile UK landline).
function isSwitchboardNumber(phone: string): boolean {
  const digits = (phone || '').replace(/\D/g, '');
  if (isMobileNumber(phone)) return false;
  // UK landlines: 01, 02, +441, +442
  return digits.startsWith('01') || digits.startsWith('02') || digits.startsWith('441') || digits.startsWith('442');
}

// Merges a new contact list into an existing contact list non-destructively.
// Deduplicates by normalised name. Existing phones/emails are never overwritten
// with empty values.
export function mergeContacts(existing: any[], incoming: any[], companyDomain?: string): {
  merged: any[];
  conflicts: Array<{ field: string; existing_value: string; new_value: string; provider: string }>;
} {
  const merged: any[] = [];
  const conflicts: any[] = [];
  const seen = new Map<string, number>(); // normalised name → index in merged

  for (const c of [...existing, ...incoming]) {
    if (!c || !c.name) continue;
    const key = c.name.toLowerCase().trim();
    const idx = seen.get(key);
    if (idx === undefined) {
      seen.set(key, merged.length);
      merged.push({ ...c });
    } else {
      const existing_c = merged[idx];
      // Merge fields — only fill empty ones, never overwrite.
      if (!existing_c.phone && c.phone) existing_c.phone = c.phone;
      if (!existing_c.email && c.email) {
        // Check email quality before merging.
        const newClass = classifyEmail(c.email, companyDomain);
        if (newClass.isValid) existing_c.email = c.email;
      }
      if (!existing_c.linkedin && c.linkedin) existing_c.linkedin = c.linkedin;
      if (!existing_c.title && c.title) existing_c.title = c.title;
      // Preserve provider identity and email provenance needed for credit-safe
      // follow-up enrichment and pattern inference.
      if (!existing_c.apollo_id && c.apollo_id) existing_c.apollo_id = c.apollo_id;
      if (!existing_c.email_status && c.email_status) existing_c.email_status = c.email_status;
      if (!existing_c.email_source && c.email_source) existing_c.email_source = c.email_source;
      if (!existing_c.email_pattern && c.email_pattern) existing_c.email_pattern = c.email_pattern;
      if (existing_c.email_verified == null && c.email_verified != null) existing_c.email_verified = c.email_verified;
    }
  }

  return { merged, conflicts };
}

// Builds provenance metadata for a field.
export function buildProvenance(provider: string, confidence: number, extra?: Record<string, any>) {
  return {
    source_provider: provider,
    confidence,
    enriched_at: new Date().toISOString(),
    verified_at: provider !== 'ai_web' ? new Date().toISOString() : null,
    ...extra,
  };
}