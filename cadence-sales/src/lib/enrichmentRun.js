// Shared run planning for selective enrichment: what the user asked for,
// which provider could actually serve it, and what the run may consume.
// Kept pure so the same numbers drive the estimate, the warnings and the
// session configuration that is sent to the backend.

export const PHONE_FIELDS = ["mobile", "direct_dial"];

// Provider → fields that provider can genuinely reveal for a named contact.
export const PROVIDER_CAPABILITIES = {
  apollo: ["decision_maker_role", "personal_email", "mobile", "company_intelligence"],
  lusha: ["personal_email", "mobile", "direct_dial"],
  // Limited FullEnrich account: phones only for people still missing a number.
  fullenrich: ["mobile"],
};

export const PROVIDER_KEY_MAP = {
  apollo: "APOLLO_API_KEY",
  lusha: "LUSHA_API_KEY",
  fullenrich: "FULLENRICH_API_KEY",
};

export const ALL_PROVIDERS = ["apollo", "lusha", "fullenrich"];

// Provider names as the user sees them, so the estimate names the providers
// that are actually ticked rather than assuming one of them.
export const PROVIDER_LABELS = {
  apollo: "Apollo",
  lusha: "Lusha",
  fullenrich: "FullEnrich",
};

// Plain-language results for a phone lookup. Used in the batch summary and the
// per-prospect diagnostics panel so a run never reports "no information found".
export const PHONE_RESULT_LABELS = {
  provider_not_called: "Lusha was not called for phone data",
  contact_not_matched: "Lusha could not match this named contact",
  contact_matched_mobile_returned: "Lusha returned a mobile number",
  contact_matched_direct_dial_returned: "Lusha returned a direct number",
  contact_matched_direct_dial_unverified: "Lusha returned a direct line, not a mobile — needs review",
  contact_matched_no_phone: "Matched, but no phone returned through the API",
  field_not_available_on_api_plan: "Number not available through the connected API plan",
  authentication_failed: "Lusha authentication failed",
  permission_failed: "Lusha permission failed",
  quota_exhausted: "Lusha quota exhausted",
  rate_limited: "Lusha rate limit reached",
  duplicate_lookup_prevented: "Duplicate lookup prevented",
  cooldown_prevented: "Cooling down after a recent not-found",
  temporary_provider_failure: "Temporary Lusha failure",
  existing_number_reused: "Existing number reused",
};

// Deterministic UK phone classification labels. Mirrors base44/shared/ukPhone.ts.
export const PHONE_TYPE_LABELS = {
  mobile: "Mobile",
  geographic: "Geographic landline",
  non_geographic: "Non-geographic business number",
  freephone: "Freephone",
  premium: "Premium rate",
  corporate: "Corporate number",
  voip: "VoIP number",
  switchboard: "Company switchboard",
  unknown: "Unknown type",
  invalid: "Invalid or malformed number",
};

export const PHONE_STATUS_LABELS = {
  unknown: "Unknown",
  provider_returned_unverified: "Provider returned — not independently verified",
  verified: "Verified",
  manually_confirmed: "Manually confirmed",
  employment_mismatch: "Employment mismatch — different employer",
  contact_match_requires_review: "Match needs review",
  conflict_review: "Conflicts with existing number — in review",
  invalid: "Invalid number",
  switchboard_fallback: "Company switchboard (fallback)",
};

export function isUkMobileNumber(value) {
  let d = String(value || "").replace(/[^\d+]/g, "");
  if (!d) return false;
  if (d.startsWith("0044")) d = "+" + d.slice(4);
  if (d.startsWith("0")) d = "+44" + d.slice(1);
  if (d.startsWith("44")) d = "+" + d;
  return /^\+447[1-57-9]\d{8}$/.test(d);
}

export function hasUsablePhone(prospect) {
  if (!prospect?.phone) return false;
  if (prospect.phone_type === "switchboard") return false;
  if (prospect.phone_status === "invalid") return false;
  return !prospect.landline || prospect.phone !== prospect.landline;
}

