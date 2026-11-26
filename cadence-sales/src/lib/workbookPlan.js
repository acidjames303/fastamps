// Reading a client workbook that arrives as several tabs: one tab of approved
// accounts, another of named contacts, sometimes more. Everything here is pure
// so the decisions an import makes can be tested without a browser.
//
// Rules this file keeps:
//  - every tab is read, not just the first
//  - a contact only joins an account on a safe identity: an equal domain, or an
//    exact normalised company name when the workbook gives no domain
//  - two accounts sharing a domain are never merged, and a name never wins over
//    a conflicting domain: both are surfaced for a person to check
//  - the original company name is always kept, and a user-supplied alias
//    (e.g. MARCH -> Musk Process Services) is recorded, never substituted
//  - arbitrary columns survive as raw row data with workbook/sheet/row
//    provenance
//  - phones are candidates, never overwrites: every distinct number is kept
//    with its own type, source and status

export const normaliseHeader = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const normaliseCompanyName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\b(ltd|limited|plc|llp|inc|the|group|holdings|uk)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");

// A bare domain only counts when it actually looks like one; "Oxi-Tech" is a
// name, not a website.
export function normaliseDomain(value) {
  const text = String(value || "").trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\s+/g, "");
  if (!text || !text.includes(".") || text.includes("@")) return "";
  return text;
}

const ACCOUNT_FIELDS = [
  { key: "company_name", label: "Account name", hints: ["accountname", "companyname", "company", "account", "organisationname", "organization", "client"] },
  { key: "market", label: "Market", hints: ["market", "sector", "industry"] },
  { key: "website", label: "Website", hints: ["website", "webaddress", "domain", "url", "companywebsite"] },
  { key: "core_capabilities", label: "Core capabilities", hints: ["corecapabilities", "capabilities", "capability"] },
  { key: "potential_route", label: "Potential route", hints: ["potentialoxitechroute", "potentialroute", "route", "entryroute"] },
  { key: "priority", label: "Priority", hints: ["priority", "prioritylevel"] },
  { key: "account_decision", label: "Account decision", hints: ["pauldecision", "accountdecision", "decision", "approvalstatus", "approved"] },
  { key: "named_contacts_found", label: "Named contacts found", hints: ["namedcontactsfound", "namedcontacts"] },
  { key: "next_step", label: "Next step", hints: ["nextstep", "nextsteps"] },
  { key: "company_phone", label: "Company telephone", hints: ["publiccompanytelephone", "companytelephone", "telephonecompany", "companyphone", "switchboard", "mainline", "telephone"] },
  { key: "generic_email", label: "Generic email", hints: ["publicgenericemail", "genericemail", "companyemail", "infoemail", "enquiriesemail", "enquiries"] },
];

const CONTACT_FIELDS = [
  { key: "account_name", label: "Account name", hints: ["accountname", "companyname", "company", "account"] },
  { key: "first_name", label: "First name", hints: ["contactfirstname", "firstname", "forename", "givenname"] },
  { key: "last_name", label: "Last name", hints: ["contactlastname", "contactlastname", "lastname", "surname", "familyname"] },
  { key: "job_title", label: "Job title", hints: ["contactjobtitle", "jobtitle", "title", "position", "role"] },
  { key: "website", label: "Website", hints: ["website", "domain", "url"] },
  { key: "email", label: "Email", hints: ["contactemailaddress", "contactemail", "emailaddress", "email", "workemail"] },
  { key: "mobile", label: "Mobile", hints: ["contactmobile", "mobilenumber", "mobile", "cell"] },
  { key: "direct_phone", label: "Direct telephone", hints: ["contacttelephone", "contactphone", "directdial", "directtelephone", "directphone"] },
  { key: "company_phone", label: "Company telephone", hints: ["telephonecompany", "companytelephone", "companyphone", "switchboard", "mainline"] },
  { key: "linkedin", label: "LinkedIn", hints: ["linkedinurl", "linkedinprofile", "linkedin"] },
  { key: "source_url", label: "Source URL", hints: ["sourceurl", "sourcelink", "evidenceurl", "source"] },
  { key: "enrichment_status", label: "Enrichment status", hints: ["enrichmentstatus", "datastatus"] },
  { key: "contact_notes", label: "Contact notes", hints: ["contactnotes", "notes", "comments"] },
];

