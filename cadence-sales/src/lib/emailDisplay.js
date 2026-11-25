// What an email address actually is, for what the tables show.
//
// Stored email_type values were written by earlier enrichment runs that only read
// the first dot-segment of the local part, so a privacy@ / dataprotection@ inbox
// was recorded as a named person's address. Re-reading the address here corrects
// the label on screen without rewriting any stored record.
//
// The token lists mirror base44/shared/emailQuality.ts — keep the two in step.

const GENERIC_TOKENS = new Set([
  "info", "sales", "hello", "enquiries", "inquiries", "contact", "admin", "office",
  "reception", "support", "help", "general", "mail", "team", "accounts", "billing",
  "marketing", "press", "media", "careers", "jobs", "hr", "recruitment", "lettings",
  "property", "estates", "facilities", "maintenance", "enquiry", "bookings",
  "reservations", "service", "services", "noreply", "postmaster", "webmaster",
  "abuse", "spam", "security", "privacy", "dpo", "legal", "customer", "customers",
  "client", "clients", "investor", "investors", "compliance", "gdpr", "data",
]);

// Compound mailboxes that read as a name but are a function: dataprotection@,
// dataprivacy@, privacyteam@, customerservices@.
const GENERIC_CONTAINS = [
  "privacy", "dataprotection", "dataprivacy", "gdpr", "noreply", "donotreply",
  "customerservice", "customercare", "enquiries", "inquiries", "reception",
];

function localPart(email) {
  const value = String(email || "").trim();
  const at = value.indexOf("@");
  return at > 0 ? value.slice(0, at).toLowerCase() : "";
}

// True when the address is a company or functional inbox rather than a person.
export function looksLikeGenericMailbox(email) {
  const local = localPart(email);
  if (!local) return false;
  const squashed = local.replace(/[^a-z0-9]/g, "");
  if (GENERIC_CONTAINS.some((token) => squashed.includes(token))) return true;
  return local.split(/[._+-]+/).filter(Boolean).some((token) => GENERIC_TOKENS.has(token));
}

// Everything a row needs to say about a record's email.
export function emailFlags(prospect = {}) {
  const email = String(prospect.email || "").trim();
  if (!email) return { hasEmail: false, isGenericOnly: false, isPersonal: false };

  const storedGeneric =
    prospect.email_type === "generic_company" || prospect.email_type === "role_based_work";
  const sameAsCompanyInbox =
    !!prospect.generic_email && prospect.generic_email.toLowerCase() === email.toLowerCase();

  // A generic address always reads as generic, even when it was stored as personal.
  const isGenericOnly = looksLikeGenericMailbox(email) || storedGeneric || sameAsCompanyInbox;

  return {
    hasEmail: true,
    isGenericOnly,
    isPersonal: !isGenericOnly && prospect.email_type === "personal_work",
  };
}