export function hasNamedContact(prospect) {
  return !!(prospect?.contacts?.length || prospect?.full_name);
}

// Does the prospect already hold this requested field?
export function hasField(prospect, field) {
  switch (field) {
    case "personal_email":
      return (
        !!prospect.email &&
        (prospect.email_type === "personal_work" ||
          (!prospect.email_type && !prospect.generic_email))
      );
    case "alternative_email":
      return !!prospect.alternative_email;
    case "mobile":
      return hasUsablePhone(prospect);
    case "direct_dial":
      return !!prospect.phone;
    case "company_phone":
      return !!prospect.landline;
    case "decision_maker_role":
      return hasNamedContact(prospect);
    case "company_intelligence":
      return !!(prospect.industry && (prospect.domain || prospect.website));
    default:
      return false;
  }
}

// Fields the selected search method can actually serve with a provider call.
export function supportedFieldsFor(providers) {
  const out = new Set();
  for (const provider of providers || []) {
    for (const field of PROVIDER_CAPABILITIES[provider] || []) out.add(field);
  }
  return out;
}

/**
 * Builds the run estimate shown before starting.
 * `discover` means the run will also research additional ICP contacts first.
 */
function namedContactsOf(prospect) {
  const rows = Array.isArray(prospect?.contacts)
    ? prospect.contacts.filter((c) => String(c?.name || "").trim())
    : [];
  if (rows.length) return rows;
  if (String(prospect?.full_name || "").trim()) {
    return [{
      name: prospect.full_name,
      mobile: prospect.mobile || prospect.phone || "",
      lusha_mobile: prospect.lusha_mobile || "",
      phone: prospect.phone || "",
    }];
  }
  return [];
}

function contactHasMobile(contact) {
  return !!(contact?.mobile || (contact?.phone && isUkMobileNumber(contact.phone)));
}