const CONTACT_SIGNALS = ["contactfirstname", "firstname", "contactlastname", "lastname", "surname", "contactjobtitle", "contactemailaddress", "contactmobile"];
const ACCOUNT_SIGNALS = ["market", "corecapabilities", "potentialoxitechroute", "potentialroute", "pauldecision", "namedcontactsfound", "nextstep", "publiccompanytelephone", "publicgenericemail", "priority"];

export const SHEET_ROLES = [
  { id: "accounts", label: "Approved accounts" },
  { id: "contacts", label: "Named contacts" },
  { id: "mixed", label: "Accounts with contacts" },
  { id: "ignore", label: "Ignore this tab" },
];

export function sheetHeaders(rows = []) {
  const headers = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row || {})) {
      const text = String(key || "").trim();
      if (!text || seen.has(text) || /^column \d+$/i.test(text)) continue;
      seen.add(text);
      headers.push(text);
    }
  }
  return headers;
}

// Which of the two jobs a tab is doing. A single-tab file that names both a
// company and a person per row is "mixed" and yields an account plus a contact.
export function classifySheet(headers = []) {
  const keys = headers.map(normaliseHeader);
  const has = (hint) => keys.includes(hint);
  const contactScore = CONTACT_SIGNALS.filter(has).length;
  const accountScore = ACCOUNT_SIGNALS.filter(has).length;
  const hasAccountName = ["accountname", "companyname", "company", "account", "organisationname"].some(has);

  if (contactScore >= 2 && accountScore === 0) return "contacts";
  if (contactScore >= 2 && accountScore > 0) return "mixed";
  if (accountScore > 0 || hasAccountName) return "accounts";
  return "unknown";
}

// Exact header match first, then the most specific header that contains a hint.
function mapFields(headers, fields) {
  const mapping = {};
  const used = new Set();
  for (const field of fields) {
    const exact = headers.find((header) => field.hints.includes(normaliseHeader(header)) && !used.has(header));
    if (exact) {
      mapping[field.key] = exact;
      used.add(exact);
    }
  }
  for (const field of fields) {
    if (mapping[field.key]) continue;
    const hints = [...field.hints].sort((a, b) => b.length - a.length);
    const loose = headers.find((header) => {
      if (used.has(header)) return false;
      const key = normaliseHeader(header);
      return hints.some((hint) => hint.length >= 5 && key.includes(hint));
    });
    if (loose) {
      mapping[field.key] = loose;
      used.add(loose);
    }
  }
  return { mapping, used };
}

export function mapSheet(headers = [], role = "accounts") {
  const fields = role === "contacts" ? CONTACT_FIELDS : role === "mixed" ? [...ACCOUNT_FIELDS, ...CONTACT_FIELDS] : ACCOUNT_FIELDS;
  const { mapping, used } = mapFields(headers, fields);
  const rows = fields.map((field) => ({
    key: field.key,
    label: field.label,
    column: mapping[field.key] || "",
  }));
  return { fields: rows, unmappedHeaders: headers.filter((header) => !used.has(header)) };
}

// --- phone candidates -------------------------------------------------------

const UK_MOBILE = /^07\d{9}$/;
const IE_MOBILE = /^08[3-9]\d{7}$/;
const UK_GEOGRAPHIC = /^0(1|2)\d{8,9}$/;
const UK_NON_GEOGRAPHIC = /^03\d{8,9}$/;
const UK_PREMIUM = /^09\d{8,9}$/;
const IE_GEOGRAPHIC = /^0[1-9]\d{6,8}$/;

