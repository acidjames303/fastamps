// Reading an existing company list: what is missing, what is already in the
// list, and what looks like an account already there. Kept out of the component
// so the decisions an import makes can be tested without a browser.

export const normaliseCompanyName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\b(ltd|limited|plc|llp|inc|the|group|holdings|uk)\b/g, " ")
    .replace(/[^a-z0-9]/g, "")
    .trim();

const gaps = [
  ["Website", (account) => !account.domain && !account.website],
  ["Industry", (account) => !account.industry],
  ["Size", (account) => !account.employee_range],
  ["Location", (account) => !account.location],
  ["Named contact", (account) => !(account.contacts || []).length],
  ["Email", (account) => !(account.contacts || []).some((contact) => contact.email)],
  ["Phone", (account) => !(account.contacts || []).some((contact) => contact.phone)],
  // One row naming two organisations ("X c/o Y") is a landlord and its managing
  // agent, not one company — worth a person's eye before it is added.
  ["Check company name", (account) => / c\/o /i.test(` ${account.company_name || ""} `) || / \/ /.test(account.company_name || "") || /\|/.test(account.company_name || "")],
];

export function gapCounts(accounts = []) {
  return gaps
    .map(([label, missing]) => ({ label, missing: accounts.filter(missing).length }))
    .filter((gap) => gap.missing > 0);
}

// - fresh: safe to add
// - duplicates: the same company is already in the list (same domain or name)
// - ambiguous: the name resembles an existing account but is not the same one,
//   so a person decides. Never auto-merged, never silently dropped.
export function classifyIncomingAccounts({ accounts = [], existingProspects = [] } = {}) {
  const existingByDomain = new Map();
  const existingByName = new Map();
  for (const prospect of existingProspects) {
    if (prospect.domain) existingByDomain.set(String(prospect.domain).toLowerCase(), prospect);
    if (prospect.company_name) existingByName.set(normaliseCompanyName(prospect.company_name), prospect);
  }

  const seen = new Set();
  const fresh = [];
  const duplicates = [];
  const ambiguous = [];

  for (const account of accounts) {
    const domain = String(account.domain || "").toLowerCase();
    const nameKey = normaliseCompanyName(account.company_name);
    const dedupeKey = domain || nameKey;
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const sameDomain = domain ? existingByDomain.get(domain) : null;
    const sameName = nameKey ? existingByName.get(nameKey) : null;
    if (sameDomain || sameName) {
      duplicates.push({ account, existing: sameDomain || sameName });
      continue;
    }

    const nearMatch = [...existingByName.entries()].find(([existingName]) => {
      if (!existingName || !nameKey) return false;
      if (existingName === nameKey) return false;
      return existingName.includes(nameKey) || nameKey.includes(existingName);
    });
    if (nearMatch) {
      ambiguous.push({ account, existing: nearMatch[1] });
      continue;
    }

    fresh.push(account);
  }

  return { fresh, duplicates, ambiguous };
}