export function buildRunEstimate({
  prospects = [],
  requestedFields = [],
  searchMethod = "free",
  searchDepth = "standard",
  phoneCoverage = {},
  connectedProviders = {},
  selectedProviders = null,
  // "newer" = also ask Lusha beside existing import mobiles (Maximum phone search).
  existingInfoMode = "missing",
}) {
  const phoneSelected = requestedFields.some((f) => PHONE_FIELDS.includes(f));
  const usesProviders = searchMethod === "providers";
  const discover = !!phoneCoverage.discover;
  const otherKnown = phoneCoverage.otherKnown !== false;
  const seekAdditive = existingInfoMode === "newer";

  // Only the providers the user has ticked may be called, so the estimate must
  // name and count those — never a provider that happens to be connected.
  const tickedProviders = Array.isArray(selectedProviders)
    ? selectedProviders
    : ALL_PROVIDERS.filter((provider) => !!connectedProviders?.[PROVIDER_KEY_MAP[provider]]);
  const phoneProviders = tickedProviders.filter((provider) =>
    (PROVIDER_CAPABILITIES[provider] || []).some((field) => PHONE_FIELDS.includes(field)),
  );

  const recordsToProcess = prospects.filter(
    (p) => !requestedFields.every((field) => hasField(p, field)),
  ).length;

  const needingPhone = phoneSelected
    ? prospects.filter((p) => !hasUsablePhone(p))
    : [];
  const phoneWithName = needingPhone.filter((p) => hasNamedContact(p));
  const phoneWithoutName = needingPhone.filter((p) => !hasNamedContact(p));
  const numbersReused = phoneSelected ? prospects.length - needingPhone.length : prospects.length;

  // Contact-level counts — Cadence stores one prospect per company, but the
  // pilot sheet has many people per company. Estimates must not stop at 162.
  let namedContacts = 0;
  let contactsMissingMobile = 0;
  let contactsWithMobileNoLushaExtra = 0;
  for (const prospect of prospects) {
    const people = namedContactsOf(prospect);
    namedContacts += people.length;
    for (const person of people) {
      if (!contactHasMobile(person)) contactsMissingMobile += 1;
      else if (!String(person.lusha_mobile || "").trim()) contactsWithMobileNoLushaExtra += 1;
    }
  }

  // Missing-only: companies still without a usable phone (+ other known people
  // on those companies when depth widens). Maximum / newer: every named contact
  // Lusha may still usefully check (missing mobile, or import mobile with no extra yet).
  let lushaLookups = 0;
  if (phoneSelected && usesProviders) {
    if (seekAdditive) {
      lushaLookups = contactsMissingMobile + contactsWithMobileNoLushaExtra;
      // Standard depth still focuses on the best contact per company unless otherKnown.
      if (searchDepth === "standard" && !otherKnown) {
        lushaLookups = prospects.filter((p) => hasNamedContact(p)).length;
      }
    } else {
      const extraKnown = needingPhone.reduce((sum, p) => {
        const others = Math.max(0, (namedContactsOf(p).length || 0) - 1);
        return sum + (otherKnown || searchDepth !== "standard" ? others : 0);
      }, 0);
      const lookupBase = phoneWithName.length + (discover ? phoneWithoutName.length : 0);
      lushaLookups = searchDepth === "standard" && !otherKnown ? lookupBase : lookupBase + extraKnown;
    }
  }

  const lookupBaseMissingOnly = phoneWithName.length + (discover ? phoneWithoutName.length : 0);

  const providerLookups = usesProviders && phoneSelected
    ? phoneProviders.map((provider) => ({
        provider,
        label: PROVIDER_LABELS[provider] || provider,
        // FullEnrich stays gap-fill only (companies/people still blank).
        max: provider === "lusha" ? lushaLookups : lookupBaseMissingOnly,
      }))
    : [];

  const maxLushaLookups = providerLookups.find((row) => row.provider === "lusha")?.max || 0;
  const maxOtherProviderLookups = providerLookups
    .filter((row) => row.provider !== "lusha")
    .reduce((sum, row) => sum + row.max, 0);

  let maxSmartActions = 0;
  if (searchMethod === "public") maxSmartActions += recordsToProcess;
  if (discover) maxSmartActions += seekAdditive ? prospects.filter((p) => !hasNamedContact(p)).length : needingPhone.length;

  // Records that cannot be searched for a number in this mode at all.
  let recordsNotSearchable = 0;
  if (phoneSelected) {
    if (!usesProviders) recordsNotSearchable = needingPhone.length;
    else if (!discover) recordsNotSearchable = phoneWithoutName.length;
  }

  return {
    total: prospects.length,
    recordsToProcess,
    cached: Math.max(0, prospects.length - recordsToProcess),
    phoneSelected,
    recordsNeedingPhone: needingPhone.length,
    companiesWithNamedContact: phoneWithName.length,
    companiesNeedingDiscovery: discover ? phoneWithoutName.length : 0,
    namedContacts,
    contactsMissingMobile,
    contactsSeekingExtraMobile: seekAdditive ? contactsWithMobileNoLushaExtra : 0,
    seekAdditive,
    providerLookups,
    maxLushaLookups,
    maxOtherProviderLookups,
    maxSmartActions,
    numbersReused,
    recordsNotSearchable,
  };
}

// Decides whether the chosen combination can start, and whether it silently
// cannot deliver what the user asked for.
export function validateRun({ requestedFields, searchMethod, connectedList }) {
  if (!requestedFields.length) {
    return { blocked: true, message: "Choose at least one type of information to find." };
  }
  if (searchMethod === "providers") {
    if (!connectedList.length) {
      return {
        blocked: true,
        message: "Connect at least one data provider, or choose another search method.",
      };
    }
    const supported = supportedFieldsFor(connectedList);
    if (!requestedFields.some((field) => supported.has(field))) {
      return {
        blocked: true,
        message: "No provider lookup is required for the selected fields.",
      };
    }
  }
  return { blocked: false, message: "" };
}

export function startButtonLabel(searchMethod) {
  if (searchMethod === "providers") return "Enrich phones with providers";
  if (searchMethod === "public") return "Start public research";
  return "Run free inference";
}