export function classifyPhone(raw, countryHint = "") {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  let digits = text.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (digits.startsWith("0044")) digits = digits.slice(4);
  else if (digits.startsWith("44") && digits.length > 10) digits = digits.slice(2);
  else if (digits.startsWith("00353")) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith("353") && digits.length > 9) digits = `0${digits.slice(3)}`;
  if (!digits.startsWith("0")) digits = `0${digits}`;
  digits = digits.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 11) return { national: "", country: "", type: "invalid", raw: text };

  let country = countryHint === "IE" ? "IE" : countryHint === "GB" ? "GB" : "";
  if (IE_MOBILE.test(digits)) country = "IE";
  else if (UK_MOBILE.test(digits)) country = "GB";
  else if (UK_GEOGRAPHIC.test(digits) || UK_NON_GEOGRAPHIC.test(digits) || UK_PREMIUM.test(digits)) country = country || "GB";
  else if (IE_GEOGRAPHIC.test(digits) && countryHint === "IE") country = "IE";
  if (!country) return { national: digits, country: "", type: "unknown", raw: text };

  let type = "unknown";
  if (UK_MOBILE.test(digits) || IE_MOBILE.test(digits)) type = "mobile";
  else if (UK_GEOGRAPHIC.test(digits) || IE_GEOGRAPHIC.test(digits)) type = "geographic";
  else if (UK_NON_GEOGRAPHIC.test(digits)) type = "non_geographic";
  else if (UK_PREMIUM.test(digits)) type = "premium";

  return { national: digits, country, type, raw: text };
}

const TYPE_RANK = { mobile: 3, geographic: 2, non_geographic: 2, premium: 1, unknown: 0, invalid: 0 };

// Every distinct number for one person, keeping the strongest label for a value
// that appears twice (a mobile listed as both "Mobile" and "Telephone").
export function phoneCandidates(entries = [], countryHint = "") {
  const byValue = new Map();
  for (const entry of entries) {
    const raw = String(entry?.value ?? "").trim();
    if (!raw) continue;
    const parsed = classifyPhone(raw, entry.country || countryHint);
    if (!parsed || !parsed.national) continue;
    const key = `${parsed.country}:${parsed.national}`;
    const existing = byValue.get(key);
    const candidate = {
      value: raw,
      normalised: parsed.national,
      country: parsed.country,
      phone_type: entry.type || parsed.type,
      source: entry.source || "import",
      source_column: entry.column || "",
      retrieved_at: entry.retrieved_at || "",
      status: "candidate",
    };
    if (!existing || TYPE_RANK[candidate.phone_type] > TYPE_RANK[existing.phone_type]) {
      byValue.set(key, existing ? { ...candidate, source: `${existing.source} + ${candidate.source}` } : candidate);
    }
  }
  return [...byValue.values()];
}

// --- the plan ---------------------------------------------------------------

function valuesFor(row, fields) {
  const values = {};
  for (const field of fields) {
    if (!field.column) continue;
    values[field.key] = String(row?.[field.column] ?? "").trim();
  }
  return values;
}

export function normaliseAliases(aliases = []) {
  return (Array.isArray(aliases) ? aliases : [])
    .map((alias) => ({
      alias: String(alias?.alias ?? "").trim(),
      target: String(alias?.target ?? "").trim(),
    }))
    .filter((alias) => alias.alias && alias.target);
}

const personKey = (contact) =>
  normaliseCompanyName(`${contact.first_name || ""} ${contact.last_name || ""}`) ||
  normaliseCompanyName(contact.name || "") ||
  normaliseCompanyName(contact.email || "");

/**
 * Read every tab of every file and work out what would be imported.
 * files: [{ fileName, sheets: [{ name, rows }] }]
 */
export function planWorkbook(files = [], options = {}) {
  const aliases = normaliseAliases(options.aliases);
  const aliasByName = new Map(aliases.map((alias) => [normaliseCompanyName(alias.alias), alias.target]));
  const roleOverrides = options.roles || {};

  const sheets = [];
  const accountRows = [];
  const contactRows = [];

  for (const file of files) {
    for (const sheet of file.sheets || []) {
      const headers = sheetHeaders(sheet.rows);
      if (!headers.length || !(sheet.rows || []).length) {
        sheets.push({ fileName: file.fileName, sheetName: sheet.name, role: "ignore", rows: 0, fields: [], unmappedHeaders: [], reason: "empty" });
        continue;
      }
      const overrideKey = `${file.fileName}::${sheet.name}`;
      const detected = classifySheet(headers);
      const role = roleOverrides[overrideKey] || detected;
      const { fields, unmappedHeaders } = mapSheet(headers, role === "ignore" ? "accounts" : role);
      const columns = Object.fromEntries(fields.map((field) => [field.key, field.column]));

      sheets.push({
        fileName: file.fileName,
        sheetName: sheet.name,
        role,
        detected,
        rows: sheet.rows.length,
        headers,
        fields,
        unmappedHeaders,
        overrideKey,
      });
      if (role === "ignore") continue;

      sheet.rows.forEach((row, index) => {
        const provenance = { workbook: file.fileName, sheet: sheet.name, row: index + 2 };
        const values = valuesFor(row, fields);
        if (role === "contacts") {
          if (values.account_name) contactRows.push({ values, provenance, raw: row });
          return;
        }
        if (values.company_name) accountRows.push({ values, provenance, raw: row });
        if (role === "mixed") {
          const hasPerson = values.first_name || values.last_name || values.email;
          if (hasPerson) {
            contactRows.push({
              values: { ...values, account_name: values.account_name || values.company_name },
              provenance,
              raw: row,
            });
          }
        }
      });
    }
  }

  const accounts = [];
  const byDomain = new Map();
  const byName = new Map();
  const ambiguous = [];
  const flaggedDomains = new Set();

  const emptyAccount = (values, provenance) => ({
    company_name: values.company_name || values.account_name || "",
    domain: normaliseDomain(values.website),
    website: values.website || "",
    market: values.market || "",
    core_capabilities: values.core_capabilities || "",
    potential_route: values.potential_route || "",
    priority: values.priority || "",
    account_decision: values.account_decision || "",
    named_contacts_found: values.named_contacts_found || "",
    next_step: values.next_step || "",
    company_phone: values.company_phone || "",
    generic_email: values.generic_email || "",
    raw: { ...values },
    provenance: [provenance],
    contacts: [],
  });

  const fillAccount = (account, values, provenance, raw) => {
    for (const [key, value] of Object.entries(values)) {
      if (value && !account[key]) account[key] = value;
    }
    account.raw = { ...values, ...account.raw };
    account.provenance.push({ ...provenance, raw });
  };

  for (const row of accountRows) {
    const name = row.values.company_name || row.values.account_name || "";
    const nameKey = normaliseCompanyName(name);
    const domain = normaliseDomain(row.values.website);

    if (domain) {
      const sameDomain = byDomain.get(domain) || [];
      const exact = sameDomain.find((account) => normaliseCompanyName(account.company_name) === nameKey);
      if (exact) {
        fillAccount(exact, row.values, row.provenance, row.raw);
        continue;
      }
      if (sameDomain.length) {
        // A domain shared by differently named companies is a holding/agency
        // situation: keep both, never merge, and ask a person.
        if (!flaggedDomains.has(domain)) {
          flaggedDomains.add(domain);
          ambiguous.push({
            reason: "shared_domain",
            domain,
            names: [...sameDomain.map((account) => account.company_name), name],
          });
        }
        const created = emptyAccount(row.values, row.provenance);
        accounts.push(created);
        byDomain.set(domain, [...sameDomain, created]);
        byName.set(nameKey, [...(byName.get(nameKey) || []), created]);
        continue;
      }
    }

    const sameName = nameKey ? byName.get(nameKey) || [] : [];
    const nameMatch = sameName.find((account) => !domain || !account.domain);
    if (nameMatch) {
      fillAccount(nameMatch, row.values, row.provenance, row.raw);
      continue;
    }
    if (sameName.length) {
      // Same name, different domains: two genuinely different companies.
      ambiguous.push({ reason: "name_conflict", name, domains: [...sameName.map((account) => account.domain), domain] });
    }

    const created = emptyAccount(row.values, row.provenance);
    accounts.push(created);
    if (domain) byDomain.set(domain, [...(byDomain.get(domain) || []), created]);
    if (nameKey) byName.set(nameKey, [...(byName.get(nameKey) || []), created]);
  }

  const unmatchedContacts = [];
  const contactIndex = new Map();

  for (const row of contactRows) {
    const originalName = row.values.account_name || "";
    const aliasTarget = aliasByName.get(normaliseCompanyName(originalName)) || "";
    const resolvedName = aliasTarget || originalName;
    const resolvedKey = normaliseCompanyName(resolvedName);
    const domain = normaliseDomain(row.values.website);

    let account = null;
    if (domain && (byDomain.get(domain) || []).length === 1) account = byDomain.get(domain)[0];
    if (!account && resolvedKey && (byName.get(resolvedKey) || []).length === 1) account = byName.get(resolvedKey)[0];
    if (!account && aliasTarget && !resolvedKey) account = null;
    if (!account) {
      unmatchedContacts.push({ account_name: originalName, alias_target: aliasTarget, domain, provenance: row.provenance });
      continue;
    }

    const first = row.values.first_name || "";
    const last = row.values.last_name || "";
    const name = [first, last].filter(Boolean).join(" ").trim() || row.values.name || "";
    const contact = {
      name,
      first_name: first,
      last_name: last,
      title: row.values.job_title || "",
      email: row.values.email || "",
      email_status: row.values.email ? "provider_returned" : "unknown",
      linkedin: row.values.linkedin || "",
      source_url: row.values.source_url || "",
      notes: row.values.contact_notes || "",
      original_account_name: originalName,
      alias_target: aliasTarget,
      enrichment_status: row.values.enrichment_status || "",
      provenance: row.provenance,
      provenance_all: [row.provenance],
      raw: row.raw,
      phones: phoneCandidates(
        [
          { value: row.values.mobile, type: "mobile", column: "mobile", source: "import" },
          { value: row.values.direct_phone, type: "direct", column: "direct_phone", source: "import" },
          { value: row.values.company_phone, type: "switchboard", column: "company_phone", source: "import" },
        ],
        domain.endsWith(".ie") ? "IE" : "GB",
      ),
    };

    const key = `${account.company_name}::${personKey(contact)}`;
    const existing = contactIndex.get(key);
    if (existing) {
      for (const [field, value] of Object.entries(contact)) {
        if (field === "phones" || field === "provenance" || field === "provenance_all") continue;
        if (value && !existing[field]) existing[field] = value;
      }
      existing.provenance_all = [...(existing.provenance_all || [existing.provenance]), row.provenance];
      const seen = new Set(existing.phones.map((phone) => `${phone.country}:${phone.normalised}`));
      for (const phone of contact.phones) {
        if (!seen.has(`${phone.country}:${phone.normalised}`)) existing.phones.push(phone);
      }
      continue;
    }
    contactIndex.set(key, contact);
    account.contacts.push(contact);
  }

  const contacts = accounts.flatMap((account) => account.contacts);
  const counts = {
    accounts: accounts.length,
    namedContacts: contacts.length,
    accountsWithContacts: accounts.filter((account) => account.contacts.length > 0).length,
    accountsWithoutContacts: accounts.filter((account) => account.contacts.length === 0).length,
    contactsMissingEmail: contacts.filter((contact) => !contact.email).length,
    contactsMissingMobileOrDirect: contacts.filter(
      (contact) => !contact.phones.some((phone) => phone.phone_type === "mobile" || phone.phone_type === "direct"),
    ).length,
    contactsMissingLinkedIn: contacts.filter((contact) => !contact.linkedin).length,
    phoneCandidates: contacts.reduce((total, contact) => total + contact.phones.length, 0),
    accountsWithGenericEmail: accounts.filter((account) => account.generic_email).length,
    accountsApproved: accounts.filter((account) => /approv|yes/i.test(account.account_decision || "")).length,
    accountsWithCompanyPhone: accounts.filter((account) => account.company_phone).length,
  };

  return {
    sheets,
    accounts,
    contacts,
    ambiguous,
    unmatchedContacts,
    aliases,
    counts,
    targetRoles: parseTargetRoles(options.roleInstructions),
  };
}

// "Managing Director or Founder, Technical Director" -> discovery priorities.
export function parseTargetRoles(text = "") {
  return String(text || "")
    .split(/[\n,;]+|\bor\b/gi)
    .map((role) => role.replace(/^[-•*\d.\s]+/, "").trim())
    .filter((role) => role.length > 2 && role.length < 80)
    .filter((role, index, list) => list.findIndex((other) => other.toLowerCase() === role.toLowerCase()) === index)
    .slice(0, 25);
}

// What the import would write, before it writes it.
export function planSummary(plan) {
  if (!plan) return null;
  return {
    ...plan.counts,
    ambiguous: plan.ambiguous.length,
    unmatchedContacts: plan.unmatchedContacts.length,
    sheets: plan.sheets.filter((sheet) => sheet.role !== "ignore" && sheet.rows > 0).length,
  };
}